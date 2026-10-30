// Qué pasa con la plata de un evento al eliminarlo (pedido del dueño,
// 30/10/2026, lib/plata-al-eliminar.ts):
// - Sus movimientos de caja se desvinculan y siguen contando en las cajas.
// - Se devuelve al cliente lo elegido (nada, todo o una parte), por caja y
//   salón en la misma proporción en que entró, sin pasarse de lo cobrado.
// Ejercita las cuentas y la ruta REAL DELETE /api/eventos/[id] con la base
// simulada. No toca ninguna base.

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")

const RAIZ = path.join(__dirname, "..")
const resolver = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolver.call(this, request.startsWith("@/") ? path.join(RAIZ, request.slice(2)) : request, ...args)
}
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

// Un evento con $1.000 cobrados ($700 en Caja Eventos, $300 en Caja
// Jazmines) y $200 pagados a un proveedor.
const MOVS = [
  { id: "m1", tipo: "ingreso", monto: "700", salon: "Quinta", caja_destino: "caja_eventos" },
  { id: "m2", tipo: "ingreso", monto: "300", salon: "Quinta", caja_destino: "caja_jazmines" },
  { id: "m3", tipo: "egreso", monto: "200", salon: "Quinta", caja_destino: "caja_eventos" },
]
let consultas = []
let enTransaccion = false
let yaEliminado = false
let devolucionesPrevias = []
const sql = async (parts, ...values) => {
  const query = parts.join("?")
  consultas.push({ query, values, enTransaccion })
  if (query.includes("FROM eventos WHERE id")) {
    return [{ id: "e1", nombre: "PRUEBA", nombre_pareja: "Ana y Juan", fecha: "2026-12-01", estado: "pendiente", deleted_at: yaEliminado ? new Date() : null }]
  }
  if (query.includes("SELECT id, tipo, monto, salon, caja_destino FROM movimientos_caja")) return MOVS
  if (query.includes("SELECT monto FROM movimientos_caja WHERE ref_id")) return devolucionesPrevias
  if (query.includes("UPDATE movimientos_caja")) {
    return MOVS.map((m) => ({ ...m, concepto: "Cuota 1 (evento eliminado)", evento_id: null, fecha: "2026-10-01T12:00:00.000Z" }))
  }
  if (query.includes("INSERT INTO movimientos_caja")) {
    const [id, salon, monto, concepto, fecha, caja] = values
    return [{ id, salon, tipo: "egreso", monto, concepto, fecha, evento_id: null, caja_destino: caja, ref_id: values[6] }]
  }
  return []
}
sql.begin = async (fn) => { enTransaccion = true; try { return await fn(sql) } finally { enTransaccion = false } }

const cargar = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql, generateId: () => "id-nuevo" }
  if (request === "@/lib/stock-salones-server") return { perfilDesdeRequest: async () => "administracion" }
  if (request === "@/lib/activity-logger") return { logActivity: async () => {} }
  if (request === "@/lib/event-notifications") return { sendEventNotification: async () => {} }
  return cargar.call(this, request, ...args)
}
const evento = require(path.join(RAIZ, "app", "api", "eventos", "[id]", "route.ts"))
const plata = require(path.join(RAIZ, "lib", "plata-al-eliminar.ts"))
Module._load = cargar

const movs = MOVS.map((m) => ({ id: m.id, tipo: m.tipo, monto: Number(m.monto), salon: m.salon, cajaDestino: m.caja_destino }))
const borrar = (query = "") => {
  consultas = []
  return evento.DELETE(new Request(`http://localhost/api/eventos/e1${query}`, { method: "DELETE" }), { params: Promise.resolve({ id: "e1" }) })
}
const escrituras = () => consultas.filter((c) => /UPDATE|INSERT/.test(c.query) && !c.query.includes("eventos_eliminados"))

test("lo cobrado son los ingresos del evento, no los pagos a proveedores", () => {
  assert.equal(plata.cobradoDelEvento(movs), 1000)
})

test("la devolución sale de cada caja en la proporción en que entró y suma exacto", () => {
  assert.deepEqual(plata.repartirDevolucion(movs, 500).map((d) => [d.cajaDestino, d.monto]), [["caja_eventos", 350], ["caja_jazmines", 150]])
  const tercio = plata.repartirDevolucion(movs, 333.33)
  assert.equal(Math.round(tercio.reduce((s, d) => s + d.monto, 0) * 100), 33333)
  assert.deepEqual(plata.repartirDevolucion(movs, 0), [])
})

test("no se devuelve más de lo cobrado ni un monto negativo", () => {
  assert.equal(plata.validarDevolucion(1000, 1000), null)
  assert.match(plata.validarDevolucion(1000.01, 1000), /más de lo que se cobró/)
  assert.ok(plata.validarDevolucion(-1, 1000))
})

test("las tres opciones de la ventana", () => {
  assert.equal(plata.montoADevolver("queda", 400, 1000), 0)
  assert.equal(plata.montoADevolver("todo", 400, 1000), 1000)
  assert.equal(plata.montoADevolver("parte", 400, 1000), 400)
})

test("el sufijo se pone una vez y se saca al restaurar", () => {
  const c = plata.conceptoDesvinculado("Cuota 1 #ab - Ana")
  assert.equal(plata.conceptoDesvinculado(c), c)
  assert.equal(plata.conceptoRestaurado(c), "Cuota 1 #ab - Ana")
})

test("sin devolver: la plata queda en las cajas, desvinculada, y el borrado va en una transacción", async () => {
  yaEliminado = false
  const res = await borrar()
  assert.equal(res.status, 200)
  const desvincular = consultas.find((c) => c.query.includes("UPDATE movimientos_caja"))
  assert.ok(desvincular.enTransaccion)
  assert.match(desvincular.query, /SET evento_id = NULL/)
  assert.ok(desvincular.values.some((v) => Array.isArray(v) && v.join() === "m1,m2,m3"), "todos los movimientos, también los pagos a proveedores")
  assert.ok(!consultas.some((c) => c.query.includes("INSERT INTO movimientos_caja")), "no hay devolución")
  assert.ok(consultas.find((c) => c.query.includes("SET deleted_at=NOW()")).enTransaccion)
  const copia = consultas.find((c) => c.query.includes("INSERT INTO eventos_eliminados"))
  const json = JSON.parse(copia.values.find((v) => typeof v === "string" && v.includes("_plataAlEliminar")))
  assert.deepEqual(json._plataAlEliminar.movimientos, ["m1", "m2", "m3"])
  assert.equal(json._plataAlEliminar.devuelto, 0)
  const { movimientos } = await res.json()
  assert.equal(movimientos.length, 3)
  assert.ok(movimientos.every((m) => m.eventoId === undefined))
})

test("devolver una parte anota un egreso por caja", async () => {
  yaEliminado = false
  const res = await borrar("?devolver=500")
  assert.equal(res.status, 200)
  const inserts = consultas.filter((c) => c.query.includes("INSERT INTO movimientos_caja"))
  assert.equal(inserts.length, 2)
  assert.ok(inserts.every((c) => c.enTransaccion && /'egreso'/.test(c.query) && /ON CONFLICT \(id\) DO NOTHING/.test(c.query)))
  assert.deepEqual(inserts.map((c) => c.values[2]), [350, 150])
  assert.ok(inserts.every((c) => c.values[3] === "Devolución por evento eliminado - Ana y Juan"))
  assert.ok(inserts.every((c) => c.values[6] === "devolucion:e1"), "se reconocen como devolución de este evento")
})

test("si ya se le devolvió algo en una eliminación anterior, solo se puede devolver el resto", async () => {
  assert.equal(plata.cobradoDisponible(movs, [{ monto: 500 }]), 500)
  assert.equal(plata.cobradoDisponible(movs, [{ monto: 1200 }]), 0)
  const enCaja = [
    ...movs.map((m) => ({ ...m, eventoId: "e1" })),
    { id: "d1", tipo: "egreso", monto: 400, refId: "devolucion:e1" },
    { id: "otro", tipo: "ingreso", monto: 9999, eventoId: "e2" },
  ]
  assert.equal(plata.cobradoDisponibleEnCaja(enCaja, "e1"), 600)
  devolucionesPrevias = [{ monto: "500" }]
  yaEliminado = false
  assert.equal((await borrar("?devolver=500.01")).status, 400)
  assert.equal((await borrar("?devolver=500")).status, 200)
  devolucionesPrevias = []
})

test("devolver más de lo cobrado no toca nada", async () => {
  yaEliminado = false
  const res = await borrar("?devolver=1000.01")
  assert.equal(res.status, 400)
  assert.equal(escrituras().length, 0)
  assert.ok(!consultas.some((c) => c.query.includes("eventos_eliminados")))
})

test("si el evento ya estaba eliminado (reintento), no se vuelve a tocar la plata", async () => {
  yaEliminado = true
  const res = await borrar("?devolver=500")
  assert.equal(res.status, 200)
  assert.equal(escrituras().length, 0)
  assert.ok(!consultas.some((c) => c.query.includes("eventos_eliminados")))
  yaEliminado = false
})

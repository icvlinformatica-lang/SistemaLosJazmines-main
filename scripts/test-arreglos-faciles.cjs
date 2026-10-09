// Pruebas de la revisión del 8/10/2026 (puntos 9, 10, 13 y 14):
// - Imprimir: el descuento de stock y la marca del evento van juntos, y un
//   evento ya descontado no se descuenta de nuevo.
// - Crear un evento anota la fecha de alta de Argentina, no la del día UTC.
// - Un reintento del alta del evento no repite el mail.
// - Un servicio no se borra si falla la copia a la papelera.
// Ejercita el código REAL con la base, el perfil, el historial y los mails
// simulados. No toca ninguna base.

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

// --- Simulaciones ---
let consultas = [] // { query, values, enTransaccion }
let enTransaccion = false
let mailsEnviados = 0
let eventoYaDescontado = false
let insertado = true

function responder(query) {
  if (query.includes("SELECT stock_descontado FROM eventos")) return [{ stock_descontado: eventoYaDescontado }]
  if (query.includes("SELECT cantidad FROM stock_salones")) return [{ cantidad: "10" }]
  if (query.includes("SUM(cantidad)")) return [{ total: "8" }]
  if (query.includes("INSERT INTO eventos")) return [{ insertado }]
  if (query.includes("FROM eventos WHERE id")) return [{ id: "e1", nombre: "PRUEBA", fecha: "2027-03-01", estado: "pendiente" }]
  return []
}
const sql = async (parts, ...values) => {
  const query = parts.join("?")
  consultas.push({ query, values, enTransaccion })
  return responder(query)
}
sql.begin = async (fn) => {
  enTransaccion = true
  try { return await fn(sql) } finally { enTransaccion = false }
}

const cargar = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql, generateId: () => "id-nuevo" }
  if (request === "@/lib/stock-salones-server") return {
    perfilDesdeRequest: async () => "administracion",
    salonesConfigurados: async () => new Map([["Casona", "Casona"]]),
    fechaHoraCortaArgentina: () => "09/10 10:00",
  }
  if (request === "@/lib/activity-logger") return { logActivity: async () => {} }
  if (request === "@/lib/event-notifications") return { sendEventNotification: async () => { mailsEnviados++ } }
  return cargar.call(this, request, ...args)
}
const ruta = (...partes) => require(path.join(RAIZ, "app", "api", ...partes, "route.ts"))
const consumo = ruta("stock-salones", "consumo")
const eventos = ruta("eventos")
Module._load = cargar
const { fechaNegocio } = require(path.join(RAIZ, "lib", "ipc-cuotas.ts"))

const req = (url, body) =>
  new Request(`http://localhost${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })

function reiniciar() {
  consultas = []
  mailsEnviados = 0
  eventoYaDescontado = false
  insertado = true
}

const impresion = {
  salon: "Casona", eventoId: "e1", nombreEvento: "PRUEBA", motivo: "impresion",
  items: [{ insumoId: "i1", sector: "cocina", delta: -2 }],
}

test("imprimir descuenta el stock y marca el evento en la misma transacción", async () => {
  reiniciar()
  const res = await consumo.POST(req("/api/stock-salones/consumo", impresion))
  const data = await res.json()
  assert.equal(data.ok, true)
  assert.equal(data.aplicados, 1)
  assert.equal(data.yaDescontado, false)
  const bloqueo = consultas.find((c) => c.query.includes("SELECT stock_descontado FROM eventos"))
  assert.ok(bloqueo && bloqueo.enTransaccion && bloqueo.query.includes("FOR UPDATE"))
  const marca = consultas.find((c) => c.query.includes("UPDATE eventos SET stock_descontado = true"))
  assert.ok(marca && marca.enTransaccion, "la marca va dentro de la transacción")
  assert.ok(consultas.some((c) => c.query.includes("UPDATE stock_salones")))
})

test("imprimir un evento ya descontado no descuenta de nuevo", async () => {
  reiniciar()
  eventoYaDescontado = true
  const res = await consumo.POST(req("/api/stock-salones/consumo", impresion))
  const data = await res.json()
  assert.equal(data.ok, true)
  assert.equal(data.aplicados, 0)
  assert.equal(data.yaDescontado, true)
  assert.ok(!consultas.some((c) => c.query.includes("UPDATE stock_salones")), "no toca el stock")
  assert.ok(!consultas.some((c) => c.query.includes("INSERT INTO activity_log")))
})

test("devolver stock no mira ni cambia la marca del evento", async () => {
  reiniciar()
  eventoYaDescontado = true
  const res = await consumo.POST(req("/api/stock-salones/consumo", {
    ...impresion, motivo: "devolucion", items: [{ insumoId: "i1", sector: "cocina", delta: 2 }],
  }))
  assert.equal((await res.json()).aplicados, 1)
  assert.ok(!consultas.some((c) => c.query.includes("stock_descontado")))
})

const eventoNuevo = { id: "e-nuevo", nombre: "PRUEBA ALTA", fecha: "2027-03-01", salon: "Casona", estado: "pendiente" }

test("crear un evento anota la fecha de alta de Argentina y manda un mail", async () => {
  reiniciar()
  const res = await eventos.POST(req("/api/eventos", eventoNuevo))
  assert.equal(res.status, 201)
  const insert = consultas.find((c) => c.query.includes("INSERT INTO eventos"))
  assert.ok(insert.query.includes("fecha_alta"))
  assert.equal(insert.values[insert.values.length - 1], fechaNegocio())
  assert.equal(mailsEnviados, 1)
})

test("un reintento del alta (la fila ya existía) no repite el mail", async () => {
  reiniciar()
  insertado = false
  const res = await eventos.POST(req("/api/eventos", eventoNuevo))
  assert.equal(res.status, 201)
  assert.equal(mailsEnviados, 0)
})

test("la fecha de negocio a las 22:00 de Argentina sigue siendo ese día", () => {
  // 22:00 del 9/10 en Argentina son las 01:00 UTC del 10/10.
  assert.equal(fechaNegocio(new Date("2026-10-10T01:00:00Z")), "2026-10-09")
})

// --- Borrar servicio (data-service, con el cliente de Supabase simulado) ---
function cargarDataService(opciones) {
  const llamadas = []
  const client = {
    from: (tabla) => ({
      select: () => ({ eq: () => ({ single: async () => opciones.lectura }) }),
      upsert: async () => { llamadas.push(`upsert ${tabla}`); return { error: opciones.errorPapelera ?? null } },
      delete: () => ({ eq: async () => { llamadas.push(`delete ${tabla}`); return { error: null } } }),
    }),
  }
  const load = Module._load
  Module._load = function (request, ...args) {
    if (request === "./client") return { createClient: () => client }
    return load.call(this, request, ...args)
  }
  const archivo = path.join(RAIZ, "lib", "supabase", "data-service.ts")
  delete require.cache[archivo]
  try { return { db: require(archivo), llamadas } } finally { Module._load = load }
}

test("si falla la copia a la papelera, el servicio no se borra", async () => {
  const { db, llamadas } = cargarDataService({ lectura: { data: { id: "s1" }, error: null }, errorPapelera: { message: "falla" } })
  assert.equal(await db.deleteServicio("s1"), false)
  assert.ok(!llamadas.includes("delete servicios"))
})

test("si no se puede leer el servicio, no se borra", async () => {
  const { db, llamadas } = cargarDataService({ lectura: { data: null, error: { code: "500", message: "falla" } } })
  assert.equal(await db.deleteServicio("s1"), false)
  assert.ok(!llamadas.includes("delete servicios"))
})

test("con la copia guardada, el servicio se borra", async () => {
  const { db, llamadas } = cargarDataService({ lectura: { data: { id: "s1" }, error: null } })
  assert.equal(await db.deleteServicio("s1"), true)
  assert.deepEqual(llamadas, ["upsert servicios_eliminados", "delete servicios"])
})

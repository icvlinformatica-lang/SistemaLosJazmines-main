// Compra de un artículo de limpieza desde "Cargar gastos" (pedido de Rodrigo,
// 21/10/2026): el gasto va a Caja Jazmines por el camino de siempre y lo
// comprado se SUMA al stock del salón (/api/insumos-limpieza/compra), con el
// precio por unidad de esa compra. La base y la sesión están simuladas.
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const resolver = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolver.call(this, request.startsWith("@/") ? path.join(__dirname, "..", request.slice(2)) : request, ...args)
}
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

const {
  validarCompraLimpieza,
  precioPorUnidadCompra,
  conceptoGastoLimpieza,
  buscarArticulosLimpieza,
} = require("../lib/insumos-limpieza.ts")

const UUID = "00000000-0000-4000-8000-000000000001"
const SALONES = new Set(["Casona", "Quinta"])

// ── Lógica pura ────────────────────────────────────────────────────────
test("validar la compra: uuid, artículo, salón conocido, cantidad y monto mayores a 0", () => {
  const ok = validarCompraLimpieza({ id: UUID, insumoId: "papel", salon: "Casona", cantidad: 10, monto: 25000.004 }, SALONES)
  assert.deepEqual(ok, { ok: true, compra: { id: UUID, insumoId: "papel", salon: "Casona", cantidad: 10, monto: 25000 } })
  const base = { id: UUID, insumoId: "papel", salon: "Casona", cantidad: 10, monto: 25000 }
  assert.equal(validarCompraLimpieza({ ...base, id: "x" }, SALONES).ok, false)
  assert.equal(validarCompraLimpieza({ ...base, insumoId: "" }, SALONES).ok, false)
  assert.equal(validarCompraLimpieza({ ...base, salon: "Salon 9" }, SALONES).ok, false)
  assert.equal(validarCompraLimpieza({ ...base, cantidad: 0 }, SALONES).ok, false)
  assert.equal(validarCompraLimpieza({ ...base, cantidad: "10" }, SALONES).ok, false)
  assert.equal(validarCompraLimpieza({ ...base, monto: 0 }, SALONES).ok, false)
  assert.equal(validarCompraLimpieza({ ...base, monto: -5 }, SALONES).ok, false)
})

test("precio por unidad = monto / cantidad, con 2 decimales", () => {
  // 10 paquetes de papel por $25.000 → $2.500 el paquete.
  assert.equal(precioPorUnidadCompra(25000, 10), 2500)
  // 3 bidones por $10.000 → $3.333,33.
  assert.equal(precioPorUnidadCompra(10000, 3), 3333.33)
  assert.equal(precioPorUnidadCompra(10000, 0), 0)
})

test("concepto del gasto: nombre · cantidad unidad", () => {
  assert.equal(conceptoGastoLimpieza("Papel higiénico x4", 10, "PAQ"), "Papel higiénico x4 · 10 PAQ")
  assert.equal(conceptoGastoLimpieza("Alcohol", 2.5, "LT"), "Alcohol · 2,5 LT")
})

test("buscar artículos: escribir 'papel' trae los que lo contienen, sin mayúsculas ni tildes", () => {
  const lista = [
    { descripcion: "Papel higiénico x4" },
    { descripcion: "Rollo de cocina" },
    { descripcion: "PAPEL madera" },
    { descripcion: "Jabón para la ropa" },
  ]
  assert.deepEqual(buscarArticulosLimpieza("papel", lista).map((a) => a.descripcion), ["Papel higiénico x4", "PAPEL madera"])
  assert.deepEqual(buscarArticulosLimpieza("papel higienico", lista).map((a) => a.descripcion), ["Papel higiénico x4"])
  assert.deepEqual(buscarArticulosLimpieza("jabon", lista).map((a) => a.descripcion), ["Jabón para la ropa"])
  assert.deepEqual(buscarArticulosLimpieza("p", lista), [])
})

// ── Ruta simulada ──────────────────────────────────────────────────────
let perfil, sesionesGuardadas, stock, articulos, transacciones, actividad
const db = async () => {
  throw new Error("La compra va entera en una transacción")
}
db.begin = async (fn) => {
  const log = []
  transacciones.push(log)
  const tx = async (parts, ...values) => {
    const q = parts.join("?")
    log.push({ q, values })
    if (q.includes("FROM insumos_limpieza WHERE id")) return articulos.filter((a) => a.id === values[0])
    if (q.includes("INSERT INTO stock_sesiones")) {
      if (sesionesGuardadas.has(values[0])) return []
      sesionesGuardadas.add(values[0])
      return [{ id: values[0] }]
    }
    if (q.includes("SELECT cantidad FROM stock_salones")) {
      const k = `${values[0]}|${values[1]}`
      return stock.has(k) ? [{ cantidad: String(stock.get(k)) }] : []
    }
    if (q.includes("INSERT INTO stock_salones")) {
      // values: insumo_id, salon, cantidad, ...
      const k = `${values[0]}|${values[1]}`
      const nueva = (stock.get(k) ?? 0) + values[2]
      stock.set(k, nueva)
      return [{ cantidad: String(nueva) }]
    }
    if (q.includes("UPDATE insumos_limpieza SET precio_unitario")) {
      const a = articulos.find((x) => x.id === values[1])
      if (a) a.precio_unitario = values[0]
      return []
    }
    if (q.includes("INSERT INTO activity_log")) {
      actividad.push(values)
      return []
    }
    return []
  }
  return fn(tx)
}
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: db }
  if (request === "@/lib/stock-salones-server") {
    return {
      perfilDesdeRequest: async () => perfil,
      salonesConfigurados: async () => new Map([["Casona", "Casona"], ["Quinta", "Quinta"]]),
      fechaHoraCortaArgentina: () => "21/10 18:00",
    }
  }
  return load.call(this, request, ...args)
}
const compra = require("../app/api/insumos-limpieza/compra/route.ts")
Module._load = load

const reset = (p) => {
  perfil = p
  sesionesGuardadas = new Set()
  stock = new Map([["papel|Casona", 4]])
  articulos = [{ id: "papel", descripcion: "Papel higiénico x4", unidad: "PAQ", precio_unitario: 0 }]
  transacciones = []
  actividad = []
}
const comprar = (body) =>
  compra.POST(
    new Request("http://localhost/api/insumos-limpieza/compra", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
const BODY = { id: UUID, insumoId: "papel", salon: "Casona", cantidad: 10, monto: 25000 }

test("comprar 10 paquetes de papel por $25.000 en Casona: el stock pasa de 4 a 14 y el paquete sale $2.500", async () => {
  reset("administracion")
  const r = await comprar(BODY)
  assert.equal(r.status, 200)
  const data = await r.json()
  assert.equal(data.anterior, 4)
  assert.equal(data.nueva, 14)
  assert.equal(data.precioUnitario, 2500)
  assert.equal(stock.get("papel|Casona"), 14)
  assert.equal(articulos[0].precio_unitario, 2500)
  // Queda en el historial de /stock (antes → ahora) y en Actividad.
  const item = transacciones[0].find((t) => t.q.includes("INSERT INTO stock_sesion_items"))
  assert.ok(item)
  assert.equal(actividad.length, 1)
  assert.match(actividad[0].join(" "), /Casona — limpieza/)
  assert.match(actividad[0].join(" "), /4 → 14 \(\+10 PAQ\)/)
  // Solo limpieza: no toca el stock_actual de cocina ni de barra.
  assert.equal(transacciones[0].some((t) => /UPDATE insumos(_barra)? /.test(t.q)), false)
})

test("un salón que nadie contó arranca de 0", async () => {
  reset("soporte")
  const r = await comprar({ ...BODY, salon: "Quinta", cantidad: 3, monto: 9000 })
  const data = await r.json()
  assert.equal(data.anterior, null)
  assert.equal(data.nueva, 3)
})

test("el reintento con el mismo id no suma dos veces", async () => {
  reset("administracion")
  await comprar(BODY)
  const r2 = await comprar(BODY)
  assert.equal(r2.status, 200)
  assert.equal((await r2.json()).duplicada, true)
  assert.equal(stock.get("papel|Casona"), 14)
  assert.equal(actividad.length, 1)
})

test("solo Administración y Soporte: Mantenimiento, Cobrar cuota y Cocina reciben 403", async () => {
  for (const p of ["mantenimiento", "cobro", "cocina", null]) {
    reset(p)
    const r = await comprar(BODY)
    assert.equal(r.status, 403, `perfil ${p}`)
    assert.equal(stock.get("papel|Casona"), 4)
  }
})

test("un artículo borrado no suma nada", async () => {
  reset("administracion")
  const r = await comprar({ ...BODY, insumoId: "no-existe" })
  assert.equal(r.status, 404)
  assert.equal(sesionesGuardadas.size, 0)
})

test("datos inválidos: 400 sin tocar la base", async () => {
  reset("administracion")
  const r = await comprar({ ...BODY, cantidad: 0 })
  assert.equal(r.status, 400)
  assert.equal(transacciones.length, 0)
})

// Carpeta de gastos variables de Caja Jazmines (pedido de Rodrigo,
// 26/10/2026): arriba lo sin pagar, abajo lo pagado por mes
// (lib/gastos-variables-carpeta.ts). Es solo para mostrar: no toca plata.
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

const { ordenarCarpetaVariables, nombreMesGasto, fechaDelGasto } = require("../lib/gastos-variables-carpeta.ts")

const g = (id, estado, monto, fecha, fechaGasto) => ({ id, estado, monto, fecha, fechaGasto })

test("lo sin pagar va aparte, del vencimiento más cercano al más lejano", () => {
  const r = ordenarCarpetaVariables([
    g("a", "pendiente", 100, "2026-11-20"),
    g("b", "pagado", 50, "2026-10-01", "2026-10-01"),
    g("c", "vencido", 30.5, "2026-10-10"),
    g("d", "pendiente", 20, ""),
  ])
  assert.deepEqual(r.sinPagar.map((x) => x.id), ["c", "a", "d"])
  assert.equal(r.subtotalSinPagar, 150.5)
})

test("lo pagado se agrupa por mes, el más reciente primero", () => {
  const r = ordenarCarpetaVariables([
    g("mar", "pagado", 400000, "2026-03-15", "2026-03-15"),
    g("ago1", "pagado", 750000, "2026-08-10", "2026-08-10"),
    g("ago2", "pagado", 500000, "2026-08-27", "2026-08-27"),
    g("oct", "pagado", 200000, "2026-10-01", "2026-10-01"),
  ])
  assert.deepEqual(r.pagadosPorMes.map((m) => m.mes), ["2026-10", "2026-08", "2026-03"])
  const agosto = r.pagadosPorMes[1]
  assert.equal(agosto.subtotal, 1250000)
  // Dentro del mes, el más reciente primero.
  assert.deepEqual(agosto.items.map((x) => x.id), ["ago2", "ago1"])
  assert.deepEqual(r.sinPagar, [])
})

test("el mes sale de la fecha del gasto; si falta, del vencimiento; sin ninguna, al final", () => {
  const r = ordenarCarpetaVariables([
    g("sin", "pagado", 1, ""),
    g("venc", "pagado", 2, "2026-09-30"),
    g("hecho", "pagado", 3, "2026-10-05", "2026-09-28"),
  ])
  assert.deepEqual(r.pagadosPorMes.map((m) => m.mes), ["2026-09", ""])
  assert.deepEqual(r.pagadosPorMes[0].items.map((x) => x.id), ["venc", "hecho"])
  assert.equal(fechaDelGasto({ fecha: "2026-10-05", fechaGasto: "2026-09-28" }), "2026-09-28")
})

test("los montos no cambian: la suma de los grupos es la suma de la carpeta", () => {
  const items = [
    g("1", "pagado", 136000.33, "2026-03-15", "2026-03-15"),
    g("2", "pendiente", 99.99, "2026-11-01"),
    g("3", "pagado", 0.01, "2026-05-18", "2026-05-18"),
  ]
  const r = ordenarCarpetaVariables(items)
  const total = r.subtotalSinPagar + r.pagadosPorMes.reduce((s, m) => s + m.subtotal, 0)
  assert.ok(Math.abs(total - 136100.33) < 0.005)
  assert.equal(r.sinPagar.length + r.pagadosPorMes.reduce((s, m) => s + m.items.length, 0), 3)
})

test("nombre del mes", () => {
  assert.equal(nombreMesGasto("2026-03"), "Marzo 2026")
  assert.equal(nombreMesGasto(""), "Sin fecha")
})

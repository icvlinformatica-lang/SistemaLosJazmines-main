// Tabla por evento del desglose del saldo de Caja Eventos (pedido de Rodrigo,
// 2/11/2026; lib/tabla-saldo-caja-eventos.ts). Solo para mostrar.
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

const { tablaSaldoCajaEventos } = require("../lib/tabla-saldo-caja-eventos.ts")

const mov = (eventoId, caja, concepto, monto, salon = "Quinta", tipo = "ingreso") =>
  ({ eventoId, cajaDestino: caja, concepto, monto, salon, tipo })

test("vendido, pagado (las dos cajas), costo y lo que entró a Caja Eventos, con totales", () => {
  const eventos = [
    { id: "a", nombrePareja: "DAFNE", fecha: "2026-09-25", planDeCuotas: { montoTotal: 8000000 } },
    { id: "b", nombrePareja: "NAYLA", fecha: "2028-05-27", planDeCuotas: { montoTotal: 10500000 } },
    { id: "c", nombrePareja: "SIN PLAN", fecha: "2027-01-01", precioVenta: 500 },
  ]
  const costos = { a: 4103607.62, b: 3021136.74, c: 0 }
  const r = tablaSaldoCajaEventos(
    [
      mov("a", "caja_eventos", "Cuota 1 - DAFNE (Caja Eventos)", 4308787),
      mov("a", "caja_jazmines", "Cuota 1 - DAFNE (Caja Jazmines)", 3691213),
      // Un egreso del evento no cuenta como pagado.
      mov("a", "caja_eventos", "Pago saldo DJ - DAFNE", 1600000, "Quinta", "egreso"),
      mov("b", "caja_eventos", "Cuota 1 #x - NAYLA (Caja Eventos)", 10500000),
      mov("c", "caja_eventos", "Seña - SIN PLAN (Caja Eventos)", 100),
      // Otro salón: no entra.
      mov("a", "caja_eventos", "Seña - DAFNE (Caja Eventos)", 999, "Casona"),
    ],
    eventos,
    "Quinta",
    (e) => costos[e.id],
  )
  assert.deepEqual(r.filas.map((f) => [f.nombre, f.vendido, f.pagado, f.costo, f.entroCajaEventos]), [
    ["DAFNE", 8000000, 8000000, 4103607.62, 4308787],
    ["SIN PLAN", 500, 100, 0, 100],
    ["NAYLA", 10500000, 10500000, 3021136.74, 10500000],
  ])
  assert.deepEqual(r.totales, { vendido: 18500500, pagado: 18500100, costo: 7124744.36, entroCajaEventos: 14808887 })
})

test("sin nada en Caja Eventos o sin el evento cargado, no hay fila", () => {
  const r = tablaSaldoCajaEventos(
    [
      mov("j", "caja_jazmines", "Cuota 1 - J (Caja Jazmines)", 100),
      mov("borrado", "caja_eventos", "Cuota 1 - X (Caja Eventos)", 100),
    ],
    [{ id: "j", nombrePareja: "J" }],
    null,
    () => 0,
  )
  assert.deepEqual(r.filas, [])
  assert.deepEqual(r.totales, { vendido: 0, pagado: 0, costo: 0, entroCajaEventos: 0 })
})

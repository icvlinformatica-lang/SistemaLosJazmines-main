// "Cargar gastos" por pasos (pedido de Rodrigo, 22/10/2026): qué falta en
// cada paso, a qué paso se puede saltar y cuánto le toca a cada salón de un
// gasto repartido (lib/gasto-rapido-pasos.ts). No toca plata ni datos: los
// requisitos para guardar son los mismos de camposFaltantesGasto.
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
  pasosGasto,
  faltantesDelPaso,
  primerPasoIncompleto,
  puedeIrAlPaso,
  montosPorSalon,
} = require("../lib/gasto-rapido-pasos.ts")

const COMPLETO = {
  modo: "gasto",
  editando: false,
  nombre: "Reparación heladera",
  monto: "50000",
  salon: "Casona",
  fecha: "2026-10-22",
  repartir: false,
  repartoValido: false,
}

test("pasos: el gasto tiene 4 (con fecha y pago); el retiro 3; editar, los 4", () => {
  assert.deepEqual(pasosGasto("gasto", false), ["que", "salones", "fecha", "revisar"])
  assert.deepEqual(pasosGasto("retiro", false), ["que", "salones", "revisar"])
  assert.deepEqual(pasosGasto("retiro", true), ["que", "salones", "fecha", "revisar"])
})

test("cada paso pide lo suyo: concepto y monto, después salón, después vencimiento", () => {
  const vacio = { ...COMPLETO, nombre: "", monto: "", salon: "", fecha: "" }
  assert.deepEqual(faltantesDelPaso("que", vacio), ["nombre", "monto"])
  assert.deepEqual(faltantesDelPaso("salones", vacio), ["salon"])
  assert.deepEqual(faltantesDelPaso("fecha", vacio), ["fecha"])
  assert.deepEqual(faltantesDelPaso("revisar", vacio), [])
  for (const p of ["que", "salones", "fecha"]) assert.deepEqual(faltantesDelPaso(p, COMPLETO), [])
})

test("el monto tiene que ser mayor a 0", () => {
  assert.deepEqual(faltantesDelPaso("que", { ...COMPLETO, monto: "0" }), ["monto"])
})

test("repartido: pide el reparto válido en vez del salón", () => {
  const rep = { ...COMPLETO, salon: "", repartir: true, repartoValido: false }
  assert.deepEqual(faltantesDelPaso("salones", rep), ["reparto"])
  assert.deepEqual(faltantesDelPaso("salones", { ...rep, repartoValido: true }), [])
})

test("retiro: no pide vencimiento", () => {
  const ret = { ...COMPLETO, modo: "retiro", fecha: "" }
  assert.equal(primerPasoIncompleto(pasosGasto("retiro", false), ret), null)
})

test("compra de limpieza: pide la cantidad y, si se reparte, dónde se guarda lo comprado", () => {
  assert.deepEqual(faltantesDelPaso("que", COMPLETO, { cantidad: "", salonStock: "Casona" }), ["cantidad"])
  assert.deepEqual(faltantesDelPaso("que", COMPLETO, { cantidad: "2,5", salonStock: "Casona" }), [])
  const rep = { ...COMPLETO, repartir: true, repartoValido: true }
  assert.deepEqual(faltantesDelPaso("salones", rep, { cantidad: "10", salonStock: "" }), ["salonStock"])
  assert.deepEqual(faltantesDelPaso("salones", rep, { cantidad: "10", salonStock: "Quinta" }), [])
})

test("saltar pasos: atrás siempre; adelante solo con lo anterior completo", () => {
  const pasos = pasosGasto("gasto", false)
  const sinSalon = { ...COMPLETO, salon: "" }
  assert.equal(puedeIrAlPaso("que", "fecha", pasos, sinSalon), true)
  assert.equal(puedeIrAlPaso("revisar", "que", pasos, sinSalon), false)
  assert.equal(primerPasoIncompleto(pasos, sinSalon), "salones")
  assert.equal(puedeIrAlPaso("revisar", "que", pasos, COMPLETO), true)
})

test("reparto en pesos: $100.000 al 50/30/20 y $100 en tercios suman exacto", () => {
  assert.deepEqual(
    montosPorSalon(100000, [
      { salon: "Casona", porcentaje: 50 },
      { salon: "Quinta", porcentaje: 30 },
      { salon: "Salon", porcentaje: 20 },
    ]).map((m) => m.monto),
    [50000, 30000, 20000],
  )
  const tercios = montosPorSalon(100, [
    { salon: "Casona", porcentaje: 33 },
    { salon: "Quinta", porcentaje: 33 },
    { salon: "Salon", porcentaje: 34 },
  ])
  assert.deepEqual(tercios.map((m) => m.monto), [33, 33, 34])
  const raro = montosPorSalon(1000.01, [
    { salon: "Casona", porcentaje: 33 },
    { salon: "Quinta", porcentaje: 67 },
  ])
  assert.equal(Math.round(raro.reduce((s, m) => s + m.monto, 0) * 100) / 100, 1000.01)
  // Un salón con 0% no aparece.
  assert.equal(montosPorSalon(100, [{ salon: "Casona", porcentaje: 100 }, { salon: "Quinta", porcentaje: 0 }]).length, 1)
})

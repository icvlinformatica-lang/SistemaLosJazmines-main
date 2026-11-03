// Pagar menú o barra de un evento finalizado (pedido de Rodrigo, 3/11/2026;
// lib/pago-finalizado.ts).
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
  montoSugeridoFinalizado,
  montoPagoFinalizadoValido,
  costosConPagoFinalizado,
} = require("../lib/pago-finalizado.ts")

test("el monto propuesto es la foto menos lo dado a cuenta, nunca negativo", () => {
  assert.equal(montoSugeridoFinalizado(3021136.744), 3021136.74)
  assert.equal(montoSugeridoFinalizado(3000000, 1200000), 1800000)
  assert.equal(montoSugeridoFinalizado(500000, 800000), 0)
  assert.equal(montoSugeridoFinalizado(NaN), 0)
})

test("solo sirve un monto mayor a cero", () => {
  assert.equal(montoPagoFinalizadoValido(678798), true)
  assert.equal(montoPagoFinalizadoValido(0), false)
  assert.equal(montoPagoFinalizadoValido(-5), false)
  assert.equal(montoPagoFinalizadoValido(NaN), false)
})

test("anota y saca lo pagado en la foto sin tocar lo demás", () => {
  const costos = {
    observacionCostos: "nota",
    archivoCongelado: { fechaArchivado: "2026-10-01", comprasCocina: [{ insumoId: "x" }], montoPagadoBarra: 984156 },
  }
  const pagado = costosConPagoFinalizado(costos, "cocina", 2500000.004)
  assert.equal(pagado.archivoCongelado.montoPagadoCocina, 2500000)
  assert.equal(pagado.archivoCongelado.montoPagadoBarra, 984156)
  assert.deepEqual(pagado.archivoCongelado.comprasCocina, [{ insumoId: "x" }])
  assert.equal(pagado.observacionCostos, "nota")
  // No modifica el objeto original.
  assert.equal(costos.archivoCongelado.montoPagadoCocina, undefined)

  const revertido = costosConPagoFinalizado(pagado, "barra", null)
  assert.equal("montoPagadoBarra" in revertido.archivoCongelado, false)
  assert.equal(revertido.archivoCongelado.montoPagadoCocina, 2500000)
})

test("sin foto no cambia nada", () => {
  assert.equal(costosConPagoFinalizado(undefined, "cocina", 1), undefined)
  const sinFoto = { observacionCostos: "x" }
  assert.equal(costosConPagoFinalizado(sinFoto, "cocina", 1), sinFoto)
})

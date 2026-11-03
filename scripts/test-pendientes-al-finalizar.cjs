// Aviso antes de finalizar un evento: qué falta cobrar y qué falta marcar
// como pagado (pedido de Rodrigo, 3/11/2026; lib/pendientes-al-finalizar.ts).
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

const { pendientesAlFinalizar } = require("../lib/pendientes-al-finalizar.ts")

const data = {
  ingresosPendientes: [
    { eventoId: "a", numeroCuota: 6, totalCuotas: 6, fechaVencimiento: "2026-11-10", saldoRestante: 850000, esVencida: false },
    { eventoId: "a", numeroCuota: 5, totalCuotas: 6, fechaVencimiento: "2026-10-10", saldoRestante: 420000.004, esVencida: true },
    { eventoId: "b", numeroCuota: 1, totalCuotas: 3, fechaVencimiento: "2026-10-10", saldoRestante: 999, esVencida: true },
  ],
  egresosPendientes: [
    { eventoId: "a", servicioNombre: "Juan (Mozo)", tipo: "sueldo", persona: "Juan", monto: 60000 },
    { eventoId: "a", servicioNombre: "DJ Pepe", tipo: "saldo", monto: 300000 },
    { eventoId: "a", servicioNombre: "Barra del evento", tipo: "barra", monto: 1200000 },
    { eventoId: "a", servicioNombre: "Menú del evento", tipo: "menu", monto: 2500000.5 },
    { eventoId: "a", servicioNombre: "Fotógrafo", tipo: "seña", monto: 0 },
    { eventoId: "b", servicioNombre: "Menú del evento", tipo: "menu", monto: 1 },
  ],
}

test("junta solo lo del evento, en orden, con sus totales", () => {
  const r = pendientesAlFinalizar(data, "a")
  assert.deepEqual(r.porCobrar.map((c) => [c.numeroCuota, c.monto, c.vencida]), [[5, 420000, true], [6, 850000, false]])
  assert.deepEqual(r.porPagar.map((p) => p.detalle), ["Menú (comida)", "Barra (bebida)", "Saldo de DJ Pepe", "Sueldo de Juan (Mozo)"])
  assert.equal(r.totalPorCobrar, 1270000)
  assert.equal(r.totalPorPagar, 4060000.5)
  assert.equal(r.alDia, false)
})

test("sin nada pendiente queda al día", () => {
  const r = pendientesAlFinalizar(data, "otro")
  assert.equal(r.alDia, true)
  assert.equal(r.totalPorCobrar, 0)
  assert.equal(r.totalPorPagar, 0)
})

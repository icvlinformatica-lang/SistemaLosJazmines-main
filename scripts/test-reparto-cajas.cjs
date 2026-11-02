// Reparto de cada cobro entre Caja Eventos y Caja Jazmines
// (calcularProporcionCajaEventos en lib/cobrar-cuota.ts).
// Pedido del dueño (2/11/2026): a Caja Eventos va solo lo que ella paga
// (comida, bebida, servicios y sueldos del personal) más el 5 %; el costo
// operativo (los gastos fijos de Caja Jazmines) ya no cuenta.
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const root = path.resolve(__dirname, "..")
const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolveFilename.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args)
}
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    })
    module._compile(outputText, filename)
  }
}
const { calcularProporcionCajaEventos, repartirEntreCajas } = require("../lib/cobrar-cuota.ts")

const vacio = { insumos: [], insumosBarra: [], recetas: [], cocteles: [], servicios: [], personal: [] }
const ev = (patch = {}) => ({
  id: "ev", nombre: "Evento", salon: "Quinta", fecha: "2027-02-19", estado: "pendiente",
  adultos: 0, adolescentes: 0, ninos: 0, personasDietasEspeciales: 0,
  recetasAdultos: [], recetasAdolescentes: [], recetasNinos: [], recetasDietasEspeciales: [],
  barras: [], servicios: [], personalEvento: [],
  planDeCuotas: { montoTotal: 11405500, cuotasPagadas: [], cuotas: [] },
  ...patch,
})

test("caso CATA: el costo operativo ya no se lleva la cuota entera a Caja Eventos", () => {
  // Costo operativo de $9.501.083,25 y comida de $2.769.329 (foto guardada):
  // antes daba más que el precio y la cuota iba entera a Caja Eventos.
  const evento = ev({ costoOperativo: 9501083.25, costoInsumos: 2769329, costoServicios: 0 })
  const prop = calcularProporcionCajaEventos(evento)
  assert.ok(Math.abs(prop - (2769329 * 1.05) / 11405500) < 1e-12)
  const { montoEventos, montoJazmines } = repartirEntreCajas(1132969, prop)
  assert.equal(montoEventos, 288846.79)
  assert.equal(montoJazmines, 844122.21)
})

test("solo costo operativo: todo el cobro va a Caja Jazmines", () => {
  assert.equal(calcularProporcionCajaEventos(ev({ costoOperativo: 5000000 }), vacio), 0)
})

test("los sueldos del personal cuentan, con la tarifa vigente del plantel", () => {
  const pe = { id: "pe1", personalId: "mozo", nombre: "Ana", funcion: "Mozo", monto: 100000 }
  const evento = ev({ personalEvento: [pe], planDeCuotas: { montoTotal: 1050000, cuotasPagadas: [], cuotas: [] } })
  // Sin plantel: el monto guardado ($100.000 + 5 % de $1.050.000 = 10 %).
  assert.ok(Math.abs(calcularProporcionCajaEventos(evento) - 0.1) < 1e-12)
  // Con plantel: la tarifa vigente ($200.000 → 20 %).
  const personal = [{ id: "mozo", nombre: "Ana", tarifaBase: 200000 }]
  assert.ok(Math.abs(calcularProporcionCajaEventos(evento, { ...vacio, personal }) - 0.2) < 1e-12)
})

test("con costo mayor al precio, el tope sigue siendo el 100 %", () => {
  const pe = { id: "pe1", personalId: "x", nombre: "Ana", funcion: "Mozo", monto: 2000000, pagado: true }
  assert.equal(calcularProporcionCajaEventos(ev({ personalEvento: [pe], planDeCuotas: { montoTotal: 1000000, cuotasPagadas: [], cuotas: [] } }), vacio), 1)
})

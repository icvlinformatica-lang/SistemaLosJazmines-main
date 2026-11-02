// Proyección a 12 meses de Caja Jazmines y su desglose (lib/proyeccion-jazmines.ts).
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
const { armarProyeccionJazmines } = require("../lib/proyeccion-jazmines.ts")

const meses = [
  { key: "2026-11", label: "noviembre de 2026" },
  { key: "2026-12", label: "diciembre de 2026" },
  { key: "2027-01", label: "enero de 2027" },
]
const base = (patch = {}) => ({
  meses,
  saldoActual: 1000000,
  cuotas: [],
  fijos: [],
  sueldos: [],
  variables: [],
  movimientos: [],
  nombreEvento: (id) => ({ cata: "CATA" })[id],
  hoy: "2026-11-02",
  ...patch,
})
const cuota = (numero, fechaVencimiento, montoJazmines) => ({
  id: `cata-cuota-${numero}`, eventoId: "cata", eventoNombre: "CATA", salon: "Quinta",
  numeroCuota: numero, totalCuotas: 8, fechaVencimiento, montoJazmines,
})

test("la cuota atrasada de octubre suma en noviembre (antes no sumaba en ningún mes)", () => {
  const { proyeccionMensual, desglose } = armarProyeccionJazmines(base({
    cuotas: [cuota(4, "2026-10-25", 844122.21), cuota(5, "2026-11-25", 844122.21), cuota(6, "2026-12-25", 844122.21)],
  }))
  assert.equal(proyeccionMensual[0].aCobrar, 1688244.42)
  assert.equal(proyeccionMensual[1].aCobrar, 844122.21)
  assert.deepEqual(desglose["2026-11"].cobrar.pendientes.map((p) => [p.numeroCuota, p.vencida]), [[4, true], [5, false]])
})

test("en el mes actual el gasto fijo cuenta solo lo que falta pagar; los meses que vienen, entero", () => {
  const { proyeccionMensual, desglose } = armarProyeccionJazmines(base({
    fijos: [
      { id: "luz", concepto: "Luz", salon: "Quinta", frecuencia: "Mensual", monto: 300000, faltaMesActual: 0, diaVencimiento: 10 },
      { id: "alquiler", concepto: "Alquiler", salon: null, frecuencia: "Mensual", monto: 2000000, faltaMesActual: 2000000, diaVencimiento: 1 },
    ],
  }))
  assert.equal(proyeccionMensual[0].aPagar, 2000000)
  assert.equal(proyeccionMensual[1].aPagar, 2300000)
  const alquiler = desglose["2026-11"].pagar.pendientes[0]
  assert.equal(alquiler.fechaVencimiento, "2026-11-01")
  assert.equal(alquiler.vencido, true)
})

test("anual en su mes, sueldo todos los meses y variable vencido sin pagar en el mes actual", () => {
  const { proyeccionMensual } = armarProyeccionJazmines(base({
    fijos: [{ id: "seguro", concepto: "Seguro", frecuencia: "Anual", monto: 1200000, faltaMesActual: 1200000, fechaVencimiento: "2026-12-15" }],
    sueldos: [{ id: "s1", concepto: "Sueldo vendedor · Ana", monto: 500000, diaVencimiento: 5 }],
    variables: [
      { id: "v1", concepto: "Arreglo luces", salon: "Salon", monto: 50000, fechaVencimiento: "2026-10-20" },
      { id: "v2", concepto: "Pintura", salon: "Salon", monto: 80000, fechaVencimiento: "2027-01-05" },
    ],
  }))
  assert.deepEqual(proyeccionMensual.map((m) => m.aPagar), [550000, 1700000, 580000])
})

test("ya ingresó y ya pagado salen de los movimientos reales de Caja Jazmines de ese mes", () => {
  const { desglose } = armarProyeccionJazmines(base({
    movimientos: [
      { id: "m1", fecha: "2026-11-01T15:00:00.000Z", tipo: "ingreso", concepto: "Cuota 3 #ab12cd34 - CATA (Caja Jazmines)", monto: 830000, cajaDestino: "caja_jazmines", salon: "Quinta", eventoId: "cata" },
      { id: "m2", fecha: "2026-11-01T15:00:00.000Z", tipo: "ingreso", concepto: "Cuota 3 #ab12cd34 - CATA", monto: 290000, cajaDestino: "caja_eventos", salon: "Quinta", eventoId: "cata" },
      { id: "m3", fecha: "2026-11-02T15:00:00.000Z", tipo: "egreso", concepto: "Pago gasto fijo Luz", monto: 300000, cajaDestino: "caja_jazmines", salon: "Quinta", refId: "gf:luz:2026-11:Quinta" },
      { id: "m4", fecha: "2026-11-02T15:00:00.000Z", tipo: "egreso", concepto: "Retiro", monto: 100000, cajaDestino: "caja_jazmines", salon: "Quinta" },
      { id: "m5", fecha: "2026-10-30T15:00:00.000Z", tipo: "ingreso", concepto: "Cuota 2 - CATA", monto: 800000, cajaDestino: "caja_jazmines", salon: "Quinta", eventoId: "cata" },
    ],
  }))
  const nov = desglose["2026-11"]
  assert.equal(nov.cobrar.yaIngreso, 830000)
  assert.equal(nov.cobrar.cobrados[0].eventoNombre, "CATA")
  assert.equal(nov.cobrar.cobrados[0].concepto, "Cuota 3")
  assert.equal(nov.pagar.yaPagado, 300000)
  assert.equal(nov.pagar.pagados.length, 1)
})

test("la falta del desglose es el número de la tabla y el saldo se acumula desde el saldo actual", () => {
  const { proyeccionMensual, desglose } = armarProyeccionJazmines(base({
    cuotas: [cuota(5, "2026-11-25", 100.555), cuota(6, "2026-12-25", 200)],
    fijos: [{ id: "luz", concepto: "Luz", frecuencia: "Mensual", monto: 150, faltaMesActual: 50 }],
  }))
  for (const m of proyeccionMensual) {
    assert.equal(m.aCobrar, desglose[m.key].cobrar.falta)
    assert.equal(m.aPagar, desglose[m.key].pagar.falta)
  }
  assert.equal(proyeccionMensual[0].aCobrar, 100.56)
  assert.equal(proyeccionMensual[2].saldoProyectado, 1000000 + (100.56 - 50) + (200 - 150) + (0 - 150))
  assert.equal(proyeccionMensual[0].esActual, true)
})

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const root = path.resolve(__dirname, "..")

// Ejecuta los módulos reales de TypeScript sin agregar dependencias de test.
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

function loadMocked(filename, mocks) {
  const load = Module._load
  Module._load = function (request, ...args) {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    return load.call(this, request, ...args)
  }
  try {
    const resolved = path.join(root, filename)
    delete require.cache[require.resolve(resolved)]
    return require(resolved)
  } finally {
    Module._load = load
  }
}

const pago = require(path.join(root, "lib/pago-gasto-fijo.ts"))
// El hook usa useMemo: fuera de React alcanza con ejecutar la cuenta.
const { useCajaJazmines } = loadMocked("lib/hooks/use-caja-jazmines.ts", { react: { useMemo: (fn) => fn() } })

// 13/10/2026 a las 15 hs de Argentina.
const HOY = new Date("2026-10-13T15:00:00-03:00")
const FECHA = "2026-10-13T18:00:00.000Z"

function fijo(cambios = {}) {
  return {
    id: "fijo-1",
    concepto: "PRUEBA ALQUILER",
    tipo: "Gastos Generales",
    monto: 650000,
    frecuencia: "Mensual",
    esPorPersona: false,
    salon: "Casona",
    activo: true,
    esVariable: false,
    pagado: true,
    fechaVencimiento: "2026-07-10",
    historialMontos: [{ id: "r-sep", mes: "2026-09", monto: 650000, montoAnterior: 650000, fecha: "2026-09-10T12:00:00.000Z", pagado: true }],
    ...cambios,
  }
}

/** Gasto repartido como los de la base: partes de un período viejo marcadas pagadas. */
function repartido(cambios = {}) {
  return fijo({
    id: "rep-1",
    concepto: "PRUEBA ADMINISTRACION",
    monto: 800000,
    salon: null,
    historialMontos: undefined,
    distribucion: [
      { salon: "Quinta", porcentaje: 34, pagado: true },
      { salon: "Casona", porcentaje: 33, pagado: true },
      { salon: "Salon", porcentaje: 33, pagado: true },
    ],
    ...cambios,
  })
}

const pagar = (gasto, opciones) => ({
  ...gasto,
  ...pago.cambiosPagoDelMes(gasto, { fechaISO: FECHA, nuevoId: `r-${opciones.mes}-${opciones.parte?.salon ?? "todos"}`, ...opciones }),
})

function caja(costosOperativos, salon = "todos", extra = {}) {
  return useCajaJazmines({ costosOperativos, movimientosCaja: [], eventos: [], gastosArchivados: [], vendedores: [], ...extra }, salon, HOY)
}

test("pagoDelMesActual: el mes está pagado solo si su registro lo está, y acepta el mes por parámetro", () => {
  const gasto = fijo()
  assert.deepEqual(pago.pagoDelMesActual(gasto, undefined, "2026-09"), { monto: 650000, pagado: true })
  assert.deepEqual(pago.pagoDelMesActual(gasto, undefined, "2026-10"), { monto: 650000, pagado: false })
  // Sin el dato pagado (registros viejos) cuenta como pagado; pagado:false no.
  const viejo = fijo({ historialMontos: [{ id: "a", mes: "2026-10", monto: 700000, montoAnterior: 650000, fecha: FECHA }] })
  assert.deepEqual(pago.pagoDelMesActual(viejo, undefined, "2026-10"), { monto: 700000, pagado: true })
  const debe = fijo({ historialMontos: [{ id: "a", mes: "2026-10", monto: 700000, montoAnterior: 650000, fecha: FECHA, pagado: false }] })
  assert.equal(pago.pagoDelMesActual(debe, undefined, "2026-10").pagado, false)
  // Sin el tercer parámetro mira el mes en curso del navegador, como antes.
  const ahora = new Date()
  const mesLocal = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`
  const delMes = fijo({ historialMontos: [{ id: "a", mes: mesLocal, monto: 1000, montoAnterior: 1000, fecha: FECHA, pagado: true }] })
  assert.equal(pago.pagoDelMesActual(delMes).pagado, true)
})

test("pagoDelMesActual: repartido visto desde un salón, en el mes vigente manda la parte del salón", () => {
  const gasto = repartido({
    historialMontos: [{ id: "oct", mes: "2026-10", monto: 800000, montoAnterior: 800000, fecha: FECHA, pagado: false }],
    distribucion: [
      { salon: "Quinta", porcentaje: 34, pagado: false },
      { salon: "Casona", porcentaje: 33, pagado: true },
      { salon: "Salon", porcentaje: 33, pagado: false },
    ],
  })
  assert.deepEqual(pago.pagoDelMesActual(gasto, { salon: "Casona", porcentaje: 33 }, "2026-10"), { monto: 264000, pagado: true })
  assert.deepEqual(pago.pagoDelMesActual(gasto, { salon: "Quinta", porcentaje: 34 }, "2026-10"), { monto: 272000, pagado: false })
})

test("deudaDelPeriodo: con septiembre pagado y sin octubre, se debe el monto vigente con centavos", () => {
  const gasto = fijo({ monto: 318597.92 })
  assert.deepEqual(pago.deudaDelPeriodo(gasto, "2026-10"), {
    mes: "2026-10",
    pagado: false,
    montoGeneral: 318597.92,
    monto: 318597.92,
    partes: [],
  })
  assert.equal(pago.deudaDelPeriodo(gasto, "2026-09").monto, 0)
  // Si el mes ya tiene monto cargado sin pagar, se debe ese monto.
  const cargado = fijo({
    historialMontos: [{ id: "oct", mes: "2026-10", monto: 700000, montoAnterior: 650000, fecha: FECHA, pagado: false }],
  })
  assert.equal(pago.deudaDelPeriodo(cargado, "2026-10").monto, 700000)
})

test("deudaDelPeriodo: repartido en Todos los salones debe solo las partes que faltan", () => {
  const sinPagar = repartido()
  const todo = pago.deudaDelPeriodo(sinPagar, "2026-10")
  assert.equal(todo.monto, 800000)
  assert.deepEqual(todo.partes.map((d) => d.salon), ["Quinta", "Casona", "Salon"])
  // Desde un salón: su parte del monto general.
  assert.equal(pago.deudaDelPeriodo(sinPagar, "2026-10", { salon: "Casona", porcentaje: 33 }).monto, 264000)

  const casonaPago = pagar(sinPagar, { mes: "2026-10", montoGeneral: 800000, pagado: true, parte: { salon: "Casona", porcentaje: 33 } })
  const resto = pago.deudaDelPeriodo(casonaPago, "2026-10")
  assert.equal(resto.pagado, false)
  assert.equal(resto.monto, 272000 + 264000)
  assert.deepEqual(resto.partes.map((d) => d.salon), ["Quinta", "Salon"])
})

test("deudaDelPeriodo: un gasto anual está pagado si hay un registro pagado en el año", () => {
  const anual = fijo({ frecuencia: "Anual", fechaVencimiento: "2026-03-15", historialMontos: [] })
  assert.equal(pago.deudaDelPeriodo(anual, "2026-10").pagado, false)
  const pagadoEnMarzo = fijo({
    frecuencia: "Anual",
    historialMontos: [{ id: "mar", mes: "2026-03", monto: 90000, montoAnterior: 90000, fecha: FECHA, pagado: true }],
  })
  assert.equal(pago.deudaDelPeriodo(pagadoEnMarzo, "2026-10").pagado, true)
  assert.equal(pago.deudaDelPeriodo(pagadoEnMarzo, "2027-01").pagado, false)
  // Si el año ya tiene un registro sin pagar, el pago se anota en ese mes.
  const debeMarzo = fijo({
    frecuencia: "Anual",
    historialMontos: [{ id: "mar", mes: "2026-03", monto: 90000, montoAnterior: 90000, fecha: FECHA, pagado: false }],
  })
  assert.deepEqual(
    { mes: pago.deudaDelPeriodo(debeMarzo, "2026-10").mes, monto: pago.deudaDelPeriodo(debeMarzo, "2026-10").monto },
    { mes: "2026-03", monto: 90000 },
  )
})

test("cambiosPagoDelMes: pagar un mes nuevo crea su registro y lo deja vigente, sin perder centavos", () => {
  const gasto = fijo({ monto: 318597.92 })
  const cambios = pago.cambiosPagoDelMes(gasto, { mes: "2026-10", montoGeneral: 318597.92, pagado: true, fechaISO: FECHA, nuevoId: "nuevo" })
  assert.deepEqual(cambios.historialMontos.map((r) => [r.mes, r.monto, r.pagado]), [
    ["2026-09", 650000, true],
    ["2026-10", 318597.92, true],
  ])
  assert.equal(cambios.historialMontos[1].montoAnterior, 318597.92)
  assert.equal(cambios.monto, 318597.92)
  assert.equal(cambios.pagado, true)
  // Monto inválido: no cambia nada.
  assert.equal(pago.cambiosPagoDelMes(gasto, { mes: "2026-10", montoGeneral: 0, pagado: true, fechaISO: FECHA, nuevoId: "x" }), null)
})

test("cambiosPagoDelMes: pagar un mes que no es el vigente no toca el monto ni las partes del gasto", () => {
  const gasto = fijo({
    historialMontos: [
      { id: "sep", mes: "2026-09", monto: 650000, montoAnterior: 650000, fecha: FECHA, pagado: true },
      { id: "nov", mes: "2026-11", monto: 700000, montoAnterior: 650000, fecha: FECHA, pagado: false },
    ],
    monto: 700000,
  })
  const cambios = pago.cambiosPagoDelMes(gasto, { mes: "2026-10", montoGeneral: 650000, pagado: true, fechaISO: FECHA, nuevoId: "oct" })
  assert.deepEqual(cambios.historialMontos.map((r) => r.mes), ["2026-09", "2026-10", "2026-11"])
  assert.equal("monto" in cambios, false)
  assert.equal("pagado" in cambios, false)
})

test("repartido: pagar desde Casona un mes nuevo deja pendientes las partes de Quinta y Salón", () => {
  // Las partes guardadas son de un período viejo (todas pagadas): en el mes
  // nuevo cada salón vuelve a deber la suya.
  const casona = { salon: "Casona", porcentaje: 33 }
  const quinta = { salon: "Quinta", porcentaje: 34 }
  const salon = { salon: "Salon", porcentaje: 33 }
  let gasto = pagar(repartido(), { mes: "2026-10", montoGeneral: 800000, pagado: true, parte: casona })
  assert.deepEqual(gasto.distribucion.map((d) => [d.salon, d.pagado]), [["Quinta", false], ["Casona", true], ["Salon", false]])
  assert.equal(gasto.historialMontos[0].pagado, false)
  assert.equal(gasto.pagado, false)
  assert.equal(pago.pagoDelMesActual(gasto, casona, "2026-10").pagado, true)
  assert.equal(pago.pagoDelMesActual(gasto, quinta, "2026-10").pagado, false)
  assert.equal(pago.pagoDelMesActual(gasto, salon, "2026-10").pagado, false)

  // Cuando pagan los tres, el mes queda pagado para todos.
  gasto = pagar(gasto, { mes: "2026-10", montoGeneral: 800000, pagado: true, parte: quinta })
  assert.equal(gasto.historialMontos[0].pagado, false)
  gasto = pagar(gasto, { mes: "2026-10", montoGeneral: 800000, pagado: true, parte: salon })
  assert.equal(gasto.historialMontos[0].pagado, true)
  assert.equal(gasto.pagado, true)
  assert.equal(pago.pagoDelMesActual(gasto, undefined, "2026-10").pagado, true)

  // Deshacer desde Quinta vuelve a dejar el mes pendiente solo para Quinta.
  gasto = pagar(gasto, { mes: "2026-10", montoGeneral: 800000, pagado: false, parte: quinta })
  assert.equal(pago.pagoDelMesActual(gasto, quinta, "2026-10").pagado, false)
  assert.equal(pago.pagoDelMesActual(gasto, casona, "2026-10").pagado, true)
  assert.equal(gasto.historialMontos[0].pagado, false)
})

test("repartido en Todos los salones: el pago marca todas las partes", () => {
  const gasto = pagar(repartido(), { mes: "2026-10", montoGeneral: 800000, pagado: true })
  assert.deepEqual(gasto.distribucion.map((d) => d.pagado), [true, true, true])
  assert.equal(gasto.historialMontos[0].pagado, true)
  assert.equal(pago.deudaDelPeriodo(gasto, "2026-10").monto, 0)
})

test("repartido: un mes que no es el vigente se paga desde un salón aunque otro deba el mes actual", () => {
  // Octubre es el vigente y Quinta todavía no lo pagó; septiembre quedó adeudado.
  const gasto = repartido({
    historialMontos: [
      { id: "sep", mes: "2026-09", monto: 800000, montoAnterior: 800000, fecha: FECHA, pagado: false },
      { id: "oct", mes: "2026-10", monto: 800000, montoAnterior: 800000, fecha: FECHA, pagado: false },
    ],
    distribucion: [
      { salon: "Quinta", porcentaje: 34, pagado: false },
      { salon: "Casona", porcentaje: 33, pagado: true },
      { salon: "Salon", porcentaje: 33, pagado: true },
    ],
  })
  const cambios = pago.cambiosPagoDelMes(gasto, {
    mes: "2026-09",
    montoGeneral: 800000,
    pagado: true,
    parte: { salon: "Casona", porcentaje: 33 },
    fechaISO: FECHA,
    nuevoId: "x",
  })
  assert.equal(cambios.historialMontos.find((r) => r.mes === "2026-09").pagado, true)
  assert.equal(cambios.historialMontos.find((r) => r.mes === "2026-10").pagado, false)
  assert.equal("distribucion" in cambios, false)
})

test("Caja Jazmines: un fijo con septiembre pagado y sin octubre aparece en vencimientos y suma a 30 días", () => {
  const data = caja([fijo()], "Casona")
  assert.equal(data.alertasVencimiento.length, 1)
  assert.equal(data.alertasVencimiento[0].monto, 650000)
  assert.equal(data.alertasVencimiento[0].fechaVencimiento, "2026-10-10")
  assert.equal(data.alertasVencimiento[0].estado, "vencido")
  assert.equal(data.gastosPróximos30Dias, 650000)
  assert.equal(data.gastosFijosMes[0].estado, "vencido")

  // Pagado octubre (lo mismo que hace el ✓ de la alerta): sale de la alerta y de los 30 días.
  const pagado = pagar(fijo(), { mes: "2026-10", montoGeneral: 650000, pagado: true })
  const despues = caja([pagado], "Casona")
  assert.equal(despues.alertasVencimiento.length, 0)
  assert.equal(despues.gastosPróximos30Dias, 0)
  assert.equal(despues.gastosFijosMes[0].estado, "pagado")

  // Deshacer (la tira de meses) lo vuelve a mostrar.
  const deshecho = pagar(pagado, { mes: "2026-10", montoGeneral: 650000, pagado: false })
  assert.equal(caja([deshecho], "Casona").gastosPróximos30Dias, 650000)
})

test("Caja Jazmines: el campo pagado del gasto ya no decide nada", () => {
  // pagado:false pero octubre pagado en el historial → pagado.
  const conOctubre = fijo({
    pagado: false,
    historialMontos: [{ id: "oct", mes: "2026-10", monto: 650000, montoAnterior: 650000, fecha: FECHA, pagado: true }],
  })
  assert.equal(caja([conOctubre]).alertasVencimiento.length, 0)
  // Un gasto recién dado de alta en octubre (registro con pagado:false) se debe.
  const alta = fijo({
    pagado: false,
    historialMontos: [{ id: "alta", mes: "2026-10", monto: 650000, montoAnterior: 650000, fecha: FECHA, nota: "Alta del gasto", pagado: false }],
  })
  assert.equal(caja([alta]).gastosPróximos30Dias, 650000)
})

test("Caja Jazmines: repartido pagado desde Casona sigue pendiente para Quinta y en Todos", () => {
  const gasto = pagar(repartido(), { mes: "2026-10", montoGeneral: 800000, pagado: true, parte: { salon: "Casona", porcentaje: 33 } })
  assert.equal(caja([gasto], "Casona").alertasVencimiento.length, 0)
  const quinta = caja([gasto], "Quinta")
  assert.equal(quinta.alertasVencimiento.length, 1)
  assert.equal(quinta.alertasVencimiento[0].monto, 272000)
  assert.equal(quinta.gastosPróximos30Dias, 272000)
  // En Todos los salones se debe lo de Quinta y Salón, también en la lista de
  // fijos (de ahí sale "Gastos esta semana").
  const todos = caja([gasto], "todos")
  assert.equal(todos.gastosPróximos30Dias, 272000 + 264000)
  assert.equal(todos.gastosFijosMes[0].monto, 800000)
  assert.equal(todos.gastosFijosMes[0].montoPendiente, 272000 + 264000)
})

test("Caja Jazmines: el mes sale del reloj en hora argentina, no del día UTC", () => {
  // 31/10 a las 23:30 de Argentina ya es 1/11 en UTC: sigue siendo octubre.
  const conOctubre = fijo({
    historialMontos: [{ id: "oct", mes: "2026-10", monto: 650000, montoAnterior: 650000, fecha: FECHA, pagado: true }],
  })
  const data = useCajaJazmines(
    { costosOperativos: [conOctubre], movimientosCaja: [], eventos: [], gastosArchivados: [], vendedores: [] },
    "todos",
    new Date("2026-10-31T23:30:00-03:00"),
  )
  assert.equal(data.alertasVencimiento.length, 0)
})

test("Caja Jazmines: los sueldos de vendedores llegan marcados para no mostrar el ✓", () => {
  const data = caja([], "todos", {
    vendedores: [{ id: "v1", nombre: "PRUEBA", sueldo: 300000, sueldoFechaPago: "2026-09-20" }],
  })
  assert.equal(data.alertasVencimiento.length, 1)
  assert.equal(data.alertasVencimiento[0].esSueldoVendedor, true)
  assert.equal(data.gastosPróximos30Dias, 300000)
})

test("descripcionPagoFijo: dice qué se paga según el salón elegido", () => {
  // formatCurrency separa el $ del número con un espacio duro.
  const texto = (...args) => pago.descripcionPagoFijo(...args).replace(/ /g, " ")
  const sinPagar = repartido()
  const casona = { salon: "Casona", porcentaje: 33 }
  assert.equal(
    texto("ADMINISTRACION", pago.deudaDelPeriodo(sinPagar, "2026-10", casona), casona),
    'Se registra el pago de octubre de 2026 de "ADMINISTRACION", solo la parte de Casona (33%, $ 264.000).',
  )
  assert.equal(
    texto("ADMINISTRACION", pago.deudaDelPeriodo(sinPagar, "2026-10")),
    'Se pagan las partes de Quinta, Casona y Salón de "ADMINISTRACION" de octubre de 2026 ($ 800.000).',
  )
  const soloQuinta = repartido({ distribucion: [{ salon: "Quinta", porcentaje: 100, pagado: true }] })
  assert.match(texto("X", pago.deudaDelPeriodo(soloQuinta, "2026-10")), /^Se paga la parte de Quinta de "X"/)
  assert.equal(
    texto("ALQUILER", pago.deudaDelPeriodo(fijo(), "2026-10")),
    'Se registra el pago de octubre de 2026 de "ALQUILER" ($ 650.000).',
  )
})

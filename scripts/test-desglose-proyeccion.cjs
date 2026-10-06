// Desglose de la "Proyección en 12 meses" de Caja Eventos (lib/desglose-proyeccion.ts).
// Correr: node --test scripts/test-desglose-proyeccion.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith("@/") ? path.join(__dirname, "..", request.slice(2)) : request, ...args)
}
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (mod, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
  mod._compile(result.outputText, filename)
}
const { calcularCajaEventos } = require("../lib/hooks/use-caja-eventos.ts")
const { calcularProporcionCajaEventos } = require("../lib/cobrar-cuota.ts")
const { pagarServicioComoSueldo } = require("../lib/servicio-sueldo.ts")
const { desglosarProyeccion } = require("../lib/desglose-proyeccion.ts")

const hoy = new Date("2026-10-06T12:00:00")
const fechaISO = (dia) => new Date(`${dia}T12:00:00`).toISOString()
const DJ = { id: "dj", nombre: "DJ, SONIDO, LUCES Y HUMO", categoria: "Otros", unidad: "Fijo", activo: true, margenGanancia: 0, precioVenta: 900000, costoParaCajaEventos: 600000, porcentajeSeña: 30, diasAnticipacionSeña: 30, diasAnticipacionSaldo: 7, sePagaComoSueldo: true }
const FOTO = { id: "foto", nombre: "FOTOGRAFIA", categoria: "Otros", unidad: "Fijo", activo: true, margenGanancia: 0, precioVenta: 500000, costoParaCajaEventos: 300000, porcentajeSeña: 30, diasAnticipacionSeña: 30, diasAnticipacionSaldo: 7 }
const srvEv = (cat, patch = {}) => ({ servicioId: cat.id, nombre: cat.nombre, cantidad: 1, unidad: "Fijo", ...patch })
const base = { adultos: 0, adolescentes: 0, ninos: 0, personasDietasEspeciales: 0, recetasAdultos: [], recetasAdolescentes: [], recetasNinos: [], recetasDietasEspeciales: [], barras: [], personalEvento: [], costoOperativo: 0 }

// Evento A (Quinta, 12/12/2026): 3 cuotas de $1.000.000.
// Cuota 1 (vence oct) cobrada; cuota 2 (vence nov) con $400.000 acreditados; cuota 3 (vence dic) sin cobrar.
// Seña de FOTOGRAFIA pagada; DJ (se paga como sueldo) pagado sin movimiento en la caja.
const djPagado = pagarServicioComoSueldo(srvEv(DJ), 600000, "2026-12-12")
const eventoA = {
  ...base, id: "A", nombre: "Boda Pérez", nombrePareja: "Ana y Beto", salon: "Quinta", fecha: "2026-12-12", estado: "pendiente",
  contrato: { nombreCompleto: "Ana Pérez" },
  servicios: [srvEv(FOTO, { estadoPago: "señado", montoSeña: 90000, fechaPagoSeña: "2026-10-02" }), djPagado],
  planDeCuotas: { montoTotal: 3000000, numeroCuotas: 3, cuotasPagadas: [1], cuotas: [
    { numero: 1, montoCuota: 1000000, fechaVencimiento: "2026-10-10", pagada: true, montoPagadoNeto: 1000000 },
    { numero: 2, montoCuota: 1000000, fechaVencimiento: "2026-11-10", montoPagadoNeto: 400000 },
    { numero: 3, montoCuota: 1000000, fechaVencimiento: "2026-12-10" },
  ] },
}
// Evento B (Casona) completado: no entra en la proyección ni en el desglose.
const eventoB = {
  ...base, id: "B", nombre: "XV Gómez", salon: "Casona", fecha: "2026-10-04", estado: "completado", servicios: [],
  planDeCuotas: { montoTotal: 1000000, numeroCuotas: 1, cuotasPagadas: [1], cuotas: [{ numero: 1, montoCuota: 1000000, fechaVencimiento: "2026-10-01", pagada: true, montoPagadoNeto: 1000000 }] },
}
// Evento C (Casona): cuota de octubre marcada cobrada pero sin movimiento en la caja.
const eventoC = {
  ...base, id: "C", nombre: "Cumple López", salon: "Casona", fecha: "2027-01-20", estado: "pendiente", servicios: [], costoOperativo: 200000,
  planDeCuotas: { montoTotal: 1000000, numeroCuotas: 2, cuotasPagadas: [1], cuotas: [
    { numero: 1, montoCuota: 500000, fechaVencimiento: "2026-10-20", pagada: true },
    { numero: 2, montoCuota: 500000, fechaVencimiento: "2026-12-20" },
  ] },
}
const movimientos = [
  { id: "m1", fecha: fechaISO("2026-10-03"), tipo: "ingreso", concepto: "Cuota 1 - Ana y Beto (Caja Eventos)", monto: 250000, salon: "Quinta", eventoId: "A", cajaDestino: "caja_eventos", saldoResultante: 0 },
  { id: "m2", fecha: fechaISO("2026-10-03"), tipo: "ingreso", concepto: "Cuota 1 - Ana y Beto (Caja Jazmines)", monto: 750000, salon: "Quinta", eventoId: "A", cajaDestino: "caja_jazmines", saldoResultante: 0 },
  { id: "m3", fecha: fechaISO("2026-10-05"), tipo: "ingreso", concepto: "Cuota 2/3 (pago parcial) - Ana y Beto (Caja Eventos)", monto: 100000, salon: "Quinta", eventoId: "A", cajaDestino: "caja_eventos", saldoResultante: 0 },
  { id: "m4", fecha: fechaISO("2026-10-05"), tipo: "ingreso", concepto: "Cuota 2/3 (pago parcial) - Ana y Beto (Caja Jazmines)", monto: 300000, salon: "Quinta", eventoId: "A", cajaDestino: "caja_jazmines", saldoResultante: 0 },
  // La seña se pagó antes de un aumento: el pago real es $85.000.
  { id: "m5", fecha: fechaISO("2026-10-02"), tipo: "egreso", concepto: "Pago seña FOTOGRAFIA - Ana y Beto", monto: 85000, salon: "Quinta", eventoId: "A", cajaDestino: "caja_eventos", saldoResultante: 0 },
  { id: "m6", fecha: fechaISO("2026-10-01"), tipo: "ingreso", concepto: "Cuota 1 - XV Gómez (Caja Eventos)", monto: 300000, salon: "Casona", eventoId: "B", cajaDestino: "caja_eventos", saldoResultante: 0 },
]
const state = (patch = {}) => ({ eventos: [eventoA, eventoB, eventoC], movimientosCaja: movimientos, pagosPersonal: [], personal: [], servicios: [DJ, FOTO], recetas: [], insumos: [], insumosBarra: [], cocteles: [], ...patch })

function desglose(st, salonFiltro) {
  const pendientes = calcularCajaEventos(st, salonFiltro, hoy)
  const completas = calcularCajaEventos(st, salonFiltro, hoy, true)
  const meses = pendientes.proyeccionMensual.map((m) => m.key)
  const porMes = desglosarProyeccion({
    eventos: st.eventos, movimientos: st.movimientosCaja, salonFiltro,
    datosCostos: { insumos: st.insumos, insumosBarra: st.insumosBarra, recetas: st.recetas, cocteles: st.cocteles, servicios: st.servicios },
    ingresosPendientes: pendientes.ingresosPendientes, egresosPendientes: pendientes.egresosPendientes,
    egresosCompletos: completas.egresosPendientes,
  }, meses)
  return { porMes, proyeccion: pendientes.proyeccionMensual }
}

test("lo que falta es exactamente el número de la proyección, mes por mes (todos y por salón)", () => {
  for (const salon of [undefined, "todos", "Quinta", "Casona"]) {
    const { porMes, proyeccion } = desglose(state(), salon)
    assert.equal(proyeccion.length, 12)
    for (const m of proyeccion) {
      assert.equal(porMes[m.key].cobrar.falta, m.aCobrar, `A cobrar ${m.key} (${salon})`)
      assert.equal(porMes[m.key].pagar.falta, m.aPagar, `A pagar ${m.key} (${salon})`)
    }
  }
})

test("octubre: lo cobrado sale del movimiento real de Caja Eventos y la cuota sin movimiento se estima y se marca", () => {
  const oct = desglose(state()).porMes["2026-10"].cobrar
  assert.equal(oct.falta, 0)
  const a = oct.cobrados.find((c) => c.eventoId === "A")
  assert.deepEqual(
    { monto: a.monto, cliente: a.cliente, cuota: `${a.numeroCuota}/${a.totalCuotas}`, fecha: a.fechaCobro, sinMov: a.sinMovimiento },
    { monto: 250000, cliente: "Ana Pérez", cuota: "1/3", fecha: "2026-10-03", sinMov: false },
  )
  // C: $500.000 × proporción de C (costo $200.000 + 5 % sobre $1.000.000 = 21 %)
  const c = oct.cobrados.find((x) => x.eventoId === "C")
  assert.equal(calcularProporcionCajaEventos(eventoC), 0.21)
  assert.deepEqual({ monto: c.monto, sinMov: c.sinMovimiento, fecha: c.fechaCobro }, { monto: 105000, sinMov: true, fecha: undefined })
  // B está completado: ni su cuota ni su movimiento cuentan
  assert.equal(oct.cobrados.some((x) => x.eventoId === "B"), false)
  assert.equal(oct.yaIngreso, 355000)
  assert.equal(oct.debiaIngresar, 355000)
})

test("noviembre: cuota con pago parcial aparece en lo que ya entró y en lo que falta", () => {
  const { porMes, proyeccion } = desglose(state())
  const nov = porMes["2026-11"].cobrar
  assert.deepEqual(nov.cobrados.map((c) => [c.eventoId, c.numeroCuota, c.monto, c.sinMovimiento]), [["A", 2, 100000, false]])
  assert.deepEqual(nov.pendientes.map((p) => [p.eventoId, p.numeroCuota, p.parcial, p.vencida, p.cliente]), [["A", 2, true, false, "Ana Pérez"]])
  const prop = calcularProporcionCajaEventos(eventoA, { insumos: [], insumosBarra: [], recetas: [], cocteles: [], servicios: [DJ, FOTO] })
  assert.equal(nov.falta, 600000 * prop)
  assert.equal(nov.falta, proyeccion.find((m) => m.key === "2026-11").aCobrar)
  assert.equal(nov.debiaIngresar, Math.round((100000 + 600000 * prop) * 100) / 100)
})

test("a pagar: seña pagada con el monto real del movimiento; DJ pagado sin movimiento se marca; saldo pendiente en falta", () => {
  const { porMes } = desglose(state())
  const nov = porMes["2026-11"].pagar
  assert.deepEqual(nov.pagados.map((p) => [p.tipo, p.servicioNombre, p.monto, p.sinMovimiento, p.fechaPago]), [["seña", "FOTOGRAFIA", 85000, false, "2026-10-02"]])
  assert.deepEqual(nov.pendientes, [])
  assert.equal(nov.yaPagado, 85000)
  assert.equal(nov.totalAPagar, 85000)

  const dic = porMes["2026-12"].pagar
  assert.deepEqual(dic.pendientes.map((p) => [p.tipo, p.servicioNombre, p.monto, p.vencido]), [["saldo", "FOTOGRAFIA", 210000, false]])
  assert.deepEqual(dic.pagados.map((p) => [p.tipo, p.monto, p.sinMovimiento]), [["sueldo", 600000, true]])
  assert.equal(dic.totalAPagar, 810000)
})

test("con el movimiento del sueldo, el DJ pasa a mostrar lo que se pagó de verdad", () => {
  const conMovimiento = [...movimientos, { id: "m7", fecha: fechaISO("2026-10-04"), tipo: "egreso", concepto: "Pago sueldo DJ, SONIDO, LUCES Y HUMO - Ana y Beto", monto: 580000, salon: "Quinta", eventoId: "A", cajaDestino: "caja_eventos", saldoResultante: 0 }]
  const dic = desglose(state({ movimientosCaja: conMovimiento })).porMes["2026-12"].pagar
  assert.deepEqual(dic.pagados.map((p) => [p.monto, p.sinMovimiento, p.fechaPago]), [[580000, false, "2026-10-04"]])
})

test("cada movimiento de pago se usa una sola vez", () => {
  const fotoSeñado = srvEv(FOTO, { estadoPago: "señado", montoSeña: 90000 })
  const ev = { ...eventoA, servicios: [fotoSeñado, { ...fotoSeñado }] }
  const nov = desglose(state({ eventos: [ev] })).porMes["2026-11"].pagar
  assert.deepEqual(nov.pagados.map((p) => [p.monto, p.sinMovimiento]), [[85000, false], [90000, true]])
})

test("filtro de salón: Casona no muestra nada de Quinta", () => {
  const { porMes } = desglose(state(), "Casona")
  for (const mes of Object.values(porMes)) {
    for (const linea of [...mes.cobrar.pendientes, ...mes.cobrar.cobrados, ...mes.pagar.pendientes, ...mes.pagar.pagados]) {
      assert.notEqual(linea.eventoId, "A")
    }
  }
  assert.deepEqual(porMes["2026-10"].cobrar.cobrados.map((c) => c.eventoId), ["C"])
})

test("solo lectura: no modifica nada de lo que recibe", () => {
  const congelar = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(congelar) } return o }
  const st = state()
  const pendientes = calcularCajaEventos(st, undefined, hoy)
  const completas = calcularCajaEventos(st, undefined, hoy, true)
  const entrada = congelar({
    eventos: structuredClone(st.eventos), movimientos: structuredClone(st.movimientosCaja), salonFiltro: undefined,
    datosCostos: { insumos: [], insumosBarra: [], recetas: [], cocteles: [], servicios: structuredClone(st.servicios) },
    ingresosPendientes: structuredClone(pendientes.ingresosPendientes), egresosPendientes: structuredClone(pendientes.egresosPendientes),
    egresosCompletos: structuredClone(completas.egresosPendientes),
  })
  assert.doesNotThrow(() => desglosarProyeccion(entrada, pendientes.proyeccionMensual.map((m) => m.key)))
})

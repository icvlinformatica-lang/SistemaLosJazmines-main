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
const { calcularResumenMensual, cambiarMes, vencimientoMensual } = require("../lib/resumen-mensual.ts")
const { calcularCajaEventos } = require("../lib/hooks/use-caja-eventos.ts")
const { setSalonNombresCustom, salonLabel } = require("../lib/store.ts")
const hoy = new Date("2026-09-08T12:00:00")
const ev = (patch = {}) => ({ id: "evento", nombre: "Evento", salon: "Quinta", fecha: "2026-09-20", estado: "pendiente", adultos: 0, adolescentes: 0, ninos: 0, personasDietasEspeciales: 0, recetasAdultos: [], recetasAdolescentes: [], recetasNinos: [], recetasDietasEspeciales: [], barras: [], servicios: [], personalEvento: [], costoOperativo: 100, planDeCuotas: { montoTotal: 1000, cuotasPagadas: [], cuotas: [{ numero: 1, montoCuota: 500, fechaVencimiento: "2026-09-10" }] }, ...patch })
const state = (patch = {}) => ({ eventos: [], movimientosCaja: [], gastosArchivados: [], costosOperativos: [], vendedores: [], personal: [], pagosPersonal: [], servicios: [], recetas: [], insumos: [], insumosBarra: [], cocteles: [], ...patch })
const calc = (patch, mes = "2026-09") => calcularResumenMensual(state(patch), mes, hoy)
const mov = (patch = {}) => ({ id: "mov", eventoId: "evento", tipo: "ingreso", concepto: "Cuota 1 - Evento (Caja Eventos)", fecha: "2026-09-10T12:00:00Z", cajaDestino: "caja_eventos", salon: "Quinta", monto: 500, ...patch })
const costo = (patch = {}) => ({ id: "luz", concepto: "Luz", frecuencia: "Mensual", activo: true, monto: 100, fechaVencimiento: "2026-09-10", ...patch })

test("cuotas pendientes usan reparto único y conservan centavos", () => {
  const r = calc({ eventos: [ev()] })
  assert.equal(r.totales.caja_eventos.cuotasPrevistas, 52.5)
  assert.equal(r.totales.caja_jazmines.cuotasPrevistas, 447.5)
  assert.equal(r.totales.caja_eventos.cuotasPendientes, 52.5)
})
test("cobrado por fecha de registro, previsto por vencimiento y reparto histórico", () => {
  const evento = ev(); evento.planDeCuotas.cuotasPagadas = [1]
  const r = calc({ eventos: [evento], movimientosCaja: [mov({ fecha: "2026-08-30", monto: 200 }), mov({ id: "j", monto: 300, cajaDestino: "caja_jazmines", fecha: "2026-08-30" })] })
  assert.equal(r.totales.caja_eventos.cuotasPrevistas, 200)
  assert.equal(r.totales.caja_eventos.cuotasCobradas, 0)
  assert.equal(r.totales.caja_eventos.cuotasPendientes, 0)
})
test("flag pagada sin movimiento no fabrica cobros", () => {
  const evento = ev(); evento.planDeCuotas.cuotas[0].pagada = true
  const r = calc({ eventos: [evento] })
  assert.equal(r.totales.caja_eventos.cuotasPendientes, 0)
  assert.equal(r.totales.caja_eventos.cuotasCobradas, 0)
  assert.ok(r.advertencias.length)
})
test("señas y transferencias no son cuotas", () => {
  const r = calc({ eventos: [ev()], movimientosCaja: [mov({ concepto: "Seña - Evento" }), mov({ id: "t", concepto: "Transferencia" })] })
  assert.equal(r.totales.caja_eventos.cuotasCobradas, 0)
})
test("excluye eliminados y conserva cobros de completados/cancelados", () => {
  for (const estado of ["completado", "cancelado"]) {
    const r = calc({ eventos: [ev({ estado })], movimientosCaja: [mov()] })
    assert.equal(r.totales.caja_eventos.cuotasCobradas, 500)
    assert.equal(r.totales.caja_eventos.cuotasPendientes, 0)
  }
  const r = calc({ eventos: [ev({ deleted_at: "2026-09-01" })], movimientosCaja: [mov()] })
  assert.equal(r.totales.caja_eventos.cuotasCobradas, 0)
})
test("comisión pagada y archivada se cuenta una vez solo en Jazmines", () => {
  const r = calc({ eventos: [ev({ contrato: { vendedor: "Ana", comisionOculta: true }, comisionPagada: true, comisionPagadaFecha: "2026-09-08" })], vendedores: [{ id: "ana", nombre: "Ana", sueldo: 0 }], gastosArchivados: [{ id: "a", refId: "comision-ana-evento", fecha: "2026-09-20", monto: 50, salon: "Quinta", origen: "caja_jazmines_comision" }] })
  assert.equal(r.totales.caja_jazmines.egresosPrevistos, 50)
  assert.equal(r.totales.caja_jazmines.pagosRegistrados, 50)
  assert.equal(r.totales.caja_jazmines.egresosPendientes, 0)
  assert.equal(r.totales.caja_eventos.pagosRegistrados, 0)
})
test("comisión pagada anticipada aparece en mes de pago", () => {
  const r = calc({ eventos: [ev({ fecha: "2026-10-20", contrato: { vendedor: "Ana" }, comisionPagada: true, comisionPagadaFecha: "2026-09-08" })], vendedores: [{ id: "ana", nombre: "Ana", sueldo: 0 }] })
  assert.equal(r.totales.caja_jazmines.egresosPrevistos, 0)
  assert.equal(r.totales.caja_jazmines.pagosRegistrados, 50)
})
test("archivo manual variable sin confirmación no fabrica pago", () => {
  const r = calc({ gastosArchivados: [{ id: "a", refId: "viejo", fecha: "2026-09-01", monto: 100, origen: "caja_jazmines_variable" }] })
  assert.equal(r.totales.caja_jazmines.pagosRegistrados, 0)
  assert.equal(r.totales.caja_jazmines.egresosSinConfirmar, 100)
})
test("movimiento más archivo de ese movimiento no duplica", () => {
  const r = calc({ movimientosCaja: [mov({ eventoId: undefined, tipo: "egreso", concepto: "Gasto" })], gastosArchivados: [{ id: "a", refId: "mov", fecha: "2026-09-10", monto: 500, origen: "caja_eventos" }] })
  assert.equal(r.totales.caja_eventos.pagosRegistrados, 500)
  assert.equal(r.totales.caja_eventos.egresosPrevistos, 500)
})
test("gasto compartido parcialmente pagado conserva reparto y saldo pendiente", () => {
  const r = calc({ costosOperativos: [costo({ monto: 100.01, distribucion: [{ salon: "Quinta", porcentaje: 50, pagado: true }, { salon: "Casona", porcentaje: 50 }] })] })
  assert.equal(r.totales.caja_jazmines.egresosPrevistos, 100.01)
  assert.equal(r.cajas.caja_jazmines.Quinta.egresosPendientes, 0)
  assert.equal(r.cajas.caja_jazmines.Casona.egresosPendientes, 50)
  assert.equal(r.totales.caja_jazmines.pagosRegistrados, 0)
})
test("archivo fijo general no aplica reparto actual al pasado ni duplica historial", () => {
  const r = calc({ costosOperativos: [costo({ distribucion: [{ salon: "Quinta", porcentaje: 100 }], historialMontos: [{ id: "h", mes: "2026-08", monto: 80, pagado: true, fecha: "2026-08-10" }] })], gastosArchivados: [{ id: "a", refId: "luz", fecha: "2026-08-10", monto: 80, origen: "caja_jazmines_fijo" }] }, "2026-08")
  assert.equal(r.cajas.caja_jazmines.general.egresosPrevistos, 80)
  assert.equal(r.totales.caja_jazmines.pagosRegistrados, 80)
})
test("fijos antiguos sin historial no se inventan y pagado actual no afecta futuro", () => {
  const input = { costosOperativos: [costo({ pagado: true })] }
  assert.equal(calc(input, "2026-08").totales.caja_jazmines.egresosPrevistos, 0)
  assert.equal(calc(input, "2026-10").totales.caja_jazmines.egresosPendientes, 100)
})
test("historial sin flag de pago es incierto y no cobrado", () => {
  const r = calc({ costosOperativos: [costo({ historialMontos: [{ mes: "2026-08", monto: 80, fecha: "2026-08-10" }] })] }, "2026-08")
  assert.equal(r.totales.caja_jazmines.egresosSinConfirmar, 80)
  assert.equal(r.totales.caja_jazmines.pagosRegistrados, 0)
})
test("vencimientos anuales y fin de mes respetan calendario", () => {
  assert.equal(cambiarMes("2026-12", 1), "2027-01")
  assert.equal(cambiarMes("2026-01", -1), "2025-12")
  assert.equal(vencimientoMensual("2026-01-31", "2026-02"), "2026-02-28")
  assert.equal(calc({ costosOperativos: [costo({ frecuencia: "Anual" })] }, "2026-10").totales.caja_jazmines.egresosPrevistos, 0)
})
test("servicio totalmente pagado conserva presupuesto y concilia seña y saldo", () => {
  const evento = ev({ servicios: [{ servicioId: "dj", nombre: "DJ", cantidad: 1, estadoPago: "pagado_total", montoSeña: 30 }] })
  const servicios = [{ id: "dj", costoParaCajaEventos: 100, porcentajeSeña: 30, diasAnticipacionSeña: 10, diasAnticipacionSaldo: 5 }]
  const movimientosCaja = [mov({ tipo: "egreso", concepto: "Pago seña DJ - Evento", monto: 30 }), mov({ id: "saldo", tipo: "egreso", concepto: "Pago saldo DJ - Evento", monto: 70 })]
  const r = calc({ eventos: [evento], servicios, movimientosCaja })
  assert.equal(r.totales.caja_eventos.egresosPrevistos, 100)
  assert.equal(r.totales.caja_eventos.pagosRegistrados, 100)
  assert.equal(r.totales.caja_eventos.egresosPendientes, 0)
  assert.equal(calcularCajaEventos(state({ eventos: [evento], servicios }), undefined, hoy).egresosPendientes.length, 0)
})
test("columnas suman total por caja y nombres personalizados no cambian IDs", () => {
  const r = calc({ costosOperativos: [costo(), costo({ id: "alquiler", salon: "Quinta" })], eventos: [ev()] })
  for (const [caja, total] of Object.entries(r.totales)) for (const metrica of Object.keys(total)) assert.equal(Math.round(Object.values(r.cajas[caja]).reduce((s, c) => s + c[metrica], 0) * 100), Math.round(total[metrica] * 100))
  setSalonNombresCustom({ salones: { Quinta: { nombre: "Mi Quinta" } } })
  assert.equal(salonLabel("Quinta"), "Mi Quinta")
  assert.ok(r.salones.includes("Quinta"))
})
test("historial de agosto pagado en septiembre conserva ambos períodos", () => {
  const input = { costosOperativos: [costo({ historialMontos: [{ id: "h", mes: "2026-08", fecha: "2026-09-03", monto: 80, pagado: true }] })] }
  const agosto = calc(input, "2026-08")
  const septiembre = calc(input)
  assert.equal(agosto.totales.caja_jazmines.egresosPrevistos, 80)
  assert.equal(agosto.totales.caja_jazmines.pagosRegistrados, 0)
  assert.equal(septiembre.totales.caja_jazmines.pagosRegistrados, 80)
  assert.equal(septiembre.totales.caja_jazmines.egresosPrevistos, 100)
})
test("comisión con movimiento más archivo de entidad no se duplica", () => {
  const r = calc({ eventos: [ev({ contrato: { vendedor: "Ana" }, comisionPagada: true })], vendedores: [{ id: "ana", nombre: "Ana" }], movimientosCaja: [mov({ tipo: "egreso", cajaDestino: "caja_jazmines", concepto: "Pago comisión Ana", monto: 50 })], gastosArchivados: [{ id: "archivo", refId: "comision-ana-evento", origen: "caja_jazmines_comision", fecha: "2026-09-20", monto: 50 }] })
  assert.equal(r.totales.caja_jazmines.egresosPrevistos, 50)
  assert.equal(r.totales.caja_jazmines.pagosRegistrados, 50)
})
test("anticipo de personal en otro mes no infla el saldo del mes del evento", () => {
  const input = { eventos: [ev()], pagosPersonal: [{ id: "p", eventoId: "evento", montoTotal: 100, montoSeña: 30, fechaSeña: "2026-08-10", fechaLimitePago: "2026-09-20", estado: "pendiente", nombrePersonal: "Ana", servicioNombre: "Mozo" }] }
  assert.equal(calc(input).totales.caja_eventos.egresosPrevistos, 70)
  assert.equal(calc(input).totales.caja_eventos.egresosPendientes, 70)
  assert.equal(calc(input, "2026-08").totales.caja_eventos.pagosRegistrados, 30)
  assert.equal(calc(input, "2026-08").totales.caja_eventos.egresosPrevistos, 30)
})
test("pago parcial de gasto operativo reduce pendiente sin reducir presupuesto", () => {
  const r = calc({ costosOperativos: [costo({ salon: "Quinta" })], movimientosCaja: [mov({ eventoId: undefined, costoOperativoId: "luz", tipo: "egreso", cajaDestino: "caja_jazmines", monto: 30 })] })
  assert.equal(r.totales.caja_jazmines.egresosPrevistos, 100)
  assert.equal(r.totales.caja_jazmines.egresosPendientes, 70)
  assert.equal(r.totales.caja_jazmines.pagosRegistrados, 30)
})
test("consultas estrictas del mensual rechazan errores sin vaciar colecciones", async () => {
  const load = Module._load
  Module._load = function (request, ...args) {
    if (request === "./client") return { createClient: () => ({ from: () => ({
      select() { return this }, order() { return this }, range() { return this },
      abortSignal() { return Promise.resolve({ data: null, count: null, error: new Error("sin conexión") }) },
    }) }) }
    return load.call(this, request, ...args)
  }
  let db
  try { db = require("../lib/supabase/data-service.ts") } finally { Module._load = load }
  for (const fn of [db.fetchCostosOperativos, db.fetchGastosArchivados, db.fetchVendedores, db.fetchPersonal]) await assert.rejects(fn(true), /sin conexión/)
})

test("panel mensual renderiza selector, columnas y ambas cajas sin proveedores externos", () => {
  const React = require("react")
  const { renderToStaticMarkup } = require("react-dom/server")
  const load = Module._load
  Module._load = function (request, ...args) {
    if (request === "@/lib/store-context") return { useStore: () => ({ state: state({ eventos: [ev()] }) }) }
    if (request === "@/lib/clock-context") return { useClock: () => ({ ahora: hoy, soloLectura: false }) }
    if (request === "@/lib/hooks/use-sync-tiempo-real") return { useSyncTiempoReal: () => ({ ultimaSync: hoy, errorSync: false, sincronizando: false, refrescar: () => {} }) }
    return load.call(this, request, ...args)
  }
  let Panel
  try { Panel = require("../components/resumen-mensual.tsx").ResumenMensual } finally { Module._load = load }
  const html = renderToStaticMarkup(React.createElement(Panel))
  for (const text of ["Mes del resumen", "Caja Eventos", "Caja Jazmines", "Cuotas previstas", "Pagos registrados", "Mes anterior", "Mes siguiente", "Casona"]) assert.ok(html.includes(text), text)
  assert.match(html, /type="month"/)
  assert.match(html, /scope="row"/)
  assert.match(html, /scope="col"/)
})

test("mes vacío y consulta no mutan el estado", () => {
  const input = state()
  const antes = JSON.stringify(input)
  assert.equal(calcularResumenMensual(input, "2025-01", hoy).lineas.length, 0)
  assert.equal(JSON.stringify(input), antes)
})

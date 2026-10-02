// Servicio que se paga como sueldo (servicios.se_paga_como_sueldo).
// Correr: node --test scripts/test-servicio-sueldo.cjs
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
const { pagarServicioComoSueldo, revertirServicioPagadoComoSueldo, sePagaComoSueldo, montoSueldoServicio } = require("../lib/servicio-sueldo.ts")
const { calcularProporcionCajaEventos } = require("../lib/cobrar-cuota.ts")
const { congelarCostosEvento } = require("../lib/store.ts")
const { filtrarEgresos, FILTRO_EGRESOS_INICIAL } = require("../components/filtros-egresos.tsx")

const hoy = new Date("2026-10-01T12:00:00")
const DJ = { id: "dj", nombre: "DJ, SONIDO, LUCES Y HUMO", categoria: "Otros", unidad: "Fijo", activo: true, margenGanancia: 0, precioVenta: 900000, costoParaCajaEventos: 600000, porcentajeSeña: 30, diasAnticipacionSeña: 30, diasAnticipacionSaldo: 7, sePagaComoSueldo: true }
const FOTO = { id: "foto", nombre: "FOTOGRAFIA", categoria: "Otros", unidad: "Fijo", activo: true, margenGanancia: 0, precioVenta: 500000, costoParaCajaEventos: 300000, porcentajeSeña: 30, diasAnticipacionSeña: 30, diasAnticipacionSaldo: 7 }
const srvEv = (cat, patch = {}) => ({ servicioId: cat.id, nombre: cat.nombre, cantidad: 1, unidad: "Fijo", ...patch })
const ev = (patch = {}) => ({ id: "ev1", nombre: "Evento de prueba", salon: "Quinta", fecha: "2026-12-12", estado: "pendiente", adultos: 0, adolescentes: 0, ninos: 0, personasDietasEspeciales: 0, recetasAdultos: [], recetasAdolescentes: [], recetasNinos: [], recetasDietasEspeciales: [], barras: [], servicios: [srvEv(DJ), srvEv(FOTO)], personalEvento: [], costoOperativo: 0, planDeCuotas: { montoTotal: 3000000, cuotasPagadas: [], cuotas: [{ numero: 1, montoCuota: 1000000, fechaVencimiento: "2026-10-10" }] }, ...patch })
const state = (patch = {}) => ({ eventos: [ev()], movimientosCaja: [], pagosPersonal: [], personal: [], servicios: [DJ, FOTO], recetas: [], insumos: [], insumosBarra: [], cocteles: [], ...patch })
const caja = (st, incluirPagados = false) => calcularCajaEventos(st, undefined, hoy, incluirPagados)
const sinMarca = (cat) => ({ ...cat, sePagaComoSueldo: false })
const egresosDe = (st, servicioId) => caja(st).egresosPendientes.filter((e) => e.servicioId === servicioId)

test("DJ marcado: un solo egreso de sueldo el día del evento, por el costo en vivo, sin seña ni saldo", () => {
  const eg = egresosDe(state(), "dj")
  assert.equal(eg.length, 1)
  assert.deepEqual(
    { id: eg[0].id, tipo: eg[0].tipo, monto: eg[0].monto, fecha: eg[0].fechaVencimiento, nombre: eg[0].servicioNombre, persona: eg[0].persona },
    { id: "ev1-srvsueldo-dj", tipo: "sueldo", monto: 600000, fecha: "2026-12-12", nombre: "DJ, SONIDO, LUCES Y HUMO", persona: "DJ, SONIDO, LUCES Y HUMO" },
  )
})

test("el monto del sueldo es lo mismo que sumaban seña + saldo (con cantidad)", () => {
  const st = state({ eventos: [ev({ servicios: [srvEv(DJ, { cantidad: 2 }), srvEv(FOTO)] })] })
  const conMarca = egresosDe(st, "dj")
  const sinLaMarca = egresosDe({ ...st, servicios: [sinMarca(DJ), FOTO] }, "dj")
  assert.equal(conMarca[0].monto, 1200000)
  assert.equal(conMarca[0].monto, sinLaMarca.reduce((s, e) => s + e.monto, 0))
})

test("costo 0: no genera ningún egreso (igual que hoy)", () => {
  assert.equal(egresosDe(state({ servicios: [{ ...DJ, costoParaCajaEventos: 0 }, FOTO] }), "dj").length, 0)
})

test("marca apagada: el DJ se comporta exactamente como antes (seña y saldo)", () => {
  const eg = egresosDe(state({ servicios: [sinMarca(DJ), FOTO] }), "dj")
  assert.deepEqual(eg.map((e) => [e.tipo, e.monto, e.fechaVencimiento]), [["seña", 180000, "2026-11-12"], ["saldo", 420000, "2026-12-05"]])
  // y sin el campo nuevo (servicio viejo), idéntico
  const { sePagaComoSueldo: _x, ...djViejo } = DJ
  assert.deepEqual(egresosDe(state({ servicios: [djViejo, FOTO] }), "dj"), eg)
})

test("FOTOGRAFIA y todo lo demás: idénticos con y sin la marca del DJ", () => {
  const con = caja(state()).egresosPendientes.filter((e) => e.servicioId !== "dj")
  const sin = caja(state({ servicios: [sinMarca(DJ), FOTO] })).egresosPendientes.filter((e) => e.servicioId !== "dj")
  assert.deepEqual(con, sin)
  assert.deepEqual(con.filter((e) => e.servicioId === "foto").map((e) => [e.tipo, e.monto]), [["seña", 90000], ["saldo", 210000]])
})

test("pagar: sale de pendientes, aparece con incluirPagados por el monto pagado y revertir deja todo igual", () => {
  const original = state()
  const srvOriginal = original.eventos[0].servicios[0]
  const pagado = pagarServicioComoSueldo(srvOriginal, 600000, "2026-12-12")
  assert.equal(pagado.estadoPago, "pagado_total")
  assert.equal(pagado.pagado, true)
  assert.equal(pagado.pagoSueldo.monto, 600000)
  const stPagado = state({ eventos: [ev({ servicios: [pagado, srvEv(FOTO)] })] })
  assert.equal(egresosDe(stPagado, "dj").length, 0)
  // Aunque después suba el costo, el pagado conserva su monto histórico
  const conAumento = { ...stPagado, servicios: [{ ...DJ, costoParaCajaEventos: 999999 }, FOTO] }
  const completas = caja(conAumento, true).egresosPendientes.filter((e) => e.servicioId === "dj")
  assert.deepEqual(completas.map((e) => [e.tipo, e.monto, e.estadoPago]), [["sueldo", 600000, "pagado_total"]])
  // Revertir: el servicio queda exactamente como estaba (JSON, como se guarda)
  const revertido = revertirServicioPagadoComoSueldo(pagado)
  assert.deepEqual(JSON.parse(JSON.stringify(revertido)), JSON.parse(JSON.stringify(srvOriginal)))
  assert.deepEqual(egresosDe(state({ eventos: [ev({ servicios: [revertido, srvEv(FOTO)] })] }), "dj"), egresosDe(original, "dj"))
})

test("revertir un servicio que tenía datos previos los restaura todos", () => {
  const previo = srvEv(DJ, { estadoPago: "señado", montoSeña: 150000, fechaPagoSeña: "2026-11-01", saldoPendiente: 450000, pagado: false })
  const ida = revertirServicioPagadoComoSueldo(pagarServicioComoSueldo(previo, 450000, "2026-12-12"))
  assert.deepEqual(JSON.parse(JSON.stringify(ida)), JSON.parse(JSON.stringify(previo)))
})

test("seña ya pagada por el camino viejo: el sueldo es solo lo que falta", () => {
  const señado = srvEv(DJ, { estadoPago: "señado", montoSeña: 180000, fechaPagoSeña: "2026-11-01" })
  const eg = egresosDe(state({ eventos: [ev({ servicios: [señado, srvEv(FOTO)] })] }), "dj")
  assert.deepEqual(eg.map((e) => [e.tipo, e.monto]), [["sueldo", 420000]])
  // al pagarlo, la seña vieja se conserva como histórico
  assert.equal(pagarServicioComoSueldo(señado, 420000, "2026-12-12").montoSeña, 180000)
})

test("ya pagado completo por el camino viejo (saldo): no se convierte en sueldo", () => {
  const viejo = srvEv(DJ, { estadoPago: "pagado_total", pagado: true, montoSeña: 180000 })
  assert.equal(sePagaComoSueldo(viejo, [DJ]), false)
  assert.equal(egresosDe(state({ eventos: [ev({ servicios: [viejo, srvEv(FOTO)] })] }), "dj").length, 0)
})

test("pagado como sueldo y después se apaga la marca: sigue figurando como sueldo pagado (se puede revertir)", () => {
  const pagado = pagarServicioComoSueldo(srvEv(DJ), 600000, "2026-12-12")
  assert.equal(sePagaComoSueldo(pagado, [sinMarca(DJ)]), true)
  assert.equal(montoSueldoServicio(pagado, { servicios: [sinMarca(DJ)] }), 600000)
})

test("vencimiento editado a mano: el sueldo vence en esa fecha", () => {
  const eg = egresosDe(state({ eventos: [ev({ servicios: [srvEv(DJ, { fechaSueldoManual: "2026-12-20" }), srvEv(FOTO)] })] }), "dj")
  assert.equal(eg[0].fechaVencimiento, "2026-12-20")
  // y no toca el vencimiento del saldo si se apaga la marca
  const sinLaMarca = egresosDe(state({ servicios: [sinMarca(DJ), FOTO], eventos: [ev({ servicios: [srvEv(DJ, { fechaSueldoManual: "2026-12-20" }), srvEv(FOTO)] })] }), "dj")
  assert.deepEqual(sinLaMarca.map((e) => e.fechaVencimiento), ["2026-11-12", "2026-12-05"])
})

test("reparto entre cajas: idéntico con marca, sin marca y con el sueldo pagado", () => {
  const datos = (servicios) => ({ insumos: [], insumosBarra: [], recetas: [], cocteles: [], servicios })
  const base = calcularProporcionCajaEventos(ev(), datos([sinMarca(DJ), FOTO]))
  assert.equal(calcularProporcionCajaEventos(ev(), datos([DJ, FOTO])), base)
  const pagado = ev({ servicios: [pagarServicioComoSueldo(srvEv(DJ), 600000, "2026-12-12"), srvEv(FOTO)] })
  assert.equal(calcularProporcionCajaEventos(pagado, datos([DJ, FOTO])), base)
})

test("ingresos (cuotas por cobrar): idénticos con y sin la marca", () => {
  assert.deepEqual(caja(state()).ingresosPendientes, caja(state({ servicios: [sinMarca(DJ), FOTO] })).ingresosPendientes)
})

test("sueldos de personal y compromisos manuales: idénticos, con su persona", () => {
  const personalEvento = [{ id: "pe1", nombre: "Juan", funcion: "Mozo", monto: 50000, pagado: false }]
  const pagosPersonal = [{ id: "pp1", personalId: "x", eventoId: "ev1", nombrePersonal: "Ana", servicioNombre: "Fotógrafa", montoTotal: 80000, fechaEvento: "2026-12-12", fechaLimitePago: "2026-12-12", estado: "pendiente" }]
  const st = (servicios) => state({ servicios, pagosPersonal, eventos: [ev({ personalEvento })] })
  const sueldos = (s) => caja(s).egresosPendientes.filter((e) => e.tipo === "sueldo" && e.servicioId !== "dj")
  const con = sueldos(st([DJ, FOTO]))
  assert.deepEqual(con, sueldos(st([sinMarca(DJ), FOTO])))
  assert.deepEqual(con.map((e) => [e.servicioNombre, e.persona, e.monto]).sort(), [["Ana (Fotógrafa)", "Ana", 80000], ["Juan (Mozo)", "Juan", 50000]])
})

test("filtro Sueldos: sub-filtro por persona junta los pagos de todos los eventos", () => {
  const ev2 = ev({ id: "ev2", nombre: "Otro evento", fecha: "2026-11-20", personalEvento: [{ id: "pe2", nombre: "Juan", funcion: "Mozo", monto: 60000, pagado: false }] })
  const ev1 = ev({ personalEvento: [{ id: "pe1", nombre: "Juan", funcion: "Bachero", monto: 50000, pagado: false }] })
  const egresos = caja(state({ eventos: [ev1, ev2] })).egresosPendientes
  const juan = filtrarEgresos(egresos, { ...FILTRO_EGRESOS_INICIAL, tipo: "sueldo", sub: "Juan" })
  assert.deepEqual(juan.map((e) => [e.eventoId, e.monto]).sort(), [["ev1", 50000], ["ev2", 60000]])
  assert.equal(juan.reduce((s, e) => s + e.monto, 0), 110000)
  const dj = filtrarEgresos(egresos, { ...FILTRO_EGRESOS_INICIAL, tipo: "sueldo", sub: "DJ, SONIDO, LUCES Y HUMO" })
  assert.deepEqual(dj.map((e) => [e.eventoId, e.monto]).sort(), [["ev1", 600000], ["ev2", 600000]])
  // Servicios ya no incluye al DJ (está en Sueldos)
  const servicios = filtrarEgresos(egresos, { ...FILTRO_EGRESOS_INICIAL, tipo: "servicios" })
  assert.ok(servicios.every((e) => e.servicioId === "foto"))
})

test("archivar el evento congela el monto pagado como sueldo", () => {
  const pagado = ev({ servicios: [pagarServicioComoSueldo(srvEv(DJ), 600000, "2026-12-12"), srvEv(FOTO)] })
  const congelado = congelarCostosEvento(pagado, { recetas: [], insumos: [], insumosBarra: [], cocteles: [], servicios: [DJ, FOTO], personal: [], movimientosCaja: [] })
  const dj = congelado.serviciosCalc.find((s) => s.servicioId === "dj")
  assert.equal(dj.montoSeña + dj.saldo, 600000)
})

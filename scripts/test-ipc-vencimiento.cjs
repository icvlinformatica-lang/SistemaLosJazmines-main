// IPC por mes de vencimiento (regla "vencimiento-v2", pedido del dueño el
// 26/10/2026): una cuota atrasada lleva el ajuste del mes en que venció y
// los meses sin cobros se acumulan. Correr: node --test scripts/test-ipc-vencimiento.cjs
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
const { calcularIPCPeriodo, resolverCalculoCobro, mesesEntre, proyectarIPC } = require("../lib/ipc-cuotas.ts")
const { validarCobroIPC } = require("../lib/validar-cobro-ipc.ts")

// mes es 0-based (como en historial_ipc): 7 = agosto, 8 = septiembre, 9 = octubre
const ipc = (mes, porcentaje, anio = 2026) => ({ mes, anio, porcentaje, fechaAplicacion: "", eventosActualizados: 0 })
// Como en la base real: julio 1,9 %, agosto 2,1 %, septiembre 1,7 %, octubre 1,9 %.
const historialReal = [ipc(5, 1.9), ipc(6, 1.9), ipc(7, 2.1), ipc(8, 1.7), ipc(9, 1.9)]
const listo = (r) => { assert.equal(r.estado, "listo", r.motivo); return r.calculo }

// Copia inventada del plan de "Guada y Daniel" tal como estaba el 26/10/2026.
function guada() {
  const v1 = (extra) => ({ version: "ultima-cuota-v1", aplicadoEsteMes: false, ...extra })
  const c1 = v1({ base: 983504.13, monto: 983504.13, origen: "plan", periodo: "2026-08", ipcOmitido: true, porcentaje: 2.1 })
  const c2 = v1({ base: 983504.13, monto: 1000224, origen: "pago", periodo: "2026-10", porcentaje: 1.7, cuotaOrigen: 1, ipcProvisorio: true, periodoIndice: "2026-09" })
  return {
    estado: "pendiente",
    planDeCuotas: {
      ajustaPorIPC: true, numeroCuotas: 8, modalidadPago: "sena", montoCuota: 983504.13, montoTotal: 14339188, cuotasPagadas: [1, 2],
      cuotas: [
        { numero: 1, pagada: true, estado: "pagada", montoCuota: 983504.13, montoPagadoNeto: 983504.13, fechaPagoReal: "2026-08-10", fechaVencimiento: "2026-08-20", calculoIPC: c1 },
        { numero: 2, pagada: true, estado: "pagada", montoCuota: 1000224, montoPagadoNeto: 1000224, fechaPagoReal: "2026-10-24", fechaVencimiento: "2026-09-20", calculoIPC: c2 },
        ...[3, 4, 5, 6, 7, 8].map((numero) => ({ numero, pagada: false, montoCuota: 1002191, fechaVencimiento: `20${numero < 6 ? "26" : "27"}-${String(((numero + 6) % 12) + 1).padStart(2, "0")}-20` })),
      ],
    },
    pagos: [
      { id: "a", numeroCuota: 1, fecha: "2026-08-10", monto: 983504.13, montoCuotaNeto: 983504.13, montoMora: 0, calculoIPC: c1 },
      { id: "b", numeroCuota: 2, fecha: "2026-10-24", monto: 1000224, montoCuotaNeto: 1000224, montoMora: 0, calculoIPC: c2 },
    ],
  }
}

test("caso Guada y Daniel: la cuota 3 (vence en octubre) sale de la cuota 2 más el IPC de octubre", () => {
  const ev = guada()
  assert.deepEqual(ev.planDeCuotas.cuotas.map((c) => c.fechaVencimiento).slice(2, 5), ["2026-10-20", "2026-11-20", "2026-12-20"])
  const c = listo(calcularIPCPeriodo(ev, historialReal, "2026-10-26"))
  // Antes daba 1.002.191 (983.504,13 + 1,9 %): la cuota 2, cobrada tarde en
  // octubre, compartía base con la 3 y se perdía el ajuste de un mes.
  assert.equal(c.base, 1000224)
  assert.equal(c.cuotaOrigen, 2)
  assert.equal(c.periodo, "2026-10")
  assert.equal(c.porcentaje, 1.9)
  assert.equal(c.monto, 1019228)
  assert.equal(c.version, "vencimiento-v2")
})

test("cuota atrasada: lleva el IPC del mes en que venció, no el del mes en que se cobra", () => {
  const ev = guada()
  // Volvemos a antes del cobro de la cuota 2 (vencía el 20/9) y la cobramos el 24/10.
  ev.planDeCuotas.cuotasPagadas = [1]
  ev.pagos = ev.pagos.slice(0, 1)
  const { calculoIPC, fechaPagoReal, montoPagadoNeto, ...resto } = ev.planDeCuotas.cuotas[1]
  ev.planDeCuotas.cuotas[1] = { ...resto, pagada: false, estado: "pendiente" }
  const c = listo(calcularIPCPeriodo(ev, historialReal, "2026-10-24"))
  assert.equal(c.periodo, "2026-09")
  assert.equal(c.porcentaje, 1.7)
  assert.equal(c.monto, 1000224)
})

test("varios meses sin cobrar: se aplica cada mes, compuesto", () => {
  const ev = guada()
  // La cuota 3 vencía en octubre; si recién se cobra en diciembre sigue
  // ajustada a octubre (el atraso va por la mora).
  assert.equal(listo(calcularIPCPeriodo(ev, [...historialReal, ipc(10, 2.5)], "2026-12-05")).monto, 1019228)
  // Cobrada la 3 a tiempo en octubre, la 4 cobrada en diciembre (vencía en
  // noviembre) suma solo noviembre.
  const c3 = listo(calcularIPCPeriodo(ev, historialReal, "2026-10-26"))
  ev.planDeCuotas.cuotasPagadas.push(3)
  Object.assign(ev.planDeCuotas.cuotas[2], { pagada: true, estado: "pagada", montoCuota: c3.monto, montoPagadoNeto: c3.monto, fechaPagoReal: "2026-10-26", calculoIPC: c3 })
  ev.pagos.push({ id: "c", numeroCuota: 3, fecha: "2026-10-26", monto: c3.monto, montoCuotaNeto: c3.monto, montoMora: 0, calculoIPC: c3 })
  const c4 = listo(calcularIPCPeriodo(ev, [...historialReal, ipc(10, 2.5)], "2026-12-05"))
  assert.equal(c4.periodo, "2026-11")
  assert.equal(c4.monto, Math.round(1019228 * 1.025))
})

test("pagar por adelantado: no suma IPC futuro, y la cuota siguiente recupera los meses", () => {
  const ev = guada()
  const c3 = listo(calcularIPCPeriodo(ev, historialReal, "2026-10-26"))
  ev.planDeCuotas.cuotasPagadas.push(3)
  Object.assign(ev.planDeCuotas.cuotas[2], { pagada: true, estado: "pagada", montoCuota: c3.monto, montoPagadoNeto: c3.monto, fechaPagoReal: "2026-10-26", calculoIPC: c3 })
  ev.pagos.push({ id: "c", numeroCuota: 3, fecha: "2026-10-26", monto: c3.monto, montoCuotaNeto: c3.monto, montoMora: 0, calculoIPC: c3 })
  // La 4 (vence en noviembre) se paga el mismo día: mismo valor, sin otro ajuste.
  const c4 = listo(calcularIPCPeriodo(ev, historialReal, "2026-10-27"))
  assert.equal(c4.monto, 1019228)
  assert.equal(c4.aplicadoEsteMes, true)
  ev.planDeCuotas.cuotasPagadas.push(4)
  Object.assign(ev.planDeCuotas.cuotas[3], { pagada: true, estado: "pagada", montoCuota: c4.monto, montoPagadoNeto: c4.monto, fechaPagoReal: "2026-10-27", calculoIPC: c4 })
  ev.pagos.push({ id: "d", numeroCuota: 4, fecha: "2026-10-27", monto: c4.monto, montoCuotaNeto: c4.monto, montoMora: 0, calculoIPC: c4 })
  // La 5 (vence en diciembre) cobrada en diciembre: noviembre y diciembre.
  const c5 = listo(calcularIPCPeriodo(ev, [...historialReal, ipc(10, 2), ipc(11, 3)], "2026-12-20"))
  assert.deepEqual(c5.meses.map((m) => m.periodo), ["2026-11", "2026-12"])
  assert.equal(c5.monto, Math.round(1019228 * 1.02 * 1.03))
  assert.ok(Math.abs(c5.porcentaje - 5.06) < 1e-9)
})

test("si falta el IPC de un mes intermedio se usa el último publicado antes, marcado provisorio", () => {
  const ev = guada()
  const c = listo(calcularIPCPeriodo(ev, historialReal.slice(0, 4), "2026-10-26"))
  assert.equal(c.porcentaje, 1.7)
  assert.equal(c.ipcProvisorio, true)
  assert.equal(c.periodoIndice, "2026-09")
})

test("lo ya cobrado no cambia: proyectar solo toca cuotas pendientes", () => {
  const ev = guada()
  const p = proyectarIPC(ev, historialReal, "2026-10-26")
  assert.deepEqual(p.planDeCuotas.cuotas.slice(0, 2), ev.planDeCuotas.cuotas.slice(0, 2))
  assert.deepEqual(p.planDeCuotas.cuotas.slice(2).map((c) => c.montoCuota), Array(6).fill(1019228))
  assert.deepEqual(p.pagos, ev.pagos)
})

test("el servidor acepta el cobro con la regla nueva y rechaza el monto de la regla vieja", () => {
  const actual = guada()
  const calculo = resolverCalculoCobro(actual, historialReal, "2026-10-26", { aplicarIPC: true }).calculo
  const armar = (monto) => {
    const plan = structuredClone(actual.planDeCuotas)
    plan.cuotasPagadas = [1, 2, 3]
    Object.assign(plan.cuotas[2], { pagada: true, estado: "pagada", montoCuota: monto, montoPagadoNeto: monto, fechaPagoReal: "2026-10-26", calculoIPC: calculo })
    return { planDeCuotas: plan, pagos: [...structuredClone(actual.pagos), { id: "n", numeroCuota: 3, fecha: "2026-10-26", monto, montoCuotaNeto: monto, montoMora: 0, calculoIPC: calculo }] }
  }
  assert.equal(validarCobroIPC(actual, armar(1019228), historialReal), null)
  assert.match(validarCobroIPC(actual, armar(1002191), historialReal), /cambió/)
})

test("base corregida a mano conserva los meses aplicados", () => {
  const ev = guada()
  const c = resolverCalculoCobro(ev, [...historialReal, ipc(10, 2), ipc(11, 3)], "2026-12-20", { aplicarIPC: true, baseManual: 1000000 }).calculo
  assert.equal(c.origen, "manual")
  assert.deepEqual(c.meses.map((m) => m.periodo), ["2026-10"])
  assert.equal(c.monto, 1019000)
})

test("mesesEntre: cambio de año, mismo mes y orden inverso", () => {
  assert.deepEqual(mesesEntre("2026-11", "2027-02"), ["2026-12", "2027-01", "2027-02"])
  assert.deepEqual(mesesEntre("2026-10", "2026-10"), [])
  assert.deepEqual(mesesEntre("2026-10", "2026-08"), [])
})

test("el desglose y la etiqueta nombran todos los meses aplicados", () => {
  const React = require("react")
  const { renderToStaticMarkup } = require("react-dom/server")
  const { etiquetaMesesIPC } = require("../lib/ipc-cuotas.ts")
  const { DesgloseIPCPago } = require("../components/desglose-ipc-pago.tsx")
  assert.equal(etiquetaMesesIPC({ periodo: "2026-10" }), "octubre de 2026")
  assert.equal(etiquetaMesesIPC({ periodo: "2026-12", meses: [{ periodo: "2026-11", porcentaje: 2 }, { periodo: "2026-12", porcentaje: 3 }] }), "noviembre y diciembre de 2026")
  assert.equal(etiquetaMesesIPC({ periodo: "2027-01", meses: [{ periodo: "2026-12", porcentaje: 2 }, { periodo: "2027-01", porcentaje: 3 }] }), "diciembre de 2026 y enero de 2027")
  const resultado = { estado: "listo", calculo: { version: "vencimiento-v2", periodo: "2026-12", base: 100000, origen: "pago", porcentaje: 5.06, monto: 105060, aplicadoEsteMes: false,
    meses: [{ periodo: "2026-11", porcentaje: 2 }, { periodo: "2026-12", porcentaje: 3 }] } }
  const html = renderToStaticMarkup(React.createElement(DesgloseIPCPago, { resultado, montoCuota: 105060, diasAtraso: 0, recargoPorDia: 3000, recargoOmitido: false }))
  assert.match(html, /noviembre y diciembre de 2026/)
  assert.match(html, /105\.060/)
})

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")
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
const { reconstruirDesgloseIPC } = require("../lib/desglose-ipc.ts")
const { DesgloseIPCPago } = require("../components/desglose-ipc-pago.tsx")
const ahora = Date.parse("2026-09-11T00:00:00Z")
const registro = (mes, porcentaje, anio = 2026) => ({ mes, anio, porcentaje, fechaAplicacion: `${anio}-${String(mes + 1).padStart(2, "0")}-10T00:00:00Z`, eventosActualizados: 1 })
const historial = [registro(5, 1.9), registro(6, 1.9), registro(7, 2.1), registro(8, 1.7)]

test("caso Ángeles: no atribuye a julio/agosto aumentos que no concilian con la base", () => {
  const pasos = reconstruirDesgloseIPC(647465, 658472, historial, ahora)
  assert.deepEqual(pasos, [{ mes: 8, anio: 2026, porcentaje: 1.7, montoAnterior: 647465, incremento: 11007, montoAjustado: 658472 }])
})

test("compone cada mes sobre el anterior y respeta el redondeo a pesos", () => {
  const registros = [registro(6, 1.9), registro(7, 2.1), registro(8, 1.7)]
  const monto = registros.reduce((base, h) => Math.round(base * (1 + h.porcentaje / 100)), 100003)
  const pasos = reconstruirDesgloseIPC(100003, monto, registros, ahora)
  assert.equal(pasos.length, 3)
  assert.equal(pasos[1].montoAnterior, pasos[0].montoAjustado)
  assert.equal(pasos[2].montoAnterior, pasos[1].montoAjustado)
  assert.equal(pasos.reduce((s, p) => s + p.incremento, 0), monto - 100003)
})

test("no inventa meses si el importe no concilia, falta base o no hay aumento", () => {
  for (const [base, actual] of [[100, 190], [0, 100], [100, 100], [100, 90], [NaN, 100], [100, Infinity]]) {
    assert.deepEqual(reconstruirDesgloseIPC(base, actual, historial, ahora), [])
  }
  assert.deepEqual(reconstruirDesgloseIPC(100, 102, [], ahora), [])
})

test("ignora IPC futuros y no modifica el historial recibido", () => {
  const registros = [registro(9, 8), registro(8, 1.7)]
  const original = structuredClone(registros)
  assert.equal(reconstruirDesgloseIPC(647465, 658472, registros, ahora).length, 1)
  assert.deepEqual(registros, original)
})

test("no elige entre reconstrucciones ambiguas ni meses duplicados", () => {
  assert.deepEqual(reconstruirDesgloseIPC(100, 102, [registro(7, 0), registro(8, 2)], ahora), [])
  assert.deepEqual(reconstruirDesgloseIPC(100, 104, [registro(8, 2), registro(8, 2)], ahora), [])
})

test("ordena cambios de año sin sumar porcentajes de forma simple", () => {
  const registros = [registro(0, 10), registro(11, 10, 2025)]
  assert.deepEqual(reconstruirDesgloseIPC(100, 121, registros, ahora).map(p => p.montoAjustado), [110, 121])
})

const { calcularIPCPeriodo, proyectarIPC, fechaNegocio } = require("../lib/ipc-cuotas.ts")
const { validarCobroIPC } = require("../lib/validar-cobro-ipc.ts")
const { construirCobroCuota } = require("../lib/cobrar-cuota.ts")
const evento = () => ({ estado: "pendiente", pagos: [], planDeCuotas: {
  numeroCuotas: 5, montoCuota: 100000, montoTotal: 500000, ajustaPorIPC: true, cuotasPagadas: [],
  cuotas: Array.from({ length: 5 }, (_, i) => ({ numero: i + 1, montoCuota: 180000, pagada: false })),
} })
const calcular = (ev, hs = [registro(8, 2)], fecha = "2026-09-10") => calcularIPCPeriodo(ev, hs, fecha)
const cobrar = (ev, numero, fecha, hs = [registro(8, 2)]) => {
  const calculo = calcular(ev, hs, fecha).calculo
  ev.planDeCuotas.cuotasPagadas.push(numero)
  ev.pagos.push({ id: `p-${numero}`, numeroCuota: numero, monto: calculo.monto + 6000, montoCuotaNeto: calculo.monto,
    montoMora: 6000, fecha, porcentajeIPC: calculo.porcentaje, calculoIPC: calculo })
  return calculo
}
const angeles = evento()
angeles.planDeCuotas.montoCuota = 600000
angeles.planDeCuotas.cuotasPagadas = [1]
angeles.pagos = [{ id: "p1", monto: 647465, fecha: "2026-08-08", notas: "Cuota 1/15", porcentajeIPC: 0, montoRecibido: 650000, vuelto: 2535 }]
const props = { resultado: calcular(angeles, historial), montoCuota: 658472, diasAtraso: 2, recargoPorDia: 3000, recargoOmitido: false }
const render = (overrides = {}) => renderToStaticMarkup(React.createElement(DesgloseIPCPago, { ...props, ...overrides }))

test("desglose muestra base pagada real, índice vigente, mora y total", () => {
  const html = render()
  for (const importe of [/647\.465/, /11\.007/, /658\.472/, /664\.472/, /6\.000/]) assert.match(html, importe)
  assert.match(html, /Última cuota pagada \(sin mora\)/)
  assert.match(html, /septiembre de 2026/)
  assert.doesNotMatch(html, /IPC acumulado|reconstruido|julio de 2026/)
})
test("quitar mora no cambia la cuota", () => {
  const html = render({ recargoOmitido: true })
  assert.match(html, /\(quitada\)/)
  assert.doesNotMatch(html, /664\.472/)
})
test("base ambigua bloquea el cobro sin mostrar un total inventado", () => {
  const html = render({ resultado: { estado: "pendiente", motivo: "Falta acreditar la base" } })
  assert.match(html, /cobro bloqueado/)
  assert.doesNotMatch(html, /Total a pagar|664\.472|NaN|Infinity/)
})
test("primera cuota ignora montos inflados de las pendientes", () => {
  assert.equal(calcular(evento()).calculo.monto, 102000)
  assert.equal(calcular(evento()).calculo.origen, "plan")
})
test("Ángeles usa pago neto y no cuota original ni vuelto", () => {
  assert.equal(props.resultado.calculo.base, 647465)
  assert.equal(props.resultado.calculo.monto, 658472)
})
test("meses sin pagos no se acumulan", () => {
  const ev = evento(); cobrar(ev, 1, "2026-06-10", [registro(5, 0)])
  assert.equal(calcular(ev, [registro(5, 0), registro(6, 10), registro(7, 20), registro(8, 2)]).calculo.monto, 102000)
})
test("dos pagos en un mes mantienen la base; el siguiente usa último neto", () => {
  const ev = evento(); cobrar(ev, 1, "2026-09-01")
  assert.equal(calcular(ev).calculo.monto, 102000)
  assert.equal(calcular(ev).calculo.aplicadoEsteMes, true)
  cobrar(ev, 2, "2026-09-08")
  assert.equal(calcular(ev).calculo.monto, 102000)
  assert.equal(calcular(ev, [registro(9, 3)], "2026-10-01").calculo.monto, 105060)
})
test("editar IPC recalcula desde base mensual; eliminar bloquea, cero es válido", () => {
  const ev = evento(); cobrar(ev, 1, "2026-09-01")
  assert.equal(calcular(ev, [registro(8, 5)]).calculo.monto, 105000)
  assert.equal(calcular(ev, []).estado, "pendiente")
  assert.equal(calcular(ev, [registro(8, 0)]).calculo.monto, 100000)
  assert.equal(calcular(ev, [registro(8, 2), registro(8, 2)]).estado, "pendiente")
})
test("cambio de año y zona horaria argentina", () => {
  assert.equal(fechaNegocio(new Date("2027-01-01T02:59:00Z")), "2026-12-31")
  const ev = evento(); cobrar(ev, 1, "2026-12-01", [registro(11, 2)])
  assert.equal(calcular(ev, [registro(0, 4, 2027)], "2027-01-02").calculo.monto, 106080)
})
test("mora histórica se extrae solo de nota explícita, extras no se adivinan", () => {
  const ev = evento(); ev.planDeCuotas.cuotasPagadas = [1]
  ev.pagos = [{ id: "x", monto: 106000, fecha: "2026-08-10", notas: "Cuota 1/5 + recargo por atraso $ 6.000 (2 días x $ 3.000)" }]
  assert.equal(calcular(ev).calculo.base, 100000)
  ev.pagos[0].notas += " + extras"
  assert.equal(calcular(ev).estado, "pendiente")
})
test("fecha de vencimiento no sustituye fecha real", () => {
  const ev = evento(); ev.planDeCuotas.cuotasPagadas = [1]
  ev.planDeCuotas.cuotas[0].fechaVencimiento = "2026-08-10"
  assert.equal(calcular(ev).estado, "pendiente")
})
test("pago de este mes sin auditoría no se ajusta por segunda vez", () => {
  const ev = structuredClone(angeles); ev.pagos[0].fecha = "2026-09-01"
  assert.equal(calcular(ev).estado, "pendiente")
})
test("cuotas fijas, pago completo y archivados no cambian", () => {
  for (const patch of [{ estado: "completado" }, { planDeCuotas: { ...evento().planDeCuotas, ajustaPorIPC: false } },
    { planDeCuotas: { ...evento().planDeCuotas, modalidadPago: "completo" } }]) {
    const ev = { ...evento(), ...patch }
    assert.equal(calcular(ev).estado, "no_aplica")
    assert.equal(proyectarIPC(ev, historial), ev)
  }
})
test("proyección repetida es idempotente y conserva íntegros pagos y cuota pagada", () => {
  const ev = structuredClone(angeles); const original = structuredClone(ev)
  const a = proyectarIPC(ev, historial, "2026-09-10")
  const b = proyectarIPC(a, historial, "2026-09-10")
  assert.deepEqual(a, b); assert.deepEqual(ev, original)
  assert.deepEqual(a.pagos, original.pagos)
  assert.deepEqual(a.planDeCuotas.cuotas[0], original.planDeCuotas.cuotas[0])
})
test("anulación elimina la fuente mensual y vuelve a calcular solo pendientes", () => {
  const ev = evento(); cobrar(ev, 1, "2026-09-01")
  ev.pagos = []; ev.planDeCuotas.cuotasPagadas = []
  assert.equal(calcular(ev).calculo.aplicadoEsteMes, false)
  assert.equal(calcular(ev).calculo.monto, 102000)
})
test("anular el pago origen invalida las pendientes sin alterar cobros posteriores", () => {
  const ev = evento(); cobrar(ev, 1, "2026-08-01", [registro(7, 0)])
  cobrar(ev, 2, "2026-09-01")
  const posterior = structuredClone(ev.pagos[1])
  ev.pagos = [ev.pagos[1]]; ev.planDeCuotas.cuotasPagadas = [2]
  assert.equal(calcular(ev).estado, "pendiente")
  assert.deepEqual(ev.pagos[0], posterior)
})
test("cobro compartido distingue fecha real de fecha contable y bloquea importe viejo", () => {
  const ev = { ...evento(), id: "e1", salon: "Quinta" }
  const result = construirCobroCuota(ev, 1, 102000, "2026-07-10", [], undefined, [registro(8, 2)], "2026-09-10")
  assert.equal(result.planUpdate.planDeCuotas.cuotas[0].fechaPagoReal, "2026-09-10")
  assert.match(result.movimientos[0].fecha, /^2026-07-10/)
  assert.ok(construirCobroCuota(ev, 1, 180000, undefined, [], undefined, [registro(8, 2)], "2026-09-10").error)
})
test("servidor recalcula base y rechaza montos manipulados", () => {
  const ev = evento()
  const result = construirCobroCuota(ev, 1, 102000, undefined, [], undefined, [registro(8, 2)], "2026-09-01")
  assert.equal(validarCobroIPC(ev, result.planUpdate, [registro(8, 2)]), null)
  result.planUpdate.planDeCuotas.cuotas[0].montoPagadoNeto = 1
  assert.match(validarCobroIPC(ev, result.planUpdate, [registro(8, 2)]), /cambió/)
})

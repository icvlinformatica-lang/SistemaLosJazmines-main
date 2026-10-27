// Monto a cobrar distinto del sugerido (pedido del dueño, 27/10/2026):
// ajuste solo de esa cuota (lib/ajuste-cobro.ts, lib/estado-cuotas.ts).
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

const { estadoDeCuota, saldoRestanteCuota, objetivoCuota } = require("../lib/estado-cuotas.ts")
const { validarAjustesCobro, preguntaBaseCobrada } = require("../lib/ajuste-cobro.ts")
const { validarCobroIPC } = require("../lib/validar-cobro-ipc.ts")
const { calcularIPCPeriodo, resolverCalculoCobro, fechaNegocio } = require("../lib/ipc-cuotas.ts")
const { validarSaldoAFavor } = require("../lib/saldo-a-favor.ts")

const ipc = (mes, porcentaje, anio = 2026) => ({ mes, anio, porcentaje, fechaAplicacion: "", eventosActualizados: 0 })
const historial = [ipc(8, 2), ipc(9, 3)] // septiembre 2 %, octubre 3 %

// Plan con IPC de 3 cuotas: la 1 vence en septiembre, la 2 en octubre.
const evento = () => ({ estado: "pendiente", pagos: [], planDeCuotas: {
  numeroCuotas: 3, montoCuota: 100000, montoTotal: 300000, ajustaPorIPC: true, cuotasPagadas: [],
  cuotas: [1, 2, 3].map((numero) => ({ numero, montoCuota: 100000, pagada: false, fechaVencimiento: `2026-${String(8 + numero).padStart(2, "0")}-10` })),
} })

// Cobro de la cuota 1 el 10/9 con el monto a cobrar elegido (sugerido 102.000).
function cobroCuota1(ev, { aCobrar, entrega = aCobrar, decision }) {
  const fecha = "2026-09-10"
  const calculo = resolverCalculoCobro(ev, historial, fecha, { aplicarIPC: true }).calculo
  const ajuste = Math.round((aCobrar - calculo.monto) * 100) / 100
  const completa = entrega >= calculo.monto + ajuste
  const pago = { id: "p1", numeroCuota: 1, fecha, monto: entrega, montoCuotaNeto: entrega, montoMora: 0, porcentajeIPC: 2, calculoIPC: calculo,
    ...(ajuste !== 0 ? { ajusteCuota: ajuste } : {}) }
  return { pagos: [pago], planDeCuotas: { ...ev.planDeCuotas, cuotasPagadas: completa ? [1] : [],
    cuotas: ev.planDeCuotas.cuotas.map((c) => c.numero === 1 ? { ...c, pagada: completa, montoCuota: calculo.monto, montoPagadoNeto: entrega,
      fechaPagoReal: fecha, calculoIPC: calculo, ...(ajuste !== 0 ? { ajusteCobro: ajuste } : {}), ...(decision ?? {}) } : c) } }
}

test("la cuota se completa con su cifra oficial más el ajuste", () => {
  assert.equal(objetivoCuota({ montoCuota: 1019228, ajusteCobro: 1772 }), 1021000)
  assert.equal(estadoDeCuota({ montoCuota: 1019228, ajusteCobro: 1772, montoPagadoNeto: 1019228 }), "parcial")
  assert.equal(estadoDeCuota({ montoCuota: 1019228, ajusteCobro: 1772, montoPagadoNeto: 1021000 }), "pagada")
  assert.equal(saldoRestanteCuota({ montoCuota: 1019228, ajusteCobro: 1772, montoPagadoNeto: 1000000 }), 21000)
  // Descuento: con $1.000.000 queda cobrada una cuota de $1.019.228.
  assert.equal(estadoDeCuota({ montoCuota: 1019228, ajusteCobro: -19228, montoPagadoNeto: 1000000 }), "pagada")
  // Sin ajuste, como siempre.
  assert.equal(saldoRestanteCuota({ montoCuota: 500, montoPagadoNeto: 200 }), 300)
})

test("servidor: acepta cobrar más que el sugerido y la cifra oficial no cambia", () => {
  const ev = evento()
  const updates = cobroCuota1(ev, { aCobrar: 105000 })
  assert.equal(validarCobroIPC(ev, updates, historial), null)
  const cuota = updates.planDeCuotas.cuotas[0]
  assert.equal(cuota.montoCuota, 102000); assert.equal(cuota.ajusteCobro, 3000); assert.equal(cuota.pagada, true)
  assert.equal(updates.pagos[0].ajusteCuota, 3000)
  assert.equal(validarAjustesCobro(ev, updates), null)
  assert.equal(validarSaldoAFavor(ev, updates), null)
})

test("servidor: un descuento deja la cuota cobrada por menos", () => {
  const ev = evento()
  const updates = cobroCuota1(ev, { aCobrar: 100000 })
  assert.equal(validarCobroIPC(ev, updates, historial), null)
  assert.equal(updates.planDeCuotas.cuotas[0].pagada, true)
  assert.equal(updates.planDeCuotas.cuotas[0].ajusteCobro, -2000)
})

test("servidor: si el cliente entrega menos que el monto a cobrar, queda saldo pendiente sobre ese monto", () => {
  const ev = evento()
  const sinDecision = cobroCuota1(ev, { aCobrar: 105000, entrega: 103000 })
  assert.match(validarCobroIPC(ev, sinDecision, historial), /saldo/)
  const updates = cobroCuota1(ev, { aCobrar: 105000, entrega: 103000, decision: { saldoDecision: "aparte", recargoSaldo: "congelado" } })
  assert.equal(validarCobroIPC(ev, updates, historial), null)
  const cuota = updates.planDeCuotas.cuotas[0]
  assert.equal(cuota.pagada, false); assert.equal(saldoRestanteCuota(cuota), 2000)
  // El saldo se completa con 2.000, no con el sugerido; y el ajuste ya no se puede cambiar.
  const despues = { ...ev, ...structuredClone(updates) }
  const pago2 = { id: "p2", numeroCuota: 1, fecha: "2026-09-20", monto: 2000, montoCuotaNeto: 2000, montoMora: 0, porcentajeIPC: 0 }
  const completa = { pagos: [...despues.pagos, pago2], planDeCuotas: { ...despues.planDeCuotas, cuotasPagadas: [1],
    cuotas: despues.planDeCuotas.cuotas.map((c) => c.numero === 1 ? { ...c, montoPagadoNeto: 105000, pagada: true } : c) } }
  assert.equal(validarCobroIPC(despues, structuredClone(completa), historial), null)
  const cambiaAjuste = structuredClone(completa); cambiaAjuste.planDeCuotas.cuotas[0].ajusteCobro = 0
  assert.match(validarCobroIPC(despues, cambiaAjuste, historial), /no se puede cambiar/i)
  assert.match(validarAjustesCobro(despues, cambiaAjuste), /no se puede cambiar/i)
})

test("servidor: rechaza ajustes que no coinciden o dejan la cuota en cero", () => {
  const ev = evento()
  const distinto = cobroCuota1(ev, { aCobrar: 105000 }); distinto.pagos[0].ajusteCuota = 1
  assert.match(validarCobroIPC(ev, distinto, historial), /no coincide/)
  assert.match(validarAjustesCobro(ev, distinto), /no coincide/)
  const cero = cobroCuota1(ev, { aCobrar: 105000 }); cero.planDeCuotas.cuotas[0].ajusteCobro = -102000; cero.pagos[0].ajusteCuota = -102000
  assert.match(validarCobroIPC(ev, cero, historial), /mayor a cero/)
  const raro = cobroCuota1(ev, { aCobrar: 105000 }); raro.planDeCuotas.cuotas[0].ajusteCobro = "mil"
  assert.match(validarAjustesCobro(ev, raro), /no es válido/)
})

test("eventos sin IPC: el ajuste también se controla", () => {
  const ev = { pagos: [], planDeCuotas: { numeroCuotas: 2, cuotasPagadas: [], cuotas: [{ numero: 1, montoCuota: 500 }, { numero: 2, montoCuota: 500 }] } }
  const pago = { id: "x", numeroCuota: 1, fecha: "2026-09-10", monto: 520, montoCuotaNeto: 520, montoMora: 0, porcentajeIPC: 0, ajusteCuota: 20 }
  const updates = { pagos: [pago], planDeCuotas: { ...ev.planDeCuotas, cuotasPagadas: [1], cuotas: [{ numero: 1, montoCuota: 500, ajusteCobro: 20, montoPagadoNeto: 520, pagada: true }, { numero: 2, montoCuota: 500 }] } }
  assert.equal(validarAjustesCobro(ev, updates), null)
  assert.equal(validarSaldoAFavor(ev, updates), null)
  const sinPago = structuredClone(updates); delete sinPago.pagos[0].ajusteCuota
  assert.match(validarAjustesCobro(ev, sinPago), /no coincide/)
  // Anular el único pago libera la cuota y borra el ajuste.
  const pagado = { ...ev, ...structuredClone(updates) }
  const anulado = { pagos: [], planDeCuotas: { ...ev.planDeCuotas } }
  assert.equal(validarAjustesCobro(pagado, anulado), null)
})

// Pedido del dueño (27/10/2026): "calcula lo sugerido en base al último
// monto cobrado". Ya no se pregunta: la base es lo cobrado.
function cobroCuota2(antes, calculo, fecha) {
  const pago = { id: "p2", numeroCuota: 2, fecha, monto: calculo.monto, montoCuotaNeto: calculo.monto, montoMora: 0, porcentajeIPC: calculo.porcentaje, calculoIPC: calculo }
  return { pagos: [...antes.pagos, pago], planDeCuotas: { ...antes.planDeCuotas, cuotasPagadas: [...antes.planDeCuotas.cuotasPagadas, 2],
    cuotas: antes.planDeCuotas.cuotas.map((c) => c.numero === 2 ? { ...c, pagada: true, montoCuota: calculo.monto, montoPagadoNeto: calculo.monto,
      fechaPagoReal: fecha, calculoIPC: calculo } : c) } }
}

test("la cuota siguiente se calcula sobre lo último cobrado, sin preguntar", () => {
  const ev = evento()
  const despues = { ...ev, ...cobroCuota1(ev, { aCobrar: 105000 }) }
  assert.equal(validarCobroIPC(ev, despues, historial), null)
  // Cuota 2 (vence en octubre): sobre lo cobrado, 105.000 × 1,03.
  const r = calcularIPCPeriodo(despues, historial, "2026-10-10")
  assert.equal(r.calculo.base, 105000); assert.equal(r.calculo.monto, 108150)
  assert.equal(r.calculo.origen, "pago"); assert.equal(r.calculo.cuotaOrigen, 1)
  assert.equal(preguntaBaseCobrada(despues, historial, "2026-10-10"), null)
  // El servidor acepta ese cobro como uno normal.
  assert.equal(validarCobroIPC(despues, cobroCuota2(despues, r.calculo, "2026-10-10"), historial), null)
  // Con descuento, también: 100.000 × 1,03.
  const conDescuento = { ...ev, ...cobroCuota1(ev, { aCobrar: 100000 }) }
  assert.equal(calcularIPCPeriodo(conDescuento, historial, "2026-10-10").calculo.monto, 103000)
  // Sin ajuste, como siempre: sobre la cifra oficial.
  const sinAjuste = { ...ev, ...cobroCuota1(ev, { aCobrar: 102000 }) }
  assert.equal(calcularIPCPeriodo(sinAjuste, historial, "2026-10-10").calculo.monto, 105060)
})

test("en el mismo mes, la cuota siguiente vale lo último cobrado", () => {
  const ev = evento()
  // La cuota 1 se cobra en septiembre por 105.000; la 2 se adelanta y se cobra también en septiembre.
  const despues = { ...ev, ...cobroCuota1(ev, { aCobrar: 105000 }) }
  const r = calcularIPCPeriodo(despues, historial, "2026-09-20")
  assert.equal(r.calculo.monto, 105000); assert.equal(r.calculo.porcentaje, 0)
  assert.equal(r.calculo.periodo, "2026-09"); assert.equal(r.calculo.cuotaOrigen, 1)
  assert.equal(validarCobroIPC(despues, cobroCuota2(despues, r.calculo, "2026-09-20"), historial), null)
  // Y la 3, también en septiembre, vale lo mismo que la 2.
  const tras2 = { ...despues, ...cobroCuota2(despues, r.calculo, "2026-09-20") }
  const r3 = calcularIPCPeriodo(tras2, historial, "2026-09-25")
  assert.equal(r3.calculo.monto, 105000); assert.equal(r3.calculo.cuotaOrigen, 2)
  // En octubre se le aplica el IPC de octubre a lo último cobrado.
  assert.equal(calcularIPCPeriodo(tras2, historial, "2026-10-10").calculo.monto, 108150)
})

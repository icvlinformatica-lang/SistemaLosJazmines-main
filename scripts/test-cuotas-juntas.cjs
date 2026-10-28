// Cuando el cliente entrega de más (pedido del dueño, 27/10/2026): pagar
// varias cuotas juntas, una por operación (lib/cuotas-juntas.ts).
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
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename)

const { armarCuotaJunta, cuotasQueAlcanzan, eventoConCobro, cerrarUltimaCuotaJunta, textoCuotas } = require("../lib/cuotas-juntas.ts")
const { validarCobroIPC } = require("../lib/validar-cobro-ipc.ts")
const { validarSaldoAFavor, creditoDisponible } = require("../lib/saldo-a-favor.ts")
const { validarAjustesCobro } = require("../lib/ajuste-cobro.ts")

const ipc = (mes, porcentaje, anio = 2026) => ({ mes, anio, porcentaje, fechaAplicacion: "", eventosActualizados: 0 })
const historial = [ipc(8, 2), ipc(9, 3)] // septiembre 2 %, octubre 3 %
const HOY = "2026-10-10"

const evento = (ajusta = true) => ({
  id: "ev1", nombrePareja: "PRUEBA", salon: "Casona", fecha: "2027-03-01", estado: "pendiente", pagos: [],
  planDeCuotas: {
    numeroCuotas: 4, montoCuota: 100000, montoTotal: 400000, ajustaPorIPC: ajusta, cuotasPagadas: [],
    cuotas: ["2026-10-10", "2026-11-10", "2026-12-10", "2027-01-10"].map((v, i) => ({ numero: i + 1, montoCuota: 100000, pagada: false, fechaVencimiento: v })),
  },
})

// Lo que controla el servidor en PATCH /api/eventos/[id] para cada cobro.
function servidorAcepta(antes, cobro, ajusta = true) {
  const updates = { pagos: cobro.pagos, planDeCuotas: cobro.planDeCuotas }
  if (ajusta) assert.equal(validarCobroIPC(antes, updates, historial), null)
  assert.equal(validarAjustesCobro(antes, updates), null)
  assert.equal(validarSaldoAFavor(antes, updates), null)
}

const datos = (id) => ({ id, pagadoPor: "PRUEBA paga", recibidoPor: "PRUEBA recibe" })

test("con lo que sobra alcanzan dos cuotas más, y cada cobro pasa los controles del servidor", () => {
  const ev = evento()
  const primera = armarCuotaJunta(ev, historial, HOY, datos("pago-1"))
  assert.equal(primera.ok, true)
  assert.equal(primera.cuota.numeroCuota, 1)
  servidorAcepta(ev, primera.cuota.cobro)
  const valor = primera.cuota.monto
  const tras = eventoConCobro(ev, primera.cuota.cobro)

  // Sobran 2,5 cuotas: se ofrecen pagar la 2 o la 2 y la 3.
  const opciones = cuotasQueAlcanzan(tras, historial, HOY, valor * 2.5)
  assert.deepEqual(opciones.map((o) => o.numeroCuota), [2, 3])
  // Mismo período (octubre): las cuotas valen lo mismo que la de hoy.
  assert.ok(opciones.every((o) => o.monto === valor))
  assert.deepEqual(cuotasQueAlcanzan(tras, historial, HOY, valor - 1), [])

  // Se guardan una por una, y lo que sobra queda a favor en la última.
  let actual = tras
  for (const [i, o] of opciones.entries()) {
    const r = armarCuotaJunta(actual, historial, HOY, { ...datos(`junta-${i}`), nota: "(pagada junto con la cuota 1)" })
    assert.equal(r.ok, true)
    assert.equal(r.cuota.numeroCuota, o.numeroCuota)
    assert.match(r.cuota.cobro.pago.notas, /junto con la cuota 1/)
    const cobro = i === opciones.length - 1 ? cerrarUltimaCuotaJunta(r.cuota.cobro, valor * 0.5, o.numeroCuota) : r.cuota.cobro
    servidorAcepta(actual, cobro)
    actual = eventoConCobro(actual, cobro)
  }
  assert.deepEqual(actual.planDeCuotas.cuotasPagadas.sort(), [1, 2, 3])
  assert.equal(creditoDisponible(actual.pagos), valor * 0.5)
  const entro = actual.pagos.reduce((s, p) => s + p.monto, 0)
  assert.equal(entro, valor * 3.5)
})

test("si no queda otra cuota, lo que sobra es vuelto", () => {
  const ev = evento(false)
  let actual = ev
  for (let i = 0; i < 3; i++) {
    const r = armarCuotaJunta(actual, historial, HOY, datos(`p${i}`))
    servidorAcepta(actual, r.cuota.cobro, false)
    actual = eventoConCobro(actual, r.cuota.cobro)
  }
  const ultima = armarCuotaJunta(actual, historial, HOY, datos("p4"))
  assert.equal(ultima.cuota.numeroCuota, 4)
  assert.equal(ultima.cuota.monto, 100000)
  const cobro = cerrarUltimaCuotaJunta(ultima.cuota.cobro, 5000, 4)
  assert.equal(cobro.pago.monto, 100000)
  assert.equal(cobro.pago.vuelto, 5000)
  assert.equal(cobro.pago.montoRecibido, 105000)
  assert.equal(cobro.pago.saldoAFavor, undefined)
  servidorAcepta(actual, cobro, false)
  // Todo pago: ya no hay cuotas que ofrecer.
  assert.deepEqual(cuotasQueAlcanzan(eventoConCobro(actual, cobro), historial, HOY, 1e9), [])
})

test("una cuota siguiente atrasada se cobra con su recargo", () => {
  const ev = evento(false)
  const r1 = armarCuotaJunta(ev, historial, "2026-11-15", datos("a"))
  const tras = eventoConCobro(ev, r1.cuota.cobro)
  const [o] = cuotasQueAlcanzan(tras, historial, "2026-11-15", 200000)
  assert.equal(o.numeroCuota, 2)
  assert.equal(o.recargo, 5 * 3000)
  assert.equal(o.monto, 115000)
})

test("con saldo a favor sin usar no se arman cuotas juntas", () => {
  const ev = evento(false)
  ev.pagos = [{ id: "x", numeroCuota: 1, monto: 150000, montoCuotaNeto: 100000, montoMora: 0, saldoAFavor: 50000, fecha: "2026-10-01" }]
  ev.planDeCuotas.cuotas[0] = { ...ev.planDeCuotas.cuotas[0], pagada: true, montoPagadoNeto: 100000 }
  ev.planDeCuotas.cuotasPagadas = [1]
  assert.equal(armarCuotaJunta(ev, historial, HOY, datos("y")).ok, false)
  assert.deepEqual(cuotasQueAlcanzan(ev, historial, HOY, 1e9), [])
})

test("texto de las opciones", () => {
  assert.equal(textoCuotas([4]), "la cuota 4")
  assert.equal(textoCuotas([4, 5]), "las cuotas 4 y 5")
  assert.equal(textoCuotas([4, 5, 6]), "las cuotas 4, 5 y 6")
})

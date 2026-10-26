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
const { fechaNegocio, calcularIPCPeriodo } = require("../lib/ipc-cuotas.ts")
const { creditoDisponible, repartirPago, validarSaldoAFavor } = require("../lib/saldo-a-favor.ts")
let row, ledger, failLedger, consultas, queue = Promise.resolve()
const history = () => {
  const [anio, mes] = fechaNegocio().split("-").map(Number)
  return [{ mes: mes - 1, anio, porcentaje: 2 }]
}
const db = () => { throw new Error("Consulta fuera de la transacción") }
db.begin = (fn) => {
  const run = queue.then(async () => {
    const staged = structuredClone(row)
    const moves = structuredClone(ledger)
    const tx = async (parts, ...values) => {
      const query = parts.join("?"); consultas.push(query)
      if (query.includes("FROM historial_ipc")) return history()
      if (query.includes("FROM eventos")) return [staged]
      if (query.includes("INSERT INTO movimientos_caja")) {
        if (failLedger) throw new Error("Fallo de caja simulado")
        moves.push(values)
        return []
      }
      throw new Error(`Consulta inesperada: ${query}`)
    }
    tx.unsafe = async (query, values) => {
      consultas.push(query)
      for (const match of query.matchAll(/(plan_de_cuotas|pagos) = \$(\d+)/g)) staged[match[1]] = JSON.parse(values[Number(match[2]) - 1])
      return []
    }
    const response = await fn(tx)
    row = staged; ledger = moves
    return response
  })
  queue = run.catch(() => {})
  return run
}
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: db }
  if (request === "@/lib/activity-logger") return { logActivity: async () => {} }
  if (request === "@/lib/event-notifications") return { sendEventNotification: async () => {} }
  return load.call(this, request, ...args)
}
const { PATCH } = require("../app/api/eventos/[id]/route.ts")
Module._load = load

// ---------- Cuentas puras (lib/saldo-a-favor.ts) ----------

test("caso Guada y Daniel: pagan $1.021.000 por una cuota de $1.002.191 y sobran $18.809", () => {
  const r = repartirPago({ monto: 1021000, mora: 0, credito: 0, saldoCuota: 1002191, hayCuotaSiguiente: true })
  assert.deepEqual(r, { neto: 1002191, creditoAplicado: 0, saldoAFavor: 18809 })
})
test("el mes siguiente se descuenta lo que sobró y la base del IPC sigue siendo la cuota oficial", () => {
  // Cuota 4 en noviembre con 2 % sobre la cuota 3 oficial (1.002.191) = 1.022.235
  const cuota4 = Math.round(1002191 * 1.02)
  assert.equal(cuota4, 1022235)
  const r = repartirPago({ monto: cuota4 - 18809, mora: 0, credito: 18809, saldoCuota: cuota4, hayCuotaSiguiente: true })
  assert.deepEqual(r, { neto: 1022235, creditoAplicado: 18809, saldoAFavor: 0 })
  // El excedente no entra en la base: el IPC del mes siguiente parte de montoCuota.
  const evento = { estado: "pendiente", planDeCuotas: { ajustaPorIPC: true, numeroCuotas: 3, montoCuota: 100000, modalidadPago: "sena", cuotasPagadas: [1],
    cuotas: [{ numero: 1, pagada: true, montoCuota: 102000, montoPagadoNeto: 102000, fechaPagoReal: "2026-10-26" }, { numero: 2, pagada: false, montoCuota: 100000 }, { numero: 3, pagada: false, montoCuota: 100000 }] },
    pagos: [{ id: "a", numeroCuota: 1, fecha: "2026-10-26", monto: 130000, montoCuotaNeto: 102000, montoMora: 0, saldoAFavor: 28000,
      calculoIPC: { version: "ultima-cuota-v1", periodo: "2026-10", base: 100000, origen: "plan", porcentaje: 2, monto: 102000, aplicadoEsteMes: false } }] }
  const r2 = calcularIPCPeriodo(evento, [{ mes: 10, anio: 2026, porcentaje: 3 }], "2026-11-20")
  assert.equal(r2.estado, "listo"); assert.equal(r2.calculo.base, 102000); assert.equal(r2.calculo.monto, 105060)
})
test("saldo a favor: suma lo que sobró y resta lo usado; anular lo recalcula", () => {
  assert.equal(creditoDisponible([{ saldoAFavor: 18809 }, { creditoAplicado: 8809 }, { monto: 5 }]), 10000)
  assert.equal(creditoDisponible(undefined), 0)
  assert.equal(creditoDisponible([{ creditoAplicado: 8809 }]), -8809)
})
test("pago parcial con saldo a favor y saldo a favor más grande que la cuota", () => {
  assert.deepEqual(repartirPago({ monto: 50000, mora: 6000, credito: 10000, saldoCuota: 100000, hayCuotaSiguiente: true }),
    { neto: 54000, creditoAplicado: 10000, saldoAFavor: 0 })
  assert.deepEqual(repartirPago({ monto: 0, mora: 0, credito: 250000, saldoCuota: 100000, hayCuotaSiguiente: true }),
    { neto: 100000, creditoAplicado: 100000, saldoAFavor: 0 })
})
test("en la última cuota no puede sobrar, y la mora se cubre con efectivo", () => {
  assert.ok("error" in repartirPago({ monto: 120000, mora: 0, credito: 0, saldoCuota: 100000, hayCuotaSiguiente: false }))
  assert.ok("error" in repartirPago({ monto: 1000, mora: 6000, credito: 50000, saldoCuota: 100000, hayCuotaSiguiente: true }))
  assert.ok("error" in repartirPago({ monto: 6000, mora: 6000, credito: 0, saldoCuota: 100000, hayCuotaSiguiente: true }))
})
test("validarSaldoAFavor no toca pedidos que no cambian pagos ni el plan", () => {
  assert.equal(validarSaldoAFavor({ pagos: [{ saldoAFavor: 5 }] }, { nombre: "x" }), null)
})
test("sin pagos nuevos, marcar una cuota cobrada con saldo a favor se frena (botón rápido de Caja Eventos)", () => {
  const actual = { pagos: [{ id: "a", saldoAFavor: 5000 }], planDeCuotas: { cuotasPagadas: [1], cuotas: [{ numero: 1, pagada: true }, { numero: 2, pagada: false }] } }
  const updates = { planDeCuotas: { cuotasPagadas: [1, 2], cuotas: [{ numero: 1, pagada: true }, { numero: 2, pagada: true }] } }
  assert.match(validarSaldoAFavor(actual, updates), /saldo a favor/)
})

// ---------- Servidor (PATCH /api/eventos/[id]) ----------

function reset() {
  row = { id: "evento-test", salon: "Quinta", estado: "pendiente", pagos: [], plan_de_cuotas: {
    numeroCuotas: 3, montoCuota: 100000, montoTotal: 300000, ajustaPorIPC: true, cuotasPagadas: [],
    cuotas: [1, 2, 3].map(numero => ({ numero, montoCuota: 150000, pagada: false })),
  } }
  ledger = []; consultas = []; failLedger = false
}
// Cobro de la cuota "numero" con el monto en efectivo y el reparto dado. La
// cuota del mes es 102.000 (base 100.000 + 2 %).
function cobro(numero, { monto, neto = 102000, saldoAFavor, creditoAplicado }, suffix) {
  const fecha = fechaNegocio()
  const plan = structuredClone(row.plan_de_cuotas)
  plan.cuotasPagadas = [...new Set([...(plan.cuotasPagadas ?? []), numero])]
  const i = plan.cuotas.findIndex(c => c.numero === numero)
  plan.cuotas[i] = { ...plan.cuotas[i], pagada: true, estado: "pagada", montoCuota: 102000, montoPagadoNeto: neto, fechaPagoReal: fecha }
  const pago = { id: `p-${suffix}`, numeroCuota: numero, fecha, monto, montoCuotaNeto: neto, montoMora: 0,
    ...(saldoAFavor ? { saldoAFavor } : {}), ...(creditoAplicado ? { creditoAplicado } : {}) }
  const movimientos = monto > 0
    ? [{ id: `m1-${suffix}`, eventoId: row.id, salon: row.salon, tipo: "ingreso", monto, fecha, cajaDestino: "caja_eventos", concepto: "Cuota de prueba" }]
    : []
  return { planDeCuotas: plan, pagos: [...structuredClone(row.pagos), pago],
    _planEsperado: structuredClone(row.plan_de_cuotas), _pagosEsperados: structuredClone(row.pagos),
    _operacionCobro: movimientos.map(m => m.id).join(":"), _movimientosCobro: movimientos }
}
const patch = body => PATCH(new Request("http://localhost/api/eventos/evento-test", {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}), { params: Promise.resolve({ id: "evento-test" }) })

test("servidor: se cobra más que la cuota, entra todo a caja y lo que sobra queda a favor", async () => {
  reset()
  assert.equal((await patch(cobro(1, { monto: 130000, saldoAFavor: 28000 }, "a"))).status, 200)
  assert.equal(ledger.length, 1); assert.equal(ledger[0][2], 130000)
  assert.equal(row.plan_de_cuotas.cuotas[0].montoCuota, 102000)
  assert.equal(creditoDisponible(row.pagos), 28000)
})
test("servidor: la cuota siguiente tiene que usar el saldo a favor; en caja entra solo el efectivo", async () => {
  reset()
  assert.equal((await patch(cobro(1, { monto: 130000, saldoAFavor: 28000 }, "a"))).status, 200)
  // Sin descontarlo: se rechaza.
  const sinDescontar = await patch(cobro(2, { monto: 102000 }, "b"))
  assert.equal(sinDescontar.status, 409)
  assert.match((await sinDescontar.json()).error, /saldo a favor cambió/)
  assert.equal(row.pagos.length, 1)
  assert.equal((await patch(cobro(2, { monto: 74000, creditoAplicado: 28000 }, "c"))).status, 200)
  assert.equal(ledger.length, 2); assert.equal(ledger[1][2], 74000)
  assert.equal(creditoDisponible(row.pagos), 0)
  assert.equal(row.plan_de_cuotas.cuotas[1].pagada, true)
})
test("servidor: el monto tiene que cerrar con cuota, mora y saldo a favor", async () => {
  reset()
  assert.equal((await patch(cobro(1, { monto: 130000, saldoAFavor: 20000 }, "a"))).status, 409)
  assert.equal(row.pagos.length, 0); assert.equal(ledger.length, 0)
})
test("servidor: en la última cuota no puede sobrar plata", async () => {
  reset()
  row.plan_de_cuotas.numeroCuotas = 1
  row.plan_de_cuotas.cuotas = [{ numero: 1, montoCuota: 150000, pagada: false }]
  assert.equal((await patch(cobro(1, { monto: 130000, saldoAFavor: 28000 }, "a"))).status, 409)
  assert.equal(row.pagos.length, 0)
})
test("servidor: una cuota cubierta entera con saldo a favor se cobra sin efectivo ni movimientos", async () => {
  reset()
  assert.equal((await patch(cobro(1, { monto: 204000, saldoAFavor: 102000 }, "a"))).status, 200)
  assert.equal((await patch(cobro(2, { monto: 0, creditoAplicado: 102000 }, "b"))).status, 200)
  assert.equal(ledger.length, 1)
  assert.equal(row.plan_de_cuotas.cuotas[1].pagada, true)
  assert.equal(creditoDisponible(row.pagos), 0)
})
test("servidor: no se anula un pago cuyo excedente ya se usó", async () => {
  reset()
  await patch(cobro(1, { monto: 130000, saldoAFavor: 28000 }, "a"))
  await patch(cobro(2, { monto: 74000, creditoAplicado: 28000 }, "c"))
  const plan = structuredClone(row.plan_de_cuotas)
  const r = await patch({ planDeCuotas: plan, pagos: row.pagos.filter(p => p.id !== "p-a"),
    _planEsperado: structuredClone(row.plan_de_cuotas), _pagosEsperados: structuredClone(row.pagos) })
  assert.equal(r.status, 409)
  assert.match((await r.json()).error, /ya se usó/)
  assert.equal(row.pagos.length, 2)
})

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
const { fechaNegocio } = require("../lib/ipc-cuotas.ts")
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
function reset() {
  row = { id: "evento-test", salon: "Quinta", estado: "pendiente", pagos: [], plan_de_cuotas: {
    numeroCuotas: 3, montoCuota: 100000, montoTotal: 300000, ajustaPorIPC: true, cuotasPagadas: [],
    cuotas: [1, 2, 3].map(numero => ({ numero, montoCuota: 150000, pagada: false })),
  } }
  ledger = []; consultas = []; failLedger = false
}
function payload(suffix = "a") {
  const fecha = fechaNegocio()
  const plan = structuredClone(row.plan_de_cuotas)
  plan.cuotasPagadas = [1]
  plan.cuotas[0] = { ...plan.cuotas[0], pagada: true, montoCuota: 102000, montoPagadoNeto: 102000, fechaPagoReal: fecha }
  return { planDeCuotas: plan, pagos: [{ id: `p-${suffix}`, numeroCuota: 1, fecha, monto: 108000, montoCuotaNeto: 102000, montoMora: 6000 }],
    _planEsperado: structuredClone(row.plan_de_cuotas), _pagosEsperados: [], _operacionCobro: `m1-${suffix}:m2-${suffix}`,
    _movimientosCobro: ["caja_eventos", "caja_jazmines"].map((cajaDestino, i) => ({ id: `m${i + 1}-${suffix}`, eventoId: row.id, salon: row.salon,
      tipo: "ingreso", monto: 54000, fecha, cajaDestino, concepto: "Cuota de prueba" })),
  }
}
const patch = body => PATCH(new Request("http://localhost/api/eventos/evento-test", {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}), { params: Promise.resolve({ id: "evento-test" }) })

test("servidor confirma cuota, auditoría y dos movimientos en una transacción", async () => {
  reset(); assert.equal((await patch(payload())).status, 200)
  assert.equal(ledger.length, 2)
  assert.equal(row.pagos[0].calculoIPC.base, 100000)
  assert.equal(row.pagos[0].calculoIPC.monto, 102000)
  assert.ok(consultas.some(q => q.includes("FOR UPDATE")))
  assert.ok(consultas.some(q => q.includes("FOR SHARE")))
})
test("dos operadores no cobran dos veces la misma cuota", async () => {
  reset(); const a = payload("a"), b = payload("b")
  const responses = await Promise.all([patch(a), patch(b)])
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409])
  assert.equal(row.pagos.length, 1); assert.equal(ledger.length, 2)
})
test("reintento de la misma operación es idempotente", async () => {
  reset(); const p = payload()
  assert.equal((await patch(p)).status, 200)
  assert.equal((await patch(p)).status, 200)
  assert.equal(ledger.length, 2); assert.equal(row.pagos.length, 1)
})
test("fallo al insertar caja revierte también el pago y la cuota", async () => {
  reset(); const original = structuredClone(row); failLedger = true
  const oldError = console.error; console.error = () => {}
  try { assert.equal((await patch(payload())).status, 500) } finally { console.error = oldError }
  assert.deepEqual(row, original); assert.equal(ledger.length, 0)
})
test("monto manipulado y lote incoherente no escriben", async () => {
  reset(); const p = payload(); p.planDeCuotas.cuotas[0].montoCuota = 1
  assert.equal((await patch(p)).status, 409); assert.equal(ledger.length, 0)
  const q = payload(); q._movimientosCobro[0].monto++
  assert.equal((await patch(q)).status, 400); assert.equal(ledger.length, 0)
  assert.equal(row.pagos.length, 0)
})
test("cuota ajustable no se confirma sin movimientos", async () => {
  reset(); const p = payload(); delete p._movimientosCobro
  assert.equal((await patch(p)).status, 400)
  assert.equal(row.pagos.length, 0)
})

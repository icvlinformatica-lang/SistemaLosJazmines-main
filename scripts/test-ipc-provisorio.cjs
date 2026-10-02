// IPC provisorio: "se aplica el último IPC publicado al día del cobro".
// Correr: node --test scripts/test-ipc-provisorio.cjs
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
const { calcularIPCPeriodo, resolverCalculoCobro, indiceParaPeriodo, sugerirBaseManual } = require("../lib/ipc-cuotas.ts")
const { validarCobroIPC } = require("../lib/validar-cobro-ipc.ts")

// mes es 0-based (como en historial_ipc): 8 = septiembre
const ipc = (mes, porcentaje, extra = {}) => ({ mes, anio: 2026, porcentaje, fechaAplicacion: "2026-01-01T00:00:00Z", eventosActualizados: 0, ...extra })
const historial = [ipc(6, 1.9), ipc(7, 2.1), ipc(8, 1.7)] // julio, agosto, septiembre
const evento = (patch = {}) => ({
  estado: "pendiente",
  pagos: [],
  planDeCuotas: {
    ajustaPorIPC: true, numeroCuotas: 3, modalidadPago: "cuotas", montoCuota: 100000, montoTotal: 300000,
    cuotasPagadas: [],
    cuotas: [1, 2, 3].map((numero) => ({ numero, montoCuota: 100000, fechaVencimiento: `2026-${String(9 + numero).padStart(2, "0")}-10` })),
  },
  ...patch,
})
const listo = (r) => { assert.equal(r.estado, "listo", r.motivo); return r.calculo }

test("mes CON IPC cargado: usa el del mes, sin marca de provisorio (igual que antes)", () => {
  const c = listo(calcularIPCPeriodo(evento(), historial, "2026-09-15"))
  assert.equal(c.porcentaje, 1.7)
  assert.equal(c.monto, 101700)
  assert.equal(c.periodo, "2026-09")
  assert.equal("ipcProvisorio" in c, false)
  assert.equal("periodoIndice" in c, false)
})

test("mes SIN IPC con uno anterior: usa el último publicado, marcado provisorio", () => {
  const c = listo(calcularIPCPeriodo(evento(), historial, "2026-10-10"))
  assert.equal(c.porcentaje, 1.7) // septiembre
  assert.equal(c.monto, 101700)
  assert.equal(c.periodo, "2026-10") // el período del COBRO no cambia
  assert.equal(c.ipcProvisorio, true)
  assert.equal(c.periodoIndice, "2026-09")
})

test("nunca usa el IPC de un mes POSTERIOR al del cobro", () => {
  // Cobro de junio (sin IPC) con julio/agosto/septiembre cargados: no hay anterior → pendiente
  const r = calcularIPCPeriodo(evento(), historial, "2026-06-20")
  assert.equal(r.estado, "pendiente")
  // Con mayo cargado, usa mayo aunque existan meses posteriores
  const c = listo(calcularIPCPeriodo(evento(), [...historial, ipc(4, 3.3)], "2026-06-20"))
  assert.equal(c.porcentaje, 3.3)
  assert.equal(c.periodoIndice, "2026-05")
})

test("mes sin NINGÚN IPC anterior: sigue pendiente, con el mismo mensaje de hoy", () => {
  const r = calcularIPCPeriodo(evento(), [], "2026-10-10")
  assert.deepEqual(r, { estado: "pendiente", motivo: "IPC de 2026-10 pendiente de definición o duplicado. Cargá un único índice antes de cobrar." })
})

test("mes con índices DUPLICADOS: sigue pendiente (no cae al anterior)", () => {
  const r = calcularIPCPeriodo(evento(), [...historial, ipc(9, 2), ipc(9, 2.2)], "2026-10-10")
  assert.equal(r.estado, "pendiente")
  assert.match(r.motivo, /duplicado/)
})

test("último anterior duplicado: pendiente (no elige uno al azar)", () => {
  assert.equal(calcularIPCPeriodo(evento(), [ipc(8, 1.7), ipc(8, 1.8)], "2026-10-10").estado, "pendiente")
})

test("IPC del mes cargado a mano como provisorio: se usa y queda marcado con su propio período", () => {
  const c = listo(calcularIPCPeriodo(evento(), [...historial, ipc(9, 2.5, { provisorio: true })], "2026-10-10"))
  assert.equal(c.porcentaje, 2.5)
  assert.equal(c.ipcProvisorio, true)
  assert.equal(c.periodoIndice, "2026-10")
})

test("indiceParaPeriodo: casos directos", () => {
  assert.deepEqual(indiceParaPeriodo(historial, "2026-09"), { porcentaje: 1.7, periodoIndice: "2026-09", provisorio: false })
  assert.deepEqual(indiceParaPeriodo(historial, "2027-01"), { porcentaje: 1.7, periodoIndice: "2026-09", provisorio: true })
  assert.equal(indiceParaPeriodo(historial, "2026-05"), null)
  assert.equal(indiceParaPeriodo(historial, "basura"), null)
})

test("cadena de bases intacta: la base sigue siendo la cifra oficial de la última cuota pagada", () => {
  const ev = evento({
    pagos: [{ id: "p1", monto: 101700, fecha: "2026-09-15", numeroCuota: 1, montoCuotaNeto: 101700 }],
  })
  ev.planDeCuotas.cuotas[0] = { ...ev.planDeCuotas.cuotas[0], pagada: true, montoCuota: 101700, montoPagadoNeto: 101700, fechaPagoReal: "2026-09-15" }
  const c = listo(calcularIPCPeriodo(ev, historial, "2026-10-12"))
  assert.equal(c.base, 101700)
  assert.equal(c.origen, "pago")
  assert.equal(c.cuotaOrigen, 1)
  assert.equal(c.monto, Math.round(101700 * 1.017))
  assert.equal(c.ipcProvisorio, true)
})

test("segunda cuota en el mismo mes: la marca es la del índice de HOY (si ya se cargó el oficial, deja de ser provisorio)", () => {
  // Cuota 1 cobrada el 10/10 con provisorio (septiembre 1,7%)
  const foto = listo(calcularIPCPeriodo(evento(), historial, "2026-10-10"))
  const ev = evento({ pagos: [{ id: "p1", monto: foto.monto, fecha: "2026-10-10", numeroCuota: 1, montoCuotaNeto: foto.monto, calculoIPC: foto }] })
  ev.planDeCuotas.cuotas[0] = { ...ev.planDeCuotas.cuotas[0], pagada: true, montoCuota: foto.monto, montoPagadoNeto: foto.monto, fechaPagoReal: "2026-10-10", calculoIPC: foto }
  // Sin oficial todavía: sigue provisorio
  assert.equal(listo(calcularIPCPeriodo(ev, historial, "2026-10-20")).ipcProvisorio, true)
  // Con el oficial de octubre cargado: usa el oficial y sin marca
  const c = listo(calcularIPCPeriodo(ev, [...historial, ipc(9, 2.3)], "2026-10-20"))
  assert.equal(c.porcentaje, 2.3)
  assert.equal(c.aplicadoEsteMes, true)
  assert.equal("ipcProvisorio" in c, false)
})

test("resolverCalculoCobro conserva la marca (con IPC, con base manual y con el IPC destildado)", () => {
  const conIPC = resolverCalculoCobro(evento(), historial, "2026-10-10", { aplicarIPC: true }).calculo
  assert.equal(conIPC.ipcProvisorio, true)
  const manual = resolverCalculoCobro(evento(), historial, "2026-10-10", { aplicarIPC: true, baseManual: 90000 }).calculo
  assert.deepEqual([manual.origen, manual.monto, manual.ipcProvisorio, manual.periodoIndice], ["manual", Math.round(90000 * 1.017), true, "2026-09"])
  const sinIPC = resolverCalculoCobro(evento(), historial, "2026-10-10", { aplicarIPC: false }).calculo
  assert.deepEqual([sinIPC.monto, sinIPC.ipcOmitido], [100000, true])
})

test("sugerencia manual (cálculo automático pendiente por otro motivo) también usa el último publicado", () => {
  const s = sugerirBaseManual(evento(), historial, "2026-10-10")
  assert.deepEqual([s.porcentaje, s.ipcProvisorio, s.periodoIndice], [1.7, true, "2026-09"])
})

test("el servidor acepta un cobro con IPC provisorio y guarda la marca en la cuota y en el pago", () => {
  const actual = evento()
  const calculo = resolverCalculoCobro(actual, historial, "2026-10-01", { aplicarIPC: true }).calculo
  const pago = { id: "p1", monto: calculo.monto, fecha: "2026-10-01", numeroCuota: 1, montoCuotaNeto: calculo.monto, montoMora: 0, calculoIPC: calculo }
  const planDeCuotas = JSON.parse(JSON.stringify(actual.planDeCuotas))
  planDeCuotas.cuotas[0].montoCuota = calculo.monto
  const updates = { pagos: [pago], planDeCuotas }
  assert.equal(validarCobroIPC(actual, updates, historial), null)
  assert.equal(updates.planDeCuotas.cuotas[0].calculoIPC.ipcProvisorio, true)
  assert.equal(pago.calculoIPC.periodoIndice, "2026-09")
  assert.equal(pago.porcentajeIPC, 1.7)
})

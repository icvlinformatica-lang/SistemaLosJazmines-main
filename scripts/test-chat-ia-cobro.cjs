// Cobro de una cuota desde el chat con IA: la IA solo propone (con las
// mismas cuentas que Cobrar cuota); el cobro lo hace el botón por el mismo
// camino de siempre (PATCH /api/eventos/[id]) y /api/chat/cobro solo marca la
// tarjeta después de verificar que el pago está en el evento.
// Todo con datos inventados y base simulada: no se toca la base real.
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
require.extensions[".ts"] = (mod, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  mod._compile(result.outputText, filename)
}
// La ruta de cobro pide la sesión de quien cobra; el chat es de Administración (lib/permisos-escritura.ts).
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "secreto-de-prueba"
const { signToken } = require("../lib/auth/server.ts")

const { armarPropuestaCobro, armarCobroDesdePropuesta, opcionesCobroChat, eventoCobroDesdeFila, propuestaCobroValida } = require("../lib/chat-ia-cobro.ts")
const { fechaNegocio, proyectarIPC } = require("../lib/ipc-cuotas.ts")
const { generarCalendarioCuotas } = require("../lib/store.ts")
const { generarCalendarioCuotas: calendarioServidor } = require("../lib/calendario-cuotas.ts")

const HOY = "2026-10-13"

// Evento inventado: 4 cuotas de $175.000, la 1 pagada. Hoy 13/10/2026 la 2
// venció el 10/9 (33 días de atraso → recargo $99.000).
function eventoFijo(extra = {}) {
  return {
    id: "ev-prueba",
    nombre: "PRUEBA Casamiento",
    nombrePareja: "PRUEBA Ana y Juan",
    fecha: "2026-12-05",
    salon: "Casona",
    estado: "pendiente",
    dniNovio1: "12345678",
    planDeCuotas: {
      montoTotal: 1000000, modalidadPago: "sena", montoSena: 300000, numeroCuotas: 4, montoCuota: 175000,
      fechaInicioPlan: "2026-08-10", diaVencimiento: 10, cuotasPagadas: [1],
      cuotas: [1, 2, 3, 4].map((n) => ({
        numero: n, montoCuota: 175000, fechaVencimiento: `2026-${String(7 + n).padStart(2, "0")}-10`,
        ...(n === 1 ? { pagada: true, montoPagadoNeto: 175000, estado: "pagada" } : {}),
      })),
    },
    pagos: [{ id: "pago-1", monto: 175000, fecha: "2026-08-10", numeroCuota: 1, pagadoPor: "Ana", porcentajeIPC: 0, montoCuotaNeto: 175000 }],
    ...extra,
  }
}

const entradaBase = { numeroCuota: 2, cobrarRecargo: true, pagaCompleto: true, pagadoPor: "Marta", recibidoPor: "Leila" }

test("el calendario de cuotas es el mismo desde el store y desde el servidor", () => {
  assert.equal(generarCalendarioCuotas, calendarioServidor)
  assert.deepEqual(calendarioServidor(eventoFijo()).map((c) => [c.numeroCuota, c.estado, c.fechaVencimiento, c.monto]), [
    [1, "pagada", "2026-08-10", 175000],
    [2, "pendiente", "2026-09-10", 175000],
    [3, "pendiente", "2026-10-10", 175000],
    [4, "pendiente", "2026-11-10", 175000],
  ])
})

test("opciones: la cuota que sigue, con su atraso y el recargo de $3.000 por día", () => {
  const r = opcionesCobroChat(eventoFijo(), [], HOY)
  assert.equal(r.ok, true)
  assert.equal(r.opciones.length, 1)
  const o = r.opciones[0]
  assert.equal(o.numeroCuota, 2)
  assert.equal(o.totalCuotas, 4)
  assert.equal(o.estado, "pendiente")
  assert.equal(o.vencimiento, "2026-09-10")
  assert.equal(o.falta, 175000)
  assert.equal(o.diasAtraso, 33)
  assert.equal(o.recargoPorAtraso, 99000)
  assert.equal(o.totalConRecargo, 274000)
  assert.equal(o.ipc, null)
  // Nada de DNI en lo que va a la IA.
  assert.doesNotMatch(JSON.stringify(r), /12345678|dni/i)
})

test("opciones: una cuota con pago parcial aparece aparte, por lo que le falta y sin recargo", () => {
  const ev = eventoFijo()
  ev.planDeCuotas.cuotas[1] = { ...ev.planDeCuotas.cuotas[1], montoPagadoNeto: 100000, estado: "parcial", saldoDecision: "aparte", recargoSaldo: "congelado" }
  ev.pagos.push({ id: "pago-2", monto: 100000, fecha: "2026-09-12", numeroCuota: 2, pagadoPor: "Ana", porcentajeIPC: 0, montoCuotaNeto: 100000 })
  const r = opcionesCobroChat(ev, [], HOY)
  assert.deepEqual(r.opciones.map((o) => [o.numeroCuota, o.estado, o.falta, o.recargoPorAtraso, o.yaPagado]), [
    [3, "pendiente", 175000, 9000, 0],
    [2, "parcial", 75000, 0, 100000],
  ])
  const p = armarPropuestaCobro(ev, [], HOY, { ...entradaBase, numeroCuota: 2 }, "prop-parcial")
  assert.equal(p.ok, true)
  assert.equal(p.propuesta.monto, 75000)
  assert.equal(p.propuesta.recargo, 0)
  assert.equal(p.propuesta.yaPagado, 100000)
  assert.equal(p.propuesta.esSaldoDeCuota, true)
  assert.equal(p.propuesta.quedaCompleta, true)
})

test("propuesta: paga completo con recargo ($274.000) o con el recargo perdonado ($175.000)", () => {
  const con = armarPropuestaCobro(eventoFijo(), [], HOY, entradaBase, "prop-1")
  assert.equal(con.ok, true)
  assert.equal(con.propuesta.monto, 274000)
  assert.equal(con.propuesta.neto, 175000)
  assert.equal(con.propuesta.recargo, 99000)
  assert.equal(con.propuesta.recargoPerdonado, 0)
  assert.equal(con.propuesta.quedaCompleta, true)
  assert.equal(con.propuesta.saldoQueQueda, 0)
  assert.equal(con.propuesta.estado, "pendiente")
  assert.equal(con.propuesta.calculadoEl, HOY)
  assert.equal(con.propuesta.evento, "PRUEBA Ana y Juan")
  assert.ok(propuestaCobroValida(JSON.parse(JSON.stringify(con.propuesta))))

  const sin = armarPropuestaCobro(eventoFijo(), [], HOY, { ...entradaBase, cobrarRecargo: false }, "prop-2")
  assert.equal(sin.propuesta.monto, 175000)
  assert.equal(sin.propuesta.recargo, 0)
  assert.equal(sin.propuesta.recargoPerdonado, 99000)
})

test("propuesta: las cuotas se cobran en orden y lo que falta se pregunta", () => {
  const motivo = (entrada, ev = eventoFijo()) => {
    const r = armarPropuestaCobro(ev, [], HOY, entrada, "x")
    assert.equal(r.ok, false)
    return r.motivo
  }
  assert.match(motivo({ ...entradaBase, numeroCuota: 3 }), /primero va la cuota 2/)
  assert.match(motivo({ ...entradaBase, numeroCuota: 1 }), /ya está paga/)
  assert.match(motivo({ ...entradaBase, numeroCuota: 9 }), /no tiene cuota 9/)
  assert.match(motivo({ ...entradaBase, pagaCompleto: undefined }), /completa o una parte/)
  assert.match(motivo({ ...entradaBase, cobrarRecargo: undefined }), /recargo/)
  assert.match(motivo({ ...entradaBase, pagadoPor: " " }), /quién paga/)
  assert.match(motivo({ ...entradaBase, recibidoPor: "" }), /quién recibe/)
  assert.match(motivo({ ...entradaBase, pagaCompleto: false }), /cuánto paga/)
  assert.match(motivo(entradaBase, eventoFijo({ estado: "completado" })), /finalizado/)
  assert.match(motivo(entradaBase, eventoFijo({ salon: "" })), /salón/)
  assert.match(motivo(entradaBase, eventoFijo({ planDeCuotas: undefined })), /no tiene cuota/)
})

test("propuesta: pago parcial pide qué pasa con el saldo; no puede pasarse ni quedar en el recargo", () => {
  const parcial = { ...entradaBase, pagaCompleto: false, monto: 199000 }
  const sinDecidir = armarPropuestaCobro(eventoFijo(), [], HOY, parcial, "x")
  assert.equal(sinDecidir.ok, false)
  assert.match(sinDecidir.motivo, /cuota siguiente o queda aparte/)

  const r = armarPropuestaCobro(eventoFijo(), [], HOY, { ...parcial, saldoRestante: "acumular", ipcDelSaldo: "congelado" }, "x")
  assert.equal(r.ok, true)
  // $199.000 entregados: $99.000 de recargo y $100.000 a la cuota; quedan $75.000.
  assert.equal(r.propuesta.neto, 100000)
  assert.equal(r.propuesta.saldoQueQueda, 75000)
  assert.equal(r.propuesta.quedaCompleta, false)
  assert.equal(r.propuesta.saldoDecision, "acumular")
  assert.equal(r.propuesta.recargoSaldo, "congelado")

  const demasiado = armarPropuestaCobro(eventoFijo(), [], HOY, { ...parcial, monto: 300000 }, "x")
  assert.match(demasiado.motivo, /supera lo que falta/)
  const soloRecargo = armarPropuestaCobro(eventoFijo(), [], HOY, { ...parcial, monto: 99000 }, "x")
  assert.match(soloRecargo.motivo, /mayor al recargo/)
})

test("propuesta: vuelto si paga con más; si no alcanza, avisa", () => {
  const r = armarPropuestaCobro(eventoFijo(), [], HOY, { ...entradaBase, pagaCon: 300000 }, "x")
  assert.equal(r.propuesta.pagaCon, 300000)
  assert.equal(r.propuesta.vuelto, 26000)
  const justo = armarPropuestaCobro(eventoFijo(), [], HOY, { ...entradaBase, pagaCon: 274000 }, "x")
  assert.equal(justo.propuesta.vuelto, undefined)
  const corto = armarPropuestaCobro(eventoFijo(), [], HOY, { ...entradaBase, pagaCon: 200000 }, "x")
  assert.match(corto.motivo, /no alcanza/)
})

// Con IPC: cuota 1 pagada a $175.000 y un IPC de octubre del 2 % → la cuota 2 vale $178.500.
function eventoIPC(extra = {}) {
  const ev = eventoFijo(extra)
  ev.planDeCuotas = { ...ev.planDeCuotas, ajustaPorIPC: true, modalidadPago: "cuotas", montoSena: 0 }
  return ev
}

test("IPC: la cuota se calcula con el último pago y el índice del mes en que venció (oficial o provisorio)", () => {
  // La cuota 2 venció en septiembre y se cobra en octubre: lleva el IPC de
  // septiembre (regla vencimiento-v2), no el de octubre.
  const oficial = [{ mes: 8, anio: 2026, porcentaje: 2, fechaAplicacion: "", eventosActualizados: 0 },
    { mes: 9, anio: 2026, porcentaje: 5, fechaAplicacion: "", eventosActualizados: 0 }]
  const o = opcionesCobroChat(proyectarIPC(eventoIPC(), oficial, HOY), oficial, HOY).opciones[0]
  assert.equal(o.montoCuota, 178500)
  assert.equal(o.totalConRecargo, 277500)
  assert.deepEqual(o.ipc, { porcentaje: 2, periodo: "2026-09", provisorio: false })

  // Sin índice de septiembre se usa el último publicado antes (agosto, 3 %), marcado provisorio.
  const septiembre = [{ mes: 7, anio: 2026, porcentaje: 3, fechaAplicacion: "", eventosActualizados: 0 }]
  const p = armarPropuestaCobro(proyectarIPC(eventoIPC(), septiembre, HOY), septiembre, HOY, entradaBase, "x")
  assert.equal(p.propuesta.montoCuota, 180250)
  assert.equal(p.propuesta.monto, 279250)
  assert.equal(p.propuesta.ipc.provisorio, true)
})

test("IPC: si falta el índice, por el chat no se cobra y se manda a Cobrar cuota", () => {
  const o = opcionesCobroChat(eventoIPC(), [], HOY).opciones[0]
  assert.match(o.noSePuede, /Cobrar cuota/)
  const r = armarPropuestaCobro(eventoIPC(), [], HOY, entradaBase, "x")
  assert.equal(r.ok, false)
  assert.match(r.motivo, /Cobrar cuota/)
})

test("al confirmar: arma el pago y la cuota como Cobrar cuota, con el DNI del evento solo en el pago", () => {
  const ev = eventoFijo()
  const prop = armarPropuestaCobro(ev, [], HOY, { ...entradaBase, pagaCon: 300000 }, "0123456789abcdef").propuesta
  const r = armarCobroDesdePropuesta(ev, [], HOY, prop)
  assert.equal(r.ok, true)
  const { pago, pagos, planDeCuotas, planCuotas, montoTotalPlan, etiquetaCaja } = r.cobro
  assert.deepEqual(
    { id: pago.id, monto: pago.monto, fecha: pago.fecha, numeroCuota: pago.numeroCuota, neto: pago.montoCuotaNeto, mora: pago.montoMora, pagadoPor: pago.pagadoPor, recibidoPor: pago.recibidoPor, dni: pago.dni, montoRecibido: pago.montoRecibido, vuelto: pago.vuelto },
    { id: "0123456789abcdef", monto: 274000, fecha: HOY, numeroCuota: 2, neto: 175000, mora: 99000, pagadoPor: "Marta", recibidoPor: "Leila", dni: "12345678", montoRecibido: 300000, vuelto: 26000 },
  )
  // Mismas notas que arma Cobrar cuota (las lee el recibo y el cálculo de IPC de pagos viejos).
  assert.equal(pago.notas, "Cuota 2/4 + recargo por atraso $ 99.000 (33 días x $ 3.000)")
  assert.equal(pagos.length, 2)
  assert.deepEqual(planDeCuotas.cuotasPagadas, [1, 2])
  const c2 = planDeCuotas.cuotas.find((c) => c.numero === 2)
  assert.deepEqual([c2.pagada, c2.estado, c2.montoCuota, c2.montoPagadoNeto, c2.fechaPagoReal], [true, "pagada", 175000, 175000, HOY])
  assert.equal(planCuotas, 4)
  assert.equal(montoTotalPlan, 1000000)
  assert.equal(etiquetaCaja, "Cuota 2 #01234567")
  // No toca el evento original.
  assert.equal(ev.pagos.length, 1)
})

test("al confirmar un pago parcial: la cuota queda parcial con la decisión sobre el saldo", () => {
  const ev = eventoFijo()
  const prop = armarPropuestaCobro(ev, [], HOY, { ...entradaBase, cobrarRecargo: false, pagaCompleto: false, monto: 100000, saldoRestante: "aparte", ipcDelSaldo: "acumula" }, "p").propuesta
  const r = armarCobroDesdePropuesta(ev, [], HOY, prop)
  const c2 = r.cobro.planDeCuotas.cuotas.find((c) => c.numero === 2)
  assert.deepEqual([c2.pagada, c2.estado, c2.montoPagadoNeto, c2.saldoDecision, c2.recargoSaldo], [false, "parcial", 100000, "aparte", "acumula"])
  assert.deepEqual(r.cobro.planDeCuotas.cuotasPagadas, [1])
  assert.equal(r.cobro.pago.notas, "Cuota 2/4")
  assert.equal(r.cobro.pago.montoMora, 0)
})

test("al confirmar: si algo cambió desde la propuesta, no cobra", () => {
  const prop = armarPropuestaCobro(eventoFijo(), [], HOY, entradaBase, "p").propuesta
  // Otro día: cambian el recargo y el IPC.
  assert.match(armarCobroDesdePropuesta(eventoFijo(), [], "2026-10-14", prop).motivo, /otro día/)
  // Alguien cobró la cuota 2 entretanto.
  const cobrada = eventoFijo()
  cobrada.planDeCuotas.cuotasPagadas = [1, 2]
  cobrada.planDeCuotas.cuotas[1] = { ...cobrada.planDeCuotas.cuotas[1], pagada: true, montoPagadoNeto: 175000 }
  assert.equal(armarCobroDesdePropuesta(cobrada, [], HOY, prop).ok, false)
  // Le cargaron un pago parcial entretanto: el monto ya no es el mismo.
  const parcial = eventoFijo()
  parcial.planDeCuotas.cuotas[1] = { ...parcial.planDeCuotas.cuotas[1], montoPagadoNeto: 50000, estado: "parcial", saldoDecision: "aparte", recargoSaldo: "congelado" }
  assert.equal(armarCobroDesdePropuesta(parcial, [], HOY, prop).ok, false)
  // Ya está registrado (un toque anterior).
  const yaEsta = eventoFijo()
  yaEsta.pagos.push({ id: "p", monto: 274000, fecha: HOY, numeroCuota: 2, pagadoPor: "Marta", porcentajeIPC: 0 })
  assert.match(armarCobroDesdePropuesta(yaEsta, [], HOY, prop).motivo, /ya está registrado/)
})

test("fila de la base → evento: lee los JSON guardados como texto y no copia el DNI", () => {
  const ev = eventoCobroDesdeFila({
    id: "ev-prueba", nombre: "PRUEBA", nombre_pareja: "PRUEBA Ana y Juan", fecha: "2026-12-05", salon: "Casona", estado: "pendiente",
    plan_de_cuotas: JSON.stringify(eventoFijo().planDeCuotas), pagos: JSON.stringify(eventoFijo().pagos), dni_novio1: "12345678",
  })
  assert.equal(ev.planDeCuotas.numeroCuotas, 4)
  assert.equal(ev.pagos.length, 1)
  assert.equal(ev.dniNovio1, undefined)
  assert.equal(armarPropuestaCobro(ev, [], HOY, entradaBase, "x").propuesta.monto, 274000)
})

// ---- De punta a punta con la ruta real de cobro (PATCH /api/eventos/[id]) ----
// Igual que test-cobro-ipc-api.cjs: base simulada dentro de una transacción.
let fila, ledger, consultasPatch
const IPC_HOY = () => {
  const [anio, mes] = fechaNegocio().split("-").map(Number)
  return [{ mes: mes - 1, anio, porcentaje: 2, fechaAplicacion: "", eventosActualizados: 0 }]
}
const dbPatch = () => { throw new Error("Consulta fuera de la transacción") }
dbPatch.begin = async (fn) => {
  const staged = structuredClone(fila)
  const moves = structuredClone(ledger)
  const tx = async (parts, ...values) => {
    const query = parts.join("?")
    consultasPatch.push(query)
    if (query.includes("FROM historial_ipc")) return IPC_HOY()
    if (query.includes("FROM eventos")) return [staged]
    if (query.includes("INSERT INTO movimientos_caja")) { moves.push(values); return [] }
    throw new Error(`Consulta inesperada: ${query}`)
  }
  tx.unsafe = async (query, values) => {
    for (const m of query.matchAll(/(plan_de_cuotas|pagos) = \$(\d+)/g)) staged[m[1]] = JSON.parse(values[Number(m[2]) - 1])
    return []
  }
  const r = await fn(tx)
  fila = staged
  ledger = moves
  return r
}
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: dbPatch }
  if (request === "@/lib/activity-logger") return { logActivity: async () => {} }
  if (request === "@/lib/event-notifications") return { sendEventNotification: async () => {} }
  return load.call(this, request, ...args)
}
const { PATCH } = require("../app/api/eventos/[id]/route.ts")
Module._load = load
const { repartirEntreCajas } = require("../lib/cobrar-cuota.ts")

test("de punta a punta: lo que arma el chat lo acepta el servidor de Cobrar cuota, con IPC, y un reintento no duplica", async () => {
  const hoy = fechaNegocio()
  const ev = eventoIPC()
  // Cuota 2 vence hoy: sin recargo. La 1 se pagó el mes pasado.
  const [a, m] = hoy.split("-").map(Number)
  const mesPasado = `${m === 1 ? a - 1 : a}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-01`
  ev.planDeCuotas.cuotas = ev.planDeCuotas.cuotas.map((c) => (c.numero === 2 ? { ...c, fechaVencimiento: hoy } : c.numero === 1 ? { ...c, fechaPagoReal: mesPasado } : c))
  ev.pagos = [{ ...ev.pagos[0], fecha: mesPasado }]
  fila = { id: ev.id, nombre: ev.nombre, salon: ev.salon, estado: ev.estado, plan_de_cuotas: structuredClone(ev.planDeCuotas), pagos: structuredClone(ev.pagos) }
  ledger = []
  consultasPatch = []

  const hist = IPC_HOY()
  const visto = proyectarIPC(ev, hist, hoy)
  const prop = armarPropuestaCobro(visto, hist, hoy, entradaBase, "e2e-0000-1111").propuesta
  assert.equal(prop.monto, 178500)
  const { cobro } = armarCobroDesdePropuesta(visto, hist, hoy, prop)
  // Reparto entre cajas como construirMovimientosPago (acá con una proporción fija).
  const { montoEventos, montoJazmines } = repartirEntreCajas(cobro.pago.monto, 0.4)
  const movimientos = [["caja_eventos", montoEventos], ["caja_jazmines", montoJazmines]].map(([cajaDestino, monto], i) => ({
    id: `mov-${i}`, fecha: new Date().toISOString(), tipo: "ingreso", concepto: `${cobro.etiquetaCaja} - PRUEBA`, monto,
    salon: ev.salon, eventoId: ev.id, cajaDestino,
  }))
  // El mismo cuerpo que manda updateEvento del store.
  const body = {
    pagos: cobro.pagos, planCuotas: cobro.planCuotas, montoTotalPlan: cobro.montoTotalPlan, planDeCuotas: cobro.planDeCuotas,
    _planEsperado: ev.planDeCuotas, _pagosEsperados: ev.pagos,
    _movimientosCobro: movimientos, _operacionCobro: movimientos.map((x) => x.id).join(":"),
  }
  const sesion = await signToken("administracion")
  const patch = () => PATCH(new Request("http://localhost/api/eventos/ev-prueba", {
    method: "PATCH", headers: { "Content-Type": "application/json", "x-lj-session": sesion }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: "ev-prueba" }) })
  const res = await patch()
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()))
  assert.equal(fila.pagos.length, 2)
  assert.equal(fila.pagos[1].id, "e2e-0000-1111")
  assert.equal(fila.pagos[1].calculoIPC.monto, 178500)
  assert.equal(ledger.length, 2)
  assert.equal(Math.round((ledger[0][2] + ledger[1][2]) * 100) / 100, 178500)
  assert.ok(consultasPatch.some((q) => q.includes("FOR UPDATE")))
  // Reintento del mismo envío: no duplica.
  assert.equal((await patch()).status, 200)
  assert.equal(fila.pagos.length, 2)
  assert.equal(ledger.length, 2)
})

// ---- /api/chat/cobro: solo marca la tarjeta, y solo si el pago está en el evento ----
let sesion = { perfilId: "administracion" }
let mensajes = {}
let pagosEvento = []
const escrituras = []
const sqlChat = async (parts, ...values) => {
  const query = parts.join("?")
  if (query.includes("SELECT acciones FROM chat_ia_mensajes")) {
    const [id, usuario] = values
    const m = mensajes[id]
    return m && m.usuario === usuario ? [{ acciones: m.acciones }] : []
  }
  if (query.includes("SELECT pagos FROM eventos")) return [{ pagos: JSON.stringify(pagosEvento) }]
  if (query.includes("UPDATE chat_ia_mensajes")) {
    mensajes[values[1]].acciones = values[0]
    escrituras.push({ query, values })
    return []
  }
  if (query.includes("activity_log")) { escrituras.push({ query, values }); return [] }
  throw new Error(`Consulta inesperada: ${query}`)
}
sqlChat.begin = async (fn) => fn(sqlChat)
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: sqlChat }
  if (request === "@/lib/auth/server") return { SESSION_COOKIE: "lj_session", SESSION_HEADER: "x-lj-session", verifyToken: async () => sesion }
  return load.call(this, request, ...args)
}
const { POST: POST_COBRO } = require("../app/api/chat/cobro/route.ts")
Module._load = load

function prepararMensaje() {
  const propuesta = armarPropuestaCobro(eventoFijo(), [], HOY, entradaBase, "pago-chat").propuesta
  mensajes = { "m-r": { usuario: "Leila", acciones: JSON.stringify({ botones: [], tarjetas: [], cobro: propuesta }) } }
  escrituras.length = 0
  pagosEvento = eventoFijo().pagos
  sesion = { perfilId: "administracion" }
}
const marcar = (accion, cookie = "lj_session=x; lj_usuario=Leila", mensajeId = "m-r") =>
  POST_COBRO(new Request("http://localhost/api/chat/cobro", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ mensajeId, accion }),
  }))

test("/api/chat/cobro: si el pago no está en el evento, no lo marca como cobrado", async () => {
  prepararMensaje()
  const res = await marcar("confirmar")
  assert.equal(res.status, 409)
  assert.equal(escrituras.length, 0)
  assert.equal(JSON.parse(mensajes["m-r"].acciones).cobro.estado, "pendiente")
})

test("/api/chat/cobro: con el pago en el evento lo marca cobrado y deja rastro; un segundo toque no repite", async () => {
  prepararMensaje()
  pagosEvento = [...pagosEvento, { id: "pago-chat", monto: 274000 }]
  const res = await marcar("confirmar")
  assert.equal(res.status, 200)
  const { cobro } = await res.json()
  assert.equal(cobro.estado, "cobrado")
  assert.equal(cobro.resueltoPor, "Leila")
  const logs = escrituras.filter((e) => e.query.includes("activity_log"))
  assert.equal(logs.length, 1)
  assert.match(logs[0].query, /'pago', 'creado'/)
  assert.match(logs[0].values[1], /Pago registrado por \$\s274\.000 \| Pagado por: Marta \| Recibido por: Leila .*asistente con IA/)
  assert.doesNotMatch(JSON.stringify(escrituras), /12345678/)
  assert.equal(JSON.parse(mensajes["m-r"].acciones).cobro.estado, "cobrado")
  escrituras.length = 0
  const otra = await marcar("confirmar")
  assert.equal((await otra.json()).cobro.estado, "cobrado")
  assert.equal(escrituras.length, 0)
})

test("/api/chat/cobro: cancelar no escribe nada en el evento ni en la actividad", async () => {
  prepararMensaje()
  const res = await marcar("cancelar")
  assert.equal((await res.json()).cobro.estado, "cancelado")
  assert.equal(escrituras.filter((e) => e.query.includes("activity_log")).length, 0)
})

test("/api/chat/cobro: solo el chat propio, solo Administración y Soporte, y con datos válidos", async () => {
  prepararMensaje()
  assert.equal((await marcar("confirmar", "lj_session=x; lj_usuario=Diego")).status, 404)
  sesion = { perfilId: "cobro" }
  assert.equal((await marcar("confirmar")).status, 403)
  sesion = { perfilId: "administracion" }
  assert.equal((await marcar("cobrar")).status, 400)
  assert.equal((await marcar("confirmar", undefined, "")).status, 400)
  assert.equal(escrituras.length, 0)
})

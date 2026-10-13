// Chat de ayuda con datos: plata de un evento (misma cuenta que Cobrar cuota y
// "Vienen a pagar"), búsqueda, botones y la ruta /api/chat con la IA simulada.
// Todo es de solo lectura: la base está simulada y no se escribe nada.
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

const consultas = []
let filasEventos = []
let sesion = { perfilId: "soporte" }
let simularIA = null
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: async (parts) => {
    const query = parts.join("?")
    consultas.push(query)
    if (query.includes("FROM historial_ipc")) return []
    if (query.includes("FROM movimientos_caja")) return []
    return filasEventos
  } }
  if (request === "@/lib/auth/server") return { SESSION_COOKIE: "lj_session", SESSION_HEADER: "x-lj-session", verifyToken: async () => sesion }
  if (request === "ai") {
    const real = load.call(this, request, ...args)
    return { ...real, generateText: (opts) => simularIA(opts) }
  }
  return load.call(this, request, ...args)
}
let datos, POST
try {
  datos = require("../lib/chat-ia-datos.ts")
  ;({ POST } = require("../app/api/chat/route.ts"))
} finally { Module._load = load }
const { resumenEventoChat, filtrarEventosChat, accesosEvento, sumarAcciones, MAX_ACCIONES_CHAT, normalizarTexto } = datos

// Evento inventado: $1.000.000 con seña de $300.000 y 4 cuotas de $175.000,
// la 1 pagada. Hoy 13/10/2026: la 2 y la 3 están atrasadas, la 4 no.
const PRUEBA = {
  id: "ev-prueba", nombre: "PRUEBA Casamiento", nombre_pareja: "PRUEBA Ana y Juan", fecha: "2026-10-06", horario: "21:00",
  salon: "Casona", tipo_evento: "Casamiento", estado: "pendiente", adultos: 100, adolescentes: 10, ninos: 5, precio_venta: 900000,
  // Como en la base: JSON guardado como texto.
  plan_de_cuotas: JSON.stringify({
    montoTotal: 1000000, modalidadPago: "sena", montoSena: 300000, numeroCuotas: 4, montoCuota: 175000,
    fechaInicioPlan: "2026-08-10", diaVencimiento: 10, cuotasPagadas: [1],
    cuotas: [1, 2, 3, 4].map((n) => ({ numero: n, montoCuota: 175000, fechaVencimiento: `2026-${String(7 + n).padStart(2, "0")}-10` })),
  }),
  pagos: JSON.stringify([{ monto: 175000, fecha: "2026-08-10", numeroCuota: 1 }]),
  dni_novio1: "12345678",
}

test("plata de un evento: total, seña, cobrado, saldo y cuotas pendientes", () => {
  const r = resumenEventoChat(PRUEBA, [], "2026-10-13")
  assert.equal(r.montoTotal, 1000000)
  assert.equal(r.sena, 300000)
  assert.equal(r.cobrado, 475000)
  assert.equal(r.saldoPendiente, 525000)
  assert.equal(r.invitados, 115)
  assert.deepEqual(r.cuotasPendientes.map((c) => [c.numero, c.vencimiento, c.monto, c.atrasada]), [
    [2, "2026-09-10", 175000, true],
    [3, "2026-10-10", 175000, true],
    [4, "2026-11-10", 175000, false],
  ])
  // Las cuotas pendientes suman lo mismo que el saldo.
  assert.equal(r.cuotasPendientes.reduce((s, c) => s + c.monto, 0), r.saldoPendiente)
  assert.equal(r.montoAtrasado, 350000)
  // Recargo de $3.000 por día: la 3 venció hace 3 días.
  assert.equal(r.cuotasPendientes[1].recargoPorAtraso, 9000)
  // Nada de DNI ni contrato en lo que se le pasa a la IA.
  assert.doesNotMatch(JSON.stringify(r), /12345678|dni/i)
})

test("sin plan usa el precio de venta; sin precio no inventa saldo; finalizado sin cuotas pendientes", () => {
  const sinPlan = resumenEventoChat({ ...PRUEBA, plan_de_cuotas: null, pagos: null }, [], "2026-10-13")
  assert.equal(sinPlan.montoTotal, 900000)
  assert.equal(sinPlan.cobrado, 0)
  assert.equal(sinPlan.saldoPendiente, 900000)
  const sinPrecio = resumenEventoChat({ ...PRUEBA, plan_de_cuotas: null, pagos: null, precio_venta: 0 }, [], "2026-10-13")
  assert.equal(sinPrecio.montoTotal, null)
  assert.equal(sinPrecio.saldoPendiente, null)
  const finalizado = resumenEventoChat({ ...PRUEBA, estado: "completado" }, [], "2026-10-13")
  assert.deepEqual(finalizado.cuotasPendientes, [])
})

test("búsqueda por fecha, rango, salón y nombre sin tildes, ordenada por fecha", () => {
  const filas = [
    { ...PRUEBA, id: "b", fecha: "2026-10-20", salon: "Quinta", nombre_pareja: "PRUEBA Martínez" },
    PRUEBA,
    { ...PRUEBA, id: "c", fecha: "2026-11-01", salon: "Salon", estado: "completado", nombre_pareja: "PRUEBA Otro" },
  ]
  assert.deepEqual(filtrarEventosChat(filas, { fecha: "2026-10-06" }).map((f) => f.id), ["ev-prueba"])
  assert.deepEqual(filtrarEventosChat(filas, { desde: "2026-10-01", hasta: "2026-10-31" }).map((f) => f.id), ["ev-prueba", "b"])
  assert.deepEqual(filtrarEventosChat(filas, { salon: "Salon" }).map((f) => f.id), ["c"])
  assert.deepEqual(filtrarEventosChat(filas, { texto: "martinez" }).map((f) => f.id), ["b"])
  assert.equal(normalizarTexto(" Martínez "), "martinez")
})

test("botones: Lista, cuotas y costos con el id codificado; los finalizados van al Archivo", () => {
  assert.deepEqual(accesosEvento("a b&c", "Ana", "pendiente").map((a) => a.href), [
    "/eventos/lista?evento=a%20b%26c",
    "/eventos/pagos?evento=a%20b%26c",
    "/eventos/costos?id=a%20b%26c",
  ])
  assert.equal(accesosEvento("x", "Ana", "completado")[0].href, "/eventos/finalizados")
  const acciones = []
  for (let i = 0; i < 5; i++) sumarAcciones(acciones, accesosEvento(`e${i}`, "E", "pendiente"))
  sumarAcciones(acciones, accesosEvento("e0", "E", "pendiente"))
  assert.equal(acciones.length, MAX_ACCIONES_CHAT)
  assert.equal(new Set(acciones.map((a) => a.href)).size, acciones.length)
})

const pedir = (messages) => POST(new Request("http://localhost/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json", cookie: "lj_session=x" },
  body: JSON.stringify({ messages }),
}))

test("ruta: la IA busca el evento del 6/10 y deja los tres botones; sin escrituras", async () => {
  filasEventos = [PRUEBA]
  consultas.length = 0
  let toolsRecibidas
  simularIA = async (opts) => {
    toolsRecibidas = Object.keys(opts.tools).sort()
    assert.ok(opts.stopWhen, "tiene que permitir varios pasos para usar herramientas")
    const busqueda = await opts.tools.buscarEventos.execute({ fecha: "2026-10-06" })
    assert.equal(busqueda.cantidad, 1)
    assert.equal(busqueda.eventos[0].saldoPendiente !== undefined, true)
    const inexistente = await opts.tools.mostrarAccesosEvento.execute({ eventoId: "no-existe" })
    assert.equal(inexistente.ok, false)
    await opts.tools.mostrarAccesosEvento.execute({ eventoId: "ev-prueba" })
    await opts.tools.mostrarPantalla.execute({ pantalla: "caja_eventos" })
    return { text: "El evento del 6/10/2026 es PRUEBA Ana y Juan." }
  }
  const res = await pedir([{ role: "user", content: "quiero ver el evento del 6 de octubre de 2026" }])
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.deepEqual(toolsRecibidas, ["buscarEventos", "mostrarAccesosEvento", "mostrarPantalla", "resumenDelDia", "vienenAPagar"])
  assert.deepEqual(data.acciones.map((a) => a.href), [
    "/eventos/lista?evento=ev-prueba",
    "/eventos/pagos?evento=ev-prueba",
    "/eventos/costos?id=ev-prueba",
    "/finanzas/caja-eventos",
  ])
  // Los eventos se leen una sola vez por pregunta y solo con SELECT, sin DNI.
  const deEventos = consultas.filter((q) => q.includes("FROM eventos"))
  assert.equal(deEventos.length, 1)
  for (const q of consultas) assert.match(q.trim(), /^SELECT/i)
  assert.doesNotMatch(deEventos[0], /dni|contrato/i)
})

test("ruta: sigue siendo solo para Soporte", async () => {
  sesion = { perfilId: "cobro" }
  simularIA = async () => { throw new Error("no debería llamar a la IA") }
  const res = await pedir([{ role: "user", content: "hola" }])
  assert.equal(res.status, 403)
  sesion = { perfilId: "soporte" }
})

test("herramientas de semana y del día responden con la base simulada", async () => {
  filasEventos = [PRUEBA]
  const { crearHerramientasChat } = require("../lib/chat-ia-herramientas.ts")
  const h = crearHerramientasChat({ hoy: "2026-10-13", acciones: [] })
  const semana = await h.vienenAPagar.execute({ semana: "esta" })
  assert.equal(semana.desde, "2026-10-12")
  assert.equal(semana.hasta, "2026-10-18")
  assert.equal(semana.eventos[0].montoAtrasado, 350000)
  const proxima = await h.vienenAPagar.execute({ semana: "proxima" })
  assert.equal(proxima.desde, "2026-10-19")
  const dia = await h.resumenDelDia.execute({ fecha: "2026-08-10" })
  assert.equal(dia.fecha, "2026-08-10")
  assert.equal(dia.totalCuotas, 175000)
})

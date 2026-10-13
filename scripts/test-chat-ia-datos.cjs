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
let filasHistorial = []
let sinTablaHistorial = false
const valoresHistorial = []
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: async (parts, ...values) => {
    const query = parts.join("?")
    consultas.push(query)
    if (query.includes("chat_ia_mensajes")) {
      valoresHistorial.push(values)
      if (sinTablaHistorial) throw new Error('relation "chat_ia_mensajes" does not exist')
      return filasHistorial
    }
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
let datos, POST, GET_HISTORIAL, historial
try {
  datos = require("../lib/chat-ia-datos.ts")
  ;({ POST } = require("../app/api/chat/route.ts"))
  ;({ GET: GET_HISTORIAL } = require("../app/api/chat/historial/route.ts"))
  historial = require("../lib/chat-ia-historial.ts")
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
  // Lo único que se escribe es el historial del chat; los datos, solo SELECT.
  for (const q of consultas.filter((q) => !q.includes("chat_ia_mensajes"))) assert.match(q.trim(), /^SELECT/i)
  assert.doesNotMatch(deEventos[0], /dni|contrato/i)
})

test("ruta: solo Administración y Soporte", async () => {
  sesion = { perfilId: "cobro" }
  simularIA = async () => { throw new Error("no debería llamar a la IA") }
  const res = await pedir([{ role: "user", content: "hola" }])
  assert.equal(res.status, 403)
  const hist = await GET_HISTORIAL(new Request("http://localhost/api/chat/historial", { headers: { cookie: "lj_session=x" } }))
  assert.equal(hist.status, 403)
  sesion = { perfilId: "administracion" }
  simularIA = async () => ({ text: "Hola" })
  const ok = await pedir([{ role: "user", content: "hola" }])
  assert.equal(ok.status, 200)
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


const pedirConId = (id, messages, usuario = "Leila") => POST(new Request("http://localhost/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json", cookie: `lj_session=x; lj_usuario=${encodeURIComponent(usuario)}` },
  body: JSON.stringify({ id, messages }),
}))

test("historial: guarda pregunta y respuesta en el chat de la persona, sin duplicar en un reintento", async () => {
  sesion = { perfilId: "administracion" }
  sinTablaHistorial = false
  consultas.length = 0
  valoresHistorial.length = 0
  simularIA = async (opts) => {
    await opts.tools.mostrarPantalla.execute({ pantalla: "ipc" })
    return { text: "Respuesta" }
  }
  const res = await pedirConId("abc12345-pregunta", [{ role: "user", content: "¿dónde cargo el IPC?" }])
  const data = await res.json()
  assert.equal(data.guardado, true)
  const insert = consultas.find((q) => q.includes("INSERT INTO chat_ia_mensajes"))
  assert.match(insert, /ON CONFLICT \(id\) DO NOTHING/)
  const v = valoresHistorial[valoresHistorial.length - 1]
  assert.deepEqual(v.slice(0, 4), ["abc12345-pregunta", "administracion", "Leila", "¿dónde cargo el IPC?"])
  assert.deepEqual(v.slice(4, 8), ["abc12345-pregunta-r", "administracion", "Leila", "Respuesta"])
  assert.deepEqual(JSON.parse(v[8]), [{ etiqueta: "IPC", href: "/finanzas/ipc" }])
  // Sin id (o con uno raro) responde igual y no guarda.
  consultas.length = 0
  const sinId = await (await pedirConId("x", [{ role: "user", content: "hola" }])).json()
  assert.equal(sinId.guardado, false)
  assert.equal(consultas.some((q) => q.includes("chat_ia_mensajes")), false)
  sesion = { perfilId: "soporte" }
})

test("historial: si falta la tabla el chat responde igual y avisa", async () => {
  sinTablaHistorial = true
  simularIA = async () => ({ text: "Respuesta" })
  const res = await pedirConId("abc12345-otra", [{ role: "user", content: "hola" }])
  assert.equal(res.status, 200)
  assert.equal((await res.json()).guardado, false)
  const hist = await (await GET_HISTORIAL(new Request("http://localhost/api/chat/historial", { headers: { cookie: "lj_session=x" } }))).json()
  assert.deepEqual(hist, {
    disponible: false, mensajes: [], hayMas: false, usuario: "Soporte", propio: true,
    chats: ["Soporte", "Diego", "Leila", "Ricky", "Administración"],
  })
  sinTablaHistorial = false
})

test("historial: del más viejo al más nuevo, con página anterior y fecha validada", async () => {
  const { MENSAJES_POR_PAGINA } = historial
  // La base devuelve del más nuevo al más viejo; una fila de más indica que hay anteriores.
  filasHistorial = Array.from({ length: MENSAJES_POR_PAGINA + 1 }, (_, i) => ({
    id: `m${i}`, perfil: i % 2 ? "soporte" : "administracion", rol: i % 2 ? "assistant" : "user", contenido: `t${i}`,
    acciones: i === 1 ? JSON.stringify([{ etiqueta: "Lista", href: "/eventos/lista" }, { etiqueta: "x", href: "https://afuera" }]) : null,
    created_at: new Date(Date.UTC(2026, 9, 13, 12, 0, 100 - i)),
  }))
  const pedirHist = (q = "") => GET_HISTORIAL(new Request(`http://localhost/api/chat/historial${q}`, { headers: { cookie: "lj_session=x" } }))
  const data = await (await pedirHist()).json()
  assert.equal(data.disponible, true)
  assert.equal(data.hayMas, true)
  assert.equal(data.mensajes.length, MENSAJES_POR_PAGINA)
  assert.equal(data.mensajes[data.mensajes.length - 1].id, "m0")
  assert.deepEqual(data.mensajes.find((m) => m.id === "m1").acciones, [{ etiqueta: "Lista", href: "/eventos/lista" }])
  valoresHistorial.length = 0
  await pedirHist("?antes=2026-10-13T12:00:00.000Z")
  assert.deepEqual(valoresHistorial[0].slice(0, 2), ["Soporte", "2026-10-13T12:00:00.000Z"])
  assert.equal((await pedirHist("?antes=cualquiera")).status, 400)
  filasHistorial = []
})

const pedirHistDe = (perfilId, usuario, q = "") => {
  sesion = { perfilId }
  return GET_HISTORIAL(new Request(`http://localhost/api/chat/historial${q}`, {
    headers: { cookie: `lj_session=x${usuario ? `; lj_usuario=${encodeURIComponent(usuario)}` : ""}` },
  }))
}

test("historial por persona: cada uno de Administración lee solo su chat", async () => {
  filasHistorial = []
  consultas.length = 0
  valoresHistorial.length = 0
  const diego = await (await pedirHistDe("administracion", "Diego")).json()
  assert.equal(diego.usuario, "Diego")
  assert.equal(diego.propio, true)
  // Administración no recibe la lista de chats de los demás.
  assert.equal("chats" in diego, false)
  const lectura = consultas.find((q) => q.includes("FROM chat_ia_mensajes"))
  assert.match(lectura, /WHERE usuario = \?/)
  assert.equal(valoresHistorial[0][0], "Diego")
  // Pedir el chat de otra persona desde Administración: no.
  assert.equal((await pedirHistDe("administracion", "Diego", "?de=Leila")).status, 403)
  // Pedir el propio con ?de= está bien.
  assert.equal((await pedirHistDe("administracion", "Ricky", "?de=Ricky")).status, 200)
  // Sin nombre elegido (o uno que no es de Administración) cae en "Administración", nunca en el de otro.
  assert.equal((await (await pedirHistDe("administracion", "")).json()).usuario, "Administración")
  assert.equal((await (await pedirHistDe("administracion", "Soporte")).json()).usuario, "Administración")
  sesion = { perfilId: "soporte" }
})

test("historial por persona: Soporte elige y lee el chat de los demás, solo lectura", async () => {
  // Un nombre que ya tiene mensajes guardados también aparece en la lista.
  filasHistorial = [{ usuario: "Leila" }, { usuario: "Otro" }]
  valoresHistorial.length = 0
  const propio = await (await pedirHistDe("soporte", "Soporte")).json()
  assert.equal(propio.usuario, "Soporte")
  assert.deepEqual(propio.chats, ["Soporte", "Diego", "Leila", "Ricky", "Administración", "Otro"])
  const deLeila = await (await pedirHistDe("soporte", "Soporte", "?de=Leila")).json()
  assert.equal(deLeila.usuario, "Leila")
  assert.equal(deLeila.propio, false)
  assert.ok(valoresHistorial.some((v) => v[0] === "Leila"))
  filasHistorial = []
})

test("historial por persona: Soporte pregunta en su chat aunque la cookie diga otro nombre", async () => {
  sesion = { perfilId: "soporte" }
  valoresHistorial.length = 0
  simularIA = async () => ({ text: "Ok" })
  await pedirConId("abc12345-soporte", [{ role: "user", content: "hola" }], "Diego")
  const v = valoresHistorial[valoresHistorial.length - 1]
  assert.deepEqual(v.slice(0, 3), ["abc12345-soporte", "soporte", "Soporte"])
})

test("usuarioChat: Diego, Leila y Ricky por separado; el resto no se cuela", () => {
  const { usuarioChat } = historial
  assert.equal(usuarioChat("administracion", "Diego"), "Diego")
  assert.equal(usuarioChat("administracion", " Leila "), "Leila")
  assert.equal(usuarioChat("administracion", "Ricky"), "Ricky")
  assert.equal(usuarioChat("administracion", "Aylin"), "Administración")
  assert.equal(usuarioChat("administracion", null), "Administración")
  assert.equal(usuarioChat("soporte", "Diego"), "Soporte")
})

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
const valoresEscritura = []
const transacciones = []
let fallarEscritura = false
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") {
    const sql = async (parts, ...values) => {
      const query = parts.join("?")
      consultas.push(query)
      if (query.includes("chat_ia_mensajes")) {
        valoresHistorial.push(values)
        if (sinTablaHistorial) throw new Error('relation "chat_ia_mensajes" does not exist')
        return filasHistorial
      }
      if (query.includes("costos_operativos") || query.includes("activity_log")) {
        valoresEscritura.push({ query, values })
        if (fallarEscritura) throw new Error("se cortó la conexión")
        return []
      }
      if (query.includes("FROM historial_ipc")) return []
      if (query.includes("FROM movimientos_caja")) return []
      return filasEventos
    }
    // Transacción simulada: corre con la misma base y avisa si terminó bien.
    sql.begin = async (fn) => {
      transacciones.push("begin")
      const r = await fn(sql)
      transacciones.push("commit")
      return r
    }
    return { sql }
  }
  if (request === "@/lib/auth/server") return { SESSION_COOKIE: "lj_session", SESSION_HEADER: "x-lj-session", verifyToken: async () => sesion }
  if (request === "ai") {
    const real = load.call(this, request, ...args)
    return { ...real, generateText: (opts) => simularIA(opts) }
  }
  return load.call(this, request, ...args)
}
let datos, POST, GET_HISTORIAL, POST_GASTO, historial
try {
  datos = require("../lib/chat-ia-datos.ts")
  ;({ POST } = require("../app/api/chat/route.ts"))
  ;({ GET: GET_HISTORIAL } = require("../app/api/chat/historial/route.ts"))
  ;({ POST: POST_GASTO } = require("../app/api/chat/gasto/route.ts"))
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
  assert.deepEqual(toolsRecibidas, ["buscarEventos", "mostrarAccesosEvento", "mostrarPantalla", "mostrarResumenEventos", "proponerGasto", "resumenDelDia", "vienenAPagar"])
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

test("tarjetas: la plata del evento sale del servidor, ordenada, y se guarda con los botones", async () => {
  sesion = { perfilId: "administracion" }
  filasEventos = [PRUEBA]
  sinTablaHistorial = false
  valoresHistorial.length = 0
  simularIA = async (opts) => {
    const nada = await opts.tools.mostrarResumenEventos.execute({ eventoIds: ["no-existe"] })
    assert.equal(nada.ok, false)
    await opts.tools.mostrarResumenEventos.execute({ eventoIds: ["ev-prueba", "ev-prueba"] })
    await opts.tools.mostrarPantalla.execute({ pantalla: "cobrar_cuota" })
    return { text: "PRUEBA Ana y Juan tiene 2 cuotas vencidas." }
  }
  const data = await (await pedirConId("abc12345-tarjetas", [{ role: "user", content: "¿cómo viene PRUEBA?" }], "Diego")).json()
  // Evento de referencia: $1.000.000, seña $300.000, cuota 1 pagada; hoy 2 vencidas de $175.000.
  assert.equal(data.tarjetas.length, 1)
  const t = data.tarjetas[0]
  assert.equal(t.id, "ev-prueba")
  assert.equal(t.nombre, "PRUEBA Ana y Juan")
  assert.equal(t.salon, "Casona")
  assert.equal(t.montoTotal, 1000000)
  assert.equal(t.sena, 300000)
  assert.equal(t.cobrado, 475000)
  assert.equal(t.saldoPendiente, 525000)
  assert.equal(t.cuotasPendientes, 3)
  assert.equal(t.cuotasVencidas, 2)
  assert.equal(t.montoVencido, 350000)
  assert.deepEqual(t.proximaCuota, { numero: 4, vencimiento: "2026-11-10", monto: 175000 })
  // Sin DNI ni nada que no sea plata del evento.
  assert.doesNotMatch(JSON.stringify(t), /12345678/)
  // Se guarda { botones, tarjetas } en la columna acciones.
  const v = valoresHistorial[valoresHistorial.length - 1]
  const guardado = JSON.parse(v[8])
  assert.deepEqual(guardado.botones, [{ etiqueta: "Cobrar cuota", href: "/eventos/pagos" }])
  assert.equal(guardado.tarjetas[0].saldoPendiente, 525000)
  sesion = { perfilId: "soporte" }
})

test("tarjetas: el historial lee el formato nuevo y el viejo (solo botones)", () => {
  const { filaAMensaje } = historial
  const tarjeta = { id: "e1", nombre: "X", fecha: "2026-10-17", salon: "Casona", estado: "pendiente", montoTotal: 100, sena: 0, cobrado: 50, saldoPendiente: 50, cuotasPendientes: 1, cuotasVencidas: 0, montoVencido: 0, proximaCuota: null, ipcPendiente: false }
  const nuevo = filaAMensaje({ id: "a", rol: "assistant", contenido: "t", created_at: "2026-10-13T12:00:00Z",
    acciones: { botones: [{ etiqueta: "IPC", href: "/finanzas/ipc" }, { etiqueta: "x", href: "https://afuera" }], tarjetas: [tarjeta, { id: "rota" }] } })
  assert.deepEqual(nuevo.acciones, [{ etiqueta: "IPC", href: "/finanzas/ipc" }])
  assert.deepEqual(nuevo.tarjetas, [tarjeta])
  const viejo = filaAMensaje({ id: "b", rol: "assistant", contenido: "t", created_at: "2026-10-13T12:00:00Z",
    acciones: JSON.stringify([{ etiqueta: "Lista", href: "/eventos/lista" }]) })
  assert.deepEqual(viejo.acciones, [{ etiqueta: "Lista", href: "/eventos/lista" }])
  assert.deepEqual(viejo.tarjetas, [])
  assert.equal(historial.adjuntosAGuardar([], []), null)
})

// ── Cargar un gasto desde el chat ──────────────────────────────────────────
const { armarPropuestaGasto } = require("../lib/chat-ia-gasto.ts")

test("gasto: la IA solo propone; no escribe nada en la base", async () => {
  sesion = { perfilId: "administracion" }
  sinTablaHistorial = false
  valoresEscritura.length = 0
  valoresHistorial.length = 0
  simularIA = async (opts) => {
    const r = await opts.tools.proponerGasto.execute({ concepto: "PRUEBA Pepo - luces", monto: 50000, salon: "Salon" })
    assert.equal(r.ok, true)
    assert.match(r.aviso, /NO está cargado/)
    // Un gasto por respuesta.
    const otro = await opts.tools.proponerGasto.execute({ concepto: "Otro", monto: 1, salon: "Quinta" })
    assert.equal(otro.ok, false)
    return { text: "¿Seguro que querés cargar un gasto variable en Salón a nombre de Pepo por $50.000?" }
  }
  const data = await (await pedirConId("abc12345-gasto", [{ role: "user", content: "cargá un gasto de 50 mil en salón a nombre de pepo" }], "Leila")).json()
  assert.equal(data.gasto.concepto, "PRUEBA Pepo - luces")
  assert.equal(data.gasto.monto, 50000)
  assert.equal(data.gasto.salon, "Salon")
  assert.equal(data.gasto.estado, "pendiente")
  // Vencimiento por defecto: hoy, en fecha de Argentina.
  assert.match(data.gasto.vencimiento, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(valoresEscritura.length, 0)
  // Queda guardada en el mensaje de la respuesta, para confirmarla desde ahí.
  const v = valoresHistorial[valoresHistorial.length - 1]
  assert.equal(JSON.parse(v[8]).gasto.id, data.gasto.id)
  sesion = { perfilId: "soporte" }
})

test("gasto: sin historial guardado no hay botón para cargarlo", async () => {
  sesion = { perfilId: "administracion" }
  sinTablaHistorial = true
  simularIA = async (opts) => {
    await opts.tools.proponerGasto.execute({ concepto: "PRUEBA Pepo", monto: 50000, salon: "Salon" })
    return { text: "¿Seguro?" }
  }
  const data = await (await pedirConId("abc12345-gasto2", [{ role: "user", content: "cargá un gasto" }], "Leila")).json()
  assert.equal(data.gasto, null)
  assert.equal(data.gastoSinGuardar, true)
  sinTablaHistorial = false
  sesion = { perfilId: "soporte" }
})

test("gasto: armarPropuestaGasto pide lo que falta y redondea a centavos", () => {
  const base = { id: "g1", hoy: "2026-10-13" }
  assert.equal(armarPropuestaGasto({ monto: 1, salon: "Salon" }, base).ok, false)
  assert.equal(armarPropuestaGasto({ concepto: "Pepo", monto: 0, salon: "Salon" }, base).ok, false)
  assert.equal(armarPropuestaGasto({ concepto: "Pepo", monto: 100, salon: "Salón" }, base).ok, false)
  assert.equal(armarPropuestaGasto({ concepto: "Pepo", monto: 100, salon: "Salon", vencimiento: "2026-02-30" }, base).ok, false)
  assert.equal(armarPropuestaGasto({ concepto: "Pepo", monto: 500000000, salon: "Salon" }, base).ok, false)
  const r = armarPropuestaGasto({ concepto: "  Pepo   - luces ", monto: 1234.567, salon: "Casona" }, base)
  assert.deepEqual(r, { ok: true, propuesta: { id: "g1", concepto: "Pepo - luces", monto: 1234.57, salon: "Casona", vencimiento: "2026-10-13", estado: "pendiente" } })
})

const propuestaGuardada = (estado = "pendiente") => ({
  acciones: { botones: [], tarjetas: [], gasto: { id: "gasto-prueba-1", concepto: "PRUEBA Pepo - luces", monto: 50000, salon: "Salon", vencimiento: "2026-10-13", estado } },
})
const confirmarGasto = (perfilId, usuario, body) => {
  sesion = { perfilId }
  return POST_GASTO(new Request("http://localhost/api/chat/gasto", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `lj_session=x; lj_usuario=${encodeURIComponent(usuario)}` },
    body: JSON.stringify(body),
  }))
}

test("gasto: al confirmar se agenda como gasto variable, en una transacción y sin mover caja", async () => {
  filasHistorial = [propuestaGuardada()]
  valoresEscritura.length = 0
  valoresHistorial.length = 0
  transacciones.length = 0
  consultas.length = 0
  const res = await confirmarGasto("administracion", "Leila", { mensajeId: "abc12345-gasto-r", accion: "confirmar" })
  assert.equal(res.status, 200)
  const { gasto } = await res.json()
  assert.equal(gasto.estado, "cargado")
  assert.equal(gasto.resueltoPor, "Leila")
  assert.deepEqual(transacciones, ["begin", "commit"])
  // Lee la propuesta del chat de Leila, bloqueando la fila.
  const lectura = consultas.find((q) => q.includes("FROM chat_ia_mensajes"))
  assert.match(lectura, /FOR UPDATE/)
  assert.deepEqual(valoresHistorial[0], ["abc12345-gasto-r", "Leila"])
  // Gasto variable: el id de la propuesta (no duplica), carpeta varios, sin pagar.
  const insert = valoresEscritura.find((e) => e.query.includes("INSERT INTO costos_operativos"))
  assert.match(insert.query, /ON CONFLICT \(id\) DO NOTHING/)
  assert.deepEqual(insert.values, ["gasto-prueba-1", "PRUEBA Pepo - luces", 50000, "Salon", "2026-10-13", "Leila"])
  assert.match(insert.query, /'Por Evento', true, 'varios'/)
  assert.match(insert.query, /true, false, false/)
  // No toca la caja.
  assert.equal(consultas.some((q) => q.includes("movimientos_caja")), false)
  // Queda en Actividad y el mensaje pasa a "cargado".
  assert.ok(valoresEscritura.some((e) => e.query.includes("activity_log")))
  const update = valoresHistorial.find((v) => typeof v[0] === "string" && v[0].includes('"cargado"'))
  assert.ok(update)
  sesion = { perfilId: "soporte" }
})

test("gasto: un segundo toque no lo carga de nuevo, y cancelar no escribe el gasto", async () => {
  filasHistorial = [propuestaGuardada("cargado")]
  valoresEscritura.length = 0
  const otraVez = await (await confirmarGasto("administracion", "Leila", { mensajeId: "abc12345-gasto-r", accion: "confirmar" })).json()
  assert.equal(otraVez.gasto.estado, "cargado")
  assert.equal(valoresEscritura.length, 0)
  filasHistorial = [propuestaGuardada()]
  const cancelado = await (await confirmarGasto("administracion", "Leila", { mensajeId: "abc12345-gasto-r", accion: "cancelar" })).json()
  assert.equal(cancelado.gasto.estado, "cancelado")
  assert.equal(valoresEscritura.length, 0)
  filasHistorial = []
  sesion = { perfilId: "soporte" }
})

test("gasto: solo en el chat propio, solo Administración y Soporte, y con datos válidos", async () => {
  // El chat de otra persona no aparece (la consulta filtra por usuario): 404.
  filasHistorial = []
  assert.equal((await confirmarGasto("soporte", "Soporte", { mensajeId: "abc12345-gasto-r", accion: "confirmar" })).status, 404)
  assert.equal((await confirmarGasto("cobro", "Aylin", { mensajeId: "abc12345-gasto-r", accion: "confirmar" })).status, 403)
  assert.equal((await confirmarGasto("administracion", "Leila", { mensajeId: "abc12345-gasto-r", accion: "borrar" })).status, 400)
  // Un mensaje sin gasto: 404.
  filasHistorial = [{ acciones: [{ etiqueta: "IPC", href: "/finanzas/ipc" }] }]
  assert.equal((await confirmarGasto("administracion", "Leila", { mensajeId: "abc12345-gasto-r", accion: "confirmar" })).status, 404)
  // Si la escritura falla, avisa con error (y la transacción no se confirma).
  filasHistorial = [propuestaGuardada()]
  fallarEscritura = true
  transacciones.length = 0
  assert.equal((await confirmarGasto("administracion", "Leila", { mensajeId: "abc12345-gasto-r", accion: "confirmar" })).status, 500)
  assert.deepEqual(transacciones, ["begin"])
  fallarEscritura = false
  filasHistorial = []
  sesion = { perfilId: "soporte" }
})

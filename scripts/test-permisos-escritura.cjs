// Permisos de escritura por perfil (pedido del dueño, 16/10/2026): solo
// Administración y Soporte modifican la base; Cobrar cuota, lo que usan sus
// pantallas; el resto de los perfiles, nada. Las lecturas no cambian.
//
// Prueba las reglas puras (lib/permisos-escritura.ts) y las rutas REALES con
// la base simulada: el proxy /api/db (con los pedidos exactos que arma el
// data-service del navegador), el guardado de eventos, el pase del contrato,
// y las rutas de barras, cotizador, novedades y actividad.
// Correr: node --test scripts/test-permisos-escritura.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")

const RAIZ = path.join(__dirname, "..")
const resolver = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolver.call(this, request.startsWith("@/") ? path.join(RAIZ, request.slice(2)) : request, ...args)
}
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

// Antes de cargar las rutas: el proxy lee estas variables al cargarse.
process.env.AUTH_SECRET = "secreto-de-prueba-permisos"
process.env.PIN_ADMINISTRACION = "246810"
process.env.SUPABASE_URL = "http://postgrest.local"
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-de-prueba"

const { NextRequest } = require("next/server")
const auth = require("../lib/auth/server.ts")
const reglas = require("../lib/permisos-escritura.ts")
const { revisarPedidoProxy, revisarFilaExistente, revisarCambioEvento, MOTIVO_PASE_CONTRATO } = reglas

// ── Base simulada (lo que usan las rutas con SQL) ───────────────────────────
let consultasSql = []
let respuestaSql = () => { throw new Error("la prueba no esperaba llegar a la base") }
const sql = (parts, ...values) => {
  const query = Array.isArray(parts) ? parts.join("?") : String(parts)
  consultasSql.push(query)
  return respuestaSql(query, values)
}
sql.begin = async (fn) => { consultasSql.push("BEGIN"); return respuestaSql("BEGIN", [fn]) }
sql.unsafe = async (query) => { consultasSql.push(query); return [] }
sql.json = (v) => v

const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql, generateId: () => "id-generado" }
  if (request === "@/lib/activity-logger") return { logActivity: async () => {} }
  if (request === "@/lib/event-notifications") return { sendEventNotification: async () => {} }
  if (request === "@/lib/cotizador-salon-servidor") {
    return { leerConfigSalon: async () => null, leerServiciosConCosto: async () => [], leerPersonalConTarifa: async () => [] }
  }
  if (request === "@/lib/cotizador-config-servidor") return { leerCostosPlatos: async () => [], leerBarrasArmadas: async () => [] }
  if (request === "@/lib/precio-barra-servidor") return { leerPreciosCocteles: async () => [] }
  if (request === "@/lib/fechas-especiales-servidor") return { leerFechasEspeciales: async () => [] }
  return load.call(this, request, ...args)
}
const proxy = require("../app/api/db/[...path]/route.ts")
const rutaEventos = require("../app/api/eventos/route.ts")
const rutaEvento = require("../app/api/eventos/[id]/route.ts")
const verificarPin = require("../app/api/auth/verificar-pin/route.ts")
const logout = require("../app/api/auth/logout/route.ts")
const actividad = require("../app/api/activity-log/route.ts")
const novedades = require("../app/api/novedades/route.ts")
const barras = require("../app/api/barra-templates/route.ts")
const barra = require("../app/api/barra-templates/[id]/route.ts")
const RUTAS_VENDEDOR = [
  ["app/api/vendedor/cotizaciones/route.ts", "POST"],
  ["app/api/vendedor/cotizaciones/[id]/route.ts", "DELETE"],
  ["app/api/vendedor/cotizaciones/[id]/enviar/route.ts", "POST"],
  ["app/api/vendedor/paquetes/route.ts", "POST"],
  ["app/api/vendedor/paquetes/[id]/route.ts", "DELETE"],
  ["app/api/vendedor/papelera/cotizaciones/[id]/route.ts", "DELETE"],
  ["app/api/vendedor/papelera/cotizaciones/[id]/restaurar/route.ts", "POST"],
  ["app/api/vendedor/papelera/paquetes/[id]/route.ts", "DELETE"],
  ["app/api/vendedor/papelera/paquetes/[id]/restaurar/route.ts", "POST"],
].map(([archivo, metodo]) => ({ archivo, metodo, handler: require(path.join(RAIZ, archivo))[metodo] }))
Module._load = load

// ── PostgREST simulado, detrás del proxy ────────────────────────────────────
let pedidosPostgrest = []
let filasEnBase = {} // tabla → filas que devuelve la lectura de verificación
let verificacionFalla = false
let sesionNavegador = null // token que el navegador agrega a /api/db (parche de profile-context)

global.fetch = async (input, init = {}) => {
  const url = input instanceof URL ? input.href : typeof input === "string" ? input : input.url
  const metodo = (init.method || "GET").toUpperCase()
  if (url.startsWith("http://localhost:3000/api/db/")) {
    const headers = new Headers(init.headers)
    if (sesionNavegador) headers.set("x-lj-session", sesionNavegador)
    const req = new NextRequest(url, { method: metodo, headers, body: init.body })
    const ruta = new URL(url).pathname.slice("/api/db/".length).split("/")
    return proxy[metodo](req, { params: Promise.resolve({ path: ruta }) })
  }
  if (url.startsWith("http://postgrest.local/")) {
    const u = new URL(url)
    const headers = new Headers(init.headers)
    const cuerpo = init.body ? JSON.parse(Buffer.from(init.body).toString() || "null") : undefined
    pedidosPostgrest.push({ metodo, ruta: u.pathname, query: u.searchParams, prefer: headers.get("prefer") || "", cuerpo })
    if (metodo === "GET") {
      if (verificacionFalla) return new Response("{}", { status: 500 })
      const tabla = u.pathname.split("/").pop()
      const id = (u.searchParams.get("id") || "").replace(/^eq\./, "")
      const filas = (filasEnBase[tabla] || []).filter((f) => f.id === id)
      return Response.json(filas)
    }
    if (metodo === "DELETE") return new Response(null, { status: 204 })
    if (!/return=representation/.test(headers.get("prefer") || "")) return new Response(null, { status: 201 })
    const unaFila = (headers.get("accept") || "").includes("vnd.pgrst.object")
    return Response.json(unaFila ? (Array.isArray(cuerpo) ? cuerpo[0] : cuerpo) : [].concat(cuerpo), { status: 201 })
  }
  throw new Error(`fetch inesperado: ${metodo} ${url}`)
}
// Con el fetch simulado listo: el data-service REAL del navegador (supabase-js → /api/db).
const dataService = require("../lib/supabase/data-service.ts")

// ── Ayudas ──────────────────────────────────────────────────────────────────
const sesion = (perfil) => auth.signToken(perfil)
async function headersDe(perfil, extra = {}) {
  return { "Content-Type": "application/json", "x-lj-session": await sesion(perfil), ...extra }
}
let avisos = []
const warnOriginal = console.warn
console.warn = (...args) => { if (String(args[0]).startsWith("[permisos]")) avisos.push(args.join(" ")); else warnOriginal(...args) }
const errorOriginal = console.error
console.error = (...args) => { if (!/la prueba no esperaba|llegó a la base/.test(String(args[1] ?? args[0]))) errorOriginal(...args) }

function reiniciar() {
  consultasSql = []
  respuestaSql = () => { throw new Error("llegó a la base") }
  pedidosPostgrest = []
  filasEnBase = {}
  verificacionFalla = false
  sesionNavegador = null
  avisos = []
}
// Todos los perfiles de lib/profile-context.tsx menos los que escriben por el
// proxy o guardan eventos: un perfil nuevo queda sin esas escrituras hasta que
// se le arme su regla (Mantenimiento y Clientes guardan por sus propias rutas).
const PERFILES_SIN_ESCRITURA = [...fs.readFileSync(path.join(RAIZ, "lib/profile-context.tsx"), "utf8").matchAll(/^ {4}id: "([a-z_]+)",$/gm)]
  .map((m) => m[1])
  .filter((id) => !["administracion", "soporte", "cobro"].includes(id))
test("perfiles: la lista de los que no escriben sale de PERFILES e incluye los nuevos", () => {
  for (const id of ["cocina", "barra", "coordinacion", "vendedor", "dj", "fotografo", "vestido", "pantalla", "mantenimiento", "clientes"]) {
    assert.ok(PERFILES_SIN_ESCRITURA.includes(id), id)
  }
})
const pedido = (metodo, tabla, { query = "", prefer = "", esquema = "public", cuerpo } = {}) => ({
  metodo, ruta: ["rest", "v1", ...tabla.split("/")], query: new URLSearchParams(query), prefer, esquema, cuerpo,
})
// Lo que arman las pantallas de Cobrar cuota (components/gasto-rapido-modal.tsx y lib/store-context.tsx).
const retiro = () => ({
  id: "mov-retiro", fecha: "2026-10-16T15:00:00.000Z", tipo: "egreso", concepto: "Retiro - PRUEBA cambio",
  monto: 15000, salon: "Quinta", cajaDestino: "caja_jazmines", saldoResultante: -15000,
})
const pagoDeGasto = () => ({
  ...retiro(), id: "mov-pago-gasto", concepto: "PRUEBA gasto", refId: "gv:gasto-1:Quinta", costoOperativoId: "gasto-1",
})
const gastoVariable = (extra = {}) => ({
  id: "gasto-1", concepto: "PRUEBA gasto", tipo: "Gastos Generales", monto: 15000, frecuencia: "Por Evento",
  esPorPersona: false, salon: "Quinta", activo: true, fechaVencimiento: "2026-10-20", esVariable: true, pagado: true,
  categoria: "varios", createdAt: "2026-10-16T15:00:00.000Z", ...extra,
})

// ── 1. Reglas puras ─────────────────────────────────────────────────────────

test("reglas: las lecturas pasan para todos los perfiles, como antes", () => {
  for (const perfil of [...PERFILES_SIN_ESCRITURA, "cobro", "administracion", "soporte", null]) {
    assert.deepEqual(revisarPedidoProxy(perfil, pedido("GET", "movimientos_caja")), { ok: true })
    assert.deepEqual(revisarPedidoProxy(perfil, pedido("HEAD", "personal")), { ok: true })
  }
})

test("reglas: Administración y Soporte escriben todo por el proxy", () => {
  for (const perfil of ["administracion", "soporte"]) {
    for (const metodo of ["POST", "PATCH", "PUT", "DELETE"]) {
      assert.equal(revisarPedidoProxy(perfil, pedido(metodo, "configuracion_cajas", { cuerpo: { id: "config" } })).ok, true)
    }
  }
})

test("reglas: el resto de los perfiles (y sin sesión) no escribe nada por el proxy", () => {
  for (const perfil of [...PERFILES_SIN_ESCRITURA, null, "inventado"]) {
    for (const [metodo, tabla] of [["POST", "movimientos_caja"], ["PATCH", "eventos"], ["DELETE", "servicios"], ["POST", "personal"], ["PUT", "historial_ipc"]]) {
      const d = revisarPedidoProxy(perfil, pedido(metodo, tabla, { cuerpo: { id: "x", tipo: "egreso", caja_destino: "caja_jazmines" } }))
      assert.equal(d.ok, false, `${perfil} ${metodo} ${tabla}`)
    }
  }
})

test("reglas: Cobrar cuota anota retiros y pagos de gastos (egresos de Caja Jazmines sin evento), nada más", () => {
  const egreso = { id: "m", tipo: "egreso", caja_destino: "caja_jazmines", evento_id: null, monto: 100 }
  const ok = (p) => assert.deepEqual(revisarPedidoProxy("cobro", p), { ok: true })
  const no = (p, msg) => assert.equal(revisarPedidoProxy("cobro", p).ok, false, msg)
  ok(pedido("POST", "movimientos_caja", { cuerpo: [egreso], query: 'columns="id","tipo"' }))
  ok(pedido("POST", "movimientos_caja", { cuerpo: [egreso, { ...egreso, id: "m2", salon: "Casona" }] }))
  no(pedido("POST", "movimientos_caja", { cuerpo: [{ ...egreso, tipo: "ingreso" }] }), "un ingreso")
  no(pedido("POST", "movimientos_caja", { cuerpo: [{ ...egreso, caja_destino: "caja_eventos" }] }), "Caja Eventos")
  no(pedido("POST", "movimientos_caja", { cuerpo: [{ ...egreso, caja_destino: null }] }), "sin caja")
  no(pedido("POST", "movimientos_caja", { cuerpo: [{ ...egreso, evento_id: "ev-1" }] }), "de un evento")
  no(pedido("POST", "movimientos_caja", { cuerpo: [egreso, { ...egreso, tipo: "ingreso" }] }), "uno bueno y uno malo")
  no(pedido("POST", "movimientos_caja", { cuerpo: [egreso], prefer: "resolution=merge-duplicates" }), "upsert pisaría otro")
  no(pedido("POST", "movimientos_caja", { cuerpo: [egreso], query: "on_conflict=id" }), "on_conflict")
  no(pedido("POST", "movimientos_caja", { cuerpo: [] }), "lote vacío")
  no(pedido("POST", "movimientos_caja", { cuerpo: "texto" }), "cuerpo que no es JSON de filas")
  no(pedido("POST", "movimientos_caja", { cuerpo: [egreso], esquema: "backup" }), "otro esquema")
  no(pedido("PATCH", "movimientos_caja", { cuerpo: { monto: 1 }, query: "id=eq.m" }), "editar un movimiento")
  no(pedido("POST", "rpc/cualquier_funcion", { cuerpo: {} }), "rpc")
  for (const tabla of ["eventos", "personal", "pagos_personal", "servicios", "configuracion_cajas", "historial_ipc", "vendedores", "asignaciones", "paquetes_salones"]) {
    no(pedido("POST", tabla, { cuerpo: { id: "x" } }), tabla)
    no(pedido("DELETE", tabla, { query: "id=eq.x" }), tabla)
  }
})

test("reglas: Cobrar cuota archiva solo retiros y agenda gastos VARIABLES nuevos, de a uno", () => {
  const archivo = { id: "a", origen: "caja_jazmines_variable", monto: 100 }
  assert.equal(revisarPedidoProxy("cobro", pedido("POST", "gastos_archivados", { cuerpo: archivo, query: "select=*" })).ok, true)
  assert.equal(revisarPedidoProxy("cobro", pedido("POST", "gastos_archivados", { cuerpo: { ...archivo, origen: "caja_eventos" } })).ok, false)
  assert.equal(revisarPedidoProxy("cobro", pedido("POST", "gastos_archivados", { cuerpo: archivo, prefer: "resolution=merge-duplicates" })).ok, false)
  assert.equal(revisarPedidoProxy("cobro", pedido("DELETE", "gastos_archivados", { query: "id=eq.a" })).ok, false)

  const gasto = { id: "g", es_variable: true, monto: 100 }
  const upsert = { prefer: "resolution=merge-duplicates,return=representation", query: "select=*" }
  assert.deepEqual(revisarPedidoProxy("cobro", pedido("POST", "costos_operativos", { cuerpo: gasto, ...upsert })), {
    ok: true, verificar: { tabla: "costos_operativos", id: "g", columnas: "id" },
  })
  assert.equal(revisarPedidoProxy("cobro", pedido("POST", "costos_operativos", { cuerpo: { ...gasto, es_variable: false }, ...upsert })).ok, false)
  assert.equal(revisarPedidoProxy("cobro", pedido("POST", "costos_operativos", { cuerpo: [gasto, { ...gasto, id: "h" }], ...upsert })).ok, false)
  assert.equal(revisarPedidoProxy("cobro", pedido("POST", "costos_operativos", { cuerpo: { ...gasto, id: "" }, ...upsert })).ok, false)
  assert.equal(revisarPedidoProxy("cobro", pedido("POST", "costos_operativos", { cuerpo: gasto, query: "on_conflict=concepto" })).ok, false)
  assert.equal(revisarPedidoProxy("cobro", pedido("DELETE", "costos_operativos", { query: "id=eq.g" })).ok, false)
  // Con la fila de la base: solo un id que no existe (no edita ni pisa gastos).
  const v = { tabla: "costos_operativos", id: "g", columnas: "id" }
  assert.deepEqual(revisarFilaExistente(v, null), { ok: true })
  assert.equal(revisarFilaExistente(v, { id: "g" }).ok, false, "un gasto que ya está")
})

test("reglas: Cobrar cuota borra de a un movimiento, y solo ingresos de un evento (anular un pago)", () => {
  const d = revisarPedidoProxy("cobro", pedido("DELETE", "movimientos_caja", { query: "id=eq.mov-1" }))
  assert.deepEqual(d, { ok: true, verificar: { tabla: "movimientos_caja", id: "mov-1", columnas: "id,tipo,evento_id,caja_destino" } })
  for (const query of ["", "id=in.(a,b)", "id=eq.a&tipo=eq.ingreso", "evento_id=eq.ev-1", "id=neq.a", "id=eq."]) {
    assert.equal(revisarPedidoProxy("cobro", pedido("DELETE", "movimientos_caja", { query })).ok, false, query)
  }
  const v = d.verificar
  assert.deepEqual(revisarFilaExistente(v, null), { ok: true }, "un borrado que no borra nada")
  assert.deepEqual(revisarFilaExistente(v, { tipo: "ingreso", evento_id: "ev-1", caja_destino: "caja_eventos" }), { ok: true })
  assert.deepEqual(revisarFilaExistente(v, { tipo: "ingreso", evento_id: "ev-1", caja_destino: "caja_jazmines" }), { ok: true })
  assert.equal(revisarFilaExistente(v, { tipo: "egreso", caja_destino: "caja_jazmines" }).ok, false, "el pago de un gasto")
  assert.equal(revisarFilaExistente(v, { tipo: "ingreso", evento_id: null, caja_destino: "caja_eventos" }).ok, false, "ingreso sin evento")
  assert.equal(revisarFilaExistente(v, { tipo: "ingreso", evento_id: "ev-1", caja_destino: null }).ok, false, "ingreso sin caja")
  assert.equal(revisarFilaExistente(v, { tipo: "egreso", evento_id: "ev-1", caja_destino: "caja_eventos" }).ok, false, "pago a un proveedor")
  assert.equal(revisarFilaExistente(v, { tipo: "aporte_admin", evento_id: "ev-1", caja_destino: "caja_eventos" }).ok, false)
})

test("reglas de eventos: Administración todo; Cobrar cuota lo de sus pantallas; el resto nada", () => {
  const cobro = (cambios, paseContrato = false) => revisarCambioEvento("cobro", cambios, { paseContrato })
  assert.deepEqual(revisarCambioEvento("administracion", { estado: "completado", precioVenta: 1 }, { paseContrato: false }), { ok: true })
  assert.deepEqual(revisarCambioEvento("soporte", { dniNovio1: "1" }, { paseContrato: false }), { ok: true })
  for (const perfil of [...PERFILES_SIN_ESCRITURA, null]) {
    assert.equal(revisarCambioEvento(perfil, { pagos: [] }, { paseContrato: true }).ok, false, perfil)
    assert.equal(revisarCambioEvento(perfil, {}, { paseContrato: true }).ok, false, perfil)
  }
  const control = { _planEsperado: {}, _pagosEsperados: [], _movimientosCobro: [], _operacionCobro: "a:b" }
  assert.deepEqual(cobro({ pagos: [], planCuotas: 3, montoTotalPlan: 1, planDeCuotas: {}, ...control }), { ok: true })
  assert.deepEqual(cobro({ fechaAlta: "2026-10-01" }), { ok: true })
  assert.deepEqual(cobro({ notasInternas: "" }), { ok: true })
  assert.equal(cobro({ notasInternas: "otra cosa" }).ok, false)
  for (const campo of ["estado", "precioVenta", "dniNovio1", "servicios", "notaStaff", "notasStaffPerfil", "costosCalculados", "fecha", "salon", "asignaciones", "comisionPagada"]) {
    const d = cobro({ pagos: [], [campo]: "x" })
    assert.equal(d.ok, false, campo)
    assert.equal(d.campo, campo)
  }
  // El contrato: solo con el pase del PIN de Administración.
  for (const cambios of [{ contrato: {}, condicionIVA: "Exento" }, { versionesContrato: [] }, { generacionesContrato: [], fechaImpresion: "x" }]) {
    const sinPase = cobro(cambios)
    assert.equal(sinPase.ok, false)
    assert.equal(sinPase.motivo, MOTIVO_PASE_CONTRATO)
    assert.deepEqual(cobro(cambios, true), { ok: true })
  }
  assert.equal(cobro(null).ok, false)
  assert.equal(cobro([]).ok, false)
})

test("reglas: cotizador para el Vendedor y Administración; novedades para quien las ve en Inicio", () => {
  for (const p of ["vendedor", "administracion", "soporte"]) assert.equal(reglas.puedeEscribirCotizador(p), true)
  for (const p of ["cobro", "cocina", "barra", "dj", null]) assert.equal(reglas.puedeEscribirCotizador(p), false)
  for (const p of ["cobro", "administracion", "soporte"]) assert.equal(reglas.puedeCerrarNovedades(p), true)
  for (const p of ["vendedor", "cocina", "barra", "dj", "coordinacion", null]) assert.equal(reglas.puedeCerrarNovedades(p), false)
})

// ── 2. Proxy /api/db con los pedidos REALES del data-service ────────────────

test("proxy: con la sesión de DJ, Cocina o Barra, el data-service no escribe nada (y queda en los logs)", async () => {
  for (const perfil of ["dj", "cocina", "barra", "vendedor"]) {
    reiniciar()
    sesionNavegador = await sesion(perfil)
    await assert.rejects(dataService.insertMovimientosCaja([retiro()]))
    assert.equal(await dataService.upsertCostoOperativo(gastoVariable()), null)
    assert.equal(await dataService.insertGastoArchivado({ id: "a", fecha: "2026-10-16", concepto: "x", monto: 1, origen: "caja_jazmines_variable" }), null)
    assert.equal(await dataService.deleteMovimientoCaja("mov-1"), false)
    assert.equal(await dataService.upsertPersonal({ id: "p1", nombre: "PRUEBA" }), null)
    assert.equal(pedidosPostgrest.length, 0, `${perfil}: nada llegó a la base`)
    assert.equal(avisos.length, 5)
    assert.match(avisos[0], new RegExp(`"perfil":"${perfil}"`))
  }
})

test("proxy: las lecturas siguen pasando para cualquier perfil", async () => {
  reiniciar()
  sesionNavegador = await sesion("dj")
  filasEnBase.vendedores = []
  const res = await fetch("http://localhost:3000/api/db/rest/v1/vendedores?select=*&id=eq.v1")
  assert.equal(res.status, 200)
  assert.equal(pedidosPostgrest.length, 1)
  assert.equal(pedidosPostgrest[0].metodo, "GET")
})

test("proxy: Administración escribe como antes, sin lecturas de más", async () => {
  reiniciar()
  sesionNavegador = await sesion("administracion")
  await dataService.insertMovimientosCaja([{ ...retiro(), tipo: "ingreso", cajaDestino: "caja_eventos", eventoId: "ev-1" }])
  assert.equal(await dataService.deleteMovimientoCaja("mov-1"), true)
  assert.deepEqual(pedidosPostgrest.map((p) => p.metodo), ["POST", "DELETE"])
  assert.equal(avisos.length, 0)
})

test("proxy: Cobrar cuota registra un retiro de Caja Jazmines (egreso + archivo), como lo arma la pantalla", async () => {
  reiniciar()
  sesionNavegador = await sesion("cobro")
  await dataService.insertMovimientosCaja([retiro()])
  const archivado = await dataService.insertGastoArchivado({
    id: "arch-1", fecha: "2026-10-16", concepto: "Retiro - PRUEBA cambio", monto: 15000, salon: "Quinta",
    origen: "caja_jazmines_variable", categoria: "extracción", eventoId: null, eventoNombre: null, refId: null, cargadoPor: "Leila",
  })
  assert.equal(archivado.id, "arch-1")
  assert.deepEqual(pedidosPostgrest.map((p) => `${p.metodo} ${p.ruta}`), ["POST /rest/v1/movimientos_caja", "POST /rest/v1/gastos_archivados"])
  assert.equal(pedidosPostgrest[0].cuerpo[0].tipo, "egreso")
  assert.equal(avisos.length, 0)
})

test("proxy: Cobrar cuota agenda un gasto variable ya pagado; no cambia ni pisa gastos que ya están", async () => {
  reiniciar()
  sesionNavegador = await sesion("cobro")
  // Alta: el id no existe todavía.
  const nuevo = await dataService.upsertCostoOperativo(gastoVariable())
  assert.equal(nuevo.id, "gasto-1")
  await dataService.insertMovimientosCaja([pagoDeGasto()])
  // Ya está en la base (variable o fijo): no se cambia desde Cobrar cuota.
  for (const esVariable of [true, false]) {
    filasEnBase.costos_operativos = [{ id: "gasto-1", es_variable: esVariable }]
    assert.equal(await dataService.upsertCostoOperativo(gastoVariable({ monto: 1 })), null)
  }
  // Ni mandándolo como fijo.
  filasEnBase.costos_operativos = []
  assert.equal(await dataService.upsertCostoOperativo(gastoVariable({ esVariable: false })), null)
  const escrituras = pedidosPostgrest.filter((p) => p.metodo !== "GET").map((p) => `${p.metodo} ${p.ruta}`)
  assert.deepEqual(escrituras, ["POST /rest/v1/costos_operativos", "POST /rest/v1/movimientos_caja"])
  assert.equal(avisos.length, 3)
})

test("proxy: Cobrar cuota anula un pago (borra sus ingresos); no borra otros movimientos", async () => {
  reiniciar()
  sesionNavegador = await sesion("cobro")
  filasEnBase.movimientos_caja = [
    { id: "ing-1", tipo: "ingreso", evento_id: "ev-1", ref_id: null, caja_destino: "caja_eventos" },
    { id: "ing-2", tipo: "ingreso", evento_id: "ev-1", ref_id: null, caja_destino: "caja_jazmines" },
    { id: "egr-gasto", tipo: "egreso", evento_id: null, ref_id: "gv:gasto-1:Quinta", caja_destino: "caja_jazmines" },
    { id: "egr-proveedor", tipo: "egreso", evento_id: "ev-1", ref_id: null, caja_destino: "caja_eventos" },
    { id: "egr-retiro", tipo: "egreso", evento_id: null, ref_id: null, caja_destino: "caja_jazmines" },
  ]
  for (const id of ["ing-1", "ing-2", "ya-no-existe"]) assert.equal(await dataService.deleteMovimientoCaja(id), true, id)
  for (const id of ["egr-gasto", "egr-proveedor", "egr-retiro"]) assert.equal(await dataService.deleteMovimientoCaja(id), false, id)
  const borrados = pedidosPostgrest.filter((p) => p.metodo === "DELETE").map((p) => p.query.get("id"))
  assert.deepEqual(borrados, ["eq.ing-1", "eq.ing-2", "eq.ya-no-existe"])
  // Un borrado masivo, aunque sea de ingresos, no pasa.
  assert.equal(await dataService.deleteMovimientosByEvento("ev-1"), false)
  assert.equal(pedidosPostgrest.filter((p) => p.metodo === "DELETE").length, 3)
})

test("proxy: si no puede leer la fila para verificar, no escribe", async () => {
  reiniciar()
  sesionNavegador = await sesion("cobro")
  verificacionFalla = true
  const res = await fetch("http://localhost:3000/api/db/rest/v1/movimientos_caja?id=eq.ing-1", { method: "DELETE" })
  assert.equal(res.status, 503)
  assert.equal(pedidosPostgrest.filter((p) => p.metodo === "DELETE").length, 0)
})

test("proxy: sin sesión válida no escribe", async () => {
  reiniciar()
  sesionNavegador = "cobro.9999999999999.firma-falsa"
  await assert.rejects(dataService.insertMovimientosCaja([retiro()]))
  assert.equal(pedidosPostgrest.length, 0)
})

// ── 3. Eventos ──────────────────────────────────────────────────────────────

const patchEvento = async (perfil, cambios, extraHeaders = {}) => rutaEvento.PATCH(new NextRequest("http://localhost/api/eventos/ev-1", {
  method: "PATCH", headers: await headersDe(perfil, extraHeaders), body: JSON.stringify(cambios),
}), { params: Promise.resolve({ id: "ev-1" }) })
// La transacción del PATCH no se simula acá (la cubren test-cobro-ipc-api y
// compañía): si el pedido llega a abrirla, pasó el control de permisos.
const pasarTransaccion = () => { respuestaSql = (q) => (q === "BEGIN" ? Response.json({ llego: true }) : []) }

test("eventos: crear un evento es solo de Administración y Soporte", async () => {
  for (const perfil of ["cobro", "vendedor", "dj", "cocina"]) {
    reiniciar()
    const res = await rutaEventos.POST(new NextRequest("http://localhost/api/eventos", {
      method: "POST", headers: await headersDe(perfil), body: JSON.stringify({ nombre: "PRUEBA", fecha: "2027-05-10", salon: "Quinta" }),
    }))
    assert.equal(res.status, 403, perfil)
    assert.equal(consultasSql.length, 0)
  }
  reiniciar()
  const res = await rutaEventos.POST(new NextRequest("http://localhost/api/eventos", {
    method: "POST", headers: await headersDe("administracion"), body: JSON.stringify({ nombre: "PRUEBA", fecha: "2027-05-10", salon: "Quinta" }),
  }))
  assert.notEqual(res.status, 403)
  assert.ok(consultasSql.length > 0, "Administración llega a la base")
})

test("eventos: reemplazar un evento entero (PUT) es solo de Administración y Soporte", async () => {
  reiniciar()
  const put = async (perfil) => rutaEvento.PUT(new NextRequest("http://localhost/api/eventos/ev-1", {
    method: "PUT", headers: await headersDe(perfil), body: JSON.stringify({ nombre: "PRUEBA" }),
  }), { params: Promise.resolve({ id: "ev-1" }) })
  assert.equal((await put("cobro")).status, 403)
  assert.equal(consultasSql.length, 0)
  assert.notEqual((await put("soporte")).status, 403)
})

test("eventos: el staff, Cocina, Barra y el Vendedor no modifican eventos", async () => {
  for (const perfil of PERFILES_SIN_ESCRITURA) {
    reiniciar()
    pasarTransaccion()
    const res = await patchEvento(perfil, { notaStaff: "hola" })
    assert.equal(res.status, 403, perfil)
    assert.equal(consultasSql.length, 0)
  }
})

test("eventos: Cobrar cuota cobra, anula y borra la observación; no toca otros datos", async () => {
  reiniciar()
  pasarTransaccion()
  const control = { _planEsperado: {}, _pagosEsperados: [] }
  assert.equal((await patchEvento("cobro", { pagos: [], planCuotas: 3, montoTotalPlan: 300, planDeCuotas: {}, ...control, _movimientosCobro: [], _operacionCobro: "a" })).status, 200)
  assert.equal((await patchEvento("cobro", { pagos: [], planDeCuotas: {}, ...control })).status, 200)
  assert.equal((await patchEvento("cobro", { notasInternas: "", ...control })).status, 200)
  for (const cambios of [{ estado: "completado" }, { precioVenta: 1 }, { dniNovio1: "1" }, { notasInternas: "nueva" }]) {
    const res = await patchEvento("cobro", { ...cambios, ...control })
    assert.equal(res.status, 403, JSON.stringify(cambios))
  }
  assert.equal(consultasSql.filter((q) => q === "BEGIN").length, 3)
  assert.match(avisos.at(-1), /"campo":"notasInternas"/)
})

test("pase de contrato: el PIN de Administración lo deja y con él Cobrar cuota guarda el contrato", async () => {
  reiniciar()
  pasarTransaccion()
  const contrato = { contrato: { nombreCompleto: "PRUEBA", dni: "1" }, condicionIVA: "Consumidor Final", _planEsperado: {}, _pagosEsperados: [] }
  // Sin pase: no.
  let res = await patchEvento("cobro", contrato)
  assert.equal(res.status, 403)
  assert.equal((await res.json()).error, MOTIVO_PASE_CONTRATO)
  // PIN equivocado: 401 y sin pase.
  const verificar = async (pin, perfil = "cobro") => verificarPin.POST(new NextRequest("http://localhost/api/auth/verificar-pin", {
    method: "POST", headers: { "Content-Type": "application/json", cookie: `lj_session=${await sesion(perfil)}` }, body: JSON.stringify({ pin }),
  }))
  res = await verificar("000000")
  assert.equal(res.status, 401)
  assert.equal(res.cookies.get(auth.PASE_CONTRATO_COOKIE), undefined)
  // PIN correcto: deja el pase (cookie de 2 horas, solo servidor).
  res = await verificar("246810")
  assert.equal(res.status, 200)
  const cookie = res.cookies.get(auth.PASE_CONTRATO_COOKIE)
  assert.ok(cookie && cookie.value)
  assert.equal(cookie.httpOnly, true)
  assert.equal(cookie.maxAge, 2 * 60 * 60)
  assert.equal(await auth.verifyPaseContrato(cookie.value, "cobro"), true)
  assert.equal(await auth.verifyPaseContrato(cookie.value, "barra"), false, "es del perfil que puso el PIN")
  // Con el pase, el contrato se guarda; lo demás sigue igual de cerrado.
  const conPase = { cookie: `${auth.PASE_CONTRATO_COOKIE}=${cookie.value}` }
  assert.equal((await patchEvento("cobro", contrato, conPase)).status, 200)
  assert.equal((await patchEvento("cobro", { versionesContrato: [] }, conPase)).status, 200)
  assert.equal((await patchEvento("cobro", { generacionesContrato: [], fechaImpresion: "2026-10-16" }, conPase)).status, 200)
  assert.equal((await patchEvento("cobro", { estado: "completado" }, conPase)).status, 403)
  // Un pase vencido o de otro perfil no sirve.
  const vencido = await auth.signPaseContrato("cobro", -1000)
  assert.equal((await patchEvento("cobro", contrato, { cookie: `${auth.PASE_CONTRATO_COOKIE}=${vencido}` })).status, 403)
  const deOtro = await auth.signPaseContrato("vendedor")
  assert.equal((await patchEvento("cobro", contrato, { cookie: `${auth.PASE_CONTRATO_COOKIE}=${deOtro}` })).status, 403)
  // Cambiar el PIN de Administración anula los pases.
  process.env.PIN_ADMINISTRACION = "135791"
  assert.equal(await auth.verifyPaseContrato(cookie.value, "cobro"), false)
  process.env.PIN_ADMINISTRACION = "246810"
  // Sin sesión, el PIN no deja pase. Cerrar sesión lo borra.
  res = await verificarPin.POST(new NextRequest("http://localhost/api/auth/verificar-pin", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: "246810" }),
  }))
  assert.equal(res.status, 200)
  assert.equal(res.cookies.get(auth.PASE_CONTRATO_COOKIE), undefined)
  const salida = await logout.POST()
  assert.equal(salida.cookies.get(auth.PASE_CONTRATO_COOKIE).maxAge, 0)
})

// ── 4. Otras rutas ──────────────────────────────────────────────────────────

test("barras armadas: crearlas, editarlas y borrarlas es solo de Administración y Soporte", async () => {
  const llamar = async (perfil) => [
    await barras.POST(new NextRequest("http://localhost/api/barra-templates", { method: "POST", headers: await headersDe(perfil), body: "{}" })),
    await barra.PUT(new NextRequest("http://localhost/api/barra-templates/b1", { method: "PUT", headers: await headersDe(perfil), body: "{}" }), { params: Promise.resolve({ id: "b1" }) }),
    await barra.DELETE(new NextRequest("http://localhost/api/barra-templates/b1", { method: "DELETE", headers: await headersDe(perfil) }), { params: Promise.resolve({ id: "b1" }) }),
  ]
  reiniciar()
  for (const res of await llamar("barra")) assert.equal(res.status, 403)
  assert.equal(consultasSql.length, 0)
  for (const res of await llamar("administracion")) assert.notEqual(res.status, 403)
})

test("cotizador: escribir es del Vendedor (y de Administración); el resto no", async () => {
  for (const { archivo, metodo, handler } of RUTAS_VENDEDOR) {
    const llamar = async (perfil) => handler(new NextRequest(`http://localhost/${archivo}`, {
      method: metodo, headers: await headersDe(perfil), ...(metodo === "POST" ? { body: "{}" } : {}),
    }), { params: Promise.resolve({ id: "cot-1" }) })
    for (const perfil of ["dj", "cobro", "cocina"]) {
      reiniciar()
      assert.equal((await llamar(perfil)).status, 403, `${perfil} ${metodo} ${archivo}`)
      assert.equal(consultasSql.length, 0)
    }
    for (const perfil of ["vendedor", "administracion"]) {
      reiniciar()
      assert.notEqual((await llamar(perfil)).status, 403, `${perfil} ${metodo} ${archivo}`)
    }
  }
})

test("novedades: las cierran Cobrar cuota, Administración y Soporte; el resto no", async () => {
  const cerrar = async (perfil) => novedades.PATCH(new NextRequest("http://localhost/api/novedades", {
    method: "PATCH", headers: await headersDe(perfil), body: JSON.stringify({ id: "nov-1" }),
  }))
  reiniciar()
  respuestaSql = () => []
  assert.equal((await cerrar("dj")).status, 403)
  assert.equal(consultasSql.length, 0)
  assert.equal((await cerrar("cobro")).status, 200)
  assert.equal(consultasSql.length, 1)
})

test("actividad: vaciar el historial es solo de Administración y Soporte; anotar sigue abierto", async () => {
  reiniciar()
  respuestaSql = () => [{ id: 1 }]
  const vaciar = async (perfil) => actividad.DELETE(new NextRequest("http://localhost/api/activity-log", { method: "DELETE", headers: await headersDe(perfil) }))
  assert.equal((await vaciar("cobro")).status, 403)
  assert.equal(consultasSql.length, 0)
  assert.equal((await vaciar("administracion")).status, 200)
  assert.deepEqual(consultasSql, ["DELETE FROM activity_log"])
  // Las pantallas de todos los perfiles anotan su actividad (stock, cobros...).
  const anotar = await actividad.POST(new NextRequest("http://localhost/api/activity-log", {
    method: "POST", headers: await headersDe("barra"), body: JSON.stringify({ tipo: "stock", accion: "carga", nombre: "PRUEBA" }),
  }))
  assert.equal(anotar.status, 201)
})

// ── 5. Lo que mandan las pantallas coincide con lo que el servidor acepta ───

/** Claves de cada `updateEvento(id, { … })` de un archivo, con su valor como texto. */
function llamadosUpdateEvento(rel) {
  const src = fs.readFileSync(path.join(RAIZ, rel), "utf8")
  const llamados = []
  let i = 0
  while ((i = src.indexOf("updateEvento(", i)) !== -1) {
    const coma = src.indexOf(",", i)
    const ini = src.indexOf("{", i)
    if (coma === -1 || ini === -1 || ini < coma || src.slice(coma + 1, ini).trim() !== "") { i++; continue }
    const fin = cierre(src, ini)
    llamados.push({ donde: `${rel}:${src.slice(0, i).split("\n").length}`, claves: clavesDe(src.slice(ini + 1, fin)) })
    i = fin
  }
  return llamados
}
function cierre(texto, ini) {
  let nivel = 0
  for (let j = ini; j < texto.length; j++) {
    if (texto[j] === "{") nivel++
    else if (texto[j] === "}" && --nivel === 0) return j
  }
  throw new Error("llave sin cerrar")
}
function clavesDe(cuerpo) {
  const partes = []
  let nivel = 0, actual = "", comilla = null
  for (const ch of cuerpo.replace(/\/\/[^\n]*/g, "")) {
    if (comilla) { actual += ch; if (ch === comilla) comilla = null; continue }
    if (ch === '"' || ch === "'" || ch === "`") { comilla = ch; actual += ch; continue }
    if ("{[(".includes(ch)) nivel++
    else if ("}])".includes(ch)) nivel--
    if (nivel === 0 && ch === ",") { partes.push(actual); actual = "" } else actual += ch
  }
  partes.push(actual)
  const claves = []
  for (const parte of partes.map((p) => p.trim()).filter(Boolean)) {
    if (parte.startsWith("...")) {
      const ini = parte.indexOf("{")
      claves.push(...clavesDe(parte.slice(ini + 1, cierre(parte, ini))))
    } else {
      const dosPuntos = parte.indexOf(":")
      claves.push({ clave: (dosPuntos === -1 ? parte : parte.slice(0, dosPuntos)).trim(), valor: dosPuntos === -1 ? null : parte.slice(dosPuntos + 1).trim() })
    }
  }
  return claves
}

test("Cobrar cuota: todo lo que guardan sus pantallas lo acepta el servidor (el contrato, con el pase)", () => {
  const llamados = [...llamadosUpdateEvento("app/eventos/pagos/page.tsx"), ...llamadosUpdateEvento("components/contrato-panel.tsx")]
  assert.ok(llamados.length >= 9, `se encontraron ${llamados.length} guardados`)
  // updateEvento (lib/store-context.tsx) agrega siempre los de control.
  const control = { _planEsperado: {}, _pagosEsperados: [], _movimientosCobro: [], _operacionCobro: "x" }
  for (const { donde, claves } of llamados) {
    const cambios = { ...control, ...Object.fromEntries(claves.map(({ clave, valor }) => [clave, valor === '""' ? "" : valor])) }
    const nombres = claves.map((c) => c.clave)
    const decision = revisarCambioEvento("cobro", cambios, { paseContrato: true })
    if (nombres.includes("notaStaff")) {
      // Las notas para el staff solo las ven Administración y Soporte en esa pantalla.
      assert.equal(decision.ok, false, donde)
      continue
    }
    assert.ok(decision.ok, `${donde} guarda ${nombres.join(", ")}: ${decision.motivo}`)
  }
  const pagos = fs.readFileSync(path.join(RAIZ, "app/eventos/pagos/page.tsx"), "utf8")
  assert.match(pagos, /const puedeEditarNotaStaff = \["administracion", "soporte"\]\.includes\(perfilActivo\?\.id \?\? ""\)/)
  assert.match(pagos, /\{puedeEditarNotaStaff && \(/)
})

test("Cobrar cuota: el retiro y el pago de un gasto se arman como egresos de Caja Jazmines sin evento", () => {
  const modal = fs.readFileSync(path.join(RAIZ, "components/gasto-rapido-modal.tsx"), "utf8")
  const retiroSrc = modal.slice(modal.indexOf("addMovimientosCaja(["), modal.indexOf("archivarGasto({"))
  assert.match(retiroSrc, /tipo: "egreso"/)
  assert.match(retiroSrc, /cajaDestino: "caja_jazmines"/)
  assert.doesNotMatch(retiroSrc, /eventoId/)
  assert.match(modal.slice(modal.indexOf("archivarGasto({")), /origen: "caja_jazmines_variable"/)
  assert.match(modal.slice(modal.indexOf("addCostoOperativo({")), /esVariable: true/)
  const store = fs.readFileSync(path.join(RAIZ, "lib/store-context.tsx"), "utf8")
  const sincronizar = store.slice(store.indexOf("const sincronizarPagosGasto"), store.indexOf("const addCostoOperativo"))
  assert.match(sincronizar, /tipo: "egreso"/)
  assert.match(sincronizar, /cajaDestino: "caja_jazmines"/)
  assert.match(sincronizar, /refId: u\.ref/)
  assert.doesNotMatch(sincronizar, /eventoId/)
  // Cada gasto agendado lleva un id nuevo (la regla no deja cambiar uno que ya está)...
  assert.match(store, /const addCostoOperativo = async \(costo: Omit<CostoOperativo, "id">\) => \{\n\s+const newCosto = \{ \.\.\.costo, id: generateId\(\) \}/)
  // ...y en Inicio el modal solo agenda: no recibe un gasto para editar.
  const inicio = fs.readFileSync(path.join(RAIZ, "app/page.tsx"), "utf8")
  assert.match(inicio, /<GastoRapidoModal open=\{gastoOpen\} onOpenChange=\{setGastoOpen\} \/>/)
})

test("Cobrar cuota: anular un pago borra solo ingresos de ese evento", () => {
  const pagos = fs.readFileSync(path.join(RAIZ, "app/eventos/pagos/page.tsx"), "utf8")
  assert.equal(pagos.match(/deleteMovimientoCaja\(/g).length, 1)
  const anular = pagos.slice(pagos.indexOf("const movimientosARevertir"), pagos.indexOf("deleteMovimientoCaja(id)"))
  assert.match(anular, /m\.eventoId === selectedEvento\.id && m\.tipo === "ingreso"/)
})

// Pruebas del cambio "renovar sesión ante 401" (feature/renovar-sesion-401).
//
// Ejercita el fetch parcheado REAL de lib/profile-context.tsx contra:
//   - el verifyToken/signToken REALES de lib/auth/server.ts,
//   - la misma verificación que hace middleware.ts,
//   - la ruta PATCH REAL de app/api/eventos/[id]/route.ts,
// con la base simulada en memoria (mismo patrón que scripts/test-cobro-ipc-api.cjs).
// No toca la base de producción.

process.env.AUTH_SECRET = "secreto-solo-para-esta-prueba"

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
const compilar = (mod, filename) =>
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    filename,
  )
require.extensions[".ts"] = compilar
require.extensions[".tsx"] = compilar

// ---------- Navegador simulado (debe existir ANTES de importar el módulo,
// porque patchFetchWithSession() se aplica al cargarse y captura window.fetch) ----------
const almacen = () => {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  }
}
global.sessionStorage = almacen()
global.localStorage = almacen()
global.document = { cookie: "" }

let navegoA = null
global.window = {
  fetch: (...args) => servidor(...args), // `servidor` está declarada abajo (hoisting)
  location: {
    origin: "http://localhost:3000",
    pathname: "/eventos/lista",
    get href() {
      return "http://localhost:3000/eventos/lista"
    },
    set href(v) {
      navegoA = v
    },
  },
}

// ---------- Base simulada + ruta PATCH real ----------
const { fechaNegocio } = require(path.join(RAIZ, "lib/ipc-cuotas.ts"))
let row, ledger, consultas, queue = Promise.resolve()
const history = () => {
  const [anio, mes] = fechaNegocio().split("-").map(Number)
  return [{ mes: mes - 1, anio, porcentaje: 2 }]
}
const db = () => {
  throw new Error("Consulta fuera de la transacción")
}
db.begin = (fn) => {
  const run = queue.then(async () => {
    const staged = structuredClone(row)
    const moves = structuredClone(ledger)
    const tx = async (parts, ...values) => {
      const query = parts.join("?")
      consultas.push(query)
      if (query.includes("FROM historial_ipc")) return history()
      if (query.includes("FROM eventos")) return [staged]
      if (query.includes("INSERT INTO movimientos_caja")) {
        moves.push(values)
        return []
      }
      throw new Error(`Consulta inesperada: ${query}`)
    }
    tx.unsafe = async (query, values) => {
      consultas.push(query)
      for (const m of query.matchAll(/(plan_de_cuotas|pagos) = \$(\d+)/g)) {
        staged[m[1]] = JSON.parse(values[Number(m[2]) - 1])
      }
      return []
    }
    const response = await fn(tx)
    row = staged
    ledger = moves
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
const { PATCH } = require(path.join(RAIZ, "app/api/eventos/[id]/route.ts"))
Module._load = load

function resetEvento() {
  row = {
    id: "evento-test",
    salon: "Quinta",
    estado: "pendiente",
    pagos: [],
    plan_de_cuotas: {
      numeroCuotas: 3, montoCuota: 100000, montoTotal: 300000, ajustaPorIPC: true, cuotasPagadas: [],
      cuotas: [1, 2, 3].map((numero) => ({ numero, montoCuota: 150000, pagada: false })),
    },
  }
  ledger = []
  consultas = []
}
function cuerpoCobro(suffix = "a") {
  const fecha = fechaNegocio()
  const plan = structuredClone(row.plan_de_cuotas)
  plan.cuotasPagadas = [1]
  plan.cuotas[0] = { ...plan.cuotas[0], pagada: true, montoCuota: 102000, montoPagadoNeto: 102000, fechaPagoReal: fecha }
  return {
    planDeCuotas: plan,
    pagos: [{ id: `p-${suffix}`, numeroCuota: 1, fecha, monto: 108000, montoCuotaNeto: 102000, montoMora: 6000 }],
    _planEsperado: structuredClone(row.plan_de_cuotas), _pagosEsperados: [],
    _operacionCobro: `m1-${suffix}:m2-${suffix}`,
    _movimientosCobro: ["caja_eventos", "caja_jazmines"].map((cajaDestino, i) => ({
      id: `m${i + 1}-${suffix}`, eventoId: row.id, salon: row.salon, tipo: "ingreso",
      monto: 54000, fecha, cajaDestino, concepto: "Cuota de prueba",
    })),
  }
}

// ---------- "Servidor": misma verificación que middleware.ts, con los tokens reales ----------
const auth = require(path.join(RAIZ, "lib/auth/server.ts"))
let loginsRecibidos = 0
let ejecucionesPatch = 0
let quickTokenValidoEnServidor = true

async function servidor(url, init = {}) {
  const ruta = String(url).replace("http://localhost:3000", "")

  // /api/auth/login — pública (PUBLIC_API_ROUTES en middleware.ts)
  if (ruta.startsWith("/api/auth/login")) {
    loginsRecibidos++
    const body = JSON.parse(init.body || "{}")
    const payload = await auth.verifyToken(body.quickToken)
    const ok = quickTokenValidoEnServidor && payload && payload.perfilId === body.perfilId
    if (!ok) return new Response(JSON.stringify({ ok: false, error: "PIN incorrecto" }), { status: 401 })
    return new Response(
      JSON.stringify({
        ok: true, perfilId: body.perfilId,
        sessionToken: await auth.signToken(body.perfilId),
        quickToken: await auth.signQuickToken(body.perfilId),
      }),
      { status: 200 },
    )
  }

  // Resto de /api/* — protegido por el middleware ANTES de llegar a la ruta
  const token = new Headers(init.headers).get("x-lj-session")
  const sesion = await auth.verifyToken(token)
  if (!sesion) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 })
  }

  if (ruta.startsWith("/api/eventos/")) {
    ejecucionesPatch++
    return PATCH(new Request(`http://localhost${ruta}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: init.body }), {
      params: Promise.resolve({ id: "evento-test" }),
    })
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}

// ---------- Importar el módulo bajo prueba (parchea window.fetch) ----------
require(path.join(RAIZ, "lib/profile-context.tsx"))
const fetchParcheado = global.window.fetch

async function prepararSesionVencida({ conQuickToken = true } = {}) {
  sessionStorage._map.clear()
  localStorage._map.clear()
  navegoA = null
  loginsRecibidos = 0
  ejecucionesPatch = 0
  quickTokenValidoEnServidor = true
  sessionStorage.setItem("perfil_activo", "administracion")
  // Token de sesión YA VENCIDO (exp en el pasado): es lo que pasa con una
  // pestaña abierta más de 12 h.
  sessionStorage.setItem("lj_session_token", await auth.signToken("administracion", -1000))
  if (conQuickToken) {
    localStorage.setItem("acceso_rapido_administracion", await auth.signQuickToken("administracion"))
  }
}

// =========================== PRUEBAS ===========================

test("(a) sesión vencida con quick token válido → renueva y el pedido sale bien, sin pedir PIN", async () => {
  await prepararSesionVencida()
  resetEvento()

  const res = await fetchParcheado("/api/eventos/evento-test", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado: "completado" }),
  })

  assert.equal(res.status, 200, "el pedido debe terminar OK tras renovar")
  assert.equal(loginsRecibidos, 1, "se renovó una sola vez")
  assert.equal(ejecucionesPatch, 1, "la ruta se ejecutó UNA sola vez (el 401 la cortó antes)")
  assert.equal(navegoA, null, "no debe mandar al login")
  assert.notEqual(sessionStorage.getItem("lj_session_token"), null)
  assert.ok(await auth.verifyToken(sessionStorage.getItem("lj_session_token")), "el token guardado es válido")
})

test("(a2) varios 401 simultáneos comparten UNA sola renovación", async () => {
  await prepararSesionVencida()
  resetEvento()

  const resultados = await Promise.all([
    fetchParcheado("/api/insumos", { method: "GET" }),
    fetchParcheado("/api/eventos", { method: "GET" }),
    fetchParcheado("/api/costos", { method: "GET" }),
    fetchParcheado("/api/movimientos", { method: "GET" }),
  ])

  assert.deepEqual(resultados.map((r) => r.status), [200, 200, 200, 200])
  assert.equal(loginsRecibidos, 1, "UNA sola renovación para los 4 pedidos en paralelo")
})

test("(b) sesión vencida SIN quick token → limpia y manda al login con el aviso", async () => {
  await prepararSesionVencida({ conQuickToken: false })

  const res = await fetchParcheado("/api/eventos/evento-test", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado: "completado" }),
  })

  assert.equal(res.status, 401, "devuelve el 401 original")
  assert.equal(loginsRecibidos, 0, "ni siquiera intenta renovar sin quick token")
  assert.equal(navegoA, "/login", "redirige al login")
  assert.equal(sessionStorage.getItem("lj_sesion_vencida"), "1", "deja el aviso para el login")
  assert.equal(sessionStorage.getItem("perfil_activo"), null, "limpió el perfil")
  assert.equal(sessionStorage.getItem("lj_session_token"), null, "limpió el token")
})

test("(b2) quick token rechazado por el servidor → también manda al login", async () => {
  await prepararSesionVencida()
  quickTokenValidoEnServidor = false

  const res = await fetchParcheado("/api/eventos/evento-test", { method: "GET" })

  assert.equal(res.status, 401)
  assert.equal(loginsRecibidos, 1, "intentó renovar una vez")
  assert.equal(navegoA, "/login")
  assert.equal(sessionStorage.getItem("lj_sesion_vencida"), "1")
})

test("(c) cobrar cuota con sesión vencida → UN pago y DOS movimientos, una sola vez", async () => {
  await prepararSesionVencida()
  resetEvento()
  const cuerpo = cuerpoCobro()

  const res = await fetchParcheado("/api/eventos/evento-test", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo),
  })

  assert.equal(res.status, 200)
  assert.equal(ejecucionesPatch, 1, "la ruta corrió UNA sola vez: el 401 la cortó antes de ejecutarse")
  assert.equal(row.pagos.length, 1, "UN solo pago registrado")
  assert.equal(ledger.length, 2, "DOS movimientos de caja (uno por caja), no cuatro")
  assert.equal(row.pagos[0].calculoIPC.base, 100000, "la base de IPC no se tocó")
  assert.equal(row.plan_de_cuotas.ultimaOperacionCobro, cuerpo._operacionCobro, "quedó el candado de idempotencia")
})

test("(c2) reintento sobre un cobro YA aplicado no duplica nada (candado del servidor)", async () => {
  await prepararSesionVencida()
  resetEvento()
  const cuerpo = cuerpoCobro()

  // Primer cobro con sesión vencida (renueva y cobra)
  await fetchParcheado("/api/eventos/evento-test", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo),
  })
  // La sesión vuelve a vencer y se repite exactamente la misma operación
  sessionStorage.setItem("lj_session_token", await auth.signToken("administracion", -1000))
  const res2 = await fetchParcheado("/api/eventos/evento-test", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo),
  })

  assert.equal(res2.status, 200)
  assert.equal(row.pagos.length, 1, "sigue habiendo UN solo pago")
  assert.equal(ledger.length, 2, "siguen siendo DOS movimientos de caja")
})

test("(d) sesión vigente → no renueva, no reintenta, no cambia nada", async () => {
  await prepararSesionVencida()
  resetEvento()
  sessionStorage.setItem("lj_session_token", await auth.signToken("administracion"))

  const res = await fetchParcheado("/api/eventos/evento-test", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado: "completado" }),
  })

  assert.equal(res.status, 200)
  assert.equal(loginsRecibidos, 0, "no hubo renovación")
  assert.equal(ejecucionesPatch, 1, "una sola ejecución")
  assert.equal(navegoA, null)
})

test("(e) sin perfil activo (nunca entró) → 401 tal cual, sin renovar ni redirigir", async () => {
  sessionStorage._map.clear()
  localStorage._map.clear()
  navegoA = null
  loginsRecibidos = 0

  const res = await fetchParcheado("/api/eventos", { method: "GET" })

  assert.equal(res.status, 401)
  assert.equal(loginsRecibidos, 0)
  assert.equal(navegoA, null, "no redirige: la app ya maneja sola el caso sin login")
})

test("(f) /api/auth/* nunca se intercepta (sin loop de renovación)", async () => {
  await prepararSesionVencida()
  loginsRecibidos = 0
  quickTokenValidoEnServidor = false

  const res = await fetchParcheado("/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ perfilId: "administracion", quickToken: "cualquiera" }),
  })

  assert.equal(res.status, 401)
  assert.equal(loginsRecibidos, 1, "una sola llamada: no se reintentó a sí misma")
  assert.equal(navegoA, null, "un 401 de /api/auth/* no dispara el redirect")
})

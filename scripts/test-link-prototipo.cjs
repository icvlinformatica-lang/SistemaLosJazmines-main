// Link del prototipo de la vista de Clientes (lib/link-prototipo.ts y
// POST /api/clientes/link-prototipo).
// - Solo Administración y Soporte arman el link.
// - El link lleva un acceso rápido del perfil "clientes" y nada más: la página
//   /prototipo rechaza cualquier token de otro perfil.
// - El token va después del "#", así no llega al servidor.
// No toca ninguna base. Correr: node --test scripts/test-link-prototipo.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")

const RAIZ = path.join(__dirname, "..")
process.env.AUTH_SECRET = "secreto-de-prueba-link-prototipo"
const resolver = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolver.call(this, request.startsWith("@/") ? path.join(RAIZ, request.slice(2)) : request, ...args)
}
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

// La ruta lee el perfil de la sesión; acá lo decide cada test.
let perfilDeLaSesion = null
const cargar = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/stock-salones-server") return { perfilDesdeRequest: async () => perfilDeLaSesion }
  return cargar.call(this, request, ...args)
}

const link = require(path.join(RAIZ, "lib", "link-prototipo.ts"))
const auth = require(path.join(RAIZ, "lib", "auth", "server.ts"))
const ruta = require(path.join(RAIZ, "app", "api", "clientes", "link-prototipo", "route.ts"))

const pedido = () => new Request("https://jazmines.example/api/clientes/link-prototipo", { method: "POST" })

test("solo Soporte arma el link", async () => {
  for (const perfil of [null, "administracion", "clientes", "vendedor", "cobro", "dj", "cocina"]) {
    perfilDeLaSesion = perfil
    const res = await ruta.POST(pedido())
    assert.equal(res.status, 403, String(perfil))
  }
  assert.equal(link.puedeGenerarLinkPrototipo("administracion"), false)
  assert.equal(link.puedeGenerarLinkPrototipo("soporte"), true)
})

test("el link abre el perfil clientes y vale 30 días", async () => {
  perfilDeLaSesion = "soporte"
  const res = await ruta.POST(pedido())
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.ok, true)
  assert.match(data.url, /^https:\/\/jazmines\.example\/prototipo#t=clientes\./)
  const token = link.tokenDeLinkPrototipo(new URL(data.url).hash)
  const sesion = await auth.verifyToken(token)
  assert.equal(sesion.perfilId, "clientes")
  const dias = (sesion.exp - Date.now()) / 86400000
  assert.ok(dias > 29.9 && dias <= 30, String(dias))
  assert.equal(new Date(data.vence).getTime(), sesion.exp)
})

test("la página del link no acepta tokens de otro perfil", async () => {
  const admin = await auth.signQuickToken("administracion")
  assert.equal(link.tokenDeLinkPrototipo(`#t=${encodeURIComponent(admin)}`), null)
  assert.equal(link.tokenDeLinkPrototipo(""), null)
  assert.equal(link.tokenDeLinkPrototipo("#t="), null)
  assert.equal(link.tokenDeLinkPrototipo("#t=%E0%A4%A"), null)
  assert.equal(link.tokenDeLinkPrototipo("#x=clientes.1.abc"), null)
  assert.equal(link.tokenDeLinkPrototipo("#t=clientes.1.abc"), "clientes.1.abc")
})

test("el token va después del # (no llega al servidor)", () => {
  const url = link.urlLinkPrototipo("https://a.example/", "clientes.123.abc")
  assert.equal(url, "https://a.example/prototipo#t=clientes.123.abc")
  assert.equal(new URL(url).search, "")
})

test("una sesión de clientes solo llega a la API del simulador", async () => {
  const vista = require(path.join(RAIZ, "lib", "vista-clientes.ts"))
  for (const p of ["/api/clientes/catalogo", "/api/clientes/ocupadas", "/api/clientes/simular"]) {
    assert.equal(vista.apiPermitidaParaClientes(p), true, p)
  }
  for (const p of ["/api/eventos", "/api/db/movimientos_caja", "/api/personal", "/api/chat", "/api/clientesx", "/api/vendedor/catalogo"]) {
    assert.equal(vista.apiPermitidaParaClientes(p), false, p)
  }
  // El middleware de verdad, con la sesión del link.
  const { middleware } = require(path.join(RAIZ, "middleware.ts"))
  const { NextRequest } = require("next/server")
  const token = await auth.signToken("clientes")
  const pedir = (ruta, tk = token) =>
    middleware(new NextRequest(`https://jazmines.example${ruta}`, { headers: { "x-lj-session": tk } }))
  assert.equal((await pedir("/api/eventos")).status, 403)
  assert.equal((await pedir("/api/db/movimientos_caja")).status, 403)
  assert.notEqual((await pedir("/api/clientes/catalogo")).status, 403)
  // Administración sigue entrando a todo.
  const admin = await auth.signToken("administracion")
  assert.notEqual((await pedir("/api/eventos", admin)).status, 403)
})

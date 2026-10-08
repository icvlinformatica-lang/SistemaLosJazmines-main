// Pruebas de "Diego desbloquea todos los perfiles": al entrar a Administración
// eligiendo "Diego", el login devuelve el acceso rápido de cada perfil.
// Ejercita la ruta REAL app/api/auth/login/route.ts con los módulos de
// autenticación REALES. No toca ninguna base.

process.env.AUTH_SECRET = "secreto-solo-para-esta-prueba"
process.env.PIN_ADMINISTRACION = "222222"
process.env.PIN_COCINA = "1111"
delete process.env.PIN_MAESTRO

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

const auth = require(path.join(RAIZ, "lib", "auth", "server.ts"))
const { POST } = require(path.join(RAIZ, "app", "api", "auth", "login", "route.ts"))

const PERFILES = [
  "cocina", "barra", "administracion", "soporte", "cobro",
  "dj", "fotografo", "vestido", "pantalla", "coordinacion", "vendedor",
]

let ip = 0
async function login(body, cookie) {
  // IP distinta en cada llamada para no chocar con el freno de intentos.
  const headers = { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ip}` }
  if (cookie) headers.cookie = cookie
  const res = await POST(new Request("http://localhost/api/auth/login", { method: "POST", headers, body: JSON.stringify(body) }))
  return { status: res.status, data: await res.json() }
}

test("desbloqueaTodosLosPerfiles: solo Diego en Administración", () => {
  assert.equal(auth.desbloqueaTodosLosPerfiles("administracion", "Diego"), true)
  assert.equal(auth.desbloqueaTodosLosPerfiles("administracion", " Diego "), true)
  assert.equal(auth.desbloqueaTodosLosPerfiles("administracion", "Leila"), false)
  assert.equal(auth.desbloqueaTodosLosPerfiles("administracion", "diego"), false)
  assert.equal(auth.desbloqueaTodosLosPerfiles("administracion", ""), false)
  assert.equal(auth.desbloqueaTodosLosPerfiles("administracion", undefined), false)
  assert.equal(auth.desbloqueaTodosLosPerfiles("cocina", "Diego"), false)
  assert.equal(auth.desbloqueaTodosLosPerfiles("vendedor", "Diego"), false)
})

test("Diego con el PIN de Administración recibe un acceso rápido válido para cada perfil", async () => {
  const { status, data } = await login({ perfilId: "administracion", pin: "222222", quien: "Diego" })
  assert.equal(status, 200)
  assert.deepEqual(Object.keys(data.accesosRapidos).sort(), [...PERFILES].sort())
  for (const id of PERFILES) {
    const payload = await auth.verifyToken(data.accesosRapidos[id])
    assert.equal(payload?.perfilId, id)
  }
  // Con uno de esos accesos se entra a Cocina sin PIN.
  const cocina = await login({ perfilId: "cocina", quickToken: data.accesosRapidos.cocina })
  assert.equal(cocina.status, 200)
  assert.equal(cocina.data.perfilId, "cocina")
})

test("también funciona si el nombre llega solo por la cookie", async () => {
  const { status, data } = await login({ perfilId: "administracion", pin: "222222" }, "lj_usuario=Diego")
  assert.equal(status, 200)
  assert.ok(data.accesosRapidos?.cocina)
})

test("también al volver a entrar con el acceso rápido de Administración", async () => {
  const quickToken = await auth.signQuickToken("administracion")
  const { status, data } = await login({ perfilId: "administracion", quickToken, quien: "Diego" })
  assert.equal(status, 200)
  assert.ok(data.accesosRapidos?.vendedor)
})

test("Leila, u otro perfil con el nombre Diego, no desbloquea nada", async () => {
  const leila = await login({ perfilId: "administracion", pin: "222222", quien: "Leila" })
  assert.equal(leila.status, 200)
  assert.equal(leila.data.accesosRapidos, undefined)
  const cocina = await login({ perfilId: "cocina", pin: "1111", quien: "Diego" })
  assert.equal(cocina.status, 200)
  assert.equal(cocina.data.accesosRapidos, undefined)
})

test("con el PIN equivocado, poner Diego no sirve", async () => {
  const { status, data } = await login({ perfilId: "administracion", pin: "000000", quien: "Diego" })
  assert.equal(status, 401)
  assert.equal(data.accesosRapidos, undefined)
})

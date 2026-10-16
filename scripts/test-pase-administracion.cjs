// Pase de Administración (pedido del dueño, 14/10/2026): cuando Administración
// entra, puede pasar a cualquier perfil sin su PIN mientras dure la sesión.
// Usa lib/auth/server.ts y la ruta de login REALES. No toca ninguna base.

process.env.AUTH_SECRET = "secreto-solo-para-esta-prueba"
process.env.PIN_ADMINISTRACION = "222222"
process.env.PIN_COBRO = "4444"
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
const login = require(path.join(RAIZ, "app", "api", "auth", "login", "route.ts"))

const entrar = async (body) => {
  const res = await login.POST(new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }))
  return { status: res.status, data: await res.json() }
}

test("Administración con su PIN recibe el pase; otro perfil no", async () => {
  const admin = await entrar({ perfilId: "administracion", pin: "222222" })
  assert.equal(admin.status, 200)
  assert.ok(await auth.verifyPaseAdmin(admin.data.paseAdmin))
  const cobro = await entrar({ perfilId: "cobro", pin: "4444" })
  assert.equal(cobro.status, 200)
  assert.equal(cobro.data.paseAdmin, undefined)
})

test("con el pase se entra a cualquier perfil sin su PIN, sin acceso rápido ni pase nuevo", async () => {
  const { data } = await entrar({ perfilId: "administracion", pin: "222222" })
  for (const perfilId of ["cobro", "cocina", "dj", "soporte", "administracion"]) {
    const r = await entrar({ perfilId, paseAdmin: data.paseAdmin })
    assert.equal(r.status, 200, perfilId)
    assert.equal((await auth.verifyToken(r.data.sessionToken))?.perfilId, perfilId)
    assert.equal(r.data.quickToken, undefined, "no deja acceso rápido de 30 días")
    assert.equal(r.data.paseAdmin, undefined, "un pase no estira otro pase")
  }
})

test("con el pase, tocar \"Diego\" no da los accesos rápidos de 30 días a todos los perfiles", async () => {
  const pase = await auth.signPaseAdmin()
  const r = await entrar({ perfilId: "administracion", paseAdmin: pase, quien: "Diego" })
  assert.equal(r.status, 200)
  assert.equal(r.data.accesosRapidos, undefined)
  assert.equal(r.data.quickToken, undefined)
  // Con el PIN de Administración, Diego sí los recibe (y también el pase).
  const conPin = await entrar({ perfilId: "administracion", pin: "222222", quien: "Diego" })
  assert.ok(conPin.data.accesosRapidos?.cobro)
  assert.ok(await auth.verifyPaseAdmin(conPin.data.paseAdmin))
})

test("con la clave maestra se entra y, si es a Administración, también da el pase", async () => {
  process.env.PIN_MAESTRO = "48151623"
  try {
    const cobro = await entrar({ perfilId: "cobro", pin: "48151623" })
    assert.equal(cobro.status, 200)
    assert.equal(cobro.data.paseAdmin, undefined)
    const admin = await entrar({ perfilId: "administracion", pin: "48151623" })
    assert.equal(admin.status, 200)
    assert.ok(await auth.verifyPaseAdmin(admin.data.paseAdmin))
  } finally {
    delete process.env.PIN_MAESTRO
  }
})

test("un pase falso, vencido o de antes de cambiar el PIN de Administración no entra", async () => {
  const pase = await auth.signPaseAdmin()
  const [, exp, firma] = pase.split(".")
  assert.equal((await entrar({ perfilId: "cobro", paseAdmin: `pase-admin.${Number(exp) + 1000}.${firma}` })).status, 401)
  assert.equal((await entrar({ perfilId: "cobro", paseAdmin: await auth.signPaseAdmin(-1000) })).status, 401)
  assert.equal((await entrar({ perfilId: "cobro", paseAdmin: "" })).status, 401)
  process.env.PIN_ADMINISTRACION = "999999"
  try {
    assert.equal((await entrar({ perfilId: "cobro", paseAdmin: pase })).status, 401)
  } finally {
    process.env.PIN_ADMINISTRACION = "222222"
  }
})

test("un pase no sirve como sesión ni una sesión como pase", async () => {
  const pase = await auth.signPaseAdmin()
  assert.equal(await auth.verifyToken(pase), null)
  const sesionAdmin = await auth.signToken("administracion")
  assert.equal(await auth.verifyPaseAdmin(sesionAdmin), false)
  assert.equal((await entrar({ perfilId: "cobro", paseAdmin: sesionAdmin })).status, 401)
})

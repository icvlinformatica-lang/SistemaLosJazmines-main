// Punto 5 de la revisión del 8/10/2026: cambiar el PIN de un perfil cierra
// las sesiones y los accesos rápidos de ese perfil (y solo de ese).
// Usa signToken / verifyToken REALES de lib/auth/server.ts. No toca ninguna base.

process.env.AUTH_SECRET = "secreto-solo-para-esta-prueba"
process.env.PIN_COCINA = "1111"
process.env.PIN_ADMINISTRACION = "222222"

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

const auth = require(path.join(__dirname, "..", "lib", "auth", "server.ts"))

test("una sesión y un acceso rápido valen mientras no cambie el PIN", async () => {
  const sesion = await auth.signToken("cocina")
  const rapido = await auth.signQuickToken("cocina")
  assert.equal((await auth.verifyToken(sesion))?.perfilId, "cocina")
  assert.equal((await auth.verifyToken(rapido))?.perfilId, "cocina")
})

test("al cambiar el PIN de Cocina, sus sesiones dejan de valer y las de los demás no", async () => {
  process.env.PIN_COCINA = "1111"
  const cocina = await auth.signQuickToken("cocina")
  const admin = await auth.signQuickToken("administracion")
  process.env.PIN_COCINA = "5678"
  try {
    assert.equal(await auth.verifyToken(cocina), null, "el acceso rápido viejo de Cocina ya no entra")
    assert.equal((await auth.verifyToken(admin))?.perfilId, "administracion", "Administración sigue adentro")
    // Con el PIN nuevo se vuelve a entrar normalmente.
    assert.equal((await auth.verifyToken(await auth.signToken("cocina")))?.perfilId, "cocina")
  } finally {
    process.env.PIN_COCINA = "1111"
  }
  // Si se vuelve al PIN anterior, la sesión vieja vuelve a valer (no hay lista negra).
  assert.equal((await auth.verifyToken(cocina))?.perfilId, "cocina")
})

test("el PIN no viaja en el token", async () => {
  const token = await auth.signToken("administracion")
  assert.equal(token.split(".").length, 3)
  assert.ok(!token.includes("222222"))
})

test("un token falsificado o cambiado de perfil no pasa", async () => {
  const token = await auth.signToken("cocina")
  const [, exp, firma] = token.split(".")
  assert.equal(await auth.verifyToken(`administracion.${exp}.${firma}`), null)
  assert.equal(await auth.verifyToken(`cocina.${Number(exp) + 1000}.${firma}`), null)
  assert.equal(await auth.verifyToken(await auth.signToken("cocina", -1000)), null, "vencido")
})

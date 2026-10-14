// Configuración > Contraseñas (pedido del dueño, 14/10/2026): además del PIN de
// cada perfil muestra el de carga extraordinaria de stock, y avisa si es el de
// reserva del código. Usa la ruta REAL app/api/auth/pins y lib/auth/server.ts.
// No toca ninguna base.

process.env.AUTH_SECRET = "secreto-solo-para-esta-prueba"
process.env.PIN_ADMINISTRACION = "222222"
process.env.PIN_COCINA = "1111"
process.env.PIN_STOCK_EXTRA = "7531"
process.env.PIN_MAESTRO = "48151623"

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
const { GET } = require(path.join(RAIZ, "app", "api", "auth", "pins", "route.ts"))

async function pedir(perfilId) {
  const headers = perfilId ? { "x-lj-session": await auth.signToken(perfilId) } : {}
  const res = await GET(new Request("http://localhost/api/auth/pins", { headers }))
  return { status: res.status, data: await res.json() }
}

test("Administración y Soporte ven el PIN de cada perfil y el de stock", async () => {
  for (const perfil of ["administracion", "soporte"]) {
    const { status, data } = await pedir(perfil)
    assert.equal(status, 200, perfil)
    assert.equal(data.perfiles.cocina, "1111")
    assert.equal(data.perfiles.administracion, "222222")
    assert.deepEqual(data.stockExtra, { pin: "7531", deReserva: false })
  }
})

test("sin PIN_STOCK_EXTRA muestra el de reserva y lo avisa", async () => {
  const antes = process.env.PIN_STOCK_EXTRA
  process.env.PIN_STOCK_EXTRA = ""
  try {
    const { data } = await pedir("administracion")
    assert.deepEqual(data.stockExtra, { pin: "9999", deReserva: true })
    // Es el mismo PIN que acepta la carga extraordinaria.
    assert.equal(auth.verifyPinStockExtra("9999"), true)
  } finally {
    process.env.PIN_STOCK_EXTRA = antes
  }
})

test("otros perfiles o sin sesión no ven nada", async () => {
  for (const perfil of ["cocina", "cobro", "vendedor", null]) {
    const { status, data } = await pedir(perfil)
    assert.equal(status, 403, String(perfil))
    assert.equal(data.perfiles, undefined)
    assert.equal(data.stockExtra, undefined)
  }
})

test("la clave maestra nunca viaja en la respuesta", async () => {
  const { data } = await pedir("administracion")
  assert.ok(!JSON.stringify(data).includes("48151623"))
})

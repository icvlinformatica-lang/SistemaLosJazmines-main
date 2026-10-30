// Borrar un evento desde su Perfil (Cobrar cuota) con el PIN de
// Administración (pedido del dueño, 30/10/2026). Ejercita la ruta REAL
// DELETE /api/eventos/[id] con la base, el perfil, el historial y los mails
// simulados. No toca ninguna base.
// - Administración y Soporte siguen borrando sin PIN (Lista, Calendario).
// - Cualquier otro perfil borra solo con el PIN de Administración correcto
//   (o la clave maestra); sin PIN o con uno equivocado no se toca la base.
// - Los intentos fallidos cuentan para el mismo freno de /api/auth/verificar-pin.

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")

process.env.PIN_ADMINISTRACION = "481516"
process.env.PIN_MAESTRO = "23424242"

const RAIZ = path.join(__dirname, "..")
const resolver = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolver.call(this, request.startsWith("@/") ? path.join(RAIZ, request.slice(2)) : request, ...args)
}
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

let perfil = "cobro"
let consultas = []
let mailsEnviados = 0
const sql = async (parts) => {
  const query = parts.join("?")
  consultas.push(query)
  if (query.includes("FROM eventos WHERE id")) return [{ id: "e1", nombre: "PRUEBA", fecha: "2026-12-01", estado: "pendiente" }]
  return []
}
sql.begin = async (fn) => fn(sql)

const cargar = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql, generateId: () => "id-nuevo" }
  if (request === "@/lib/stock-salones-server") return { perfilDesdeRequest: async () => perfil }
  if (request === "@/lib/activity-logger") return { logActivity: async () => {} }
  if (request === "@/lib/event-notifications") return { sendEventNotification: async () => { mailsEnviados++ } }
  return cargar.call(this, request, ...args)
}
const evento = require(path.join(RAIZ, "app", "api", "eventos", "[id]", "route.ts"))
const { motivoNoEliminarDesdePerfil, HEADER_PIN_ELIMINAR_EVENTO } = require(path.join(RAIZ, "lib", "eliminar-evento-pin.ts"))
Module._load = cargar

let ip = 0
// Cada pedido con una IP distinta, salvo que se pida una, para que el freno
// de intentos de un test no afecte a otro.
const borrar = (pin, ipFija) => {
  const headers = { "x-forwarded-for": ipFija || `10.0.0.${++ip}` }
  if (pin !== undefined) headers[HEADER_PIN_ELIMINAR_EVENTO] = pin
  return evento.DELETE(new Request("http://localhost/api/eventos/e1", { method: "DELETE", headers }), { params: Promise.resolve({ id: "e1" }) })
}
function reiniciar(p) {
  perfil = p
  consultas = []
  mailsEnviados = 0
}
const borro = () => consultas.some((q) => q.includes("SET deleted_at=NOW()"))

test("con el PIN de Administración correcto, Cobrar cuota manda el evento a la papelera", async () => {
  for (const p of ["cobro", "coordinacion", "dj"]) {
    reiniciar(p)
    const res = await borrar("481516")
    assert.equal(res.status, 200, p)
    assert.ok(consultas.some((q) => q.includes("INSERT INTO eventos_eliminados")), "queda en Eliminados")
    assert.ok(borro())
    assert.equal(mailsEnviados, 1, "manda el mail de siempre")
  }
})

test("la clave maestra también sirve", async () => {
  reiniciar("cobro")
  assert.equal((await borrar("23424242")).status, 200)
})

test("sin PIN o con el PIN equivocado no se toca la base", async () => {
  reiniciar("cobro")
  assert.equal((await borrar()).status, 403)
  assert.equal((await borrar("")).status, 403)
  const res = await borrar("000000")
  assert.equal(res.status, 401)
  assert.equal((await res.json()).error, "PIN incorrecto")
  // El PIN de otro perfil no alcanza.
  process.env.PIN_COBRO = "777777"
  assert.equal((await borrar("777777")).status, 401)
  assert.equal(consultas.length, 0)
  assert.equal(mailsEnviados, 0)
})

test("sin sesión no alcanza con el PIN", async () => {
  reiniciar(null)
  assert.equal((await borrar("481516")).status, 403)
  assert.equal(consultas.length, 0)
})

test("Administración y Soporte siguen borrando sin PIN", async () => {
  for (const p of ["administracion", "soporte"]) {
    reiniciar(p)
    assert.equal((await borrar()).status, 200, p)
    assert.ok(borro())
  }
})

test("cinco PINs equivocados frenan los intentos, aunque después venga el bueno", async () => {
  reiniciar("cobro")
  for (let i = 0; i < 5; i++) assert.equal((await borrar("000000", "10.9.9.9")).status, 401)
  assert.equal((await borrar("481516", "10.9.9.9")).status, 429)
  assert.equal(consultas.length, 0)
})

test("con el stock descontado se borra desde la Lista, no desde el Perfil", () => {
  assert.match(motivoNoEliminarDesdePerfil({ stockDescontado: true }), /Lista de eventos/)
  assert.equal(motivoNoEliminarDesdePerfil({ stockDescontado: false }), null)
  assert.equal(motivoNoEliminarDesdePerfil({}), null)
})

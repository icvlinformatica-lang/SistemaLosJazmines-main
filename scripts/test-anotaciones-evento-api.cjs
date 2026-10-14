// /api/eventos/[id]/anotacion: cada perfil lee y guarda SOLO su anotación
// del evento. El perfil sale de la sesión, nunca del cuerpo del pedido.
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const resolver = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolver.call(this, request.startsWith("@/") ? path.join(__dirname, "..", request.slice(2)) : request, ...args)
}
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

let consultas, respuestas
const db = async (parts, ...values) => {
  consultas.push({ query: parts.join("?"), values })
  const r = respuestas.shift()
  if (r instanceof Error) throw r
  return r ?? []
}
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: db }
  if (request === "@/lib/stock-salones-server") return { perfilDesdeRequest: async (req) => req.headers.get("x-perfil-prueba") }
  return load.call(this, request, ...args)
}
const { GET, PUT } = require("../app/api/eventos/[id]/anotacion/route.ts")
const { textoAnotacionValido, LARGO_MAX_ANOTACION } = require("../lib/anotaciones-evento.ts")
Module._load = load

function reset(r = []) { consultas = []; respuestas = r }
const ctx = (id) => ({ params: Promise.resolve({ id }) })
const get = (id, perfil) => GET(new Request(`http://x/api/eventos/${id}/anotacion`, { headers: perfil ? { "x-perfil-prueba": perfil } : {} }), ctx(id))
const put = (id, perfil, body) => PUT(new Request(`http://x/api/eventos/${id}/anotacion`, {
  method: "PUT", headers: { "content-type": "application/json", ...(perfil ? { "x-perfil-prueba": perfil } : {}) }, body: JSON.stringify(body),
}), ctx(id))
const faltaTabla = () => Object.assign(new Error('relation "anotaciones_evento" does not exist'), { code: "42P01" })

test("sin sesión no lee ni guarda", async () => {
  reset()
  assert.equal((await get("ev-1", null)).status, 401)
  assert.equal((await put("ev-1", null, { texto: "hola" })).status, 401)
  assert.equal(consultas.length, 0)
})

test("lee la anotación del perfil de la sesión", async () => {
  reset([[{ texto: "Llevar 2 parlantes", updated_at: "2026-10-14T13:00:00Z" }]])
  const res = await get("ev-1", "dj")
  const data = await res.json()
  assert.equal(res.status, 200)
  assert.deepEqual(data, { disponible: true, texto: "Llevar 2 parlantes", actualizado: "2026-10-14T13:00:00.000Z" })
  assert.deepEqual(consultas[0].values, ["ev-1", "dj"])
})

test("sin anotación guardada devuelve vacío", async () => {
  reset([[]])
  const data = await (await get("ev-1", "barra")).json()
  assert.deepEqual(data, { disponible: true, texto: "", actualizado: null })
})

test("guarda con el perfil de la sesión aunque el pedido diga otro", async () => {
  reset([[{ 1: 1 }], [{ updated_at: "2026-10-14T13:05:00Z" }]])
  const res = await put("ev-1", "fotografo", { texto: "Fotos en el jardín", perfil: "administracion" })
  assert.equal(res.status, 200)
  const insert = consultas[1]
  assert.match(insert.query, /INSERT INTO anotaciones_evento/)
  assert.match(insert.query, /ON CONFLICT \(evento_id, perfil\) DO UPDATE/)
  assert.deepEqual(insert.values, ["ev-1", "fotografo", "Fotos en el jardín"])
})

test("se puede borrar todo el texto (guardar vacío)", async () => {
  reset([[{ 1: 1 }], [{ updated_at: "2026-10-14T13:05:00Z" }]])
  assert.equal((await put("ev-1", "cocina", { texto: "" })).status, 200)
  assert.equal(consultas[1].values[2], "")
})

test("evento que no existe: 404 y no inserta", async () => {
  reset([[]])
  assert.equal((await put("ev-x", "dj", { texto: "hola" })).status, 404)
  assert.equal(consultas.length, 1)
})

test("texto inválido o largo de más: 400 sin tocar la base", async () => {
  reset()
  assert.equal((await put("ev-1", "dj", { texto: 5 })).status, 400)
  assert.equal((await put("ev-1", "dj", { texto: "a".repeat(LARGO_MAX_ANOTACION + 1) })).status, 400)
  assert.equal(consultas.length, 0)
  assert.equal(textoAnotacionValido("a".repeat(LARGO_MAX_ANOTACION)).ok, true)
})

test("id de evento raro: 400", async () => {
  reset()
  assert.equal((await get("ev 1; drop", "dj")).status, 400)
  assert.equal(consultas.length, 0)
})

test("sin la tabla (migración 024 sin aplicar) avisa en vez de romper", async () => {
  reset([faltaTabla()])
  assert.deepEqual(await (await get("ev-1", "dj")).json(), { disponible: false, texto: "", actualizado: null })
  reset([[{ 1: 1 }], faltaTabla()])
  const res = await put("ev-1", "dj", { texto: "hola" })
  assert.equal(res.status, 503)
  assert.equal((await res.json()).disponible, false)
})

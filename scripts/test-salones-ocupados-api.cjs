// GET /api/vendedor/salones-ocupados: solo perfiles que cotizan, fecha
// válida, y devuelve SOLO claves de salón (nada del evento).
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

let consultas, filas, falla
const db = async (parts, ...values) => {
  consultas.push({ query: parts.join("?"), values })
  if (falla) throw new Error("Fallo de base simulado")
  return filas
}
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: db }
  // El perfil de la sesión viene en un header de prueba (en la app sale de la cookie firmada).
  if (request === "@/lib/stock-salones-server") return { perfilDesdeRequest: async (req) => req.headers.get("x-perfil-prueba") }
  return load.call(this, request, ...args)
}
const { GET } = require("../app/api/vendedor/salones-ocupados/route.ts")
Module._load = load

function reset() { consultas = []; filas = []; falla = false }
const pedir = (fecha, perfil) => GET(new Request(`http://localhost/api/vendedor/salones-ocupados${fecha === undefined ? "" : `?fecha=${fecha}`}`, {
  headers: perfil ? { "x-perfil-prueba": perfil } : {},
}))

test("el vendedor recibe solo las claves de salón ocupadas ese día", async () => {
  reset()
  // Aunque la base devolviera más columnas, la respuesta solo lleva el salón.
  filas = [{ salon: "Quinta", nombre: "Boda X", cliente_dni: "123" }, { salon: "Casona" }, { salon: null }]
  const res = await pedir("2026-11-14", "vendedor")
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true, salones: ["Quinta", "Casona"] })
  assert.equal(consultas.length, 1)
  assert.match(consultas[0].query, /deleted_at IS NULL/)
  assert.doesNotMatch(consultas[0].query, /SELECT \*/)
  assert.deepEqual(consultas[0].values, ["2026-11-14"])
})

test("Administración y Soporte también pueden consultar", async () => {
  for (const perfil of ["administracion", "soporte"]) {
    reset()
    assert.equal((await pedir("2026-11-14", perfil)).status, 200)
  }
})

test("otros perfiles o sin sesión: 403 y no se consulta la base", async () => {
  for (const perfil of ["cocina", "barra", "dj", "cobro", null]) {
    reset()
    const res = await pedir("2026-11-14", perfil)
    assert.equal(res.status, 403)
    assert.equal(consultas.length, 0)
  }
})

test("fecha faltante o mal escrita: 400 sin consultar", async () => {
  for (const fecha of [undefined, "", "14/11/2026", "2026-11-14T00:00", "x"]) {
    reset()
    const res = await pedir(fecha, "vendedor")
    assert.equal(res.status, 400)
    assert.equal(consultas.length, 0)
  }
})

test("si falla la base responde 500 sin detalles", async () => {
  reset(); falla = true
  const res = await pedir("2026-11-14", "vendedor")
  assert.equal(res.status, 500)
  assert.deepEqual(await res.json(), { ok: false, error: "Error interno" })
})

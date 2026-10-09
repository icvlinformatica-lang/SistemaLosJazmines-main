// GET /api/administracion/cotizaciones?historial=1: pestaña "Historial" de la
// bandeja. Solo Administración y Soporte; trae convertidas y rechazadas, y
// sin el parámetro sigue trayendo solo las que esperan revisión.
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
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename)

let consultas, filas
const db = async (parts, ...values) => {
  consultas.push({ query: parts.join("?"), values })
  return filas
}
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: db }
  if (request === "@/lib/stock-salones-server") return { perfilDesdeRequest: async (req) => req.headers.get("x-perfil-prueba") }
  return load.call(this, request, ...args)
}
const { GET } = require("../app/api/administracion/cotizaciones/route.ts")
Module._load = load

function reset() { consultas = []; filas = [] }
const pedir = (query, perfil) => GET(new Request(`http://localhost/api/administracion/cotizaciones${query}`, {
  headers: perfil ? { "x-perfil-prueba": perfil } : {},
}))
const fila = (extra) => ({
  id: "c1", vendedor: "PRUEBA Vendedora", cliente_nombre: "PRUEBA Cliente", cliente_telefono: null,
  fecha_evento: "2026-11-21", horario: null, horario_fin: null, salon: "Casona", tipo_evento: null,
  nombre_festejados: null, paquete_id: null, invitados: "{}", servicios_elegidos: "{}",
  precio_venta_sugerido: 1200000, costos_internos: "{}", desglose_venta: null, avisos: "[]",
  cliente_dni: null, comentario_admin: null, evento_id: null, estado: "lista_para_revisar",
  created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-05T12:00:00Z", ...extra,
})

test("historial: trae convertidas y rechazadas, las más recientes primero", async () => {
  reset()
  filas = [
    fila({ id: "r1", estado: "rechazada", comentario_admin: "Falta el menú" }),
    fila({ id: "c2", estado: "convertida", evento_id: "ev-9" }),
  ]
  const res = await pedir("?historial=1", "administracion")
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(consultas.length, 1)
  assert.match(consultas[0].query, /estado IN \('convertida', 'rechazada'\)/)
  assert.match(consultas[0].query, /ORDER BY updated_at DESC/)
  assert.deepEqual(data.cotizaciones.map((c) => [c.id, c.estado, c.comentarioAdmin, c.eventoId]), [
    ["r1", "rechazada", "Falta el menú", null],
    ["c2", "convertida", null, "ev-9"],
  ])
})

test("sin el parámetro sigue siendo la bandeja de las que esperan revisión", async () => {
  reset()
  filas = [fila()]
  const res = await pedir("", "soporte")
  assert.equal(res.status, 200)
  assert.match(consultas[0].query, /WHERE estado = 'lista_para_revisar'/)
  assert.equal((await res.json()).cotizaciones[0].updatedAt, "2026-10-05T12:00:00Z")
})

test("historial para otros perfiles: 403 y no se consulta la base", async () => {
  for (const perfil of ["vendedor", "cobro", "cocina", null]) {
    reset()
    const res = await pedir("?historial=1", perfil)
    assert.equal(res.status, 403)
    assert.equal(consultas.length, 0)
  }
})

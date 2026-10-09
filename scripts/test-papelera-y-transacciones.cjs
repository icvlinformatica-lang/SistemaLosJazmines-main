// Pruebas de la revisión del 8/10/2026 (puntos 2 y 4):
// - Borrar eventos, ver, restaurar y vaciar la papelera: solo Administración y
//   Soporte, aunque se le pegue a la ruta sin pasar por la pantalla.
// - Si no se puede guardar la copia en la papelera, el evento no se borra.
// - Recetas y cócteles reemplazan sus ingredientes dentro de una transacción.
// Ejercita las rutas REALES con la base, el perfil, el historial y los mails
// simulados. No toca ninguna base.

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

// --- Simulaciones ---
let perfil = "administracion"
let consultas = [] // { query, enTransaccion }
let fallarSi = null // texto de consulta que tira error
let enTransaccion = false
let mailsEnviados = 0

function responder(query) {
  if (fallarSi && query.includes(fallarSi)) throw new Error("falla simulada")
  if (query.includes("UPDATE recetas")) return [{ id: "r1", nombre: "RECETA", categoria: "principal" }]
  if (query.includes("UPDATE cocteles")) return [{ id: "c1", nombre: "MOJITO" }]
  if (query.includes("FROM receta_insumos")) return []
  if (query.includes("SELECT nombre FROM cocteles")) return [{ nombre: "MOJITO" }]
  if (query.includes("FROM eventos WHERE id")) return [{ id: "e1", nombre: "PRUEBA", fecha: "2026-12-01", estado: "pendiente" }]
  if (query.includes("SELECT COUNT(*)")) return [{ total: 2 }]
  if (query.includes("FROM eventos_eliminados")) return []
  return []
}
const sql = async (parts, ...values) => {
  const query = parts.join("?")
  consultas.push({ query, enTransaccion })
  return responder(query)
}
sql.begin = async (fn) => {
  enTransaccion = true
  try { return await fn(sql) } finally { enTransaccion = false }
}

const cargar = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql, generateId: () => "id-nuevo" }
  if (request === "@/lib/stock-salones-server") return { perfilDesdeRequest: async () => perfil }
  if (request === "@/lib/activity-logger") return { logActivity: async () => {} }
  if (request === "@/lib/event-notifications") return { sendEventNotification: async () => { mailsEnviados++ } }
  return cargar.call(this, request, ...args)
}
const ruta = (...partes) => require(path.join(RAIZ, "app", "api", ...partes, "route.ts"))
const evento = ruta("eventos", "[id]")
const papelera = ruta("eventos", "papelera")
const restaurar = ruta("eventos", "papelera", "[id]", "restaurar")
const papeleraVendedores = ruta("eventos", "papelera-vendedores")
const receta = ruta("recetas", "[id]")
const coctel = ruta("cocteles", "[id]")
Module._load = cargar

const params = (id) => ({ params: Promise.resolve({ id }) })
const req = (url, method = "GET", body) =>
  new Request(`http://localhost${url}`, { method, headers: { "content-type": "application/json" }, body: body && JSON.stringify(body) })

function reiniciar(p) {
  perfil = p
  consultas = []
  fallarSi = null
  mailsEnviados = 0
}

const NO_ADMIN = ["dj", "fotografo", "cocina", "barra", "cobro", "vendedor", "coordinacion", null]

test("solo Administración y Soporte mandan un evento a la papelera", async () => {
  for (const p of NO_ADMIN) {
    reiniciar(p)
    const res = await evento.DELETE(req("/api/eventos/e1", "DELETE"), params("e1"))
    assert.equal(res.status, 403, String(p))
    assert.equal(consultas.length, 0, "no se toca la base")
    assert.equal(mailsEnviados, 0)
  }
  for (const p of ["administracion", "soporte"]) {
    reiniciar(p)
    const res = await evento.DELETE(req("/api/eventos/e1", "DELETE"), params("e1"))
    assert.equal(res.status, 200, p)
    assert.ok(consultas.some((c) => c.query.includes("SET deleted_at=NOW()")))
  }
})

test("si no se puede guardar la copia en la papelera, el evento no se borra", async () => {
  reiniciar("administracion")
  fallarSi = "INSERT INTO eventos_eliminados"
  const res = await evento.DELETE(req("/api/eventos/e1", "DELETE"), params("e1"))
  assert.equal(res.status, 500)
  assert.match((await res.json()).error, /No se borró/)
  assert.ok(!consultas.some((c) => c.query.includes("SET deleted_at=NOW()")))
  assert.equal(mailsEnviados, 0)
})

test("ver, vaciar y restaurar la papelera de eventos: solo Administración y Soporte", async () => {
  for (const p of NO_ADMIN) {
    reiniciar(p)
    assert.equal((await papelera.GET(req("/api/eventos/papelera"))).status, 403, `GET ${p}`)
    assert.equal((await papelera.DELETE(req("/api/eventos/papelera", "DELETE"))).status, 403, `vaciar ${p}`)
    assert.equal((await papelera.DELETE(req("/api/eventos/papelera?id=e1", "DELETE"))).status, 403, `borrar uno ${p}`)
    assert.equal((await restaurar.POST(req("/api/eventos/papelera/e1/restaurar", "POST"), params("e1"))).status, 403, `restaurar ${p}`)
    assert.equal((await papeleraVendedores.GET(req("/api/eventos/papelera-vendedores"))).status, 403, `papelera vendedores ${p}`)
    assert.equal(consultas.length, 0, "no se toca la base")
  }
  reiniciar("soporte")
  assert.equal((await papelera.GET(req("/api/eventos/papelera"))).status, 200)
  assert.equal((await papelera.DELETE(req("/api/eventos/papelera", "DELETE"))).status, 200)
  assert.ok(consultas.some((c) => c.query.includes("DELETE FROM eventos_eliminados")))
})

test("guardar una receta reemplaza los ingredientes dentro de una transacción", async () => {
  reiniciar("administracion")
  const body = { nombre: "RECETA", insumos: [{ insumoId: "i1", cantidadBasePorPersona: 100 }, { insumoId: "i2", cantidadBasePorPersona: 50 }] }
  const res = await receta.PUT(req("/api/recetas/r1", "PUT", body), params("r1"))
  assert.equal(res.status, 200)
  const escrituras = consultas.filter((c) => /UPDATE recetas|DELETE FROM receta_insumos|INSERT INTO receta_insumos/.test(c.query))
  assert.equal(escrituras.length, 4)
  assert.ok(escrituras.every((c) => c.enTransaccion), "todas dentro de la transacción")
})

test("si falla un ingrediente de la receta, el guardado entero falla (y la base lo deshace)", async () => {
  reiniciar("administracion")
  fallarSi = "INSERT INTO receta_insumos"
  const res = await receta.PUT(req("/api/recetas/r1", "PUT", { insumos: [{ insumoId: "i1", cantidadBasePorPersona: 1 }] }), params("r1"))
  assert.equal(res.status, 500)
  const borrado = consultas.find((c) => c.query.includes("DELETE FROM receta_insumos"))
  assert.equal(borrado.enTransaccion, true, "el borrado es parte de lo que se deshace")
})

test("guardar y borrar un cóctel toca los ingredientes dentro de una transacción", async () => {
  reiniciar("administracion")
  const res = await coctel.PUT(req("/api/cocteles/c1", "PUT", { nombre: "MOJITO", insumos: [{ insumoBarraId: "b1", cantidadPorCoctel: 60 }] }), params("c1"))
  assert.equal(res.status, 200)
  const escrituras = consultas.filter((c) => /UPDATE cocteles|DELETE FROM coctel_insumos|INSERT INTO coctel_insumos/.test(c.query))
  assert.equal(escrituras.length, 3)
  assert.ok(escrituras.every((c) => c.enTransaccion))

  reiniciar("administracion")
  const borrar = await coctel.DELETE(req("/api/cocteles/c1", "DELETE"), params("c1"))
  assert.equal(borrar.status, 200)
  const borrados = consultas.filter((c) => /DELETE FROM coctel/.test(c.query))
  assert.equal(borrados.length, 2)
  assert.ok(borrados.every((c) => c.enTransaccion))
})

test("una receta o cóctel que no existe sigue dando 404", async () => {
  reiniciar("administracion")
  fallarSi = null
  const original = sql.begin
  sql.begin = async () => null
  try {
    assert.equal((await receta.PUT(req("/api/recetas/x", "PUT", { nombre: "X" }), params("x"))).status, 404)
    assert.equal((await coctel.PUT(req("/api/cocteles/x", "PUT", { nombre: "X" }), params("x"))).status, 404)
  } finally { sql.begin = original }
})

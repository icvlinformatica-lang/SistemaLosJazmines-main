// Embudo del simulador "Armá tu fiesta": dónde se quedan las visitas del link.
// - lib/clientes-embudo.ts: etapas, validación de lo que manda el navegador y
//   la cuenta del embudo.
// - /api/clientes/recorrido: anota solo las visitas del perfil "clientes", sin
//   datos personales, y sigue andando sin la tabla (migración 027 sin aplicar).
// - /api/clientes/embudo: solo Soporte.
// No toca ninguna base: las rutas corren con una base simulada.
// Correr: node --test scripts/test-clientes-embudo.cjs
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

const emb = require(path.join(RAIZ, "lib", "clientes-embudo.ts"))
const sim = require(path.join(RAIZ, "lib", "clientes-simulador.ts"))

// ── Funciones puras ─────────────────────────────────────────────────────────

test("etapas: portada, cada paso del simulador en orden, precio, datos y WhatsApp", () => {
  assert.deepEqual(
    emb.ETAPAS_EMBUDO.map((e) => e.id),
    ["portada", ...sim.PASOS_CLIENTE.map((p) => p.id), "precio", "datos", "whatsapp"],
  )
  assert.equal(new Set(emb.ETAPAS_EMBUDO.map((e) => e.id)).size, emb.ETAPAS_EMBUDO.length)
})

test("quién: solo Soporte ve el embudo y solo se anota el perfil clientes", () => {
  assert.equal(emb.puedeVerEmbudo("soporte"), true)
  for (const p of ["administracion", "clientes", "vendedor", "dj", null, undefined]) assert.equal(emb.puedeVerEmbudo(p), false, String(p))
  assert.equal(emb.seAnotaRecorrido("clientes"), true)
  for (const p of ["soporte", "administracion", null]) assert.equal(emb.seAnotaRecorrido(p), false, String(p))
})

test("validar: id y etapa obligatorios; festejo y salón solo si son válidos", () => {
  const id = "3f2a9c1e-1111-4222-8333-444455556666"
  assert.deepEqual(emb.validarPasoRecorrido({ id, etapa: "fecha", tipoEvento: "Casamiento", salon: "Casona" }), {
    id, etapa: "fecha", tipoEvento: "Casamiento", salon: "Casona",
  })
  assert.equal(typeof emb.validarPasoRecorrido(null), "string")
  assert.equal(typeof emb.validarPasoRecorrido({ etapa: "fecha" }), "string")
  assert.equal(typeof emb.validarPasoRecorrido({ id: "corto", etapa: "fecha" }), "string")
  assert.equal(typeof emb.validarPasoRecorrido({ id: "x'; drop table--", etapa: "fecha" }), "string")
  assert.equal(typeof emb.validarPasoRecorrido({ id, etapa: "pago" }), "string")
  // Lo que no es de la lista se descarta: nunca se guarda texto libre.
  const raro = emb.validarPasoRecorrido({ id, etapa: "salon", tipoEvento: "Juan Pérez 1140608208", salon: "<script>" })
  assert.equal(raro.tipoEvento, null)
  assert.equal(raro.salon, null)
  assert.equal(emb.validarPasoRecorrido({ id, etapa: "salon", salon: "Salon 4" }).salon, "Salon 4")
})

test("embudo: cuenta por etapa, porcentajes y dónde se fueron", () => {
  const filas = [
    { etapas: ["portada"], tipo_evento: null, salon: null },
    { etapas: ["portada", "festejo", "salon"], tipo_evento: "Casamiento", salon: null },
    { etapas: ["portada", "festejo", "salon", "fecha"], tipo_evento: "Casamiento", salon: "Casona" },
    { etapas: ["portada", "festejo", "salon", "fecha", "invitados", "menu", "barra", "detalles", "precio", "datos", "whatsapp"], tipo_evento: "Cumpleaños de 15", salon: "Quinta" },
    // Etapas fuera de orden o repetidas (otra pestaña, un reintento) cuentan una vez.
    { etapas: ["festejo", "portada", "festejo", "inventada"], tipo_evento: "Casamiento", salon: null },
  ]
  const e = emb.armarEmbudo(filas)
  assert.equal(e.visitas, 5)
  const por = Object.fromEntries(e.etapas.map((x) => [x.id, x]))
  assert.equal(por.portada.visitas, 5)
  assert.equal(por.portada.porcentaje, 100)
  assert.equal(por.festejo.visitas, 4)
  assert.equal(por.festejo.porcentaje, 80)
  assert.equal(por.salon.visitas, 3)
  assert.equal(por.fecha.visitas, 2)
  assert.equal(por.whatsapp.visitas, 1)
  assert.equal(por.whatsapp.porcentaje, 20)
  assert.equal(por.lugar.visitas, 0)
  // Los que no pidieron: 1 en la portada, 1 en salón, 1 en fecha, 1 en festejo.
  assert.deepEqual(
    e.seFueronEn.map((x) => [x.id, x.visitas]),
    [["portada", 1], ["festejo", 1], ["salon", 1], ["fecha", 1]],
  )
  assert.deepEqual(e.porFestejo, [
    { nombre: "Casamiento", visitas: 3, pidieron: 0 },
    { nombre: "Cumpleaños de 15", visitas: 1, pidieron: 1 },
  ])
  assert.deepEqual(e.porSalon.map((s) => s.salon).sort(), ["Casona", "Quinta"])
  const vacio = emb.armarEmbudo([])
  assert.equal(vacio.visitas, 0)
  assert.ok(vacio.etapas.every((x) => x.visitas === 0 && x.porcentaje === 0))
})

test("días del embudo: 7, 30 o 90; cualquier otra cosa, 30", () => {
  assert.equal(emb.diasEmbudo("7"), 7)
  assert.equal(emb.diasEmbudo("90"), 90)
  for (const v of [null, undefined, "", "365", "abc", "-1"]) assert.equal(emb.diasEmbudo(v), 30)
})

// ── Rutas, con la base simulada ─────────────────────────────────────────────

let perfilActual = "clientes"
let consultas = []
let falla = null
let respuesta = []
function db(strings, ...valores) {
  consultas.push({ texto: strings.join("?"), valores })
  if (falla) return Promise.reject(falla)
  return Promise.resolve(respuesta)
}

const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: db }
  if (request === "@/lib/stock-salones-server") return { perfilDesdeRequest: async () => perfilActual }
  return load.call(this, request, ...args)
}
const rutaRecorrido = require(path.join(RAIZ, "app", "api", "clientes", "recorrido", "route.ts"))
const rutaEmbudo = require(path.join(RAIZ, "app", "api", "clientes", "embudo", "route.ts"))
Module._load = load

const ID = "3f2a9c1e-1111-4222-8333-444455556666"
const anotar = (body) =>
  rutaRecorrido.POST(new Request("http://local/api/clientes/recorrido", { method: "POST", body: JSON.stringify(body) }))
const verEmbudo = (q = "") => rutaEmbudo.GET(new Request(`http://local/api/clientes/embudo${q}`))

function limpiar() {
  consultas = []
  falla = null
  respuesta = []
}

test("recorrido: sin la vista de Clientes, 403 y no toca la base", async () => {
  for (const p of ["administracion", "vendedor", "dj", null]) {
    perfilActual = p
    limpiar()
    assert.equal((await anotar({ id: ID, etapa: "portada" })).status, 403, String(p))
    assert.equal(consultas.length, 0)
  }
})

test("recorrido: lo de Soporte no se guarda", async () => {
  perfilActual = "soporte"
  limpiar()
  const res = await anotar({ id: ID, etapa: "fecha", tipoEvento: "Casamiento", salon: "Casona" })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true, guardado: false })
  assert.equal(consultas.length, 0)
})

test("recorrido: el link anota la etapa con un upsert idempotente y sin datos personales", async () => {
  perfilActual = "clientes"
  limpiar()
  const res = await anotar({
    id: ID, etapa: "whatsapp", tipoEvento: "Casamiento", salon: "Casona",
    // Aunque el navegador mandara los datos de la hoja, no se guardan.
    nombre: "Juan Pérez", whatsapp: "1140608208", email: "juan@example.com",
  })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true, guardado: true })
  assert.equal(consultas.length, 1)
  const { texto, valores } = consultas[0]
  assert.match(texto, /INSERT INTO simulador_recorridos/)
  assert.match(texto, /ON CONFLICT \(id\) DO UPDATE/)
  assert.match(texto, /ANY\(simulador_recorridos\.etapas\)/) // no repite la etapa
  assert.match(texto, /simulador_recorridos\.whatsapp OR EXCLUDED\.whatsapp/)
  assert.deepEqual(valores.slice(0, 6), [ID, "whatsapp", "whatsapp", "Casamiento", "Casona", true])
  const todo = JSON.stringify(valores)
  for (const dato of ["Juan", "Pérez", "1140608208", "juan@example.com"]) assert.equal(todo.includes(dato), false, dato)
})

test("recorrido: datos inválidos, 400 sin tocar la base", async () => {
  perfilActual = "clientes"
  limpiar()
  assert.equal((await anotar({ id: "x", etapa: "portada" })).status, 400)
  assert.equal((await anotar({ id: ID, etapa: "cobro" })).status, 400)
  const sinJson = await rutaRecorrido.POST(new Request("http://local/api/clientes/recorrido", { method: "POST", body: "{no" }))
  assert.equal(sinJson.status, 400)
  assert.equal(consultas.length, 0)
})

test("recorrido: sin la tabla (027 sin aplicar) responde ok sin guardar; otro error, 500", async () => {
  perfilActual = "clientes"
  limpiar()
  falla = Object.assign(new Error('relation "simulador_recorridos" does not exist'), { code: "42P01" })
  const res = await anotar({ id: ID, etapa: "portada" })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true, guardado: false, sinTabla: true })
  falla = new Error("se cortó la conexión")
  const orig = console.error
  console.error = () => {}
  try {
    assert.equal((await anotar({ id: ID, etapa: "portada" })).status, 500)
  } finally {
    console.error = orig
  }
})

test("embudo: solo Soporte; el perfil clientes no lo ve", async () => {
  for (const p of ["clientes", "administracion", "vendedor", null]) {
    perfilActual = p
    limpiar()
    assert.equal((await verEmbudo()).status, 403, String(p))
    assert.equal(consultas.length, 0)
  }
})

test("embudo: Soporte lo ve por período, con la cuenta de armarEmbudo", async () => {
  perfilActual = "soporte"
  limpiar()
  respuesta = [
    { etapas: ["portada", "festejo"], tipo_evento: "Bautismo", salon: null },
    { etapas: ["portada", "festejo", "salon", "fecha", "invitados", "menu", "barra", "detalles", "precio", "datos", "whatsapp"], tipo_evento: "Bautismo", salon: "Salon" },
  ]
  const res = await verEmbudo("?dias=7")
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("Cache-Control"), "no-store")
  const json = await res.json()
  assert.equal(json.dias, 7)
  assert.equal(json.visitas, 2)
  assert.deepEqual(json.porFestejo, [{ nombre: "Bautismo", visitas: 2, pidieron: 1 }])
  assert.equal(consultas.length, 1)
  assert.match(consultas[0].texto, /SELECT etapas, tipo_evento, salon FROM simulador_recorridos/)
  assert.equal(consultas[0].valores[0], 7)
  // Un período raro cae en 30.
  limpiar()
  await verEmbudo("?dias=9999")
  assert.equal(consultas[0].valores[0], 30)
})

test("embudo: sin la tabla avisa con sinTabla, en cero", async () => {
  perfilActual = "soporte"
  limpiar()
  falla = Object.assign(new Error('relation "simulador_recorridos" does not exist'), { code: "42P01" })
  const json = await (await verEmbudo()).json()
  assert.equal(json.ok, true)
  assert.equal(json.sinTabla, true)
  assert.equal(json.visitas, 0)
})

test("la migración 027 crea la tabla sin columnas de datos personales, con RLS y sin permisos públicos", () => {
  const sqlTexto = fs.readFileSync(path.join(RAIZ, "scripts", "027_simulador_recorridos.sql"), "utf8")
  assert.match(sqlTexto, /SOLO ADITIVA/)
  assert.match(sqlTexto, /create table if not exists simulador_recorridos/)
  assert.match(sqlTexto, /enable row level security/)
  assert.match(sqlTexto, /revoke all on simulador_recorridos from anon, authenticated/)
  const columnas = sqlTexto.match(/create table if not exists simulador_recorridos \(([\s\S]*?)\n\);/)[1]
  for (const prohibida of ["nombre", "telefono", "whatsapp_numero", "email", "mail", "ip", "dni"]) {
    assert.equal(new RegExp(`^\\s*${prohibida}\\s`, "m").test(columnas), false, prohibida)
  }
  assert.equal(/\bdrop\b|\bdelete\b|\bupdate\b/i.test(sqlTexto.replace(/--.*$/gm, "")), false)
})

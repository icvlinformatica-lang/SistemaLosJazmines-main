// Rutas: cronograma (quién lo puede guardar) y las columnas nuevas de
// eventos (notas por oficio, dietas con su tipo, origen) en el PATCH y el POST.
// Correr: node --test scripts/test-staff-evento-api.cjs
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

let perfil = "administracion"
let consultas = []
let evento = null

function sqlMock(parts, ...values) {
  const query = parts.join("?")
  consultas.push({ query, values })
  if (query.includes("SELECT nombre, horario FROM eventos")) return Promise.resolve(evento ? [evento] : [])
  if (query.includes("INSERT INTO eventos")) return Promise.resolve([{ insertado: true }])
  if (query.includes("FROM eventos")) return Promise.resolve(evento ? [evento] : [])
  return Promise.resolve([])
}
sqlMock.json = (v) => ({ json: v })
sqlMock.unsafe = async (query, values) => { consultas.push({ query, values }); return [] }
sqlMock.begin = async (fn) => fn(sqlMock)

function cargar(ruta) {
  const load = Module._load
  Module._load = function (request, ...args) {
    if (request === "@/lib/db") return { sql: sqlMock, generateId: () => "nuevo" }
    if (request === "@/lib/activity-logger") return { logActivity: async () => {} }
    if (request === "@/lib/event-notifications") return { sendEventNotification: async () => {} }
    if (request === "@/lib/stock-salones-server") return { perfilDesdeRequest: async () => perfil }
    return load.call(this, request, ...args)
  }
  try {
    const resuelto = path.join(__dirname, "..", ruta)
    delete require.cache[require.resolve(resuelto)]
    return require(resuelto)
  } finally {
    Module._load = load
  }
}

const cronogramaRoute = cargar("app/api/eventos/[id]/cronograma/route.ts")
const eventoRoute = cargar("app/api/eventos/[id]/route.ts")
const eventosRoute = cargar("app/api/eventos/route.ts")

const pedido = (body) => new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify(body) })
const params = { params: Promise.resolve({ id: "ev1" }) }

function reset() {
  consultas = []
  evento = { id: "ev1", nombre: "PRUEBA", horario: "21:00", salon: "Quinta", estado: "pendiente", plan_de_cuotas: null, pagos: [] }
}

test("cronograma: DJ, Cocina, Vendedor o sin sesión no lo pueden guardar", async () => {
  for (const p of ["dj", "fotografo", "cocina", "vendedor", "cobro", null]) {
    reset(); perfil = p
    const res = await cronogramaRoute.PATCH(pedido({ cronograma: [] }), params)
    assert.equal(res.status, 403, `perfil ${p}`)
    assert.equal(consultas.length, 0)
  }
})

test("cronograma: Coordinación y Administración sí, validado y en orden de la noche", async () => {
  for (const p of ["coordinacion", "administracion", "soporte"]) {
    reset(); perfil = p
    const res = await cronogramaRoute.PATCH(pedido({ cronograma: [
      { id: "b", hora: "01:30", momento: "Carioca", perfiles: ["dj"] },
      { id: "a", hora: "22:00", momento: "Entrada", perfiles: ["dj", "hacker"] },
      { id: "c", hora: "xx", momento: "mal" },
    ] }), params)
    assert.equal(res.status, 200, `perfil ${p}`)
    const { cronograma } = await res.json()
    assert.deepEqual(cronograma.map((m) => m.momento), ["Entrada", "Carioca"])
    assert.deepEqual(cronograma[0].perfiles, ["dj"])
    const update = consultas.find((c) => c.query.includes("UPDATE eventos SET cronograma"))
    assert.ok(update)
    assert.deepEqual(update.values[0].json.map((m) => m.id), ["a", "b"])
  }
})

test("cronograma: vacío se guarda como null; sin lista, 400; evento inexistente, 404", async () => {
  reset(); perfil = "coordinacion"
  let res = await cronogramaRoute.PATCH(pedido({ cronograma: [] }), params)
  assert.equal(res.status, 200)
  assert.equal(consultas.find((c) => c.query.includes("UPDATE eventos SET cronograma")).values[0], null)
  reset()
  res = await cronogramaRoute.PATCH(pedido({}), params)
  assert.equal(res.status, 400)
  reset(); evento = null
  res = await cronogramaRoute.PATCH(pedido({ cronograma: [] }), params)
  assert.equal(res.status, 404)
})

test("PATCH del evento: guarda notas, dietas y origen validados, e ignora el cronograma", async () => {
  reset(); perfil = "administracion"
  const res = await eventoRoute.PATCH(pedido({
    notasStaffPerfil: { dj: "Entrada con Coldplay", cocina: "no va" },
    dietasDetalle: [{ tipo: "celiaco", cantidad: 2 }, { tipo: "inventada", cantidad: 3 }],
    origenCliente: "instagram",
    cronograma: [{ hora: "22:00", momento: "No debería guardarse" }],
  }), params)
  assert.equal(res.status, 200)
  const update = consultas.find((c) => c.query.startsWith("UPDATE eventos SET"))
  assert.ok(update, "hubo UPDATE")
  assert.doesNotMatch(update.query, /cronograma/)
  const valor = (col) => {
    const m = update.query.match(new RegExp(`${col} = \\$(\\d+)`))
    return m ? update.values[Number(m[1]) - 1] : undefined
  }
  assert.deepEqual(JSON.parse(valor("notas_staff_perfil")), { dj: "Entrada con Coldplay" })
  assert.deepEqual(JSON.parse(valor("dietas_detalle")), [{ tipo: "celiaco", cantidad: 2 }])
  assert.equal(valor("origen_cliente"), "instagram")
})

test("PATCH del evento: origen inventado o detalle vacío se guardan como null", async () => {
  reset(); perfil = "administracion"
  await eventoRoute.PATCH(pedido({ origenCliente: "tiktok", dietasDetalle: [] }), params)
  const update = consultas.find((c) => c.query.startsWith("UPDATE eventos SET"))
  assert.deepEqual(update.values.slice(0, 2), [null, null])
})

test("PATCH del evento sin los campos nuevos no nombra las columnas nuevas", async () => {
  reset(); perfil = "administracion"
  await eventoRoute.PATCH(pedido({ nombre: "PRUEBA 2" }), params)
  const update = consultas.find((c) => c.query.startsWith("UPDATE eventos SET"))
  assert.doesNotMatch(update.query, /notas_staff_perfil|dietas_detalle|origen_cliente|cronograma/)
})

test("POST: el alta sin campos nuevos no los nombra; con campos, van en un UPDATE dentro de la transacción", async () => {
  reset()
  const base = { fecha: "2026-11-14", salon: "Quinta", nombre: "PRUEBA" }
  let res = await eventosRoute.POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify(base) }))
  assert.equal(res.status, 201)
  assert.ok(!consultas.some((c) => /notas_staff_perfil|dietas_detalle|origen_cliente/.test(c.query.split("FROM")[0]) && !c.query.includes("to_jsonb")))
  reset()
  res = await eventosRoute.POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ ...base, origenCliente: "google", dietasDetalle: [{ tipo: "vegano", cantidad: 1 }] }) }))
  assert.equal(res.status, 201)
  const update = consultas.find((c) => c.query.startsWith("UPDATE eventos SET"))
  assert.match(update.query, /dietas_detalle = \$1, origen_cliente = \$2 WHERE id = \$3/)
  assert.deepEqual(update.values, [JSON.stringify([{ tipo: "vegano", cantidad: 1 }]), "google", "nuevo"])
})

test("GET de un evento devuelve los campos nuevos solo si tienen algo", async () => {
  reset()
  evento = { ...evento, notas_staff_perfil: '{"dj":"x"}', cronograma: null, dietas_detalle: [], origen_cliente: "recomendacion" }
  const res = await eventoRoute.GET(new Request("http://localhost/x"), params)
  const json = await res.json()
  assert.deepEqual(json.notasStaffPerfil, { dj: "x" })
  assert.equal("cronograma" in json, false)
  assert.equal("dietasDetalle" in json, false)
  assert.equal(json.origenCliente, "recomendacion")
})

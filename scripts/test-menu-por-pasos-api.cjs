// Menú por pasos en las rutas del vendedor: se puede guardar el borrador con
// el menú incompleto, pero no enviarlo a Administración.
// Correr: node --test scripts/test-menu-por-pasos-api.cjs
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

// Platos del recetario (costo por porción; con 50 % de ganancia: $3.000, $6.000, $5.250 y $1.500).
const PLATOS = [
  { id: "e1", nombre: "Empanadas", categoria: "Entrada", costoPorPorcion: 2000 },
  { id: "p1", nombre: "Vacío", categoria: "Plato Principal", costoPorPorcion: 4000 },
  { id: "p2", nombre: "Pollo", categoria: "Plato Principal", costoPorPorcion: 3500 },
  { id: "d1", nombre: "Helado", categoria: "Postre", costoPorPorcion: 1000 },
]
const config = (salon, recetas) => ({
  salon, costoSalon: 1000000, capacidadMaxima: 130,
  gananciaSalon: 50, gananciaCocina: 50, gananciaBarra: 50, gananciaServicios: 0,
  recargoSabado: { tipo: "monto", valor: 0, rubros: ["salon"] },
  recetas, barras: [], servicios: [], reglasPersonal: [],
})
// Quinta ofrece los tres pasos; "Salon" solo platos principales.
const CONFIGS = { Quinta: config("Quinta", ["e1", "p1", "p2", "d1"]), Salon: config("Salon", ["p1", "p2"]) }

let consultas, respuestaUpdate, filaSelect
const db = async (parts, ...values) => {
  const query = parts.join("?")
  consultas.push({ query, values })
  if (query.includes("INSERT INTO cotizaciones")) return [{ id: "cot-1", estado: values[values.length - 1] }]
  if (query.includes("UPDATE cotizaciones")) return respuestaUpdate
  if (query.includes("SELECT estado")) return filaSelect ? [filaSelect] : []
  throw new Error(`Consulta inesperada: ${query}`)
}
db.json = (valor) => ({ json: valor })

const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: db }
  if (request === "@/lib/cotizador-salon-servidor") {
    return {
      leerConfigSalon: async (salon) => CONFIGS[salon],
      leerServiciosConCosto: async () => [],
      leerPersonalConTarifa: async () => [],
    }
  }
  if (request === "@/lib/cotizador-config-servidor") return { leerCostosPlatos: async () => PLATOS, leerBarrasArmadas: async () => [] }
  if (request === "@/lib/precio-barra-servidor") return { leerPreciosCocteles: async () => [] }
  if (request === "@/lib/fechas-especiales-servidor") return { leerFechasEspeciales: async () => [] }
  return load.call(this, request, ...args)
}
const { POST: guardarCotizacion } = require("../app/api/vendedor/cotizaciones/route.ts")
const { POST: enviarDesdeLista } = require("../app/api/vendedor/cotizaciones/[id]/enviar/route.ts")
Module._load = load

function pedido(cuerpo) {
  return new Request("http://local/api/vendedor/cotizaciones", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clienteNombre: "PRUEBA Cliente", salon: "Quinta", adultos: 70, ninos: 10, barraId: null, servicios: [], ...cuerpo }),
  })
}
async function llamar(cuerpo) {
  consultas = []
  const res = await guardarCotizacion(pedido(cuerpo))
  return { status: res.status, body: await res.json() }
}
const desgloseGuardado = () => {
  const insert = consultas.find((c) => c.query.includes("INSERT INTO cotizaciones"))
  // desglose_venta es el 12.º valor del INSERT (ver el orden de columnas en la ruta)
  return insert.values[11].json
}

test("enviar con el menú incompleto: 400, dice qué falta y no guarda nada", async () => {
  const r = await llamar({ accion: "enviar", recetas: ["p1"] })
  assert.equal(r.status, 400)
  assert.equal(r.body.error, "Para enviarla falta elegir una entrada y un postre del menú")
  assert.equal(consultas.length, 0)
})

test("guardar el borrador con el menú incompleto sí se puede, y queda anotado qué falta", async () => {
  const r = await llamar({ accion: "guardar", recetas: ["p1"] })
  assert.equal(r.status, 200)
  assert.equal(r.body.estado, "borrador")
  assert.deepEqual(desgloseGuardado().pasosMenuFaltantes, ["Entrada", "Postre"])
})

test("con entrada, principal y postre se envía y la Cocina suma los tres: $10.500 × 80 = $840.000", async () => {
  const r = await llamar({ accion: "enviar", recetas: ["e1", "p1", "d1"] })
  assert.equal(r.status, 200)
  assert.equal(r.body.estado, "lista_para_revisar")
  assert.equal(r.body.rubros.find((x) => x.clave === "cocina").precio, 840000)
  assert.equal(r.body.total, 1500000 + 840000)
  const desglose = desgloseGuardado()
  assert.deepEqual(desglose.pasosMenuFaltantes, [])
  assert.deepEqual(desglose.recetas.map((x) => x.categoria), ["Entrada", "Plato Principal", "Postre"])
})

test("dos principales se promedian: $3.000 + ($6.000 + $5.250) ÷ 2 + $1.500 = $10.125 × 80 = $810.000", async () => {
  const r = await llamar({ accion: "enviar", recetas: ["e1", "p1", "p2", "d1"] })
  assert.equal(r.status, 200)
  assert.equal(r.body.rubros.find((x) => x.clave === "cocina").precio, 810000)
})

test("un salón que solo ofrece principales no pide entrada ni postre", async () => {
  const r = await llamar({ accion: "enviar", salon: "Salon", recetas: ["p1"] })
  assert.equal(r.status, 200)
  assert.equal(r.body.estado, "lista_para_revisar")
})

test("sin menú no se pide nada", async () => {
  const r = await llamar({ accion: "enviar", recetas: [] })
  assert.equal(r.status, 200)
  assert.deepEqual(desgloseGuardado().pasosMenuFaltantes, [])
})

async function enviar(update, fila) {
  consultas = []
  respuestaUpdate = update
  filaSelect = fila
  const res = await enviarDesdeLista(new Request("http://local/x", { method: "POST" }), { params: Promise.resolve({ id: "cot-1" }) })
  return { status: res.status, body: await res.json() }
}

test("el botón Enviar de la lista no manda un borrador con el menú incompleto", async () => {
  const r = await enviar([], { estado: "borrador", supera: false, faltantes: ["Entrada", "Postre"] })
  assert.equal(r.status, 400)
  assert.equal(r.body.error, "Falta elegir una entrada y un postre del menú: abrila y completala")
  // El UPDATE ya filtra por los pasos que faltan (no depende del SELECT)
  assert.match(consultas[0].query, /pasosMenuFaltantes/)
  // jsonb que llegó como texto: también se entiende
  const comoTexto = await enviar([], { estado: "rechazada", supera: false, faltantes: '["Postre"]' })
  assert.equal(comoTexto.body.error, "Falta elegir un postre del menú: abrila y completala")
})

test("el botón Enviar de la lista sigue funcionando con el menú completo o sin menú", async () => {
  const r = await enviar([{ id: "cot-1", estado: "lista_para_revisar" }], null)
  assert.equal(r.status, 200)
  assert.equal(r.body.estado, "lista_para_revisar")
  // Ya enviada (otro estado): el mismo 409 de antes
  const otra = await enviar([], { estado: "lista_para_revisar", supera: false, faltantes: null })
  assert.equal(otra.status, 409)
})

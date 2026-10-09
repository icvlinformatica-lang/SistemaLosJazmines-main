// Teléfono del cliente en las cotizaciones del vendedor: se guarda en el alta
// y en la edición, y una pantalla vieja que no lo manda no lo borra.
// Correr: node --test scripts/test-cotizacion-telefono-api.cjs
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

const CONFIG = {
  salon: "Quinta", costoSalon: 1000000, capacidadMaxima: 130,
  gananciaSalon: 50, gananciaCocina: 50, gananciaBarra: 50, gananciaServicios: 0,
  recargoSabado: { tipo: "monto", valor: 0, rubros: ["salon"] },
  recetas: [], barras: [], servicios: [], reglasPersonal: [],
}

let consultas
const db = async (parts, ...values) => {
  const query = parts.join("?")
  consultas.push({ query, values })
  if (query.includes("INSERT INTO cotizaciones")) return [{ id: "cot-1", estado: values[values.length - 1] }]
  if (query.includes("UPDATE cotizaciones")) return [{ id: "cot-1", estado: "borrador" }]
  throw new Error(`Consulta inesperada: ${query}`)
}
db.json = (valor) => ({ json: valor })

const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: db }
  if (request === "@/lib/cotizador-salon-servidor") {
    return { leerConfigSalon: async () => CONFIG, leerServiciosConCosto: async () => [], leerPersonalConTarifa: async () => [] }
  }
  if (request === "@/lib/cotizador-config-servidor") return { leerCostosPlatos: async () => [], leerBarrasArmadas: async () => [] }
  if (request === "@/lib/precio-barra-servidor") return { leerPreciosCocteles: async () => [] }
  if (request === "@/lib/fechas-especiales-servidor") return { leerFechasEspeciales: async () => [] }
  return load.call(this, request, ...args)
}
const { POST } = require("../app/api/vendedor/cotizaciones/route.ts")
Module._load = load

async function guardar(cuerpo) {
  consultas = []
  const res = await POST(new Request("http://local/api/vendedor/cotizaciones", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clienteNombre: "PRUEBA Cliente", salon: "Quinta", adultos: 50, ninos: 0, recetas: [], barraId: null, servicios: [], ...cuerpo }),
  }))
  assert.equal(res.status, 200)
  return consultas[0]
}
/** Valor que acompaña a una columna en el SQL armado (por el texto que la precede). */
function valorDe(consulta, antesDe) {
  const partes = consulta.query.split("?")
  const i = partes.findIndex((p) => p.includes(antesDe))
  assert.ok(i >= 0, `no está ${antesDe}`)
  return consulta.values[i]
}

test("alta: el teléfono se guarda sin espacios de más; vacío queda en null", async () => {
  const insert = await guardar({ clienteTelefono: "  11 1234-5678 " })
  assert.match(insert.query, /avisos, cliente_telefono, estado/)
  // Orden de los valores: ..., avisos, cliente_telefono, estado.
  assert.equal(insert.values[insert.values.length - 2], "11 1234-5678")
  const sinTel = await guardar({ clienteTelefono: "   " })
  assert.equal(sinTel.values[sinTel.values.length - 2], null)
})

test("edición: guarda el teléfono nuevo, y si no viene en el pedido conserva el guardado", async () => {
  const conTel = await guardar({ id: "cot-1", clienteTelefono: "351 555 1234" })
  assert.match(conTel.query, /cliente_telefono = CASE WHEN \? THEN \? ELSE cliente_telefono END/)
  assert.equal(valorDe(conTel, "cliente_telefono = CASE WHEN"), true)
  // El valor que sigue al CASE WHEN es el del THEN: el teléfono nuevo.
  const i = conTel.query.split("?").findIndex((p) => p.includes("cliente_telefono = CASE WHEN"))
  assert.equal(conTel.values[i + 1], "351 555 1234")

  const sinCampo = await guardar({ id: "cot-1" })
  assert.equal(valorDe(sinCampo, "cliente_telefono = CASE WHEN"), false)
})

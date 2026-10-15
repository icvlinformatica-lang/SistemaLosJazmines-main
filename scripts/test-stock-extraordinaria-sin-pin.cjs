// Carga extraordinaria de stock (/stock, sin evento terminado pendiente):
// Cocina con su stock y Barra con el suyo cargan sin el PIN de stock.
// Administración y Soporte siguen necesitándolo, y nadie carga sin PIN el
// sector de otro. Se prueba la regla pura y la ruta que la aplica
// (app/api/stock-salones/sesiones), con la base y la sesión simuladas.
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

const { extraordinariaSinPin } = require("../lib/stock-salones.ts")

test("Cocina y Barra cargan su propio stock sin PIN", () => {
  assert.equal(extraordinariaSinPin("cocina", "cocina"), true)
  assert.equal(extraordinariaSinPin("barra", "barra"), true)
})

test("nadie carga sin PIN el sector de otro, y Administración sigue con PIN", () => {
  assert.equal(extraordinariaSinPin("cocina", "barra"), false)
  assert.equal(extraordinariaSinPin("barra", "cocina"), false)
  for (const perfil of ["administracion", "soporte", "dj", "vendedor", null, undefined, ""]) {
    assert.equal(extraordinariaSinPin(perfil, "cocina"), false)
    assert.equal(extraordinariaSinPin(perfil, "barra"), false)
  }
  assert.equal(extraordinariaSinPin("barra", null), false)
})

// ── La ruta ─────────────────────────────────────────────────────────────
let perfil, pendiente, guardadas
const PIN_OK = "4321"
const db = async (parts) => {
  const q = parts.join("?")
  if (q.includes("FROM insumos_barra")) return [{ id: "fernet", descripcion: "FERNET", unidad: "UN" }]
  if (q.includes("FROM insumos")) return [{ id: "harina", descripcion: "HARINA", unidad: "KG" }]
  throw new Error(`Consulta inesperada: ${q}`)
}
db.begin = async (fn) => {
  const tx = async (parts, ...values) => {
    const q = parts.join("?")
    if (q.includes("INSERT INTO stock_sesiones")) {
      guardadas.push({ motivo: values[5], eventoId: values[4] })
      return [{ id: values[0] }]
    }
    if (q.includes("SELECT cantidad FROM stock_salones")) return []
    if (q.includes("SUM(cantidad)")) return [{ total: "3" }]
    return []
  }
  return fn(tx)
}
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: db }
  if (request === "@/lib/auth/server") return { verifyPinStockExtra: (pin) => pin === PIN_OK }
  if (request === "@/lib/stock-salones-server") {
    return {
      perfilDesdeRequest: async () => perfil,
      salonesConfigurados: async () => new Map([["Casona", "Casona"]]),
      eventoPendienteEnBase: async () => pendiente,
      fechaHoraCortaArgentina: () => "15/10 21:00",
    }
  }
  return load.call(this, request, ...args)
}
const { POST } = require("../app/api/stock-salones/sesiones/route.ts")
Module._load = load

let n = 0
const cargar = (sector, pin) => {
  n++
  const insumoId = sector === "cocina" ? "harina" : "fernet"
  return POST(new Request("http://localhost/api/stock-salones/sesiones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sesionId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      salon: "Casona",
      sector,
      cargadoPor: "PRUEBA",
      pin,
      items: [{ insumoId, cantidad: 3 }],
    }),
  }))
}
const reset = (p) => { perfil = p; pendiente = null; guardadas = [] }

test("Barra guarda una carga extraordinaria de barra sin PIN", async () => {
  reset("barra")
  const res = await cargar("barra")
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.motivo, "extraordinaria")
  assert.deepEqual(guardadas, [{ motivo: "extraordinaria", eventoId: null }])
})

test("Cocina guarda una carga extraordinaria de cocina sin PIN", async () => {
  reset("cocina")
  const res = await cargar("cocina")
  assert.equal(res.status, 200)
  assert.equal((await res.json()).motivo, "extraordinaria")
})

test("Barra no puede cargar cocina (ni con PIN), ni Cocina barra", async () => {
  reset("barra")
  assert.equal((await cargar("cocina", PIN_OK)).status, 403)
  reset("cocina")
  assert.equal((await cargar("barra", PIN_OK)).status, 403)
  assert.equal(guardadas.length, 0)
})

test("Administración sigue necesitando el PIN para la carga extraordinaria", async () => {
  reset("administracion")
  const sinPin = await cargar("barra")
  assert.equal(sinPin.status, 403)
  assert.equal((await sinPin.json()).necesitaPin, true)
  assert.equal((await cargar("cocina", "9999")).status, 403)
  assert.equal(guardadas.length, 0)
  assert.equal((await cargar("barra", PIN_OK)).status, 200)
})

test("con un evento terminado pendiente sigue siendo carga por evento", async () => {
  reset("barra")
  pendiente = { evento: { id: "ev-1" } }
  const res = await cargar("barra")
  assert.equal(res.status, 200)
  assert.equal((await res.json()).motivo, "evento")
  assert.deepEqual(guardadas, [{ motivo: "evento", eventoId: "ev-1" }])
})

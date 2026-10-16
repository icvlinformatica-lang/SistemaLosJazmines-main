// Carga de stock de /stock (app/api/stock-salones/sesiones): se carga en
// cualquier momento y sin PIN, cada perfil solo su sector (Cocina cocina,
// Barra barra, Administración y Soporte los dos), y el historial de cargas
// (GET) respeta lo mismo. La base y la sesión están simuladas.
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

// ── La ruta ─────────────────────────────────────────────────────────────
let perfil, pendiente, guardadas, consultasHistorial
const PIN_OK = "4321"
const db = async (parts, ...values) => {
  const q = parts.join("?")
  if (q.includes("FROM stock_sesiones")) {
    consultasHistorial.push(values)
    return [{ id: "s1", cargado_por: "PRUEBA", cerrada_en: new Date("2026-10-15T23:00:00Z"), iniciada_en: new Date("2026-10-15T22:50:00Z"), cantidad_items: 4 }]
  }
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
const { GET, POST } = require("../app/api/stock-salones/sesiones/route.ts")
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
const reset = (p) => { perfil = p; pendiente = null; guardadas = []; consultasHistorial = [] }
const historial = (sector, salon = "Casona") =>
  GET(new Request(`http://localhost/api/stock-salones/sesiones?salon=${salon}&sector=${sector}`))

test("Barra guarda su stock sin PIN, en cualquier momento", async () => {
  reset("barra")
  const res = await cargar("barra")
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.motivo, "extraordinaria")
  assert.deepEqual(guardadas, [{ motivo: "extraordinaria", eventoId: null }])
})

test("Cocina guarda su stock sin PIN, en cualquier momento", async () => {
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

test("Administración y Soporte también cargan sin PIN", async () => {
  reset("administracion")
  assert.equal((await cargar("barra")).status, 200)
  reset("soporte")
  assert.equal((await cargar("cocina")).status, 200)
})

test("un perfil que no carga stock no puede cargar", async () => {
  reset("dj")
  assert.equal((await cargar("barra", PIN_OK)).status, 403)
  assert.equal(guardadas.length, 0)
})

test("historial: Barra ve las cargas de barra del salón, con fecha", async () => {
  reset("barra")
  const res = await historial("barra")
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.deepEqual(data.sesiones, [{ id: "s1", cargadoPor: "PRUEBA", fecha: "2026-10-15T23:00:00.000Z", cantidadItems: 4 }])
  assert.deepEqual(consultasHistorial, [["Casona", "barra"]])
})

test("historial: nadie ve el de otro sector, ni un salón inválido", async () => {
  reset("barra")
  assert.equal((await historial("cocina")).status, 403)
  reset("dj")
  assert.equal((await historial("barra")).status, 403)
  reset("cocina")
  assert.equal((await historial("cocina", "Inventado")).status, 400)
  assert.equal(consultasHistorial.length, 0)
})

test("con un evento terminado pendiente sigue siendo carga por evento", async () => {
  reset("barra")
  pendiente = { evento: { id: "ev-1" } }
  const res = await cargar("barra")
  assert.equal(res.status, 200)
  assert.equal((await res.json()).motivo, "evento")
  assert.deepEqual(guardadas, [{ motivo: "evento", eventoId: "ev-1" }])
})

// Vajilla y utensilios de cocina (pedido de Rodrigo, 27/10/2026).
// - Cuarto sector del stock por salón: 'vajilla', con su lista en
//   insumos_vajilla (scripts/028). Sin precio ni stock_actual: el total es la
//   suma de los salones y no toca costos ni cajas.
// - Cocina la arma, la cuenta en /stock y corrige cada salón con el lapicito;
//   Administración y Soporte también. Los demás perfiles, nada.
// La base y la sesión están simuladas.
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

const {
  sectoresPermitidos,
  puedeEditarCatalogoVajilla,
  puedeVerStockSector,
  sectorConStockActual,
  esSectorStock,
} = require("../lib/stock-salones.ts")
const { validarArticuloVajilla, articuloVajillaDesdeFila, nombreRepetido } = require("../lib/insumos-vajilla.ts")
const { validarAjusteAlmacen } = require("../lib/stock-ajuste-almacen.ts")

const UUID = "00000000-0000-4000-8000-000000000001"

// ── Permisos ────────────────────────────────────────────────────────────
test("vajilla la cuentan Cocina, Administración y Soporte; nadie más", () => {
  assert.equal(esSectorStock("vajilla"), true)
  for (const p of ["cocina", "administracion", "soporte"]) assert.equal(sectoresPermitidos(p).includes("vajilla"), true)
  for (const p of ["barra", "mantenimiento", "dj", "cobro", "vendedor", "coordinacion", "clientes", null]) {
    assert.equal(sectoresPermitidos(p).includes("vajilla"), false)
  }
})

test("la lista de vajilla la arman Cocina, Administración y Soporte", () => {
  for (const p of ["cocina", "administracion", "soporte"]) assert.equal(puedeEditarCatalogoVajilla(p), true)
  for (const p of ["barra", "mantenimiento", "dj", "cobro", "vendedor", null]) assert.equal(puedeEditarCatalogoVajilla(p), false)
})

test("Cocina ve y corrige por salón SOLO su vajilla; sus insumos siguen siendo de Administración", () => {
  assert.equal(puedeVerStockSector("cocina", "vajilla"), true)
  assert.equal(puedeVerStockSector("cocina", "cocina"), false)
  assert.equal(puedeVerStockSector("cocina", "barra"), false)
  assert.equal(puedeVerStockSector("cocina", "limpieza"), false)
  for (const s of ["cocina", "barra", "limpieza", "vajilla"]) {
    assert.equal(puedeVerStockSector("administracion", s), true)
    assert.equal(puedeVerStockSector("soporte", s), true)
  }
  assert.equal(puedeVerStockSector("mantenimiento", "vajilla"), false)
  assert.equal(puedeVerStockSector("barra", "vajilla"), false)
})

test("solo cocina y barra tienen stock_actual: vajilla y limpieza no", () => {
  assert.equal(sectorConStockActual("cocina"), true)
  assert.equal(sectorConStockActual("barra"), true)
  assert.equal(sectorConStockActual("limpieza"), false)
  assert.equal(sectorConStockActual("vajilla"), false)
})

test("Cocina tiene la pantalla en sus rutas y en su menú", () => {
  const perfiles = fs.readFileSync(path.join(__dirname, "../lib/profile-context.tsx"), "utf8")
  assert.match(perfiles, /rutas: \["\/eventos\/produccion", "\/stock", "\/admin\/vajilla"\]/)
  const menu = fs.readFileSync(path.join(__dirname, "../components/sidebar.tsx"), "utf8")
  assert.equal((menu.match(/href: "\/admin\/vajilla", label: "Vajilla y utensilios"/g) || []).length, 2)
})

// ── Lista (lógica pura) ─────────────────────────────────────────────────
test("validar un artículo: nombre obligatorio, unidad en mayúsculas (UN si falta), categoría opcional, sin precio", () => {
  assert.deepEqual(validarArticuloVajilla({ id: UUID, descripcion: "  Plato   playo ", unidad: "docena", categoria: " Vajilla " }), {
    ok: true,
    articulo: { id: UUID, descripcion: "Plato playo", unidad: "DOCENA", categoria: "Vajilla" },
  })
  const sinUnidad = validarArticuloVajilla({ id: UUID, descripcion: "Olla 20 L", precioUnitario: 50000 })
  assert.equal(sinUnidad.ok && sinUnidad.articulo.unidad, "UN")
  assert.equal(sinUnidad.ok && sinUnidad.articulo.categoria, null)
  // Aunque la pantalla mande un precio, no se guarda: es solo stock.
  assert.equal(sinUnidad.ok && "precioUnitario" in sinUnidad.articulo, false)
  assert.equal(validarArticuloVajilla({ id: UUID, descripcion: "  " }).ok, false)
  assert.equal(validarArticuloVajilla({ id: "no-uuid", descripcion: "Taza" }).ok, false)
  assert.equal(validarArticuloVajilla({ id: UUID, descripcion: "x".repeat(121) }).ok, false)
  assert.equal(validarArticuloVajilla({ descripcion: "Taza" }, "abc").ok, true)
})

test("fila de la base → artículo y nombre repetido sin mayúsculas ni tildes", () => {
  assert.deepEqual(articuloVajillaDesdeFila({ id: "a", descripcion: "Cucharón", unidad: null, categoria: "" }), {
    id: "a",
    descripcion: "Cucharón",
    unidad: "UN",
    categoria: null,
  })
  assert.equal(nombreRepetido("CUCHARON", [{ id: "a", descripcion: "Cucharón" }]), true)
  assert.equal(nombreRepetido("Cucharón", [{ id: "a", descripcion: "Cucharón" }], "a"), false)
})

test("el lapicito acepta el sector vajilla", () => {
  const v = validarAjusteAlmacen(
    { sector: "vajilla", insumoId: "plato", items: [{ salon: "Casona", cantidad: 120, sesionId: UUID }] },
    new Set(["Casona"]),
  )
  assert.equal(v.ok && v.sector, "vajilla")
})

// ── Rutas simuladas ─────────────────────────────────────────────────────
let perfil, consultas, transaccion, articulos, sinTabla, actividad
const db = async (parts, ...values) => {
  const q = parts.join("?")
  consultas.push(q)
  if (sinTabla && q.includes("insumos_vajilla")) throw Object.assign(new Error("no existe"), { code: "42P01" })
  if (q.includes("FROM insumos_vajilla WHERE id = ANY")) return articulos.filter((a) => values[0].includes(a.id))
  if (q.includes("FROM insumos_vajilla WHERE id =")) return articulos.filter((a) => a.id === values[0])
  if (q.includes("FROM insumos_vajilla")) return articulos
  if (q.includes("INSERT INTO insumos_vajilla")) {
    if (articulos.some((a) => a.id === values[0])) return []
    articulos.push({ id: values[0], descripcion: values[1], unidad: values[2], categoria: values[3] })
    return [{ id: values[0] }]
  }
  if (q.includes("UPDATE insumos_vajilla")) {
    const a = articulos.find((x) => x.id === values[3])
    Object.assign(a, { descripcion: values[0], unidad: values[1], categoria: values[2] })
    return []
  }
  if (q.includes("FROM insumos_barra") || q.includes("FROM insumos ") || q.includes("insumos_limpieza")) {
    throw new Error(`No debería leer otro catálogo: ${q}`)
  }
  throw new Error(`Consulta inesperada: ${q}`)
}
db.begin = async (fn) => {
  const tx = async (parts, ...values) => {
    const q = parts.join("?")
    transaccion.push({ q, values })
    if (q.includes("INSERT INTO stock_sesiones")) return [{ id: values[0] }]
    if (q.includes("SELECT cantidad FROM stock_salones")) return []
    if (q.includes("SUM(cantidad)")) return [{ total: "120" }]
    if (q.includes("DELETE FROM insumos_vajilla")) {
      const i = articulos.findIndex((a) => a.id === values[0])
      return i >= 0 ? articulos.splice(i, 1) : []
    }
    return []
  }
  return fn(tx)
}
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: db }
  if (request === "@/lib/activity-logger") return { logActivity: async (...a) => actividad.push(a) }
  if (request === "@/lib/stock-salones-server") {
    return {
      perfilDesdeRequest: async () => perfil,
      salonesConfigurados: async () => new Map([["Casona", "Casona"]]),
      eventoPendienteEnBase: async () => null,
      fechaHoraCortaArgentina: () => "27/10 16:00",
    }
  }
  return load.call(this, request, ...args)
}
const sesiones = require("../app/api/stock-salones/sesiones/route.ts")
const ajuste = require("../app/api/stock-salones/ajuste/route.ts")
const catalogo = require("../app/api/insumos-vajilla/route.ts")
const articulo = require("../app/api/insumos-vajilla/[id]/route.ts")
Module._load = load

const reset = (p) => {
  perfil = p
  consultas = []
  transaccion = []
  actividad = []
  sinTabla = false
  articulos = [{ id: "plato", descripcion: "Plato playo", unidad: "UN", categoria: "Vajilla" }]
}
let n = 0
const sesionId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
const pedir = (url, method, body) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) })
const cargar = (sector, insumoId) =>
  sesiones.POST(
    pedir("/api/stock-salones/sesiones", "POST", {
      sesionId: sesionId(),
      salon: "Casona",
      sector,
      cargadoPor: "PRUEBA",
      items: [{ insumoId, cantidad: 120 }],
    }),
  )
const corregir = (sector, insumoId) =>
  ajuste.POST(
    pedir("/api/stock-salones/ajuste", "POST", {
      sector,
      insumoId,
      items: [{ salon: "Casona", cantidad: 118, sesionId: sesionId() }],
    }),
  )

test("Cocina cuenta vajilla: lee insumos_vajilla y no toca el stock_actual de ningún catálogo", async () => {
  reset("cocina")
  const res = await cargar("vajilla", "plato")
  assert.equal(res.status, 200)
  assert.ok(transaccion.some((t) => t.q.includes("INSERT INTO stock_salones") && t.values[0] === "vajilla"))
  assert.equal(transaccion.some((t) => t.q.includes("UPDATE insumos")), false)
  assert.equal(transaccion.some((t) => t.q.includes("SUM(cantidad)")), false)
  const log = transaccion.find((t) => t.q.includes("INSERT INTO activity_log"))
  assert.equal(log.values[1], "Casona — vajilla")
})

test("Barra y Mantenimiento no pueden contar vajilla; un artículo de otra lista no se acepta", async () => {
  reset("barra")
  assert.equal((await cargar("vajilla", "plato")).status, 403)
  reset("mantenimiento")
  assert.equal((await cargar("vajilla", "plato")).status, 403)
  reset("cocina")
  assert.equal((await cargar("vajilla", "harina")).status, 400)
  assert.equal(transaccion.length, 0)
})

test("lapicito: Cocina corrige su vajilla sin tocar stock_actual, y no puede corregir sus insumos", async () => {
  reset("cocina")
  const res = await corregir("vajilla", "plato")
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.total, 120)
  assert.equal(transaccion.some((t) => t.q.includes("UPDATE insumos")), false)
  const log = transaccion.find((t) => t.q.includes("INSERT INTO activity_log"))
  assert.match(log.values[2], /Ajuste desde Vajilla y utensilios · 27\/10 16:00 · Cocina · Plato playo: sin contar → 118/)
  reset("cocina")
  assert.equal((await corregir("cocina", "harina")).status, 403)
  assert.equal(transaccion.length, 0)
  reset("barra")
  assert.equal((await corregir("vajilla", "plato")).status, 403)
})

test("lista: Cocina la ve, agrega, edita y borra; Barra no la ve", async () => {
  reset("cocina")
  const lista = await catalogo.GET(pedir("/api/insumos-vajilla", "GET"))
  assert.equal(lista.status, 200)
  assert.equal((await lista.json()).articulos[0].descripcion, "Plato playo")
  assert.equal((await catalogo.POST(pedir("/api/insumos-vajilla", "POST", { id: UUID, descripcion: "Olla 20 L", unidad: "un", categoria: "Ollas y sartenes" }))).status, 200)
  assert.equal(articulos.length, 2)
  assert.equal(actividad[0][0], "insumo_vajilla")
  const ed = await articulo.PUT(pedir(`/api/insumos-vajilla/${UUID}`, "PUT", { descripcion: "Olla 30 L", unidad: "UN", categoria: "Ollas y sartenes" }), {
    params: Promise.resolve({ id: UUID }),
  })
  assert.equal(ed.status, 200)
  assert.equal(articulos[1].descripcion, "Olla 30 L")
  assert.match(actividad[1].join(" "), /Nombre: Olla 20 L → Olla 30 L/)
  const del = await articulo.DELETE(pedir(`/api/insumos-vajilla/${UUID}`, "DELETE"), { params: Promise.resolve({ id: UUID }) })
  assert.equal(del.status, 200)
  assert.equal(articulos.length, 1)
  assert.ok(transaccion.some((t) => t.q.includes("DELETE FROM stock_salones WHERE insumo_tipo = 'vajilla'")))
  reset("barra")
  assert.equal((await catalogo.GET(pedir("/api/insumos-vajilla", "GET"))).status, 403)
  assert.equal((await catalogo.POST(pedir("/api/insumos-vajilla", "POST", { id: UUID, descripcion: "Taza" }))).status, 403)
  assert.equal((await articulo.DELETE(pedir("/api/insumos-vajilla/plato", "DELETE"), { params: Promise.resolve({ id: "plato" }) })).status, 403)
  assert.equal(articulos.length, 1)
})

test("lista: el reintento no duplica y el nombre repetido se frena", async () => {
  reset("administracion")
  assert.equal((await catalogo.POST(pedir("/api/insumos-vajilla", "POST", { id: UUID, descripcion: "Taza de café" }))).status, 200)
  const r2 = await catalogo.POST(pedir("/api/insumos-vajilla", "POST", { id: UUID, descripcion: "Taza de café" }))
  assert.equal((await r2.json()).duplicada, true)
  assert.equal(articulos.length, 2)
  assert.equal(actividad.length, 1)
  const r3 = await catalogo.POST(pedir("/api/insumos-vajilla", "POST", { id: "00000000-0000-4000-8000-000000000099", descripcion: "PLATO PLAYO" }))
  assert.equal(r3.status, 409)
})

test("sin la tabla (falta el SQL 028) avisa claro en vez de romper", async () => {
  reset("cocina")
  sinTabla = true
  const res = await catalogo.GET(pedir("/api/insumos-vajilla", "GET"))
  assert.equal(res.status, 503)
  assert.match((await res.json()).error, /028_vajilla_cocina/)
})

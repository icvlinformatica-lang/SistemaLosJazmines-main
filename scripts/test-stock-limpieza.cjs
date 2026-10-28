// Stock de limpieza y perfil Mantenimiento (pedido de Diego, 21/10/2026).
// - Tercer sector del stock por salón: 'limpieza', con su catálogo en
//   insumos_limpieza (scripts/026). Sin precio ni stock_actual: el total es la
//   suma de los salones.
// - Mantenimiento cuenta solo limpieza en /stock; Administración y Soporte
//   cuentan los tres y son los únicos que arman el catálogo.
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
  puedeEditarCatalogoLimpieza,
  puedeAgregarArticuloLimpieza,
  esSectorStock,
} = require("../lib/stock-salones.ts")
const {
  validarArticuloLimpieza,
  nombreRepetido,
  totalesPorArticulo,
  claveDescripcion,
  articuloDesdeFila,
  describirContenido,
} = require("../lib/insumos-limpieza.ts")
const { validarAjusteAlmacen } = require("../lib/stock-ajuste-almacen.ts")

const UUID = "00000000-0000-4000-8000-000000000001"

// ── Permisos ────────────────────────────────────────────────────────────
// Desde el 27/10/2026 hay un cuarto sector, vajilla (Cocina, Administración
// y Soporte): ver scripts/test-stock-vajilla.cjs.
test("Mantenimiento cuenta solo limpieza; Administración y Soporte todos; el resto no suma limpieza", () => {
  assert.deepEqual(sectoresPermitidos("mantenimiento"), ["limpieza"])
  assert.deepEqual(sectoresPermitidos("administracion"), ["cocina", "barra", "limpieza", "vajilla"])
  assert.deepEqual(sectoresPermitidos("soporte"), ["cocina", "barra", "limpieza", "vajilla"])
  assert.deepEqual(sectoresPermitidos("cocina"), ["cocina", "vajilla"])
  assert.deepEqual(sectoresPermitidos("barra"), ["barra"])
  assert.deepEqual(sectoresPermitidos("dj"), [])
  assert.deepEqual(sectoresPermitidos("cobro"), [])
})

test("editar, borrar y el lapicito por salón: solo Administración y Soporte", () => {
  assert.equal(puedeEditarCatalogoLimpieza("administracion"), true)
  assert.equal(puedeEditarCatalogoLimpieza("soporte"), true)
  assert.equal(puedeEditarCatalogoLimpieza("mantenimiento"), false)
  assert.equal(puedeEditarCatalogoLimpieza("cocina"), false)
  assert.equal(puedeEditarCatalogoLimpieza(null), false)
})

test("agregar artículos: Administración, Soporte y también Mantenimiento; nadie más", () => {
  for (const p of ["administracion", "soporte", "mantenimiento"]) assert.equal(puedeAgregarArticuloLimpieza(p), true)
  for (const p of ["cocina", "barra", "dj", "cobro", "vendedor", null]) assert.equal(puedeAgregarArticuloLimpieza(p), false)
})

test("esSectorStock reconoce los tres sectores y nada más", () => {
  for (const s of ["cocina", "barra", "limpieza"]) assert.equal(esSectorStock(s), true)
  for (const s of ["Limpieza", "papeleria", "", null, undefined, 3]) assert.equal(esSectorStock(s), false)
})

// ── Catálogo (lógica pura) ──────────────────────────────────────────────
test("validar un artículo: nombre obligatorio, unidad en mayúsculas (UN si falta), categoría opcional", () => {
  const ok = validarArticuloLimpieza({ id: UUID, descripcion: "  Papel   higiénico x4 ", unidad: "paq", categoria: " Papelería " })
  assert.deepEqual(ok, {
    ok: true,
    articulo: {
      id: UUID,
      descripcion: "Papel higiénico x4",
      unidad: "PAQ",
      categoria: "Papelería",
      precioUnitario: 0,
      contenidoCantidad: null,
      contenidoUnidad: null,
    },
  })
  const sinUnidad = validarArticuloLimpieza({ id: UUID, descripcion: "Esponja" })
  assert.equal(sinUnidad.ok && sinUnidad.articulo.unidad, "UN")
  assert.equal(sinUnidad.ok && sinUnidad.articulo.categoria, null)
  assert.equal(validarArticuloLimpieza({ id: UUID, descripcion: "   " }).ok, false)
  assert.equal(validarArticuloLimpieza({ id: "no-uuid", descripcion: "Alcohol" }).ok, false)
  // Al editar, el id viene de la dirección y no se pide uuid en el cuerpo.
  assert.equal(validarArticuloLimpieza({ descripcion: "Alcohol" }, "abc").ok, true)
})

test("precio y contenido: opcionales, precio con 2 decimales, contenido en gramos o cc", () => {
  // Bidón de lavandina de 5 litros a $4.599,999 → $4.600, 5000 cc.
  const bidon = validarArticuloLimpieza({
    id: UUID,
    descripcion: "Lavandina",
    unidad: "un",
    precioUnitario: 4599.999,
    contenidoCantidad: 5000,
    contenidoUnidad: "cc",
  })
  assert.equal(bidon.ok, true)
  assert.equal(bidon.articulo.precioUnitario, 4600)
  assert.equal(bidon.articulo.contenidoCantidad, 5000)
  assert.equal(bidon.articulo.contenidoUnidad, "CC")
  // Contenido 0 = sin cargar, aunque venga una unidad.
  const sinContenido = validarArticuloLimpieza({ id: UUID, descripcion: "Esponja", contenidoCantidad: 0, contenidoUnidad: "CC" })
  assert.equal(sinContenido.articulo.contenidoCantidad, null)
  assert.equal(sinContenido.articulo.contenidoUnidad, null)
  assert.equal(validarArticuloLimpieza({ id: UUID, descripcion: "X", precioUnitario: -1 }).ok, false)
  assert.equal(validarArticuloLimpieza({ id: UUID, descripcion: "X", precioUnitario: "abc" }).ok, false)
  assert.equal(validarArticuloLimpieza({ id: UUID, descripcion: "X", contenidoCantidad: 5, contenidoUnidad: "LT" }).ok, false)
  assert.equal(validarArticuloLimpieza({ id: UUID, descripcion: "X", contenidoCantidad: -5, contenidoUnidad: "CC" }).ok, false)
})

test("fila de la base → artículo: numeric llega como texto y una fila sin las columnas nuevas no rompe", () => {
  assert.deepEqual(
    articuloDesdeFila({ id: "a", descripcion: "Alcohol", unidad: null, categoria: null, precio_unitario: "1250.50", contenido_cantidad: "1000", contenido_unidad: "CC" }),
    { id: "a", descripcion: "Alcohol", unidad: "UN", categoria: null, precioUnitario: 1250.5, contenidoCantidad: 1000, contenidoUnidad: "CC" },
  )
  const vieja = articuloDesdeFila({ id: "b", descripcion: "Bolsas", unidad: "PAQ", categoria: "Limpieza" })
  assert.equal(vieja.precioUnitario, 0)
  assert.equal(vieja.contenidoCantidad, null)
  assert.equal(describirContenido(5000, "CC"), "5 L")
  assert.equal(describirContenido(750, "CC"), "750 cc")
  assert.equal(describirContenido(500, "GRS"), "500 g")
  assert.equal(describirContenido(null, null), "sin cargar")
})

test("nombre repetido: sin mayúsculas, tildes ni espacios de más, salvo el propio", () => {
  const existentes = [{ id: "a", descripcion: "Jabón para la ropa" }]
  assert.equal(claveDescripcion("  JABON  para la Ropa "), "jabon para la ropa")
  assert.equal(nombreRepetido("jabon para la ropa", existentes), true)
  assert.equal(nombreRepetido("Jabón para la ropa", existentes, "a"), false)
  assert.equal(nombreRepetido("Jabón en polvo", existentes), false)
})

test("total de cada artículo = suma de los salones contados; sin conteo no hay entrada", () => {
  const t = totalesPorArticulo([
    { insumoId: "papel", salon: "Casona", cantidad: 12 },
    { insumoId: "papel", salon: "Quinta", cantidad: 0.5 },
    { insumoId: "papel", salon: "Salon", cantidad: 0 },
    { insumoId: "bolsas", salon: "Quinta", cantidad: 3 },
  ])
  assert.equal(t.get("papel"), 12.5)
  assert.equal(t.get("bolsas"), 3)
  assert.equal(t.has("alcohol"), false)
})

test("el lapicito de Insumos Limpieza acepta el sector limpieza", () => {
  const v = validarAjusteAlmacen(
    { sector: "limpieza", insumoId: "papel", items: [{ salon: "Casona", cantidad: 4, sesionId: UUID }] },
    new Set(["Casona"]),
  )
  assert.equal(v.ok, true)
  assert.equal(v.ok && v.sector, "limpieza")
  assert.equal(validarAjusteAlmacen({ sector: "papeleria", insumoId: "x", items: [] }, new Set()).ok, false)
})

// ── Rutas simuladas ─────────────────────────────────────────────────────
let perfil, consultas, transaccion, articulos, sinTabla, actividad
const db = async (parts, ...values) => {
  const q = parts.join("?")
  consultas.push(q)
  if (sinTabla && q.includes("insumos_limpieza")) throw Object.assign(new Error("no existe"), { code: "42P01" })
  if (q.includes("FROM insumos_limpieza WHERE id = ANY")) return articulos.filter((a) => values[0].includes(a.id))
  if (q.includes("FROM insumos_limpieza")) return articulos
  if (q.includes("INSERT INTO insumos_limpieza")) {
    if (articulos.some((a) => a.id === values[0])) return []
    articulos.push({
      id: values[0],
      descripcion: values[1],
      unidad: values[2],
      categoria: values[3],
      precio_unitario: values[4],
      contenido_cantidad: values[5],
      contenido_unidad: values[6],
    })
    return [{ id: values[0] }]
  }
  if (q.includes("FROM insumos_barra") || q.includes("FROM insumos ")) throw new Error(`No debería leer otro catálogo: ${q}`)
  throw new Error(`Consulta inesperada: ${q}`)
}
db.begin = async (fn) => {
  const tx = async (parts, ...values) => {
    const q = parts.join("?")
    transaccion.push({ q, values })
    if (q.includes("INSERT INTO stock_sesiones")) return [{ id: values[0] }]
    if (q.includes("SELECT cantidad FROM stock_salones")) return []
    if (q.includes("SUM(cantidad)")) return [{ total: "3" }]
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
      fechaHoraCortaArgentina: () => "21/10 14:00",
    }
  }
  return load.call(this, request, ...args)
}
const sesiones = require("../app/api/stock-salones/sesiones/route.ts")
const catalogo = require("../app/api/insumos-limpieza/route.ts")
Module._load = load

const reset = (p) => {
  perfil = p
  consultas = []
  transaccion = []
  actividad = []
  sinTabla = false
  articulos = [{ id: "papel", descripcion: "Papel higiénico", unidad: "PAQ", categoria: "Papelería" }]
}
let n = 0
const cargar = (sector, insumoId) => {
  n++
  return sesiones.POST(new Request("http://localhost/api/stock-salones/sesiones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sesionId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      salon: "Casona",
      sector,
      cargadoPor: "PRUEBA",
      items: [{ insumoId, cantidad: 3 }],
    }),
  }))
}

test("Mantenimiento carga limpieza: lee insumos_limpieza y no toca stock_actual de ningún catálogo", async () => {
  reset("mantenimiento")
  const res = await cargar("limpieza", "papel")
  assert.equal(res.status, 200)
  assert.ok(consultas.some((q) => q.includes("FROM insumos_limpieza")))
  assert.ok(transaccion.some((t) => t.q.includes("INSERT INTO stock_salones") && t.values[0] === "limpieza"))
  assert.equal(transaccion.some((t) => t.q.includes("UPDATE insumos")), false)
  assert.equal(transaccion.some((t) => t.q.includes("SUM(cantidad)")), false)
  const log = transaccion.find((t) => t.q.includes("INSERT INTO activity_log"))
  assert.equal(log.values[1], "Casona — limpieza")
})

test("Mantenimiento no puede cargar cocina ni barra", async () => {
  reset("mantenimiento")
  assert.equal((await cargar("cocina", "harina")).status, 403)
  assert.equal((await cargar("barra", "fernet")).status, 403)
  assert.equal(transaccion.length, 0)
})

test("Cocina y Barra no pueden cargar limpieza", async () => {
  reset("cocina")
  assert.equal((await cargar("limpieza", "papel")).status, 403)
  reset("barra")
  assert.equal((await cargar("limpieza", "papel")).status, 403)
})

test("un artículo que no es de limpieza no se acepta", async () => {
  reset("administracion")
  assert.equal((await cargar("limpieza", "harina")).status, 400)
  assert.equal(transaccion.length, 0)
})

const alta = (body) =>
  catalogo.POST(new Request("http://localhost/api/insumos-limpieza", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }))

test("catálogo: Mantenimiento lo ve y agrega; un perfil sin limpieza no lo ve ni agrega", async () => {
  reset("mantenimiento")
  const res = await catalogo.GET(new Request("http://localhost/api/insumos-limpieza"))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).articulos[0].descripcion, "Papel higiénico")
  assert.equal((await alta({ id: UUID, descripcion: "Bolsas" })).status, 200)
  assert.equal(articulos.length, 2)
  reset("cocina")
  assert.equal((await catalogo.GET(new Request("http://localhost/api/insumos-limpieza"))).status, 403)
  assert.equal((await alta({ id: UUID, descripcion: "Bolsas" })).status, 403)
  assert.equal(articulos.length, 1)
})

test("catálogo: Administración agrega, el reintento no duplica y el nombre repetido se frena", async () => {
  reset("administracion")
  const r1 = await alta({ id: UUID, descripcion: "Bolsas de residuo", unidad: "paq", categoria: "Limpieza" })
  assert.equal(r1.status, 200)
  assert.equal(articulos.length, 2)
  assert.equal(articulos[1].unidad, "PAQ")
  assert.equal(actividad.length, 1)
  const r2 = await alta({ id: UUID, descripcion: "Bolsas de residuo", unidad: "PAQ" })
  assert.equal(r2.status, 200)
  assert.equal((await r2.json()).duplicada, true)
  assert.equal(articulos.length, 2)
  assert.equal(actividad.length, 1)
  const r3 = await alta({ id: "00000000-0000-4000-8000-000000000099", descripcion: "papel HIGIENICO" })
  assert.equal(r3.status, 409)
})

test("catálogo: el alta guarda precio y contenido, y el GET los devuelve", async () => {
  reset("administracion")
  const r = await alta({
    id: UUID,
    descripcion: "Lavandina",
    unidad: "UN",
    precioUnitario: 4600,
    contenidoCantidad: 5000,
    contenidoUnidad: "CC",
  })
  assert.equal(r.status, 200)
  assert.match(actividad[0].join(" "), /Trae: 5 L/)
  assert.match(actividad[0].join(" "), /Precio: \$4600/)
  const lista = await (await catalogo.GET(new Request("http://localhost/api/insumos-limpieza"))).json()
  const lavandina = lista.articulos.find((a) => a.id === UUID)
  assert.equal(lavandina.precioUnitario, 4600)
  assert.equal(lavandina.contenidoCantidad, 5000)
  assert.equal(lavandina.contenidoUnidad, "CC")
})

test("sin la tabla (falta el SQL 026) avisa claro en vez de romper", async () => {
  reset("administracion")
  sinTabla = true
  const res = await catalogo.GET(new Request("http://localhost/api/insumos-limpieza"))
  assert.equal(res.status, 503)
  assert.match((await res.json()).error, /026_stock_limpieza/)
})

// ── Login ───────────────────────────────────────────────────────────────
test("Mantenimiento no tiene PIN de reserva: sin PIN_MANTENIMIENTO nadie entra con PIN", () => {
  const { getPins, verifyPin } = require("../lib/auth/server.ts")
  const antes = process.env.PIN_MANTENIMIENTO
  delete process.env.PIN_MANTENIMIENTO
  try {
    assert.equal(getPins().mantenimiento, "")
    assert.equal(verifyPin("mantenimiento", ""), false)
    process.env.PIN_MANTENIMIENTO = "7788"
    assert.equal(verifyPin("mantenimiento", "7788"), true)
    assert.equal(verifyPin("mantenimiento", "1234"), false)
  } finally {
    if (antes === undefined) delete process.env.PIN_MANTENIMIENTO
    else process.env.PIN_MANTENIMIENTO = antes
  }
})

test("el login acepta el perfil mantenimiento", () => {
  const fuente = fs.readFileSync(path.join(__dirname, "../app/api/auth/login/route.ts"), "utf8")
  const lista = fuente.slice(fuente.indexOf("PERFILES_VALIDOS"), fuente.indexOf("]", fuente.indexOf("PERFILES_VALIDOS")))
  assert.match(lista, /"mantenimiento"/)
})

// Alta de insumos de cocina y recetas desde el chat con IA: la IA solo
// propone (el precio por unidad y el costo por porción los calcula el código,
// no la IA) y /api/chat/catalogo carga cuando la persona toca "Sí, cargar".
// Todo con datos inventados y base simulada: no se toca la base real.
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith("@/") ? path.join(__dirname, "..", request.slice(2)) : request, ...args)
}
require.extensions[".ts"] = (mod, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  mod._compile(result.outputText, filename)
}

const catalogo = require("../lib/chat-ia-catalogo.ts")
const { armarPropuestaInsumo, armarPropuestaReceta, unidadRecetaCompatible, propuestaInsumoValida, propuestaRecetaValida, insumoDesdeFila } = catalogo
const codigos = require("../lib/codigos.ts")
const store = require("../lib/store.ts")
const { costoPorPorcion } = require("../lib/precio-menu.ts")

// Almacén inventado.
const HARINA = { id: "ins-harina", descripcion: "PRUEBA Harina 0000", unidad: "KG", precioUnitario: 2000 }
const LATA = { id: "ins-lata", descripcion: "PRUEBA Arvejas en lata", unidad: "UN", precioUnitario: 1000, contenidoCantidad: 400, contenidoUnidad: "GRS" }
const HUEVO = { id: "ins-huevo", descripcion: "PRUEBA Huevo", unidad: "UN", precioUnitario: 250 }
const LECHE = { id: "ins-leche", descripcion: "PRUEBA Leche", unidad: "LT", precioUnitario: 1500 }
const ALMACEN = [HARINA, LATA, HUEVO, LECHE]

const insumoBase = { descripcion: "PRUEBA Azúcar", unidad: "KG", cantidadComprada: 5, montoPagado: 10000, proveedor: "PRUEBA Distribuidora" }

test("los códigos automáticos son los mismos desde el store y desde el servidor", () => {
  assert.equal(store.generateNextCodigo, codigos.generateNextCodigo)
  assert.equal(store.RECETA_CODIGO_PREFIX, codigos.RECETA_CODIGO_PREFIX)
  assert.equal(codigos.generateNextCodigo(["INS001", "INS190", "otro", null], "INS"), "INS191")
  assert.equal(codigos.generateNextCodigo([], codigos.RECETA_CODIGO_PREFIX["Postre"]), "PS001")
})

test("insumo: el precio por unidad sale de lo que se pagó y por cuánto", () => {
  // Bolsa de 5 kg a $10.000 → $2.000 por kg.
  const r = armarPropuestaInsumo(insumoBase, { id: "p1", existentes: ALMACEN })
  assert.equal(r.ok, true)
  assert.equal(r.propuesta.precioUnitario, 2000)
  assert.deepEqual(r.propuesta.compra, { cantidad: 5, monto: 10000 })
  assert.equal(r.propuesta.estado, "pendiente")
  // 500 g a $1.250 con unidad KG → cantidad 0,5 → $2.500 por kg.
  const medio = armarPropuestaInsumo({ ...insumoBase, cantidadComprada: 0.5, montoPagado: 1250 }, { id: "p2", existentes: ALMACEN })
  assert.equal(medio.propuesta.precioUnitario, 2500)
  // Con centavos: 3 litros a $1.000 → $333,33 por litro.
  const litros = armarPropuestaInsumo({ ...insumoBase, descripcion: "PRUEBA Aceite", unidad: "LT", cantidadComprada: 3, montoPagado: 1000 }, { id: "p3", existentes: ALMACEN })
  assert.equal(litros.propuesta.precioUnitario, 333.33)
})

test("insumo: por unidad pide cuánto trae cada una, o que se use entero", () => {
  const sinContenido = armarPropuestaInsumo({ ...insumoBase, descripcion: "PRUEBA Choclo en lata", unidad: "UN", cantidadComprada: 12, montoPagado: 18000 }, { id: "p", existentes: ALMACEN })
  assert.equal(sinContenido.ok, false)
  assert.match(sinContenido.motivo, /cuánto trae cada unidad/)
  const conContenido = armarPropuestaInsumo(
    { ...insumoBase, descripcion: "PRUEBA Choclo en lata", unidad: "UN", cantidadComprada: 12, montoPagado: 18000, contenidoCantidad: 300, contenidoUnidad: "GRS" },
    { id: "p", existentes: ALMACEN },
  )
  assert.equal(conContenido.propuesta.precioUnitario, 1500)
  assert.equal(conContenido.propuesta.contenidoCantidad, 300)
  assert.equal(conContenido.propuesta.contenidoUnidad, "GRS")
  // Maple de 30 huevos a $7.500, se usan enteros → $250 por unidad, sin contenido.
  const huevos = armarPropuestaInsumo(
    { ...insumoBase, descripcion: "PRUEBA Huevo de campo", unidad: "UN", cantidadComprada: 30, montoPagado: 7500, seUsaPorUnidad: true },
    { id: "p", existentes: ALMACEN },
  )
  assert.equal(huevos.propuesta.precioUnitario, 250)
  assert.equal(huevos.propuesta.contenidoCantidad, undefined)
  // Un insumo por peso no guarda contenido aunque lo manden.
  const kg = armarPropuestaInsumo({ ...insumoBase, contenidoCantidad: 300, contenidoUnidad: "GRS" }, { id: "p", existentes: ALMACEN })
  assert.equal(kg.propuesta.contenidoCantidad, undefined)
})

test("insumo: frena nombres repetidos y pregunta lo que falta", () => {
  const repetido = armarPropuestaInsumo({ ...insumoBase, descripcion: "prueba  harina 0000" }, { id: "p", existentes: ALMACEN })
  assert.equal(repetido.ok, false)
  assert.match(repetido.motivo, /Ya existe "PRUEBA Harina 0000"/)
  assert.match(armarPropuestaInsumo({ ...insumoBase, unidad: "TAZA" }, { id: "p", existentes: [] }).motivo, /cómo se mide/)
  assert.match(armarPropuestaInsumo({ ...insumoBase, montoPagado: undefined }, { id: "p", existentes: [] }).motivo, /cuánto se pagó/)
  assert.match(armarPropuestaInsumo({ ...insumoBase, cantidadComprada: 0 }, { id: "p", existentes: [] }).motivo, /por qué cantidad/)
  assert.match(armarPropuestaInsumo({ ...insumoBase, proveedor: "" }, { id: "p", existentes: [] }).motivo, /proveedor/)
  assert.equal(armarPropuestaInsumo({ ...insumoBase, proveedor: "", sinProveedor: true }, { id: "p", existentes: [] }).ok, true)
  // Un error de ceros no pasa.
  assert.match(armarPropuestaInsumo({ ...insumoBase, cantidadComprada: 0.001, montoPagado: 100000000 }, { id: "p", existentes: [] }).motivo, /demasiado grande/)
})

test("receta: unidades que se pueden convertir a la del insumo", () => {
  assert.equal(unidadRecetaCompatible("GRS", HARINA), true)
  assert.equal(unidadRecetaCompatible("KG", HARINA), true)
  assert.equal(unidadRecetaCompatible("CC", HARINA), false)
  assert.equal(unidadRecetaCompatible("GRS", LATA), true)
  assert.equal(unidadRecetaCompatible("UN", LATA), true)
  assert.equal(unidadRecetaCompatible("CC", LATA), false)
  assert.equal(unidadRecetaCompatible("UN", HUEVO), true)
  assert.equal(unidadRecetaCompatible("GRS", HUEVO), false)
  assert.equal(unidadRecetaCompatible("CC", LECHE), true)
})

const recetaBase = {
  nombre: "PRUEBA Tarta de arvejas",
  categoria: "Entrada",
  rindePara: 4,
  ingredientes: [
    { insumoId: "ins-harina", cantidad: 200, unidad: "GRS" },
    { insumoId: "ins-lata", cantidad: 400, unidad: "GRS", detalleCorte: "escurridas" },
    { insumoId: "ins-huevo", cantidad: 2, unidad: "UN" },
    { insumoId: "ins-leche", cantidad: 100, unidad: "CC" },
  ],
}

test("receta: costo por porción con la misma cuenta del Recetario", () => {
  const r = armarPropuestaReceta(recetaBase, { id: "r1", insumos: ALMACEN, recetasExistentes: [] })
  assert.equal(r.ok, true)
  // Para 4: harina 0,2 kg × $2.000 = $400; lata 1 × $1.000; huevos 2 × $250 = $500; leche 0,1 l × $1.500 = $150.
  // Total $2.050 → $512,50 por porción.
  assert.deepEqual(r.propuesta.ingredientes.map((i) => i.costoPorPorcion), [100, 250, 125, 37.5])
  assert.equal(r.propuesta.costoPorPorcion, 512.5)
  const recetario = costoPorPorcion(
    { factorRendimiento: 4, insumos: recetaBase.ingredientes.map((i) => ({ insumoId: i.insumoId, cantidadBasePorPersona: i.cantidad, unidadReceta: i.unidad })) },
    ALMACEN,
  )
  assert.equal(recetario, 512.5)
  assert.equal(r.propuesta.ingredientes[1].detalleCorte, "escurridas")
  assert.equal(r.propuesta.ingredientes[1].descripcion, "PRUEBA Arvejas en lata")
})

test("receta: frena unidades que no se convierten, ingredientes repetidos o que no están", () => {
  const conv = (ing) => armarPropuestaReceta({ ...recetaBase, ingredientes: [ing] }, { id: "r", insumos: ALMACEN, recetasExistentes: [] })
  assert.match(conv({ insumoId: "ins-huevo", cantidad: 50, unidad: "GRS" }).motivo, /no tiene cargado cuánto trae/)
  assert.match(conv({ insumoId: "ins-harina", cantidad: 50, unidad: "CC" }).motivo, /va en gramos o kg|va en/)
  assert.match(conv({ insumoId: "no-existe", cantidad: 1, unidad: "UN" }).motivo, /no está en Almacén/)
  const repetido = armarPropuestaReceta(
    { ...recetaBase, ingredientes: [recetaBase.ingredientes[0], recetaBase.ingredientes[0]] },
    { id: "r", insumos: ALMACEN, recetasExistentes: [] },
  )
  assert.match(repetido.motivo, /dos veces/)
  assert.match(armarPropuestaReceta(recetaBase, { id: "r", insumos: ALMACEN, recetasExistentes: [{ nombre: "Prueba tarta de ARVEJAS" }] }).motivo, /Ya existe/)
  assert.match(armarPropuestaReceta({ ...recetaBase, categoria: "Sopa" }, { id: "r", insumos: ALMACEN, recetasExistentes: [] }).motivo, /categoría/)
  assert.match(armarPropuestaReceta({ ...recetaBase, rindePara: 0 }, { id: "r", insumos: ALMACEN, recetasExistentes: [] }).motivo, /porciones/)
  assert.match(armarPropuestaReceta({ ...recetaBase, ingredientes: [] }, { id: "r", insumos: ALMACEN, recetasExistentes: [] }).motivo, /ingredientes/)
})

test("propuestas leídas del historial: solo con la forma esperada", () => {
  const i = armarPropuestaInsumo(insumoBase, { id: "p1", existentes: [] }).propuesta
  assert.deepEqual(propuestaInsumoValida(JSON.parse(JSON.stringify(i))), i)
  assert.equal(propuestaInsumoValida({ ...i, unidad: "TAZA" }), null)
  assert.equal(propuestaInsumoValida(null), null)
  const r = armarPropuestaReceta(recetaBase, { id: "r1", insumos: ALMACEN, recetasExistentes: [] }).propuesta
  assert.deepEqual(propuestaRecetaValida(JSON.parse(JSON.stringify(r))), r)
  assert.equal(propuestaRecetaValida({ ...r, ingredientes: [{}] }), null)
})

test("fila de la base → insumo: números y contenido", () => {
  const i = insumoDesdeFila({ id: "x", codigo: "INS001", descripcion: "Lata", unidad: "UN", precio_unitario: "1000.50", proveedor: null, contenido_cantidad: "400", contenido_unidad: "GRS" })
  assert.equal(i.precioUnitario, 1000.5)
  assert.equal(i.contenidoCantidad, 400)
  assert.equal(i.contenidoUnidad, "GRS")
})

// ---- Base simulada para las rutas ----
let sesion = { perfilId: "administracion" }
let mensajes = {}
let filasInsumos = []
let filasRecetas = []
let filasRecetaInsumos = []
const escrituras = []
let simularIA = null
const sqlFalso = async (parts, ...values) => {
  const query = parts.join("?")
  if (query.includes("SELECT acciones FROM chat_ia_mensajes")) {
    const [id, usuario] = values
    const m = mensajes[id]
    return m && m.usuario === usuario ? [{ acciones: m.acciones }] : []
  }
  if (query.includes("UPDATE chat_ia_mensajes")) {
    mensajes[values[1]].acciones = values[0]
    escrituras.push({ query, values })
    return []
  }
  if (query.includes("INSERT INTO chat_ia_mensajes")) {
    escrituras.push({ query, values })
    return []
  }
  if (query.includes("FROM insumos")) return filasInsumos
  if (query.includes("FROM recetas")) return filasRecetas
  if (query.includes("INSERT INTO insumos ")) {
    escrituras.push({ query, values })
    if (!filasInsumos.some((f) => f.id === values[0])) {
      filasInsumos.push({ id: values[0], codigo: values[1], descripcion: values[2], unidad: values[3], precio_unitario: values[4], proveedor: values[5], contenido_cantidad: values[6], contenido_unidad: values[7] })
    }
    return []
  }
  if (query.includes("INSERT INTO recetas ")) {
    escrituras.push({ query, values })
    if (!filasRecetas.some((f) => f.id === values[0])) filasRecetas.push({ id: values[0], codigo: values[1], nombre: values[2] })
    return []
  }
  if (query.includes("INSERT INTO receta_insumos")) {
    escrituras.push({ query, values })
    if (!filasRecetaInsumos.some((f) => f.id === values[0])) filasRecetaInsumos.push(values)
    return []
  }
  if (query.includes("insumos_precio_historial") || query.includes("activity_log")) {
    escrituras.push({ query, values })
    return []
  }
  if (query.includes("FROM eventos") || query.includes("historial_ipc") || query.includes("movimientos_caja")) return []
  throw new Error(`Consulta inesperada: ${query}`)
}
sqlFalso.begin = async (fn) => fn(sqlFalso)
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: sqlFalso }
  if (request === "@/lib/auth/server") return { SESSION_COOKIE: "lj_session", SESSION_HEADER: "x-lj-session", verifyToken: async () => sesion }
  if (request === "ai") {
    const real = load.call(this, request, ...args)
    return { ...real, generateText: (opts) => simularIA(opts) }
  }
  return load.call(this, request, ...args)
}
let POST_CATALOGO, POST_CHAT
try {
  ;({ POST: POST_CATALOGO } = require("../app/api/chat/catalogo/route.ts"))
  ;({ POST: POST_CHAT } = require("../app/api/chat/route.ts"))
} finally {
  Module._load = load
}

const filaDe = (i) => ({ id: i.id, codigo: `INS0${ALMACEN.indexOf(i) + 1}`, descripcion: i.descripcion, unidad: i.unidad, precio_unitario: String(i.precioUnitario), proveedor: null, contenido_cantidad: i.contenidoCantidad ?? null, contenido_unidad: i.contenidoUnidad ?? null })

function preparar(propuestas) {
  filasInsumos = ALMACEN.map(filaDe)
  filasRecetas = [{ id: "rec-1", codigo: "E004", nombre: "PRUEBA Empanadas" }]
  filasRecetaInsumos = []
  mensajes = { "m-r": { usuario: "Leila", acciones: JSON.stringify({ botones: [], tarjetas: [], ...propuestas }) } }
  escrituras.length = 0
  sesion = { perfilId: "administracion" }
}
const resolver = (tipo, accion, cookie = "lj_session=x; lj_usuario=Leila", mensajeId = "m-r") =>
  POST_CATALOGO(new Request("http://localhost/api/chat/catalogo", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ mensajeId, tipo, accion }),
  }))

const propuestaInsumo = () => armarPropuestaInsumo(insumoBase, { id: "ins-chat", existentes: [] }).propuesta
const propuestaReceta = () => armarPropuestaReceta(recetaBase, { id: "rec-chat", insumos: ALMACEN, recetasExistentes: [] }).propuesta

test("/api/chat/catalogo: carga el insumo con el precio calculado y el código que sigue; un segundo toque no repite", async () => {
  preparar({ insumo: propuestaInsumo() })
  const res = await resolver("insumo", "confirmar")
  assert.equal(res.status, 200)
  const { insumo } = await res.json()
  assert.equal(insumo.estado, "cargado")
  assert.equal(insumo.codigo, "INS005")
  assert.equal(insumo.resueltoPor, "Leila")
  const alta = escrituras.find((e) => e.query.includes("INSERT INTO insumos "))
  assert.match(alta.query, /ON CONFLICT \(id\) DO NOTHING/)
  assert.deepEqual(alta.values, ["ins-chat", "INS005", "PRUEBA Azúcar", "KG", 2000, "PRUEBA Distribuidora", null, null])
  assert.ok(escrituras.some((e) => e.query.includes("insumos_precio_historial") && e.values[1] === 2000))
  const log = escrituras.find((e) => e.query.includes("activity_log"))
  assert.match(log.query, /'insumo', 'creado'/)
  assert.match(log.values[1], /Código: INS005 · Desde el asistente con IA · Por Leila/)
  assert.equal(JSON.parse(mensajes["m-r"].acciones).insumo.estado, "cargado")
  escrituras.length = 0
  const otra = await resolver("insumo", "confirmar")
  assert.equal((await otra.json()).insumo.codigo, "INS005")
  assert.equal(escrituras.length, 0)
  assert.equal(filasInsumos.length, 5)
})

test("/api/chat/catalogo: si ya está en Almacén (un toque anterior que no marcó la tarjeta), solo la marca", async () => {
  preparar({ insumo: propuestaInsumo() })
  filasInsumos.push({ id: "ins-chat", codigo: "INS005", descripcion: "PRUEBA Azúcar", unidad: "KG", precio_unitario: "2000" })
  const res = await resolver("insumo", "confirmar")
  assert.equal((await res.json()).insumo.estado, "cargado")
  assert.equal(escrituras.filter((e) => !e.query.includes("chat_ia_mensajes")).length, 0)
})

test("/api/chat/catalogo: si mientras tanto alguien cargó uno con el mismo nombre, no carga", async () => {
  preparar({ insumo: propuestaInsumo() })
  filasInsumos.push({ id: "otro", codigo: "INS009", descripcion: "Prueba azucar", unidad: "KG", precio_unitario: "1900" })
  const res = await resolver("insumo", "confirmar")
  assert.equal(res.status, 409)
  assert.match((await res.json()).error, /Ya existe/)
  assert.equal(escrituras.length, 0)
  assert.equal(JSON.parse(mensajes["m-r"].acciones).insumo.estado, "pendiente")
})

test("/api/chat/catalogo: carga la receta con sus ingredientes; un segundo toque no repite", async () => {
  preparar({ receta: propuestaReceta() })
  const res = await resolver("receta", "confirmar")
  assert.equal(res.status, 200)
  const { receta } = await res.json()
  assert.equal(receta.estado, "cargado")
  assert.equal(receta.codigo, "E005")
  assert.equal(receta.costoPorPorcion, 512.5)
  const alta = escrituras.find((e) => e.query.includes("INSERT INTO recetas "))
  assert.deepEqual(alta.values, ["rec-chat", "E005", "PRUEBA Tarta de arvejas", null, "Entrada", 4])
  assert.deepEqual(
    filasRecetaInsumos.map((v) => [v[0], v[2], v[4], v[5], v[3]]),
    [
      ["rec-chat-1", "ins-harina", 200, "GRS", null],
      ["rec-chat-2", "ins-lata", 400, "GRS", "escurridas"],
      ["rec-chat-3", "ins-huevo", 2, "UN", null],
      ["rec-chat-4", "ins-leche", 100, "CC", null],
    ],
  )
  const log = escrituras.find((e) => e.query.includes("activity_log"))
  assert.match(log.query, /'receta', 'creado'/)
  assert.match(log.values[1], /Categoria: Entrada · Código: E005 · Desde el asistente con IA · Por Leila/)
  escrituras.length = 0
  assert.equal((await (await resolver("receta", "confirmar")).json()).receta.estado, "cargado")
  assert.equal(escrituras.length, 0)
})

test("/api/chat/catalogo: si se borró un ingrediente desde la propuesta, no carga la receta", async () => {
  preparar({ receta: propuestaReceta() })
  filasInsumos = filasInsumos.filter((f) => f.id !== "ins-huevo")
  const res = await resolver("receta", "confirmar")
  assert.equal(res.status, 409)
  assert.match((await res.json()).error, /no está en Almacén/)
  assert.equal(escrituras.length, 0)
})

test("/api/chat/catalogo: cancelar no carga nada y marca la tarjeta", async () => {
  preparar({ insumo: propuestaInsumo(), receta: propuestaReceta() })
  assert.equal((await (await resolver("insumo", "cancelar")).json()).insumo.estado, "cancelado")
  assert.equal(escrituras.filter((e) => !e.query.includes("chat_ia_mensajes")).length, 0)
  const guardado = JSON.parse(mensajes["m-r"].acciones)
  assert.equal(guardado.insumo.estado, "cancelado")
  // La otra propuesta del mismo mensaje queda como estaba.
  assert.equal(guardado.receta.estado, "pendiente")
  // Ya cancelado: confirmar después no lo carga.
  assert.equal((await (await resolver("insumo", "confirmar")).json()).insumo.estado, "cancelado")
  assert.equal(escrituras.filter((e) => e.query.includes("INSERT")).length, 0)
})

test("/api/chat/catalogo: solo el chat propio, solo Administración y Soporte, y con datos válidos", async () => {
  preparar({ insumo: propuestaInsumo() })
  assert.equal((await resolver("insumo", "confirmar", "lj_session=x; lj_usuario=Diego")).status, 404)
  assert.equal((await resolver("receta", "confirmar")).status, 404)
  sesion = { perfilId: "cocina" }
  assert.equal((await resolver("insumo", "confirmar")).status, 403)
  sesion = { perfilId: "vendedor" }
  assert.equal((await resolver("insumo", "confirmar")).status, 403)
  sesion = { perfilId: "administracion" }
  assert.equal((await resolver("bebida", "confirmar")).status, 400)
  assert.equal((await resolver("insumo", "cargar")).status, 400)
  assert.equal((await resolver("insumo", "confirmar", undefined, "")).status, 400)
  assert.equal(escrituras.length, 0)
})

test("chat: la IA busca y propone el insumo y la receta; no carga nada y se guarda en el mensaje", async () => {
  preparar({})
  mensajes = {}
  let busqueda
  simularIA = async (opts) => {
    busqueda = await opts.tools.buscarInsumos.execute({ textos: ["harina", "arvejas", "nada"] })
    const repetido = await opts.tools.proponerInsumo.execute({ ...insumoBase, descripcion: "PRUEBA Harina 0000" })
    assert.equal(repetido.ok, false)
    const r = await opts.tools.proponerInsumo.execute(insumoBase)
    assert.equal(r.ok, true)
    assert.match(r.aviso, /NO está cargado/)
    assert.equal(r.insumo.precio, "$2.000 por kg")
    assert.equal((await opts.tools.proponerInsumo.execute({ ...insumoBase, descripcion: "PRUEBA Sal" })).ok, false)
    const rec = await opts.tools.proponerReceta.execute(recetaBase)
    assert.equal(rec.ok, true)
    assert.equal(rec.receta.costoPorPorcion, 512.5)
    return { text: "¿Seguro que querés cargar PRUEBA Azúcar a $2.000 por kg?" }
  }
  const res = await POST_CHAT(new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "lj_session=x; lj_usuario=Leila" },
    body: JSON.stringify({ id: "abc12345-insumo", messages: [{ role: "user", content: "quiero cargar azúcar" }] }),
  }))
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(busqueda.resultados[0].insumos[0].id, "ins-harina")
  assert.equal(busqueda.resultados[1].insumos[0].traeCadaUnidad, "400 gramos")
  assert.equal(busqueda.resultados[2].insumos.length, 0)
  assert.equal(data.insumo.estado, "pendiente")
  assert.equal(data.insumo.precioUnitario, 2000)
  assert.equal(data.receta.costoPorPorcion, 512.5)
  assert.equal(data.insumoSinGuardar, false)
  // Nada cargado en Almacén ni en Recetario: solo el historial del chat.
  assert.ok(escrituras.every((e) => e.query.includes("chat_ia_mensajes")))
  const guardado = escrituras.find((e) => e.values.some((v) => typeof v === "string" && v.includes('"insumo"')))
  assert.ok(guardado, "la propuesta queda guardada en el mensaje")
})

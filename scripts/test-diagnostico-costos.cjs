// Detector de costos mal calculados por unidades que no se pueden convertir.
// Casos tomados de los datos reales del sistema.

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
require.extensions[".ts"] = (mod, filename) =>
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText,
    filename,
  )

const {
  detectarProblemas,
  agruparPorInsumo,
  sugerirContenidoDesdeNombre,
} = require(path.join(RAIZ, "lib/diagnostico-costos.ts"))

// ─── Leer el contenido del nombre ────────────────────────────────────────

test("saca el contenido del nombre del insumo", () => {
  assert.deepEqual(sugerirContenidoDesdeNombre("FERNET BRANCA 750CC", "CC"), {
    cantidad: 750, unidad: "CC", origen: 'del nombre: "750CC"',
  })
  assert.equal(sugerirContenidoDesdeNombre("COCA COLA 2L", "CC").cantidad, 2000, "2 litros son 2000 cc")
  assert.equal(sugerirContenidoDesdeNombre("JUGO BAGGIO NARANJA 1L", "CC").cantidad, 1000)
  assert.equal(sugerirContenidoDesdeNombre("GIN GORDON´S 700", "CC").cantidad, 700, "número suelto al final")
  assert.equal(sugerirContenidoDesdeNombre("CAMPARI 750", "CC").unidad, "CC")
})

test("un número suelto se interpreta en la unidad que pide la receta", () => {
  assert.equal(sugerirContenidoDesdeNombre("PAQUETE 500", "GRS").unidad, "GRS")
  assert.equal(sugerirContenidoDesdeNombre("BOTELLA 500", "CC").unidad, "CC")
})

test("no inventa sugerencia cuando el nombre no dice nada", () => {
  assert.equal(sugerirContenidoDesdeNombre("APEROL", "CC"), null)
  assert.equal(sugerirContenidoDesdeNombre("ESPUMANTE", "CC"), null)
  assert.equal(sugerirContenidoDesdeNombre("ARVERJAS EN LATA", "GRS"), null)
  assert.equal(sugerirContenidoDesdeNombre("COCA COLA 3", "CC"), null, "un 3 suelto no es un contenido")
})

// ─── Detección ───────────────────────────────────────────────────────────

const GIN = { id: "gin", descripcion: "GIN GORDON´S 700", unidad: "UN", precioUnitario: 20571 }
const ARVEJAS = { id: "arv", descripcion: "ARVERJAS EN LATA", unidad: "UN", precioUnitario: 3900 }
const MAYONESA = { id: "may", descripcion: "MAYONESA", unidad: "KG", precioUnitario: 5354 }
const APEROL = { id: "ape", descripcion: "APEROL", unidad: "UN", precioUnitario: 15000 }

test("EL CASO REAL: el Martini con el gin por botella", () => {
  const p = detectarProblemas(
    "barra",
    [{ contenedorId: "c1", contenedorNombre: "MARTINI", insumoId: "gin", cantidad: 60, unidadPedida: "CC" }],
    [GIN],
  )
  assert.equal(p.length, 1)
  assert.equal(p[0].costoActual, 1234260, "lo que cobra hoy: 60 botellas")
  assert.ok(Math.abs(p[0].costoCorregido - 1763.23) < 0.1, "60cc de una botella de 700cc")
  assert.ok(Math.abs(p[0].vecesDeMas - 700) < 0.1, "700 veces de más")
  assert.equal(p[0].sugerencia.cantidad, 700)
  assert.equal(p[0].urgente, true, "más de 50M en un evento de 100")
})

test("no marca lo que ya está bien", () => {
  const p = detectarProblemas(
    "cocina",
    [
      // Insumo en KG: el sistema ya sabe convertir gramos
      { contenedorId: "r1", contenedorNombre: "ENSALADA RUSA", insumoId: "may", cantidad: 20, unidadPedida: "GRS" },
      // Insumo por unidad pedido por unidad: no hay nada que convertir
      { contenedorId: "r2", contenedorNombre: "OTRA", insumoId: "arv", cantidad: 2, unidadPedida: "UN" },
    ],
    [MAYONESA, ARVEJAS],
  )
  assert.deepEqual(p, [])
})

test("no marca el insumo que ya tiene el contenido cargado", () => {
  const arvejasOk = { ...ARVEJAS, contenidoCantidad: 200, contenidoUnidad: "GRS" }
  const p = detectarProblemas(
    "cocina",
    [{ contenedorId: "r1", contenedorNombre: "ENSALADA RUSA", insumoId: "arv", cantidad: 30, unidadPedida: "GRS" }],
    [arvejasOk],
  )
  assert.deepEqual(p, [], "ya está resuelto, sale de la lista")
})

test("detecta aunque no pueda sugerir el contenido", () => {
  const p = detectarProblemas(
    "barra",
    [{ contenedorId: "c1", contenedorNombre: "APEROL SPRITZ", insumoId: "ape", cantidad: 60, unidadPedida: "CC" }],
    [APEROL],
  )
  assert.equal(p.length, 1, "el problema existe igual")
  assert.equal(p[0].sugerencia, null, "pero hay que cargarlo a mano")
  assert.equal(p[0].costoCorregido, null)
  assert.equal(p[0].costoActual, 900000)
})

test("ordena por cuánta plata infla, no por orden alfabético", () => {
  const p = detectarProblemas(
    "barra",
    [
      { contenedorId: "c1", contenedorNombre: "CHICO", insumoId: "arv", cantidad: 1, unidadPedida: "GRS" },
      { contenedorId: "c2", contenedorNombre: "GRANDE", insumoId: "gin", cantidad: 60, unidadPedida: "CC" },
    ],
    [ARVEJAS, GIN],
  )
  assert.equal(p[0].contenedorNombre, "GRANDE", "el más caro primero")
})

test("agrupa por insumo: cargar el gin una vez arregla los 4 cócteles", () => {
  const p = detectarProblemas(
    "barra",
    [
      { contenedorId: "c1", contenedorNombre: "MARTINI", insumoId: "gin", cantidad: 60, unidadPedida: "CC" },
      { contenedorId: "c2", contenedorNombre: "GIN TONIC", insumoId: "gin", cantidad: 50, unidadPedida: "CC" },
      { contenedorId: "c3", contenedorNombre: "TOM COLLINS", insumoId: "gin", cantidad: 45, unidadPedida: "CC" },
      { contenedorId: "c4", contenedorNombre: "NEGRONI", insumoId: "gin", cantidad: 30, unidadPedida: "CC" },
    ],
    [GIN],
  )
  const grupos = agruparPorInsumo(p)
  assert.equal(grupos.length, 1, "un solo insumo para arreglar")
  assert.equal(grupos[0].afectados.length, 4, "que arregla 4 cócteles")
  assert.equal(grupos[0].sugerencia.cantidad, 700)
  assert.ok(grupos[0].impactoTotal > 0)
})

test("kilos y litros se pasan a la unidad del contenido", () => {
  // Carbón: la receta pide 0,5 KG y la bolsa trae 3000 GRS
  const carbon = { id: "car", descripcion: "CARBON 3000 GRS", unidad: "UN", precioUnitario: 430 }
  const p = detectarProblemas(
    "cocina",
    [{ contenedorId: "r1", contenedorNombre: "Asado", insumoId: "car", cantidad: 0.5, unidadPedida: "KG" }],
    [carbon],
  )
  // 0,5 KG = 500 GRS; 500 / 3000 de bolsa = 0,1667 bolsas
  assert.ok(Math.abs(p[0].costoCorregido - 71.67) < 0.1)
})

test("no mezcla peso con volumen al estimar", () => {
  // La receta pide gramos pero el nombre sugiere cc: no se puede estimar
  const botella = { id: "b", descripcion: "BOTELLA 750CC", unidad: "UN", precioUnitario: 1000 }
  const p = detectarProblemas(
    "cocina",
    [{ contenedorId: "r1", contenedorNombre: "X", insumoId: "b", cantidad: 30, unidadPedida: "GRS" }],
    [botella],
  )
  assert.equal(p.length, 1, "el problema se reporta igual")
  assert.equal(p[0].costoCorregido, null, "pero no se arriesga un número")
})

test("lista vacía cuando no hay nada mal", () => {
  assert.deepEqual(detectarProblemas("cocina", [], []), [])
  assert.deepEqual(agruparPorInsumo([]), [])
})

// ─── Escribir en litros y kilos ──────────────────────────────────────────

const { contenidoABase, contenidoDesdeBase } = require(path.join(RAIZ, "lib/diagnostico-costos.ts"))

test("se escribe en litros y se guarda en cc", () => {
  assert.deepEqual(contenidoABase(2, "L"), { cantidad: 2000, unidad: "CC" }, "una botella de 2 litros")
  assert.deepEqual(contenidoABase(1.5, "L"), { cantidad: 1500, unidad: "CC" })
  assert.deepEqual(contenidoABase(0.75, "L"), { cantidad: 750, unidad: "CC" }, "750 cc escrito como 0,75 L")
  assert.deepEqual(contenidoABase(750, "CC"), { cantidad: 750, unidad: "CC" }, "en cc no se toca")
})

test("se escribe en kilos y se guarda en gramos", () => {
  assert.deepEqual(contenidoABase(3, "KG"), { cantidad: 3000, unidad: "GRS" }, "una bolsa de 3 kilos")
  assert.deepEqual(contenidoABase(0.2, "KG"), { cantidad: 200, unidad: "GRS" }, "la lata de arvejas")
  assert.deepEqual(contenidoABase(200, "GRS"), { cantidad: 200, unidad: "GRS" })
})

test("al releerlo se muestra en la unidad más corta", () => {
  assert.deepEqual(contenidoDesdeBase(2000, "CC"), { cantidad: 2, unidad: "L" }, "2000 cc se lee '2 litros'")
  assert.deepEqual(contenidoDesdeBase(3000, "GRS"), { cantidad: 3, unidad: "KG" })
  assert.deepEqual(contenidoDesdeBase(750, "CC"), { cantidad: 750, unidad: "CC" }, "750 no es múltiplo de 1000")
  assert.deepEqual(contenidoDesdeBase(200, "GRS"), { cantidad: 200, unidad: "GRS" })
})

test("escribir y releer da lo mismo", () => {
  for (const [cant, uni] of [[2, "L"], [0.75, "L"], [3, "KG"], [0.2, "KG"], [473, "CC"], [200, "GRS"]]) {
    const guardado = contenidoABase(cant, uni)
    const releido = contenidoDesdeBase(guardado.cantidad, guardado.unidad)
    const otraVez = contenidoABase(releido.cantidad, releido.unidad)
    assert.deepEqual(otraVez, guardado, `${cant} ${uni} no sobrevivió el ida y vuelta`)
  }
})

// ─── Unidades de otra familia (la lima del Daiquiri, 27/10/2026) ─────────

const { detectarUnidadesCruzadas, detectarProblemas: detectar } = require(path.join(RAIZ, "lib/diagnostico-costos.ts"))
const { convertirAUnidadDeStock, normalizeToStockUnit } = require(path.join(RAIZ, "lib/unidades.ts"))

const LIMA = { id: "lima", descripcion: "LIMA", unidad: "KG", precioUnitario: 6000 }
const ALMIBAR = { id: "almibar", descripcion: "ALMIBAR", unidad: "UN", precioUnitario: 3000, contenidoCantidad: 1000, contenidoUnidad: "GRS" }
const GIN_CON_CONTENIDO = { id: "gin", descripcion: "GIN GORDON´S 700", unidad: "UN", precioUnitario: 20571, contenidoCantidad: 700, contenidoUnidad: "CC" }
const ARVEJAS_SIN_CONTENIDO = { id: "arvejas", descripcion: "ARVEJAS", unidad: "UN", precioUnitario: 1000 }

test("cc de algo que se compra por kilo no se puede convertir", () => {
  assert.equal(convertirAUnidadDeStock(30, "CC", "KG", null), null)
  assert.equal(convertirAUnidadDeStock(30, "GRS", "KG", null), 0.03, "30 gramos son 0,03 kilos")
  assert.equal(convertirAUnidadDeStock(15, "CC", "UN", { cantidad: 1000, unidad: "GRS" }), null, "almíbar en gramos pedido en cc")
  assert.equal(convertirAUnidadDeStock(60, "CC", "UN", { cantidad: 700, unidad: "CC" }), 60 / 700)
  // normalizeToStockUnit sigue igual: sin conversión deja la cantidad tal cual.
  const warn = console.warn
  console.warn = () => {}
  try {
    assert.equal(normalizeToStockUnit(30, "CC", "KG", null), 30)
  } finally {
    console.warn = warn
  }
})

test("el Daiquiri que pide la lima en cc sale como unidad cruzada", () => {
  const lineas = [
    { contenedorId: "daiquiri", contenedorNombre: "DAIQUIRI", insumoId: "lima", cantidad: 30, unidadPedida: "CC" },
    { contenedorId: "mojito", contenedorNombre: "MOJITO", insumoId: "lima", cantidad: 30, unidadPedida: "GRS" },
    { contenedorId: "daiquiri", contenedorNombre: "DAIQUIRI", insumoId: "almibar", cantidad: 15, unidadPedida: "CC" },
    { contenedorId: "martini", contenedorNombre: "MARTINI", insumoId: "gin", cantidad: 60, unidadPedida: "CC" },
    { contenedorId: "ensalada", contenedorNombre: "ENSALADA", insumoId: "arvejas", cantidad: 30, unidadPedida: "GRS" },
  ]
  const cruzadas = detectarUnidadesCruzadas("barra", lineas, [LIMA, ALMIBAR, GIN_CON_CONTENIDO, ARVEJAS_SIN_CONTENIDO])
  assert.deepEqual(cruzadas.map((c) => `${c.contenedorNombre}/${c.insumoDescripcion}`), ["DAIQUIRI/LIMA", "DAIQUIRI/ALMIBAR"])
  const lima = cruzadas[0]
  assert.equal(lima.costoActual, 180000, "30 'kilos' de lima a $6.000 por trago")
  assert.equal(lima.impactoEstimado, 18000000, "en un evento de 100 adultos")
  assert.equal(lima.urgente, false)
  assert.equal(cruzadas[1].contenidoUnidad, "GRS")
  // Las arvejas sin contenido no se repiten: ya las lista detectarProblemas.
  assert.deepEqual(detectar("barra", lineas, [LIMA, ALMIBAR, GIN_CON_CONTENIDO, ARVEJAS_SIN_CONTENIDO]).map((p) => p.insumoId), ["arvejas"])
})

test("sin unidad pedida o con la misma unidad no hay nada cruzado", () => {
  const lineas = [
    { contenedorId: "a", contenedorNombre: "A", insumoId: "lima", cantidad: 1, unidadPedida: "KG" },
    { contenedorId: "b", contenedorNombre: "B", insumoId: "lima", cantidad: 1, unidadPedida: undefined },
    { contenedorId: "c", contenedorNombre: "C", insumoId: "otro", cantidad: 1, unidadPedida: "CC" },
  ]
  assert.deepEqual(detectarUnidadesCruzadas("cocina", lineas, [LIMA]), [])
})

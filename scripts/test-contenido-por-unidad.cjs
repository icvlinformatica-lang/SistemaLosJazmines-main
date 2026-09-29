// Conversión de unidades cuando el insumo se compra por unidad (una lata,
// una bolsa) y la receta pide gramos o cc.
//
// El caso que lo motivó: la Ensalada Rusa pide 30 GRS de arvejas por persona,
// la lata está cargada en "UN" a $3.900, y el sistema leía "30 latas" — o sea
// $117.000 de arvejas por cubierto.

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
  normalizeToStockUnit,
  getCompatibleRecipeUnits,
  contenidoDe,
  insumoNecesitaContenido,
  calcularCostoReceta,
} = require(path.join(RAIZ, "lib/store.ts"))

const LATA_ARVEJAS = {
  id: "arv",
  codigo: "INS111",
  descripcion: "ARVERJAS EN LATA",
  unidad: "UN",
  stockActual: 0,
  precioUnitario: 3900,
  contenidoCantidad: 200,
  contenidoUnidad: "GRS",
}

test("EL CASO REAL: 30 grs de una lata de 200 grs son 0,15 latas", () => {
  const latas = normalizeToStockUnit(30, "GRS", "UN", contenidoDe(LATA_ARVEJAS))
  assert.equal(latas, 0.15)
  assert.equal(latas * LATA_ARVEJAS.precioUnitario, 585, "$585 por persona, no $117.000")
})

test("sin el contenido cargado se comporta como antes (no rompe nada)", () => {
  const sinDato = { ...LATA_ARVEJAS, contenidoCantidad: undefined, contenidoUnidad: undefined }
  // Devuelve la cantidad tal cual: es el comportamiento viejo, que sobrevalúa
  // el costo, pero es el que tienen hoy todos los insumos sin completar.
  assert.equal(normalizeToStockUnit(30, "GRS", "UN", contenidoDe(sinDato)), 30)
  assert.equal(contenidoDe(sinDato), null)
})

test("también convierte kilos contra un contenido en gramos", () => {
  // 1 KG pedido de un insumo que viene en latas de 200 GRS = 5 latas
  assert.equal(normalizeToStockUnit(1, "KG", "UN", contenidoDe(LATA_ARVEJAS)), 5)
})

test("volumen: 300 cc de una botella de 750 cc", () => {
  const botella = { unidad: "UN", contenidoCantidad: 750, contenidoUnidad: "CC" }
  assert.equal(normalizeToStockUnit(750, "CC", "UN", contenidoDe(botella)), 1)
  assert.equal(normalizeToStockUnit(375, "CC", "UN", contenidoDe(botella)), 0.5)
  // 1 litro de botellas de 750 cc
  assert.ok(Math.abs(normalizeToStockUnit(1, "L", "UN", contenidoDe(botella)) - 1.3333) < 0.001)
})

test("no mezcla peso con volumen", () => {
  // Pedir gramos de algo cuyo contenido está en cc no se puede convertir:
  // queda como antes en vez de inventar una equivalencia.
  const botella = { unidad: "UN", contenidoCantidad: 750, contenidoUnidad: "CC" }
  const original = console.warn
  console.warn = () => {}
  try {
    assert.equal(normalizeToStockUnit(30, "GRS", "UN", contenidoDe(botella)), 30)
  } finally {
    console.warn = original
  }
})

test("las conversiones que ya andaban no cambian", () => {
  assert.equal(normalizeToStockUnit(300, "GRS", "KG"), 0.3)
  assert.equal(normalizeToStockUnit(0.3, "KG", "GRS"), 300)
  assert.equal(normalizeToStockUnit(500, "CC", "L"), 0.5)
  assert.equal(normalizeToStockUnit(0.5, "L", "CC"), 500)
  assert.equal(normalizeToStockUnit(2, "UN", "UN"), 2)
  assert.equal(normalizeToStockUnit(5, undefined, "KG"), 5, "sin unidad de receta, tal cual")
})

test("el contenido habilita pedir la receta en peso", () => {
  assert.deepEqual(getCompatibleRecipeUnits("UN"), ["UN"], "sin contenido, solo unidades")
  assert.deepEqual(getCompatibleRecipeUnits("UN", contenidoDe(LATA_ARVEJAS)), ["UN", "GRS", "KG"])
  assert.deepEqual(
    getCompatibleRecipeUnits("UN", contenidoDe({ unidad: "UN", contenidoCantidad: 750, contenidoUnidad: "CC" })),
    ["UN", "CC", "L"],
  )
  // Las unidades de siempre no cambian
  assert.deepEqual(getCompatibleRecipeUnits("KG"), ["GRS", "KG"])
  assert.deepEqual(getCompatibleRecipeUnits("CC"), ["CC", "L"])
})

test("avisa qué insumos por unidad les falta el contenido", () => {
  assert.equal(insumoNecesitaContenido(LATA_ARVEJAS), false)
  assert.equal(insumoNecesitaContenido({ unidad: "UN", contenidoCantidad: undefined }), true)
  assert.equal(insumoNecesitaContenido({ unidad: "KG", contenidoCantidad: undefined }), false, "los KG se convierten solos")
})

test("ENSALADA RUSA completa: el costo por persona baja de $118.020 a $1.605", () => {
  const insumos = [
    LATA_ARVEJAS,
    { id: "may", unidad: "KG", precioUnitario: 5354 },
    { id: "papa", unidad: "KG", precioUnitario: 1500 },
    { id: "sal", unidad: "KG", precioUnitario: 1000 },
    { id: "zan", unidad: "KG", precioUnitario: 4000 },
  ]
  const receta = {
    factorRendimiento: 1,
    insumos: [
      { insumoId: "arv", cantidadBasePorPersona: 30, unidadReceta: "GRS" },
      { insumoId: "may", cantidadBasePorPersona: 20, unidadReceta: "GRS" },
      { insumoId: "papa", cantidadBasePorPersona: 50, unidadReceta: "GRS" },
      { insumoId: "sal", cantidadBasePorPersona: 20, unidadReceta: "GRS" },
      { insumoId: "zan", cantidadBasePorPersona: 50, unidadReceta: "GRS" },
    ],
  }

  const conDato = calcularCostoReceta(receta, insumos)
  // 585 (arvejas) + 107,08 + 75 + 20 + 200
  assert.ok(Math.abs(conDato - 987.08) < 0.01, `esperaba ~987, dio ${conDato}`)

  const sinDato = calcularCostoReceta(receta, [
    { ...LATA_ARVEJAS, contenidoCantidad: undefined, contenidoUnidad: undefined },
    ...insumos.slice(1),
  ])
  assert.ok(Math.abs(sinDato - 117402.08) < 0.01, `sin el dato daba ~117.402, dio ${sinDato}`)
  assert.ok(sinDato / conDato > 100, "el costo estaba más de 100 veces inflado")
})

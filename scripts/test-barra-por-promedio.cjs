// Barra por promedio (lib/barra-por-promedio.ts y calcularComprasBarras de lib/store.ts):
// cócteles con alcohol = promedio × 4 por adulto; bebida de mesa aparte, 1 por adulto.
// Correr: node --test scripts/test-barra-por-promedio.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const root = path.resolve(__dirname, "..")

const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolveFilename.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args)
}
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    })
    module._compile(outputText, filename)
  }
}
const { tragosPorCoctelEvento, esCoctelDeMesa, esBebidaSinAlcoholDeMesa, TRAGOS_POR_ADULTO } = require("../lib/barra-por-promedio.ts")
const { calcularComprasBarras } = require("../lib/store.ts")

// Insumos de barra con precio por unidad de stock (UN) para que el costo de
// cada trago sea fácil de leer: 1 unidad por trago.
const insumo = (id, precio) => ({ id, codigo: id, descripcion: id, unidad: "UN", precioUnitario: precio, stockActual: 0, categoria: "Alcoholes" })
const coctel = (id, nombre, categoria, insumoId) => ({ id, nombre, categoria, insumos: [{ insumoBarraId: insumoId, cantidadPorCoctel: 1, unidadCoctel: "UN" }] })
const INSUMOS = [insumo("i-mojito", 1600), insumo("i-gin", 1700), insumo("i-margarita", 3600), insumo("i-fernet", 1500), insumo("i-mesa", 7880), insumo("i-jugo", 500), insumo("i-sinalc", 1200)]
const COCTELES = [
  coctel("mojito", "MOJITO", "Con Alcohol", "i-mojito"),
  coctel("gin", "GIN TONIC", "Con Alcohol", "i-gin"),
  coctel("margarita", "MARGARITA", "Con Alcohol", "i-margarita"),
  coctel("fernet", "FERNET CON COCA", "Con Alcohol", "i-fernet"),
  coctel("mesa", "BEBIDA DE MESA", "Bebida de mesa", "i-mesa"),
  coctel("jugo", "JUGO", "Sin Alcohol", "i-jugo"),
  coctel("sinalc", "BEBIDAS SIN ALCOHOL", "Bebidas sin alcohol", "i-sinalc"),
]
const evento = (cocteles, extra = {}) => ({ adultos: 70, adolescentes: 30, ninos: 0, barras: [{ id: "b", barraTemplateId: "", coctelesIncluidos: cocteles, tragosPorPersona: 2 }], ...extra })
const costoBarra = (ev, cocteles = COCTELES) => Math.round(calcularComprasBarras(ev, cocteles, INSUMOS).reduce((s, c) => s + c.costoMateriaPrima, 0) * 100) / 100

test("son 4 tragos con alcohol por adulto", () => {
  assert.equal(TRAGOS_POR_ADULTO, 4)
})

test("costo = promedio de los tragos elegidos × 4 × adultos, más la bebida de mesa aparte", () => {
  // Promedio de 1.600, 1.700 y 3.600 = 2.300 → 2.300 × 4 × 70 = 644.000
  // Bebida de mesa: 7.880 × 70 = 551.600 → total 1.195.600
  assert.equal(costoBarra(evento(["mojito", "gin", "margarita", "mesa"])), 1195600)
})

test("elijan 2 o 4 tragos, siempre son 4 por adulto", () => {
  // 2 tragos: promedio 1.650 × 4 × 70 = 462.000 (2 de cada uno por adulto)
  assert.equal(costoBarra(evento(["mojito", "gin"])), 462000)
  // 4 tragos: promedio (1.600+1.700+3.600+1.500)/4 = 2.100 × 4 × 70 = 588.000 (1 de cada uno)
  assert.equal(costoBarra(evento(["mojito", "gin", "margarita", "fernet"])), 588000)
})

test("las cantidades a comprar se reparten entre los tragos elegidos", () => {
  const compras = calcularComprasBarras(evento(["mojito", "gin", "margarita", "mesa"]), COCTELES, INSUMOS)
  const cant = Object.fromEntries(compras.map((c) => [c.insumoBarraId, Math.round(c.cantidadNecesaria * 1000) / 1000]))
  // 70 adultos × 4 tragos / 3 cócteles = 93,333 de cada uno; bebida de mesa 70
  assert.deepEqual(cant, { "i-mojito": 93.333, "i-gin": 93.333, "i-margarita": 93.333, "i-mesa": 70 })
})

test("la bebida de mesa sola suma 1 por adulto y no entra en el promedio", () => {
  assert.equal(costoBarra(evento(["mesa"])), 551600)
  const t = tragosPorCoctelEvento({ adultos: 70 }, ["mesa", "mojito"], COCTELES)
  assert.equal(t.get("mesa"), 70)
  assert.equal(t.get("mojito"), 280)
})

test("la bebida de mesa cargada antes, como Con Alcohol, se reconoce por el nombre", () => {
  const viejos = COCTELES.map((c) => (c.id === "mesa" ? { ...c, categoria: "Con Alcohol" } : c))
  assert.equal(esCoctelDeMesa({ categoria: "Con Alcohol", nombre: "Bebida de Mesa" }), true)
  assert.equal(esCoctelDeMesa({ categoria: "Con Alcohol", nombre: "MOJITO" }), false)
  assert.equal(costoBarra(evento(["mojito", "gin", "margarita", "mesa"]), viejos), 1195600)
})

test("sin alcohol sigue como antes: 1 por adolescente y niño de cada uno", () => {
  // Jugo: 500 × 30 menores = 15.000; mojito solo: 1.600 × 4 × 70 = 448.000
  assert.equal(costoBarra(evento(["jugo", "mojito"])), 463000)
})

test("un cóctel repetido en dos barras cuenta una sola vez", () => {
  const ev = evento([], { barras: [
    { id: "a", barraTemplateId: "", coctelesIncluidos: ["mojito", "gin"], tragosPorPersona: 2 },
    { id: "b", barraTemplateId: "", coctelesIncluidos: ["gin"], tragosPorPersona: 2 },
  ] })
  assert.equal(costoBarra(ev), 462000)
})

test("sin adultos o sin tragos, la barra no cuesta nada", () => {
  assert.equal(costoBarra(evento(["mojito", "mesa"], { adultos: 0 })), 0)
  assert.equal(costoBarra(evento([])), 0)
})

test("bebidas sin alcohol: 1 por persona (adultos, adolescentes, niños y dietas), fuera del promedio", () => {
  // 70 adultos + 30 adolescentes + 5 niños + 2 dietas = 107 personas × $1.200 = $128.400
  const ev = evento(["sinalc", "mojito"], { ninos: 5, personasDietasEspeciales: 2 })
  const t = tragosPorCoctelEvento(ev, ["sinalc", "mojito"], COCTELES)
  assert.equal(t.get("sinalc"), 107)
  // El mojito sigue solo en el promedio: 1.600 × 4 × 70 = 448.000
  assert.equal(t.get("mojito"), 280)
  assert.equal(costoBarra(ev), 576400)
})

test("evento completo: bebida de mesa + bebidas sin alcohol + cócteles por promedio × 4", () => {
  // Mesa 7.880 × 70 = 551.600; sin alcohol 1.200 × 100 = 120.000;
  // cócteles (1.600 + 1.700 + 3.600) / 3 = 2.300 × 4 × 70 = 644.000 → 1.315.600
  assert.equal(costoBarra(evento(["mesa", "sinalc", "mojito", "gin", "margarita"])), 1315600)
})

test("con 1 solo cóctel no hay promedio: son 4 de ese cóctel por adulto", () => {
  // 3.600 × 4 × 70 = 1.008.000
  assert.equal(costoBarra(evento(["margarita"])), 1008000)
})

test("con 20 cócteles, igual son 4 por adulto en total", () => {
  const veinte = Array.from({ length: 20 }, (_, i) => coctel(`c${i}`, `TRAGO ${i}`, "Con Alcohol", i % 2 ? "i-mojito" : "i-gin"))
  const t = tragosPorCoctelEvento({ adultos: 70 }, veinte.map((c) => c.id), veinte)
  const total = [...t.values()].reduce((a, b) => a + b, 0)
  assert.equal(Math.round(total * 1000) / 1000, 280)
  // Promedio de 1.600 y 1.700 (mitad y mitad) = 1.650 × 4 × 70 = 462.000
  assert.equal(costoBarra(evento(veinte.map((c) => c.id)), veinte), 462000)
})

test("se reconoce por la categoría o por el nombre, y no se confunde con los cócteles 'Sin Alcohol'", () => {
  assert.equal(esBebidaSinAlcoholDeMesa({ categoria: "Con Alcohol", nombre: "Bebidas sin alcohol" }), true)
  assert.equal(esBebidaSinAlcoholDeMesa({ categoria: "Bebidas sin alcohol", nombre: "GASEOSA Y AGUA" }), true)
  assert.equal(esBebidaSinAlcoholDeMesa({ categoria: "Sin Alcohol", nombre: "LIMONADA" }), false)
  assert.equal(esBebidaSinAlcoholDeMesa({ categoria: "Bebida de mesa", nombre: "BEBIDA DE MESA" }), false)
})

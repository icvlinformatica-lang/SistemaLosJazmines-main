// Cotizador rápido, Parte 1: precio por porción de un plato y precio de
// referencia de una barra armada.
// Correr: node --test scripts/test-precio-menu-barra.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(out.outputText, filename)
}
const { costoPorPorcion, precioPorPorcion } = require("../lib/precio-menu.ts")
const { precioBarraArmada, precioBarraDesdeCostos, precioTragoConMargen } = require("../lib/precio-barra-cotizador.ts")

// calcularCostoReceta vive en lib/store.ts (cliente, con muchas dependencias):
// se extrae su texto y se compila sola, para comparar contra la MISMA función
// que usa el resto del sistema sin copiarla a mano.
function cargarCalcularCostoReceta() {
  const fuente = fs.readFileSync(path.join(__dirname, "../lib/store.ts"), "utf8")
  const ini = fuente.indexOf("export function calcularCostoReceta(")
  assert.ok(ini >= 0, "no se encontró calcularCostoReceta en lib/store.ts")
  let i = fuente.indexOf("{", fuente.indexOf(")", fuente.indexOf("insumos: Insumo[]", ini)))
  let nivel = 0
  for (; i < fuente.length; i++) {
    if (fuente[i] === "{") nivel++
    else if (fuente[i] === "}" && --nivel === 0) break
  }
  const codigo = `const { contenidoDe, normalizeToStockUnit } = require(${JSON.stringify(path.join(__dirname, "../lib/unidades.ts"))});\n` +
    fuente.slice(ini, i + 1).replace("export function", "function") + "\nmodule.exports = calcularCostoReceta;"
  const js = ts.transpileModule(codigo, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const m = { exports: {} }
  new Function("module", "exports", "require", js)(m, m.exports, require)
  return m.exports
}
const calcularCostoReceta = cargarCalcularCostoReceta()

const insumos = [
  { id: "pollo", unidad: "KG", precioUnitario: 8000 },
  { id: "pan", unidad: "KG", precioUnitario: 3000 },
  { id: "huevo", unidad: "UN", precioUnitario: 200 },
  { id: "lata", unidad: "UN", precioUnitario: 1200, contenidoCantidad: 400, contenidoUnidad: "GRS" },
]

const recetas = [
  { id: "suprema", factorRendimiento: 1, insumos: [
    { insumoId: "pollo", detalleCorte: "", cantidadBasePorPersona: 250, unidadReceta: "GRS" },
    { insumoId: "pan", detalleCorte: "", cantidadBasePorPersona: 0.05, unidadReceta: "KG" },
    { insumoId: "huevo", detalleCorte: "", cantidadBasePorPersona: 0.5, unidadReceta: "UN" },
  ] },
  // Receta que rinde para 20 (ej. una bandeja): factor 20.
  { id: "bandeja", factorRendimiento: 20, insumos: [
    { insumoId: "lata", detalleCorte: "", cantidadBasePorPersona: 800, unidadReceta: "GRS" },
    { insumoId: "huevo", detalleCorte: "", cantidadBasePorPersona: 6, unidadReceta: "UN" },
  ] },
  { id: "sin-factor", insumos: [{ insumoId: "pan", detalleCorte: "", cantidadBasePorPersona: 0.1, unidadReceta: "KG" }] },
  { id: "insumo-borrado", factorRendimiento: 1, insumos: [{ insumoId: "no-existe", detalleCorte: "", cantidadBasePorPersona: 1 }] },
]

test("costo por porción = calcularCostoReceta (misma cuenta)", () => {
  for (const r of recetas) {
    assert.equal(costoPorPorcion(r, insumos), calcularCostoReceta(r, insumos), r.id)
  }
})

test("costo por porción de ejemplo", () => {
  // 0,25 kg × 8000 + 0,05 kg × 3000 + 0,5 × 200 = 2000 + 150 + 100
  assert.equal(costoPorPorcion(recetas[0], insumos), 2250)
  // (2 latas × 1200 + 6 × 200) / 20 porciones = 3600 / 20
  assert.equal(costoPorPorcion(recetas[1], insumos), 180)
})

test("precio por porción = costo × (1 + margen), redondeado a pesos", () => {
  assert.equal(precioPorPorcion(2250, 0.5), 3375)
  assert.equal(precioPorPorcion(180.4, 0.5), 271)
  assert.equal(precioPorPorcion(1000, 0), 1000)
})

test("barra con 3 cócteles a $1.000, $1.500 y $2.000 por trago", () => {
  const r = precioBarraArmada([1000, 1500, 2000])
  assert.equal(r.precioPorAdulto, 4500)
  assert.equal(r.tragosPorAdulto, 3)
  assert.equal(r.esGrande, false)
})

test("el margen de barra mueve el precio", () => {
  const costos = { a: 1000, b: 1500, c: 2000 }
  assert.equal(precioBarraDesdeCostos(["a", "b", "c"], costos, 0).precioPorAdulto, 4500)
  assert.equal(precioBarraDesdeCostos(["a", "b", "c"], costos, 0.5).precioPorAdulto, 6750)
  assert.equal(precioBarraDesdeCostos(["a", "b", "c"], costos, 1).precioPorAdulto, 9000)
  assert.equal(precioTragoConMargen(1001, 0.5), 1502)
})

test("más de 6 cócteles es barra grande; cócteles borrados no cuentan", () => {
  assert.equal(precioBarraArmada([1, 1, 1, 1, 1, 1]).esGrande, false)
  assert.equal(precioBarraArmada([1, 1, 1, 1, 1, 1, 1]).esGrande, true)
  const r = precioBarraDesdeCostos(["a", "borrado"], { a: 1000 }, 0.5)
  assert.equal(r.tragosPorAdulto, 1)
  assert.equal(r.precioPorAdulto, 1500)
})

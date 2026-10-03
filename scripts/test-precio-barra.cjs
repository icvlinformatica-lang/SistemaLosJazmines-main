// Pruebas del costo y precio de UN trago (lib/precio-barra.ts). Funciones puras.
// La barra del cotizador ahora es la barra ARMADA del salón: ver
// scripts/test-cotizador-salon.cjs y scripts/test-cotizacion-salon.cjs.

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

const precioBarra = require("../lib/precio-barra.ts")
const { costoPorTrago, precioPorTrago, MARGEN_BARRA } = precioBarra
const tarifario = fs.readFileSync(path.join(RAIZ, "lib/tarifario-cotizador.ts"), "utf8")

test("margen por trago 50 %", () => {
  assert.equal(MARGEN_BARRA, 0.5)
})

test("la fórmula vieja '2 tragos por adulto × promedio' ya no existe (que no queden dos)", () => {
  assert.equal(precioBarra.TRAGOS_POR_ADULTO, undefined)
  assert.equal(precioBarra.calcularBarraPersonalizada, undefined)
  assert.doesNotMatch(tarifario, /calcularBarraPersonalizada|barraPersonalizada/)
})

test("costo por trago: insumos convertidos a la unidad de stock × precio", () => {
  const insumos = [
    { id: "gin", unidad: "UN", precioUnitario: 7000, contenidoCantidad: 700, contenidoUnidad: "CC" }, // botella de 700 cc
    { id: "tonica", unidad: "L", precioUnitario: 2000 },
    { id: "borrado", unidad: "UN", precioUnitario: 999 },
  ]
  const coctel = {
    insumos: [
      { insumoBarraId: "gin", cantidadPorCoctel: 70, unidadCoctel: "CC" }, // 0,1 botella = 700
      { insumoBarraId: "tonica", cantidadPorCoctel: 200, unidadCoctel: "CC" }, // 0,2 L = 400
      { insumoBarraId: "no-existe", cantidadPorCoctel: 5, unidadCoctel: "CC" }, // se ignora
    ],
  }
  assert.equal(Math.round(costoPorTrago(coctel, insumos)), 1100)
  assert.equal(costoPorTrago({ insumos: [] }, insumos), 0)
})

test("precio por trago = costo × 1,5, redondeado a pesos", () => {
  assert.equal(precioPorTrago(1000), 1500)
  assert.equal(precioPorTrago(1101), 1652) // 1651,5 → 1652
  assert.equal(precioPorTrago(0), 0)
  assert.equal(precioPorTrago(NaN), 0)
})

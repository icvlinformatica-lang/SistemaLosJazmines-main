// Siluetas de los insumos (lib/iconos-insumos.ts), verificadas contra los
// nombres REALES que hay cargados en el sistema.
//
// lucide-react no se puede importar en Node sin React, así que se reemplaza
// por un proxy que devuelve el nombre del ícono como texto.

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
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "lucide-react") return new Proxy({}, { get: (_, k) => String(k) })
  return load.call(this, request, ...args)
}
require.extensions[".ts"] = (mod, filename) =>
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText,
    filename,
  )

const { iconoDeInsumo, iconoDeInsumoBarra } = require(path.join(RAIZ, "lib/iconos-insumos.ts"))

test("insumos de cocina reales: cada uno con su silueta", () => {
  const esperado = {
    "ARVERJAS EN LATA": "Carrot", // el sistema lo tiene escrito con R de más
    "CARNE VACIO": "Beef",
    "MILANESA DE POLLO (SUPREMA)": "Drumstick",
    "Bondiola a la Parrilla": "Beef",
    MUZARELLA: "Milk",
    HUEVOS: "Egg",
    "PAPA NEGRA BOLSA": "Carrot",
    ZANAHORIA: "Carrot",
    "SAL fina": "Nut", // condimento
    HARINA: "Wheat",
    "PAN RALLADO": "Sandwich",
    "Helado Casata": "IceCream",
    "LEMON PIE": "Cake",
    "Pizza Party": "Pizza",
    CARBON: "Flame",
    AJO: "LeafyGreen",
    Baguette: "Sandwich",
    "ENSALADA RUSA": "Salad",
    "Tabla de Fiambres": "Ham",
    "Pinchos Langostino Rebozado": "Fish",
  }
  const fallan = []
  for (const [nombre, icono] of Object.entries(esperado)) {
    const real = iconoDeInsumo(nombre)
    if (real !== icono) fallan.push(`${nombre}: esperaba ${icono}, dio ${real}`)
  }
  // Se informan todos los desajustes juntos, no solo el primero.
  assert.equal(fallan.length, 0, "\n  " + fallan.join("\n  "))
})

test("insumos de barra reales: botella, lata o copa según lo que sea", () => {
  const esperado = {
    "GIN GORDON´S 700": "Martini",
    "FERNET BRANCA 750CC": "Martini",
    "CAMPARI 750": "Martini",
    APEROL: "Martini",
    "WHISKY RED LABEL": "Martini",
    "COCA COLA 2L": "CupSoda",
    "TONICA 2.25": "CupSoda",
    "Levite naranja": "CupSoda",
    "Los jazmines Cabernet": "Wine",
    "Los jazmines malbec": "Wine",
    ESPUMANTE: "Wine",
    "cerveza lata 473cc golden": "Beer",
    "Cerveza lata 473cc ipa": "Beer",
    "JUGO BAGGIO NARANJA 1L": "Citrus",
    "Pulpa frutilla": "Citrus",
    MENTA: "LeafyGreen",
  }
  const fallan = []
  for (const [nombre, icono] of Object.entries(esperado)) {
    const real = iconoDeInsumoBarra(nombre, "Alcoholes")
    if (real !== icono) fallan.push(`${nombre}: esperaba ${icono}, dio ${real}`)
  }
  assert.equal(fallan.length, 0, "\n  " + fallan.join("\n  "))
})

test("en barra, lo que no se reconoce cae en la categoría", () => {
  assert.equal(iconoDeInsumoBarra("XYZ RARO", "Alcoholes"), "Wine")
  assert.equal(iconoDeInsumoBarra("XYZ RARO", "Licores"), "Martini")
  assert.equal(iconoDeInsumoBarra("XYZ RARO", "Jugos"), "CupSoda")
  assert.equal(iconoDeInsumoBarra("XYZ RARO", "Garnish"), "LeafyGreen")
  assert.equal(iconoDeInsumoBarra("XYZ RARO", undefined), "Wine", "sin categoría, una botella")
})

test("en cocina, lo que no se reconoce queda con la caja neutra", () => {
  assert.equal(iconoDeInsumo("XYZ RARO"), "Package")
  assert.equal(iconoDeInsumo(""), "Package")
  assert.equal(iconoDeInsumo(undefined), "Package", "sin nombre no rompe")
})

test("no distingue mayúsculas ni acentos del nombre", () => {
  assert.equal(iconoDeInsumo("HUEVOS"), iconoDeInsumo("huevos"))
  assert.equal(iconoDeInsumo("Champiñón"), "Carrot")
  assert.equal(iconoDeInsumo("CHAMPIÑON"), "Carrot")
})

test("la regla más específica gana a la general", () => {
  // "crema de leche" es lácteo aunque "crema" sola sea postre
  assert.equal(iconoDeInsumo("CREMA DE LECHE"), "Milk")
  // "helado" gana sobre "dulce"
  assert.equal(iconoDeInsumo("Helado dulce de leche"), "IceCream")
})

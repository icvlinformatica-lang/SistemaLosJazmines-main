// El papel de la lista de compras (imprimirDocumentoEvento en
// lib/print-utils.ts) muestra la columna "STOCK ACTUAL" y calcula el
// faltante contra ella. El caso del dueño: si hay 500 botellas y el evento
// necesita 10, el papel dice "500 UN" en stock y no pide comprar nada.

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

const { imprimirDocumentoEvento, smartUnitsForShopping } = require(path.join(RAIZ, "lib/print-utils.ts"))

// Una ventana de mentira que guarda lo que se escribe en el papel.
function imprimir(data, sections) {
  let html = ""
  global.window = {
    open: () => ({ document: { write: (h) => { html += h }, close() {} }, print() {}, close() {}, focus() {} }),
  }
  const setTimeoutOriginal = global.setTimeout
  global.setTimeout = () => 0
  try {
    imprimirDocumentoEvento(data, sections)
  } finally {
    global.setTimeout = setTimeoutOriginal
    delete global.window
  }
  return html
}

const filaDe = (html, nombre) => {
  const i = html.indexOf(`>${nombre}</td>`)
  assert.ok(i >= 0, `no está la fila de ${nombre}`)
  return html.slice(i, html.indexOf("</tr>", i))
}
// La fila arranca después del nombre: proveedor, necesario, stock, faltante…
const celdas = (fila) => [...fila.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1])

const insumoBarra = (id, descripcion, stockActual, extra = {}) => ({
  id, codigo: id, descripcion, unidad: "UN", stockActual, precioUnitario: 1000, proveedor: "-", ...extra,
})

const evento = {
  id: "ev1", nombre: "PRUEBA", nombrePareja: "PRUEBA", fecha: "2026-11-01", salon: "Casona",
  adultos: 10, adolescentes: 0, ninos: 0, personasDietasEspeciales: 0,
  recetasAdultos: [], recetasAdolescentes: [], recetasNinos: [], recetasDietasEspeciales: [],
  barras: [{ barraTemplateId: "b1", tragosPorPersona: 1, coctelesIncluidos: ["cerveza", "espumante"] }],
}
// Un trago por adulto: 10 adultos = 10 latas de cerveza y 10 botellas de espumante.
const cocteles = [
  { id: "cerveza", nombre: "Cerveza", categoria: "Con Alcohol", insumos: [{ insumoBarraId: "lata", cantidadPorCoctel: 1, unidadCoctel: "UN" }] },
  { id: "espumante", nombre: "Espumante", categoria: "Con Alcohol", insumos: [{ insumoBarraId: "espu", cantidadPorCoctel: 1, unidadCoctel: "UN" }] },
]
const secciones = { listaCompras: false, barraCocteles: true, guiaProduccion: false, hojaGastos: false }

test("500 botellas en stock y se necesitan 10: stock actual 500 UN y no falta nada", () => {
  const html = imprimir(
    { evento, recetas: [], insumos: [], insumosBarra: [insumoBarra("lata", "LATA CERVEZA", 500), insumoBarra("espu", "ESPUMANTE", 4)], cocteles, barrasTemplates: [] },
    secciones,
  )
  assert.match(html, /STOCK ACTUAL/)
  const [, necesario, stock, faltante] = celdas(filaDe(html, "LATA CERVEZA"))
  assert.equal(necesario, "10 UN")
  assert.equal(stock, "500 UN")
  assert.equal(faltante, "-")
  // Y si hay menos de lo que se necesita, pide la diferencia.
  const [, nec2, stock2, falt2] = celdas(filaDe(html, "ESPUMANTE"))
  assert.deepEqual([nec2, stock2, falt2], ["10 UN", "4 UN", "6 UN"])
})

test("con stock por salón, la columna dice STOCK ACTUAL y de qué salón", () => {
  const vacio = new Map()
  const html = imprimir(
    {
      evento, recetas: [], insumos: [], insumosBarra: [insumoBarra("lata", "LATA CERVEZA", 500)], cocteles, barrasTemplates: [],
      stockOtrosSalones: { cocina: vacio, barra: new Map([["lata", [{ salon: "Casona", cantidad: 500 }]]]), salon: "Casona" },
    },
    secciones,
  )
  assert.match(html, /STOCK ACTUAL<br><span[^>]*>EN CASONA<\/span>/)
})

test("las unidades enteras van sin decimales y las fracciones con uno", () => {
  assert.equal(smartUnitsForShopping(500, "UN"), "500 UN")
  assert.equal(smartUnitsForShopping(2.5, "UN"), "2.5 UN")
  assert.equal(smartUnitsForShopping(10.04, "UN"), "10 UN")
  assert.equal(smartUnitsForShopping(1.5, "KG"), "1.50 KG")
})

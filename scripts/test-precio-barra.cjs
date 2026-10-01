// Pruebas del precio de la barra personalizada (lib/precio-barra.ts) y de su
// línea en el cotizador (lib/tarifario-cotizador.ts). Funciones puras.

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

const { costoPorTrago, precioPorTrago, calcularBarraPersonalizada, MARGEN_BARRA, TRAGOS_POR_ADULTO, ID_BARRA_PERSONALIZADA } =
  require("../lib/precio-barra.ts")
const { calcularCotizacion, AVISO_FUERA_DE_TARIFARIO } = require("../lib/tarifario-cotizador.ts")

test("reglas del negocio: margen 50 % y 2 tragos por adulto", () => {
  assert.equal(MARGEN_BARRA, 0.5)
  assert.equal(TRAGOS_POR_ADULTO, 2)
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

test("barra personalizada: 2 tragos por adulto EN TOTAL × precio promedio", () => {
  // 100 adultos, cócteles de 1.500 y 2.500 → promedio 2.000 → 200 tragos × 2.000
  assert.deepEqual(calcularBarraPersonalizada([1500, 2500], 100), { tragos: 200, precioPromedio: 2000, total: 400000 })
  // Más cócteles no multiplica los tragos, solo cambia el promedio.
  assert.equal(calcularBarraPersonalizada([1500, 2500, 2000], 100).tragos, 200)
})

test("barra personalizada sin cócteles o sin adultos no suma", () => {
  assert.equal(calcularBarraPersonalizada([], 100).total, 0)
  assert.equal(calcularBarraPersonalizada([2000], 0).total, 0)
  assert.equal(calcularBarraPersonalizada([2000], -5).tragos, 0)
})

const base = (extra = {}) => ({
  salon: "Casona",
  fechaEvento: "2026-11-14",
  modalidad: "solo_salon",
  totalInvitados: 120,
  serviciosElegidos: [],
  catalogoServicios: [],
  tarifario: [{ salon: "Casona", invitadosMin: 100, invitadosMax: 150, dia: "sabado", modalidad: "solo_salon", precio: 5000000 }],
  preciosVenta: {},
  ...extra,
})

test("cotizador: la barra personalizada suma una línea y entra en el total", () => {
  const r = calcularCotizacion(
    base({ barraPersonalizada: { cocteles: [{ id: "a", nombre: "A", precioPorTrago: 1500 }, { id: "b", nombre: "B", precioPorTrago: 2500 }], adultos: 100 } }),
  )
  const linea = r.servicios.find((s) => s.servicioId === ID_BARRA_PERSONALIZADA)
  assert.ok(linea)
  assert.equal(linea.cantidad, 200)
  assert.equal(linea.precioUnitario, 2000)
  assert.equal(linea.precioTotal, 400000)
  assert.equal(r.totalServicios, 400000)
  assert.equal(r.total, 5000000 + 400000)
})

test("cotizador: con catering la barra personalizada se cobra igual", () => {
  const tarifario = [{ salon: "Casona", invitadosMin: 100, invitadosMax: 150, dia: "sabado", modalidad: "con_catering", precio: 9000000 }]
  const r = calcularCotizacion(
    base({ modalidad: "con_catering", tarifario, barraPersonalizada: { cocteles: [{ id: "a", nombre: "A", precioPorTrago: 2000 }], adultos: 50 } }),
  )
  const linea = r.servicios.find((s) => s.servicioId === ID_BARRA_PERSONALIZADA)
  assert.equal(linea.incluidoEnPaquete, false)
  assert.equal(linea.precioTotal, 200000)
  assert.equal(r.total, 9000000 + 200000)
})

test("cotizador: avisos de la barra personalizada", () => {
  const sinCocteles = calcularCotizacion(base({ barraPersonalizada: { cocteles: [], adultos: 100 } }))
  assert.ok(sinCocteles.avisos.some((a) => /sin cócteles/.test(a)))
  const sinAdultos = calcularCotizacion(base({ barraPersonalizada: { cocteles: [{ id: "a", nombre: "A", precioPorTrago: 2000 }], adultos: 0 } }))
  assert.ok(sinAdultos.avisos.some((a) => /adultos/.test(a)))
  // Un cóctel sin precio marca la cotización para que la revise Administración.
  const sinPrecio = calcularCotizacion(base({ barraPersonalizada: { cocteles: [{ id: "a", nombre: "Cóctel 1", precioPorTrago: 0 }], adultos: 10 } }))
  assert.ok(sinPrecio.avisos.some((a) => a.includes("Cóctel 1") && a.includes(AVISO_FUERA_DE_TARIFARIO)))
  assert.equal(sinPrecio.fueraDeTarifario, true)
})

test("cotizador: sin barra personalizada no cambia nada", () => {
  const r = calcularCotizacion(base())
  assert.equal(r.servicios.length, 0)
  assert.equal(r.total, 5000000)
})

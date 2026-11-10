// "Ver barras" de Cócteles (pedido de Rodrigo, 10/11/2026,
// lib/barras-creadas.ts). Solo pantalla: lista las barras armadas con sus
// cócteles y el mismo costo por adulto de "Crear barra".
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

const { filasBarrasCreadas } = require("../lib/barras-creadas.ts")
const { precioBarraDesdeCostos } = require("../lib/precio-barra-cotizador.ts")

const cocteles = [
  { id: "m", nombre: "Mojito" },
  { id: "d", nombre: "Daiquiri" },
  { id: "l", nombre: "Limonada" },
]
const costos = { m: 1500, d: 2200.5, l: 800 }

test("ordena por nombre y muestra los cócteles de cada barra", () => {
  const filas = filasBarrasCreadas(
    [
      { id: "b2", nombre: "Barra loca", coctelesIncluidos: ["d"] },
      { id: "b1", nombre: "BARRA LIBRE", coctelesIncluidos: ["m", "l"] },
    ],
    cocteles,
    costos,
  )
  assert.deepEqual(filas.map((f) => f.nombre), ["BARRA LIBRE", "Barra loca"])
  assert.deepEqual(filas[0].cocteles.map((c) => c.nombre), ["Mojito", "Limonada"])
})

test("costo por adulto: 1 trago de cada cóctel, igual que Crear barra", () => {
  const [f] = filasBarrasCreadas([{ id: "b", nombre: "B", coctelesIncluidos: ["m", "d", "l"] }], cocteles, costos)
  // 1500 + 2201 (redondeado) + 800
  assert.equal(f.costoPorAdulto, 4501)
  assert.equal(f.costoPorAdulto, precioBarraDesdeCostos(["m", "d", "l"], costos, 0).precioPorAdulto)
})

test("los cócteles borrados no se muestran ni suman, y se cuentan", () => {
  const [f] = filasBarrasCreadas([{ id: "b", nombre: "B", coctelesIncluidos: ["m", "viejo", "otro"] }], cocteles, costos)
  assert.deepEqual(f.cocteles.map((c) => c.id), ["m"])
  assert.equal(f.borrados, 2)
  assert.equal(f.costoPorAdulto, 1500)
})

test("sin costos (perfil Barra) da 0 y sin cócteles no rompe", () => {
  const filas = filasBarrasCreadas(
    [{ id: "b", nombre: "B", coctelesIncluidos: ["m"] }, { id: "c", nombre: "C", coctelesIncluidos: null }],
    cocteles,
    {},
  )
  assert.equal(filas[0].costoPorAdulto, 0)
  assert.deepEqual(filas[1].cocteles, [])
})

// Atajos del planificador: tocar una barra tilda sus cócteles (o los saca si
// ya estaban todos), y el costo es el mismo que tildarlos a mano.
const { atajosBarras, aplicarAtajoBarra } = require("../lib/barras-creadas.ts")

test("atajos: solo barras con cócteles vigentes, por nombre, y cuál está entera", () => {
  const atajos = atajosBarras(
    [
      { id: "b2", nombre: "Barra loca", coctelesIncluidos: ["d", "viejo"] },
      { id: "b1", nombre: "BARRA LIBRE", coctelesIncluidos: ["m", "l", "m"] },
      { id: "b3", nombre: "Fantasma", coctelesIncluidos: ["viejo"] },
    ],
    ["m", "d", "l"],
    ["m", "l"],
  )
  assert.deepEqual(atajos.map((a) => a.id), ["b1", "b2"])
  assert.deepEqual(atajos[0].cocteles, ["m", "l"])
  assert.equal(atajos[0].activa, true)
  assert.equal(atajos[1].activa, false)
})

test("tocar un atajo suma los que faltan sin repetir ni tocar lo demás", () => {
  const atajo = { id: "b", nombre: "B", cocteles: ["m", "l"], activa: false }
  assert.deepEqual(aplicarAtajoBarra(["d", "m"], atajo), ["d", "m", "l"])
})

test("tocar un atajo entero saca solo sus cócteles", () => {
  const atajo = { id: "b", nombre: "B", cocteles: ["m", "l"], activa: true }
  assert.deepEqual(aplicarAtajoBarra(["d", "m", "l"], atajo), ["d"])
})

test("mismo costo de barra con el atajo que tildando a mano", () => {
  const { calcularComprasBarras } = require("../lib/store.ts")
  const insumosBarra = [
    { id: "ron", codigo: "B1", descripcion: "Ron", unidad: "CC", stockActual: 0, precioUnitario: 10, categoria: "Bebidas" },
    { id: "limon", codigo: "B2", descripcion: "Jugo de limón", unidad: "CC", stockActual: 0, precioUnitario: 2, categoria: "Bebidas" },
  ]
  const cocteles = [
    { id: "m", nombre: "Mojito", categoria: "Con Alcohol", insumos: [{ insumoBarraId: "ron", cantidadPorCoctel: 50, unidadCoctel: "CC" }] },
    { id: "l", nombre: "Limonada", categoria: "Sin Alcohol", insumos: [{ insumoBarraId: "limon", cantidadPorCoctel: 100, unidadCoctel: "CC" }] },
  ]
  const [atajo] = atajosBarras([{ id: "b", nombre: "B", coctelesIncluidos: ["m", "l"] }], ["m", "l"], [])
  const ev = (ids) => ({ adultos: 100, adolescentes: 10, ninos: 5, barras: [{ id: "x", barraTemplateId: "", coctelesIncluidos: ids, tragosPorPersona: 2 }] })
  const costo = (e) => calcularComprasBarras(e, cocteles, insumosBarra).reduce((s, c) => s + c.costoMateriaPrima, 0)
  // Mojito: 100 adultos × 50 cc × $10 = $50.000. Limonada: 15 chicos × 100 cc × $2 = $3.000.
  assert.equal(costo(ev(aplicarAtajoBarra([], atajo))), 53000)
  assert.equal(costo(ev(["m", "l"])), 53000)
})

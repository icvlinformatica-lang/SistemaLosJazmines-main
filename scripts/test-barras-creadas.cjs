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

// Impresiones del contrato (lib/generacion-contrato.ts).
// - Con cambios sin guardar en el planificador, el contrato no se imprime.
// - Cada impresión queda anotada en generacionesContrato, sin perder las de antes.
// No toca ninguna base. Correr: node --test scripts/test-generacion-contrato.cjs
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
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

const g = require(path.join(RAIZ, "lib", "generacion-contrato.ts"))

test("con cambios sin guardar no se imprime", () => {
  assert.match(g.motivoParaNoImprimir(1), /Guardá el evento/)
  assert.match(g.motivoParaNoImprimir(3, {}, {}), /cambios sin guardar/)
})

test("sin cambios se imprime", () => {
  assert.equal(g.motivoParaNoImprimir(0), null)
  assert.equal(g.motivoParaNoImprimir(0, { condicionIVA: "Consumidor Final", precioVenta: 12700000 }, { condicionIVA: "Consumidor Final", precioVenta: 12700000 }), null)
  // Un precio sin cargar y uno en 0 son lo mismo
  assert.equal(g.motivoParaNoImprimir(0, {}, { precioVenta: 0 }), null)
})

test("la condición de IVA y el precio también frenan, aunque el panel de cambios no los liste", () => {
  assert.ok(g.motivoParaNoImprimir(0, { condicionIVA: "Consumidor Final" }, { condicionIVA: "Responsable Inscripto" }))
  assert.ok(g.motivoParaNoImprimir(0, { precioVenta: 12700000 }, { precioVenta: 13000000 }))
})

test("la impresión se anota con la versión vigente, el monto y la fecha", () => {
  const ahora = new Date("2026-08-29T15:00:00.000Z")
  const evento = {
    id: "ev1",
    versionesContrato: [{ version: 1 }, { version: 3 }, { version: 2 }],
    personalEvento: [{ personalId: "p1", nombre: "Ana" }],
    planDeCuotas: { montoTotal: 12700000 },
  }
  const pagos = [
    { eventoId: "ev1", personalId: "p1", nombrePersonal: "Ana" }, // ya está en el evento
    { eventoId: "ev1", personalId: "p2", nombrePersonal: "Beto" },
    { eventoId: "otro", personalId: "p3", nombrePersonal: "Caro" },
  ]
  const gen = g.nuevaGeneracionContrato(evento, "calendario", pagos, ahora)
  assert.equal(gen.origen, "calendario")
  assert.equal(gen.fecha, "2026-08-29T15:00:00.000Z")
  assert.equal(gen.version, 3)
  assert.equal(gen.cantidadPersonal, 2)
  assert.equal(gen.montoTotal, 12700000)
  assert.match(gen.id, /^gen-1788015600000-/)
})

test("sin versiones ni plan, igual se anota", () => {
  const gen = g.nuevaGeneracionContrato({ id: "ev1" }, "planificador")
  assert.equal(gen.version, undefined)
  assert.equal(gen.montoTotal, undefined)
  assert.equal(gen.cantidadPersonal, 0)
})

test("una impresión nueva se suma a las anteriores y marca la fecha de impresión", () => {
  const ahora = new Date("2026-10-26T20:00:00.000Z")
  const anterior = { id: "gen-viejo", fecha: "2026-10-03T20:06:52.565Z", origen: "lista" }
  const cambios = g.cambiosAlImprimirContrato({ id: "ev1", generacionesContrato: [anterior] }, "planificador", [], ahora)
  assert.equal(cambios.generacionesContrato.length, 2)
  assert.deepEqual(cambios.generacionesContrato[0], anterior)
  assert.equal(cambios.generacionesContrato[1].origen, "planificador")
  assert.equal(cambios.fechaImpresion, "2026-10-26T20:00:00.000Z")
})

test("el historial dice desde dónde se imprimió", () => {
  assert.equal(g.etiquetaOrigenGeneracion("calendario"), "desde el Calendario")
  assert.equal(g.etiquetaOrigenGeneracion("planificador"), "desde el planificador")
  assert.equal(g.etiquetaOrigenGeneracion("lista"), "desde la Lista de eventos")
  assert.equal(g.etiquetaOrigenGeneracion(undefined), "")
  assert.equal(g.etiquetaOrigenGeneracion("otra"), "")
})

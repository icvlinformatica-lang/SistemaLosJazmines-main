// Desglose del saldo de Caja Eventos sin los finalizados (lib/desglose-sin-finalizados.ts).
// Correr: node --test scripts/test-desglose-sin-finalizados.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")

require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  module._compile(outputText, filename)
}
const { sinFinalizados, eventosNoFinalizados } = require("../lib/desglose-sin-finalizados.ts")

test("Cuotas: los finalizados no se listan y se dice cuánto dejaron en la caja", () => {
  const filas = [
    { eventoId: "curso", ingresos: 2000000, egresos: 500000 },
    { eventoId: "fin1", ingresos: 2985989, egresos: 2836690 },
    { eventoId: "fin2", ingresos: 1000000, egresos: 1000000 },
    { eventoId: "borrado", ingresos: 300000, egresos: 0 },
  ]
  const estados = new Map([["curso", "pendiente"], ["fin1", "completado"], ["fin2", "completado"]])
  const r = sinFinalizados(filas, estados)
  assert.deepEqual(r.visibles.map((f) => f.eventoId), ["curso", "borrado"])
  assert.equal(r.finalizados, 2)
  // 2.985.989 − 2.836.690 + 0
  assert.equal(r.netoFinalizados, 149299)
  // Lo que se lista más lo de los finalizados da lo mismo que antes
  const neto = (l) => l.reduce((s, f) => s + f.ingresos - f.egresos, 0)
  assert.equal(neto(r.visibles) + r.netoFinalizados, neto(filas))
})

test("Tabla: solo eventos que no están finalizados", () => {
  const eventos = [{ id: "a", estado: "pendiente" }, { id: "b", estado: "completado" }, { id: "c", estado: "en_preparacion" }, { id: "d" }]
  assert.deepEqual(eventosNoFinalizados(eventos).map((e) => e.id), ["a", "c", "d"])
})

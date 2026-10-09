// Dietas especiales con su tipo. Correr: node --test scripts/test-dietas-evento.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(out.outputText, filename)
}
const d = require("../lib/dietas-evento.ts")

test("normalizar: descarta tipos inventados, cantidades en 0 o negativas", () => {
  const r = d.normalizarDietasDetalle([
    { tipo: "celiaco", cantidad: 3 },
    { tipo: "carnivoro", cantidad: 2 },
    { tipo: "vegano", cantidad: 0 },
    { tipo: "alergia", cantidad: "1", nota: "  maní " },
    { tipo: "otro", cantidad: -2 },
    null,
  ])
  assert.deepEqual(r, [{ tipo: "celiaco", cantidad: 3 }, { tipo: "alergia", cantidad: 1, nota: "maní" }])
  assert.deepEqual(d.normalizarDietasDetalle('[{"tipo":"vegano","cantidad":2}]'), [{ tipo: "vegano", cantidad: 2 }])
  assert.deepEqual(d.normalizarDietasDetalle("roto"), [])
  assert.deepEqual(d.normalizarDietasDetalle(undefined), [])
})

test("el total nunca es menor que el detalle; si es mayor, se respeta", () => {
  const det = [{ tipo: "celiaco", cantidad: 3 }, { tipo: "vegano", cantidad: 2 }]
  assert.equal(d.totalDietasDetalle(det), 5)
  assert.equal(d.totalConDetalle(2, det), 5)
  assert.equal(d.totalConDetalle(8, det), 8)
  assert.equal(d.totalConDetalle(undefined, []), 0)
})

test("lo que ve la cocina: alergias primero, plurales y lo sin detallar", () => {
  const det = [{ tipo: "celiaco", cantidad: 3 }, { tipo: "vegano", cantidad: 1 }, { tipo: "alergia", cantidad: 1, nota: "maní" }]
  assert.deepEqual(d.lineasDietas(7, det), [
    { texto: "1 alergia: maní", alergia: true },
    { texto: "3 celíacos", alergia: false },
    { texto: "1 vegano", alergia: false },
    { texto: "2 sin detallar", alergia: false },
  ])
  assert.equal(d.textoDietas(7, det), "1 alergia: maní · 3 celíacos · 1 vegano · 2 sin detallar")
})

test("evento viejo, solo con el número: todo sin detallar", () => {
  assert.equal(d.textoDietas(5, undefined), "5 sin detallar")
  assert.equal(d.textoDietas(0, []), "")
})

test("hay alergias", () => {
  assert.equal(d.hayAlergias([{ tipo: "alergia", cantidad: 1 }]), true)
  assert.equal(d.hayAlergias([{ tipo: "celiaco", cantidad: 1 }]), false)
})

test("al aprobar: las dietas salen de los adultos, sin quedar en negativo", () => {
  const det = [{ tipo: "celiaco", cantidad: 3 }, { tipo: "vegano", cantidad: 2 }]
  assert.deepEqual(d.separarDietasDeAdultos(100, det), { adultos: 95, personasDietasEspeciales: 5, dietasDetalle: det })
  assert.deepEqual(d.separarDietasDeAdultos(4, det).adultos, 0)
  assert.deepEqual(d.separarDietasDeAdultos(4, det).personasDietasEspeciales, 4)
  assert.deepEqual(d.separarDietasDeAdultos(80, []), { adultos: 80, personasDietasEspeciales: 0, dietasDetalle: [] })
  assert.deepEqual(d.separarDietasDeAdultos(0, det), { adultos: 0, personasDietasEspeciales: 0, dietasDetalle: [] })
})

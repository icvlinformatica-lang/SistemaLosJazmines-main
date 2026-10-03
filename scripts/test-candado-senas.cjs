// Candado de señas: la seña de un proveedor se habilita a los 4 meses de la
// fecha de alta o 30 días antes de la fiesta (lo que llegue primero).
// Correr: node --test scripts/test-candado-senas.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(out.outputText, filename)
}
const { fechaHabilitacionSeña, señaBloqueada, formatoHabilitacion } = require("../lib/candado-senas.ts")

const HOY = "2026-10-02"
const FIESTA_LEJANA = "2027-06-01"

test("alta hace 2 meses: bloqueada", () => {
  assert.equal(fechaHabilitacionSeña("2026-08-02", FIESTA_LEJANA), "2026-12-02")
  assert.equal(señaBloqueada("2026-08-02", FIESTA_LEJANA, HOY), true)
})

test("alta hace 5 meses: libre", () => {
  assert.equal(fechaHabilitacionSeña("2026-05-02", FIESTA_LEJANA), "2026-09-02")
  assert.equal(señaBloqueada("2026-05-02", FIESTA_LEJANA, HOY), false)
})

test("sin fecha de alta: sin candado", () => {
  for (const alta of [undefined, null, "", "basura"]) {
    assert.equal(fechaHabilitacionSeña(alta, FIESTA_LEJANA), null)
    assert.equal(señaBloqueada(alta, FIESTA_LEJANA, HOY), false)
  }
})

test("fiesta en 20 días con alta de hace 1 mes: libre por la regla de 30 días", () => {
  assert.equal(fechaHabilitacionSeña("2026-09-02", "2026-10-22"), "2026-09-22")
  assert.equal(señaBloqueada("2026-09-02", "2026-10-22", HOY), false)
})

test("31/07 + 4 meses = 30/11 (último día del mes)", () => {
  assert.equal(fechaHabilitacionSeña("2026-07-31", FIESTA_LEJANA), "2026-11-30")
  assert.equal(fechaHabilitacionSeña("2023-10-31", "2025-01-01"), "2024-02-29")
  assert.equal(fechaHabilitacionSeña("2026-10-31", "2028-01-01"), "2027-02-28")
})

test("el mismo día de habilitación ya está libre; el anterior, bloqueado", () => {
  assert.equal(señaBloqueada("2026-06-02", FIESTA_LEJANA, "2026-10-01"), true)
  assert.equal(señaBloqueada("2026-06-02", FIESTA_LEJANA, "2026-10-02"), false)
})

test("sin fecha de evento: solo cuenta alta + 4 meses", () => {
  assert.equal(fechaHabilitacionSeña("2026-08-02", ""), "2026-12-02")
})

test("hoy como Date local", () => {
  assert.equal(señaBloqueada("2026-08-02", FIESTA_LEJANA, new Date(2026, 9, 2, 23, 59)), true)
})

test("formato DD/MM/AA", () => {
  assert.equal(formatoHabilitacion("2026-11-30"), "30/11/26")
})

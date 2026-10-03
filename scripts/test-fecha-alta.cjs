// Fecha de alta de eventos: guardar nunca la borra ni la pisa; solo
// Administración/Soporte la cambian. Correr: node --test scripts/test-fecha-alta.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(out.outputText, filename)
}
const { decidirFechaAlta, esFechaAltaValida, puedeEditarFechaAlta } = require("../lib/fecha-alta.ts")

test("guardar sin fecha de alta, vacía o null: no se toca", () => {
  for (const nueva of [undefined, null, "", "   "]) {
    assert.deepEqual(decidirFechaAlta(nueva, "2026-01-14", "administracion"), { accion: "ignorar" })
  }
})

test("misma fecha que la guardada: no se reescribe", () => {
  assert.deepEqual(decidirFechaAlta("2026-01-14", "2026-01-14", "administracion"), { accion: "ignorar" })
})

test("Administración y Soporte pueden cambiarla (y cargarla si estaba vacía)", () => {
  assert.deepEqual(decidirFechaAlta("2026-02-01", "2026-01-14", "administracion"), { accion: "guardar", fecha: "2026-02-01" })
  assert.deepEqual(decidirFechaAlta("2026-02-01", null, "soporte"), { accion: "guardar", fecha: "2026-02-01" })
})

test("otros perfiles: se ignora en silencio (el resto del evento se guarda igual)", () => {
  for (const perfil of ["cobro", "cocina", "barra", "vendedor", "dj", null, undefined]) {
    assert.deepEqual(decidirFechaAlta("2026-02-01", "2026-01-14", perfil), { accion: "ignorar" })
  }
})

test("fechas inválidas: se ignoran", () => {
  for (const f of ["2026-02-30", "14/01/2026", "2026-1-14", "2026-01-14T00:00:00Z", 20260114]) {
    assert.equal(esFechaAltaValida(f), false, String(f))
    assert.deepEqual(decidirFechaAlta(f, null, "administracion"), { accion: "ignorar" })
  }
  assert.equal(esFechaAltaValida("2024-02-29"), true)
})

test("perfiles que editan", () => {
  assert.equal(puedeEditarFechaAlta("administracion"), true)
  assert.equal(puedeEditarFechaAlta("soporte"), true)
  assert.equal(puedeEditarFechaAlta("cobro"), false)
})

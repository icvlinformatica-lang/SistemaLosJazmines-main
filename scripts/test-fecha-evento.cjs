const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/fecha-evento.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { fechaEventoCorta } = loaded.exports

test('la fecha del evento se muestra como en la Lista: día/mes/año', () => {
  assert.equal(fechaEventoCorta('2026-11-14'), '14/11/2026')
  assert.equal(fechaEventoCorta('2027-01-02'), '02/01/2027')
})

test('sin fecha muestra un guion, y un texto raro se muestra tal cual', () => {
  assert.equal(fechaEventoCorta(''), '-')
  assert.equal(fechaEventoCorta(null), '-')
  assert.equal(fechaEventoCorta(undefined), '-')
  assert.equal(fechaEventoCorta('a definir'), 'a definir')
})

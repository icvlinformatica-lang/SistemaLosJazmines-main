const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/recetas-permisos.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { puedeEditarRecetas, ERROR_SIN_PERMISO_RECETAS } = loaded.exports

test('Administración y Soporte editan el recetario', () => {
  for (const perfilId of ['administracion', 'soporte']) assert.equal(puedeEditarRecetas(perfilId), true, perfilId)
})

test('Cocina y el resto no editan el recetario', () => {
  for (const perfilId of ['cocina', 'barra', 'cobro', 'dj', 'fotografo', 'vestido', 'pantalla', 'coordinacion', 'vendedor', null, undefined, '']) {
    assert.equal(puedeEditarRecetas(perfilId), false, String(perfilId))
  }
  assert.match(ERROR_SIN_PERMISO_RECETAS, /Administración/)
})

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/cocteles-permisos.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { puedeEditarCocteles, puedeVerCostosCocteles, ERROR_SIN_PERMISO_COCTELES } = loaded.exports

test('solo Administración y Soporte editan la carta', () => {
  assert.equal(puedeEditarCocteles('administracion'), true)
  assert.equal(puedeEditarCocteles('soporte'), true)
})

test('Barra consulta pero no edita ni ve lo que cuesta', () => {
  assert.equal(puedeEditarCocteles('barra'), false)
  assert.equal(puedeVerCostosCocteles('barra'), false)
})

test('ningún otro perfil edita ni ve costos', () => {
  for (const perfilId of ['cocina', 'cobro', 'dj', 'fotografo', 'vestido', 'pantalla', 'coordinacion', 'vendedor', null, undefined, '']) {
    assert.equal(puedeEditarCocteles(perfilId), false, `editar ${perfilId}`)
    assert.equal(puedeVerCostosCocteles(perfilId), false, `costos ${perfilId}`)
  }
})

test('ver costos va junto con poder editar: el costo sale de los precios', () => {
  for (const perfilId of ['administracion', 'soporte', 'barra', 'cocina', null]) {
    assert.equal(puedeVerCostosCocteles(perfilId), puedeEditarCocteles(perfilId), String(perfilId))
  }
})

test('el error explica qué puede hacer Barra, no solo que no puede', () => {
  assert.match(ERROR_SIN_PERMISO_COCTELES, /Administración/)
  assert.match(ERROR_SIN_PERMISO_COCTELES, /consultar/)
})

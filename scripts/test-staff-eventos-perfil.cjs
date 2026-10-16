const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/staff-eventos-perfil.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { eventoVisibleParaPerfil, esServicioDelPerfil, filtraPorContratacion } = loaded.exports

const ev = (servicios, barras = []) => ({ servicios: servicios.map((nombre) => ({ nombre })), barras })

test('fotógrafo ve solo eventos con foto, con los nombres reales de la base', () => {
  for (const n of ['FOTO  + VIDEO', 'FOTO-VIDEO 2027', 'FOTOGRAFIA 2025', 'FOTO  + VIDEO  2026']) {
    assert.equal(eventoVisibleParaPerfil('fotografo', ev([n, 'ALTAR'])), true, n)
  }
  assert.equal(eventoVisibleParaPerfil('fotografo', ev(['VESTIDO 2027', 'PANTALLA LED'])), false)
})

test('vestido y pantalla ven solo sus eventos', () => {
  assert.equal(eventoVisibleParaPerfil('vestido', ev(['VESTIDO'])), true)
  assert.equal(eventoVisibleParaPerfil('vestido', ev(['VESTIDO 2028'])), true)
  assert.equal(eventoVisibleParaPerfil('vestido', ev(['PANTALLA LED'])), false)
  assert.equal(eventoVisibleParaPerfil('pantalla', ev(['PANTALLA LED'])), true)
  // "PISTA LED" no es la pantalla.
  assert.equal(eventoVisibleParaPerfil('pantalla', ev(['PISTA LED'])), false)
})

test('barra ve solo eventos con alguna barra cargada', () => {
  assert.equal(eventoVisibleParaPerfil('barra', ev([], [{ id: 'b1' }])), true)
  assert.equal(eventoVisibleParaPerfil('barra', ev(['PANTALLA LED'], [])), false)
  assert.equal(eventoVisibleParaPerfil('barra', { servicios: [] }), false)
})

test('sin servicios cargados, el perfil filtrado no lo ve', () => {
  assert.equal(eventoVisibleParaPerfil('fotografo', { servicios: null }), false)
  assert.equal(eventoVisibleParaPerfil('vestido', {}), false)
})

test('coordinación, DJ y administración siguen viendo todos', () => {
  for (const p of ['coordinacion', 'dj', 'administracion', 'soporte', undefined]) {
    assert.equal(filtraPorContratacion(p), false, String(p))
    assert.equal(eventoVisibleParaPerfil(p, ev([])), true, String(p))
  }
})

test('el servicio de DJ se reconoce para resaltarlo', () => {
  assert.equal(esServicioDelPerfil('dj', 'DJ, SONIDO, LUCES Y HUMO'), true)
  assert.equal(esServicioDelPerfil('dj', 'PISTA LED'), false)
})

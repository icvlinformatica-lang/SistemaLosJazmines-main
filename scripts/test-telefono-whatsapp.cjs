const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/telefono-whatsapp.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { numeroWhatsApp } = loaded.exports

test('un celular con 0 de área queda como 549 + área + número', () => {
  assert.equal(numeroWhatsApp('011 4444-5555'), '5491144445555')
  assert.equal(numeroWhatsApp('(0221) 456-7890'), '5492214567890')
  assert.equal(numeroWhatsApp('11 4444 5555'), '5491144445555')
})

test('si ya viene con el 54 adelante no se le agrega nada', () => {
  assert.equal(numeroWhatsApp('+54 9 11 4444-5555'), '5491144445555')
  assert.equal(numeroWhatsApp('54 9 221 456 7890'), '5492214567890')
})

test('sin teléfono o con muy pocos dígitos no hay número (no se muestra el botón)', () => {
  assert.equal(numeroWhatsApp(''), null)
  assert.equal(numeroWhatsApp(null), null)
  assert.equal(numeroWhatsApp(undefined), null)
  assert.equal(numeroWhatsApp('4444-5555'), null)
  assert.equal(numeroWhatsApp('sin dato'), null)
  assert.equal(numeroWhatsApp('0 123 456 78'), null)
})

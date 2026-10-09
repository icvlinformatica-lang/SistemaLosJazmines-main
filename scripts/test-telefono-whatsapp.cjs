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

test('un celular cargado como en Argentina se pasa a 549 + número', () => {
  assert.equal(numeroWhatsApp('11 1234-5678'), '5491112345678')
  assert.equal(numeroWhatsApp('011 1234 5678'), '5491112345678')
  assert.equal(numeroWhatsApp('(0351) 15-555-1234'), '549351155551234')
})

test('si ya viene con el 54 no se toca', () => {
  assert.equal(numeroWhatsApp('+54 9 11 1234-5678'), '5491112345678')
  assert.equal(numeroWhatsApp('5491112345678'), '5491112345678')
})

test('vacío o demasiado corto no muestra WhatsApp', () => {
  assert.equal(numeroWhatsApp(null), null)
  assert.equal(numeroWhatsApp(undefined), null)
  assert.equal(numeroWhatsApp(''), null)
  assert.equal(numeroWhatsApp('sin teléfono'), null)
  assert.equal(numeroWhatsApp('000'), null)
  assert.equal(numeroWhatsApp('1234'), null)
  assert.equal(numeroWhatsApp('54 11 123'), null)
})

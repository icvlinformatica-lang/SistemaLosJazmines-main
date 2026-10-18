// Botón "Instalar app" de Inicio: reconoce el aparato (iPhone, iPad, Android
// o compu) para mostrar los pasos que corresponden, y se esconde si la app ya
// está abierta instalada.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/instalar-app.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { plataformaInstalacion, yaInstalada, PASOS_INSTALACION } = loaded.exports

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD_NUEVO = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A146M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

test('iPhone, Android y compu se reconocen', () => {
  assert.equal(plataformaInstalacion(IPHONE, 5), 'ios')
  assert.equal(plataformaInstalacion(ANDROID, 5), 'android')
  assert.equal(plataformaInstalacion(WINDOWS, 0), 'compu')
})

test('el iPad que se presenta como Mac cuenta como iPhone; una Mac de verdad, como compu', () => {
  assert.equal(plataformaInstalacion(IPAD_NUEVO, 5), 'ios')
  assert.equal(plataformaInstalacion(IPAD_NUEVO, 0), 'compu')
})

test('sin userAgent es compu', () => {
  assert.equal(plataformaInstalacion('', 0), 'compu')
  assert.equal(plataformaInstalacion(undefined), 'compu')
})

test('ya instalada: por display-mode o por el dato de Safari', () => {
  assert.equal(yaInstalada(false, undefined), false)
  assert.equal(yaInstalada(true, undefined), true)
  assert.equal(yaInstalada(false, true), true)
  assert.equal(yaInstalada(false, false), false)
})

test('hay tres pasos para cada aparato y en iPhone se nombra Safari', () => {
  for (const p of ['ios', 'android', 'compu']) assert.equal(PASOS_INSTALACION[p].length, 3)
  assert.match(PASOS_INSTALACION.ios.join(' '), /Safari/)
  assert.match(PASOS_INSTALACION.ios.join(' '), /Agregar a pantalla de inicio/)
})

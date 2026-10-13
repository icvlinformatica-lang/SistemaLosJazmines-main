// Aviso "¿La fecha está bien?" al cargar la fecha de un evento o cotización
// (lib/aviso-fecha-evento.ts): avisa si el año no está entre 2026 y 2032.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)
const { avisoFechaEvento } = require('../lib/aviso-fecha-evento.ts')

test('fechas entre 2026 y 2032: sin aviso', () => {
  assert.equal(avisoFechaEvento('2026-01-01'), null)
  assert.equal(avisoFechaEvento('2032-12-31'), null)
  assert.equal(avisoFechaEvento('2027-11-21'), null)
})

test('años mal tipeados: avisa con la fecha legible', () => {
  assert.equal(
    avisoFechaEvento('0027-11-21'),
    'Pusiste el 21/11/0027 (año 27). Los eventos van de 2026 a 2032: revisá el año antes de seguir.',
  )
  assert.match(avisoFechaEvento('2062-05-12'), /12\/05\/2062 \(año 2062\)/)
  assert.match(avisoFechaEvento('2025-12-31'), /año 2025/)
  assert.match(avisoFechaEvento('2033-01-01'), /año 2033/)
})

test('vacía: sin aviso', () => {
  assert.equal(avisoFechaEvento(''), null)
  assert.equal(avisoFechaEvento(null), null)
  assert.equal(avisoFechaEvento(undefined), null)
})

test('un evento viejo que no cambió de fecha no avisa', () => {
  assert.equal(avisoFechaEvento('2025-06-14', '2025-06-14'), null)
  // Si se le cambia la fecha a otra fuera de rango, sí avisa.
  assert.notEqual(avisoFechaEvento('2025-06-15', '2025-06-14'), null)
})

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)
const { haceCuanto, diasEsperando, fechaEventoCorta, ordenarPorFechaEvento } = require('../lib/cotizaciones-bandeja.ts')

// 9/10/2026 a las 15:00 en Argentina (18:00 UTC).
const ahora = new Date('2026-10-09T18:00:00Z')

test('haceCuanto cuenta días de Argentina, no UTC', () => {
  assert.equal(haceCuanto('2026-10-09T12:00:00Z', 'enviada', ahora), 'enviada hoy')
  // 8/10 a las 22:30 en Argentina = 9/10 01:30 UTC: para Argentina fue ayer.
  assert.equal(haceCuanto('2026-10-09T01:30:00Z', 'enviada', ahora), 'enviada ayer')
  assert.equal(haceCuanto('2026-10-04T15:00:00Z', 'enviada', ahora), 'enviada hace 5 días')
  assert.equal(haceCuanto('2026-10-07T15:00:00Z', 'rechazada', ahora), 'rechazada hace 2 días')
})

test('haceCuanto sin fecha o con fecha rota no muestra nada', () => {
  assert.equal(haceCuanto(null, 'enviada', ahora), null)
  assert.equal(haceCuanto('cualquier cosa', 'enviada', ahora), null)
})

test('diasEsperando', () => {
  assert.equal(diasEsperando('2026-10-06T15:00:00Z', ahora), 3)
  assert.equal(diasEsperando(undefined, ahora), 0)
  // Una fecha futura (reloj desfasado) no da negativo.
  assert.equal(diasEsperando('2026-10-12T15:00:00Z', ahora), 0)
})

test('fechaEventoCorta', () => {
  assert.equal(fechaEventoCorta('2026-11-21'), 'sáb 21/11/2026')
  assert.equal(fechaEventoCorta('2026-10-09'), 'vie 09/10/2026')
  assert.equal(fechaEventoCorta('21/11/2026'), '21/11/2026')
  assert.equal(fechaEventoCorta(null), '')
})

test('ordenarPorFechaEvento: el evento más cercano primero y sin fecha al final', () => {
  const lista = [
    { id: 'a', fechaEvento: '2027-03-01', updatedAt: '2026-10-01' },
    { id: 'b', fechaEvento: null, updatedAt: '2026-09-01' },
    { id: 'c', fechaEvento: '2026-11-21', updatedAt: '2026-10-05' },
    { id: 'd', fechaEvento: '2026-11-21', updatedAt: '2026-10-02' },
    { id: 'e', fechaEvento: 'mal', updatedAt: '2026-08-01' },
  ]
  assert.deepEqual(ordenarPorFechaEvento(lista).map((c) => c.id), ['d', 'c', 'a', 'e', 'b'])
  // No toca la lista original.
  assert.equal(lista[0].id, 'a')
})

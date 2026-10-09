const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/stock-borrador.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const {
  claveBorradorStock,
  armarBorradorStock,
  leerBorradorStock,
  valoresDelCatalogo,
  clavesBorradorStockVencidas,
  PREFIJO_BORRADOR_STOCK,
} = loaded.exports

const AHORA = new Date('2026-10-09T05:30:00.000Z')
const horas = (h) => new Date(AHORA.getTime() + h * 3600 * 1000)

test('una clave distinta por salón, sector y tipo de carga', () => {
  const claves = new Set([
    claveBorradorStock('Casona', 'cocina', 'ev1'),
    claveBorradorStock('Casona', 'barra', 'ev1'),
    claveBorradorStock('Casona', 'cocina', 'ev2'),
    claveBorradorStock('Casona', 'cocina', null),
    claveBorradorStock('Quinta', 'cocina', null),
    claveBorradorStock('Salon 4', 'cocina', null),
  ])
  assert.equal(claves.size, 6)
  for (const c of claves) assert.ok(c.startsWith(PREFIJO_BORRADOR_STOCK))
  // La misma carga da siempre la misma clave (para encontrarla al volver).
  assert.equal(claveBorradorStock('Casona', 'cocina', 'ev1'), claveBorradorStock('Casona', 'cocina', 'ev1'))
  // Un ":" en el id no se confunde con otra clave.
  assert.notEqual(claveBorradorStock('a:b', 'cocina', null), claveBorradorStock('a', 'b:cocina', null))
})

test('arma solo lo escrito; sin nada escrito no hay borrador', () => {
  assert.equal(armarBorradorStock({}, AHORA), null)
  assert.equal(armarBorradorStock({ a: '', b: '   ' }, AHORA), null)
  const txt = armarBorradorStock({ a: '3,5', b: '', c: '0' }, AHORA)
  assert.deepEqual(JSON.parse(txt), { guardadoEn: '2026-10-09T05:30:00.000Z', valores: { a: '3,5', c: '0' } })
})

test('el borrador guarda solo los casilleros: ni PIN ni nombre', () => {
  const txt = armarBorradorStock({ a: '2' }, AHORA)
  assert.deepEqual(Object.keys(JSON.parse(txt)).sort(), ['guardadoEn', 'valores'])
})

test('ida y vuelta: lo guardado se lee igual (el 0 escrito se conserva)', () => {
  const txt = armarBorradorStock({ a: '3,5', c: '0' }, AHORA)
  assert.deepEqual(leerBorradorStock(txt, horas(1)), { guardadoEn: AHORA.toISOString(), valores: { a: '3,5', c: '0' } })
})

test('vence a los 3 días', () => {
  const txt = armarBorradorStock({ a: '1' }, AHORA)
  assert.ok(leerBorradorStock(txt, horas(71)))
  assert.ok(leerBorradorStock(txt, horas(72)))
  assert.equal(leerBorradorStock(txt, horas(72.01)), null)
  assert.equal(leerBorradorStock(txt, horas(24 * 10)), null)
})

test('basura en el celular no rompe: se lee como "no hay borrador"', () => {
  for (const t of [null, undefined, '', 'no-json', '[]', '123', 'null', '{"valores":{"a":"1"}}',
    '{"guardadoEn":"ayer","valores":{"a":"1"}}', '{"guardadoEn":"2026-10-09T05:00:00Z","valores":[1]}',
    '{"guardadoEn":"2026-10-09T05:00:00Z","valores":{"a":3,"b":""}}']) {
    assert.equal(leerBorradorStock(t, AHORA), null, String(t))
  }
})

test('al seguir, se descartan los insumos que ya no están en el catálogo', () => {
  assert.deepEqual(valoresDelCatalogo({ a: '1', z: '2' }, ['a', 'b']), { a: '1' })
})

test('limpieza: solo borradores de stock vencidos o rotos', () => {
  const vigente = armarBorradorStock({ a: '1' }, horas(-1))
  const viejo = armarBorradorStock({ a: '1' }, horas(-100))
  const k = (s) => claveBorradorStock(s, 'cocina', null)
  const r = clavesBorradorStockVencidas(
    [
      [k('Casona'), vigente],
      [k('Quinta'), viejo],
      [k('Salon'), 'roto'],
      ['otra-cosa', viejo],
    ],
    AHORA,
  )
  assert.deepEqual(r, [k('Quinta'), k('Salon')])
})

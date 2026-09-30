const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/cocteles-api.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { filaACoctel, camposDelBody } = loaded.exports

test('la lectura devuelve código, descripción, imagen y la preparación guardada en instrucciones', () => {
  const c = filaACoctel(
    { id: 'c1', codigo: 'COC-001', nombre: 'MOJITO', descripcion: 'Clásico', imagen: 'https://x/m.jpg', categoria: 'Con Alcohol', instrucciones: 'Machacar menta', preparacion: null },
    [{ insumoBarraId: 'i1', cantidadPorCoctel: 60, unidadCoctel: 'CC' }],
  )
  assert.equal(c.codigo, 'COC-001')
  assert.equal(c.descripcion, 'Clásico')
  assert.equal(c.imagen, 'https://x/m.jpg')
  assert.equal(c.preparacion, 'Machacar menta')
  assert.equal(c.instrucciones, 'Machacar menta')
  assert.equal(c.insumos.length, 1)
})

test('campos vacíos en la base salen como texto vacío, nunca null', () => {
  const c = filaACoctel({ id: 'c2', nombre: 'X' }, [])
  for (const k of ['codigo', 'descripcion', 'imagen', 'preparacion']) assert.equal(c[k], '', k)
  assert.equal(c.categoria, 'Con Alcohol')
})

test('al guardar acepta preparacion (pantalla) o instrucciones (copia de seguridad)', () => {
  assert.equal(camposDelBody({ preparacion: 'A' }).instrucciones, 'A')
  assert.equal(camposDelBody({ instrucciones: 'B' }).instrucciones, 'B')
  assert.equal(camposDelBody({ preparacion: 'A', instrucciones: 'B' }).instrucciones, 'A')
})

test('lo que no vino queda en null (no se toca) y el texto vacío sí se guarda', () => {
  const c = camposDelBody({ nombre: 'MOJITO', imagen: '' })
  assert.equal(c.nombre, 'MOJITO')
  assert.equal(c.imagen, '')
  assert.equal(c.descripcion, null)
  assert.equal(c.instrucciones, null)
  assert.equal(camposDelBody({ imagen: 5 }).imagen, null)
})

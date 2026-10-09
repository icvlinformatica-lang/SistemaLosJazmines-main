// Tests de las comodidades de pantalla de las cajas: recordar el salón
// elegido (lib/salon-recordado.ts) y qué campo falta en "Gasto rápido"
// (lib/gasto-rapido-validacion.ts). Ninguna de las dos toca plata ni datos.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')

function cargar(rel) {
  const source = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const loaded = { exports: {} }
  new Function('module', 'exports', 'require', js)(loaded, loaded.exports, require)
  return loaded.exports
}

const { leerSalonRecordado, guardarSalonRecordado, claveSalonRecordado } = cargar('lib/salon-recordado.ts')
const { camposFaltantesGasto } = cargar('lib/gasto-rapido-validacion.ts')

const VALIDOS = ['todos', 'Quinta', 'Casona', 'Salon', 'Salon 4', 'Salon 5']

function almacenEnMemoria() {
  const datos = new Map()
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
  }
}

test('recuerda el salón por pantalla: cada caja guarda el suyo', () => {
  const almacen = almacenEnMemoria()
  guardarSalonRecordado(almacen, 'caja-eventos', 'Casona')
  guardarSalonRecordado(almacen, 'caja-jazmines', 'todos')
  assert.equal(leerSalonRecordado(almacen, 'caja-eventos', VALIDOS), 'Casona')
  assert.equal(leerSalonRecordado(almacen, 'caja-jazmines', VALIDOS), 'todos')
  assert.notEqual(claveSalonRecordado('caja-eventos'), claveSalonRecordado('caja-jazmines'))
})

test('sin nada guardado, o con un salón que ya no es válido, se abre el selector (null)', () => {
  const almacen = almacenEnMemoria()
  assert.equal(leerSalonRecordado(almacen, 'caja-eventos', VALIDOS), null)
  almacen.setItem(claveSalonRecordado('caja-eventos'), 'Salon Viejo')
  assert.equal(leerSalonRecordado(almacen, 'caja-eventos', VALIDOS), null)
  almacen.setItem(claveSalonRecordado('caja-eventos'), '')
  assert.equal(leerSalonRecordado(almacen, 'caja-eventos', VALIDOS), null)
})

test('si el navegador no deja leer ni guardar, no tira error', () => {
  const roto = {
    getItem: () => { throw new Error('SecurityError') },
    setItem: () => { throw new Error('QuotaExceededError') },
  }
  assert.equal(leerSalonRecordado(roto, 'caja-eventos', VALIDOS), null)
  assert.doesNotThrow(() => guardarSalonRecordado(roto, 'caja-eventos', 'Quinta'))
  assert.equal(leerSalonRecordado(null, 'caja-eventos', VALIDOS), null)
  assert.doesNotThrow(() => guardarSalonRecordado(null, 'caja-eventos', 'Quinta'))
})

const BASE = {
  modo: 'gasto', editando: false, nombre: 'Heladera', monto: '50000',
  salon: 'Quinta', fecha: '2026-10-09', repartir: false, repartoValido: true,
}

test('gasto completo: no falta nada', () => {
  assert.deepEqual(camposFaltantesGasto(BASE), [])
})

test('gasto: dice qué campo falta (los mismos requisitos de antes)', () => {
  assert.deepEqual(camposFaltantesGasto({ ...BASE, nombre: '' }), ['nombre'])
  assert.deepEqual(camposFaltantesGasto({ ...BASE, monto: '' }), ['monto'])
  assert.deepEqual(camposFaltantesGasto({ ...BASE, fecha: '' }), ['fecha'])
  assert.deepEqual(camposFaltantesGasto({ ...BASE, salon: '' }), ['salon'])
  assert.deepEqual(
    camposFaltantesGasto({ ...BASE, nombre: '', monto: '', salon: '', fecha: '' }),
    ['salon', 'nombre', 'monto', 'fecha'],
  )
})

test('gasto repartido: no pide salón, pide un reparto válido', () => {
  assert.deepEqual(camposFaltantesGasto({ ...BASE, salon: '', repartir: true, repartoValido: true }), [])
  assert.deepEqual(camposFaltantesGasto({ ...BASE, salon: '', repartir: true, repartoValido: false }), ['reparto'])
})

test('retiro: pide salón, motivo y monto, pero no vencimiento', () => {
  const retiro = { ...BASE, modo: 'retiro', fecha: '' }
  assert.deepEqual(camposFaltantesGasto(retiro), [])
  assert.deepEqual(camposFaltantesGasto({ ...retiro, salon: '', repartir: true }), ['salon'])
  // Editando no existe el modo retiro: se valida como gasto.
  assert.deepEqual(camposFaltantesGasto({ ...retiro, editando: true }), ['fecha'])
})

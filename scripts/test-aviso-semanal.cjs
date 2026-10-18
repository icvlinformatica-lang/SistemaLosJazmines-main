// Aviso de los lunes para Administración: qué finde se cierra, qué finde
// viene, cuánto entra esta semana y cuándo se abre la ventana.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/aviso-semanal.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const {
  lunesDeLaSemana, findeAnterior, proximoFinde, eventosParaFinalizar, eventosProximoFinde,
  ingresosDeLaSemana, claveAvisoVisto, debeAbrirAviso,
} = loaded.exports

// 19/10/2026 es lunes.
test('la semana va de lunes a domingo', () => {
  assert.equal(lunesDeLaSemana('2026-10-19'), '2026-10-19')
  assert.equal(lunesDeLaSemana('2026-10-22'), '2026-10-19')
  assert.equal(lunesDeLaSemana('2026-10-25'), '2026-10-19') // domingo
  assert.equal(lunesDeLaSemana('2026-10-18'), '2026-10-12') // domingo anterior
})

test('finde anterior y próximo finde, también al cambiar de mes', () => {
  assert.deepEqual(findeAnterior('2026-10-19'), { desde: '2026-10-16', hasta: '2026-10-18' })
  assert.deepEqual(proximoFinde('2026-10-19'), { desde: '2026-10-23', hasta: '2026-10-25' })
  // El domingo todavía habla del finde anterior al lunes de su semana.
  assert.deepEqual(findeAnterior('2026-10-25'), { desde: '2026-10-16', hasta: '2026-10-18' })
  assert.deepEqual(findeAnterior('2026-11-02'), { desde: '2026-10-30', hasta: '2026-11-01' })
})

test('solo pide finalizar los del finde anterior que siguen abiertos', () => {
  const eventos = [
    { id: 'a', fecha: '2026-10-17', estado: 'pendiente' },
    { id: 'b', fecha: '2026-10-16', estado: 'en_preparacion' },
    { id: 'c', fecha: '2026-10-18', estado: 'completado' },
    { id: 'd', fecha: '2026-10-17', estado: 'borrador' },
    { id: 'e', fecha: '2026-10-17', estado: 'cancelado' },
    { id: 'f', fecha: '2026-10-11', estado: 'pendiente' }, // finde de antes: no acumula
    { id: 'g', fecha: '2026-10-24', estado: 'pendiente' },
  ]
  assert.deepEqual(eventosParaFinalizar(eventos, '2026-10-19').map((e) => e.id), ['b', 'a'])
  assert.deepEqual(eventosProximoFinde(eventos, '2026-10-19').map((e) => e.id), ['g'])
  // La semana siguiente ya no aparecen los del 16 al 18.
  assert.deepEqual(eventosParaFinalizar(eventos, '2026-10-26').map((e) => e.id), ['g'])
})

test('ingresos de la semana: sin las atrasadas, que van aparte', () => {
  const lista = [
    { cuotasPendientes: [{ monto: 150000, atrasada: false }, { monto: 90000, atrasada: true }] },
    { cuotasPendientes: [{ monto: 210500.5, atrasada: false, ipcPendiente: 'Falta el IPC de septiembre' }] },
  ]
  assert.deepEqual(ingresosDeLaSemana(lista), {
    cantidad: 2, total: 360500.5, aDefinir: 1, cantidadAtrasada: 1, totalAtrasado: 90000,
  })
  assert.deepEqual(ingresosDeLaSemana([]), { cantidad: 0, total: 0, aDefinir: 0, cantidadAtrasada: 0, totalAtrasado: 0 })
})

test('la ventana se abre una vez por semana y por persona, solo en Administración y Soporte', () => {
  assert.equal(debeAbrirAviso('administracion', null, '2026-10-19'), true)
  assert.equal(debeAbrirAviso('administracion', '2026-10-19', '2026-10-21'), false)
  assert.equal(debeAbrirAviso('administracion', '2026-10-12', '2026-10-19'), true)
  assert.equal(debeAbrirAviso('soporte', null, '2026-10-19'), true)
  assert.equal(debeAbrirAviso('cobro', null, '2026-10-19'), false)
  assert.equal(debeAbrirAviso(undefined, null, '2026-10-19'), false)
  assert.notEqual(claveAvisoVisto('administracion', 'Diego'), claveAvisoVisto('administracion', 'Leila'))
  assert.equal(claveAvisoVisto('soporte', ''), 'lj_aviso_semanal_soporte')
})

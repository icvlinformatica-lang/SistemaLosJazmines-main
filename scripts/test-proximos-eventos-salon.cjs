const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/stock-salones.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { proximosEventosDelSalon } = loaded.exports

const ev = (id, fecha, extra = {}) => ({ id, nombre: id, fecha, horario: '21:00', horarioFin: '05:00', salon: 'Casona', estado: 'pendiente', ...extra })
// 30/09/2026 12:00 hora argentina
const ahora = new Date('2026-09-30T12:00:00-03:00')

test('devuelve los 3 próximos del salón, del más cercano al más lejano', () => {
  const eventos = [ev('D', '2026-10-20'), ev('A', '2026-10-03'), ev('C', '2026-10-17'), ev('B', '2026-10-10')]
  assert.deepEqual(proximosEventosDelSalon(eventos, 'Casona', ahora).map(p => p.evento.id), ['A', 'B', 'C'])
})

test('deja afuera otros salones, borradores, cancelados y los que ya terminaron', () => {
  const eventos = [
    ev('otroSalon', '2026-10-03', { salon: 'Quinta' }),
    ev('borrador', '2026-10-04', { estado: 'borrador' }),
    ev('cancelado', '2026-10-05', { estado: 'cancelado' }),
    ev('terminado', '2026-09-20'),
    ev('ok', '2026-10-06'),
  ]
  assert.deepEqual(proximosEventosDelSalon(eventos, 'Casona', ahora).map(p => p.evento.id), ['ok'])
})

test('un evento de anoche que termina esta madrugada ya no cuenta como próximo', () => {
  // 29/09 21:00 → 30/09 05:00: a las 12:00 del 30 ya terminó.
  assert.deepEqual(proximosEventosDelSalon([ev('anoche', '2026-09-29')], 'Casona', ahora), [])
  // Uno de hoy a la noche todavía no terminó.
  assert.equal(proximosEventosDelSalon([ev('hoy', '2026-09-30')], 'Casona', ahora).length, 1)
})

test('respeta la cantidad pedida y no se rompe sin eventos', () => {
  const eventos = [ev('A', '2026-10-03'), ev('B', '2026-10-10')]
  assert.equal(proximosEventosDelSalon(eventos, 'Casona', ahora, 1).length, 1)
  assert.deepEqual(proximosEventosDelSalon([], 'Casona', ahora), [])
})

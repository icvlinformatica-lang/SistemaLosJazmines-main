const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/agenda-personal.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { obtenerAgendaPersonal } = loaded.exports
const evento = (id, extra = {}) => ({ id, fecha: '2026-09-12', estado: 'pendiente', ...extra })

test('incluye personal del contrato y asignaciones aunque no exista pago, sin duplicar eventos', () => {
  const contrato = evento('contrato', { personalEvento: [{ personalId: 'p1' }, { personalId: 'p1' }], asignaciones: [{ personalAsignadoId: 'p1' }] })
  const eventos = [contrato, contrato, evento('asignacion', { asignaciones: [{ personalAsignadoId: 'p1', confirmado: false }] }), evento('otro', { personalEvento: [{ personalId: 'p2' }] })]
  assert.deepEqual(obtenerAgendaPersonal(eventos, 'p1', '2026-09-10').map(e => e.id), ['asignacion', 'contrato'])
})

test('excluye cancelados y desasignados', () => {
  assert.deepEqual(obtenerAgendaPersonal([
    evento('cancelado', { estado: 'cancelado', personalEvento: [{ personalId: 'p1' }] }),
    evento('desasignado', { asignaciones: [{ personalAsignadoId: null }] }),
    evento('sin-datos'),
  ], 'p1', '2026-09-10'), [])
})

test('ordena próximos primero y anteriores después sin mutar los eventos', () => {
  const eventos = [
    evento('futuro', { fecha: '2026-10-01' }),
    evento('antiguo', { fecha: '2026-08-01' }),
    evento('hoy', { fecha: '2026-09-10' }),
    evento('ayer', { fecha: '2026-09-09' }),
  ].map(e => ({ ...e, personalEvento: [{ personalId: 'p1' }] }))
  const original = JSON.stringify(eventos)
  assert.deepEqual(obtenerAgendaPersonal(eventos, 'p1', '2026-09-10').map(e => e.id), ['hoy', 'futuro', 'ayer', 'antiguo'])
  assert.equal(JSON.stringify(eventos), original)
})

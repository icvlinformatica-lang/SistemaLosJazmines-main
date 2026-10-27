// Pestaña Eliminados de Finalizados: la copia del evento viene como texto
// dentro de jsonb y hay que desenvolverla; y solo viajan los datos de la tabla.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/papelera-eventos.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { filaPapeleraEvento } = loaded.exports

const copia = {
  nombre: 'LUCIA', nombrePareja: 'LUCIA', salon: 'Casona', tipoEvento: '15 años',
  adultos: 80, adolescentes: 20, ninos: 5, personasDietasEspeciales: 2,
  dniNovio1: '12345678', pagos: [{ monto: 100 }], contrato: { dni: '12345678' },
}

test('desenvuelve la copia guardada como texto (como está en la base)', () => {
  const fila = filaPapeleraEvento({
    id: 'e1', nombre: 'LUCIA', fecha: '2026-10-17', estado: 'pendiente', motivo: null,
    eliminado_at: new Date('2026-10-27T18:55:00Z'), evento_data: JSON.stringify(copia),
  })
  assert.equal(fila.data.salon, 'Casona')
  assert.equal(fila.data.nombrePareja, 'LUCIA')
  assert.equal(fila.data.adultos + fila.data.adolescentes + fila.data.ninos + fila.data.personasDietasEspeciales, 107)
  assert.equal(fila.eliminado_at, '2026-10-27T18:55:00.000Z')
  assert.equal(fila.fecha, '2026-10-17')
})

test('también acepta la copia como objeto y tolera una copia rota', () => {
  assert.equal(filaPapeleraEvento({ id: 'e2', evento_data: copia }).data.salon, 'Casona')
  const rota = filaPapeleraEvento({ id: 'e3', nombre: 'X', evento_data: '{roto' })
  assert.deepEqual(Object.values(rota.data).filter((v) => v !== undefined), [])
  assert.equal(rota.nombre, 'X')
  assert.equal(rota.estado, 'pendiente')
})

test('no manda DNI, pagos ni contrato', () => {
  const fila = filaPapeleraEvento({ id: 'e1', evento_data: JSON.stringify(copia) })
  const json = JSON.stringify(fila)
  assert.ok(!json.includes('12345678'))
  assert.ok(!json.includes('pagos'))
  assert.ok(!json.includes('contrato'))
})

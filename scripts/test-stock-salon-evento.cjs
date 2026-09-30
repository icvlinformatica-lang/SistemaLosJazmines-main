const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/stock-salon-evento.ts'), 'utf8')
// target ES2022: sin esto, TS baja el `for...of` sobre un Map a un bucle por
// índice que no recorre nada, y el test mentiría (ver test-caja-eventos.cjs).
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { insumosEnSalon, hayEnOtrosSalones, salonSinConteos, mapaDesdeResumen } = loaded.exports

// COCA: 222 en Casona, 30 en Quinta. FERNET: solo 39 en Casona. AGUA: sin conteos.
const mapa = new Map([
  ['coca', [{ salon: 'Casona', cantidad: 222 }, { salon: 'Quinta', cantidad: 30 }]],
  ['fernet', [{ salon: 'Casona', cantidad: 39 }]],
])
const insumos = [
  { id: 'coca', descripcion: 'COCA COLA', stockActual: 252, precioUnitario: 100 },
  { id: 'fernet', descripcion: 'FERNET', stockActual: 39, precioUnitario: 500 },
  { id: 'agua', descripcion: 'AGUA', stockActual: 7, precioUnitario: 50 },
]

test('el stock pasa a ser el del salón del evento', () => {
  const enQuinta = insumosEnSalon(insumos, mapa, 'Quinta')
  assert.equal(enQuinta.find(i => i.id === 'coca').stockActual, 30)
  const enCasona = insumosEnSalon(insumos, mapa, 'Casona')
  assert.equal(enCasona.find(i => i.id === 'coca').stockActual, 222)
})

test('lo que nadie contó en ese salón vale 0: se compra entero', () => {
  // FERNET está en Casona, no en Quinta → un evento en Quinta lo compra todo.
  assert.equal(insumosEnSalon(insumos, mapa, 'Quinta').find(i => i.id === 'fernet').stockActual, 0)
  // AGUA no se contó en ningún lado → 0 en cualquier salón, aunque el total diga 7.
  assert.equal(insumosEnSalon(insumos, mapa, 'Casona').find(i => i.id === 'agua').stockActual, 0)
})

test('sin salón queda el total de siempre (borrador que no lo eligió)', () => {
  for (const salon of [null, undefined, '']) {
    assert.deepEqual(insumosEnSalon(insumos, mapa, salon), insumos, String(salon))
  }
})

test('no toca los objetos originales: son los del store', () => {
  const copia = JSON.parse(JSON.stringify(insumos))
  const proyectado = insumosEnSalon(insumos, mapa, 'Quinta')
  assert.deepEqual(insumos, copia, 'el catálogo original no se puede modificar')
  assert.notEqual(proyectado[0], insumos[0], 'tienen que ser objetos nuevos')
  assert.equal(proyectado[0].precioUnitario, 100, 'el resto de los campos se conserva')
  assert.equal(proyectado[0].descripcion, 'COCA COLA')
})

test('los salones que no son el del evento se reportan para poder traer en vez de comprar', () => {
  const otros = hayEnOtrosSalones(mapa, 'coca', 'Quinta')
  assert.equal(otros.total, 222)
  assert.deepEqual(otros.detalle, [{ salon: 'Casona', cantidad: 222 }])
  // En Casona, lo de afuera es lo de Quinta.
  assert.equal(hayEnOtrosSalones(mapa, 'coca', 'Casona').total, 30)
  // Sin nada en otro lado, 0 y sin detalle.
  assert.deepEqual(hayEnOtrosSalones(mapa, 'fernet', 'Casona'), { total: 0, detalle: [] })
  assert.deepEqual(hayEnOtrosSalones(mapa, 'agua', 'Quinta'), { total: 0, detalle: [] })
})

test('un salón en 0 no se ofrece como lugar de donde traer', () => {
  const conCero = new Map([['x', [{ salon: 'Casona', cantidad: 0 }, { salon: 'Salon', cantidad: 4 }]]])
  assert.deepEqual(hayEnOtrosSalones(conCero, 'x', 'Quinta'), { total: 4, detalle: [{ salon: 'Salon', cantidad: 4 }] })
})

test('avisa cuando el salón nunca cargó un conteo', () => {
  assert.equal(salonSinConteos(mapa, 'Salon'), true)
  assert.equal(salonSinConteos(mapa, 'Casona'), false)
  assert.equal(salonSinConteos(mapa, 'Quinta'), false)
  // Un salón con conteos en 0 SÍ contó: no es lo mismo que no haber contado.
  assert.equal(salonSinConteos(new Map([['x', [{ salon: 'Salon', cantidad: 0 }]]]), 'Salon'), false)
  assert.equal(salonSinConteos(mapa, null), false)
})

test('arma el mapa desde la respuesta del endpoint', () => {
  const m = mapaDesdeResumen([
    { insumoId: 'coca', total: 252, salonesContados: 2, detalle: [
      { salon: 'Casona', cantidad: 222, por: 'Aylin', en: '2026-09-29T00:00:00Z' },
      { salon: 'Quinta', cantidad: 30, por: 'Salón', en: '2026-09-29T00:00:00Z' },
    ] },
  ])
  assert.deepEqual(m.get('coca'), [{ salon: 'Casona', cantidad: 222 }, { salon: 'Quinta', cantidad: 30 }])
  assert.equal(insumosEnSalon(insumos, m, 'Quinta').find(i => i.id === 'coca').stockActual, 30)
})

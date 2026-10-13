// Tests del buscador, el filtro por mes, el historial completo (cobros y
// pagos) y los datos bancarios de Caja Eventos (lib/buscador-caja-eventos.ts).
// Solo pantalla: nada de esto cambia montos ni guarda datos.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')

// Carga un .ts de lib/ transpilado; sus imports relativos ("./ipc-cuotas")
// se cargan igual, así se usa la fechaNegocio real.
const cache = new Map()
function cargar(rel) {
  const abs = path.join(__dirname, '..', rel)
  if (cache.has(abs)) return cache.get(abs).exports
  const source = fs.readFileSync(abs, 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const loaded = { exports: {} }
  cache.set(abs, loaded)
  const req = (m) => (m.startsWith('.') ? cargar(path.relative(path.join(__dirname, '..'), path.join(path.dirname(abs), m + '.ts'))) : require(m))
  new Function('module', 'exports', 'require', js)(loaded, loaded.exports, req)
  return loaded.exports
}

const {
  normalizarTexto,
  coincideBusqueda,
  mesDeFecha,
  etiquetaMes,
  mesesDisponibles,
  coincideMes,
  coincideEgresoBusqueda,
  filtrarIngresosPendientes,
  armarHistorialCajaEventos,
  filtrarHistorial,
  totalesHistorial,
  FILTRO_HISTORIAL_INICIAL,
  personalDelSueldo,
  datosBancarios,
} = cargar('lib/buscador-caja-eventos.ts')

test('normaliza sin tildes ni mayúsculas', () => {
  assert.equal(normalizarTexto('  Menú PEÑA Ñandú '), 'menu pena nandu')
  assert.equal(normalizarTexto(undefined), '')
  assert.equal(normalizarTexto(null), '')
})

test('la búsqueda pide todas las palabras, en cualquier campo', () => {
  assert.equal(coincideBusqueda('', ['lo que sea']), true)
  assert.equal(coincideBusqueda('   ', []), true)
  assert.equal(coincideBusqueda('garcia', ['Boda García']), true)
  assert.equal(coincideBusqueda('GARCÍA dj', ['Boda Garcia', 'DJ Martín']), true)
  assert.equal(coincideBusqueda('garcia foto', ['Boda Garcia', 'DJ Martín']), false)
  assert.equal(coincideBusqueda('x', [undefined, null]), false)
})

test('mes de una fecha: día suelto tal cual, ISO con hora en el día de Argentina', () => {
  assert.equal(mesDeFecha('2026-10-31'), '2026-10')
  // 31/10 a las 22 hs de Argentina = 1/11 01:00 UTC: sigue siendo octubre
  assert.equal(mesDeFecha('2026-11-01T01:00:00.000Z'), '2026-10')
  assert.equal(mesDeFecha('2026-11-01T12:00:00.000Z'), '2026-11')
  assert.equal(mesDeFecha(''), '')
  assert.equal(mesDeFecha(undefined), '')
  assert.equal(mesDeFecha('cualquier cosa'), '')
})

test('etiqueta y lista de meses', () => {
  assert.equal(etiquetaMes('2026-01'), 'enero 2026')
  assert.equal(etiquetaMes('2027-12'), 'diciembre 2027')
  assert.equal(etiquetaMes('raro'), 'raro')
  assert.deepEqual(
    mesesDisponibles(['2026-10-05', '2026-12-01', '2026-10-20', '', undefined, '2027-01-02T15:00:00Z']),
    ['2027-01', '2026-12', '2026-10'],
  )
  assert.equal(coincideMes('todos', '2026-01-01'), true)
  assert.equal(coincideMes('', '2026-01-01'), true)
  assert.equal(coincideMes('2026-01', '2026-01-31'), true)
  assert.equal(coincideMes('2026-01', '2026-02-01'), false)
  assert.equal(coincideMes('2026-01', undefined), false)
})

test('Por pagar: busca por evento, proveedor, persona y tipo de pago', () => {
  const sueldo = { eventoNombre: 'XV Sofía', servicioNombre: 'Juan Pérez (DJ)', persona: 'Juan Pérez', tipo: 'sueldo' }
  const menu = { eventoNombre: 'Boda López', servicioNombre: 'Menú', tipo: 'menu' }
  const sena = { eventoNombre: 'Boda López', servicioNombre: 'Ambientación Flores', tipo: 'seña', eventoTipo: 'Boda' }
  assert.equal(coincideEgresoBusqueda(sueldo, 'perez'), true)
  assert.equal(coincideEgresoBusqueda(sueldo, 'sofia sueldo'), true)
  assert.equal(coincideEgresoBusqueda(menu, 'menu lopez'), true)
  assert.equal(coincideEgresoBusqueda(menu, 'cocina'), true)
  assert.equal(coincideEgresoBusqueda(sena, 'flores sena'), true)
  assert.equal(coincideEgresoBusqueda(sena, 'perez'), false)
})

test('Por cobrar: busca por cliente o evento y filtra por mes de vencimiento', () => {
  const items = [
    { id: 'a', eventoNombre: 'Boda López', contacto: { nombre: 'Ana López' }, numeroCuota: 1, fechaVencimiento: '2026-10-10', monto: 100 },
    { id: 'b', eventoNombre: 'XV Sofía', contacto: { nombre: 'Marta Gómez' }, numeroCuota: 2, fechaVencimiento: '2026-11-10', monto: 200 },
  ]
  assert.deepEqual(filtrarIngresosPendientes(items, { q: '', mes: 'todos' }).map((i) => i.id), ['a', 'b'])
  assert.deepEqual(filtrarIngresosPendientes(items, { q: 'gomez', mes: 'todos' }).map((i) => i.id), ['b'])
  assert.deepEqual(filtrarIngresosPendientes(items, { q: '', mes: '2026-10' }).map((i) => i.id), ['a'])
  assert.deepEqual(filtrarIngresosPendientes(items, { q: 'sofia', mes: '2026-10' }).map((i) => i.id), [])
})

// Movimientos inventados de la caja
const MOVS = [
  { id: 'm1', fecha: '2026-10-01T15:00:00.000Z', tipo: 'ingreso', concepto: 'Cuota 1/6 - Boda López', monto: 150000.5, salon: 'Casona', eventoId: 'e1', cajaDestino: 'caja_eventos' },
  { id: 'm2', fecha: '2026-10-03T15:00:00.000Z', tipo: 'ingreso', concepto: 'Seña XV Sofía', monto: 80000, salon: 'Quinta', eventoId: 'e2', cajaDestino: 'caja_eventos' },
  { id: 'm3', fecha: '2026-10-02T15:00:00.000Z', tipo: 'ingreso', concepto: 'Cuota 1/6 - Boda López', monto: 99999, salon: 'Casona', eventoId: 'e1', cajaDestino: 'caja_jazmines' },
  { id: 'm4', fecha: '2026-10-04T15:00:00.000Z', tipo: 'egreso', concepto: 'Pago menú - Boda López', monto: 50000, salon: 'Casona', eventoId: 'e1', cajaDestino: 'caja_eventos' },
  { id: 'm5', fecha: '2026-09-20T15:00:00.000Z', tipo: 'ingreso', concepto: 'Ingreso viejo sin caja', monto: 10, salon: 'Casona' },
]
const PAGOS = [
  { id: 'm4', fecha: '2026-10-04T15:00:00.000Z', concepto: 'Pago menú - Boda López', eventoId: 'e1', eventoNombre: 'Boda López', salon: 'Casona', monto: 50000, tipoPago: 'menu' },
  { id: 'm6', fecha: '2026-09-28T15:00:00.000Z', concepto: 'Pago seña DJ Pro - XV Sofía', eventoId: 'e2', eventoNombre: 'XV Sofía', salon: 'Quinta', monto: 30000, tipoPago: 'seña', servicioNombre: 'DJ Pro' },
  { id: 'm7', fecha: '2026-09-27T15:00:00.000Z', concepto: 'Pago barra - XV Sofía', eventoId: 'e2', eventoNombre: 'XV Sofía', salon: 'Quinta', monto: 1, tipoPago: 'barra' },
]
const EVENTOS = [
  { id: 'e1', nombrePareja: 'Boda López' },
  { id: 'e2', nombre: 'XV Sofía' },
]

test('historial: une cobros de Caja Eventos y pagos no archivados, del más nuevo al más viejo', () => {
  const h = armarHistorialCajaEventos({
    movimientos: MOVS,
    pagosRealizados: PAGOS,
    pagosArchivadosIds: new Set(['m7']),
    eventos: EVENTOS,
  })
  assert.deepEqual(h.map((x) => `${x.tipo}:${x.id}`), ['egreso:m4', 'ingreso:m2', 'ingreso:m1', 'egreso:m6'])
  // los cobros llevan el nombre del evento y no traen acciones de pago
  assert.equal(h.find((x) => x.id === 'm2').eventoNombre, 'XV Sofía')
  assert.equal(h.find((x) => x.id === 'm2').pago, undefined)
  // los pagos conservan el pago original (para Archivar / Revertir)
  assert.equal(h.find((x) => x.id === 'm4').pago.tipoPago, 'menu')
  // los montos quedan iguales
  assert.equal(h.find((x) => x.id === 'm1').monto, 150000.5)
})

test('historial: con un salón elegido, solo los cobros de ese salón', () => {
  const h = armarHistorialCajaEventos({
    movimientos: MOVS,
    pagosRealizados: PAGOS.filter((p) => p.salon === 'Casona'), // el hook ya los trae filtrados
    pagosArchivadosIds: new Set(),
    eventos: EVENTOS,
    salonFiltro: 'Casona',
  })
  assert.deepEqual(h.map((x) => x.id), ['m4', 'm1'])
})

test('historial: buscador, mes, cobros/pagos y totales', () => {
  const h = armarHistorialCajaEventos({ movimientos: MOVS, pagosRealizados: PAGOS, pagosArchivadosIds: new Set(), eventos: EVENTOS })
  const ids = (f) => filtrarHistorial(h, { ...FILTRO_HISTORIAL_INICIAL, ...f }).map((x) => x.id)
  assert.deepEqual(ids({}), ['m4', 'm2', 'm1', 'm6', 'm7'])
  assert.deepEqual(ids({ q: 'lopez' }), ['m4', 'm1'])
  assert.deepEqual(ids({ q: 'dj pro' }), ['m6'])
  assert.deepEqual(ids({ q: 'SEÑA' }), ['m2', 'm6'])
  assert.deepEqual(ids({ mes: '2026-09' }), ['m6', 'm7'])
  assert.deepEqual(ids({ tipo: 'ingreso' }), ['m2', 'm1'])
  assert.deepEqual(ids({ tipo: 'egreso', mes: '2026-10' }), ['m4'])
  assert.deepEqual(ids({ q: 'cobro sofia' }), ['m2'])
  assert.deepEqual(totalesHistorial(filtrarHistorial(h, FILTRO_HISTORIAL_INICIAL)), { ingresos: 230000.5, egresos: 80001 })
  assert.deepEqual(totalesHistorial([]), { ingresos: 0, egresos: 0 })
  // centavos: 0,1 + 0,2 da 0,3 y no 0,30000000000000004
  assert.deepEqual(
    totalesHistorial([{ tipo: 'ingreso', monto: 0.1 }, { tipo: 'ingreso', monto: 0.2 }]),
    { ingresos: 0.3, egresos: 0 },
  )
})

const PERSONAL = [
  { id: 'p1', nombre: 'Juan', apellido: 'Pérez', cuentaBancaria: { banco: 'Nación', cbu: '0110000000000000000001', alias: 'juan.perez.dj' } },
  { id: 'p2', nombre: 'Lía', apellido: 'Sosa' },
  { id: 'p3', nombre: 'Rita', apellido: 'Paz', cuentaBancaria: { banco: '', cbu: '  ', alias: '' } },
]
const CTX = {
  eventos: [{ id: 'e1', personalEvento: [{ id: 'pe1', personalId: 'p1' }, { id: 'pe2', personalId: 'p2' }] }],
  pagosPersonal: [{ id: 'pp1', personalId: 'p3' }],
  personal: PERSONAL,
}

test('sueldos: encuentra a la persona del personal del evento o del compromiso', () => {
  assert.equal(personalDelSueldo({ id: 'e1-sueldo-pe1', tipo: 'sueldo', eventoId: 'e1', servicioId: 'pe1' }, CTX).id, 'p1')
  assert.equal(personalDelSueldo({ id: 'e1-sueldo-pe2', tipo: 'sueldo', eventoId: 'e1', servicioId: 'pe2' }, CTX).id, 'p2')
  assert.equal(personalDelSueldo({ id: 'e1-compromiso-pp1', tipo: 'sueldo', eventoId: 'e1', servicioId: 'pp1' }, CTX).id, 'p3')
  // un servicio que se paga como sueldo es un proveedor: no hay persona
  assert.equal(personalDelSueldo({ id: 'e1-srvsueldo-s1', tipo: 'sueldo', eventoId: 'e1', servicioId: 's1' }, CTX), null)
  // otros tipos de pago, o una persona borrada del roster
  assert.equal(personalDelSueldo({ id: 'e1-menu', tipo: 'menu', eventoId: 'e1' }, CTX), null)
  assert.equal(personalDelSueldo({ id: 'e1-sueldo-x', tipo: 'sueldo', eventoId: 'e1', servicioId: 'x' }, CTX), null)
})

test('datos bancarios: CBU y alias recortados; sin ninguno de los dos, null ("Sin CBU cargado")', () => {
  assert.deepEqual(datosBancarios(PERSONAL[0]), { banco: 'Nación', cbu: '0110000000000000000001', alias: 'juan.perez.dj' })
  assert.equal(datosBancarios(PERSONAL[1]), null)
  assert.equal(datosBancarios(PERSONAL[2]), null)
  assert.equal(datosBancarios(null), null)
  assert.deepEqual(datosBancarios({ cuentaBancaria: { banco: 'Galicia', cbu: '', alias: 'solo.alias' } }), { banco: 'Galicia', cbu: '', alias: 'solo.alias' })
})

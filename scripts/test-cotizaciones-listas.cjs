const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)
const {
  filtroDesdeParam, contarPorFiltro, filtrarCotizaciones,
} = require('../lib/cotizaciones-listas.ts')

const lista = [
  { id: '1', estado: 'borrador', clienteNombre: 'José Pérez' },
  { id: '2', estado: 'rechazada', clienteNombre: 'Ana Gómez' },
  { id: '3', estado: 'rechazada', clienteNombre: 'Josefina Ruiz' },
  { id: '4', estado: 'lista_para_revisar', clienteNombre: 'Carlos' },
  { id: '5', estado: 'convertida', clienteNombre: 'Marta' },
  { id: '6', estado: 'aprobada', clienteNombre: 'Luis' },
]

test('el filtro inicial sale de ?estado= y si no se reconoce son todas', () => {
  assert.equal(filtroDesdeParam('rechazada'), 'rechazada')
  assert.equal(filtroDesdeParam('lista_para_revisar'), 'lista_para_revisar')
  assert.equal(filtroDesdeParam('aprobada'), 'todas')
  assert.equal(filtroDesdeParam(null), 'todas')
  assert.equal(filtroDesdeParam('cualquiera'), 'todas')
})

test('los contadores cuentan por estado y "Todas" incluye las aprobadas', () => {
  assert.deepEqual(contarPorFiltro(lista), { todas: 6, borrador: 1, rechazada: 2, lista_para_revisar: 1, convertida: 1 })
  assert.deepEqual(contarPorFiltro([]), { todas: 0, borrador: 0, rechazada: 0, lista_para_revisar: 0, convertida: 0 })
})

test('filtra por estado y busca por nombre sin importar mayúsculas ni tildes', () => {
  assert.deepEqual(filtrarCotizaciones(lista, 'rechazada', '').map((c) => c.id), ['2', '3'])
  assert.deepEqual(filtrarCotizaciones(lista, 'todas', 'jose').map((c) => c.id), ['1', '3'])
  assert.deepEqual(filtrarCotizaciones(lista, 'rechazada', 'JOSÉ').map((c) => c.id), ['3'])
  assert.deepEqual(filtrarCotizaciones(lista, 'todas', '  ').length, 6)
})

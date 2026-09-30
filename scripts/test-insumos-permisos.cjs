const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/insumos-permisos.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { permisoInsumo } = loaded.exports

const puede = (args) => permisoInsumo(args).ok

test('Administración y Soporte pueden todo, en los dos sectores', () => {
  for (const perfilId of ['administracion', 'soporte']) {
    for (const sector of ['cocina', 'barra']) {
      for (const accion of ['crear', 'editar', 'borrar']) {
        assert.equal(puede({ perfilId, sector, accion, campos: ['precioUnitario', 'unidad'] }), true, `${perfilId} ${sector} ${accion}`)
      }
    }
  }
})

test('Cocina edita el stock de cocina y nada más', () => {
  assert.equal(puede({ perfilId: 'cocina', sector: 'cocina', accion: 'editar', campos: ['stockActual'] }), true)
  // El id viaja en la URL; que venga también en el body no es tocar un campo.
  assert.equal(puede({ perfilId: 'cocina', sector: 'cocina', accion: 'editar', campos: ['id', 'stockActual'] }), true)
  assert.equal(puede({ perfilId: 'cocina', sector: 'cocina', accion: 'crear', campos: [] }), false)
  assert.equal(puede({ perfilId: 'cocina', sector: 'cocina', accion: 'borrar', campos: [] }), false)
})

test('Barra edita el stock de barra y nada más', () => {
  assert.equal(puede({ perfilId: 'barra', sector: 'barra', accion: 'editar', campos: ['stockActual'] }), true)
  assert.equal(puede({ perfilId: 'barra', sector: 'barra', accion: 'crear', campos: [] }), false)
  assert.equal(puede({ perfilId: 'barra', sector: 'barra', accion: 'borrar', campos: [] }), false)
})

test('cada uno solo sobre su tabla', () => {
  assert.equal(puede({ perfilId: 'cocina', sector: 'barra', accion: 'editar', campos: ['stockActual'] }), false)
  assert.equal(puede({ perfilId: 'barra', sector: 'cocina', accion: 'editar', campos: ['stockActual'] }), false)
})

test('los campos que mueven costos se rechazan, no se ignoran', () => {
  for (const campo of ['unidad', 'precioUnitario', 'contenidoCantidad', 'contenidoUnidad', 'descripcion', 'codigo', 'proveedor', 'categoria']) {
    const v = permisoInsumo({ perfilId: 'cocina', sector: 'cocina', accion: 'editar', campos: ['stockActual', campo] })
    assert.equal(v.ok, false, campo)
    assert.match(v.error, new RegExp(campo), `el error tiene que nombrar ${campo}`)
  }
})

test('los perfiles sin nada que ver con insumos no pasan', () => {
  for (const perfilId of ['cobro', 'dj', 'fotografo', 'vestido', 'pantalla', 'coordinacion', 'vendedor', null, undefined, '']) {
    assert.equal(puede({ perfilId, sector: 'cocina', accion: 'editar', campos: ['stockActual'] }), false, String(perfilId))
  }
})

test('el error explica qué pasó y no filtra nada raro', () => {
  assert.match(permisoInsumo({ perfilId: 'cocina', sector: 'cocina', accion: 'crear' }).error, /Administración/)
  assert.match(permisoInsumo({ perfilId: 'cocina', sector: 'barra', accion: 'editar' }).error, /barra/)
  assert.match(permisoInsumo({ perfilId: 'dj', sector: 'cocina', accion: 'editar' }).error, /permiso/)
})

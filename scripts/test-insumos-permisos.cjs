const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/insumos-permisos.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { permisoInsumo, puedeEditarCatalogo } = loaded.exports

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

test('Cocina y Barra NO entran al catálogo: su stock se carga desde /stock', () => {
  for (const perfilId of ['cocina', 'barra']) {
    for (const sector of ['cocina', 'barra']) {
      for (const accion of ['editar', 'crear', 'borrar']) {
        assert.equal(puede({ perfilId, sector, accion, campos: ['stockActual'] }), false, `${perfilId} ${sector} ${accion}`)
      }
    }
    const v = permisoInsumo({ perfilId, sector: 'cocina', accion: 'editar', campos: ['stockActual'] })
    assert.match(v.error, /Stock por salón/)
    assert.equal(puedeEditarCatalogo(perfilId), false)
  }
})

test('los perfiles sin nada que ver con insumos no pasan', () => {
  for (const perfilId of ['cobro', 'dj', 'fotografo', 'vestido', 'pantalla', 'coordinacion', 'vendedor', null, undefined, '']) {
    assert.equal(puede({ perfilId, sector: 'cocina', accion: 'editar', campos: ['stockActual'] }), false, String(perfilId))
  }
  assert.match(permisoInsumo({ perfilId: 'dj', sector: 'cocina', accion: 'editar' }).error, /permiso/)
})

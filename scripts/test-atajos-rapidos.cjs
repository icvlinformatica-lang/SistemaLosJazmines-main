// Atajos rápidos de Inicio: se ordenan por las pantallas a las que más entra
// cada perfil, se completan con los de arranque y nunca muestran una pantalla
// a la que el perfil no puede entrar.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/atajos-rapidos.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { armarAtajos, sumarVisita, leerConteo, atajoDeRuta, rutaPermitida, ATAJOS_INICIALES, MAX_ATAJOS } = loaded.exports

const admin = { rutas: ['*'], rutasExcluidas: ['/eventos/produccion'] }
const cobro = { rutas: ['/', '/eventos/pagos'] }
const cocina = { rutas: ['/eventos/produccion', '/stock'] }
const hrefs = (lista) => lista.map((a) => a.href)

test('sin visitas, Administración ve sus atajos de arranque', () => {
  assert.deepEqual(hrefs(armarAtajos('administracion', admin, {})), ATAJOS_INICIALES.administracion)
})

test('lo más visitado va primero y desplaza a los de arranque', () => {
  const conteo = { '/admin/cocteles': 9, '/stock': 4, '/eventos/lista': 4 }
  const a = hrefs(armarAtajos('administracion', admin, conteo))
  assert.equal(a.length, MAX_ATAJOS)
  // Cocteles (9) primero; Lista y Stock empatan en 4 y Lista es de arranque.
  assert.deepEqual(a.slice(0, 3), ['/admin/cocteles', '/eventos/lista', '/stock'])
  // Se completa con los de arranque que faltan, en su orden.
  assert.deepEqual(a.slice(3), ['/eventos/pagos', '/finanzas/caja-eventos', '/finanzas/caja-jazmines'])
})

test('nunca un atajo a una pantalla que el perfil no puede abrir', () => {
  const conteo = { '/eventos/produccion': 50, '/finanzas/caja-eventos': 3 }
  assert.ok(!hrefs(armarAtajos('administracion', admin, conteo)).includes('/eventos/produccion'))
  assert.deepEqual(hrefs(armarAtajos('cobro', cobro, conteo)), ['/eventos/pagos'])
  const c = armarAtajos('cocina', cocina, conteo)
  assert.deepEqual(hrefs(c), ['/eventos/produccion', '/stock'])
  // Cocina las ve con los nombres de su menú.
  assert.equal(c[0].label, 'Próximos eventos')
})

test('rutas vacías es acceso total, como en el resto del sistema', () => {
  assert.equal(rutaPermitida('/finanzas/ipc', { rutas: [] }), true)
  assert.equal(rutaPermitida('/finanzas/ipc', cobro), false)
})

test('las visitas se cuentan por pantalla del catálogo', () => {
  assert.equal(atajoDeRuta('/eventos/pagos/abc'), '/eventos/pagos')
  assert.equal(atajoDeRuta('/'), null)
  assert.equal(atajoDeRuta('/login'), null)
  let c = {}
  c = sumarVisita(c, '/eventos/lista')
  c = sumarVisita(c, '/eventos/lista')
  assert.deepEqual(c, { '/eventos/lista': 2 })
  // Inicio no cuenta y devuelve el mismo objeto (no hace falta guardar).
  assert.equal(sumarVisita(c, '/'), c)
})

test('lo guardado roto o viejo no rompe nada', () => {
  assert.deepEqual(leerConteo(null), {})
  assert.deepEqual(leerConteo('{roto'), {})
  assert.deepEqual(leerConteo('[1,2]'), {})
  assert.deepEqual(leerConteo('{"/eventos/lista":3,"/no-existe":5,"/stock":-1,"/admin/barra":"x"}'), { '/eventos/lista': 3 })
})

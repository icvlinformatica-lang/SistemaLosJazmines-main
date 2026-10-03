// Cotizador costo + ganancia, Paso 2: la cuenta completa de una cotización
// (armarCotizacion de lib/cotizador-salon.ts).
// Correr: node --test scripts/test-cotizacion-salon.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(out.outputText, filename)
}
const { armarCotizacion, precioConGanancia, precioBarraSalon, cantidadServicio } = require("../lib/cotizador-salon.ts")

// Caso de referencia: Quinta, salón $1.000.000 al 50 %, cocina $3.000 por
// porción al 50 %, barra de 3 cócteles ($1.000 / $1.500 / $2.000) al 50 %,
// 70 adultos + 10 niños, sin servicios ni personal.
const costosCocteles = { a: 1000, b: 1500, c: 2000 }
const barraRef = {
  id: "barra-ref",
  nombre: "Barra de prueba",
  tragosPorAdulto: 3,
  costo: precioBarraSalon(["a", "b", "c"], costosCocteles, 0).precioPorAdulto,
  precio: precioBarraSalon(["a", "b", "c"], costosCocteles, 50).precioPorAdulto,
}
const base = () => ({
  adultos: 70,
  ninos: 10,
  capacidadMaxima: 150,
  salon: { costo: 1000000, precio: precioConGanancia(1000000, 50) },
  recetas: [{ id: "r1", nombre: "Plato de prueba", costo: 3000, precio: precioConGanancia(3000, 50) }],
  barra: barraRef,
  servicios: [],
  personal: [],
})
const rubro = (res, clave) => res.rubros.find((r) => r.clave === clave)

test("caso de referencia: 1.500.000 + 360.000 + 472.500 = $2.332.500", () => {
  const res = armarCotizacion(base())
  assert.equal(rubro(res, "salon").precio, 1500000)
  assert.equal(rubro(res, "cocina").precio, 360000)
  assert.equal(rubro(res, "barra").precio, 472500)
  assert.equal(rubro(res, "servicios").precio, 0)
  assert.equal(rubro(res, "personal").precio, 0)
  assert.equal(res.total, 2332500)
  // costos: 1.000.000 + 80 × 3.000 + 70 × 4.500
  assert.equal(res.costoTotal, 1000000 + 240000 + 315000)
  assert.equal(res.comensales, 80)
  assert.equal(res.modalidad, "con_catering")
  assert.deepEqual(res.avisos, [])
  assert.equal(res.superaCapacidad, false)
})

test("cocina = comensales × PROMEDIO del precio por porción", () => {
  const e = base()
  e.recetas = [
    { id: "r1", nombre: "A", costo: 3000, precio: 4500 },
    { id: "r2", nombre: "B", costo: 5000, precio: 7500 },
  ]
  assert.equal(rubro(armarCotizacion(e), "cocina").precio, 80 * 6000)
  e.recetas = []
  const sinMenu = armarCotizacion(e)
  assert.equal(rubro(sinMenu, "cocina").precio, 0)
  assert.equal(sinMenu.modalidad, "solo_salon")
})

test("con personal: mozo cada 20 (mín 2) $50.000 +30 %, Puerta fija, cocinero solo con menú", () => {
  const e = base()
  e.personal = [
    { funcion: "Mozo", cadaNInvitados: 20, minimo: 2, aplica: "siempre", costo: 50000, precio: precioConGanancia(50000, 30) },
    { funcion: "Puerta", cadaNInvitados: 0, minimo: 1, aplica: "siempre", costo: 42000, precio: 42000 },
    { funcion: "Barman", cadaNInvitados: 0, minimo: 1, aplica: "con_barra", costo: 55000, precio: 55000 },
  ]
  const res = armarCotizacion(e)
  // 80 comensales → 4 mozos × 65.000 + 1 Puerta × 42.000 + 1 Barman × 55.000
  assert.deepEqual(res.personal.map((l) => `${l.cantidad} ${l.funcion}`), ["4 Mozo", "1 Puerta", "1 Barman"])
  assert.equal(rubro(res, "personal").precio, 260000 + 42000 + 55000)
  assert.equal(res.total, 2332500 + 357000)
  // sin barra, el barman no va
  e.barra = null
  assert.deepEqual(armarCotizacion(e).personal.map((l) => l.funcion), ["Mozo", "Puerta"])
})

test("servicio incluido en el salón: se lista y NO suma", () => {
  const e = base()
  e.servicios = [
    { servicioId: "dj", nombre: "DJ", unidad: "Fijo", cantidad: 1, incluido: true, costo: 300000, precio: 360000 },
    { servicioId: "foto", nombre: "Fotografía", unidad: "Fijo", cantidad: 1, incluido: false, costo: 200000, precio: 240000 },
  ]
  const res = armarCotizacion(e)
  assert.equal(res.servicios.find((s) => s.servicioId === "dj").precioTotal, 0)
  assert.equal(rubro(res, "servicios").precio, 240000)
  assert.equal(rubro(res, "servicios").costo, 200000)
  assert.equal(res.total, 2332500 + 240000)
})

test("servicios por unidad: Fijo y Por Persona × 1; Por Hora / Por Cantidad × cantidad", () => {
  assert.equal(cantidadServicio("Fijo", 5), 1)
  assert.equal(cantidadServicio("Por Persona", 80), 1)
  assert.equal(cantidadServicio("Por Hora", 3), 3)
  assert.equal(cantidadServicio("Por Cantidad", 0), 1)
  const e = base()
  e.servicios = [{ servicioId: "p360", nombre: "Plataforma 360", unidad: "Por Hora", cantidad: 3, incluido: false, costo: 10000, precio: 12000 }]
  assert.equal(rubro(armarCotizacion(e), "servicios").precio, 36000)
})

test("capacidad superada: aviso ROJO", () => {
  const e = base()
  e.capacidadMaxima = 75
  const res = armarCotizacion(e)
  assert.equal(res.superaCapacidad, true)
  assert.equal(res.avisos[0].nivel, "rojo")
  assert.equal(res.avisos[0].codigo, "capacidad")
  // sin capacidad cargada no se limita
  e.capacidadMaxima = null
  assert.equal(armarCotizacion(e).superaCapacidad, false)
})

test("rubros en $0: avisos ámbar (y el texto del vendedor nunca dice costo/ganancia/margen)", () => {
  const e = base()
  e.salon = { costo: 0, precio: 0 }
  e.recetas = [{ id: "bondiola", nombre: "Bondiola a la Parrilla", costo: 0, precio: 0 }]
  e.servicios = [{ servicioId: "x", nombre: "Letras de prueba", unidad: "Fijo", cantidad: 1, incluido: false, costo: 0, precio: 0 }]
  e.personal = [{ funcion: "Payaso", cadaNInvitados: 0, minimo: 1, aplica: "siempre", costo: 0, precio: 0 }]
  const res = armarCotizacion(e)
  const codigos = res.avisos.map((a) => a.codigo)
  assert.deepEqual(codigos, ["salon", "receta:bondiola", "servicio:x", "personal:Payaso"])
  assert.ok(res.avisos.every((a) => a.nivel === "ambar"))
  for (const a of res.avisos) assert.doesNotMatch(a.textoVendedor, /costo|ganancia|margen/i)
})

test("pantalla del vendedor: misma cuenta solo con precios (sin costos)", () => {
  const e = base()
  const sinCostos = {
    ...e,
    salon: { precio: e.salon.precio },
    recetas: e.recetas.map(({ costo, ...r }) => r),
    barra: (({ costo, ...b }) => b)(e.barra),
  }
  const res = armarCotizacion(sinCostos)
  assert.equal(res.total, 2332500)
  assert.equal(res.costoTotal, null)
  assert.ok(res.rubros.every((r) => r.costo === null))
})

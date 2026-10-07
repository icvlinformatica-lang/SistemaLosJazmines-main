// Recargo de sábado / fecha especial con un porcentaje por rubro (scripts/020).
// Correr: node --test scripts/test-recargo-por-rubro.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(out.outputText, filename)
}
const {
  armarCotizacion, resolverDia, montoRecargo, validarReglaRecargo, porcentajesPorRubro,
  reglaPorcentajePorRubro, reglaRecargoDesdeColumnas,
} = require("../lib/cotizador-salon.ts")

const VIERNES = "2026-10-09"
const SABADO = "2026-10-10"
// Lo que hoy está cargado en la base: Quinta 17 % y Casona 10 %, sobre Salón y Cocina.
const QUINTA_HOY = { tipo: "porcentaje", valor: 17, rubros: ["salon", "cocina"] }
const CASONA_HOY = { tipo: "porcentaje", valor: 10, rubros: ["salon", "cocina"] }

// Caso de referencia del cotizador (Quinta): salón $1.500.000, cocina $360.000
// (80 comensales × $4.500), barra $472.500 (70 adultos × $6.750) y un servicio de $400.000.
function entrada(dia) {
  return {
    adultos: 70,
    ninos: 10,
    capacidadMaxima: 130,
    salon: { costo: 1000000, precio: 1500000 },
    recetas: [{ id: "r1", nombre: "Plato", costo: 3000, precio: 4500 }],
    barra: { id: "b1", nombre: "Barra", tragosPorAdulto: 3, costo: 4500, precio: 6750 },
    servicios: [{ servicioId: "foto", nombre: "FOTOGRAFIA", unidad: "Fijo", cantidad: 1, incluido: false, costo: 300000, precio: 400000 }],
    personal: [],
    dia,
  }
}
const cotizar = (fecha, recargoSabado, fechas = []) => armarCotizacion(entrada(resolverDia(fecha, "Quinta", recargoSabado, fechas)))

test("lo que ya está cargado cobra exactamente lo mismo que antes (también con centavos)", () => {
  const precios = [
    { salon: 1500000, cocina: 360000, barra: 472500, servicios: 400000 },
    { salon: 1234567.89, cocina: 98765.43, barra: 0, servicios: 0.5 },
    { salon: 2.5, cocina: 2.5, barra: 7, servicios: 9 },
  ]
  for (const hoy of [QUINTA_HOY, CASONA_HOY]) {
    const pasada = reglaPorcentajePorRubro({ salon: hoy.valor, cocina: hoy.valor })
    for (const p of precios) {
      const comoAntes = Math.round(((p.salon + p.cocina) * hoy.valor) / 100)
      assert.equal(montoRecargo(hoy, p), comoAntes)
      assert.equal(montoRecargo(pasada, p), comoAntes)
    }
  }
  // Caso de referencia: 17 % de (1.500.000 + 360.000) = $316.200
  assert.equal(cotizar(SABADO, QUINTA_HOY).recargo.monto, 316200)
})

test("cada rubro con su %: Salón y Cocina 17 %, Servicios 10 % → $356.200", () => {
  const regla = reglaPorcentajePorRubro({ salon: 17, cocina: 17, servicios: 10 })
  const r = cotizar(SABADO, regla)
  // 17 % de 1.860.000 = 316.200 + 10 % de 400.000 = 40.000
  assert.equal(r.recargo.monto, 356200)
  assert.deepEqual(r.recargo.porcentajes, { salon: 17, cocina: 17, barra: 0, servicios: 10 })
  assert.equal(r.total, 1500000 + 360000 + 472500 + 400000 + 356200)
  assert.deepEqual(r.rubros.find((x) => x.clave === "recargo"), { clave: "recargo", nombre: "Recargo sábado", costo: 0, precio: 356200 })
  // El viernes no hay recargo
  assert.equal(cotizar(VIERNES, regla).recargo, null)
})

test("solo Servicios: 10 % de $400.000 = $40.000; Personal nunca entra", () => {
  assert.equal(cotizar(SABADO, reglaPorcentajePorRubro({ servicios: 10 })).recargo.monto, 40000)
  assert.equal(montoRecargo(reglaPorcentajePorRubro({ servicios: 10 }), { servicios: 1000, personal: 999999 }), 100)
})

test("todo en 0 = sin recargo (no aparece el renglón)", () => {
  const r = cotizar(SABADO, reglaPorcentajePorRubro({}))
  assert.equal(r.recargo, null)
  assert.equal(r.rubros.some((x) => x.clave === "recargo"), false)
})

test("el monto fijo sigue igual", () => {
  assert.equal(cotizar(SABADO, { tipo: "monto", valor: 500000, rubros: ["salon"] }).recargo.monto, 500000)
  assert.equal(cotizar(SABADO, { tipo: "monto", valor: 500000, rubros: ["salon"] }).recargo.porcentajes, undefined)
})

test("porcentajesPorRubro: lo de antes, lo nuevo y el monto fijo", () => {
  assert.deepEqual(porcentajesPorRubro(QUINTA_HOY), { salon: 17, cocina: 17, barra: 0, servicios: 0 })
  assert.deepEqual(porcentajesPorRubro(reglaPorcentajePorRubro({ cocina: 5, servicios: 12.5 })), { salon: 0, cocina: 5, barra: 0, servicios: 12.5 })
  assert.deepEqual(porcentajesPorRubro({ tipo: "monto", valor: 500000, rubros: ["salon"] }), { salon: 0, cocina: 0, barra: 0, servicios: 0 })
  assert.deepEqual(porcentajesPorRubro(null), { salon: 0, cocina: 0, barra: 0, servicios: 0 })
})

test("reglaPorcentajePorRubro deja valor y rubros al día (el % más alto y los que tienen recargo)", () => {
  assert.deepEqual(reglaPorcentajePorRubro({ salon: 17, cocina: 17, servicios: 10 }), {
    tipo: "porcentaje", valor: 17, rubros: ["salon", "cocina", "servicios"],
    porcentajes: { salon: 17, cocina: 17, barra: 0, servicios: 10 },
  })
  assert.deepEqual(reglaPorcentajePorRubro({}).rubros, ["salon"])
})

test("validar: acepta un % por rubro y rechaza valores fuera de rango", () => {
  const ok = validarReglaRecargo({ tipo: "porcentaje", porcentajes: { salon: 17, cocina: "17", servicios: 10, personal: 50 } }, "x")
  assert.deepEqual(ok.porcentajes, { salon: 17, cocina: 17, barra: 0, servicios: 10 })
  assert.equal(typeof validarReglaRecargo({ tipo: "porcentaje", porcentajes: { salon: 1001 } }, "x"), "string")
  assert.equal(typeof validarReglaRecargo({ tipo: "porcentaje", porcentajes: { servicios: -1 } }, "x"), "string")
  assert.equal(typeof validarReglaRecargo({ tipo: "porcentaje", porcentajes: { barra: "mucho" } }, "x"), "string")
  assert.equal(typeof validarReglaRecargo({ tipo: "porcentaje", porcentajes: [10] }, "x"), "string")
  // Como antes (un solo % para los tildados): sale con los porcentajes armados
  assert.deepEqual(validarReglaRecargo(QUINTA_HOY, "x").porcentajes, { salon: 17, cocina: 17, barra: 0, servicios: 0 })
  // El monto fijo no cambia de forma
  assert.deepEqual(validarReglaRecargo({ tipo: "monto", valor: 500000 }, "x"), { tipo: "monto", valor: 500000, rubros: ["salon"] })
})

test("leer de la base: sin la columna nueva se lee como antes; con ella, el % de cada rubro", () => {
  assert.deepEqual(reglaRecargoDesdeColumnas("porcentaje", "17", ["salon", "cocina"], null), QUINTA_HOY)
  assert.deepEqual(reglaRecargoDesdeColumnas("monto", "0", ["salon"], undefined), { tipo: "monto", valor: 0, rubros: ["salon"] })
  const objeto = reglaRecargoDesdeColumnas("porcentaje", 17, ["salon", "cocina", "servicios"], { salon: 17, cocina: 17, servicios: 10 })
  assert.deepEqual(objeto.porcentajes, { salon: 17, cocina: 17, barra: 0, servicios: 10 })
  // jsonb que llegó como texto (como pasa en eventos): también se entiende
  const texto = reglaRecargoDesdeColumnas("porcentaje", 17, ["salon"], JSON.stringify({ salon: 17, servicios: 10 }))
  assert.deepEqual(texto.porcentajes, { salon: 17, cocina: 0, barra: 0, servicios: 10 })
  // Texto roto: se lee como antes
  assert.deepEqual(reglaRecargoDesdeColumnas("porcentaje", 10, ["salon"], "{roto"), { tipo: "porcentaje", valor: 10, rubros: ["salon"] })
  // En monto fijo los porcentajes no se usan
  assert.equal(reglaRecargoDesdeColumnas("monto", 500000, ["salon"], { salon: 10 }).porcentajes, undefined)
})

test("fechas especiales: 'como sábado' usa los % del salón y 'recargo propio' los suyos", () => {
  const salonQuinta = reglaPorcentajePorRubro({ salon: 17, cocina: 17, servicios: 10 })
  const especial = (modo, recargo = null) => [{ id: "fe", fecha: VIERNES, nombre: "Víspera", todosLosSalones: true, salones: ["Quinta"], modo, recargo }]
  assert.equal(cotizar(VIERNES, salonQuinta, especial("sabado")).recargo.monto, 356200)
  const propio = cotizar(VIERNES, salonQuinta, especial("propio", reglaPorcentajePorRubro({ servicios: 25 })))
  assert.equal(propio.recargo.monto, 100000)
  assert.equal(propio.recargo.origen, "especial")
})

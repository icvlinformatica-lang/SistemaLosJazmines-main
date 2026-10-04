// Recargo de sábado y fechas especiales del cotizador (scripts/018).
// Correr: node --test scripts/test-recargo-cotizador.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(out.outputText, filename)
}
const { armarCotizacion, diaDeSemana, resolverDia, montoRecargo, validarReglaRecargo, hoyArgentina, fechaEspecialDelDia } = require("../lib/cotizador-salon.ts")

// Caso de referencia (Quinta, un viernes): salón 1.500.000 + cocina 360.000
// (80 comensales × $4.500) + barra 472.500 (70 adultos × $6.750) = $2.332.500.
const VIERNES = "2026-10-09"
const SABADO = "2026-10-10"
const DOMINGO = "2026-10-11"
const SIN_RECARGO = { tipo: "monto", valor: 0, rubros: ["salon"] }
const SABADO_500K = { tipo: "monto", valor: 500000, rubros: ["salon"] }

function entrada(dia) {
  return {
    adultos: 70,
    ninos: 10,
    capacidadMaxima: 130,
    salon: { costo: 1000000, precio: 1500000 },
    recetas: [{ id: "r1", nombre: "Plato", costo: 3000, precio: 4500 }],
    barra: { id: "b1", nombre: "Barra", tragosPorAdulto: 3, costo: 4500, precio: 6750 },
    servicios: [],
    personal: [],
    dia,
  }
}
const cotizar = (fecha, recargoSabado, fechas = [], salon = "Quinta") =>
  armarCotizacion(entrada(resolverDia(fecha, salon, recargoSabado, fechas)))

const especial = (fecha, modo, salones = ["Quinta", "Casona", "Salon", "Salon 4", "Salon 5"], recargo = null) => ({
  id: `fe-${fecha}-${modo}`,
  fecha,
  nombre: "Víspera 9 de Julio",
  todosLosSalones: salones.length === 5,
  salones,
  modo,
  recargo,
})

test("2026-10-10 da sábado y 2026-10-09 da viernes (sin zona horaria)", () => {
  assert.equal(diaDeSemana(SABADO), 6)
  assert.equal(diaDeSemana(VIERNES), 5)
  assert.equal(diaDeSemana(DOMINGO), 0)
  assert.equal(diaDeSemana("2026-02-30"), null)
  assert.equal(diaDeSemana(""), null)
  // Mismo resultado con cualquier zona horaria del proceso
  for (const tz of ["America/Argentina/Buenos_Aires", "UTC", "Asia/Tokyo", "Pacific/Honolulu"]) {
    process.env.TZ = tz
    assert.equal(diaDeSemana(SABADO), 6, tz)
  }
})

test("viernes → $2.332.500 (caso de referencia, sin recargo)", () => {
  const r = cotizar(VIERNES, SABADO_500K)
  assert.equal(r.total, 2332500)
  assert.equal(r.recargo, null)
  assert.equal(r.rubros.some((x) => x.clave === "recargo"), false)
})

test("sábado con recargo $500.000 → $2.832.500, renglón aparte con costo 0", () => {
  const r = cotizar(SABADO, SABADO_500K)
  assert.equal(r.total, 2832500)
  const renglon = r.rubros.find((x) => x.clave === "recargo")
  assert.deepEqual(renglon, { clave: "recargo", nombre: "Recargo sábado", costo: 0, precio: 500000 })
  // ganancia pura: el costo total no cambia
  assert.equal(r.costoTotal, cotizar(VIERNES, SABADO_500K).costoTotal)
})

test("domingo → $2.332.500 (como viernes)", () => {
  assert.equal(cotizar(DOMINGO, SABADO_500K).total, 2332500)
  assert.equal(resolverDia(DOMINGO, "Quinta", SABADO_500K, []).tipo, "como_viernes")
})

test("10 % sobre Salón + Cocina, sábado → 2.332.500 + 186.000 = $2.518.500", () => {
  const r = cotizar(SABADO, { tipo: "porcentaje", valor: 10, rubros: ["salon", "cocina"] })
  assert.equal(r.recargo.monto, 186000)
  assert.equal(r.total, 2518500)
})

test("valor 0 → igual que hoy, cualquier día", () => {
  for (const f of [VIERNES, SABADO, DOMINGO, "2026-10-12", ""]) {
    assert.equal(cotizar(f, SIN_RECARGO).total, 2332500, f)
    assert.equal(cotizar(f, { tipo: "porcentaje", valor: 0, rubros: ["salon", "cocina"] }).total, 2332500, f)
  }
})

test("viernes 2026-10-09 marcado «Como sábado» → $2.832.500", () => {
  const r = cotizar(VIERNES, SABADO_500K, [especial(VIERNES, "sabado")])
  assert.equal(r.total, 2832500)
  assert.equal(r.rubros.find((x) => x.clave === "recargo").nombre, "Víspera 9 de Julio")
})

test("sábado 2026-10-10 con «Recargo propio» $800.000 → $3.132.500 (NO $3.632.500)", () => {
  const r = cotizar(SABADO, SABADO_500K, [especial(SABADO, "propio", undefined, { tipo: "monto", valor: 800000, rubros: ["salon"] })])
  assert.equal(r.total, 3132500)
  assert.equal(r.rubros.filter((x) => x.clave === "recargo").length, 1)
})

test("sábado 2026-10-10 marcado «Como viernes» → $2.332.500", () => {
  const r = cotizar(SABADO, SABADO_500K, [especial(SABADO, "viernes")])
  assert.equal(r.total, 2332500)
  assert.equal(r.recargo, null)
})

test("fecha especial solo para Casona → en Quinta no cambia nada", () => {
  const fechas = [especial(VIERNES, "propio", ["Casona"], { tipo: "monto", valor: 800000, rubros: ["salon"] })]
  assert.equal(cotizar(VIERNES, SABADO_500K, fechas, "Quinta").total, 2332500)
  assert.equal(cotizar(VIERNES, SABADO_500K, fechas, "Casona").total, 2332500 + 800000)
  // y un sábado en Quinta sigue con su recargo de sábado
  const fechasSab = [especial(SABADO, "viernes", ["Casona"])]
  assert.equal(cotizar(SABADO, SABADO_500K, fechasSab, "Quinta").total, 2832500)
})

test("sin fecha: sin recargo y aviso «Sin fecha: se cotiza como viernes»", () => {
  const r = cotizar("", SABADO_500K)
  assert.equal(r.total, 2332500)
  assert.ok(r.avisos.some((a) => a.codigo === "sin_fecha" && a.textoVendedor === "Sin fecha: se cotiza como viernes"))
})

test("sin costos (pantalla del vendedor): mismo total y recargo sin costo", () => {
  const e = entrada(resolverDia(SABADO, "Quinta", SABADO_500K, []))
  for (const x of [e.salon, ...e.recetas, e.barra]) delete x.costo
  const r = armarCotizacion(e)
  assert.equal(r.total, 2832500)
  assert.equal(r.rubros.find((x) => x.clave === "recargo").costo, null)
  assert.equal(r.costoTotal, null)
})

test("el % nunca se aplica sobre Personal", () => {
  assert.equal(montoRecargo({ tipo: "porcentaje", valor: 10, rubros: ["salon"] }, { salon: 1000, personal: 9999 }), 100)
  const v = validarReglaRecargo({ tipo: "porcentaje", valor: 10, rubros: ["salon", "personal"] }, "x")
  assert.deepEqual(v.rubros, ["salon"])
})

test("validación del recargo", () => {
  assert.equal(typeof validarReglaRecargo({ tipo: "porcentaje", valor: 10, rubros: [] }, "x"), "string")
  assert.equal(typeof validarReglaRecargo({ tipo: "monto", valor: -1, rubros: [] }, "x"), "string")
  assert.equal(typeof validarReglaRecargo({ tipo: "porcentaje", valor: 1001, rubros: ["salon"] }, "x"), "string")
  assert.equal(typeof validarReglaRecargo({ tipo: "otro", valor: 1 }, "x"), "string")
  assert.deepEqual(validarReglaRecargo({ tipo: "monto", valor: 500000 }, "x"), { tipo: "monto", valor: 500000, rubros: ["salon"] })
})

test("una sola fecha especial por día y salón (la primera que coincide)", () => {
  const lista = [especial(SABADO, "viernes", ["Casona"]), especial(SABADO, "sabado", ["Quinta"])]
  assert.equal(fechaEspecialDelDia(SABADO, "Quinta", lista).modo, "sabado")
  assert.equal(fechaEspecialDelDia(SABADO, "Salon", lista), null)
})

test("hoy en Argentina: a las 23:30 del 4/10 sigue siendo 4/10 (en UTC ya es 5/10)", () => {
  assert.equal(hoyArgentina(new Date("2026-10-05T02:30:00Z")), "2026-10-04")
})

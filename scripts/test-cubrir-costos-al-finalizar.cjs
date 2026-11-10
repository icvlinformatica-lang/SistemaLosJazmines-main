// "Cubrir los costos" al finalizar un evento (lib/cubrir-costos-al-finalizar.ts).
// Correr: node --test scripts/test-cubrir-costos-al-finalizar.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const root = path.resolve(__dirname, "..")

const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolveFilename.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args)
}
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    })
    module._compile(outputText, filename)
  }
}
const { planCubrirCostos } = require("../lib/cubrir-costos-al-finalizar.ts")

const HOY = "2026-11-10"
const AHORA = "2026-11-10T15:00:00.000Z"
const evento = (extra = {}) => ({
  id: "ev1", nombre: "PRUEBA", nombrePareja: "PRUEBA", salon: "Quinta", fecha: "2026-11-07", fechaAlta: "2026-03-01",
  servicios: [
    { servicioId: "dj", nombre: "DJ", estadoPago: "señado", montoSeña: 90000 },
    { servicioId: "foto", nombre: "FOTO", estadoPago: "sin_seña" },
  ],
  personalEvento: [{ id: "p1", nombre: "Mozo", pagado: false, monto: 0 }],
  ...extra,
})
const costo = (id, tipo, monto, extra = {}) => ({ id, eventoId: "ev1", eventoNombre: "PRUEBA", tipo, monto, servicioNombre: "", ...extra })
const COSTOS = [
  costo("ev1-menu", "menu", 1200000, { servicioNombre: "Menú del evento" }),
  costo("ev1-barra", "barra", 450000.5, { servicioNombre: "Barra" }),
  costo("ev1-dj-saldo", "saldo", 210000, { servicioId: "dj", servicioNombre: "DJ", estadoPago: "señado" }),
  costo("ev1-foto-seña", "seña", 120000, { servicioId: "foto", servicioNombre: "FOTO", estadoPago: "sin_seña" }),
  costo("ev1-foto-saldo", "saldo", 280000, { servicioId: "foto", servicioNombre: "FOTO", estadoPago: "sin_seña" }),
  costo("ev1-sueldo-p1", "sueldo", 35000, { servicioId: "p1", servicioNombre: "Mozo" }),
]
const PREVIOS = [
  { id: "a", tipo: "ingreso", monto: 3000000, cajaDestino: "caja_eventos", concepto: "Cuota 1", salon: "Quinta" },
  { id: "b", tipo: "ingreso", monto: 500000, cajaDestino: "caja_jazmines", concepto: "Cuota 1", salon: "Quinta" },
]

test("paga todo lo pendiente: un egreso por costo y el total en pesos", () => {
  const plan = planCubrirCostos({ evento: evento(), costos: COSTOS, movimientosCaja: PREVIOS, hoy: HOY, ahoraISO: AHORA })
  assert.equal(plan.omitidos.length, 0)
  assert.equal(plan.movimientos.length, 6)
  // 1.200.000 + 450.000,50 + 210.000 + 120.000 + 280.000 + 35.000
  assert.equal(plan.totalPagado, 2295000.5)
  for (const m of plan.movimientos) {
    assert.equal(m.tipo, "egreso")
    assert.equal(m.cajaDestino, "caja_eventos")
    assert.equal(m.eventoId, "ev1")
    assert.equal(m.salon, "Quinta")
  }
  assert.deepEqual(plan.movimientos.map((m) => m.concepto).sort(), [
    "Pago barra - PRUEBA", "Pago menú - PRUEBA", "Pago saldo DJ - PRUEBA", "Pago saldo FOTO - PRUEBA",
    "Pago seña FOTO - PRUEBA", "Pago sueldo Mozo - PRUEBA",
  ])
  // Saldo de Caja Eventos: 3.000.000 − 2.295.000,50 (la caja Jazmines no cuenta)
  assert.equal(plan.movimientos.at(-1).saldoResultante, 704999.5)
})

test("deja el evento con todo pagado (lo mismo que Marcar como pagado)", () => {
  const { cambiosEvento: c } = planCubrirCostos({ evento: evento(), costos: COSTOS, movimientosCaja: PREVIOS, hoy: HOY, ahoraISO: AHORA })
  assert.equal(c.cocinaPagada, true)
  assert.equal(c.barraPagada, true)
  const dj = c.servicios.find((s) => s.servicioId === "dj")
  assert.equal(dj.estadoPago, "pagado_total")
  assert.equal(dj.pagado, true)
  assert.equal(dj.montoSeña, 90000)
  const foto = c.servicios.find((s) => s.servicioId === "foto")
  assert.equal(foto.estadoPago, "pagado_total")
  assert.equal(foto.montoSeña, 120000)
  assert.equal(foto.fechaPagoSeña, HOY)
  assert.equal(foto.fechaPagoSaldo, HOY)
  assert.deepEqual(c.personalEvento, [{ id: "p1", nombre: "Mozo", pagado: true, monto: 35000 }])
})

test("con el candado de señas, la seña y su saldo quedan afuera y se avisan", () => {
  // Alta hace 2 meses y fiesta en 2 meses: la seña todavía no se habilita
  const plan = planCubrirCostos({
    evento: evento({ fechaAlta: "2026-09-10", fecha: "2027-01-20" }),
    costos: COSTOS, movimientosCaja: PREVIOS, hoy: HOY, ahoraISO: AHORA,
  })
  assert.deepEqual(plan.omitidos.map((o) => [o.costo.id, o.motivo]), [
    ["ev1-foto-seña", "seña_con_candado"],
    ["ev1-foto-saldo", "seña_con_candado"],
  ])
  assert.equal(plan.totalPagado, 1895000.5)
  assert.equal(plan.cambiosEvento.servicios.find((s) => s.servicioId === "foto").estadoPago, "sin_seña")
})

test("sin nada pendiente no paga nada ni cambia el evento", () => {
  const plan = planCubrirCostos({ evento: evento(), costos: [], movimientosCaja: PREVIOS, hoy: HOY, ahoraISO: AHORA })
  assert.equal(plan.movimientos.length, 0)
  assert.deepEqual(plan.cambiosEvento, {})
})

test("los compromisos de Finanzas → Personal se devuelven aparte", () => {
  const plan = planCubrirCostos({
    evento: evento(),
    costos: [costo("ev1-compromiso-pp9", "sueldo", 50000, { servicioId: "pp9", servicioNombre: "Seguridad" })],
    movimientosCaja: [], hoy: HOY, ahoraISO: AHORA,
  })
  assert.deepEqual(plan.compromisosPersonal, ["pp9"])
  assert.equal(plan.movimientos.length, 1)
  assert.equal(plan.cambiosEvento.personalEvento, undefined)
})

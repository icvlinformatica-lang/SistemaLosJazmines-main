// La seña que se cobra al crear un evento se anota UNA sola vez, repartida
// entre Caja Eventos y Caja Jazmines (lib/cobrar-cuota.ts → construirSenaInicial).
// Antes también se anotaba entera "sin caja" y los resúmenes la contaban dos veces.
// Correr: node --test scripts/test-sena-inicial.cjs
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

const { construirSenaInicial } = require("../lib/cobrar-cuota.ts")

const FECHA = "2026-10-06T21:13:19.577Z"
const sena = (montoSena, proporcionEventos, movimientosCaja = [], salon = "Quinta") =>
  construirSenaInicial({ salon, montoSena, nombreEvento: "PRUEBA", eventoId: "ev-1", proporcionEventos, movimientosCaja, fecha: FECHA })
const total = (movs) => Math.round(movs.reduce((s, m) => s + m.monto, 0) * 100) / 100

test("caso real del 06/10: seña de $1.875.000 que va entera a Caja Eventos se anota una sola vez", () => {
  const movs = sena(1875000, 1)
  assert.equal(movs.length, 1)
  assert.deepEqual(
    { caja: movs[0].cajaDestino, monto: movs[0].monto, concepto: movs[0].concepto, salon: movs[0].salon, eventoId: movs[0].eventoId, tipo: movs[0].tipo },
    { caja: "caja_eventos", monto: 1875000, concepto: "Seña - PRUEBA (Caja Eventos)", salon: "Quinta", eventoId: "ev-1", tipo: "ingreso" },
  )
  // Lo que suman el resumen diario y el control de comisiones: la seña, no el doble
  assert.equal(total(movs), 1875000)
})

test("seña de $300.000 con 40 % a Eventos: $120.000 a Caja Eventos y $180.000 a Caja Jazmines", () => {
  const movs = sena(300000, 0.4)
  assert.deepEqual(movs.map((m) => [m.cajaDestino, m.monto, m.concepto]), [
    ["caja_eventos", 120000, "Seña - PRUEBA (Caja Eventos)"],
    ["caja_jazmines", 180000, "Seña - PRUEBA (Caja Jazmines)"],
  ])
  assert.equal(total(movs), 300000)
})

test("si el costo no deja nada para Eventos, va entera a Caja Jazmines", () => {
  const movs = sena(300000, 0)
  assert.deepEqual(movs.map((m) => [m.cajaDestino, m.monto]), [["caja_jazmines", 300000]])
})

test("con centavos no se pierde ni se agrega nada: $100.000 en tercios", () => {
  const movs = sena(100000, 1 / 3)
  assert.deepEqual(movs.map((m) => m.monto), [33333.33, 66666.67])
  assert.equal(total(movs), 100000)
})

test("nunca hay una fila sin caja y siempre suma exactamente la seña", () => {
  for (const monto of [1, 99.99, 300000, 1875000, 1234567.89]) {
    for (const p of [0, 0.1, 0.25, 0.4, 0.5, 0.75, 0.9, 1]) {
      const movs = sena(monto, p)
      assert.ok(movs.length >= 1, `${monto} con ${p}`)
      for (const m of movs) {
        assert.ok(m.cajaDestino === "caja_eventos" || m.cajaDestino === "caja_jazmines", `${monto} con ${p}: fila sin caja`)
        assert.ok(m.monto > 0)
      }
      assert.equal(total(movs), monto, `${monto} con ${p}`)
    }
  }
})

test("el saldo que queda anotado sigue la regla de cada caja (Eventos por salón, Jazmines general)", () => {
  const previos = [
    { id: "a", fecha: FECHA, tipo: "ingreso", concepto: "Cuota 1", monto: 500000, salon: "Quinta", cajaDestino: "caja_eventos" },
    { id: "b", fecha: FECHA, tipo: "egreso", concepto: "Pago menú", monto: 200000, salon: "Quinta", cajaDestino: "caja_eventos" },
    { id: "c", fecha: FECHA, tipo: "ingreso", concepto: "Cuota 2", monto: 1000000, salon: "Casona", cajaDestino: "caja_eventos" },
    { id: "d", fecha: FECHA, tipo: "ingreso", concepto: "Cuota 3", monto: 700000, salon: "Casona", cajaDestino: "caja_jazmines" },
    // Una seña vieja "sin caja": no cuenta para ninguna de las dos cajas
    { id: "e", fecha: FECHA, tipo: "ingreso", concepto: "Seña - VIEJA", monto: 999999, salon: "Quinta" },
  ]
  const [eventos, jazmines] = sena(300000, 0.4, previos)
  // Caja Eventos de Quinta: 500.000 − 200.000 + 120.000
  assert.equal(eventos.saldoResultante, 420000)
  // Caja Jazmines (todos los salones): 700.000 + 180.000
  assert.equal(jazmines.saldoResultante, 880000)
})

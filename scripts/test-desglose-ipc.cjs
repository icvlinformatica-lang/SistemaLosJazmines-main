const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")
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
const { reconstruirDesgloseIPC } = require("../lib/desglose-ipc.ts")
const { DesgloseIPCPago } = require("../components/desglose-ipc-pago.tsx")
const ahora = Date.parse("2026-09-11T00:00:00Z")
const registro = (mes, porcentaje, anio = 2026) => ({ mes, anio, porcentaje, fechaAplicacion: `${anio}-${String(mes + 1).padStart(2, "0")}-10T00:00:00Z`, eventosActualizados: 1 })
const historial = [registro(5, 1.9), registro(6, 1.9), registro(7, 2.1), registro(8, 1.7)]

test("caso Ángeles: no atribuye a julio/agosto aumentos que no concilian con la base", () => {
  const pasos = reconstruirDesgloseIPC(647465, 658472, historial, ahora)
  assert.deepEqual(pasos, [{ mes: 8, anio: 2026, porcentaje: 1.7, montoAnterior: 647465, incremento: 11007, montoAjustado: 658472 }])
})

test("compone cada mes sobre el anterior y respeta el redondeo a pesos", () => {
  const registros = [registro(6, 1.9), registro(7, 2.1), registro(8, 1.7)]
  const monto = registros.reduce((base, h) => Math.round(base * (1 + h.porcentaje / 100)), 100003)
  const pasos = reconstruirDesgloseIPC(100003, monto, registros, ahora)
  assert.equal(pasos.length, 3)
  assert.equal(pasos[1].montoAnterior, pasos[0].montoAjustado)
  assert.equal(pasos[2].montoAnterior, pasos[1].montoAjustado)
  assert.equal(pasos.reduce((s, p) => s + p.incremento, 0), monto - 100003)
})

test("no inventa meses si el importe no concilia, falta base o no hay aumento", () => {
  for (const [base, actual] of [[100, 190], [0, 100], [100, 100], [100, 90], [NaN, 100], [100, Infinity]]) {
    assert.deepEqual(reconstruirDesgloseIPC(base, actual, historial, ahora), [])
  }
  assert.deepEqual(reconstruirDesgloseIPC(100, 102, [], ahora), [])
})

test("ignora IPC futuros y no modifica el historial recibido", () => {
  const registros = [registro(9, 8), registro(8, 1.7)]
  const original = structuredClone(registros)
  assert.equal(reconstruirDesgloseIPC(647465, 658472, registros, ahora).length, 1)
  assert.deepEqual(registros, original)
})

test("no elige entre reconstrucciones ambiguas ni meses duplicados", () => {
  assert.deepEqual(reconstruirDesgloseIPC(100, 102, [registro(7, 0), registro(8, 2)], ahora), [])
  assert.deepEqual(reconstruirDesgloseIPC(100, 104, [registro(8, 2), registro(8, 2)], ahora), [])
})

test("ordena cambios de año sin sumar porcentajes de forma simple", () => {
  const registros = [registro(0, 10), registro(11, 10, 2025)]
  assert.deepEqual(reconstruirDesgloseIPC(100, 121, registros, ahora).map(p => p.montoAjustado), [110, 121])
})

const props = { montoBase: 647465, montoCuota: 658472, ajustaPorIPC: true, historialIPC: historial, diasAtraso: 2, recargoPorDia: 3000, recargoOmitido: false }
const render = (overrides = {}) => renderToStaticMarkup(React.createElement(DesgloseIPCPago, { ...props, ...overrides }))

test("muestra incremento, cuota vigente y atraso sin capitalizarlo", () => {
  const html = render()
  assert.match(html, /11\.007/)
  assert.match(html, /658\.472/)
  assert.match(html, /664\.472/)
  assert.match(html, /6\.000/)
  assert.match(html, /Detalle reconstruido, no historial confirmado/)
  assert.match(html, /Septiembre 2026/)
  assert.doesNotMatch(html, /Julio 2026/)
})

test("quitar atraso deja el importe de cuota intacto", () => {
  const html = render({ recargoOmitido: true })
  assert.match(html, /\(quitado\)/)
  assert.doesNotMatch(html, /664\.472/)
  assert.match(html, /658\.472/)
})

test("cuotas fijas no se presentan como ajustadas por IPC", () => {
  const html = render({ ajustaPorIPC: false })
  assert.match(html, /no está marcado como ajustable/)
  assert.doesNotMatch(html, /IPC acumulado sobre la base/)
  assert.doesNotMatch(html, /Septiembre 2026/)
})

test("falta de base se informa sin reemplazarla silenciosamente por el monto actual", () => {
  const html = render({ montoBase: 0 })
  assert.match(html, /No disponible/)
  assert.match(html, /Desglose mensual no disponible/)
  assert.doesNotMatch(html, /NaN|Infinity/)
})

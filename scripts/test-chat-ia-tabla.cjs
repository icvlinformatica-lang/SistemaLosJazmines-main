// Tabla de cantidad de eventos por salón y mes del chat con IA: la arma el
// servidor con los eventos de la base. Datos inventados.
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith("@/") ? path.join(__dirname, "..", request.slice(2)) : request, ...args)
}
require.extensions[".ts"] = (mod, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  mod._compile(result.outputText, filename)
}
const { tablaEventosPorSalonYMes, tablasValidas, periodoTablaValido, nombreMes } = require("../lib/chat-ia-tabla.ts")

const ev = (fecha, salon, estado = "pendiente") => ({ id: `${salon}-${fecha}`, fecha, salon, estado })
const EVENTOS = [
  ev("2026-10-15", "Casona"), // antes del período
  ev("2026-10-16", "Casona"),
  ev("2026-10-24", "Casona"),
  ev("2026-11-07", "Casona", "borrador"),
  ev("2026-11-14", "Salon"),
  ev("2026-12-31", "Quinta"),
  ev("2027-01-02", "Quinta"), // después
]

test("cuenta por salón y por mes, con totales, sin salones vacíos", () => {
  const t = tablaEventosPorSalonYMes(EVENTOS, { desde: "2026-10-16", hasta: "2026-12-31" })
  assert.deepEqual(t.meses, ["2026-10", "2026-11", "2026-12"])
  assert.deepEqual(t.filas, [
    { salon: "Quinta", porMes: [0, 0, 1], total: 1 },
    { salon: "Casona", porMes: [2, 1, 0], total: 3 },
    { salon: "Salon", porMes: [0, 1, 0], total: 1 },
  ])
  assert.deepEqual(t.totalPorMes, [2, 2, 1])
  assert.equal(t.total, 5)
  assert.equal(t.borradores, 1)
})

test("un solo salón, y un salón que no está en la lista igual aparece", () => {
  assert.equal(tablaEventosPorSalonYMes(EVENTOS, { desde: "2026-10-16", hasta: "2026-12-31", salon: "Casona" }).total, 3)
  const t = tablaEventosPorSalonYMes([...EVENTOS, ev("2026-11-01", "Terraza")], { desde: "2026-10-16", hasta: "2026-12-31" })
  assert.equal(t.filas.at(-1).salon, "Terraza")
})

test("períodos que cruzan el año y límites", () => {
  assert.deepEqual(tablaEventosPorSalonYMes(EVENTOS, { desde: "2026-12-01", hasta: "2027-01-31" }).meses, ["2026-12", "2027-01"])
  assert.equal(periodoTablaValido("2026-10-16", "2026-12-31"), null)
  assert.match(periodoTablaValido("2026-12-31", "2026-10-16"), /anterior/)
  assert.match(periodoTablaValido("2026-01-01", "2027-03-01"), /13 meses/)
  assert.equal(nombreMes("2026-10"), "Octubre 2026")
})

test("lo guardado en el historial se lee solo si tiene la forma esperada", () => {
  const t = tablaEventosPorSalonYMes(EVENTOS, { desde: "2026-10-16", hasta: "2026-12-31" })
  assert.deepEqual(tablasValidas(JSON.parse(JSON.stringify([t]))), [t])
  assert.deepEqual(tablasValidas([{ ...t, filas: [{ salon: "Casona", porMes: [1], total: 1 }] }]), [])
  assert.deepEqual(tablasValidas("nada"), [])
  assert.equal(tablasValidas([t, t, t]).length, 2)
})

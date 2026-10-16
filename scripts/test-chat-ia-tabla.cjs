// Tablas del chat con IA: las arma el servidor con los datos de la base
// (eventos por salón, mes, estado o tipo; actividad por persona, tema o día).
// Datos inventados.
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
const { tablaEventos, tablaActividad, armarTabla, tablasValidas, periodoTablaValido, nombreMes, MAX_FILAS_TABLA } = require("../lib/chat-ia-tabla.ts")

const ev = (fecha, salon, extra = {}) => ({ fecha, salon, estado: "pendiente", tipo: "Casamiento", invitados: 100, total: 1000000, cobrado: 400000, saldo: 600000, atrasado: 0, ...extra })
const EVENTOS = [
  ev("2026-10-15", "Casona"), // antes del período
  ev("2026-10-16", "Casona"),
  ev("2026-10-24", "Casona", { tipo: "15 años", invitados: 80 }),
  ev("2026-11-07", "Casona", { estado: "borrador", total: 0, cobrado: 0, saldo: 0 }),
  ev("2026-11-14", "Salon", { tipo: "casamiento", atrasado: 175000.5 }),
  ev("2026-12-31", "Quinta"),
  ev("2027-01-02", "Quinta"), // después
]
const P = { desde: "2026-10-16", hasta: "2026-12-31" }

test("cantidad por salón y mes: salones en su orden, meses aunque den cero, totales", () => {
  const t = tablaEventos(EVENTOS, { ...P, filas: "salon", columnas: "mes", medida: "cantidad" })
  assert.equal(t.titulo, "Cantidad de eventos por salón y mes")
  assert.equal(t.subtitulo, "Eventos del 16/10/2026 al 31/12/2026")
  assert.deepEqual(t.columnas, [{ clave: "2026-10", etiqueta: "Oct" }, { clave: "2026-11", etiqueta: "Nov" }, { clave: "2026-12", etiqueta: "Dic" }])
  assert.deepEqual(t.filas.map((f) => [f.clave, f.valores, f.total]), [
    ["Quinta", [0, 0, 1], 1],
    ["Casona", [2, 1, 0], 3],
    ["Salon", [0, 1, 0], 1],
  ])
  assert.equal(t.filas[2].etiqueta, "Salón")
  assert.deepEqual(t.totalPorColumna, [2, 2, 1])
  assert.equal(t.total, 5)
  assert.match(t.nota, /1 borrador/)
  assert.equal(t.formato, "numero")
})

test("plata: falta cobrar por salón, con centavos, y avisa los que no tienen precio", () => {
  const t = tablaEventos(EVENTOS, { ...P, filas: "salon", columnas: null, medida: "saldo" })
  assert.equal(t.formato, "pesos")
  assert.deepEqual(t.columnas, [])
  assert.deepEqual(t.filas.map((f) => [f.clave, f.total]), [["Quinta", 600000], ["Casona", 1200000], ["Salon", 600000]])
  assert.equal(t.total, 2400000)
  assert.match(t.nota, /1 evento no tiene precio cargado/)
  assert.equal(tablaEventos(EVENTOS, { ...P, filas: "mes", columnas: null, medida: "atrasado" }).total, 175000.5)
})

test("por tipo (sin importar mayúsculas) y por estado; un solo salón", () => {
  const tipo = tablaEventos(EVENTOS, { ...P, filas: "tipo", columnas: null, medida: "cantidad" })
  assert.deepEqual(tipo.filas.map((f) => [f.etiqueta, f.total]), [["Casamiento", 4], ["15 años", 1]])
  const estado = tablaEventos(EVENTOS, { ...P, filas: "estado", columnas: "salon", medida: "cantidad" })
  assert.deepEqual(estado.filas.map((f) => f.etiqueta), ["Borrador", "Pendiente"])
  assert.equal(estado.nota, undefined)
  assert.equal(tablaEventos(EVENTOS, { ...P, filas: "mes", columnas: null, medida: "invitados", salon: "Casona" }).total, 280)
})

test("muchas filas sin orden propio se juntan en 'Otros'; los meses no", () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ k: `t${String(i).padStart(2, "0")}`, v: 20 - i }))
  const t = armarTabla(items, {
    filas: { por: "tipo", titulo: "Tipo", clave: (x) => x.k, etiqueta: (c) => c },
    valor: (x) => x.v,
    formato: "numero",
    titulo: "x",
    subtitulo: "y",
  })
  assert.equal(t.filas.length, MAX_FILAS_TABLA)
  assert.equal(t.filas.at(-1).etiqueta, "Otros (6)")
  assert.equal(t.total, 210)
  assert.equal(t.filas.reduce((s, f) => s + f.total, 0), 210)
})

test("actividad por persona y tema, y por día con los días vacíos", () => {
  const regs = [
    { dia: "2026-10-14", quien: "Leila", tipo: "Insumo de barra" },
    { dia: "2026-10-14", quien: "Leila", tipo: "Insumo de barra" },
    { dia: "2026-10-16", quien: "Soporte", tipo: "Caja" },
    { dia: "2026-10-16", quien: "Sin dato de quién", tipo: "Caja" },
  ]
  const t = tablaActividad(regs, { desde: "2026-10-14", hasta: "2026-10-16", filas: "persona", columnas: "tema" })
  assert.deepEqual(t.filas.map((f) => [f.etiqueta, f.valores, f.total]), [["Leila", [0, 2], 2], ["Soporte", [1, 0], 1], ["Sin dato de quién", [1, 0], 1]])
  assert.deepEqual(t.columnas.map((c) => c.etiqueta), ["Caja", "Insumo de barra"])
  assert.match(t.nota, /no guarda el perfil/)
  const dias = tablaActividad(regs, { desde: "2026-10-14", hasta: "2026-10-16", filas: "dia", columnas: null })
  assert.deepEqual(dias.filas.map((f) => [f.etiqueta, f.total]), [["14/10", 2], ["15/10", 0], ["16/10", 2]])
})

test("período y lectura del historial", () => {
  assert.equal(periodoTablaValido("2026-10-16", "2026-12-31"), null)
  assert.match(periodoTablaValido("2026-12-31", "2026-10-16"), /anterior/)
  assert.match(periodoTablaValido("2026-01-01", "2027-03-01"), /13 meses/)
  assert.equal(nombreMes("2026-10"), "Octubre 2026")
  assert.deepEqual(tablaEventos(EVENTOS, { desde: "2026-12-01", hasta: "2027-01-31", filas: "mes", columnas: null, medida: "cantidad" }).filas.map((f) => f.etiqueta), ["Dic 26", "Ene 27"])
  const t = tablaEventos(EVENTOS, { ...P, filas: "salon", columnas: "mes", medida: "cantidad" })
  assert.deepEqual(tablasValidas(JSON.parse(JSON.stringify([t]))), [t])
  assert.deepEqual(tablasValidas([{ ...t, filas: [{ clave: "Casona", etiqueta: "Casona", valores: [1], total: 1 }] }]), [])
  assert.deepEqual(tablasValidas("nada"), [])
  assert.equal(tablasValidas([t, t, t]).length, 2)
})

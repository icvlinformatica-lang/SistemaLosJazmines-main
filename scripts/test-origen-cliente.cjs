// "¿Cómo nos conoció?" y "Ya fue cliente". Correr: node --test scripts/test-origen-cliente.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(out.outputText, filename)
}
const o = require("../lib/origen-cliente.ts")

test("origen: solo valores conocidos", () => {
  assert.equal(o.normalizarOrigen("instagram"), "instagram")
  assert.equal(o.normalizarOrigen("tiktok"), null)
  assert.equal(o.normalizarOrigen(""), null)
  assert.equal(o.etiquetaOrigen("paso_por_salon"), "Pasó por el salón")
  assert.equal(o.etiquetaOrigen(null), "Sin dato")
})

test("conteo por origen: de más a menos y Sin dato al final", () => {
  const filas = [
    { origen: "instagram", fecha: "2026-10-01" },
    { origen: "instagram", fecha: "2026-10-05" },
    { origen: null, fecha: "2026-10-02" },
    { origen: null, fecha: "2026-10-03" },
    { origen: null, fecha: "2026-10-04" },
    { origen: "recomendacion", fecha: "2026-09-20" },
    { origen: "basura", fecha: "2026-10-06" },
  ]
  assert.deepEqual(o.contarPorOrigen(filas).map((c) => [c.origen, c.cantidad]), [
    ["instagram", 2], ["recomendacion", 1], ["sin_dato", 4],
  ])
  assert.deepEqual(o.contarPorOrigen(filas, "2026-09").map((c) => [c.etiqueta, c.cantidad]), [["Recomendación", 1]])
  assert.deepEqual(o.mesesConDatos(filas), ["2026-10", "2026-09"])
})

test("claves: DNI y teléfono escritos de distintas formas coinciden", () => {
  assert.equal(o.claveDni("30.123.456"), "30123456")
  assert.equal(o.claveDni("123"), null)
  assert.equal(o.claveTelefono("011 4444-5555"), o.claveTelefono("+54 9 11 4444 5555"))
  assert.equal(o.claveTelefono("15-4444-5555"), "44445555")
  assert.equal(o.claveTelefono("4444"), null)
})

const eventos = [
  { id: "e1", nombre: "Ana y Juan", fecha: "2026-03-14", salon: "Casona", tipoEvento: "Casamiento", dnis: ["30.123.456", null], telefono: "11 4444 5555" },
  { id: "e2", nombre: "Bautismo de Lola", fecha: "2027-05-02", salon: "Quinta", tipoEvento: "Bautismo", dnis: [null, "30123456"], telefono: "" },
  { id: "e3", nombre: "Otro", fecha: "2026-08-01", salon: "Salon", tipoEvento: "Cumpleaños", dnis: ["99888777"], telefono: "+54 9 11 4444-5555" },
  { id: "e4", nombre: "Nada que ver", fecha: "2026-09-01", salon: "Salon", tipoEvento: "Cumpleaños", dnis: ["11222333"], telefono: "221 555 6666" },
]

test("ya fue cliente: por DNI (en cualquiera de los DNI del evento) o por teléfono", () => {
  const r = o.buscarEventosDelCliente(eventos, { dni: "30123456", telefono: "1144445555" })
  assert.deepEqual(r.map((e) => [e.id, e.coincide]), [["e2", "dni"], ["e3", "telefono"], ["e1", "dni"]])
})

test("ya fue cliente: no se cuenta a sí mismo, y sin datos no busca", () => {
  const r = o.buscarEventosDelCliente(eventos, { dni: "30123456", excluirId: "e1" })
  assert.deepEqual(r.map((e) => e.id), ["e2"])
  assert.deepEqual(o.buscarEventosDelCliente(eventos, { dni: "12", telefono: "55" }), [])
  assert.deepEqual(o.buscarEventosDelCliente(eventos, {}), [])
})

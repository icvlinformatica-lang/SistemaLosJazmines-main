const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

const archivo = path.resolve(__dirname, "../lib/volver-desde-costos.ts")
const { outputText } = ts.transpileModule(fs.readFileSync(archivo, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const mod = { exports: {} }
new Function("module", "exports", outputText)(mod, mod.exports)
const { urlCostosDesdeCaja, destinoVolverCostos, mesDesdeUrl } = mod.exports

test("desde Caja de eventos, la dirección de costos lleva el origen y el mes", () => {
  assert.equal(
    urlCostosDesdeCaja("ev-1", new Date(2026, 10, 1)),
    "/eventos/costos?id=ev-1&from=caja-eventos&mes=2026-11",
  )
})

test("la flecha vuelve a Caja de eventos en el mismo mes", () => {
  assert.deepEqual(destinoVolverCostos("caja-eventos", "2026-11"), {
    href: "/finanzas/caja-eventos?mes=2026-11",
    etiqueta: "Volver a Caja de eventos",
  })
  assert.equal(destinoVolverCostos("caja-eventos", "basura").href, "/finanzas/caja-eventos")
  assert.equal(destinoVolverCostos("caja-eventos", null).href, "/finanzas/caja-eventos")
})

test("desde cualquier otro lugar sigue volviendo a la lista de eventos", () => {
  assert.equal(destinoVolverCostos(null, null).href, "/eventos/lista")
  assert.equal(destinoVolverCostos("contratos", "2026-11").href, "/eventos/lista")
})

test("el mes de la dirección se valida", () => {
  assert.equal(mesDesdeUrl("2026-13"), null)
  assert.equal(mesDesdeUrl("2026-00"), null)
  assert.equal(mesDesdeUrl("26-1"), null)
  const d = mesDesdeUrl("2027-01")
  assert.equal(d.getFullYear(), 2027)
  assert.equal(d.getMonth(), 0)
  assert.equal(d.getDate(), 1)
})

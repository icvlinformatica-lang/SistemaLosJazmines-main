const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

const archivo = path.resolve(__dirname, "../lib/volver-atras.ts")
const { outputText } = ts.transpileModule(fs.readFileSync(archivo, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const mod = { exports: {} }
new Function("module", "exports", outputText)(mod, mod.exports)
const { puedeVolverAtras, pasosParaVolver } = mod.exports

const ORIGEN = "https://jazmines.example"
const nav = (urls, actual = urls.length - 1) => ({
  canGoBack: actual > 0,
  currentEntry: { url: urls[actual], index: actual },
  entries: () => urls.map((url, index) => ({ url, index })),
})

test("vuelve atrás si la pantalla anterior es del sistema", () => {
  assert.equal(puedeVolverAtras(nav([`${ORIGEN}/finanzas/caja-eventos`, `${ORIGEN}/eventos/costos?id=1`]), ORIGEN), true)
})

test("no vuelve atrás si se entró directo (sin historial)", () => {
  assert.equal(puedeVolverAtras(nav([`${ORIGEN}/eventos/costos?id=1`]), ORIGEN), false)
})

test("no vuelve atrás al login", () => {
  assert.equal(puedeVolverAtras(nav([`${ORIGEN}/login`, `${ORIGEN}/`]), ORIGEN), false)
})

test("no vuelve atrás a otra web", () => {
  assert.equal(
    puedeVolverAtras(nav([`https://otra.example/x`, `${ORIGEN}/eventos/lista`]), ORIGEN),
    false,
  )
  assert.equal(puedeVolverAtras({ canGoBack: true, currentEntry: { url: `${ORIGEN}/x`, index: 1 }, entries: () => [] }, ORIGEN), false)
})

test("sin Navigation API la flecha va a la pantalla fija", () => {
  assert.equal(puedeVolverAtras(null, ORIGEN), false)
  assert.equal(puedeVolverAtras({}, ORIGEN), false)
})

test("toma la entrada justo anterior a la actual", () => {
  const n = nav([`https://otra.example/`, `${ORIGEN}/eventos/lista`, `${ORIGEN}/evento?id=1`, `${ORIGEN}/x`], 2)
  assert.equal(puedeVolverAtras(n, ORIGEN), true)
})

test("después de actualizar un contrato, la flecha de Contratos vuelve a la Lista", () => {
  // Lista → Contratos → (planificador, reemplazado al guardar) → Contratos con el evento elegido
  const n = nav([`${ORIGEN}/eventos/lista`, `${ORIGEN}/eventos/contratos`, `${ORIGEN}/eventos/contratos?eventoId=1`])
  assert.equal(pasosParaVolver(n, ORIGEN), 2)
})

test("una sola entrada atrás de otra pantalla: un paso", () => {
  assert.equal(pasosParaVolver(nav([`${ORIGEN}/eventos/lista`, `${ORIGEN}/evento?id=1`]), ORIGEN), 1)
})

test("si atrás solo hay la misma pantalla, no vuelve", () => {
  const n = nav([`${ORIGEN}/eventos/contratos`, `${ORIGEN}/eventos/contratos?eventoId=1`])
  assert.equal(pasosParaVolver(n, ORIGEN), 0)
  assert.equal(puedeVolverAtras(n, ORIGEN), false)
})

test("no saltea el login ni otros sitios", () => {
  assert.equal(pasosParaVolver(nav([`${ORIGEN}/login`, `${ORIGEN}/eventos/contratos`, `${ORIGEN}/eventos/contratos?eventoId=1`]), ORIGEN), 0)
  assert.equal(pasosParaVolver(nav([`https://otra.example/`, `${ORIGEN}/eventos/contratos`, `${ORIGEN}/eventos/contratos?eventoId=1`]), ORIGEN), 0)
})

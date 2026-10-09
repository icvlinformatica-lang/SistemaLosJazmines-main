// Aviso "Falta: …" de los eventos que vienen de una cotización aprobada.
// Correr: node --test scripts/test-faltantes-evento.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(out.outputText, filename)
}
const { faltantesEvento, textoFaltantes, faltantesContrato, faltantesCotizacion } = require("../lib/faltantes-evento.ts")

// Evento completo: contrato, plan, servicios, menú y barra.
const completo = () => ({
  contrato: { nombreCompleto: "PRUEBA Cliente", dni: "11111111", telefono: "1100000000", direccion: "Calle 1", vendedor: "Vendedor" },
  planDeCuotas: { montoTotal: 1500000 },
  servicios: [{ servicioId: "s1" }],
  recetasAdultos: ["r1"],
  recetasAdolescentes: [],
  recetasNinos: ["r1"],
  recetasDietasEspeciales: [],
  barras: [{ coctelesIncluidos: ["c1"] }],
})

test("evento completo: no falta nada", () => {
  assert.deepEqual(faltantesEvento(completo()), [])
  assert.equal(textoFaltantes([]), null)
})

test("recién aprobado desde la cotización: falta dirección y plan de pagos", () => {
  // Lo que arma /aprobar: nombre, DNI, teléfono y vendedor, sin dirección ni plan.
  const e = completo()
  delete e.contrato.direccion
  delete e.planDeCuotas
  assert.deepEqual(faltantesEvento(e), ["contrato", "plan de pagos"])
  assert.equal(textoFaltantes(faltantesEvento(e)), "Falta: contrato, plan de pagos")
  assert.deepEqual(faltantesContrato(e.contrato), ["dirección"])
})

test("barra clásica sin cócteles, sin servicios ni menú", () => {
  const e = completo()
  e.servicios = []
  e.recetasAdultos = []
  e.recetasNinos = []
  e.barras = [{ coctelesIncluidos: [] }]
  assert.deepEqual(faltantesEvento(e), ["servicios", "menú", "barra"])
})

test("datos vacíos o con espacios cuentan como faltantes", () => {
  const e = completo()
  e.contrato = { nombreCompleto: "  ", dni: "", telefono: "1", direccion: "x", vendedor: "v" }
  assert.deepEqual(faltantesContrato(e.contrato), ["nombre completo", "DNI"])
  assert.deepEqual(faltantesEvento(e), ["contrato"])
})

test("plan en $0 o sin contrato: faltan", () => {
  const e = completo()
  e.planDeCuotas = { montoTotal: 0 }
  e.contrato = undefined
  assert.deepEqual(faltantesEvento(e), ["contrato", "plan de pagos"])
  assert.deepEqual(faltantesContrato(undefined), ["nombre completo", "DNI", "teléfono", "dirección", "vendedor"])
})

test("evento vacío (campos nulos) no rompe", () => {
  assert.deepEqual(faltantesEvento({ barras: [null], servicios: null }), ["contrato", "plan de pagos", "servicios", "menú", "barra"])
})

// Antes de aprobar: lo que le va a faltar al evento (bandeja de cotizaciones).
test("cotización nueva completa: solo faltan la dirección (contrato) y el plan de pagos", () => {
  const f = faltantesCotizacion({
    serviciosElegidos: {
      version: 2,
      recetas: { adultos: ["r1", "r2", "r3"] },
      servicios: [{ servicioId: "dj" }],
      barras: [{ tipo: "armada", barraTemplateId: "b1", cocteles: ["c1"] }],
    },
    clienteNombre: "PRUEBA Cliente",
    clienteDni: "1",
    clienteTelefono: "11",
  })
  assert.deepEqual(f, ["contrato", "plan de pagos"])
})

test("cotización a medias: sin menú, sin barra y solo la línea de barra personalizada vacía", () => {
  const f = faltantesCotizacion({
    serviciosElegidos: {
      version: 2,
      recetas: { adultos: [] },
      servicios: [{ servicioId: "barra-personalizada" }],
      barra: { tipo: "personalizada", cocteles: [] },
    },
    clienteNombre: "PRUEBA",
    clienteTelefono: "11",
  })
  assert.deepEqual(f, ["contrato", "plan de pagos", "servicios", "menú", "barra"])
})

test("cotización vieja (sin version): menú de niños y barra personalizada cuentan", () => {
  const f = faltantesCotizacion({
    serviciosElegidos: {
      recetas: { ninos: ["r1"] },
      servicios: [{ servicioId: "dj" }],
      barra: { tipo: "personalizada", cocteles: ["c1"] },
    },
    clienteNombre: "PRUEBA",
    clienteTelefono: "11",
  })
  assert.deepEqual(f, ["contrato", "plan de pagos"])
})

test("cotización vacía no rompe", () => {
  assert.deepEqual(faltantesCotizacion({ serviciosElegidos: null }), ["contrato", "plan de pagos", "servicios", "menú", "barra"])
})

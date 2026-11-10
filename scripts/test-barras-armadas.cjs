// Barras armadas en Cócteles y en el planificador (pedido de Rodrigo,
// 10/11/2026, lib/barras-armadas.ts). Elegir una barra en el planificador es
// solo un atajo para tildar sus cócteles: no cambia ninguna cuenta. Acá se
// prueba eso: mismos cócteles = mismo costo de barra (calcularComprasBarras).
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const resolver = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolver.call(this, request.startsWith("@/") ? path.join(__dirname, "..", request.slice(2)) : request, ...args)
}
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

const {
  salonesDelCotizador,
  estadoCotizadorBarra,
  barrasParaPlanificador,
  coctelesAlElegirBarra,
  barraTemplateTrasCambio,
  coctelesExtra,
} = require("../lib/barras-armadas.ts")

const carta = ["mojito", "daiquiri", "limonada", "fernet"]
const canchera = { id: "b1", nombre: "Barra canchera", coctelesIncluidos: ["mojito", "limonada"], enPlanificador: true }
const loca = { id: "b2", nombre: "Barra loca", coctelesIncluidos: ["fernet", "borrado"], enPlanificador: true }
const pupu = { id: "b3", nombre: "pupu", coctelesIncluidos: ["daiquiri"], enPlanificador: false }
const fantasma = { id: "b4", nombre: "Fantasma", coctelesIncluidos: ["borrado"], enPlanificador: true }

test("salones del cotizador: solo los que tienen costo de salón", () => {
  assert.deepEqual(
    salonesDelCotizador([
      { salon: "Casona", costoSalon: 4000000 },
      { salon: "Quinta", costoSalon: 3000000 },
      { salon: "Salon", costoSalon: 2500000 },
      { salon: "Salon 4", costoSalon: 0 },
    ]),
    ["Casona", "Quinta", "Salon"],
  )
})

test("estado en el cotizador: todos, algunos o ninguno", () => {
  const salones = ["Casona", "Quinta", "Salon"]
  const filas = [
    { salon: "Casona", barraTemplateId: "b1" },
    { salon: "Quinta", barraTemplateId: "b1" },
    { salon: "Salon", barraTemplateId: "b1" },
    { salon: "Quinta", barraTemplateId: "b2" },
    { salon: "Salon", barraTemplateId: "b2" },
    { salon: "Salon 4", barraTemplateId: "b3" },
  ]
  assert.deepEqual(estadoCotizadorBarra("b1", filas, salones), { enSalones: salones, enTodos: true, enAlguno: true })
  assert.deepEqual(estadoCotizadorBarra("b2", filas, salones), { enSalones: ["Quinta", "Salon"], enTodos: false, enAlguno: true })
  // Un salón que no se cotiza no cuenta.
  assert.deepEqual(estadoCotizadorBarra("b3", filas, salones), { enSalones: [], enTodos: false, enAlguno: false })
  assert.equal(estadoCotizadorBarra("b1", filas, []).enTodos, false)
})

test("el planificador ofrece solo las marcadas y con algún cóctel vigente", () => {
  const r = barrasParaPlanificador([loca, pupu, canchera, fantasma], carta)
  assert.deepEqual(r.map((b) => b.id), ["b1", "b2"])
})

test("elegir una barra tilda sus cócteles y saca los borrados", () => {
  assert.deepEqual(coctelesAlElegirBarra(canchera, carta), ["mojito", "limonada"])
  assert.deepEqual(coctelesAlElegirBarra(loca, carta), ["fernet"])
  assert.deepEqual(coctelesAlElegirBarra({ ...canchera, coctelesIncluidos: ["mojito", "mojito"] }, carta), ["mojito"])
})

test("sumar sueltos mantiene la barra; sacar uno de la barra la convierte en barra a medida", () => {
  const barras = [canchera, loca]
  assert.equal(barraTemplateTrasCambio("b1", ["mojito", "limonada", "fernet"], barras, carta), "b1")
  assert.equal(barraTemplateTrasCambio("b1", ["mojito", "fernet"], barras, carta), "")
  // Un cóctel borrado de la carta no obliga a tenerlo.
  assert.equal(barraTemplateTrasCambio("b2", ["fernet"], barras, carta), "b2")
  // Sin barra elegida sigue sin barra.
  assert.equal(barraTemplateTrasCambio("", ["mojito", "limonada"], barras, carta), "")
  // Si la plantilla no está cargada, no se toca.
  assert.equal(barraTemplateTrasCambio("zz", ["mojito"], barras, carta), "zz")
})

test("cócteles extra: los que no son de la barra", () => {
  assert.deepEqual(coctelesExtra(canchera, ["mojito", "limonada", "fernet"]), ["fernet"])
  assert.deepEqual(coctelesExtra(undefined, ["mojito"]), [])
})

// La parte importante: elegir la barra o tildar los mismos cócteles a mano da
// exactamente el mismo costo, por adulto y por adolescente/niño.
test("mismo costo de barra eligiendo la barra que tildando a mano", () => {
  const { calcularComprasBarras } = require("../lib/store.ts")
  const insumosBarra = [
    { id: "ron", codigo: "B1", descripcion: "Ron", unidad: "CC", stockActual: 0, precioUnitario: 10, categoria: "Bebidas" },
    { id: "limon", codigo: "B2", descripcion: "Jugo de limón", unidad: "CC", stockActual: 0, precioUnitario: 2, categoria: "Bebidas" },
  ]
  const cocteles = [
    { id: "mojito", nombre: "Mojito", categoria: "Con Alcohol", insumos: [{ insumoBarraId: "ron", cantidadPorCoctel: 50, unidadCoctel: "CC" }] },
    { id: "limonada", nombre: "Limonada", categoria: "Sin Alcohol", insumos: [{ insumoBarraId: "limon", cantidadPorCoctel: 100, unidadCoctel: "CC" }] },
  ]
  const base = { adultos: 100, adolescentes: 10, ninos: 5 }
  const aMano = { ...base, barras: [{ id: "x", barraTemplateId: "", coctelesIncluidos: ["mojito", "limonada"], tragosPorPersona: 2 }] }
  const conBarra = {
    ...base,
    barras: [{ id: "x", barraTemplateId: "b1", coctelesIncluidos: coctelesAlElegirBarra(canchera, ["mojito", "limonada"]), tragosPorPersona: 2 }],
  }
  const costo = (ev) => calcularComprasBarras(ev, cocteles, insumosBarra).reduce((s, c) => s + c.costoMateriaPrima, 0)
  // Mojito: 100 adultos × 50 cc × $10 = $50.000. Limonada: 15 chicos × 100 cc × $2 = $3.000.
  assert.equal(costo(aMano), 53000)
  assert.equal(costo(conBarra), 53000)
})

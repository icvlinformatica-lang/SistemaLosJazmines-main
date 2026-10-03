// Cotizador por salón (modelo costo + ganancia): cuentas de los 5 rubros.
// Correr: node --test scripts/test-cotizador-salon.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(out.outputText, filename)
}
const {
  SALONES_COTIZADOR,
  esSalonCotizador,
  precioConGanancia,
  precioCocina,
  precioBarraSalon,
  cantidadPersonal,
  tarifaMasAlta,
  tarifaDeRegla,
  simularPersonal,
} = require("../lib/cotizador-salon.ts")

const mozo = { funcion: "Mozo", cadaNInvitados: 20, minimo: 2, tarifa: 50000, ganancia: 30, aplica: "siempre" }
const portero = { funcion: "Puerta", cadaNInvitados: 0, minimo: 1, tarifa: 42000, ganancia: 0, aplica: "siempre" }

test("la lista de salones es la misma que SALONES de lib/store.ts", () => {
  const fuente = fs.readFileSync(path.join(__dirname, "../lib/store.ts"), "utf8")
  const m = fuente.match(/export const SALONES = (\[[^\]]*\])/)
  assert.ok(m, "no se encontró SALONES en lib/store.ts")
  assert.deepEqual([...SALONES_COTIZADOR], JSON.parse(m[1]))
  assert.equal(esSalonCotizador("Quinta"), true)
  assert.equal(esSalonCotizador("Multiespacio Beruti"), false)
})

test("salón: costo 1.000.000 + 50 % → 1.500.000", () => {
  assert.equal(precioConGanancia(1000000, 50), 1500000)
  assert.equal(precioConGanancia(1000000, 0), 1000000)
})

test("cocina: porción $3.000 + 50 %, 80 comensales → $360.000", () => {
  assert.equal(precioCocina(3000, 50, 80), 360000)
  assert.equal(precioCocina(0, 50, 80), 0)
})

test("barra: cócteles a $1.000 / $1.500 / $2.000 + 50 %, 70 adultos → $472.500", () => {
  const costos = { a: 1000, b: 1500, c: 2000 }
  const barra = precioBarraSalon(["a", "b", "c"], costos, 50)
  assert.equal(barra.tragosPorAdulto, 3)
  assert.equal(barra.precioPorAdulto, 6750)
  assert.equal(barra.precioPorAdulto * 70, 472500)
  // un cóctel que ya no existe no suma ni cuenta como trago
  assert.equal(precioBarraSalon(["a", "zz"], costos, 50).tragosPorAdulto, 1)
})

test("personal: mozo cada 20, mínimo 2, $50.000 + 30 %", () => {
  assert.equal(cantidadPersonal(mozo, 80), 4)
  assert.equal(cantidadPersonal(mozo, 85), 5)
  assert.equal(cantidadPersonal(mozo, 10), 2)
  const sim = simularPersonal([mozo], [], { invitados: 80, conMenu: true, conBarra: true })
  assert.equal(sim.lineas[0].cantidad, 4)
  assert.equal(sim.lineas[0].precioUnitario, 65000)
  assert.equal(sim.precioTotal, 260000)
  assert.equal(sim.costoTotal, 200000)
})

test("personal fijo: portero N = 0, mínimo 1 → siempre 1", () => {
  for (const inv of [0, 10, 80, 500]) assert.equal(cantidadPersonal(portero, inv), 1)
})

test("personal: 'aplica' con menú / con barra", () => {
  const cocinero = { ...mozo, funcion: "Cocinero", aplica: "con_menu" }
  const barman = { ...mozo, funcion: "Barman", aplica: "con_barra" }
  const reglas = [cocinero, barman, portero]
  const soloSalon = simularPersonal(reglas, [], { invitados: 80, conMenu: false, conBarra: false })
  assert.deepEqual(soloSalon.lineas.map((l) => l.funcion), ["Puerta"])
  const conTodo = simularPersonal(reglas, [], { invitados: 80, conMenu: true, conBarra: true })
  assert.deepEqual(conTodo.lineas.map((l) => l.funcion), ["Cocinero", "Barman", "Puerta"])
})

test("personal: tarifa = la más alta de la función, salvo que se escriba a mano", () => {
  const roster = [
    { id: "1", nombre: "Mozo", apellido: "1", funcion: "Mozo", tarifaBase: 45000 },
    { id: "2", nombre: "Mozo", apellido: "2", funcion: "Mozo", tarifaBase: 55000 },
    { id: "3", nombre: "Otro", apellido: "", funcion: "Mozos", tarifaBase: 99000 }, // texto distinto: no cuenta
  ]
  assert.deepEqual(tarifaMasAlta("Mozo", roster), { tarifa: 55000, de: "Mozo 2" })
  assert.deepEqual(tarifaDeRegla({ funcion: "Mozo", tarifa: null }, roster), { tarifa: 55000, origen: "personal", de: "Mozo 2" })
  assert.deepEqual(tarifaDeRegla({ funcion: "Mozo", tarifa: 50000 }, roster), { tarifa: 50000, origen: "manual" })
  // sin tarifa a mano y sin nadie con esa función → sin costo (aviso ámbar)
  assert.deepEqual(tarifaDeRegla({ funcion: "Payaso", tarifa: null }, roster), { tarifa: 0, origen: "sin_costo" })
  assert.equal(tarifaDeRegla({ funcion: "Mozo", tarifa: 0 }, roster).origen, "sin_costo")
})

// Menú por pasos en el cotizador: entrada, plato principal y postre.
// Correr: node --test scripts/test-menu-por-pasos.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(out.outputText, filename)
}
const {
  armarCotizacion, barrasAlEmpezarMenu, cocinaPorPasos, esBebidaDeMesa, pasosMenuFaltantes, textoPasosFaltantes,
} = require("../lib/cotizador-salon.ts")

// 70 adultos + 10 niños = 80 comensales. Precios por porción (costo entre paréntesis):
// entrada $3.000 ($2.000), principal $6.000 ($4.000), postre $1.500 ($1.000).
const ENTRADA = { id: "e1", nombre: "Empanadas", categoria: "Entrada", costo: 2000, precio: 3000 }
const PRINCIPAL = { id: "p1", nombre: "Vacío", categoria: "Plato Principal", costo: 4000, precio: 6000 }
const PRINCIPAL_2 = { id: "p2", nombre: "Pollo", categoria: "Plato Principal", costo: 3500, precio: 5000 }
const POSTRE = { id: "d1", nombre: "Helado", categoria: "Postre", costo: 1000, precio: 1500 }

function cotizar(recetas) {
  return armarCotizacion({
    adultos: 70,
    ninos: 10,
    capacidadMaxima: 130,
    salon: { costo: 1000000, precio: 1500000 },
    recetas,
    barra: null,
    servicios: [],
    personal: [{ funcion: "Cocinero", cadaNInvitados: 0, minimo: 1, aplica: "con_menu", costo: 50000, precio: 50000 }],
  })
}
const cocina = (r) => r.rubros.find((x) => x.clave === "cocina")

test("entrada + principal + postre se suman: $10.500 por persona × 80 = $840.000", () => {
  const r = cotizar([ENTRADA, PRINCIPAL, POSTRE])
  assert.equal(cocina(r).precio, 840000)
  // El costo también se suma: ($2.000 + $4.000 + $1.000) × 80 = $560.000
  assert.equal(cocina(r).costo, 560000)
  assert.equal(r.total, 1500000 + 840000 + 50000)
  assert.equal(r.modalidad, "con_catering")
  // La regla de personal "con menú" sigue aplicando
  assert.equal(r.personal.length, 1)
})

test("dos opciones del mismo paso se promedian: $3.000 + ($6.000 + $5.000) ÷ 2 + $1.500 = $10.000 por persona", () => {
  assert.equal(cocina(cotizar([ENTRADA, PRINCIPAL, PRINCIPAL_2, POSTRE])).precio, 800000)
})

test("los platos de un mismo paso cobran exactamente como antes (promedio)", () => {
  // ($6.000 + $5.000) ÷ 2 × 80 = $440.000
  assert.equal(cocina(cotizar([PRINCIPAL, PRINCIPAL_2])).precio, 440000)
  // Con decimales: la cuenta vieja era Math.round(comensales × suma ÷ cantidad)
  const tres = [1000, 1000, 1001].map((precio, i) => ({ id: `x${i}`, nombre: "P", categoria: "Plato Principal", precio }))
  assert.equal(Math.round(cocinaPorPasos(7, tres, (x) => x.precio)), Math.round((7 * 3001) / 3))
  assert.equal(Math.round(cocinaPorPasos(7, tres, (x) => x.precio)), 7002)
})

test("sin categoría (como antes del menú por pasos) se promedia todo", () => {
  const sinCategoria = [ENTRADA, PRINCIPAL, POSTRE].map(({ categoria, ...r }) => r)
  // ($3.000 + $6.000 + $1.500) ÷ 3 × 80 = $280.000
  assert.equal(cocina(cotizar(sinCategoria)).precio, 280000)
})

test("sin menú no hay cocina", () => {
  const r = cotizar([])
  assert.equal(cocina(r).precio, 0)
  assert.equal(r.modalidad, "solo_salon")
})

test("pasos que faltan: solo si hay menú elegido y solo los que el salón ofrece", () => {
  const cat = (categoria) => ({ categoria })
  const quinta = [cat("Entrada"), ...Array(5).fill(cat("Plato Principal")), cat("Postre")]
  const casona = [...Array(5).fill(cat("Plato Principal")), cat("Postre")]
  const salon = Array(5).fill(cat("Plato Principal"))
  // Sin menú no falta nada
  assert.deepEqual(pasosMenuFaltantes(quinta, []), [])
  // Quinta ofrece los tres
  assert.deepEqual(pasosMenuFaltantes(quinta, [cat("Plato Principal")]), ["Entrada", "Postre"])
  assert.deepEqual(pasosMenuFaltantes(quinta, [cat("Postre")]), ["Entrada", "Plato Principal"])
  assert.deepEqual(pasosMenuFaltantes(quinta, [cat("Entrada"), cat("Plato Principal"), cat("Postre")]), [])
  // Casona no tiene entradas: no se piden
  assert.deepEqual(pasosMenuFaltantes(casona, [cat("Plato Principal")]), ["Postre"])
  // Salón solo tiene principales
  assert.deepEqual(pasosMenuFaltantes(salon, [cat("Plato Principal")]), [])
  // Un plato de otra categoría también cuenta como "eligió menú"
  assert.deepEqual(pasosMenuFaltantes([cat("Recepción"), cat("Plato Principal")], [cat("Recepción")]), ["Plato Principal"])
})

test("texto de lo que falta", () => {
  assert.equal(textoPasosFaltantes([]), "")
  assert.equal(textoPasosFaltantes(["Entrada"]), "una entrada")
  assert.equal(textoPasosFaltantes(["Entrada", "Postre"]), "una entrada y un postre")
  assert.equal(textoPasosFaltantes(["Entrada", "Plato Principal", "Postre"]), "una entrada, un plato principal y un postre")
})

test("bebida de mesa: se reconoce por el nombre, sin importar mayúsculas, tildes ni espacios", () => {
  assert.equal(esBebidaDeMesa("BEBIDA DE MESA"), true)
  assert.equal(esBebidaDeMesa("Bebida de mesa (gaseosas y vino)"), true)
  assert.equal(esBebidaDeMesa("  bebida   de  mesa "), true)
  assert.equal(esBebidaDeMesa("BEBÍDA DE MÉSA"), true)
  assert.equal(esBebidaDeMesa("BARRA LIBRE"), false)
  assert.equal(esBebidaDeMesa("Mesa dulce"), false)
  assert.equal(esBebidaDeMesa(""), false)
})

test("bebida de mesa: se marca sola solo con el primer plato, sin pasarse de 2 barras", () => {
  // Primer plato: se suma al final, sin tocar lo que ya había
  assert.deepEqual(barrasAlEmpezarMenu(0, [], "mesa"), ["mesa"])
  assert.deepEqual(barrasAlEmpezarMenu(0, ["libre"], "mesa"), ["libre", "mesa"])
  // Ya había platos: no se vuelve a marcar (si la destildaron, queda destildada)
  assert.deepEqual(barrasAlEmpezarMenu(1, ["libre"], "mesa"), ["libre"])
  // Ya estaba elegida
  assert.deepEqual(barrasAlEmpezarMenu(0, ["mesa"], "mesa"), ["mesa"])
  // Cupo lleno (2 barras): no entra
  assert.deepEqual(barrasAlEmpezarMenu(0, ["libre", "loca"], "mesa"), ["libre", "loca"])
  // El salón no tiene bebida de mesa
  assert.deepEqual(barrasAlEmpezarMenu(0, ["libre"], null), ["libre"])
})

// Cuánto stock de cocina descuenta un evento al imprimir su documento
// (consumoCocinaDelEvento en lib/consumo-stock-evento.ts).
//
// El caso que lo motivó: la Lista de Eventos calculaba a mano
// cantidad × personas × rinde, sin pasar de unidad. 300 GRS de carne por
// persona para 100 personas descontaban 30.000 KG en vez de 30 KG, y como el
// stock no baja de 0, una impresión dejaba en cero casi todo el salón.

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")

const RAIZ = path.join(__dirname, "..")
const resolver = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolver.call(this, request.startsWith("@/") ? path.join(RAIZ, request.slice(2)) : request, ...args)
}
require.extensions[".ts"] = (mod, filename) =>
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText,
    filename,
  )

const { consumoCocinaDelEvento, itemsDesdeMapa } = require(path.join(RAIZ, "lib/consumo-stock-evento.ts"))
const { calcularComprasSegmentadas } = require(path.join(RAIZ, "lib/store.ts"))

const insumo = (id, unidad, extra = {}) => ({ id, codigo: id, descripcion: id, unidad, stockActual: 0, precioUnitario: 1000, ...extra })

const INSUMOS = [
  insumo("carne", "KG"),
  insumo("leche", "LT"),
  insumo("harina", "KG"),
  insumo("arvejas", "UN", { contenidoCantidad: 200, contenidoUnidad: "GRS" }),
  insumo("huevos", "UN"),
]

const receta = (id, insumos, factorRendimiento = 1) => ({
  id,
  codigo: id,
  nombre: id,
  categoria: "plato principal",
  factorRendimiento,
  insumos: insumos.map(([insumoId, cantidadBasePorPersona, unidadReceta]) => ({
    insumoId,
    cantidadBasePorPersona,
    unidadReceta,
    detalleCorte: "",
  })),
})

const RECETAS = [
  receta("asado", [["carne", 300, "GRS"]]),
  receta("salsa", [["leche", 200, "CC"]]),
  // Una bandeja de brownie: 1 KG de harina rinde para 20 personas.
  receta("brownie", [["harina", 1000, "GRS"], ["huevos", 10, "UN"]], 20),
  receta("rusa", [["arvejas", 30, "GRS"]]),
]

const evento = (extra) => ({
  id: "ev1",
  adultos: 0,
  adolescentes: 0,
  ninos: 0,
  personasDietasEspeciales: 0,
  recetasAdultos: [],
  recetasAdolescentes: [],
  recetasNinos: [],
  recetasDietasEspeciales: [],
  ...extra,
})

test("EL CASO REAL: 300 grs de carne para 100 personas son 30 KG, no 30.000", () => {
  const mapa = consumoCocinaDelEvento(evento({ adultos: 100, recetasAdultos: ["asado"] }), RECETAS, INSUMOS)
  assert.deepEqual(mapa, { carne: 30 })
})

test("cc pasa a litros: 200 cc de leche para 50 personas son 10 LT", () => {
  const mapa = consumoCocinaDelEvento(evento({ adultos: 50, recetasAdultos: ["salsa"] }), RECETAS, INSUMOS)
  assert.deepEqual(mapa, { leche: 10 })
})

test("el rinde divide: un brownie que rinde para 20, para 100 personas son 5 KG de harina", () => {
  const mapa = consumoCocinaDelEvento(evento({ adultos: 100, recetasAdultos: ["brownie"] }), RECETAS, INSUMOS)
  // 1 KG / 20 × 100 = 5 KG de harina; 10 huevos / 20 × 100 = 50 huevos.
  assert.deepEqual(mapa, { harina: 5, huevos: 50 })
})

test("insumo por unidad con contenido: 30 grs de una lata de 200 grs, para 100 personas son 15 latas", () => {
  const mapa = consumoCocinaDelEvento(evento({ adultos: 100, recetasAdultos: ["rusa"] }), RECETAS, INSUMOS)
  assert.deepEqual(mapa, { arvejas: 15 })
})

test("suma los grupos de invitados y respeta los multiplicadores de porción", () => {
  const mapa = consumoCocinaDelEvento(
    evento({
      adultos: 80,
      ninos: 20,
      recetasAdultos: ["asado"],
      recetasNinos: ["asado"],
      // Los chicos comen media porción.
      multipliersNinos: { asado: 0.5 },
    }),
    RECETAS,
    INSUMOS,
  )
  // 0,3 × 80 + 0,3 × 20 × 0,5 = 24 + 3 = 27 KG
  assert.deepEqual(mapa, { carne: 27 })
})

test("da lo mismo que la cantidad necesaria de la lista de compras", () => {
  const ev = evento({
    adultos: 137,
    adolescentes: 12,
    ninos: 9,
    personasDietasEspeciales: 3,
    recetasAdultos: ["asado", "salsa", "brownie"],
    recetasAdolescentes: ["asado", "rusa"],
    recetasNinos: ["brownie"],
    recetasDietasEspeciales: ["salsa"],
    multipliersAdultos: { asado: 1.25 },
  })
  const mapa = consumoCocinaDelEvento(ev, RECETAS, INSUMOS)
  for (const c of calcularComprasSegmentadas(ev, RECETAS, INSUMOS)) {
    assert.ok(Math.abs(mapa[c.insumoId] - c.cantidadNecesaria) < 0.0005, c.insumoId)
  }
})

test("redondea a 3 decimales (un gramo en KG)", () => {
  const mapa = consumoCocinaDelEvento(evento({ adultos: 3, recetasAdultos: ["asado"] }), [receta("asado", [["carne", 333.3333, "GRS"]])], INSUMOS)
  assert.equal(mapa.carne, 1)
  const mapa2 = consumoCocinaDelEvento(evento({ adultos: 1, recetasAdultos: ["asado"] }), [receta("asado", [["carne", 0.1, "GRS"]])], INSUMOS)
  // 0,0001 KG redondea a 0: ese insumo no se manda.
  assert.equal(mapa2.carne, undefined)
})

test("sin invitados cargados no descuenta nada", () => {
  assert.deepEqual(consumoCocinaDelEvento(evento({ recetasAdultos: ["asado"] }), RECETAS, INSUMOS), {})
  assert.deepEqual(consumoCocinaDelEvento(evento({ adultos: undefined, recetasAdultos: ["asado"] }), RECETAS, INSUMOS), {})
})

test("lo que se descuenta al imprimir es exactamente lo que vuelve al recuperar", () => {
  const ev = evento({ adultos: 120, recetasAdultos: ["asado", "brownie", "rusa"] })
  const mapa = consumoCocinaDelEvento(ev, RECETAS, INSUMOS)
  const sale = itemsDesdeMapa(mapa, "cocina", -1)
  const vuelve = itemsDesdeMapa(consumoCocinaDelEvento(ev, RECETAS, INSUMOS), "cocina", 1)
  assert.equal(sale.length, vuelve.length)
  for (const s of sale) {
    const v = vuelve.find((x) => x.insumoId === s.insumoId)
    assert.equal(s.delta + v.delta, 0, s.insumoId)
    assert.equal(s.sector, "cocina")
  }
})

// ── Barra: desde el 21/10/2026 imprimir descuenta también la barra ──
const { consumoBarraDelEvento, barraDescontadaAlImprimir } = require(path.join(RAIZ, "lib/consumo-stock-evento.ts"))

const insumoBarra = (id, unidad, extra = {}) => ({ id, codigo: id, descripcion: id, unidad, stockActual: 0, precioUnitario: 1000, ...extra })
const INSUMOS_BARRA = [
  insumoBarra("fernet", "UN", { contenidoCantidad: 750, contenidoUnidad: "CC" }),
  insumoBarra("coca", "UN", { contenidoCantidad: 2000, contenidoUnidad: "CC" }),
  insumoBarra("jugo", "LT"),
]
const COCTELES = [
  { id: "fernet-coca", nombre: "Fernet con coca", categoria: "Con Alcohol", insumos: [
    { insumoBarraId: "fernet", cantidadPorCoctel: 75, unidadCoctel: "CC" },
    { insumoBarraId: "coca", cantidadPorCoctel: 200, unidadCoctel: "CC" },
  ] },
  { id: "jugo", nombre: "Jugo", categoria: "Sin Alcohol", insumos: [{ insumoBarraId: "jugo", cantidadPorCoctel: 250, unidadCoctel: "CC" }] },
]

test("barra: 100 adultos con fernet = 10 botellas de fernet y 10 de coca; 20 chicos con jugo = 5 LT", () => {
  const ev = evento({ adultos: 100, adolescentes: 12, ninos: 8, barras: [{ coctelesIncluidos: ["fernet-coca", "jugo"] }] })
  assert.deepEqual(consumoBarraDelEvento(ev, COCTELES, INSUMOS_BARRA), { fernet: 10, coca: 10, jugo: 5 })
  assert.deepEqual(itemsDesdeMapa({ jugo: 5 }, "barra", -1), [{ insumoId: "jugo", sector: "barra", delta: -5 }])
})

test("barra: sin cócteles o sin invitados no se mueve nada", () => {
  assert.deepEqual(consumoBarraDelEvento(evento({ adultos: 100 }), COCTELES, INSUMOS_BARRA), {})
  assert.deepEqual(consumoBarraDelEvento(evento({ barras: [{ coctelesIncluidos: ["fernet-coca"] }] }), COCTELES, INSUMOS_BARRA), {})
})

test("barra: solo se devuelve si el evento se imprimió cuando ya se descontaba la barra", () => {
  assert.equal(barraDescontadaAlImprimir({ fechaImpresion: "2026-10-20T01:08:29.443Z" }), false)
  assert.equal(barraDescontadaAlImprimir({ fechaImpresion: "2026-10-22T15:00:00.000Z" }), true)
  assert.equal(barraDescontadaAlImprimir({ fechaImpresion: null }), false)
  assert.equal(barraDescontadaAlImprimir({}), false)
})

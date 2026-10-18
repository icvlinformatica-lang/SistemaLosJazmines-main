// Vista de Clientes — la maqueta 3D del simulador (lib/clientes-maqueta.ts).
// - Qué pieza le toca a cada servicio, con los nombres reales de la base.
// - Las letras luminosas (una por unidad), las mesas de a 10 y la guirnalda.
// - Qué se dibuja en cada paso y qué se avisa como "Sumaste…".
// - Que a la maqueta nunca le llegue un precio.
// No toca ninguna base ni dibuja nada (el 3D vive en components/clientes/maqueta).
// Correr: node --test scripts/test-clientes-maqueta.cjs
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
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

const maq = require(path.join(RAIZ, "lib", "clientes-maqueta.ts"))
const sim = require(path.join(RAIZ, "lib", "clientes-simulador.ts"))

// Los servicios activos de la base real (leídos el 18/10/2026, solo nombres).
const SERVICIOS_REALES = {
  "ALTAR": "altar",
  "ALTAR PERSONALIZADO 2026": "altar",
  "CANDELABROS": "candelabros",
  "LETRAS LUMINOSAS": "letras",
  "PLATAFORMA 360": "plataforma360",
  "SHIMER WALL": "shimmer",
  "FOTOGRAFIA 2028": "fotografia",
  "INVITACIÓN DIGITAL": "invitacion",
  "MAQUILLA PEINADO 2027": "maquillaje",
  "MAQUILLAJE PEINADO 2026": "maquillaje",
  "VESTIDO 2026": "vestido",
  "MESA DULCE Y TORTA": "mesaDulce",
  "CARTEL NEÓN": "neon",
  "DECORACIÓN": "decoracion",
  "DJ, SONIDO, LUCES Y HUMO": "dj",
  "MESAS, SILLAS, VAJILLA Y MANTELERÍA": "mesas",
  "PANTALLA LED": "pantallaLed",
  "PISTA LED": "pistaLed",
  "SUITE": "suite",
}

test("cada servicio real tiene su pieza (y el orden de las reglas importa)", () => {
  for (const [nombre, pieza] of Object.entries(SERVICIOS_REALES)) {
    assert.equal(maq.piezaDeServicio(nombre), pieza, nombre)
  }
  // "MESA DULCE" no es "MESAS"; "PISTA LED" no es la pantalla.
  assert.equal(maq.piezaDeServicio("mesa dulce y torta 2027"), "mesaDulce")
  assert.equal(maq.piezaDeServicio("FOTO + VIDEO"), "fotografia")
  assert.equal(maq.piezaDeServicio("Algo que no existe"), null)
  assert.equal(maq.piezaDeServicio(""), null)
  assert.equal(maq.piezaDeServicio(null), null)
})

test("letras luminosas: una letra por unidad, la palabra según el festejo", () => {
  assert.deepEqual(maq.letrasLuminosas("Cumpleaños de 15", 2), ["X", "V"])
  assert.deepEqual(maq.letrasLuminosas("Cumpleaños de 15", 3), ["X", "V", "★"])
  assert.deepEqual(maq.letrasLuminosas("Casamiento", 4), ["L", "O", "V", "E"])
  assert.deepEqual(maq.letrasLuminosas(null, 2), ["F", "I"])
  assert.deepEqual(maq.letrasLuminosas("Otro", 0), [])
  assert.equal(maq.letrasLuminosas("Cumpleaños", 50).length, maq.MAX_LETRAS)
  assert.equal(maq.palabraFestejo("Bautismo"), "BABY")
})

test("mesas de a 10: llenas y la última con lo que queda, con tope en el dibujo", () => {
  assert.deepEqual(maq.personasPorMesa(83, 16), [10, 10, 10, 10, 10, 10, 10, 10, 3])
  assert.deepEqual(maq.personasPorMesa(0, 16), [])
  assert.deepEqual(maq.personasPorMesa(6, 2), [6])
  const muchas = maq.personasPorMesa(400, 16)
  assert.equal(muchas.length, 16)
  assert.ok(muchas.every((n) => n === 10))
})

test("la guirnalda se prende de a un paso y toda al final", () => {
  const pasos = [0, 1, 2, 3, 4, 5, 6].map((a) => maq.lucesPrendidas(a, 7, false))
  for (let i = 1; i < pasos.length; i++) assert.ok(pasos[i] > pasos[i - 1])
  assert.ok(pasos[6] < 1)
  assert.equal(maq.lucesPrendidas(6, 7, true), 1)
  assert.equal(maq.lucesPrendidas(0, 0, false), 0)
})

const SALON = {
  nombre: "Casona",
  barras: [
    { id: "bm", bebidaDeMesa: true },
    { id: "b1", bebidaDeMesa: false },
    { id: "b2", bebidaDeMesa: false },
  ],
}
const SERVICIOS = [
  { servicioId: "inc-dj", nombre: "DJ, SONIDO, LUCES Y HUMO", incluido: true },
  { servicioId: "inc-deco", nombre: "DECORACIÓN", incluido: true },
  { servicioId: "x-led", nombre: "PANTALLA LED", incluido: false },
  { servicioId: "x-letras", nombre: "LETRAS LUMINOSAS", incluido: false },
  { servicioId: "x-360", nombre: "PLATAFORMA 360", incluido: false },
  { servicioId: "x-raro", nombre: "SERVICIO SIN PIEZA", incluido: false },
]
function entrada(cambios = {}) {
  return {
    tipoEvento: "Cumpleaños de 15",
    salon: SALON,
    servicios: SERVICIOS,
    elegidos: {},
    fecha: "2026-11-21",
    adultos: 80,
    ninos: 6,
    conCatering: true,
    recetas: [],
    barraIds: [],
    alcanzado: 2,
    totalPasos: 7,
    pasoInvitados: 3,
    completa: false,
    ...cambios,
  }
}

test("antes de elegir el salón: solo los globos y el atril del festejo", () => {
  const e = maq.estadoMaqueta(entrada({ salon: null, fecha: null, alcanzado: 0 }))
  assert.equal(e.globos, true)
  assert.deepEqual(e.cartel, { titulo: "Mis XV", fecha: null })
  assert.deepEqual(e.mesas, [])
  assert.deepEqual(e.piezas, {})
  const vacia = maq.estadoMaqueta(entrada({ tipoEvento: null, salon: null, fecha: null, alcanzado: 0 }))
  assert.equal(vacia.globos, false)
  assert.equal(vacia.cartel, null)
  assert.match(maq.descripcionMaqueta(vacia), /todavía vacía/)
})

test("con el salón: lo incluido aparece solo; lo adicional, cuando se elige", () => {
  const e = maq.estadoMaqueta(entrada())
  assert.deepEqual(e.piezas, { dj: 1, decoracion: 1 })
  assert.equal(e.cartel.titulo, "Mis XV")
  assert.equal(e.cartel.fecha, "sábado 21 de noviembre")
  assert.equal(e.salon, "Casona")
  assert.deepEqual(e.mesas, [10, 10, 10, 10, 10, 10, 10, 10])
  assert.deepEqual(e.mesasNinos, [6])
  // La gente se ve desde el paso de invitados.
  assert.equal(e.conInvitados, false)
  assert.equal(maq.estadoMaqueta(entrada({ alcanzado: 3 })).conInvitados, true)
  assert.equal(maq.estadoMaqueta(entrada({ alcanzado: 0, completa: true })).conInvitados, true)

  const con = maq.estadoMaqueta(entrada({ elegidos: { "x-led": 1, "x-letras": 2, "x-360": 3, "x-raro": 1 } }))
  assert.equal(con.piezas.pantallaLed, 1)
  assert.equal(con.piezas.plataforma360, 3)
  assert.deepEqual(con.letras, ["X", "V"])
  assert.equal(Object.keys(con.piezas).length, 5)
})

test("menú, bebida de mesa y barras", () => {
  assert.equal(maq.estadoMaqueta(entrada({ recetas: ["p1"] })).platos, true)
  assert.equal(maq.estadoMaqueta(entrada({ recetas: ["p1"], conCatering: false })).platos, false)
  const e = maq.estadoMaqueta(entrada({ barraIds: ["bm", "b1", "b2"] }))
  assert.equal(e.bebidaDeMesa, true)
  assert.equal(e.barras, 2)
  assert.equal(maq.estadoMaqueta(entrada({ barraIds: ["bm"] })).barras, 0)
})

test("Sumaste…: solo lo que la persona eligió, y adónde mira la cámara", () => {
  const base = maq.estadoMaqueta(entrada())
  const conMenu = maq.estadoMaqueta(entrada({ recetas: ["p1"], barraIds: ["bm"] }))
  const n1 = maq.novedades(base, conMenu)
  assert.deepEqual(n1.map((n) => n.foco), ["mesa", "mesa"])
  assert.equal(maq.textoSumaste(n1), "Sumaste el menú y la bebida de mesa")

  const unaBarra = maq.estadoMaqueta(entrada({ barraIds: ["b1"] }))
  const dosBarras = maq.estadoMaqueta(entrada({ barraIds: ["b1", "b2"] }))
  assert.deepEqual(maq.novedades(base, unaBarra), [{ texto: "la barra", foco: "barra" }])
  assert.deepEqual(maq.novedades(unaBarra, dosBarras), [{ texto: "otra barra", foco: "barra2" }])

  const led = maq.estadoMaqueta(entrada({ elegidos: { "x-led": 1 } }))
  assert.equal(maq.textoSumaste(maq.novedades(base, led)), "Sumaste la pantalla LED")
  assert.equal(maq.novedades(base, led)[0].foco, "pantallaLed")

  // Una letra más se avisa; una hora más de la plataforma, no.
  const letras1 = maq.estadoMaqueta(entrada({ elegidos: { "x-letras": 1 } }))
  const letras2 = maq.estadoMaqueta(entrada({ elegidos: { "x-letras": 2 } }))
  assert.deepEqual(maq.novedades(letras1, letras2), [{ texto: "una letra más", foco: "letras" }])
  const hora1 = maq.estadoMaqueta(entrada({ elegidos: { "x-360": 1 } }))
  const hora2 = maq.estadoMaqueta(entrada({ elegidos: { "x-360": 2 } }))
  assert.deepEqual(maq.novedades(hora1, hora2), [])

  // Lo incluido que aparece al elegir (o cambiar) el salón no se avisa.
  const sinSalon = maq.estadoMaqueta(entrada({ salon: null }))
  assert.deepEqual(maq.novedades(sinSalon, base), [])
  assert.deepEqual(maq.novedades(null, base), [])
})

test("la maqueta nunca recibe un precio", () => {
  const e = maq.estadoMaqueta(entrada({ recetas: ["p1"], barraIds: ["bm", "b1"], elegidos: { "x-led": 1, "x-letras": 2 }, alcanzado: 6 }))
  assert.deepEqual(sim.clavesProhibidas(e), [])
  assert.doesNotMatch(JSON.stringify(e), /precio|total|costo|ganancia/i)
  // Los únicos números son cantidades chicas (gente por mesa, unidades, luces).
  const numeros = JSON.stringify(e).match(/-?\d+(\.\d+)?/g).map(Number)
  assert.ok(numeros.every((n) => n <= 100), numeros.join(","))
})

test("la portada muestra una fiesta de muestra completa", () => {
  const m = maq.estadoMuestra()
  assert.equal(m.letras.join(""), "FIESTA")
  assert.ok(m.piezas.pantallaLed && m.piezas.pistaLed && m.piezas.dj)
  assert.equal(m.luces, 1)
  assert.match(maq.descripcionMaqueta(m), /^Maqueta de tu fiesta: 10 mesas con 100 invitados/)
})

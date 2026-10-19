// Vista de Clientes — prototipo del simulador "Armá tu fiesta".
// - lib/clientes-simulador.ts: catálogo saneado, la cuenta (con un caso en
//   pesos), menú por pasos, fechas y WhatsApp.
// - lib/vista-clientes.ts: quién la puede ver y qué rutas son de esa vista.
// - /api/clientes/catalogo, /ocupadas y /simular: permisos y que nunca salga
//   un costo, una ganancia, una tarifa ni el nombre de alguien del personal.
// No toca ninguna base: las rutas corren con la base y las lecturas simuladas.
// Correr: node --test scripts/test-clientes-simulador.cjs
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

const sim = require(path.join(RAIZ, "lib", "clientes-simulador.ts"))
const vista = require(path.join(RAIZ, "lib", "vista-clientes.ts"))
const cot = require(path.join(RAIZ, "lib", "cotizador-salon.ts"))

// ── Datos inventados ────────────────────────────────────────────────────────

const RECARGO_SABADO = { tipo: "porcentaje", valor: 10, rubros: ["salon"], porcentajes: { salon: 10, cocina: 0, barra: 0, servicios: 0 } }

/** Un salón ya en PRECIOS, como lo arma armarCotizadorPorSalon. */
function salonConPrecios(extra = {}) {
  return {
    salon: "Casona",
    capacidadMaxima: 130,
    precioSalon: 3000000,
    recargoSabado: RECARGO_SABADO,
    menu: [
      { recetaId: "e1", nombre: "cazuela de pollo al verdeo", categoria: "Entrada", precioPorPorcion: 10000 },
      { recetaId: "p1", nombre: "Bondiola a la Parrilla", categoria: "Plato Principal", precioPorPorcion: 20000 },
      { recetaId: "p2", nombre: "Asado Completo", categoria: "Plato Principal", precioPorPorcion: 25000 },
      { recetaId: "d1", nombre: "Casata C/SALSA CHOCO", categoria: "Postre", precioPorPorcion: 5000 },
      { recetaId: "z0", nombre: "Plato sin precio", categoria: "Postre", precioPorPorcion: 0 },
    ],
    barras: [
      { id: "b1", nombre: "BARRA LIBRE", coctelesIncluidos: ["c1", "c2"], precioPorAdulto: 8000, tragosPorAdulto: 2 },
      { id: "b0", nombre: "Barra vacía", coctelesIncluidos: [], precioPorAdulto: 0, tragosPorAdulto: 0 },
      { id: "bm", nombre: "BEBIDA DE MESA", coctelesIncluidos: ["cm"], precioPorAdulto: 3000, tragosPorAdulto: 1 },
    ],
    servicios: [
      { servicioId: "inc1", precio: 500000, incluido: true },
      { servicioId: "inc0", precio: 0, incluido: true },
      { servicioId: "x1", precio: 300000, incluido: false },
      { servicioId: "x2", precio: 50000, incluido: false },
      { servicioId: "x0", precio: 0, incluido: false },
      { servicioId: "v27", precio: 700000, incluido: false },
      { servicioId: "fantasma", precio: 100, incluido: false },
    ],
    personal: [
      { funcion: "Mozo", cadaNInvitados: 20, minimo: 2, aplica: "con_menu", precioPorPersona: 60000 },
      { funcion: "Barman", cadaNInvitados: 50, minimo: 1, aplica: "con_barra", precioPorPersona: 70000 },
      { funcion: "Portero", cadaNInvitados: 0, minimo: 1, aplica: "siempre", precioPorPersona: 40000 },
    ],
    ...extra,
  }
}

const SERVICIOS = [
  { id: "inc1", nombre: "DJ, SONIDO, LUCES Y HUMO", categoria: "Salon y Espacio", unidad: "Fijo" },
  { id: "inc0", nombre: "MESAS, SILLAS, VAJILLA Y MANTELERÍA", categoria: "Salon y Espacio", unidad: "Fijo" },
  { id: "x1", nombre: "PANTALLA LED", categoria: "Salon y Espacio", unidad: "Fijo" },
  { id: "x2", nombre: "PLATAFORMA 360", categoria: "Decoracion", unidad: "Por Hora" },
  { id: "x0", nombre: "SIN PRECIO", categoria: "Otros", unidad: "Fijo" },
  { id: "v27", nombre: "VESTIDO 2027", categoria: "Otros", unidad: "Fijo" },
]
const COCTELES = [
  { id: "c1", nombre: "MOJITO" },
  { id: "c2", nombre: "GIN TONIC" },
  { id: "cm", nombre: "BEBIDA DE MESA" },
]

function catalogoDePrueba() {
  return sim.armarCatalogoClientes({
    salones: [
      salonConPrecios(),
      // No listo: sin precio de salón ni capacidad (como "Salon" hoy).
      salonConPrecios({ salon: "Salon", precioSalon: 0, capacidadMaxima: null }),
      salonConPrecios({ salon: "Quinta", capacidadMaxima: 100 }),
    ],
    servicios: SERVICIOS,
    cocteles: COCTELES,
    nombresSalones: new Map([["Casona", "Casona"], ["Quinta", "La Quinta"], ["Salon", "Salon"]]),
    fechasEspeciales: [],
  })
}

// ── Quién ve la vista ───────────────────────────────────────────────────────

test("vista-clientes: solo clientes, Administración y Soporte", () => {
  for (const p of ["clientes", "administracion", "soporte"]) assert.equal(vista.puedeVerVistaClientes(p), true, p)
  for (const p of ["vendedor", "cobro", "cocina", "barra", "dj", "fotografo", "vestido", "pantalla", "coordinacion", "", null, undefined]) {
    assert.equal(vista.puedeVerVistaClientes(p), false, String(p))
  }
})

test("vista-clientes: qué rutas van a pantalla completa", () => {
  assert.equal(vista.esRutaVistaClientes("/clientes"), true)
  assert.equal(vista.esRutaVistaClientes("/clientes/presupuesto"), true)
  assert.equal(vista.esRutaVistaClientes("/clientesx"), false)
  assert.equal(vista.esRutaVistaClientes("/"), false)
  assert.equal(vista.esRutaVistaClientes("/vendedor/cotizar"), false)
  assert.equal(vista.esRutaVistaClientes(null), false)
})

// ── Catálogo saneado ────────────────────────────────────────────────────────

test("salón listo = con precio de salón y capacidad", () => {
  assert.equal(sim.salonListoParaClientes({ precioSalon: 1, capacidadMaxima: 100 }), true)
  assert.equal(sim.salonListoParaClientes({ precioSalon: 0, capacidadMaxima: 100 }), false)
  assert.equal(sim.salonListoParaClientes({ precioSalon: 1000, capacidadMaxima: null }), false)
  assert.equal(sim.salonListoParaClientes({ precioSalon: 1000, capacidadMaxima: 0 }), false)
})

test("nombres prolijos para un cliente", () => {
  assert.equal(sim.nombreParaCliente("FOTOGRAFIA 2026"), "Fotografia")
  assert.equal(sim.nombreParaCliente("DJ, SONIDO, LUCES Y HUMO"), "DJ, sonido, luces y humo")
  assert.equal(sim.nombreParaCliente("PANTALLA LED"), "Pantalla LED")
  assert.equal(sim.nombreParaCliente("MESAS, SILLAS, VAJILLA Y MANTELERÍA"), "Mesas, sillas, vajilla y mantelería")
  assert.equal(sim.nombreParaCliente("  cazuela de pollo   al verdeo "), "Cazuela de pollo al verdeo")
  assert.equal(sim.nombreParaCliente(""), "")
  assert.equal(sim.nombreEnFrase("DECORACIÓN"), "decoración")
  assert.equal(sim.nombreEnFrase("DJ, SONIDO, LUCES Y HUMO"), "DJ, sonido, luces y humo")
  // Los tres de fiesta, con el nombre que conocen los clientes (dicho por el
  // dueño el 18/10/2026), si Configuración no les puso uno propio.
  assert.equal(sim.nombreSalonCliente("Salon", new Map([["Salon", "Salon"]])), "Jazmines Salón")
  assert.equal(sim.nombreSalonCliente("Quinta", null), "Jazmines Quinta")
  assert.equal(sim.nombreSalonCliente("Casona", { Casona: "Casona" }), "Jazmines Casona")
  assert.equal(sim.nombreSalonCliente("Casona", { Casona: "  " }), "Jazmines Casona")
  // Un nombre propio de Configuración gana; los salones nuevos, como estén.
  assert.equal(sim.nombreSalonCliente("Quinta", { Quinta: "La Quinta" }), "La Quinta")
  assert.equal(sim.nombreSalonCliente("Salon 4", { "Salon 4": "Multiespacio Beruti" }), "Multiespacio Beruti")
  assert.equal(sim.nombreSalonCliente("Salon 5", null), "Salon 5")
})

test("catálogo: los salones van en el orden en que los nombra el dueño (Salón, Casona, Quinta)", () => {
  assert.ok(sim.ordenSalonCliente("Salon") < sim.ordenSalonCliente("Casona"))
  assert.ok(sim.ordenSalonCliente("Casona") < sim.ordenSalonCliente("Quinta"))
  assert.ok(sim.ordenSalonCliente("Quinta") < sim.ordenSalonCliente("Salon 4"))
  assert.equal(sim.ordenSalonCliente("Salon 4"), sim.ordenSalonCliente("Salon 5"))
  const c = sim.armarCatalogoClientes({
    salones: [
      salonConPrecios({ salon: "Salon 5" }),
      salonConPrecios({ salon: "Quinta" }),
      salonConPrecios({ salon: "Salon 4" }),
      salonConPrecios({ salon: "Casona" }),
      salonConPrecios({ salon: "Salon" }),
    ],
    servicios: SERVICIOS,
    cocteles: COCTELES,
    nombresSalones: null,
    fechasEspeciales: [],
  })
  // Los nuevos van después, en el orden en que vinieron.
  assert.deepEqual(c.salones.map((s) => s.salon), ["Salon", "Casona", "Quinta", "Salon 5", "Salon 4"])
  assert.deepEqual(c.salones.slice(0, 3).map((s) => s.nombre), ["Jazmines Salón", "Jazmines Casona", "Jazmines Quinta"])
})

test("catálogo: solo salones listos, nada en $0, tragos por nombre y bebida de mesa primero", () => {
  const c = catalogoDePrueba()
  assert.deepEqual(c.salones.map((s) => s.salon), ["Casona", "Quinta"])
  assert.equal(c.salones[0].nombre, "Jazmines Casona")
  assert.equal(c.salones[1].nombre, "La Quinta")
  const casona = c.salones[0]
  assert.deepEqual(casona.menu.map((m) => m.recetaId), ["e1", "p1", "p2", "d1"]) // sin el plato en $0
  assert.equal(casona.menu[0].nombre, "Cazuela de pollo al verdeo")
  assert.deepEqual(casona.barras.map((b) => b.id), ["bm", "b1"]) // bebida de mesa primero, sin la barra en $0
  assert.deepEqual(casona.barras[0].cocteles, []) // la bebida de mesa no lista "tragos"
  assert.equal(casona.barras[0].bebidaDeMesa, true)
  assert.deepEqual(casona.barras[1].cocteles, ["Mojito", "Gin tonic"])
  // Incluidos se quedan aunque valgan $0; adicionales en $0 y servicios borrados, no.
  assert.deepEqual(casona.servicios.map((s) => s.servicioId), ["inc1", "inc0", "x1", "x2", "v27"])
  assert.equal(casona.servicios.find((s) => s.servicioId === "x2").unidad, "Por Hora")
})

test("catálogo: no tiene ni una clave de costo, ganancia, margen o tarifa", () => {
  assert.deepEqual(sim.clavesProhibidas(catalogoDePrueba()), [])
})

test("clavesProhibidas encuentra claves internas a cualquier profundidad (y no mira valores)", () => {
  assert.deepEqual(sim.clavesProhibidas({ a: [{ costoTotal: 1 }], b: { x: { gananciaSalon: 2 } }, tarifa: 3, Margen: 4 }), [
    "$.a[0].costoTotal",
    "$.b.x.gananciaSalon",
    "$.tarifa",
    "$.Margen",
  ])
  assert.deepEqual(sim.clavesProhibidas({ nombre: "costo", detalle: "tarifa plana" }), [])
})

test("servicios del año del evento: VESTIDO 2027 solo en 2027", () => {
  const casona = catalogoDePrueba().salones[0]
  assert.equal(sim.serviciosParaFecha(casona, "2027-03-06").some((s) => s.servicioId === "v27"), true)
  assert.equal(sim.serviciosParaFecha(casona, "2026-11-13").some((s) => s.servicioId === "v27"), false)
})

// ── La cuenta ───────────────────────────────────────────────────────────────

const SELECCION = { adultos: 80, ninos: 10, recetas: ["e1", "p1", "d1"], barraIds: ["b1"], servicios: { x1: 1, x2: 3 } }

test("caso en pesos: un viernes en Casona", () => {
  const casona = catalogoDePrueba().salones[0]
  assert.equal(cot.diaDeSemana("2026-11-13"), 5) // viernes
  const { dia, resultado } = sim.cotizarCliente(casona, SELECCION, "2026-11-13", [])
  assert.equal(dia.tipo, "viernes")
  const rubro = (k) => resultado.rubros.find((r) => r.clave === k).precio
  assert.equal(rubro("salon"), 3000000)
  assert.equal(rubro("cocina"), 90 * (10000 + 20000 + 5000)) // 3.150.000: chicos comen
  assert.equal(rubro("barra"), 80 * 8000) // 640.000: la barra es por adulto
  assert.equal(rubro("servicios"), 300000 + 3 * 50000) // 450.000: el incluido no suma
  // Mozo ⌈90/20⌉ = 5, Barman ⌈90/50⌉ = 2, Portero fijo 1.
  assert.equal(rubro("personal"), 5 * 60000 + 2 * 70000 + 40000) // 480.000
  assert.equal(resultado.total, 7720000)
  assert.equal(resultado.recargo, null)
})

test("caso en pesos: el sábado suma el recargo de salón (10 %)", () => {
  const casona = catalogoDePrueba().salones[0]
  assert.equal(cot.diaDeSemana("2026-11-14"), 6)
  const { dia, resultado } = sim.cotizarCliente(casona, SELECCION, "2026-11-14", [])
  assert.equal(dia.tipo, "sabado")
  assert.equal(resultado.recargo.monto, 300000)
  assert.equal(resultado.total, 8020000)
})

test("la cuenta del cliente es la misma que arma el vendedor con esos precios", () => {
  // Misma entrada que /vendedor/cotizar (precios por unidad, incluidos del
  // salón y servicios elegidos), armada a mano.
  const casona = catalogoDePrueba().salones[0]
  const dia = cot.resolverDia("2026-11-14", "Casona", RECARGO_SABADO, [])
  const aMano = cot.armarCotizacion({
    adultos: 80,
    ninos: 10,
    capacidadMaxima: 130,
    salon: { precio: 3000000 },
    recetas: [
      { id: "e1", nombre: "a", categoria: "Entrada", precio: 10000 },
      { id: "p1", nombre: "b", categoria: "Plato Principal", precio: 20000 },
      { id: "d1", nombre: "c", categoria: "Postre", precio: 5000 },
    ],
    barra: null,
    barras: [{ id: "b1", nombre: "x", tragosPorAdulto: 2, precio: 8000 }],
    servicios: [
      { servicioId: "inc1", nombre: "i", unidad: "Fijo", cantidad: 1, incluido: true, precio: 500000 },
      { servicioId: "inc0", nombre: "j", unidad: "Fijo", cantidad: 1, incluido: true, precio: 0 },
      { servicioId: "x1", nombre: "k", unidad: "Fijo", cantidad: 1, incluido: false, precio: 300000 },
      { servicioId: "x2", nombre: "l", unidad: "Por Hora", cantidad: 3, incluido: false, precio: 50000 },
    ],
    personal: casona.personal.map((p) => ({ ...p, precio: p.precioPorPersona })),
    dia,
  })
  assert.equal(sim.cotizarCliente(casona, SELECCION, "2026-11-14", []).resultado.total, aMano.total)
})

test("sin catering: no se suma la comida ni el personal 'si hay menú'", () => {
  const casona = catalogoDePrueba().salones[0]
  const { resultado } = sim.cotizarCliente(casona, { ...SELECCION, recetas: [] }, "2026-11-13", [])
  assert.equal(resultado.rubros.find((r) => r.clave === "cocina").precio, 0)
  assert.equal(resultado.personal.some((p) => p.funcion === "Mozo"), false)
})

test("capacidad: más invitados que los que entran queda marcado", () => {
  const quinta = catalogoDePrueba().salones[1]
  const { resultado } = sim.cotizarCliente(quinta, { ...SELECCION, adultos: 95, ninos: 10 }, "2026-11-13", [])
  assert.equal(resultado.superaCapacidad, true)
})

test("resumen para el cliente: aunque la cuenta venga con costos (servidor), no salen", () => {
  const conCostos = cot.armarCotizacion({
    adultos: 50,
    ninos: 0,
    capacidadMaxima: 100,
    salon: { costo: 1000000, precio: 1500000 },
    recetas: [{ id: "p1", nombre: "Bondiola", categoria: "Plato Principal", costo: 8000, precio: 12000 }],
    barra: null,
    barras: [],
    servicios: [{ servicioId: "x1", nombre: "PANTALLA LED 2026", unidad: "Fijo", cantidad: 1, incluido: false, costo: 200000, precio: 250000 }],
    personal: [{ funcion: "Mozo", cadaNInvitados: 25, minimo: 1, aplica: "siempre", costo: 30000, precio: 45000 }],
    dia: null,
  })
  assert.ok(sim.clavesProhibidas(conCostos).length > 0) // la cuenta del servidor SÍ trae costos
  const resumen = sim.resumenParaCliente(conCostos, { tipo: "viernes", etiqueta: "Viernes" })
  assert.deepEqual(sim.clavesProhibidas(resumen), [])
  assert.equal(resumen.total, conCostos.total)
  assert.equal(resumen.porInvitado, Math.round(conCostos.total / 50))
  assert.equal(resumen.servicios[0].nombre, "Pantalla LED")
  assert.equal(resumen.servicios[0].unidad, "Fijo")
  assert.deepEqual(resumen.personal, [{ funcion: "Mozo", cantidad: 2 }])
})

// ── Menú y barra ────────────────────────────────────────────────────────────

test("menú por pasos: entrada, plato principal y postre, en ese orden", () => {
  const casona = catalogoDePrueba().salones[0]
  const pasos = sim.pasosDelMenu([...casona.menu].reverse())
  assert.deepEqual(pasos.map((p) => p.titulo), ["Entrada", "Plato principal", "Postre"])
})

test("un plato por paso: elegir otro del mismo paso lo reemplaza; tocar el elegido lo saca", () => {
  const menu = catalogoDePrueba().salones[0].menu
  let elegidos = sim.elegirPlato([], "p1", menu)
  elegidos = sim.elegirPlato(elegidos, "e1", menu)
  assert.deepEqual(elegidos, ["p1", "e1"])
  elegidos = sim.elegirPlato(elegidos, "p2", menu)
  assert.deepEqual(elegidos, ["e1", "p2"])
  assert.deepEqual(sim.elegirPlato(elegidos, "p2", menu), ["e1"])
  assert.deepEqual(sim.elegirPlato(elegidos, "no-existe", menu), ["e1", "p2"])
})

test("los platos elegidos se muestran en el orden del menú, no en el que se tocaron", () => {
  const menu = catalogoDePrueba().salones[0].menu
  assert.deepEqual(sim.platosEnOrden(menu, ["d1", "p1", "e1"]).map((m) => m.recetaId), ["e1", "p1", "d1"])
})

test("servicio con su cantidad: horas, unidades o solo el nombre", () => {
  assert.equal(sim.servicioConCantidad({ nombre: "PLATAFORMA 360", unidad: "Por Hora", cantidad: 2 }), "Plataforma 360 (2 horas)")
  assert.equal(sim.servicioConCantidad({ nombre: "PLATAFORMA 360", unidad: "Por Hora", cantidad: 1 }), "Plataforma 360 (1 hora)")
  assert.equal(sim.servicioConCantidad({ nombre: "LETRAS LUMINOSAS", unidad: "Por Cantidad", cantidad: 3 }, true), "letras luminosas (3)")
  assert.equal(sim.servicioConCantidad({ nombre: "PANTALLA LED 2026", unidad: "Fijo", cantidad: 1 }), "Pantalla LED")
})

test("barras: hasta dos", () => {
  assert.deepEqual(sim.elegirBarra([], "a"), ["a"])
  assert.deepEqual(sim.elegirBarra(["a", "b"], "c"), ["a", "b"])
  assert.deepEqual(sim.elegirBarra(["a", "b"], "a"), ["b"])
})

// ── Fechas ──────────────────────────────────────────────────────────────────

test("fechas: sumar días y meses sin zona horaria", () => {
  assert.equal(sim.sumarDias("2026-10-28", 7), "2026-11-04")
  assert.equal(sim.sumarDias("2026-12-30", 7), "2027-01-06")
  assert.equal(sim.sumarDias("2026-13-01", 7), "")
  assert.equal(sim.sumarMeses("2026-01-31", 1), "2026-02-28")
  assert.equal(sim.sumarMeses("2026-10-18", 24), "2028-10-18")
  assert.deepEqual(sim.rangoCalendario("2026-10-18"), { desde: "2026-10-18", hasta: "2028-10-18" })
  assert.equal(sim.fechaLarga("2026-11-14"), "sábado 14 de noviembre de 2026")
  assert.equal(sim.fechaLarga("2026-11-14", false), "sábado 14 de noviembre")
  assert.equal(sim.fechaLarga("cualquier cosa"), "")
})

test("calendario que arranca el lunes", () => {
  // Noviembre 2026 empieza un domingo: 6 celdas vacías antes del 1.
  const celdas = sim.celdasDelMes(2026, 10)
  assert.equal(celdas.filter((c) => c === null).length, 6)
  assert.equal(celdas[6], "2026-11-01")
  assert.equal(celdas.length, 6 + 30)
})

test("fechas ocupadas: solo salones pedidos, solo fechas válidas, sin repetir y ordenadas", () => {
  const out = sim.ocupadasPorSalon(
    [
      { salon: "Casona", fecha: "2026-12-05" },
      { salon: "Casona", fecha: "2026-11-14" },
      { salon: "Casona", fecha: "2026-11-14" },
      { salon: "Salon", fecha: "2026-11-14" },
      { salon: "Quinta", fecha: "14/11/2026" },
      { salon: null, fecha: "2026-11-21" },
    ],
    ["Casona", "Quinta"],
  )
  assert.deepEqual(out, { Casona: ["2026-11-14", "2026-12-05"], Quinta: [] })
  assert.deepEqual(sim.salonesLibresEseDia("2026-11-14", ["Casona", "Quinta"], out, "Casona"), ["Quinta"])
  assert.deepEqual(sim.salonesLibresEseDia("2026-11-14", ["Casona", "Quinta"], out, "Quinta"), [])
})

// ── WhatsApp ────────────────────────────────────────────────────────────────

test("mensaje de WhatsApp del cliente", () => {
  const texto = sim.textoWhatsAppCliente({
    nombre: "Sofía",
    tipoEvento: "Cumpleaños de 15",
    fecha: "2026-11-14",
    salon: "Casona",
    invitados: 90,
    total: 8020000,
  })
  assert.match(texto, /^Hola, soy Sofía\. /)
  assert.match(texto, /Cumpleaños de 15 el sábado 14 de noviembre de 2026 en Casona para 90 invitados\./)
  assert.match(texto, /8\.020\.000/)
  assert.ok(sim.linkWhatsApp(texto).startsWith("https://wa.me/?text=Hola%2C%20soy"))
  assert.ok(sim.linkWhatsApp("hola", "+54 9 11 2345-6789").startsWith("https://wa.me/5491123456789?text="))
  // Con la Casona dice si es adentro o al aire libre.
  const conLugar = sim.textoWhatsAppCliente({ tipoEvento: "Casamiento", salon: "Casona", lugar: "al aire libre", invitados: 100 })
  assert.match(conLugar, /Casamiento en Casona al aire libre para 100 invitados\./)
})

// ── Pasos ───────────────────────────────────────────────────────────────────

test("pasos: 'lugar' va después del salón solo si el salón tiene aire libre", () => {
  const ids = (ps) => ps.map((p) => p.id)
  assert.deepEqual(ids(sim.pasosCliente(false)), ["festejo", "salon", "fecha", "invitados", "menu", "barra", "detalles"])
  assert.deepEqual(ids(sim.pasosCliente(true)), ["festejo", "salon", "lugar", "fecha", "invitados", "menu", "barra", "detalles"])
})

test("pasos: el número de cada paso y, sin 'lugar', el del paso anterior", () => {
  const con = sim.pasosCliente(true)
  const sin = sim.pasosCliente(false)
  assert.equal(sim.indicePaso(con, "lugar"), 2)
  assert.equal(sim.indicePaso(con, "fecha"), 3)
  assert.equal(sim.indicePaso(sin, "fecha"), 2)
  // Si llegó hasta "lugar" con la Casona y cambia a la Quinta, queda en el salón.
  assert.equal(sim.indicePaso(sin, "lugar"), 1)
  assert.equal(sim.indicePaso(sin, "festejo"), 0)
  assert.equal(sim.pasoDespuesDe("fecha", "lugar"), true)
  assert.equal(sim.pasoDespuesDe("lugar", "lugar"), false)
  assert.equal(sim.pasoDespuesDe("salon", "lugar"), false)
})

// ── Rutas ───────────────────────────────────────────────────────────────────

let perfilActual = "clientes"
let consultas = []
const db = async (parts, ...values) => {
  const query = parts.join("?")
  consultas.push({ query, values })
  if (query.includes("FROM servicios")) {
    return SERVICIOS.map((s) => ({ ...s }))
  }
  if (query.includes("FROM eventos")) {
    return [
      { salon: "Casona", fecha: "2026-11-14" },
      { salon: "Salon", fecha: "2026-11-21" },
      { salon: "Quinta", fecha: "2026-12-05" },
    ]
  }
  throw new Error(`Consulta inesperada: ${query}`)
}
db.json = (v) => v
db.begin = (fn) => fn(db)

const CONFIGS = [
  {
    salon: "Casona", costoSalon: 2000000, capacidadMaxima: 130, gananciaSalon: 50, gananciaCocina: 40, gananciaBarra: 60, gananciaServicios: 10,
    recargoSabado: RECARGO_SABADO, recetas: ["p1"], barras: ["b1"],
    servicios: [{ servicioId: "inc1", oculto: false, incluido: true }],
    reglasPersonal: [{ funcion: "Mozo", cadaNInvitados: 20, minimo: 2, tarifa: null, ganancia: 30, aplica: "con_menu" }],
  },
  // No listo (como hoy "Salon"): sin costo de salón ni capacidad.
  {
    salon: "Salon", costoSalon: 0, capacidadMaxima: null, gananciaSalon: 0, gananciaCocina: 40, gananciaBarra: 60, gananciaServicios: 0,
    recargoSabado: { tipo: "monto", valor: 0, rubros: ["salon"] }, recetas: ["p1"], barras: [], servicios: [], reglasPersonal: [],
  },
  {
    salon: "Quinta", costoSalon: 1800000, capacidadMaxima: 100, gananciaSalon: 50, gananciaCocina: 40, gananciaBarra: 60, gananciaServicios: 0,
    recargoSabado: RECARGO_SABADO, recetas: ["p1"], barras: ["b1"], servicios: [], reglasPersonal: [],
  },
]

let calculoSimulado = null
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: db }
  if (request === "@/lib/stock-salones-server") {
    return {
      perfilDesdeRequest: async () => perfilActual,
      salonesConfigurados: async () => new Map([["Casona", "Casona"], ["Quinta", "Quinta"], ["Salon", "Salon"]]),
    }
  }
  if (request === "@/lib/precio-barra-servidor") {
    return {
      leerPreciosCocteles: async () => [
        { id: "c1", nombre: "MOJITO", categoria: "Con Alcohol", costoPorTrago: 1000, precioPorTrago: 1500 },
        { id: "c2", nombre: "GIN TONIC", categoria: "Con Alcohol", costoPorTrago: 1200, precioPorTrago: 1800 },
      ],
    }
  }
  if (request === "@/lib/cotizador-config-servidor") {
    return {
      leerCostosPlatos: async () => [{ id: "p1", nombre: "Bondiola", categoria: "Plato Principal", costoPorPorcion: 8000 }],
      leerBarrasArmadas: async () => [{ id: "b1", nombre: "BARRA LIBRE", coctelesIncluidos: ["c1", "c2"], enCotizador: true }],
    }
  }
  if (request === "@/lib/cotizador-salon-servidor") {
    return {
      leerConfigTodosLosSalones: async () => CONFIGS,
      leerServiciosConCosto: async () => [
        { id: "inc1", nombre: "DJ, SONIDO, LUCES Y HUMO", categoria: "Salon y Espacio", unidad: "Fijo", costo: 400000 },
        { id: "x1", nombre: "PANTALLA LED", categoria: "Salon y Espacio", unidad: "Fijo", costo: 250000 },
      ],
      // Ana Gómez: nombre y tarifa del personal, que NUNCA tienen que llegarle a un cliente.
      leerPersonalConTarifa: async () => [{ id: "p1", nombre: "Ana", apellido: "Gómez", funcion: "Mozo", tarifaBase: 45000 }],
    }
  }
  if (request === "@/lib/fechas-especiales-servidor") return { leerFechasEspeciales: async () => [] }
  if (request === "@/lib/cotizacion-servidor") return { cotizarEnServidor: async () => calculoSimulado }
  return load.call(this, request, ...args)
}
const rutaCatalogo = require(path.join(RAIZ, "app", "api", "clientes", "catalogo", "route.ts"))
const rutaOcupadas = require(path.join(RAIZ, "app", "api", "clientes", "ocupadas", "route.ts"))
const rutaSimular = require(path.join(RAIZ, "app", "api", "clientes", "simular", "route.ts"))
Module._load = load

const pedir = (url, init) => new Request(`http://local${url}`, init)

test("rutas: sin el perfil correcto, 403 y no se lee la base", async () => {
  for (const p of ["vendedor", "cobro", "dj", null]) {
    perfilActual = p
    consultas = []
    assert.equal((await rutaCatalogo.GET(pedir("/api/clientes/catalogo"))).status, 403, `catálogo ${p}`)
    assert.equal((await rutaOcupadas.GET(pedir("/api/clientes/ocupadas"))).status, 403, `ocupadas ${p}`)
    const sim403 = await rutaSimular.POST(pedir("/api/clientes/simular", { method: "POST", body: "{}" }))
    assert.equal(sim403.status, 403, `simular ${p}`)
    assert.equal(consultas.length, 0)
  }
  perfilActual = "clientes"
})

test("catálogo: precios de la misma cuenta del vendedor, sin costos ni nombres del personal", async () => {
  for (const p of ["clientes", "administracion", "soporte"]) {
    perfilActual = p
    const res = await rutaCatalogo.GET(pedir("/api/clientes/catalogo"))
    assert.equal(res.status, 200, p)
    const json = await res.json()
    assert.deepEqual(sim.clavesProhibidas(json), [])
    const texto = JSON.stringify(json)
    assert.equal(texto.includes("Ana"), false)
    assert.equal(texto.includes("Gómez"), false)
    assert.deepEqual(json.salones.map((s) => s.salon), ["Casona", "Quinta"]) // "Salon" no está listo
    const casona = json.salones[0]
    assert.equal(casona.precioSalon, 3000000) // 2.000.000 + 50 %
    assert.equal(casona.menu[0].precioPorPorcion, 11200) // 8.000 + 40 %
    assert.equal(casona.personal[0].precioPorPersona, 58500) // 45.000 + 30 %
    assert.deepEqual(casona.barras[0].cocteles, ["Mojito", "Gin tonic"])
  }
  perfilActual = "clientes"
})

test("ocupadas: solo fechas, solo de los salones listos, desde hoy", async () => {
  consultas = []
  const res = await rutaOcupadas.GET(pedir("/api/clientes/ocupadas"))
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.deepEqual(json.ocupadas, { Casona: ["2026-11-14"], Quinta: ["2026-12-05"] })
  assert.equal(Object.keys(json).sort().join(","), "desde,hasta,ocupadas,ok")
  const q = consultas.find((c) => c.query.includes("FROM eventos"))
  assert.match(q.query, /deleted_at IS NULL/)
  assert.deepEqual(q.values, [json.desde, json.hasta])
  assert.equal(json.hasta, sim.sumarMeses(json.desde, 24))
})

test("simular: devuelve solo precios aunque el servidor calcule con costos", async () => {
  const resultado = cot.armarCotizacion({
    adultos: 60,
    ninos: 0,
    capacidadMaxima: 130,
    salon: { costo: 2000000, precio: 3000000 },
    recetas: [{ id: "p1", nombre: "Bondiola", categoria: "Plato Principal", costo: 8000, precio: 11200 }],
    barra: null,
    barras: [],
    servicios: [],
    personal: [{ funcion: "Mozo", cadaNInvitados: 20, minimo: 2, aplica: "con_menu", costo: 45000, precio: 58500 }],
    dia: null,
  })
  calculoSimulado = {
    config: CONFIGS[0],
    dia: { tipo: "viernes", etiqueta: "Viernes", diaSemana: 5, fechaEspecial: null, recargo: null },
    resultado,
    recetas: [],
    pasosMenuFaltantes: [],
    barra: null,
    barras: [],
    servicios: [],
    personal: [{ funcion: "Mozo", cantidad: 3, tarifa: 45000, origenTarifa: "personal", ganancia: 30 }],
  }
  const res = await rutaSimular.POST(
    pedir("/api/clientes/simular", { method: "POST", body: JSON.stringify({ salon: "Casona", adultos: 60, recetas: ["p1"] }) }),
  )
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.deepEqual(sim.clavesProhibidas(json), [])
  assert.equal(json.resumen.total, resultado.total)
  assert.equal(JSON.stringify(json).includes("45000"), false) // la tarifa no sale
})

test("simular: un salón que no está listo no se cotiza, y los errores del cálculo pasan tal cual", async () => {
  calculoSimulado = { ...calculoSimulado, config: CONFIGS[1] }
  const noListo = await rutaSimular.POST(pedir("/api/clientes/simular", { method: "POST", body: JSON.stringify({ salon: "Salon", adultos: 50 }) }))
  assert.equal(noListo.status, 400)
  calculoSimulado = "Cargá la cantidad de invitados."
  const sinInvitados = await rutaSimular.POST(pedir("/api/clientes/simular", { method: "POST", body: JSON.stringify({ salon: "Casona" }) }))
  assert.equal(sinInvitados.status, 400)
  assert.equal((await sinInvitados.json()).error, "Cargá la cantidad de invitados.")
})

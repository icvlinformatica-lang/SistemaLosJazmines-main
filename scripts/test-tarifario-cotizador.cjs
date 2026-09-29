// Pruebas del cálculo de precio del cotizador (lib/tarifario-cotizador.ts).
// Función pura: no toca la base ni la red.

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

const {
  calcularCotizacion,
  diaTarifario,
  servicioCorrespondeAlAnio,
  calcularPersonalSugerido,
  personalIncluidoDelSalon,
  ajustarPersonalDelSalonPorDia,
  origenEsPrecioDeLista,
  AVISO_FUERA_DE_TARIFARIO,
} = require(path.join(RAIZ, "lib/tarifario-cotizador.ts"))

// Grilla igual al seed real de Quinta.
const TARIFARIO = [
  ["Quinta", 50, 60, "viernes", "solo_salon", 3500000],
  ["Quinta", 50, 60, "sabado", "solo_salon", 4000000],
  ["Quinta", 70, 80, "viernes", "solo_salon", 3800000],
  ["Quinta", 70, 80, "sabado", "solo_salon", 4300000],
  ["Quinta", 90, 100, "viernes", "solo_salon", 4000000],
  ["Quinta", 90, 100, "sabado", "solo_salon", 4500000],
  ["Quinta", 50, 60, "viernes", "con_catering", 7000000],
  ["Quinta", 50, 60, "sabado", "con_catering", 7500000],
  ["Quinta", 70, 80, "viernes", "con_catering", 7700000],
  ["Quinta", 70, 80, "sabado", "con_catering", 8300000],
  ["Quinta", 90, 100, "viernes", "con_catering", 9000000],
  ["Quinta", 90, 100, "sabado", "con_catering", 9800000],
].map(([salon, invitadosMin, invitadosMax, dia, modalidad, precio]) => ({
  salon, invitadosMin, invitadosMax, dia, modalidad, precio,
}))

const CATALOGO = [
  { id: "pantalla", nombre: "PANTALLA LED", categoria: "Salon y Espacio", unidad: "Fijo", precioVenta: 400000 },
  { id: "menu-asado", nombre: "MENÚ ASADO", categoria: "Menú", unidad: "Por Persona", precioVenta: 25000 },
  { id: "barra-full", nombre: "BARRA FULL", categoria: "Barra", unidad: "Por Persona", precioVenta: 10000 },
  { id: "plataforma", nombre: "PLATAFORMA 360", categoria: "Decoracion", unidad: "Por Hora", precioVenta: 200000 },
  { id: "cartel", nombre: "CARTEL NEÓN", categoria: "Salon y Espacio", unidad: "Fijo", precioVenta: 0 },
  { id: "mesa-dulce", nombre: "MESA DULCE Y TORTA", categoria: "Pasteleria", unidad: "Fijo", precioVenta: 335000 },
  { id: "mesas", nombre: "MESAS, SILLAS, VAJILLA Y MANTELERÍA", categoria: "Salon y Espacio", unidad: "Fijo", precioVenta: 180000 },
  { id: "dj", nombre: "DJ, SONIDO, LUCES Y HUMO", categoria: "Salon y Espacio", unidad: "Fijo", precioVenta: 220000 },
]

// Lo que el precio del salón ya trae (ver salon_incluye_servicio).
const INCLUIDOS_SALON = ["mesas", "dj"]

const base = (over = {}) => ({
  salon: "Quinta",
  fechaEvento: "2026-10-03", // sábado
  modalidad: "solo_salon",
  totalInvitados: 75,
  serviciosElegidos: [],
  catalogoServicios: CATALOGO,
  tarifario: TARIFARIO,
  preciosVenta: {},
  ...over,
})

test("día: sábado es sábado; domingo a jueves se cotizan como viernes", () => {
  assert.equal(diaTarifario("2026-10-03"), "sabado")   // sábado
  assert.equal(diaTarifario("2026-10-02"), "viernes")  // viernes
  assert.equal(diaTarifario("2026-10-04"), "viernes")  // domingo
  assert.equal(diaTarifario("2026-09-30"), "viernes")  // miércoles
  assert.equal(diaTarifario(""), "viernes")
})

test("PRUEBA PEDIDA: Quinta, sábado, 75 invitados, solo salón + PANTALLA LED", () => {
  const r = calcularCotizacion(base({ serviciosElegidos: [{ servicioId: "pantalla", cantidad: 1 }] }))
  assert.equal(r.precioSalon, 4300000)
  assert.equal(r.origenPrecioSalon, "tarifario")
  assert.equal(r.totalServicios, 400000)
  assert.equal(r.total, 4700000)
  assert.equal(r.fueraDeTarifario, false)
  assert.deepEqual(r.avisos, [])
})

test("el Calendario de Precios le gana a la grilla", () => {
  const r = calcularCotizacion(base({ preciosVenta: { Quinta: { "2026-10-03": 5000000 } } }))
  assert.equal(r.precioSalon, 5000000)
  assert.equal(r.origenPrecioSalon, "calendario")
})

test("sin grilla el salón vale $0: NO hay fallback al precio base", () => {
  // precios_base_salones quedó desconectado del cálculo a propósito: era un
  // número de respaldo que tapaba que al salón le falta cargar la grilla.
  const r = calcularCotizacion(base({ salon: "Casona" }))
  assert.equal(r.precioSalon, 0)
  assert.equal(r.origenPrecioSalon, "sin_precio")
  assert.equal(r.fueraDeTarifario, true)
  assert.ok(r.avisos.some((a) => a.includes("no tiene grilla de tarifario cargada")))
})

test("salón sin ningún precio: $0 y marcado para Administración", () => {
  const r = calcularCotizacion(base({ salon: "Salon 5" }))
  assert.equal(r.precioSalon, 0)
  assert.equal(r.origenPrecioSalon, "sin_precio")
  assert.equal(r.fueraDeTarifario, true)
})

test("invitados fuera de rango: usa el rango más cercano y avisa", () => {
  const pocos = calcularCotizacion(base({ totalInvitados: 20 }))
  assert.equal(pocos.precioSalon, 4000000, "20 invitados → rango 50-60")
  assert.equal(pocos.origenPrecioSalon, "tarifario_aproximado")
  assert.equal(pocos.fueraDeTarifario, true)

  const muchos = calcularCotizacion(base({ totalInvitados: 150 }))
  assert.equal(muchos.precioSalon, 4500000, "150 invitados → rango 90-100")
  assert.equal(muchos.origenPrecioSalon, "tarifario_aproximado")

  // Empate: 85 está a 5 de 70-80 y a 5 de 90-100. Gana el de arriba para no
  // subcotizar un evento que necesita capacidad para 85 personas.
  const entreRangos = calcularCotizacion(base({ totalInvitados: 85 }))
  assert.equal(entreRangos.precioSalon, 4500000, "empate → rango superior (90-100)")
  assert.equal(entreRangos.origenPrecioSalon, "tarifario_aproximado")
  assert.equal(entreRangos.fueraDeTarifario, true)
})

test("'Por Persona' se multiplica por los invitados (a diferencia del planificador)", () => {
  const r = calcularCotizacion(base({ serviciosElegidos: [{ servicioId: "menu-asado", cantidad: 1 }] }))
  assert.equal(r.servicios[0].cantidad, 75)
  assert.equal(r.servicios[0].precioTotal, 25000 * 75)
  assert.equal(r.total, 4300000 + 1875000)
})

test("'Por Hora' multiplica por la cantidad; 'Fijo' no multiplica", () => {
  const r = calcularCotizacion(base({
    serviciosElegidos: [
      { servicioId: "plataforma", cantidad: 3 },
      { servicioId: "mesa-dulce", cantidad: 5 },
    ],
  }))
  const plataforma = r.servicios.find((s) => s.servicioId === "plataforma")
  const mesa = r.servicios.find((s) => s.servicioId === "mesa-dulce")
  assert.equal(plataforma.precioTotal, 600000)
  assert.equal(mesa.cantidad, 1, "Fijo ignora la cantidad")
  assert.equal(mesa.precioTotal, 335000)
})

test("con catering: menú y barra se eligen pero NO suman; el resto sí", () => {
  const r = calcularCotizacion(base({
    modalidad: "con_catering",
    serviciosElegidos: [
      { servicioId: "menu-asado", cantidad: 1 },
      { servicioId: "barra-full", cantidad: 1 },
      { servicioId: "pantalla", cantidad: 1 },
    ],
  }))
  assert.equal(r.precioSalon, 8300000, "grilla con catering, sábado, 70-80")
  const menu = r.servicios.find((s) => s.servicioId === "menu-asado")
  const barra = r.servicios.find((s) => s.servicioId === "barra-full")
  assert.equal(menu.incluidoEnPaquete, true)
  assert.equal(menu.precioTotal, 0)
  assert.equal(menu.cantidad, 75, "la cantidad se conserva para cocina aunque no sume")
  assert.equal(barra.precioTotal, 0)
  assert.equal(r.totalServicios, 400000, "solo la pantalla suma")
  assert.equal(r.total, 8700000)
})

test("un servicio en $0 marca la cotización para Administración", () => {
  const r = calcularCotizacion(base({ serviciosElegidos: [{ servicioId: "cartel", cantidad: 1 }] }))
  assert.equal(r.fueraDeTarifario, true)
  assert.ok(r.avisos.some((a) => a.includes("CARTEL NEÓN") && a.includes(AVISO_FUERA_DE_TARIFARIO)))
})

test("servicio duplicado en el catálogo: avisa (caso VESTIDO 2026)", () => {
  const catalogo = [
    ...CATALOGO,
    { id: "v1", nombre: "VESTIDO 2026", categoria: "Otros", unidad: "Fijo", precioVenta: 400000 },
    { id: "v2", nombre: "VESTIDO 2026", categoria: "Otros", unidad: "Fijo", precioVenta: 300000 },
  ]
  const r = calcularCotizacion(base({
    catalogoServicios: catalogo,
    serviciosElegidos: [{ servicioId: "v1", cantidad: 1 }, { servicioId: "v2", cantidad: 1 }],
  }))
  assert.equal(r.fueraDeTarifario, true)
  assert.ok(r.avisos.some((a) => a.includes('más de un servicio llamado "VESTIDO 2026"')))
})

test("filtro por año en el nombre del servicio", () => {
  assert.equal(servicioCorrespondeAlAnio("VESTIDO 2027", "2027-05-10"), true)
  assert.equal(servicioCorrespondeAlAnio("VESTIDO 2026", "2027-05-10"), false)
  assert.equal(servicioCorrespondeAlAnio("VESTIDO 2025", "2027-05-10"), false)
  assert.equal(servicioCorrespondeAlAnio("PANTALLA LED", "2027-05-10"), true, "sin año se ofrece siempre")
  assert.equal(servicioCorrespondeAlAnio("ALTAR PERSONALIZADO 2028", "2028-01-01"), true)
  // Sin fecha se toma el año actual
  const anioActual = new Date().getFullYear()
  assert.equal(servicioCorrespondeAlAnio(`VESTIDO ${anioActual}`, ""), true)
  assert.equal(servicioCorrespondeAlAnio(`VESTIDO ${anioActual + 1}`, ""), false)
})

test("regla de personal: 1 cada N con mínimo, y avisa si falta gente en el roster", () => {
  const reglas = [
    { funcion: "Cocinero", cadaNInvitados: 50, minimo: 1, activo: true },
    { funcion: "Mozo", cadaNInvitados: 25, minimo: 2, activo: true },
    { funcion: "Bachero", cadaNInvitados: 0, minimo: 1, activo: true },
    { funcion: "Coordinador", cadaNInvitados: 100, minimo: 0, activo: false },
  ]
  const roster = [
    { id: "c1", nombre: "A", apellido: "A", funcion: "Cocinero" },
    { id: "m1", nombre: "B", apellido: "B", funcion: "Mozo" },
    { id: "m2", nombre: "C", apellido: "C", funcion: "Mozo" },
    { id: "b1", nombre: "D", apellido: "D", funcion: "Bachero" },
  ]
  const r = calcularPersonalSugerido(reglas, 75, roster)

  const cocinero = r.find((x) => x.funcion === "Cocinero")
  assert.equal(cocinero.necesarios, 2, "ceil(75/50) = 2")
  assert.equal(cocinero.faltan, 1, "solo hay 1 cocinero en el roster")

  const mozo = r.find((x) => x.funcion === "Mozo")
  assert.equal(mozo.necesarios, 3, "ceil(75/25) = 3")
  assert.equal(mozo.personalIds.length, 2)
  assert.equal(mozo.faltan, 1)

  const bachero = r.find((x) => x.funcion === "Bachero")
  assert.equal(bachero.necesarios, 1, "sin 'cada N' manda el mínimo")
  assert.equal(bachero.faltan, 0)

  assert.equal(r.find((x) => x.funcion === "Coordinador"), undefined, "las reglas inactivas no cuentan")
})

test("sin salón elegido no rompe: total 0 y aviso", () => {
  const r = calcularCotizacion(base({ salon: "" }))
  assert.equal(r.total, 0)
  assert.equal(r.origenPrecioSalon, "sin_precio")
})


// ─── Lo que incluye el salón ─────────────────────────────────────────────

test("con precio de grilla, lo que trae el salón no se cobra", () => {
  const r = calcularCotizacion(base({
    serviciosIncluidosSalon: INCLUIDOS_SALON,
    serviciosElegidos: [
      { servicioId: "mesas", cantidad: 1 },
      { servicioId: "dj", cantidad: 1 },
      { servicioId: "pantalla", cantidad: 1 },
    ],
  }))
  const mesas = r.servicios.find((s) => s.servicioId === "mesas")
  const dj = r.servicios.find((s) => s.servicioId === "dj")
  assert.equal(mesas.incluidoEnPaquete, true)
  assert.equal(mesas.motivoIncluido, "salon")
  assert.equal(mesas.precioTotal, 0)
  assert.equal(dj.precioTotal, 0)
  assert.equal(r.totalServicios, 400000, "solo la pantalla suma")
  assert.equal(r.total, 4700000, "el precio del salón no cambia")
})

test("con precio del Calendario también van incluidos", () => {
  const r = calcularCotizacion(base({
    preciosVenta: { Quinta: { "2026-10-03": 5000000 } },
    serviciosIncluidosSalon: INCLUIDOS_SALON,
    serviciosElegidos: [{ servicioId: "mesas", cantidad: 1 }],
  }))
  assert.equal(r.origenPrecioSalon, "calendario")
  assert.equal(r.servicios[0].precioTotal, 0)
  assert.equal(r.total, 5000000)
})

test("sin precio de lista del salón, lo incluido se cobra como cualquier adicional", () => {
  const sinGrilla = calcularCotizacion(base({
    salon: "Casona",
    serviciosIncluidosSalon: INCLUIDOS_SALON,
    serviciosElegidos: [{ servicioId: "mesas", cantidad: 1 }],
  }))
  assert.equal(sinGrilla.origenPrecioSalon, "sin_precio")
  assert.equal(sinGrilla.servicios[0].incluidoEnPaquete, false)
  assert.equal(sinGrilla.servicios[0].precioTotal, 180000, "se cobra")
  assert.equal(sinGrilla.total, 180000, "el salón aporta 0")

  const sinPrecio = calcularCotizacion(base({
    salon: "Salon 5",
    serviciosIncluidosSalon: INCLUIDOS_SALON,
    serviciosElegidos: [{ servicioId: "dj", cantidad: 1 }],
  }))
  assert.equal(sinPrecio.servicios[0].precioTotal, 220000, "se cobra")
})

test("con catering, el menú se incluye por catering y las mesas por el salón", () => {
  const r = calcularCotizacion(base({
    modalidad: "con_catering",
    serviciosIncluidosSalon: INCLUIDOS_SALON,
    serviciosElegidos: [
      { servicioId: "menu-asado", cantidad: 1 },
      { servicioId: "mesas", cantidad: 1 },
      { servicioId: "pantalla", cantidad: 1 },
    ],
  }))
  assert.equal(r.servicios.find((s) => s.servicioId === "menu-asado").motivoIncluido, "catering")
  assert.equal(r.servicios.find((s) => s.servicioId === "mesas").motivoIncluido, "salon")
  assert.equal(r.totalServicios, 400000)
  assert.equal(r.total, 8700000)
})

test("origenEsPrecioDeLista: grilla y calendario sí; sin precio no", () => {
  assert.equal(origenEsPrecioDeLista("calendario"), true)
  assert.equal(origenEsPrecioDeLista("tarifario"), true)
  assert.equal(origenEsPrecioDeLista("tarifario_aproximado"), true)
  assert.equal(origenEsPrecioDeLista("sin_precio"), false)
})

test("el personal del salón cambia con el día del evento", () => {
  const incluidos = [
    { personalId: "portero-v", dia: "viernes" },
    { personalId: "limpieza-v", dia: "viernes" },
    { personalId: "coord-v", dia: "viernes" },
    { personalId: "portero-s", dia: "sabado" },
    { personalId: "limpieza-s", dia: "sabado" },
    { personalId: "coord-s", dia: "sabado" },
  ]
  assert.deepEqual(personalIncluidoDelSalon(incluidos, "2026-10-03"), ["portero-s", "limpieza-s", "coord-s"], "sábado")
  assert.deepEqual(personalIncluidoDelSalon(incluidos, "2026-10-02"), ["portero-v", "limpieza-v", "coord-v"], "viernes")
  assert.deepEqual(personalIncluidoDelSalon(incluidos, "2026-10-04"), ["portero-v", "limpieza-v", "coord-v"], "domingo = viernes")
  assert.deepEqual(personalIncluidoDelSalon(incluidos, ""), ["portero-v", "limpieza-v", "coord-v"], "sin fecha = viernes")
})

test("cambiar la fecha cambia el juego de personal del salón", () => {
  const incluidos = [
    { personalId: "portero-v", dia: "viernes" },
    { personalId: "limpieza-v", dia: "viernes" },
    { personalId: "coord-v", dia: "viernes" },
    { personalId: "portero-s", dia: "sabado" },
    { personalId: "limpieza-s", dia: "sabado" },
    { personalId: "coord-s", dia: "sabado" },
  ]

  // Arranca vacío y se elige un sábado: entran los tres del sábado.
  const enSabado = ajustarPersonalDelSalonPorDia([], incluidos, "2026-10-03")
  assert.deepEqual([...enSabado].sort(), ["coord-s", "limpieza-s", "portero-s"])

  // Se pasa a viernes: salen los del sábado y entran los del viernes.
  const enViernes = ajustarPersonalDelSalonPorDia(enSabado, incluidos, "2026-10-02")
  assert.deepEqual([...enViernes].sort(), ["coord-v", "limpieza-v", "portero-v"])
  assert.ok(!enViernes.includes("portero-s"), "el portero del sábado quedó destildado")
  assert.ok(!enViernes.includes("limpieza-s"), "la limpieza del sábado quedó destildada")
  assert.ok(!enViernes.includes("coord-s"), "la coordinación del sábado quedó destildada")

  // Lo que el vendedor agregó a mano no se toca.
  const conExtras = ajustarPersonalDelSalonPorDia(["mozo-1", "barman-1", ...enViernes], incluidos, "2026-10-03")
  assert.ok(conExtras.includes("mozo-1") && conExtras.includes("barman-1"), "no se tocan los agregados a mano")
  assert.deepEqual([...conExtras].sort(), ["barman-1", "coord-s", "limpieza-s", "mozo-1", "portero-s"])

  // Si el vendedor destildó uno del día, volver a la misma fecha lo repone
  // (es el mismo efecto que corre al cambiar salón o día).
  const sinPortero = enViernes.filter((id) => id !== "portero-v")
  assert.ok(ajustarPersonalDelSalonPorDia(sinPortero, incluidos, "2026-10-02").includes("portero-v"))

  // Domingo y sin fecha usan el juego de viernes.
  assert.deepEqual([...ajustarPersonalDelSalonPorDia([], incluidos, "2026-10-04")].sort(), ["coord-v", "limpieza-v", "portero-v"])
  assert.deepEqual([...ajustarPersonalDelSalonPorDia([], incluidos, "")].sort(), ["coord-v", "limpieza-v", "portero-v"])
})

test("lo incluido por el salón no genera aviso de servicio en $0", () => {
  const catalogo = [...CATALOGO.filter((s) => s.id !== "mesas"), { id: "mesas", nombre: "MESAS", categoria: "Salon y Espacio", unidad: "Fijo", precioVenta: 0 }]
  const r = calcularCotizacion(base({
    catalogoServicios: catalogo,
    serviciosIncluidosSalon: ["mesas"],
    serviciosElegidos: [{ servicioId: "mesas", cantidad: 1 }],
  }))
  assert.equal(r.fueraDeTarifario, false, "está incluido, que valga $0 no es un problema")
  assert.deepEqual(r.avisos, [])
})

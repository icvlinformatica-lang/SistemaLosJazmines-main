// Cobranza en "Vienen a pagar": recordatorio por WhatsApp, atrasadas a la
// vista y teléfono del cliente. Todo es pantalla: no cambia ningún monto.
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith("@/") ? path.join(__dirname, "..", request.slice(2)) : request, ...args)
}
const compilar = (jsx) => (mod, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) } })
  mod._compile(result.outputText, filename)
}
require.extensions[".ts"] = compilar(false)
require.extensions[".tsx"] = compilar(true)

const { mensajeRecordatorioCuota, enlaceWhatsApp } = require("../lib/recordatorio-cuota.ts")
const { contarCuotasAtrasadas, agruparCuotasPorSalon, claveCuotaVienenAPagar, sinCuotasParaMasTarde } = require("../lib/vienen-a-pagar.ts")

test("mensaje de recordatorio: vence / venció, con monto y fecha día/mes/año", () => {
  assert.equal(
    mensajeRecordatorioCuota({ nombre: "Ana y Juan", numeroCuota: 3, monto: 150000, fechaVencimiento: "2026-10-10", vencida: false }),
    `Hola Ana y Juan, te escribimos de Los Jazmines para recordarte que la cuota 3 de $${(150000).toLocaleString("es-AR")} vence el 10/10/2026. ¡Gracias!`,
  )
  assert.match(
    mensajeRecordatorioCuota({ nombre: "Ana", numeroCuota: 2, monto: 1000, fechaVencimiento: "2026-09-10", vencida: true }),
    /que la cuota 2 de \$1\.?000 venció el 10\/09\/2026\. ¡Gracias!$/,
  )
  // Con IPC a definir no se manda un monto que todavía no es el definitivo.
  assert.match(
    mensajeRecordatorioCuota({ nombre: "Ana", numeroCuota: 4, monto: 999, fechaVencimiento: "2026-11-10", vencida: false, montoADefinir: true }),
    /que la cuota 4 vence el 10\/11\/2026/,
  )
})

test("enlace de WhatsApp: número normalizado y texto codificado; sin teléfono usable no hay enlace", () => {
  assert.equal(enlaceWhatsApp("011 4444-5555", "Hola & chau"), "https://wa.me/5491144445555?text=Hola%20%26%20chau")
  assert.equal(enlaceWhatsApp("011 4444-5555"), "https://wa.me/5491144445555")
  assert.equal(enlaceWhatsApp("", "Hola"), null)
  assert.equal(enlaceWhatsApp("123", "Hola"), null)
  assert.equal(enlaceWhatsApp(undefined), null)
})

const lista = [
  { eventoId: "e1", evento: "Ana", salon: "Quinta", salonId: "Quinta", fechaEvento: "2026-12-01", telefono: "011 4444-5555", cuotaSemana: null, montoAtrasado: 300, cuotasAtrasadas: 2,
    cuotasPendientes: [
      { numero: 1, fechaVencimiento: "2026-08-10", monto: 100, atrasada: true, diasAtraso: 60, recargo: 0 },
      { numero: 2, fechaVencimiento: "2026-09-10", monto: 200, atrasada: true, diasAtraso: 29, recargo: 0 },
      { numero: 3, fechaVencimiento: "2026-10-10", monto: 300, atrasada: false, diasAtraso: 0, recargo: 0 },
    ] },
  { eventoId: "e2", evento: "Beto", salon: "Casona", salonId: "Casona", fechaEvento: "2026-11-01", cuotaSemana: null, montoAtrasado: 0, cuotasAtrasadas: 0,
    cuotasPendientes: [{ numero: 1, fechaVencimiento: "2026-10-11", monto: 50, atrasada: false, diasAtraso: 0, recargo: 0 }] },
]

test("el número del botón de Inicio sale de la misma agrupación que el modal", () => {
  assert.equal(contarCuotasAtrasadas(lista), 2)
  assert.equal(contarCuotasAtrasadas([]), 0)
  const grupos = agruparCuotasPorSalon(lista)
  assert.equal(grupos.reduce((s, g) => s + g.totalAtrasado, 0), 300)
  // El teléfono del evento llega a cada cuota.
  assert.ok(grupos.find((g) => g.salon === "Quinta").cuotas.every((c) => c.telefono === "011 4444-5555"))
})

test("el modal muestra las tarjetas por salón, el botón de recargo, la etiqueta ATRASADA y WhatsApp", () => {
  const React = require("react")
  const { renderToStaticMarkup } = require("react-dom/server")
  const load = Module._load
  Module._load = function (request, ...args) {
    if (request === "swr") return { __esModule: true, default: () => ({ data: { vienenAPagar: lista }, isLoading: false, mutate: () => {} }) }
    if (request === "@/lib/store-context") return { useStore: () => ({ state: { eventos: [] }, configuracionCajas: { salones: {} } }) }
    if (request === "@/lib/profile-context") return { useProfile: () => ({ perfilActivo: { id: "administracion" } }) }
    return load.call(this, request, ...args)
  }
  try {
    const { VienenAPagarModal } = require("../components/vienen-a-pagar-modal.tsx")
    const html = renderToStaticMarkup(React.createElement(VienenAPagarModal, { open: true, onOpenChange: () => {} }))
    // La tarjeta roja de atrasado y el selector de salón se sacaron: se filtra tocando las tarjetas por salón.
    assert.doesNotMatch(html, /Atrasado · /)
    assert.doesNotMatch(html, /Filtrar por salón/)
    assert.match(html, /Falta entrar si se pagan todas las cuotas de/)
    assert.equal((html.match(/aria-pressed=/g) || []).length, 8) // "Todos" + los 5 salones + Sin/Con recargo
    // Al abrir, todas las tarjetas están plegadas: no se ve el desglose por caja.
    assert.equal((html.match(/aria-expanded="false"/g) || []).length, 6)
    assert.doesNotMatch(html, /Caja Eventos|Caja Jazmines/)
    assert.match(html, /Por cobrar esta semana · 2 cuotas/)
    assert.equal((html.match(/>ATRASADA</g) || []).length, 2)
    // "Solo atrasadas" se sacó a pedido del dueño.
    assert.doesNotMatch(html, /Solo atrasadas/)
    assert.match(html, />Sin recargo</)
    assert.match(html, />Con recargo</)
    // Ana tiene teléfono: tel: y WhatsApp en sus 3 filas; Beto no tiene, no lleva botón.
    assert.equal((html.match(/href="tel:01144445555"/g) || []).length, 3)
    assert.equal((html.match(/href="https:\/\/wa\.me\/5491144445555\?text=/g) || []).length, 3)
    assert.equal((html.match(/wa\.me/g) || []).length, 3)
    assert.match(html, /venci%C3%B3%20el%2010%2F08%2F2026/)
  } finally { Module._load = load }
})

test("el teléfono sale del contrato (aunque venga como texto dentro del jsonb) y la consulta lo pide", async () => {
  const consultas = []
  const load = Module._load
  Module._load = function (request, ...args) {
    if (request === "@/lib/db") return { sql: async (parts) => {
      const query = parts.join("?")
      consultas.push(query)
      if (query.includes("FROM historial_ipc")) return []
      return [{ id: "e1", nombre: "Ana", salon: "Quinta", fecha: "2026-12-01", estado: "pendiente", pagos: "[]",
        plan_de_cuotas: JSON.stringify({ numeroCuotas: 1, montoCuota: 100, cuotas: [{ numero: 1, fechaVencimiento: "2026-10-01", montoCuota: 100 }] }),
        contrato: JSON.stringify({ telefono: " 011 4444-5555 ", dni: "no se usa" }) },
      { id: "e2", nombre: "Beto", salon: "Quinta", fecha: "2026-12-02", estado: "pendiente", pagos: [],
        plan_de_cuotas: { numeroCuotas: 1, montoCuota: 100, cuotas: [{ numero: 1, fechaVencimiento: "2026-10-01", montoCuota: 100 }] }, contrato: null }]
    } }
    return load.call(this, request, ...args)
  }
  try {
    delete require.cache[require.resolve("../lib/resumen-diario.ts")]
    const { buildVienenAPagar } = require("../lib/resumen-diario.ts")
    const { vienenAPagar } = await buildVienenAPagar("2026-10-09")
    assert.ok(consultas.some((q) => /plan_de_cuotas, contrato/.test(q)))
    assert.equal(vienenAPagar.find((v) => v.eventoId === "e1").telefono, "011 4444-5555")
    assert.equal(vienenAPagar.find((v) => v.eventoId === "e2").telefono, undefined)
    // Solo se agrega el teléfono: el DNI del contrato no viaja.
    assert.ok(!JSON.stringify(vienenAPagar).includes("no se usa"))
  } finally { Module._load = load }
})

test("por entrar del mes: suma por salón hasta fin de mes (con atrasadas) y reparte entre cajas", () => {
  const { porEntrarDelMesPorSalon, finDeMes } = require("../lib/vienen-a-pagar.ts")
  assert.equal(finDeMes("2026-10-13"), "2026-10-31")
  assert.equal(finDeMes("2028-02-05"), "2028-02-29")
  const ingresos = [
    // Atrasada de septiembre: suma. Saldo $100.000, a Caja Eventos $40.000.
    { salon: "Casona", fechaVencimiento: "2026-09-10", monto: 40000, saldoRestante: 100000 },
    // Vence el último día del mes: suma.
    { salon: "Casona", fechaVencimiento: "2026-10-31", monto: 33333.333, saldoRestante: 50000 },
    // Noviembre: no suma.
    { salon: "Casona", fechaVencimiento: "2026-11-01", monto: 1, saldoRestante: 1 },
    // Evento con costo 0: todo a Jazmines.
    { salon: "Quinta", fechaVencimiento: "2026-10-10", monto: 0, saldoRestante: 75000 },
    // Salón que no está en la lista: se ignora.
    { salon: "", fechaVencimiento: "2026-10-10", monto: 5, saldoRestante: 10 },
  ]
  assert.deepEqual(porEntrarDelMesPorSalon(ingresos, "2026-10-13", ["Quinta", "Casona", "Salon", "Salon 4", "Salon 5"]), [
    { salon: "Quinta", cajaEventos: 0, cajaJazmines: 75000 },
    { salon: "Casona", cajaEventos: 73333.33, cajaJazmines: 76666.67 },
    { salon: "Salon", cajaEventos: 0, cajaJazmines: 0 },
    { salon: "Salon 4", cajaEventos: 0, cajaJazmines: 0 },
    { salon: "Salon 5", cajaEventos: 0, cajaJazmines: 0 },
  ])
})

test("tarjeta desplegada: Administración ve el reparto entre cajas; Cobrar cuota solo el total", () => {
  const React = require("react")
  const { renderToStaticMarkup } = require("react-dom/server")
  const { TarjetaPorEntrar } = require("../components/vienen-a-pagar-modal.tsx")
  const fila = { salon: "Casona", cajaEventos: 1000, cajaJazmines: 2000 }
  const props = { fila, color: "#2563eb", elegida: true, desplegada: true, onClick: () => {} }
  const admin = renderToStaticMarkup(React.createElement(TarjetaPorEntrar, { ...props, veCajas: true }))
  assert.match(admin, /aria-expanded="true"/)
  assert.match(admin, /Caja Eventos/)
  assert.match(admin, /Caja Jazmines/)
  assert.match(admin, /\$3\.?000/)
  const cobro = renderToStaticMarkup(React.createElement(TarjetaPorEntrar, { ...props, veCajas: false }))
  assert.match(cobro, /\$3\.?000/)
  assert.doesNotMatch(cobro, /Caja Eventos|Caja Jazmines/)
  // Plegada: una sola línea, sin desglose aunque sea Administración.
  const plegada = renderToStaticMarkup(React.createElement(TarjetaPorEntrar, { ...props, desplegada: false, veCajas: true }))
  assert.match(plegada, /inline-flex/)
  assert.doesNotMatch(plegada, /Caja Eventos/)
})

test("Cobrar cuota ve el total de cada salón pero no el reparto entre cajas", () => {
  const React = require("react")
  const { renderToStaticMarkup } = require("react-dom/server")
  const load = Module._load
  Module._load = function (request, ...args) {
    if (request === "swr") return { __esModule: true, default: () => ({ data: { vienenAPagar: [] }, isLoading: false, mutate: () => {} }) }
    if (request === "@/lib/store-context") return { useStore: () => ({ state: { eventos: [] }, configuracionCajas: { salones: {} } }) }
    if (request === "@/lib/profile-context") return { useProfile: () => ({ perfilActivo: { id: "cobro" } }) }
    return load.call(this, request, ...args)
  }
  try {
    delete require.cache[require.resolve("../components/vienen-a-pagar-modal.tsx")]
    const { VienenAPagarModal } = require("../components/vienen-a-pagar-modal.tsx")
    const html = renderToStaticMarkup(React.createElement(VienenAPagarModal, { open: true, onOpenChange: () => {} }))
    assert.equal((html.match(/aria-pressed=/g) || []).length, 8)
    assert.doesNotMatch(html, /Caja Eventos|Caja Jazmines/)
  } finally { Module._load = load }
})

test("por entrar con recargo: $3.000 por día de atraso, repartido entre cajas con la misma proporción", () => {
  const { porEntrarDelMesPorSalon } = require("../lib/vienen-a-pagar.ts")
  const ingresos = [
    // Vencida hace 3 días: recargo $9.000. Proporción a Eventos 40 % → $3.600 más a Eventos y $5.400 a Jazmines.
    { salon: "Casona", fechaVencimiento: "2026-10-10", monto: 40000, saldoRestante: 100000 },
    // Todavía no venció: sin recargo.
    { salon: "Casona", fechaVencimiento: "2026-10-20", monto: 10000, saldoRestante: 20000 },
  ]
  const sin = porEntrarDelMesPorSalon(ingresos, "2026-10-13", ["Casona"])
  const con = porEntrarDelMesPorSalon(ingresos, "2026-10-13", ["Casona"], true)
  assert.deepEqual(sin, [{ salon: "Casona", cajaEventos: 50000, cajaJazmines: 70000 }])
  assert.deepEqual(con, [{ salon: "Casona", cajaEventos: 53600, cajaJazmines: 75400 }])
})

test("ver más tarde: saca solo esa cuota de ese evento y sin nada guardado no saca ninguna", () => {
  const cuotas = [
    { eventoId: "e1", evento: "Ana", numero: 2, salon: "Casona" },
    { eventoId: "e1", evento: "Ana", numero: 3, salon: "Casona" },
    { eventoId: "e2", evento: "Juan", numero: 2, salon: "Quinta" },
    { eventoId: "", evento: "Sin id", numero: 1, salon: "Salon" },
  ]
  assert.equal(sinCuotasParaMasTarde(cuotas, new Set()), cuotas)
  const paraMasTarde = new Set([claveCuotaVienenAPagar(cuotas[0]), claveCuotaVienenAPagar(cuotas[3])])
  assert.deepEqual(sinCuotasParaMasTarde(cuotas, paraMasTarde).map((c) => `${c.evento} ${c.numero}`), ["Ana 3", "Juan 2"])
})

test("ver más tarde: se vacía al cerrar la ventana y no se guarda en ningún lado", () => {
  const fuente = fs.readFileSync(path.join(__dirname, "..", "components", "vienen-a-pagar-modal.tsx"), "utf8")
  assert.match(fuente, /if \(!open\) \{[^}]*setParaMasTarde\(new Set\(\)\)/)
  assert.doesNotMatch(fuente, /localStorage|sessionStorage/)
})

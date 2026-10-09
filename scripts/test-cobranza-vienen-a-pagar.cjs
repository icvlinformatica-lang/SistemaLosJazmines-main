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
const { contarCuotasAtrasadas, agruparCuotasPorSalon } = require("../lib/vienen-a-pagar.ts")

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

test("el modal muestra el recuadro de atrasadas, la etiqueta ATRASADA, el filtro y WhatsApp", () => {
  const React = require("react")
  const { renderToStaticMarkup } = require("react-dom/server")
  const load = Module._load
  Module._load = function (request, ...args) {
    if (request === "swr") return { __esModule: true, default: () => ({ data: { vienenAPagar: lista }, isLoading: false, mutate: () => {} }) }
    if (request === "@/lib/store-context") return { useStore: () => ({ state: { eventos: [] }, configuracionCajas: { salones: {} } }) }
    return load.call(this, request, ...args)
  }
  try {
    const { VienenAPagarModal } = require("../components/vienen-a-pagar-modal.tsx")
    const html = renderToStaticMarkup(React.createElement(VienenAPagarModal, { open: true, onOpenChange: () => {} }))
    assert.match(html, /Atrasado · 2 cuotas/)
    assert.match(html, /\$300/)
    assert.match(html, /Por cobrar esta semana · 2 cuotas/)
    assert.equal((html.match(/>ATRASADA</g) || []).length, 2)
    assert.match(html, /Solo atrasadas/)
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

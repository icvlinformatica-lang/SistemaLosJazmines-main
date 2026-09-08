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
require.extensions[".ts"] = (mod, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  mod._compile(result.outputText, filename)
}
const { fechaResumenValida, cambiarDiaResumen, fechaArgentina, rangoFinde } = require("../lib/resumen-fecha.ts")
const { agruparCuotasPorSalon } = require("../lib/vienen-a-pagar.ts")
const consultas = []
let movimientos = []
let eventos = []
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: async (parts, ...values) => {
    const query = parts.join("?")
    consultas.push({ query, values })
    return query.includes("FROM movimientos_caja") ? movimientos : eventos
  } }
  return load.call(this, request, ...args)
}
let buildResumenDiario, hoyArgentina, GET
try {
  ;({ buildResumenDiario, hoyArgentina } = require("../lib/resumen-diario.ts"))
  ;({ GET } = require("../app/api/resumen-diario/route.ts"))
} finally { Module._load = load }

test("valida días reales y años bisiestos", () => {
  for (const fecha of ["2024-02-29", "2026-09-08", "0001-01-01", "9999-12-31"]) assert.equal(fechaResumenValida(fecha), true)
  for (const fecha of ["", "2026-02-29", "2026-04-31", "2026-13-01", "0000-01-01", "2026-9-8", "2026-09-08T00:00:00Z"]) assert.equal(fechaResumenValida(fecha), false)
})
test("navega entre meses y años sin cambiar por zona horaria", () => {
  assert.equal(cambiarDiaResumen("2026-01-01", -1), "2025-12-31")
  assert.equal(cambiarDiaResumen("2024-02-28", 1), "2024-02-29")
  assert.equal(cambiarDiaResumen("2026-03-01", -1), "2026-02-28")
  assert.equal(cambiarDiaResumen("9999-12-31", 1), "9999-12-31")
  assert.equal(cambiarDiaResumen("0001-01-01", -1), "0001-01-01")
  assert.equal(fechaArgentina(new Date("2026-09-09T02:59:59Z")), "2026-09-08")
})
test("consulta día histórico completo, filtra por Argentina y no limita a 500", async () => {
  consultas.length = 0
  movimientos = Array.from({ length: 601 }, () => ({ tipo: "ingreso", concepto: "Cuota", monto: 1, salon: "Quinta", caja_destino: "caja_eventos", fecha: "2024-02-29" }))
  movimientos.push({ tipo: "egreso", monto: 10, salon: "admin", caja_destino: "caja_jazmines", fecha: "2024-03-01T02:59:59Z" })
  movimientos.push({ tipo: "ingreso", monto: 9999, fecha: "2024-03-01T03:00:00Z" })
  eventos = [{ nombre: "Evento de prueba", salon: "Quinta", pagos: [{ monto: 50, fecha: "2024-02-29" }, { monto: 900, fecha: "2024-03-01" }] }]
  const resumen = await buildResumenDiario("2024-02-29")
  assert.equal(resumen.fecha, "2024-02-29")
  assert.equal(resumen.ingresoCajaEventos, 601)
  assert.equal(resumen.egresoCajaJazmines, 10)
  assert.equal(resumen.cantidadMovimientos, 602)
  assert.equal(resumen.totalCuotas, 50)
  assert.equal(resumen.movimientosImportantes.length, 10)
  assert.deepEqual(consultas[0].values, ["2024-02-28", "2024-03-01"])
  assert.match(consultas[0].query, /LEFT\(fecha, 10\) BETWEEN/)
  assert.doesNotMatch(consultas[0].query, /LIMIT|NOW\(\)|created_at\s*>=/)
})
test("API rechaza fechas inválidas antes de consultar", async () => {
  consultas.length = 0
  for (const fecha of ["", "2026-02-30", "texto"]) {
    const response = await GET(new Request(`http://localhost/api/resumen-diario?fecha=${fecha}`))
    assert.equal(response.status, 400)
  }
  assert.equal(consultas.length, 0)
})
test("el finde elegido comprende viernes a domingo y permite cambiar de año", () => {
  for (const fecha of ["2026-09-07", "2026-09-11", "2026-09-12", "2026-09-13"]) assert.deepEqual(rangoFinde(fecha), { desde: "2026-09-11", hasta: "2026-09-13" })
  assert.deepEqual(rangoFinde("2025-12-31"), { desde: "2026-01-02", hasta: "2026-01-04" })
  assert.deepEqual(rangoFinde(cambiarDiaResumen("2026-01-02", -7)), { desde: "2025-12-26", hasta: "2025-12-28" })
})
test("cuenta cada cuota y divide por salón en columnas de cinco sin duplicados", async () => {
  movimientos = []
  const cuotas = Array.from({ length: 14 }, (_, i) => ({ numero: i + 1, fechaVencimiento: i < 3 ? "2026-08-10" : "2026-09-10", montoCuota: 100, pagada: i === 12 }))
  eventos = [
    { nombre: "Evento A", salon: "Salon", fecha: "2026-12-01", estado: "pendiente", plan_de_cuotas: { numeroCuotas: 14, montoCuota: 100, cuotasPagadas: [14], cuotas } },
    { nombre: "Evento B", salon: "Quinta", fecha: "2026-12-02", estado: "pendiente", plan_de_cuotas: { numeroCuotas: 1, montoCuota: 200, cuotas: [{ numero: 1, fechaVencimiento: "2026-09-11", montoCuota: 200 }] } },
    { nombre: "Cancelado", salon: "Salon", estado: "cancelado", plan_de_cuotas: { numeroCuotas: 14, cuotas } },
  ]
  const resumen = await buildResumenDiario("2026-09-08")
  assert.equal(resumen.vienenAPagar.length, 2)
  const grupos = agruparCuotasPorSalon(resumen.vienenAPagar)
  const salon = grupos.find((g) => g.salon === "Salon")
  assert.equal(salon.cuotas.length, 12)
  assert.equal(salon.cantidadSemana, 9)
  assert.equal(salon.cantidadAtrasada, 3)
  assert.equal(salon.totalSemana, 900)
  assert.equal(salon.totalAtrasado, 300)
  assert.deepEqual(salon.columnas.map((c) => c.length), [5, 5, 2])
  assert.equal(new Set(salon.columnas.flat().map((c) => c.numero)).size, 12)
  assert.equal(grupos.find((g) => g.salon === "Quinta").totalSemana, 200)
  assert.equal(grupos.filter((g) => g.salon === "Casona").length, 0)
  assert.deepEqual(agruparCuotasPorSalon([]), [])
})
test("Ver más muestra 5, 10, 15 y todas; ordena por fecha del evento entre salones", () => {
  const { limiteCuotasVisibles, ordenarCuotasPorEvento } = require("../lib/vienen-a-pagar.ts")
  const lista = Array.from({ length: 23 }, (_, i) => i)
  assert.deepEqual([0, 1, 2, 3].map((paso) => lista.slice(0, limiteCuotasVisibles(paso)).length), [5, 10, 15, 23])
  const cuota = { numero: 1, fechaVencimiento: "2026-08-01", monto: 100, atrasada: true }
  const grupos = agruparCuotasPorSalon([
    { salonId: "Quinta", evento: "Lejano", fechaEvento: "2027-01-01", cuotasPendientes: [cuota] },
    { salonId: "Salon", evento: "Próximo", fechaEvento: "2026-09-10", cuotasPendientes: [{ ...cuota, atrasada: false }] },
    { salonId: "Quinta", evento: "Intermedio", fechaEvento: "2026-10-10", cuotasPendientes: [cuota] },
    { salonId: "Salon", evento: "Sin fecha", fechaEvento: "", cuotasPendientes: [cuota] },
  ])
  assert.deepEqual(ordenarCuotasPorEvento(grupos).map((c) => c.evento), ["Próximo", "Intermedio", "Lejano", "Sin fecha"])
  assert.deepEqual(ordenarCuotasPorEvento(grupos.filter((g) => g.salon === "Quinta")).map((c) => c.evento), ["Intermedio", "Lejano"])
})
test("la vista muestra filtros, cantidades y cinco filas con Ver más", () => {
  const React = require("react")
  const { renderToStaticMarkup } = require("react-dom/server")
  require.extensions[".tsx"] = (mod, filename) => {
    const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    mod._compile(result.outputText, filename)
  }
  const cuotasPendientes = Array.from({ length: 12 }, (_, i) => ({ numero: i + 1, fechaVencimiento: "2026-09-10", monto: 100, atrasada: i < 2 }))
  Module._load = function (request, ...args) {
    if (request === "swr") return { __esModule: true, default: () => ({ data: { vienenAPagar: [{ evento: "Evento test", salon: "Salón", salonId: "Salon", fechaEvento: "2026-12-01", cuotasPendientes }] }, isLoading: false, mutate: () => {} }) }
    if (request === "@/lib/store-context") return { useStore: () => ({ state: { eventos: [] }, configuracionCajas: { salones: {} } }) }
    return load.call(this, request, ...args)
  }
  try {
    const store = require("../lib/store.ts")
    store.setSalonNombresCustom({ salones: { Salon: { nombre: "Salón personalizado" } } })
    const { VienenAPagarModal } = require("../components/vienen-a-pagar-modal.tsx")
    const html = renderToStaticMarkup(React.createElement(VienenAPagarModal, { open: true, onOpenChange: () => {} }))
    assert.match(html, /Filtrar por salón/)
    assert.match(html, /12 cuotas por pagar/)
    assert.match(html, /Salón personalizado/)
    assert.match(html, /aria-label="Cuotas por fecha del evento"/)
    assert.match(html, /Ver más/)
    assert.doesNotMatch(html, /Columnas de cuotas|overflow-x-auto/)
    assert.equal((html.match(/<li /g) || []).length, 5)
    const { FindeModal } = require("../components/finde-modal.tsx")
    const finde = renderToStaticMarkup(React.createElement(FindeModal, { open: true, onOpenChange: () => {} }))
    assert.match(finde, /Fin de semana anterior/)
    assert.match(finde, /Fin de semana siguiente/)
    assert.match(finde, /id="fecha-finde"/)
    store.setSalonNombresCustom(null)
  } finally { Module._load = load }
})
test("API transmite fecha elegida; sin fecha conserva hoy para el cron", async () => {
  movimientos = []; eventos = []
  const response = await GET(new Request("http://localhost/api/resumen-diario?fecha=2020-01-01"))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).fecha, "2020-01-01")
  const actual = await buildResumenDiario()
  assert.equal(actual.fecha, hoyArgentina())
  assert.equal(actual.cantidadMovimientos, 0)
})

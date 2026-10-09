// Eventos → Lista y alta de evento: orden por próximos, "Ya pasaron",
// búsqueda por DNI/teléfono, marca de pagos, aviso al finalizar y salones
// ocupados. Correr: node --test scripts/test-lista-eventos-pantalla.cjs
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
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (mod, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
  mod._compile(result.outputText, filename)
}
const { esPasadoSinFinalizar, entraEnFiltroDeLista, coincideBusquedaEvento, avisoEventoTodaviaNoPaso, FILTRO_YA_PASARON } = require("../lib/lista-eventos.ts")
const { estadoPagosEvento, textoEstadoPagos } = require("../lib/estado-pagos-evento.ts")
const { salonesOcupadosEnFecha } = require("../lib/salones-ocupados.ts")

const HOY = "2026-10-09"

test("un evento de ayer sin finalizar ya pasó; el de hoy y los sin fecha no", () => {
  assert.equal(esPasadoSinFinalizar({ estado: "pendiente", fecha: "2026-10-08" }, HOY), true)
  assert.equal(esPasadoSinFinalizar({ estado: "pendiente", fecha: HOY }, HOY), false)
  assert.equal(esPasadoSinFinalizar({ estado: "pendiente", fecha: "" }, HOY), false)
  assert.equal(esPasadoSinFinalizar({ estado: "completado", fecha: "2026-10-01" }, HOY), false)
})

test("Todos y cada estado muestran de hoy en adelante; Ya pasaron solo los pasados", () => {
  const pasado = { estado: "en_preparacion", fecha: "2026-09-30" }
  const proximo = { estado: "pendiente", fecha: "2026-11-14" }
  const completado = { estado: "completado", fecha: "2026-09-01" }
  assert.equal(entraEnFiltroDeLista(pasado, "todos", HOY), false)
  assert.equal(entraEnFiltroDeLista(pasado, "en_preparacion", HOY), false)
  assert.equal(entraEnFiltroDeLista(pasado, FILTRO_YA_PASARON, HOY), true)
  assert.equal(entraEnFiltroDeLista(proximo, "todos", HOY), true)
  assert.equal(entraEnFiltroDeLista(proximo, "pendiente", HOY), true)
  assert.equal(entraEnFiltroDeLista(proximo, "borrador", HOY), false)
  assert.equal(entraEnFiltroDeLista(proximo, FILTRO_YA_PASARON, HOY), false)
  assert.equal(entraEnFiltroDeLista(completado, "todos", HOY), false)
  assert.equal(entraEnFiltroDeLista(completado, FILTRO_YA_PASARON, HOY), false)
})

test("la búsqueda encuentra por nombre, DNI con o sin puntos y teléfono", () => {
  const ev = { nombre: "Casamiento", nombrePareja: "Ana y Leo", dniNovio1: "30.123.456", contrato: { dni: "28999111", telefono: "11 4444-5555" } }
  assert.equal(coincideBusquedaEvento(ev, ""), true)
  assert.equal(coincideBusquedaEvento(ev, "ana"), true)
  assert.equal(coincideBusquedaEvento(ev, "30123456"), true)
  assert.equal(coincideBusquedaEvento(ev, "30.123"), true)
  assert.equal(coincideBusquedaEvento(ev, "28.999.111"), true)
  assert.equal(coincideBusquedaEvento(ev, "4444-5555"), true)
  assert.equal(coincideBusquedaEvento(ev, "1144445555"), true)
  assert.equal(coincideBusquedaEvento(ev, "77777"), false)
  // Muy pocos dígitos o texto con letras: no se compara contra DNI/teléfono.
  assert.equal(coincideBusquedaEvento(ev, "30"), false)
  assert.equal(coincideBusquedaEvento(ev, "juan 301"), false)
})

const evento = (plan, extra = {}) => ({ id: "e1", estado: "pendiente", fecha: "2027-03-01", pagos: [], planDeCuotas: plan, ...extra })
const plan3 = (cuotas, extra = {}) => ({
  numeroCuotas: 3, montoCuota: 100000, montoTotal: 300000, diaVencimiento: 10, fechaInicioPlan: "2026-08-10",
  cuotasPagadas: [], cuotas, ...extra,
})

test("sin plan de cuotas no se marca nada", () => {
  assert.equal(estadoPagosEvento(evento(undefined), HOY), null)
  assert.equal(estadoPagosEvento(evento({ numeroCuotas: 0, montoCuota: 0, montoTotal: 0, diaVencimiento: 10, fechaInicioPlan: "" }), HOY), null)
})

test("cuotas vencidas antes de hoy y sin cobrar: N cuotas atrasadas", () => {
  // Vencen 10/8, 10/9 y 10/10: al 9/10 hay dos vencidas.
  const e = evento(plan3([]))
  assert.deepEqual(estadoPagosEvento(e, HOY), { tipo: "atrasado", cuotas: 2 })
  assert.equal(textoEstadoPagos(estadoPagosEvento(e, HOY)), "2 cuotas atrasadas")
  // La que vence hoy todavía no está atrasada.
  assert.deepEqual(estadoPagosEvento(e, "2026-10-10"), { tipo: "atrasado", cuotas: 2 })
  assert.deepEqual(estadoPagosEvento(e, "2026-10-11"), { tipo: "atrasado", cuotas: 3 })
})

test("cobradas por cuotasPagadas, por detalle o por pago con número: al día", () => {
  assert.deepEqual(estadoPagosEvento(evento(plan3([], { cuotasPagadas: [1] })), HOY), { tipo: "atrasado", cuotas: 1 })
  assert.equal(textoEstadoPagos({ tipo: "atrasado", cuotas: 1 }), "1 cuota atrasada")
  const porDetalle = plan3([
    { numero: 1, montoCuota: 100000, fechaVencimiento: "2026-08-10", montoPagadoNeto: 100000 },
    { numero: 2, montoCuota: 100000, fechaVencimiento: "2026-09-10", pagada: true },
  ])
  assert.deepEqual(estadoPagosEvento(evento(porDetalle), HOY), { tipo: "al_dia" })
  const porPago = evento(plan3([], { cuotasPagadas: [1] }), { pagos: [{ id: "p", monto: 100000, fecha: "2026-09-09", pagadoPor: "x", porcentajeIPC: 0, numeroCuota: 2 }] })
  assert.deepEqual(estadoPagosEvento(porPago, HOY), { tipo: "al_dia" })
  assert.equal(textoEstadoPagos({ tipo: "al_dia" }), "Al día")
})

test("una cuota cobrada en parte y vencida sigue atrasada", () => {
  const parcial = plan3([{ numero: 1, montoCuota: 100000, fechaVencimiento: "2026-08-10", montoPagadoNeto: 40000 }], { cuotasPagadas: [2] })
  assert.deepEqual(estadoPagosEvento(evento(parcial), HOY), { tipo: "atrasado", cuotas: 1 })
})

test("eventos finalizados o cancelados no llevan marca", () => {
  assert.equal(estadoPagosEvento(evento(plan3([]), { estado: "completado" }), HOY), null)
  assert.equal(estadoPagosEvento(evento(plan3([]), { estado: "cancelado" }), HOY), null)
})

test("aviso al finalizar solo si la fecha es posterior a hoy", () => {
  assert.equal(avisoEventoTodaviaNoPaso("2026-10-20", HOY), "Ojo: este evento es el 20/10/2026, todavía no pasó.")
  assert.equal(avisoEventoTodaviaNoPaso(HOY, HOY), null)
  assert.equal(avisoEventoTodaviaNoPaso("2026-10-01", HOY), null)
  assert.equal(avisoEventoTodaviaNoPaso("", HOY), null)
  assert.equal(avisoEventoTodaviaNoPaso(undefined, HOY), null)
})

test("salón ocupado: otro evento el mismo día en ese salón, sin contar el que se edita", () => {
  const eventos = [
    { id: "a", salon: "Casona", fecha: "2026-11-14" },
    { id: "b", salon: "Quinta", fecha: "2026-11-14" },
    { id: "c", salon: "Salon", fecha: "2026-11-15" },
  ]
  assert.deepEqual([...salonesOcupadosEnFecha(eventos, "2026-11-14", "nuevo")].sort(), ["Casona", "Quinta"])
  assert.deepEqual([...salonesOcupadosEnFecha(eventos, "2026-11-14", "a")], ["Quinta"])
  assert.deepEqual([...salonesOcupadosEnFecha(eventos, "", "nuevo")], [])
})

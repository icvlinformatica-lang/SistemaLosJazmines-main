// Planilla de cuotas (Cobrar cuota): buscador sin tildes ni mayúsculas,
// filtro "Solo con atrasos" y color de cada cuota. Solo pantalla.
// Correr: node --test scripts/test-planilla-cuotas-pantalla.cjs
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
const { normalizarBusqueda, coincideBusquedaPlanilla, tieneCuotasAtrasadas, tonoCuota } = require("../lib/planilla-cuotas.ts")
const { estadoPagosEvento } = require("../lib/estado-pagos-evento.ts")
const { generarCalendarioCuotas } = require("../lib/store.ts")
const { numerosPagados } = require("../lib/ipc-cuotas.ts")

const HOY = "2026-10-13"

// Plan de 4 cuotas de $100.000 con vencimientos fijos: agosto (pagada),
// 10/10 (sin cobrar: atrasada), 13/10 (vence hoy: del mes, todavía no
// atrasada) y noviembre (futura).
function eventoReferencia(extra = {}) {
  return {
    id: "ev-ref",
    nombre: "Casamiento",
    nombrePareja: "Martínez y Peña",
    estado: "pendiente",
    salon: "Casona",
    fecha: "2026-12-12",
    dniNovio1: "30.123.456",
    contrato: { nombreCompleto: "José Álvarez", dni: "28999111" },
    pagos: [],
    planDeCuotas: {
      numeroCuotas: 4,
      montoCuota: 100000,
      montoTotal: 400000,
      fechaInicioPlan: "2026-08-10",
      diaVencimiento: 10,
      cuotasPagadas: [1],
      cuotas: [
        { numero: 1, montoCuota: 100000, fechaVencimiento: "2026-08-10", pagada: true },
        { numero: 2, montoCuota: 100000, fechaVencimiento: "2026-10-10", pagada: false },
        { numero: 3, montoCuota: 100000, fechaVencimiento: "2026-10-13", pagada: false },
        { numero: 4, montoCuota: 100000, fechaVencimiento: "2026-11-10", pagada: false },
      ],
    },
    ...extra,
  }
}

function tonos(evento, hoy = HOY) {
  const pagadas = new Set(numerosPagados(evento))
  return generarCalendarioCuotas(evento).map((c) => [c.numeroCuota, c.fechaVencimiento, tonoCuota(c, pagadas, hoy)])
}

test("normaliza sin tildes ni mayúsculas", () => {
  assert.equal(normalizarBusqueda("  MartÍNEZ Peña "), "martinez pena")
  assert.equal(normalizarBusqueda(undefined), "")
})

test("busca por nombre, festejados, cliente del contrato y DNI", () => {
  const ev = eventoReferencia()
  assert.equal(coincideBusquedaPlanilla(ev, ""), true)
  assert.equal(coincideBusquedaPlanilla(ev, "martinez"), true)
  assert.equal(coincideBusquedaPlanilla(ev, "PEÑA"), true)
  assert.equal(coincideBusquedaPlanilla(ev, "pena"), true)
  assert.equal(coincideBusquedaPlanilla(ev, "jose alvarez"), true)
  assert.equal(coincideBusquedaPlanilla(ev, "casam"), true)
  assert.equal(coincideBusquedaPlanilla(ev, "30123456"), true)
  assert.equal(coincideBusquedaPlanilla(ev, "28.999.111"), true)
  assert.equal(coincideBusquedaPlanilla(ev, "Gómez"), false)
  assert.equal(coincideBusquedaPlanilla(ev, "77777"), false)
  // Muy pocos dígitos: no se compara contra DNI.
  assert.equal(coincideBusquedaPlanilla(ev, "30"), false)
})

test("caso de referencia: color de cada cuota al 13/10/2026", () => {
  assert.deepEqual(tonos(eventoReferencia()), [
    [1, "2026-08-10", "pagada"],
    [2, "2026-10-10", "atrasada"],
    [3, "2026-10-13", "este_mes"],
    [4, "2026-11-10", "futura"],
  ])
  // Al día siguiente la que vencía hoy pasa a atrasada.
  assert.equal(tonos(eventoReferencia(), "2026-10-14")[2][2], "atrasada")
})

test("una cuota pagada por un pago registrado (no por la marca del plan) es verde", () => {
  const ev = eventoReferencia({ pagos: [{ id: "p1", monto: 100000, fecha: "2026-10-11", numeroCuota: 2 }] })
  assert.equal(tonos(ev)[1][2], "pagada")
  assert.equal(tieneCuotasAtrasadas(ev, HOY), false)
})

test("Solo con atrasos usa la misma regla que la marca de Eventos → Lista", () => {
  const ev = eventoReferencia()
  assert.equal(tieneCuotasAtrasadas(ev, HOY), true)
  assert.deepEqual(estadoPagosEvento(ev, HOY), { tipo: "atrasado", cuotas: 1 })
  const rojas = tonos(ev).filter((t) => t[2] === "atrasada").length
  assert.equal(rojas, estadoPagosEvento(ev, HOY).cuotas)
  // Antes del 10/10 no había nada atrasado.
  assert.equal(tieneCuotasAtrasadas(ev, "2026-10-10"), false)
  // Finalizados y sin plan no cuentan.
  assert.equal(tieneCuotasAtrasadas(eventoReferencia({ estado: "completado" }), HOY), false)
  assert.equal(tieneCuotasAtrasadas(eventoReferencia({ planDeCuotas: undefined }), HOY), false)
})

test("el color no cambia los montos del calendario (solo pantalla)", () => {
  const ev = eventoReferencia()
  const antes = JSON.stringify(generarCalendarioCuotas(ev))
  tonos(ev)
  tieneCuotasAtrasadas(ev, HOY)
  assert.equal(JSON.stringify(generarCalendarioCuotas(ev)), antes)
  assert.deepEqual(generarCalendarioCuotas(ev).map((c) => c.monto), [100000, 100000, 100000, 100000])
})

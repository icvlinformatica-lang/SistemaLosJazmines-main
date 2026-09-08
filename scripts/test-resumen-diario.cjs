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
const { fechaResumenValida, cambiarDiaResumen, fechaArgentina } = require("../lib/resumen-fecha.ts")
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
test("API transmite fecha elegida; sin fecha conserva hoy para el cron", async () => {
  movimientos = []; eventos = []
  const response = await GET(new Request("http://localhost/api/resumen-diario?fecha=2020-01-01"))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).fecha, "2020-01-01")
  const actual = await buildResumenDiario()
  assert.equal(actual.fecha, hoyArgentina())
  assert.equal(actual.cantidadMovimientos, 0)
})

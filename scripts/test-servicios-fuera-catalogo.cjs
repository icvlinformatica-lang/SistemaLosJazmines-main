const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)
const { serviciosFueraDeCatalogo, quitarServicioFueraDeCatalogo } = require("../lib/servicios-fuera-catalogo.ts")

// El caso de MIA (27/10/2026): "FOTO + VIDEO" se borró del catálogo y quedó
// en el evento junto a "FOTOGRAFIA 2025".
const evento = [
  { servicioId: "pista", nombre: "PISTA LED", cantidad: 1, unidad: "Fijo", estadoPago: "sin_seña", montoSeña: 50000, saldoPendiente: 50000 },
  { servicioId: "fotovideo", nombre: "FOTO  + VIDEO", cantidad: 1, unidad: "Fijo", estadoPago: "sin_seña", montoSeña: 300000, saldoPendiente: 300000 },
  { servicioId: "foto2025", nombre: "FOTOGRAFIA 2025", cantidad: 1, unidad: "Fijo", estadoPago: "sin_seña", montoSeña: 250000, saldoPendiente: 250000 },
]
const catalogo = [
  { id: "pista", activo: true },
  { id: "foto2025", activo: true },
]

test("marca solo el servicio que ya no está en el catálogo, con su costo guardado", () => {
  assert.deepEqual(serviciosFueraDeCatalogo(evento, catalogo), [
    { servicioId: "fotovideo", nombre: "FOTO  + VIDEO", costoGuardado: 600000, tienePagos: false },
  ])
})

test("un servicio desactivado también queda fuera (la tabla solo muestra activos)", () => {
  const fuera = serviciosFueraDeCatalogo(evento, [{ id: "pista", activo: true }, { id: "foto2025", activo: false }])
  assert.deepEqual(fuera.map((f) => f.servicioId), ["fotovideo", "foto2025"])
})

test("con pagos (seña, saldo, legado o sueldo) no se ofrece quitarlo", () => {
  const conPagos = [
    { servicioId: "a", nombre: "A", estadoPago: "señado" },
    { servicioId: "b", nombre: "B", pagado: true },
    { servicioId: "c", nombre: "C", estadoPago: "sin_seña", pagoSueldo: { monto: 1, fecha: "2026-10-01" } },
    { servicioId: "d", nombre: "D" },
  ]
  assert.deepEqual(serviciosFueraDeCatalogo(conPagos, []).map((f) => f.tienePagos), [true, true, true, false])
})

test("quitar saca solo ese servicio y deja los demás como estaban", () => {
  const quedan = quitarServicioFueraDeCatalogo(evento, "fotovideo")
  assert.deepEqual(quedan, [evento[0], evento[2]])
  assert.equal(evento.length, 3)
})

// "Este finde" (Inicio): tocar la tarjeta de un evento lleva a sus costos,
// solo para los perfiles que pueden entrar a esa pantalla.
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

const { puedeEntrarARuta } = require("../lib/acceso-ruta.ts")
const { rangoFinde } = require("../lib/resumen-fecha.ts")

test("quién puede entrar a Costos del evento", () => {
  const ruta = "/eventos/costos"
  assert.equal(puedeEntrarARuta({ rutas: ["*"], rutasExcluidas: ["/eventos/produccion"] }, ruta), true) // Administración
  assert.equal(puedeEntrarARuta({ rutas: [] }, ruta), true) // lista vacía = acceso total
  assert.equal(puedeEntrarARuta({ rutas: ["/", "/eventos/pagos"] }, ruta), false) // Cobrar cuota
  assert.equal(puedeEntrarARuta({ rutas: ["/eventos"] }, ruta), true)
  assert.equal(puedeEntrarARuta({ rutas: ["*"], rutasExcluidas: ["/eventos/costos"] }, ruta), false)
  assert.equal(puedeEntrarARuta({ rutas: ["/eventos/costo"] }, ruta), false) // no alcanza con que empiece igual
  assert.equal(puedeEntrarARuta(null, ruta), false)
})

function renderFinde(perfilActivo) {
  const React = require("react")
  const { renderToStaticMarkup } = require("react-dom/server")
  const { desde } = rangoFinde()
  const evento = { id: "ev&1", nombre: "PRUEBA Finde", fecha: desde, salon: "Quinta", estado: "pendiente", servicios: [], personalEvento: [] }
  const load = Module._load
  Module._load = function (request, ...args) {
    if (request === "@/lib/store-context") return { useStore: () => ({ state: { eventos: [evento], recetas: [], insumos: [], cocteles: [], insumosBarra: [], personal: [], servicios: [], costosOperativos: [], pagosPersonal: [], movimientosCaja: [] }, configuracionCajas: { salones: {} } }) }
    if (request === "@/lib/clock-context") return { useClock: () => ({ ahora: new Date() }) }
    if (request === "@/lib/profile-context") return { useProfile: () => ({ perfilActivo }) }
    if (request === "@/lib/hooks/use-caja-eventos") return { calcularCajaEventos: () => ({ egresosPendientes: [] }) }
    return load.call(this, request, ...args)
  }
  try {
    delete require.cache[require.resolve("../components/finde-modal.tsx")]
    const { FindeModal } = require("../components/finde-modal.tsx")
    return renderToStaticMarkup(React.createElement(FindeModal, { open: true, onOpenChange: () => {} }))
  } finally { Module._load = load }
}

test("Administración: la tarjeta es un link a los costos del evento", () => {
  const html = renderFinde({ id: "administracion", rutas: ["*"], rutasExcluidas: ["/eventos/produccion"] })
  assert.match(html, /PRUEBA Finde/)
  assert.match(html, /href="\/eventos\/costos\?id=ev&amp;1"/)
  assert.match(html, /Ver costos del evento/)
})

test("Cobrar cuota: la tarjeta se ve igual pero no lleva a Costos", () => {
  const html = renderFinde({ id: "cobro", rutas: ["/", "/eventos/pagos"] })
  assert.match(html, /PRUEBA Finde/)
  assert.doesNotMatch(html, /\/eventos\/costos/)
  assert.doesNotMatch(html, /Ver costos del evento/)
})

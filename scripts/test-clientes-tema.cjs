// Vista de Clientes — el estilo del simulador según el festejo (lib/clientes-tema.ts).
// - Cada festejo tiene su estilo: el 15 femenino, el casamiento formal, lo
//   empresarial sobrio y el bautismo suave; el resto, el de la marca.
// - En todos los estilos el texto se lee (contraste AA de WCAG), también el
//   apagado, los botones, los avisos y el papel del presupuesto.
// - Las variables CSS que usa la pantalla están todas y sin valores vacíos.
// Es solo dibujo: no toca precios ni ninguna base.
// Correr: node --test scripts/test-clientes-tema.cjs
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

const tema = require(path.join(RAIZ, "lib", "clientes-tema.ts"))
const sim = require(path.join(RAIZ, "lib", "clientes-simulador.ts"))

test("cada festejo tiene su estilo (el 15, el casamiento, lo empresarial y el bautismo; el resto, el jardín)", () => {
  assert.equal(tema.temaDeFestejo("Cumpleaños de 15").id, "quince")
  assert.equal(tema.temaDeFestejo("Casamiento").id, "casamiento")
  assert.equal(tema.temaDeFestejo("Empresarial").id, "empresarial")
  assert.equal(tema.temaDeFestejo("Bautismo").id, "bautismo")
  for (const t of ["Cumpleaños", "Otro", null, undefined, "", "Algo nuevo"]) assert.equal(tema.temaDeFestejo(t).id, "jardin", String(t))
  // Todos los festejos que se ofrecen tienen un estilo de verdad.
  for (const t of sim.TIPOS_EVENTO_CLIENTE) assert.ok(tema.TEMAS[tema.temaDeFestejo(t).id], t)
})

test("el ánimo de cada uno: el 15 en cursiva y redondo, el casamiento con línea fina, lo empresarial sans y sin brillo", () => {
  const { quince, casamiento, empresarial, jardin } = tema.TEMAS
  assert.equal(quince.letra, "fiesta-italica")
  assert.ok(quince.radios.tarjeta > jardin.radios.tarjeta)
  assert.equal(casamiento.lineaBajoTitulo, true)
  assert.ok(casamiento.radios.tarjeta < jardin.radios.tarjeta)
  assert.equal(empresarial.letra, "sans")
  assert.equal(empresarial.brillo, 0)
  assert.ok(empresarial.radios.boton < 999)
})

test("en todos los estilos el texto se lee (AA)", () => {
  for (const t of Object.values(tema.TEMAS)) {
    const c = t.colores
    const ver = (nombre, a, b, minimo) => {
      const r = tema.contraste(a, b)
      assert.ok(r >= minimo, `${t.id}: ${nombre} da ${r.toFixed(2)} (pide ${minimo})`)
    }
    ver("texto sobre el fondo", c.texto, c.fondo, 7)
    ver("títulos sobre el fondo", c.titulo, c.fondo, 7)
    // El texto apagado: la pantalla nunca lo baja de 60 % (ni en el fondo,
    // ni en una tarjeta, ni en la elegida).
    ver("texto apagado en el fondo", tema.mezcla(c.texto, c.fondo, 0.6), c.fondo, 4.5)
    ver("texto apagado en tarjeta", tema.mezcla(c.texto, c.superficie, 0.6), c.superficie, 4.5)
    ver("texto apagado en la elegida", tema.mezcla(c.texto, c.elegido, 0.6), c.elegido, 4.5)
    ver("acento sobre tarjeta (el + $)", c.acento, c.superficie, 4.5)
    ver("texto de los botones", c.sobreAcento, c.acento, 4.5)
    ver("avisos sobre el fondo", c.alerta, c.fondo, 4.5)
    ver("tinta del presupuesto", c.tinta, c.papel, 7)
    ver("tinta apagada del presupuesto (al 70 %)", tema.mezcla(c.tinta, c.papel, 0.7), c.papel, 4.5)
    ver("borde de lo elegido", c.bordeElegido, c.superficie, 3)
  }
})

test("las variables CSS están todas, con valor", () => {
  const nombres = Object.keys(tema.variablesTema(tema.TEMAS.jardin)).sort()
  for (const t of Object.values(tema.TEMAS)) {
    const v = tema.variablesTema(t)
    assert.deepEqual(Object.keys(v).sort(), nombres, t.id)
    for (const [k, val] of Object.entries(v)) assert.ok(k.startsWith("--lj-") && String(val).trim(), `${t.id} ${k}`)
  }
  const e = tema.variablesTema(tema.TEMAS.empresarial)
  assert.equal(e["--lj-brillo"], "rgba(200, 213, 226, 0)") // sin brillo
  assert.equal(e["--lj-radio-boton"], "10px")
  assert.match(e["--lj-letra-titulo"], /Geist/)
  assert.equal(tema.variablesTema(tema.TEMAS.quince)["--lj-estilo-titulo"], "italic")
})

test("contraste y mezcla dan lo de WCAG", () => {
  assert.equal(tema.contraste("#000000", "#ffffff").toFixed(1), "21.0")
  assert.equal(tema.contraste("#ffffff", "#ffffff"), 1)
  assert.equal(tema.mezcla("#ffffff", "#000000", 0.5), "#808080")
  assert.equal(tema.rgba("#f3cf7a", 0.75), "rgba(243, 207, 122, 0.75)")
})

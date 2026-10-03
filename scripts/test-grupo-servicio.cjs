// Agrupado de servicios en el filtro de Por pagar (Caja Eventos): mismo
// servicio con distinto año o escritura = una sola pastilla.
// Correr: node --test scripts/test-grupo-servicio.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(out.outputText, filename)
}
const { grupoServicio, etiquetaGrupo } = require("../lib/grupo-servicio.ts")

const mismoGrupo = (nombres, grupo) => {
  for (const n of nombres) assert.equal(grupoServicio(n), grupo, n)
}

test("vestidos de todos los años y escrituras", () => {
  mismoGrupo(["VESTIDO", "vestido 2025", "VESTIDO 2025", "vestido 2026", "VESTIDO 2027", "VESTIDO 2028"], "VESTIDO")
})

test("fotografía de todos los años", () => {
  mismoGrupo(["FOTOGRAFIA 2025", "FOTOGRAFIA 2026", "FOTOGRAFIA 2027", "FOTOGRAFIA 2028"], "FOTOGRAFIA")
})

test("foto + video (todas las escrituras) va dentro de fotografía", () => {
  mismoGrupo(["FOTO + VIDEO", "FOTO  + VIDEO", "FOTO + VIDEO 2026", "FOTO-VIDEO 2027"], "FOTOGRAFIA")
})

test("altar y altar personalizado", () => {
  mismoGrupo(["ALTAR", "ALTAR PERSONALIZADO 2026", "ALTAR PERSONALIZADO 2027", "ALTAR PERSONALIZADO 2028"], "ALTAR")
})

test("maquillaje (incluye el typo MAQUILLA)", () => {
  mismoGrupo(["MAQUILLAJE PEINADO", "MAQUILLAJE PEINADO 2026", "MAQUILLA PEINADO 2027", "MAQUILLAJE PEINADO 2028"], "MAQUILLAJE PEINADO")
})

test("servicios distintos no se mezclan", () => {
  assert.notEqual(grupoServicio("PANTALLA LED"), grupoServicio("PISTA LED"))
  assert.equal(grupoServicio("PLATAFORMA 360"), "PLATAFORMA 360") // 360 no es un año
})

test("etiqueta conserva los acentos", () => {
  assert.equal(grupoServicio("INVITACIÓN DIGITAL"), "INVITACION DIGITAL")
  assert.equal(etiquetaGrupo("INVITACION DIGITAL", ["INVITACIÓN DIGITAL"]), "INVITACIÓN DIGITAL")
  assert.equal(etiquetaGrupo("VESTIDO", ["vestido 2025", "VESTIDO 2027"]), "VESTIDO")
})

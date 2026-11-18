// Catálogos que no llegaron al abrir el sistema (lib/catalogos-carga.ts).
// Caso real: 16/11/2026 21:05, /api/cocteles y /api/recetas dieron 500 y
// Cócteles decía "Todavía no hay cócteles cargados".
// Correr: node --test scripts/test-catalogos-carga.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")

require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  module._compile(outputText, filename)
}
const {
  catalogosFallidos,
  aplicarRecarga,
  textoCargaFallida,
  ESPERAS_REINTENTO_CARGA,
  URL_CATALOGO,
  CATALOGOS_CARGA,
} = require("../lib/catalogos-carga.ts")

test("lo que no vino como lista queda pendiente; una lista vacía es real", () => {
  const fallidos = catalogosFallidos({
    insumos: [{ id: "i1" }],
    insumosBarra: [],
    recetas: null,
    cocteles: null,
    barrasTemplates: [{ id: "b1" }],
  })
  assert.deepEqual(fallidos, ["recetas", "cocteles"])
})

test("al reintentar solo se pisan los pendientes que llegaron bien", () => {
  const { cambios, siguenPendientes } = aplicarRecarga(["recetas", "cocteles"], {
    recetas: [{ id: "r1" }],
    cocteles: null,
    // insumos no estaba pendiente: aunque venga, no se toca
    insumos: [{ id: "otro" }],
  })
  assert.deepEqual(cambios, { recetas: [{ id: "r1" }] })
  assert.deepEqual(siguenPendientes, ["cocteles"])
})

test("el refresco de 15 s que no trae un catálogo no lo da por cargado", () => {
  const { siguenPendientes } = aplicarRecarga(["cocteles"], { eventos: [], insumos: [] })
  assert.deepEqual(siguenPendientes, ["cocteles"])
})

test("el aviso nombra lo que falta, en orden", () => {
  assert.equal(textoCargaFallida(["cocteles"]), "No se pudieron cargar los cócteles.")
  assert.equal(
    textoCargaFallida(["insumosBarra", "cocteles"]),
    "No se pudieron cargar los insumos de barra y los cócteles.",
  )
  assert.equal(textoCargaFallida([]), "")
})

test("reintentos automáticos acotados y cada catálogo con su ruta", () => {
  assert.ok(ESPERAS_REINTENTO_CARGA.length > 0 && ESPERAS_REINTENTO_CARGA.length <= 5)
  assert.ok(ESPERAS_REINTENTO_CARGA.every((ms, i, l) => i === 0 || ms >= l[i - 1]))
  for (const c of CATALOGOS_CARGA) assert.match(URL_CATALOGO[c], /^\/api\//)
})

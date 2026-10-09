// Pruebas de la clave maestra (PIN_MAESTRO) de lib/auth/server.ts.
// Usa los verifyPin / verifyPinStockExtra / esPinMaestro REALES y solo cambia
// variables de entorno del proceso de prueba. No toca ninguna base.

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

const auth = require(path.join(__dirname, "..", "lib", "auth", "server.ts"))

const PERFILES = [
  "cocina", "barra", "administracion", "soporte", "cobro",
  "dj", "fotografo", "vestido", "pantalla", "coordinacion", "vendedor",
]

// Cada prueba arranca con PINs conocidos y sin clave maestra.
function conEntorno(valores, fn) {
  const claves = ["PIN_MAESTRO", "PIN_STOCK_EXTRA", "PIN_COCINA", "PIN_ADMINISTRACION"]
  const antes = Object.fromEntries(claves.map((c) => [c, process.env[c]]))
  for (const c of claves) delete process.env[c]
  process.env.PIN_COCINA = "1111"
  process.env.PIN_ADMINISTRACION = "222222"
  process.env.PIN_STOCK_EXTRA = "3333"
  Object.assign(process.env, valores)
  try { fn() } finally {
    for (const c of claves) {
      if (antes[c] === undefined) delete process.env[c]
      else process.env[c] = antes[c]
    }
  }
}

test("sin PIN_MAESTRO no hay clave maestra (no tiene valor de reserva)", () => {
  conEntorno({}, () => {
    assert.equal(auth.esPinMaestro(""), false)
    assert.equal(auth.esPinMaestro("12345678"), false)
    assert.equal(auth.verifyPin("cocina", ""), false)
    assert.equal(auth.verifyPin("cocina", "12345678"), false)
    // Los PINs propios siguen andando igual que antes.
    assert.equal(auth.verifyPin("cocina", "1111"), true)
    assert.equal(auth.verifyPin("administracion", "222222"), true)
    assert.equal(auth.verifyPinStockExtra("3333"), true)
  })
})

test("con PIN_MAESTRO entra a todos los perfiles", () => {
  conEntorno({ PIN_MAESTRO: "48151623" }, () => {
    for (const perfil of PERFILES) {
      assert.equal(auth.verifyPin(perfil, "48151623"), true, perfil)
    }
  })
})

test("con PIN_MAESTRO abre los PINs de acción (administración y stock extraordinario)", () => {
  conEntorno({ PIN_MAESTRO: "48151623" }, () => {
    assert.equal(auth.verifyPin("administracion", "48151623"), true)
    assert.equal(auth.verifyPinStockExtra("48151623"), true)
  })
})

test("con PIN_MAESTRO los PINs propios siguen andando y los incorrectos no", () => {
  conEntorno({ PIN_MAESTRO: "48151623" }, () => {
    assert.equal(auth.verifyPin("cocina", "1111"), true)
    assert.equal(auth.verifyPinStockExtra("3333"), true)
    assert.equal(auth.verifyPin("cocina", "4815162"), false)
    assert.equal(auth.verifyPin("cocina", "481516230"), false)
    assert.equal(auth.verifyPin("cocina", ""), false)
    // La maestra no abre un perfil que no existe.
    assert.equal(auth.verifyPin("inventado", "48151623"), false)
  })
})

test("una PIN_MAESTRO de menos de 8 caracteres se ignora", () => {
  conEntorno({ PIN_MAESTRO: "1234567" }, () => {
    assert.equal(auth.LARGO_MINIMO_PIN_MAESTRO, 8)
    assert.equal(auth.esPinMaestro("1234567"), false)
    assert.equal(auth.verifyPin("administracion", "1234567"), false)
    assert.equal(auth.verifyPinStockExtra("1234567"), false)
  })
})

test("los espacios de más al cargar la variable no la rompen", () => {
  conEntorno({ PIN_MAESTRO: " 48151623\n" }, () => {
    assert.equal(auth.verifyPin("vendedor", "48151623"), true)
  })
})

test("la clave maestra no aparece en la lista de PINs de Configuración", () => {
  conEntorno({ PIN_MAESTRO: "48151623" }, () => {
    const pins = auth.getPins()
    assert.equal(Object.values(pins).includes("48151623"), false)
    assert.equal("maestro" in pins, false)
  })
})

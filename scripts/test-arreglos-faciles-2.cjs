// Pruebas de la revisión del 8/10/2026 (puntos 12, 15 y 16):
// - Los crons de resumen no mandan nada si falta CRON_SECRET.
// - Una seña guardada en 0 % (o 0 días de anticipación) se lee como 0.
// - Un evento viejo (de 2025) se puede volver a guardar si no se le cambia la fecha.

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

const { cronAutorizado } = require(path.join(RAIZ, "lib", "cron-auth.ts"))
const { validarAnioEventoAlEditar } = require(path.join(RAIZ, "lib", "validacion-anio-evento.ts"))

test("cron: sin CRON_SECRET no pasa nadie", () => {
  assert.equal(cronAutorizado(null, undefined), false)
  assert.equal(cronAutorizado("Bearer ", ""), false)
  assert.equal(cronAutorizado("Bearer undefined", undefined), false)
})

test("cron: con CRON_SECRET pasa solo quien lo manda", () => {
  assert.equal(cronAutorizado("Bearer abc", "abc"), true)
  assert.equal(cronAutorizado("Bearer otra", "abc"), false)
  assert.equal(cronAutorizado(null, "abc"), false)
})

test("cron: las dos rutas de resumen rechazan sin CRON_SECRET y no mandan mail", async () => {
  let mails = 0
  const cargar = Module._load
  Module._load = function (request, ...args) {
    if (request === "@/lib/resumen-diario") return { buildResumenDiario: async () => ({ fecha: "2026-10-09", cantidadMovimientos: 0, cuotasDelDia: [] }), sendResumenDiarioEmail: async () => { mails++; return true } }
    if (request === "@/lib/resumen-semanal") return { buildResumenSemanal: async () => ({}), sendResumenSemanalEmail: async () => { mails++; return true } }
    return cargar.call(this, request, ...args)
  }
  const diario = require(path.join(RAIZ, "app", "api", "cron", "resumen-diario", "route.ts"))
  const semanal = require(path.join(RAIZ, "app", "api", "cron", "resumen-semanal", "route.ts"))
  Module._load = cargar
  const antes = process.env.CRON_SECRET
  const errorOriginal = console.error
  console.error = () => {}
  try {
    delete process.env.CRON_SECRET
    for (const ruta of [diario, semanal]) {
      const res = await ruta.GET(new Request("http://localhost/api/cron/x"))
      assert.equal(res.status, 401)
    }
    assert.equal(mails, 0)
    process.env.CRON_SECRET = "abc"
    const res = await diario.GET(new Request("http://localhost/api/cron/x", { headers: { authorization: "Bearer abc" } }))
    assert.equal(res.status, 200)
    assert.equal(mails, 1)
  } finally {
    console.error = errorOriginal
    if (antes === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = antes
  }
})

test("servicios: una seña en 0 % y 0 días se leen como 0, y lo que falta usa el valor por defecto", () => {
  const cargar = Module._load
  Module._load = function (request, ...args) {
    if (request === "./client") return { createClient: () => ({}) }
    return cargar.call(this, request, ...args)
  }
  let db
  try { db = require(path.join(RAIZ, "lib", "supabase", "data-service.ts")) } finally { Module._load = cargar }
  assert.equal(db.numeroGuardado(0, 30), 0)
  assert.equal(db.numeroGuardado("0", 7), 0)
  assert.equal(db.numeroGuardado(50, 30), 50)
  assert.equal(db.numeroGuardado(null, 30), 30)
  assert.equal(db.numeroGuardado(undefined, 7), 7)
  assert.equal(db.numeroGuardado("", 30), 30)
  assert.equal(db.numeroGuardado("abc", 30), 30)
})

test("año del evento: un evento de 2025 se guarda si no se cambia la fecha", () => {
  assert.equal(validarAnioEventoAlEditar("2025-11-15", "2025-11-15").valido, true)
})

test("año del evento: cambiar la fecha a un año fuera del rango sigue rechazado", () => {
  assert.equal(validarAnioEventoAlEditar("2025-12-01", "2025-11-15").valido, false)
  assert.equal(validarAnioEventoAlEditar("0027-03-01", "2027-03-01").valido, false)
  assert.equal(validarAnioEventoAlEditar("2025-11-15", undefined).valido, false)
  assert.equal(validarAnioEventoAlEditar("2027-03-01", "2025-11-15").valido, true)
})

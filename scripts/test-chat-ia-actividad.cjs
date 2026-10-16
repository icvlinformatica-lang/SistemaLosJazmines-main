// Resumen del Historial de Actividad para el chat con IA (solo lectura):
// quién hizo cada cosa sale del detalle ("· Por Leila") o, en las cargas de
// stock, del sector; a la IA no le llegan DNI ni teléfonos.
// Datos inventados: no se toca la base real.
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

const { quienDeRegistro, limpiarDetalle, registroDesdeFila, resumirActividad, periodoActividadValido, registroEsDe, SIN_QUIEN, MAX_REGISTROS_ACTIVIDAD_CHAT } = require("../lib/chat-ia-actividad.ts")

// 15/10/2026 14:30 en Argentina = 17:30 UTC.
const fila = (extra) => ({ id: "x", tipo: "evento", accion: "creado", nombre: "PRUEBA Ana y Juan", detalle: null, created_at: new Date("2026-10-15T17:30:00Z"), ...extra })

test("quién: el último 'Por X' que agrega el sistema", () => {
  assert.deepEqual(quienDeRegistro(fila({ detalle: "Casona · 5/12/2026 · Por Leila" })), { quien: "Leila" })
  assert.deepEqual(quienDeRegistro(fila({ detalle: "Por Diego" })), { quien: "Diego" })
  assert.deepEqual(quienDeRegistro(fila({ detalle: "Código: INS191 · Desde el asistente con IA · Por Soporte" })), { quien: "Soporte" })
  // "Pagado por: Marta" no es quien lo cargó.
  assert.deepEqual(
    quienDeRegistro(fila({ tipo: "pago", detalle: "Pago registrado por $ 350.000 | Pagado por: Marta | Recibido por: Leila | Cobrado desde el asistente con IA · Por Ricky" })),
    { quien: "Ricky" },
  )
  assert.deepEqual(quienDeRegistro(fila({ tipo: "insumo_barra", detalle: "Stock: 4 | Precio: 1200" })), { quien: SIN_QUIEN })
})

test("quién: las cargas de stock dicen el sector y el nombre que se escribió", () => {
  assert.deepEqual(
    quienDeRegistro(fila({ tipo: "stock_sesion", nombre: "Casona — barra", detalle: "Carga de stock · 15/10 14:30 · rocio · 12 insumos actualizados" })),
    { quien: "rocio", sector: "Barra" },
  )
  // Formato viejo, sin nombre.
  assert.deepEqual(
    quienDeRegistro(fila({ tipo: "stock_sesion", nombre: "Quinta — cocina", detalle: "Actualización de insumos · 15/10 14:30 · 182 insumos" })),
    { quien: "Cocina (sin nombre)", sector: "Cocina" },
  )
})

test("a la IA no le llegan DNI ni teléfonos; los montos quedan", () => {
  assert.equal(limpiarDetalle("DNI 30123456 y 30.123.456"), "DNI [número] y [número]")
  assert.equal(limpiarDetalle("Tel 11 4567-8901"), "Tel [teléfono]")
  assert.equal(limpiarDetalle("Pago por $ 12.350.000 y $1.250.000"), "Pago por $ 12.350.000 y $1.250.000")
  assert.equal(limpiarDetalle("Stock: 4 | Precio: 120000"), "Stock: 4 | Precio: 120000")
})

test("renglón para la IA: hora argentina, tipo con nombre y sin el 'Por X' repetido", () => {
  const r = registroDesdeFila(fila({ tipo: "pago", detalle: "Pago registrado por $ 350.000 · Por Leila" }))
  assert.deepEqual(r, { fecha: "15/10 14:30", quien: "Leila", tipo: "Pago de cuota", accion: "creado", nombre: "PRUEBA Ana y Juan", detalle: "Pago registrado por $ 350.000" })
})

test("filtro por persona o sector, sin importar mayúsculas ni tildes", () => {
  assert.equal(registroEsDe({ quien: "Leila" }, "leila"), true)
  assert.equal(registroEsDe({ quien: "Leila" }, "Diego"), false)
  assert.equal(registroEsDe({ quien: "rocio", sector: "Barra" }, "barra"), true)
  assert.equal(registroEsDe({ quien: "Administración" }, "administracion"), true)
  assert.equal(registroEsDe({ quien: SIN_QUIEN }, "sin dato"), true)
  assert.equal(registroEsDe({ quien: "Leila" }, "sin dato"), false)
})

test("resumen: totales por persona y tipo, aviso si hay muchos y quiénes aparecen", () => {
  const filas = [
    fila({ detalle: "Por Leila" }),
    fila({ tipo: "pago", detalle: "Pago · Por Leila" }),
    fila({ tipo: "insumo_barra", accion: "modificado", detalle: "Stock: 4" }),
    fila({ tipo: "stock_sesion", accion: "modificado", nombre: "Casona — barra", detalle: "Carga de stock · 15/10 14:30 · Juan · 3 insumos actualizados" }),
  ]
  const r = resumirActividad(filas, { desde: "2026-10-09", hasta: "2026-10-15" })
  assert.equal(r.total, 4)
  assert.deepEqual(r.porQuien, { Leila: 2, [SIN_QUIEN]: 1, Juan: 1 })
  assert.equal(r.porTipo["Evento creado"], 1)
  assert.equal(r.sinDatoDeQuien, 1)
  assert.deepEqual(r.quienesHay, ["Leila", SIN_QUIEN, "Juan"])
  const leila = resumirActividad(filas, { desde: "2026-10-09", hasta: "2026-10-15", quien: "Leila" })
  assert.equal(leila.total, 2)
  assert.equal(leila.quienBuscado, "Leila")
  assert.equal(resumirActividad(filas, { desde: "2026-10-09", hasta: "2026-10-15", quien: "barra" }).total, 1)
  const muchos = resumirActividad(Array.from({ length: MAX_REGISTROS_ACTIVIDAD_CHAT + 5 }, () => fila({ detalle: "Por Diego" })), { desde: "2026-10-15", hasta: "2026-10-15" })
  assert.equal(muchos.total, MAX_REGISTROS_ACTIVIDAD_CHAT + 5)
  assert.equal(muchos.registros.length, MAX_REGISTROS_ACTIVIDAD_CHAT)
  assert.match(muchos.aviso, /más nuevos/)
})

test("período: fechas válidas, en orden y de hasta 31 días", () => {
  assert.equal(periodoActividadValido("2026-10-09", "2026-10-15"), null)
  assert.equal(periodoActividadValido("2026-10-15", "2026-10-15"), null)
  assert.match(periodoActividadValido("2026-10-15", "2026-10-09"), /anterior/)
  assert.match(periodoActividadValido("2026-09-01", "2026-10-15"), /31 días/)
  assert.match(periodoActividadValido("15/10/2026", "2026-10-15"), /AAAA-MM-DD/)
})

// ---- La herramienta del chat: solo lee activity_log, por días de Argentina ----
const consultas = []
let filasLog = []
const sqlFalso = async (parts, ...values) => {
  const query = parts.join("?")
  consultas.push({ query, values })
  if (query.includes("FROM activity_log")) return filasLog
  return []
}
sqlFalso.begin = async (fn) => fn(sqlFalso)
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql: sqlFalso }
  return load.call(this, request, ...args)
}
let crearHerramientasChat
try {
  ;({ crearHerramientasChat } = require("../lib/chat-ia-herramientas.ts"))
} finally {
  Module._load = load
}

test("herramienta consultarActividad: lee el período en hora argentina y no escribe", async () => {
  filasLog = [fila({ detalle: "DNI 30123456 · Por Leila" }), fila({ tipo: "insumo_barra", accion: "modificado", detalle: "Stock: 4" })]
  consultas.length = 0
  const tools = crearHerramientasChat({ hoy: "2026-10-16" })
  const r = await tools.consultarActividad.execute({ desde: "2026-10-15", quien: "leila" })
  assert.equal(r.ok, true)
  assert.equal(r.hasta, "2026-10-15")
  assert.equal(r.total, 1)
  assert.equal(r.registros[0].detalle, "DNI [número]")
  assert.equal(consultas.length, 1)
  assert.match(consultas[0].query, /^\s*SELECT/)
  assert.match(consultas[0].query, /America\/Argentina\/Buenos_Aires/)
  assert.deepEqual(consultas[0].values, ["2026-10-15", "2026-10-15"])
  const mal = await tools.consultarActividad.execute({ desde: "2026-08-01", hasta: "2026-10-15" })
  assert.equal(mal.ok, false)
  assert.equal(consultas.length, 1)
})

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")
const root = path.resolve(__dirname, "..")

// Ejecuta los módulos reales de TypeScript sin agregar dependencias de test.
const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolveFilename.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args)
}
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    })
    module._compile(outputText, filename)
  }
}

function loadMocked(filename, mocks) {
  const load = Module._load
  Module._load = function (request, ...args) {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    return load.call(this, request, ...args)
  }
  try {
    const resolved = path.join(root, filename)
    delete require.cache[require.resolve(resolved)]
    return require(resolved)
  } finally {
    Module._load = load
  }
}

const { StoreSyncGuard, mergeRemoteStore } = require("../lib/store-sync.ts")
const { fetchAllPages } = require("../lib/fetch-all-pages.ts")
const { construirCobroCuota, repartirEntreCajas } = require("../lib/cobrar-cuota.ts")
const { useCajaEventos } = require("../lib/hooks/use-caja-eventos.ts")

function evento(id, overrides = {}) {
  return {
    id, nombre: "Mismo nombre", salon: "Quinta", fecha: "2026-10-20", estado: "pendiente",
    adultos: 0, adolescentes: 0, ninos: 0, personasDietasEspeciales: 0,
    recetasAdultos: [], recetasAdolescentes: [], recetasNinos: [], recetasDietasEspeciales: [],
    barras: [], servicios: [], personalEvento: [], costoOperativo: 100,
    planDeCuotas: {
      montoTotal: 1000, numeroCuotas: 2, cuotasPagadas: [],
      cuotas: [
        { numero: 1, montoCuota: 500, fechaVencimiento: "2026-09-15" },
        { numero: 2, montoCuota: 500, fechaVencimiento: "2026-10-15" },
      ],
    },
    ...overrides,
  }
}
function state(overrides = {}) {
  return { eventos: [], movimientosCaja: [], pagosPersonal: [], servicios: [], insumos: [], insumosBarra: [], recetas: [], cocteles: [], personal: [], ...overrides }
}
function calcular(input, salon) {
  let result
  function Harness() {
    result = useCajaEventos(input, salon, new Date("2026-09-06T12:00:00"))
    return null
  }
  renderToStaticMarkup(React.createElement(Harness))
  return result
}

for (const cap of [500, 100]) {
  test(`paginación recupera 1203 filas con límite de servidor ${cap}`, async () => {
    const rows = Array.from({ length: 1203 }, (_, i) => ({ id: String(i) }))
    const result = await fetchAllPages(async (from, to) => ({ data: rows.slice(from, Math.min(to + 1, from + cap)), count: rows.length, error: null }))
    assert.deepEqual(result, rows)
  })
}

test("error en segunda página no devuelve historial truncado", async () => {
  await assert.rejects(fetchAllPages(async (from) => from === 0
    ? { data: [{ id: "a" }], count: 2, error: null }
    : { data: null, count: null, error: new Error("sin conexión") }), /sin conexión/)
})

test("rechaza páginas duplicadas o cambiantes", async () => {
  await assert.rejects(fetchAllPages(async () => ({ data: [{ id: "a" }], count: 2, error: null })), /duplicados/)
  await assert.rejects(fetchAllPages(async (from) => ({ data: [{ id: String(from) }], count: from ? 3 : 2, error: null })), /cambiaron/)
})

test("lectura antigua no pisa una escritura ni durante ni después del guardado", async () => {
  const guard = new StoreSyncGuard()
  const old = guard.snapshot()
  let finish
  const writing = guard.run(() => new Promise((resolve) => { finish = resolve }))
  assert.equal(guard.snapshot(), null)
  assert.equal(guard.isCurrent(old), false)
  finish(true)
  await writing
  assert.equal(guard.isCurrent(old), false)
  assert.equal(guard.isCurrent(guard.snapshot()), true)
})

test("guardas esperan todas las escrituras y se liberan ante un error", async () => {
  const guard = new StoreSyncGuard()
  let finish
  const pending = guard.run(() => new Promise((resolve) => { finish = resolve }))
  await assert.rejects(guard.run(async () => { throw new Error("falló") }))
  assert.equal(guard.snapshot(), null)
  finish()
  await pending
  assert.notEqual(guard.snapshot(), null)
})

test("la aplicación conjunta conserva cambios locales en fecha o pagos", () => {
  const baseline = state({ eventos: [evento("a")] })
  const newer = { ...baseline, eventos: [evento("a", { fecha: "2026-11-20" })] }
  assert.equal(mergeRemoteStore(newer, baseline, { eventos: baseline.eventos, movimientosCaja: [] }), newer)
  const updated = mergeRemoteStore(baseline, baseline, { eventos: newer.eventos, movimientosCaja: [{ id: "mov" }] })
  assert.equal(updated.eventos[0].fecha, "2026-11-20")
  assert.equal(updated.movimientosCaja.length, 1)
})

test("mismos nombres no mezclan cuotas y la vista Todos incluye General", () => {
  const input = state({ eventos: [evento("a"), evento("b", { salon: "Casona" }), evento("c", { salon: "" })] })
  const all = calcular(input, "todos")
  assert.equal(all.ingresosPendientes.length, 6)
  assert.equal(new Set(all.ingresosPendientes.map((p) => p.id)).size, 6)
  const suma = ["Quinta", "Casona"].reduce((total, salon) => total + calcular(input, salon).totalPorCobrar, 0)
  const general = all.ingresosPendientes.filter((p) => !p.salon).reduce((total, p) => total + p.monto, 0)
  assert.equal(all.totalPorCobrar, suma + general)
})

test("mantiene exclusión de cancelados y completados en pendientes", () => {
  const result = calcular(state({ eventos: [evento("a"), evento("b", { estado: "cancelado" }), evento("c", { estado: "completado" }), evento("d", { estado: "borrador" })] }))
  assert.deepEqual([...new Set(result.ingresosPendientes.map((p) => p.eventoId))].sort(), ["a", "d"])
})

test("reprogramación mueve vencimiento del menú y respeta fecha manual", () => {
  const original = evento("a", { costoInsumos: 150 })
  const pendiente = (ev) => calcular(state({ eventos: [ev] })).egresosPendientes.find((p) => p.tipo === "menu")
  assert.equal(pendiente(original).fechaVencimiento, "2026-10-06")
  assert.equal(pendiente({ ...original, fecha: "2026-11-20", salon: "Casona" }).fechaVencimiento, "2026-11-06")
  assert.equal(pendiente({ ...original, fecha: "2026-11-20", fechaPagoMenu: "2026-09-30" }).fechaVencimiento, "2026-09-30")
})

test("cuota pagada por cualquiera de los dos formatos no se vuelve a cobrar", () => {
  for (const plan of [
    { ...evento("a").planDeCuotas, cuotasPagadas: [1] },
    { ...evento("a").planDeCuotas, cuotas: [{ numero: 1, pagada: true, montoCuota: 500, fechaVencimiento: "2026-09-15" }] },
  ]) {
    const ev = evento("a", { planDeCuotas: plan })
    assert.equal(construirCobroCuota(ev, 1, 500, "2026-09-15", []).yaCobrada, true)
    assert.ok(calcular(state({ eventos: [ev] })).ingresosPendientes.every((p) => p.numeroCuota !== 1))
  }
})

test("cobro conserva suma exacta y liga ambos movimientos al ID del evento", () => {
  const result = construirCobroCuota(evento("a"), 1, 500, "2026-09-15", [])
  assert.equal(result.movimientos.reduce((sum, m) => sum + m.monto, 0), 500)
  assert.ok(result.movimientos.every((m) => m.eventoId === "a" && m.salon === "Quinta"))
  const reparto = repartirEntreCajas(123.45, 0.33333)
  assert.equal(Math.round((reparto.montoEventos + reparto.montoJazmines) * 100), 12345)
})

test("el saldo respeta el salón histórico del movimiento aunque se mueva el evento", () => {
  const input = state({ eventos: [evento("a", { salon: "Casona" })], movimientosCaja: [{ id: "m", eventoId: "a", salon: "Quinta", tipo: "ingreso", monto: 100, cajaDestino: "caja_eventos" }] })
  assert.equal(calcular(input, "Quinta").saldoActual, 100)
  assert.equal(calcular(input, "Casona").saldoActual, 0)
})

test("API de eventos devuelve error, no una lista vacía exitosa", async () => {
  const route = loadMocked("app/api/eventos/route.ts", {
    "@/lib/db": { sql: async () => { throw new Error("error simulado") } },
    "@/lib/activity-logger": { logActivity: async () => {} },
    "@/lib/event-notifications": { sendEventNotification: async () => {} },
  })
  const response = await route.GET()
  assert.equal(response.status, 500)
  assert.equal(Array.isArray(await response.json()), false)
})

test("restauración usa la fila original y una única sentencia parametrizada", async () => {
  const calls = []
  const route = loadMocked("app/api/eventos/papelera/[id]/restaurar/route.ts", {
    "@/lib/db": { sql: async (parts, ...values) => { calls.push({ sql: parts.join("?"), values }); return [{ id: "a", nombre: "Prueba" }] } },
    "@/lib/activity-logger": { logActivity: async () => {} },
  })
  const response = await route.POST(new Request("http://localhost/test"), { params: Promise.resolve({ id: "a" }) })
  assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].values, ["a"])
  assert.match(calls[0].sql, /deleted_at = NULL/)
  assert.doesNotMatch(calls[0].sql, /INSERT INTO eventos|DELETE FROM movimientos_caja/)
})

test("servicios y pagos fallidos rechazan; el lote de caja usa un solo insert", async () => {
  const inserts = []
  const client = {
    from() {
      return {
        select() { return this }, order() { return this },
        range() { return this },
        abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return Promise.resolve({ data: null, error: new Error("desconectado"), count: null }) },
        insert(rows) { inserts.push(rows); return Promise.resolve({ error: null }) },
      }
    },
  }
  const db = loadMocked("lib/supabase/data-service.ts", { "./client": { createClient: () => client } })
  await assert.rejects(db.fetchServicios(), /desconectado/)
  await assert.rejects(db.fetchMovimientosCaja(), /desconectado/)
  await assert.rejects(db.fetchPagosPersonal(), /desconectado/)
  const movimientos = construirCobroCuota(evento("a"), 1, 500, "2026-09-15", []).movimientos
  await db.insertMovimientosCaja(movimientos)
  assert.equal(inserts.length, 1)
  assert.equal(inserts[0].length, 2)
  assert.ok(inserts[0].every((row) => row.evento_id === "a"))
})

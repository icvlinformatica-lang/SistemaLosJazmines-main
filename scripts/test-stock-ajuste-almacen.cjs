// Ajuste del stock por salón desde el lapicito de Almacén / Almacén de Barra:
// la lógica pura (qué salones cambiaron, validación) y la ruta
// POST /api/stock-salones/ajuste con la base simulada.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")

const resolver = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolver.call(this, request.startsWith("@/") ? path.join(__dirname, "..", request.slice(2)) : request, ...args)
}
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

const { validarAjusteAlmacen, cambiosDeStockPorSalon, totalConCambios } = require("../lib/stock-ajuste-almacen.ts")

const U1 = "11111111-1111-4111-8111-111111111111"
const U2 = "22222222-2222-4222-8222-222222222222"
const SALONES = new Set(["Quinta", "Casona", "Salon"])

// ── Lógica pura ─────────────────────────────────────────────────────────────

test("solo cuentan los salones que cambiaron; vacío no cambia nada", () => {
  const actuales = new Map([["Casona", 10], ["Quinta", 4]])
  const cambios = cambiosDeStockPorSalon(actuales, { Casona: "10", Quinta: "6", Salon: "", "Salon 4": "  " })
  assert.deepEqual(cambios, [{ salon: "Quinta", cantidad: 6 }])
})

test("0 es un cambio válido (contamos y no hay), distinto de vacío", () => {
  const actuales = new Map([["Casona", 10]])
  assert.deepEqual(cambiosDeStockPorSalon(actuales, { Casona: "0" }), [{ salon: "Casona", cantidad: 0 }])
  assert.deepEqual(cambiosDeStockPorSalon(new Map(), { Salon: "0" }), [{ salon: "Salon", cantidad: 0 }])
})

test("acepta coma decimal e ignora negativos o texto", () => {
  assert.deepEqual(cambiosDeStockPorSalon(new Map(), { Quinta: "2,5", Casona: "-1", Salon: "abc" }), [
    { salon: "Quinta", cantidad: 2.5 },
  ])
})

test("el total es la suma de todos los salones con lo nuevo", () => {
  const actuales = new Map([["Casona", 10], ["Quinta", 4]])
  assert.equal(totalConCambios(actuales, [{ salon: "Quinta", cantidad: 6 }, { salon: "Salon", cantidad: 1.5 }]), 17.5)
  assert.equal(totalConCambios(actuales, []), 14)
})

test("validación: sector, salón, cantidad y sesión", () => {
  const base = { sector: "cocina", insumoId: "ins-1", items: [{ salon: "Quinta", cantidad: 3, sesionId: U1 }] }
  assert.equal(validarAjusteAlmacen(base, SALONES).ok, true)
  assert.equal(validarAjusteAlmacen({ ...base, sector: "otro" }, SALONES).ok, false)
  assert.equal(validarAjusteAlmacen({ ...base, insumoId: "" }, SALONES).ok, false)
  assert.equal(validarAjusteAlmacen({ ...base, items: [] }, SALONES).ok, false)
  const item = (x) => validarAjusteAlmacen({ ...base, items: [{ salon: "Quinta", cantidad: 3, sesionId: U1, ...x }] }, SALONES).ok
  assert.equal(item({ salon: "Inventado" }), false)
  assert.equal(item({ cantidad: -1 }), false)
  assert.equal(item({ cantidad: "3" }), false, "la cantidad tiene que llegar como número")
  assert.equal(item({ cantidad: Number.NaN }), false)
  assert.equal(item({ sesionId: "no-uuid" }), false)
  const dos = (a, b) => validarAjusteAlmacen({ ...base, items: [a, b] }, SALONES).ok
  assert.equal(dos({ salon: "Quinta", cantidad: 1, sesionId: U1 }, { salon: "Quinta", cantidad: 2, sesionId: U2 }), false, "salón repetido")
  assert.equal(dos({ salon: "Quinta", cantidad: 1, sesionId: U1 }, { salon: "Casona", cantidad: 2, sesionId: U1 }), false, "sesión repetida")
  assert.equal(dos({ salon: "Quinta", cantidad: 1, sesionId: U1 }, { salon: "Casona", cantidad: 2, sesionId: U2 }), true)
})

// ── Ruta con la base simulada ───────────────────────────────────────────────

let perfil, db
function reset() {
  perfil = "administracion"
  db = {
    insumos: { "ins-1": { descripcion: "HARINA", unidad: "KG", stock_actual: 14 } },
    salones: new Map([["cocina|ins-1|Casona", 10], ["cocina|ins-1|Quinta", 4]]),
    sesiones: new Set(),
    items: [],
    actividad: [],
    fallarEnActividad: false,
  }
}

function hacerTx(estado) {
  return async (parts, ...values) => {
    const q = parts.join("?")
    if (q.includes("INSERT INTO stock_sesiones")) {
      const [id, salon, sector] = values
      if (estado.sesiones.has(id)) return []
      estado.sesiones.add(id)
      assert.ok(q.includes("'extraordinaria'"))
      return [{ id }]
    }
    if (q.includes("SELECT cantidad FROM stock_salones")) {
      const [sector, insumoId, salon] = values
      const v = estado.salones.get(`${sector}|${insumoId}|${salon}`)
      return v === undefined ? [] : [{ cantidad: String(v) }]
    }
    if (q.includes("INSERT INTO stock_sesion_items")) {
      estado.items.push(values)
      return []
    }
    if (q.includes("INSERT INTO stock_salones")) {
      const [sector, insumoId, salon, cantidad] = values
      estado.salones.set(`${sector}|${insumoId}|${salon}`, cantidad)
      return []
    }
    if (q.includes("INSERT INTO activity_log")) {
      if (estado.fallarEnActividad) throw new Error("falla simulada")
      estado.actividad.push(values)
      return []
    }
    if (q.includes("SUM(cantidad)")) {
      const [sector, insumoId] = values
      let t = 0
      for (const [k, v] of estado.salones) if (k.startsWith(`${sector}|${insumoId}|`)) t += Number(v)
      return [{ total: String(t) }]
    }
    if (q.includes("UPDATE insumos SET stock_actual")) {
      const [total, id] = values
      estado.insumos[id].stock_actual = total
      return []
    }
    throw new Error(`Consulta inesperada en la transacción: ${q}`)
  }
}

const sql = async (parts, ...values) => {
  const q = parts.join("?")
  if (q.includes("FROM insumos WHERE id")) {
    const ins = db.insumos[values[0]]
    return ins ? [{ id: values[0], descripcion: ins.descripcion, unidad: ins.unidad }] : []
  }
  if (q.includes("FROM insumos_barra WHERE id")) return []
  throw new Error(`Consulta inesperada fuera de la transacción: ${q}`)
}
// Todo o nada: se trabaja sobre una copia y solo se confirma si no hubo error.
sql.begin = async (fn) => {
  const copia = {
    ...db,
    insumos: structuredClone(db.insumos),
    salones: new Map(db.salones),
    sesiones: new Set(db.sesiones),
    items: [...db.items],
    actividad: [...db.actividad],
  }
  const r = await fn(hacerTx(copia))
  db = copia
  return r
}

const load = Module._load
Module._load = function (request, ...args) {
  if (request === "@/lib/db") return { sql }
  if (request === "@/lib/stock-salones-server") {
    return {
      perfilDesdeRequest: async () => perfil,
      salonesConfigurados: async () => new Map([["Quinta", "Quinta"], ["Casona", "Casona"], ["Salon", "Salón"]]),
      fechaHoraCortaArgentina: () => "08/10 15:00",
    }
  }
  return load.call(this, request, ...args)
}
const { POST } = require("../app/api/stock-salones/ajuste/route.ts")
Module._load = load

const post = (body, cookie = "") =>
  POST(new Request("http://localhost/api/stock-salones/ajuste", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  }))

const cuerpo = (items) => ({ sector: "cocina", insumoId: "ins-1", items })

test("ajusta los salones, registra cada uno y el total pasa a ser la suma", async () => {
  reset()
  const res = await post(
    cuerpo([{ salon: "Quinta", cantidad: 6, sesionId: U1 }, { salon: "Salon", cantidad: 2, sesionId: U2 }]),
    "lj_usuario=Leila",
  )
  const data = await res.json()
  assert.equal(res.status, 200)
  assert.deepEqual({ ok: data.ok, aplicados: data.aplicados, total: data.total }, { ok: true, aplicados: 2, total: 18 })
  assert.equal(db.salones.get("cocina|ins-1|Quinta"), 6)
  assert.equal(db.salones.get("cocina|ins-1|Salon"), 2)
  assert.equal(db.salones.get("cocina|ins-1|Casona"), 10, "el salón que no se tocó queda igual")
  assert.equal(db.insumos["ins-1"].stock_actual, 18)
  // Detalle antes → ahora: Quinta tenía 4, Salón no estaba contado.
  assert.deepEqual(db.items.map((v) => [v[5], v[6]]), [[4, 6], [null, 2]])
  assert.equal(db.actividad.length, 2)
  assert.match(db.actividad[0][2], /Ajuste desde Almacén · .* · Leila · HARINA: 4 → 6/)
})

test("un reintento con las mismas sesiones no aplica dos veces", async () => {
  reset()
  const body = cuerpo([{ salon: "Quinta", cantidad: 6, sesionId: U1 }])
  await post(body)
  const segundo = await (await post(body)).json()
  assert.equal(segundo.aplicados, 0)
  assert.equal(segundo.total, 16)
  assert.equal(db.items.length, 1)
  assert.equal(db.actividad.length, 1)
})

test("si algo falla a mitad, no queda nada guardado", async () => {
  reset()
  db.fallarEnActividad = true
  const res = await post(cuerpo([{ salon: "Quinta", cantidad: 99, sesionId: U1 }]))
  assert.equal(res.status, 500)
  assert.equal(db.salones.get("cocina|ins-1|Quinta"), 4)
  assert.equal(db.insumos["ins-1"].stock_actual, 14)
  assert.equal(db.sesiones.size, 0)
})

test("solo Administración y Soporte pueden ajustar", async () => {
  for (const p of ["cocina", "barra", "cobro", "dj", null]) {
    reset()
    perfil = p
    const res = await post(cuerpo([{ salon: "Quinta", cantidad: 6, sesionId: U1 }]))
    assert.equal(res.status, 403, String(p))
    assert.equal(db.salones.get("cocina|ins-1|Quinta"), 4)
  }
  reset()
  perfil = "soporte"
  assert.equal((await post(cuerpo([{ salon: "Quinta", cantidad: 6, sesionId: U1 }]))).status, 200)
})

test("no mezcla cocina con barra ni acepta un insumo que no existe", async () => {
  reset()
  const res = await post({ sector: "barra", insumoId: "ins-1", items: [{ salon: "Quinta", cantidad: 1, sesionId: U1 }] })
  assert.equal(res.status, 400)
  assert.equal(db.sesiones.size, 0)
})

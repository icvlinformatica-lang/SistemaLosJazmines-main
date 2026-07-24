// Migración one-shot: aplica la regla "costo del evento + 5% a Caja Eventos,
// resto a Caja Jazmines" a TODOS los eventos existentes.
//
// 1. Marca planDeCuotas.repartoCajas = "costo_mas_5" en todos los eventos activos.
// 2. Redistribuye los movimientos de señas/cuotas/pagos ya registrados en las
//    cajas (pares "... (Caja Eventos)" / "... (Caja Jazmines)") con la nueva
//    proporción de cada evento. Si el evento no tiene costo o monto total
//    válido, se queda 50/50 (mismo fallback que la app).
// 3. Recalcula los saldos acumulados de caja_eventos (por salón) y
//    caja_jazmines (global) en orden cronológico.
//
// DRY_RUN=1 -> solo muestra qué haría, sin escribir nada.
import postgres from "postgres"

const DRY = process.env.DRY_RUN === "1"
const sql = postgres(process.env.POSTGRES_URL, { ssl: "require" })

// plan_de_cuotas puede venir stringificado varias veces; conservamos la
// profundidad original para reescribirlo idéntico.
function parseConDepth(v) {
  let x = v
  let depth = 0
  for (let i = 0; i < 4 && typeof x === "string"; i++) {
    try {
      x = JSON.parse(x)
      depth++
    } catch {
      break
    }
  }
  return { obj: typeof x === "object" && x !== null ? x : null, depth }
}
function serializeConDepth(obj, depth) {
  let out = obj
  for (let i = 0; i < Math.max(1, depth); i++) out = JSON.stringify(out)
  return out
}

const eventos = await sql`
  SELECT id, nombre, nombre_pareja, salon, costo_insumos, costo_servicios, costo_operativo, plan_de_cuotas
  FROM eventos WHERE deleted_at IS NULL`

// ── 1. Proporción por evento y marcado del flag ────────────────────────────
const proporciones = new Map() // eventoId -> proporción Caja Eventos
let marcados = 0

for (const e of eventos) {
  const { obj: plan, depth } = parseConDepth(e.plan_de_cuotas)
  if (!plan || typeof plan !== "object") continue

  const montoTotal = Number(plan.montoTotal) || 0
  const costo =
    (Number(e.costo_insumos) || 0) + (Number(e.costo_servicios) || 0) + (Number(e.costo_operativo) || 0)

  let prop = 0.5
  if (montoTotal > 0 && costo > 0) prop = Math.min(1, (costo * 1.05) / montoTotal)
  proporciones.set(e.id, prop)

  if (plan.repartoCajas !== "costo_mas_5") {
    plan.repartoCajas = "costo_mas_5"
    marcados++
    const nombre = e.nombre_pareja || e.nombre
    console.log(
      `[v0] ${nombre}: prop Caja Eventos = ${(prop * 100).toFixed(1)}% (costo=$${Math.round(costo).toLocaleString("es-AR")} +5% / total=$${Math.round(montoTotal).toLocaleString("es-AR")})${prop === 0.5 ? " [fallback 50/50: sin costo o total]" : ""}`,
    )
    if (!DRY) {
      await sql`UPDATE eventos SET plan_de_cuotas = ${serializeConDepth(plan, depth)}, updated_at = NOW() WHERE id = ${e.id}`
    }
  }
}
console.log(`\n[v0] Eventos marcados con la regla nueva: ${marcados}\n`)

// ── 2. Redistribución de movimientos existentes ────────────────────────────
const movs = await sql`
  SELECT id, fecha, tipo, concepto, monto, salon, evento_id, caja_destino, created_at
  FROM movimientos_caja
  WHERE tipo = 'ingreso' AND evento_id IS NOT NULL
    AND (caja_destino = 'caja_eventos' OR caja_destino = 'caja_jazmines')
    AND (concepto LIKE '%(Caja Eventos)' OR concepto LIKE '%(Caja Jazmines)')`

// Agrupar por evento + concepto base (sin el sufijo de caja)
const grupos = new Map()
for (const m of movs) {
  const base = m.concepto.replace(/ \(Caja (Eventos|Jazmines)\)$/, "")
  const key = `${m.evento_id}::${base}`
  if (!grupos.has(key)) grupos.set(key, { base, eventoId: m.evento_id, ev: null, jz: null })
  const g = grupos.get(key)
  if (m.caja_destino === "caja_eventos") g.ev = m
  else g.jz = m
}

let actualizados = 0
let creados = 0
for (const g of grupos.values()) {
  const prop = proporciones.get(g.eventoId)
  if (prop === undefined) continue // evento borrado o sin plan

  const total = (g.ev ? Number(g.ev.monto) : 0) + (g.jz ? Number(g.jz.monto) : 0)
  if (total <= 0) continue

  const nuevoEv = Math.round(total * prop * 100) / 100
  const nuevoJz = Math.round((total - nuevoEv) * 100) / 100

  const cambioEv = !g.ev || Math.abs(Number(g.ev.monto) - nuevoEv) > 0.01
  const cambioJz = !g.jz || Math.abs(Number(g.jz.monto) - nuevoJz) > 0.01
  if (!cambioEv && !cambioJz) continue

  console.log(
    `[v0] ${g.base}: $${total.toLocaleString("es-AR")} -> Eventos $${nuevoEv.toLocaleString("es-AR")} / Jazmines $${nuevoJz.toLocaleString("es-AR")}`,
  )
  actualizados++

  if (DRY) continue

  const ref = g.ev || g.jz // para fecha/salón al crear el lado faltante

  if (g.ev) {
    if (nuevoEv > 0) await sql`UPDATE movimientos_caja SET monto = ${nuevoEv} WHERE id = ${g.ev.id}`
    else await sql`DELETE FROM movimientos_caja WHERE id = ${g.ev.id}`
  } else if (nuevoEv > 0) {
    creados++
    await sql`INSERT INTO movimientos_caja (id, fecha, tipo, concepto, monto, salon, evento_id, caja_destino, saldo_resultante, created_at)
      VALUES (${crypto.randomUUID()}, ${ref.fecha}, 'ingreso', ${g.base + " (Caja Eventos)"}, ${nuevoEv}, ${ref.salon}, ${g.eventoId}, 'caja_eventos', 0, ${ref.created_at})`
  }

  if (g.jz) {
    if (nuevoJz > 0) await sql`UPDATE movimientos_caja SET monto = ${nuevoJz} WHERE id = ${g.jz.id}`
    else await sql`DELETE FROM movimientos_caja WHERE id = ${g.jz.id}`
  } else if (nuevoJz > 0) {
    creados++
    await sql`INSERT INTO movimientos_caja (id, fecha, tipo, concepto, monto, salon, evento_id, caja_destino, saldo_resultante, created_at)
      VALUES (${crypto.randomUUID()}, ${ref.fecha}, 'ingreso', ${g.base + " (Caja Jazmines)"}, ${nuevoJz}, ${ref.salon}, ${g.eventoId}, 'caja_jazmines', 0, ${ref.created_at})`
  }
}
console.log(`\n[v0] Grupos redistribuidos: ${actualizados} (movimientos creados: ${creados})`)

// ── 3. Recalcular saldos acumulados ────────────────────────────────────────
if (!DRY) {
  // caja_eventos: saldo acumulado por salón
  const salones = await sql`SELECT DISTINCT salon FROM movimientos_caja WHERE caja_destino = 'caja_eventos'`
  for (const { salon } of salones) {
    const lista = await sql`
      SELECT id, tipo, monto FROM movimientos_caja
      WHERE caja_destino = 'caja_eventos' AND salon IS NOT DISTINCT FROM ${salon}
      ORDER BY fecha ASC, created_at ASC`
    let saldo = 0
    for (const m of lista) {
      saldo += m.tipo === "ingreso" ? Number(m.monto) : -Number(m.monto)
      await sql`UPDATE movimientos_caja SET saldo_resultante = ${Math.round(saldo * 100) / 100} WHERE id = ${m.id}`
    }
  }
  // caja_jazmines: saldo acumulado global
  const listaJz = await sql`
    SELECT id, tipo, monto FROM movimientos_caja
    WHERE caja_destino = 'caja_jazmines'
    ORDER BY fecha ASC, created_at ASC`
  let saldoJz = 0
  for (const m of listaJz) {
    saldoJz += m.tipo === "ingreso" ? Number(m.monto) : -Number(m.monto)
    await sql`UPDATE movimientos_caja SET saldo_resultante = ${Math.round(saldoJz * 100) / 100} WHERE id = ${m.id}`
  }
  console.log("[v0] Saldos acumulados recalculados en ambas cajas.")

  // Totales finales
  const totEv = await sql`SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE -monto END),0) s FROM movimientos_caja WHERE caja_destino='caja_eventos'`
  const totJz = await sql`SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE -monto END),0) s FROM movimientos_caja WHERE caja_destino='caja_jazmines'`
  console.log(`[v0] Saldo final Caja Eventos: $${Number(totEv[0].s).toLocaleString("es-AR")}`)
  console.log(`[v0] Saldo final Caja Jazmines: $${Number(totJz[0].s).toLocaleString("es-AR")}`)
} else {
  console.log("\n[v0] DRY RUN: no se escribió nada.")
}

await sql.end()

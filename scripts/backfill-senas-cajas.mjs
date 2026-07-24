import postgres from "postgres"
import { randomUUID } from "node:crypto"

const sql = postgres(process.env.POSTGRES_URL, { ssl: "require" })
const parse = (v) => {
  let x = v
  for (let i = 0; i < 3 && typeof x === "string"; i++) {
    try {
      x = JSON.parse(x)
    } catch {
      return v
    }
  }
  return x
}
const DRY = process.env.DRY_RUN === "1"

// 1) Detectar eventos activos con seña que NO tienen su movimiento de seña 50/50 en cajas
const evs = await sql`SELECT id, nombre, nombre_pareja, salon, estado, created_at, plan_de_cuotas FROM eventos WHERE deleted_at IS NULL`
const aBackfillear = []
for (const e of evs) {
  const plan = parse(e.plan_de_cuotas)
  if (!plan || plan.modalidadPago !== "sena" || !(plan.montoSena > 0)) continue
  if (e.estado === "cancelado" || e.estado === "completado") continue
  const movs = await sql`SELECT concepto FROM movimientos_caja WHERE evento_id = ${e.id} AND caja_destino IS NOT NULL`
  const yaTieneSena = movs.some((m) => /seña|sena/i.test(m.concepto))
  if (yaTieneSena) continue
  aBackfillear.push({
    id: e.id,
    nombre: e.nombre_pareja || e.nombre || "Evento",
    salon: e.salon,
    montoSena: Number(plan.montoSena),
    fecha: new Date(e.created_at).toISOString(),
  })
}

console.log(`[v0] Eventos a backfillear: ${aBackfillear.length}`)
for (const a of aBackfillear) console.log(`   ${a.nombre} (${a.salon}) seña=$${a.montoSena} fecha=${a.fecha}`)

if (aBackfillear.length === 0) {
  console.log("[v0] Nada para hacer.")
  await sql.end()
  process.exit(0)
}

// 2) Insertar los movimientos (50% Caja Eventos + 50% Caja Jazmines) por cada evento
const nuevos = []
for (const a of aBackfillear) {
  const mitadEventos = Math.round((a.montoSena / 2) * 100) / 100
  const mitadJazmines = Math.round((a.montoSena - mitadEventos) * 100) / 100
  nuevos.push({
    id: randomUUID(),
    salon: a.salon,
    tipo: "ingreso",
    monto: mitadEventos,
    concepto: `Seña - ${a.nombre} (Caja Eventos)`,
    fecha: a.fecha,
    evento_id: a.id,
    caja_destino: "caja_eventos",
  })
  nuevos.push({
    id: randomUUID(),
    salon: a.salon,
    tipo: "ingreso",
    monto: mitadJazmines,
    concepto: `Seña - ${a.nombre} (Caja Jazmines)`,
    fecha: a.fecha,
    evento_id: a.id,
    caja_destino: "caja_jazmines",
  })
}

if (DRY) {
  console.log(`\n[v0] DRY_RUN: se insertarían ${nuevos.length} movimientos. No se escribió nada.`)
  await sql.end()
  process.exit(0)
}

await sql.begin(async (tx) => {
  for (const m of nuevos) {
    await tx`INSERT INTO movimientos_caja (id, salon, tipo, monto, concepto, fecha, evento_id, caja_destino, saldo_resultante, created_at)
      VALUES (${m.id}, ${m.salon}, ${m.tipo}, ${m.monto}, ${m.concepto}, ${m.fecha}, ${m.evento_id}, ${m.caja_destino}, 0, now())`
  }

  // 3) Recalcular saldo_resultante consistente
  //    - caja_eventos: saldo por salón (así lo calcula la app)
  //    - caja_jazmines: saldo global
  const delta = (tipo, monto) => (tipo === "ingreso" ? Number(monto) : tipo === "egreso" ? -Number(monto) : 0)

  // caja_eventos por salón
  const salones = await tx`SELECT DISTINCT salon FROM movimientos_caja WHERE caja_destino = 'caja_eventos' AND salon IS NOT NULL`
  for (const { salon } of salones) {
    const rows = await tx`SELECT id, tipo, monto FROM movimientos_caja WHERE caja_destino = 'caja_eventos' AND salon = ${salon} ORDER BY fecha ASC, created_at ASC, id ASC`
    let run = 0
    for (const r of rows) {
      run += delta(r.tipo, r.monto)
      await tx`UPDATE movimientos_caja SET saldo_resultante = ${run} WHERE id = ${r.id}`
    }
  }

  // caja_jazmines global
  const rowsJ = await tx`SELECT id, tipo, monto FROM movimientos_caja WHERE caja_destino = 'caja_jazmines' ORDER BY fecha ASC, created_at ASC, id ASC`
  let runJ = 0
  for (const r of rowsJ) {
    runJ += delta(r.tipo, r.monto)
    await tx`UPDATE movimientos_caja SET saldo_resultante = ${runJ} WHERE id = ${r.id}`
  }
})

console.log(`\n[v0] Insertados ${nuevos.length} movimientos y recalculados los saldos.`)
await sql.end()

export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

// POST - restaurar evento desde papelera
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [row] = await sql`
      SELECT COALESCE(evento_json, data) AS evento_json, estado, nombre, fecha
      FROM eventos_eliminados WHERE id = ${id}
    `
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Parse evento data (may be JSONB object or string)
    let eventoData: Record<string, unknown> = {}
    if (row.evento_json) {
      if (typeof row.evento_json === "string") {
        try { eventoData = JSON.parse(row.evento_json) } catch { eventoData = {} }
      } else {
        eventoData = row.evento_json
      }
    }

    // Restore into the main eventos table using its proper columns
    await sql.unsafe(
      `UPDATE eventos SET
        deleted_at = NULL,
        estado = $1,
        updated_at = NOW()
       WHERE id = $2`,
      [row.estado || "pendiente", id]
    )

    // If the event wasn't in eventos (was hard-deleted), re-insert it
    const existing = await sql`SELECT id FROM eventos WHERE id = ${id}`
    if (!existing[0]) {
      // Re-insert with available data
      const ev = eventoData as Record<string, unknown>
      await sql.unsafe(
        `INSERT INTO eventos (
          id, nombre, fecha, horario, horario_fin, salon, tipo_evento, nombre_pareja,
          adultos, adolescentes, ninos, personas_dietas_especiales,
          recetas_adultos, recetas_adultos, recetas_ninos, recetas_dietas_especiales,
          barras, servicios, estado, stock_descontado, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),NOW())
        ON CONFLICT (id) DO NOTHING`,
        [
          id, ev.nombre||row.nombre||"Sin nombre", ev.fecha||row.fecha||null,
          ev.horario||null, ev.horarioFin||null, ev.salon||null, ev.tipoEvento||null, ev.nombrePareja||null,
          ev.adultos||0, ev.adolescentes||0, ev.ninos||0, ev.personasDietasEspeciales||0,
          JSON.stringify(ev.recetasAdultos||[]), JSON.stringify(ev.recetasAdolescentes||[]),
          JSON.stringify(ev.recetasNinos||[]), JSON.stringify(ev.recetasDietasEspeciales||[]),
          JSON.stringify(ev.barras||[]), JSON.stringify(ev.servicios||[]),
          row.estado||"pendiente", ev.stockDescontado||false,
        ]
      )
    }
    await sql`DELETE FROM eventos_eliminados WHERE id = ${id}`
    await logActivity(
      "evento",
      "modificado",
      row.nombre || "Sin nombre",
      `Restaurado desde la papelera | Fecha: ${row.fecha || "sin fecha"} | Estado anterior: ${row.estado || "-"}`
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error restoring evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

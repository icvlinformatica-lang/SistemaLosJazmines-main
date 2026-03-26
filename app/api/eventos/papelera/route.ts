export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

// GET all deleted eventos (papelera)
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, estado, nombre, fecha, eliminado_at, motivo,
             COALESCE(evento_json, data) AS evento_data
      FROM eventos_eliminados
      ORDER BY eliminado_at DESC
    `
    return NextResponse.json(rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      fecha: r.fecha,
      estado: r.estado,
      motivo: r.motivo,
      eliminadoAt: r.eliminado_at,
      ...(r.evento_data || {}),
    })))
  } catch (err) {
    console.error("[API] Error fetching papelera:", err)
    return NextResponse.json([])
  }
}

// DELETE - eliminar definitivamente de la papelera
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    if (id) {
      const rows = await sql`SELECT nombre FROM eventos_eliminados WHERE id = ${id}`
      const row = rows[0]
      await sql`DELETE FROM eventos_eliminados WHERE id = ${id}`
      await logActivity(
        "evento",
        "eliminado",
        row?.nombre || "Sin nombre",
        "Eliminado permanentemente desde la papelera"
      )
    } else {
      const rows = await sql`SELECT COUNT(*) as total FROM eventos_eliminados`
      const total = rows[0]?.total || 0
      await sql`DELETE FROM eventos_eliminados`
      await logActivity(
        "evento",
        "eliminado",
        "Papelera vaciada",
        `Se eliminaron permanentemente ${total} evento(s) de la papelera`
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting from papelera:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

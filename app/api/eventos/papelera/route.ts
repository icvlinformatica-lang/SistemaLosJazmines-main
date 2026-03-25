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
      // Obtener datos del evento antes de borrar para el log
      const rows = await sql`SELECT nombre FROM eventos_eliminados WHERE id = ${id}`
      const row = rows[0]
      await sql`DELETE FROM eventos_eliminados WHERE id = ${id}`
      if (row) {
        await logActivity("evento", "eliminado", row.nombre || "Sin nombre", "Eliminado permanentemente de la papelera")
      }
    } else {
      // Vaciar toda la papelera
      await sql`DELETE FROM eventos_eliminados`
      await logActivity("sistema", "papelera_vaciada", "Papelera de eventos", "Se eliminaron permanentemente todos los eventos de la papelera")
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting from papelera:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

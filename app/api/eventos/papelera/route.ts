export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

// GET all deleted eventos (papelera)
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, data, estado, nombre, fecha, eliminado_at, motivo
      FROM eventos_eliminados
      ORDER BY eliminado_at DESC
    `
    return NextResponse.json(rows)
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
      await sql`DELETE FROM eventos_eliminados WHERE id = ${id}`
    } else {
      // Vaciar toda la papelera
      await sql`DELETE FROM eventos_eliminados`
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting from papelera:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

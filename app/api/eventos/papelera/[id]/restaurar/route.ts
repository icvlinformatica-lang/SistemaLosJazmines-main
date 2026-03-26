export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

// POST - restaurar evento desde papelera
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [row] = await sql`SELECT data, estado, nombre, fecha FROM eventos_eliminados WHERE id = ${id}`
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await sql`
      INSERT INTO eventos (id, data, estado, nombre, fecha)
      VALUES (${id}, ${row.data}, ${row.estado}, ${row.nombre}, ${row.fecha})
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        estado = EXCLUDED.estado,
        updated_at = NOW()
    `
    await sql`DELETE FROM eventos_eliminados WHERE id = ${id}`
    await logActivity(
      "evento",
      "modificado",
      row.nombre || "Sin nombre",
      `Restaurado desde la papelera | Fecha: ${row.fecha || "sin fecha"} | Estado anterior: ${row.estado || "-"}`
    )

    return NextResponse.json({ success: true, evento: row.data })
  } catch (err) {
    console.error("[API] Error restoring evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

// El soft delete conserva la fila original completa, incluidos sus pagos y cuotas.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [result] = await sql`
      WITH restaurado AS (
        UPDATE eventos SET deleted_at = NULL, updated_at = NOW()
        WHERE id = ${id} AND deleted_at IS NOT NULL
        RETURNING id, nombre, fecha, estado
      ), limpieza AS (
        DELETE FROM eventos_eliminados WHERE id IN (SELECT id FROM restaurado)
      )
      SELECT id, nombre, fecha, estado FROM restaurado
    `
    if (!result) {
      return NextResponse.json({ error: "El evento no está eliminado o su fila original ya no existe." }, { status: 404 })
    }
    await logActivity("evento", "modificado", result.nombre || "Sin nombre", "Restaurado desde la papelera")
    return NextResponse.json({ success: true, evento: { id: result.id } })
  } catch (err) {
    console.error("[API] Error restoring evento:", err)
    return NextResponse.json({ error: "No se pudo restaurar el evento." }, { status: 500 })
  }
}

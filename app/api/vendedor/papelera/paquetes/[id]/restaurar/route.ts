export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

// Devuelve un paquete de la papelera a "Paquetes reutilizables por salón",
// tal cual estaba (mismo id, mismos servicios y precios).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const filas = await sql`
      WITH movida AS (
        DELETE FROM paquetes_salones_eliminados WHERE id = ${id}
        RETURNING *
      )
      INSERT INTO paquetes_salones (id, data, updated_at)
      SELECT id, data, updated_at
      FROM movida
      RETURNING id
    `
    if (!filas.length) {
      return NextResponse.json({ ok: false, error: "No se encontró el paquete en la papelera" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error en vendedor/papelera/paquetes/[id]/restaurar POST:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

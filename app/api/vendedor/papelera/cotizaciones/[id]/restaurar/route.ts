export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

// Devuelve una cotización de la papelera a "Mis cotizaciones generadas",
// tal cual estaba (mismo id, mismo estado). Si paquete_id apuntaba a un
// paquete que también está borrado, la vuelta falla por la FK — se le avisa
// al vendedor para que primero restaure el paquete.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const filas = await sql`
      WITH movida AS (
        DELETE FROM cotizaciones_eliminadas WHERE id = ${id}
        RETURNING *
      )
      INSERT INTO cotizaciones (
        id, vendedor, cliente_nombre, cliente_telefono, fecha_evento, salon, tipo_evento,
        invitados, servicios_elegidos, paquete_id, precio_venta_sugerido, costos_internos,
        estado, comentario_admin, created_at, updated_at, nombre_festejados, horario, horario_fin,
        evento_id
      )
      SELECT id, vendedor, cliente_nombre, cliente_telefono, fecha_evento, salon, tipo_evento,
        invitados, servicios_elegidos, paquete_id, precio_venta_sugerido, costos_internos,
        estado, comentario_admin, created_at, updated_at, nombre_festejados, horario, horario_fin,
        evento_id
      FROM movida
      RETURNING id
    `
    if (!filas.length) {
      return NextResponse.json({ ok: false, error: "No se encontró la cotización en la papelera" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error en vendedor/papelera/cotizaciones/[id]/restaurar POST:", err)
    return NextResponse.json(
      { ok: false, error: "No se pudo restaurar. Si venía de un paquete que también está borrado, restaurá primero el paquete." },
      { status: 500 },
    )
  }
}

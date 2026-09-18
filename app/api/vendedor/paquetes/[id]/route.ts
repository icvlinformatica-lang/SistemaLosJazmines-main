export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { usuarioDesdeCookie } from "@/lib/usuario-cookie"

/**
 * Borra un paquete de "paquetes_salones" — misma tabla que usa
 * Administración en /admin/servicios. Pensado para cuando el vendedor carga
 * mal un paquete y necesita sacarlo de la lista. Administración sigue
 * borrando en serio desde /admin/servicios (deletePaqueteSalon, sin cambios);
 * este endpoint es solo el que usa /vendedor/paquetes, y ahora mueve la fila
 * a paquetes_salones_eliminados en vez de borrarla, para poder recuperarla
 * desde la papelera (ver /api/vendedor/papelera y .../papelera/paquetes).
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const eliminadoPor = usuarioDesdeCookie(req)
    const filas = await sql`
      WITH movida AS (
        DELETE FROM paquetes_salones WHERE id = ${id}
        RETURNING *
      )
      INSERT INTO paquetes_salones_eliminados (id, data, updated_at, eliminado_por)
      SELECT id, data, updated_at, ${eliminadoPor}
      FROM movida
      RETURNING id
    `
    if (!filas.length) {
      return NextResponse.json({ ok: false, error: "No se encontró el paquete" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error en vendedor/paquetes/[id] DELETE:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

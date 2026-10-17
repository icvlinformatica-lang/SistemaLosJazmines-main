export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { puedeEscribirCotizador, MOTIVO_COTIZADOR } from "@/lib/permisos-escritura"
import { exigirPerfil } from "@/lib/permisos-escritura-server"
import { sql } from "@/lib/db"

// Devuelve un paquete de la papelera a "Paquetes reutilizables por salón",
// tal cual estaba (mismo id, mismos servicios y precios).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Escribir en el cotizador: el Vendedor, Administración y Soporte
  // (lib/permisos-escritura.ts). Antes cualquier sesión podía.
  const prohibido = await exigirPerfil(req, puedeEscribirCotizador, MOTIVO_COTIZADOR, "/api/vendedor/papelera/paquetes/[id]/restaurar")
  if (prohibido) return prohibido
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

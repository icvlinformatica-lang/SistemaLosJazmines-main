export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { puedeEscribirCotizador, MOTIVO_COTIZADOR } from "@/lib/permisos-escritura"
import { exigirPerfil } from "@/lib/permisos-escritura-server"
import { sql } from "@/lib/db"

// Borra en serio una cotización de la papelera (cotizaciones_eliminadas).
// Sin vuelta atrás — a diferencia del DELETE de .../cotizaciones/[id], que
// solo la mueve acá.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Escribir en el cotizador: el Vendedor, Administración y Soporte
  // (lib/permisos-escritura.ts). Antes cualquier sesión podía.
  const prohibido = await exigirPerfil(req, puedeEscribirCotizador, MOTIVO_COTIZADOR, "/api/vendedor/papelera/cotizaciones/[id]")
  if (prohibido) return prohibido
  try {
    const { id } = await params
    await sql`DELETE FROM cotizaciones_eliminadas WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error en vendedor/papelera/cotizaciones/[id] DELETE:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

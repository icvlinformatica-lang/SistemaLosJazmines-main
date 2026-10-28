export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { puedeEscribirCotizador, MOTIVO_COTIZADOR } from "@/lib/permisos-escritura"
import { exigirPerfil } from "@/lib/permisos-escritura-server"
import { sql } from "@/lib/db"

// Borra en serio un paquete de la papelera (paquetes_salones_eliminados).
// Sin vuelta atrás — a diferencia del DELETE de .../paquetes/[id], que solo
// lo mueve acá.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Escribir en el cotizador: el Vendedor, Administración y Soporte
  // (lib/permisos-escritura.ts). Antes cualquier sesión podía.
  const prohibido = await exigirPerfil(req, puedeEscribirCotizador, MOTIVO_COTIZADOR, "/api/vendedor/papelera/paquetes/[id]")
  if (prohibido) return prohibido
  try {
    const { id } = await params
    await sql`DELETE FROM paquetes_salones_eliminados WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error en vendedor/papelera/paquetes/[id] DELETE:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

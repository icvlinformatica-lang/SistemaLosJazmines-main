export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * Borra un paquete de "paquetes_salones" — misma tabla que usa
 * Administración en /admin/servicios (borrado real, no soft-delete, igual
 * que ya hace esa pantalla). Pensado para cuando el vendedor carga mal un
 * paquete y necesita sacarlo de la lista.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await sql`DELETE FROM paquetes_salones WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error en vendedor/paquetes/[id] DELETE:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

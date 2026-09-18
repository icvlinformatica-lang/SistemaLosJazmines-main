export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

// Borra en serio un paquete de la papelera (paquetes_salones_eliminados).
// Sin vuelta atrás — a diferencia del DELETE de .../paquetes/[id], que solo
// lo mueve acá.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await sql`DELETE FROM paquetes_salones_eliminados WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error en vendedor/papelera/paquetes/[id] DELETE:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

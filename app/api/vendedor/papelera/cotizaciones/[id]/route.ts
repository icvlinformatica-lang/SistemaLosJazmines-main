export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

// Borra en serio una cotización de la papelera (cotizaciones_eliminadas).
// Sin vuelta atrás — a diferencia del DELETE de .../cotizaciones/[id], que
// solo la mueve acá.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await sql`DELETE FROM cotizaciones_eliminadas WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error en vendedor/papelera/cotizaciones/[id] DELETE:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

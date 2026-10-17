export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { puedeCerrarNovedades } from "@/lib/permisos-escritura"
import { exigirPerfil } from "@/lib/permisos-escritura-server"

export async function GET() {
  try {
    const data = await sql`
      SELECT * FROM novedades
      WHERE activa = true
      ORDER BY orden ASC, created_at DESC
    `
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([])
  }
}

// Cierra (desactiva) una novedad: no vuelve a aparecer en el modal.
// La cierran los perfiles que la ven en Inicio (lib/permisos-escritura.ts).
export async function PATCH(request: Request) {
  const prohibido = await exigirPerfil(request, puedeCerrarNovedades, "Este perfil no puede cerrar novedades.", "/api/novedades")
  if (prohibido) return prohibido
  try {
    const { id } = await request.json()
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id requerido" }, { status: 400 })
    }
    await sql`
      UPDATE novedades SET activa = false, updated_at = now()
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "error" }, { status: 500 })
  }
}

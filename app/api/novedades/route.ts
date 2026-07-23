export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

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

// Cierra (desactiva) una novedad: no vuelve a aparecer en el modal
export async function PATCH(request: Request) {
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

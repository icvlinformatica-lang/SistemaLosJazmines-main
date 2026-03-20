export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

// GET single evento
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [row] = await sql`SELECT data FROM eventos WHERE id = ${id}`
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(row.data)
  } catch (err) {
    console.error("[API] Error fetching evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT update evento
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const evento = { ...body, id }
    const nombre = evento.nombrePareja || evento.nombre || "Sin nombre"

    await sql`
      UPDATE eventos SET
        data = ${JSON.stringify(evento)},
        estado = ${evento.estado || 'pendiente'},
        nombre = ${nombre},
        fecha = ${evento.fecha || null},
        updated_at = NOW()
      WHERE id = ${id}
    `

    await logActivity("evento", "modificado", nombre, `Estado: ${evento.estado}`)
    return NextResponse.json(evento)
  } catch (err) {
    console.error("[API] Error updating evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - mueve a papelera
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(req.url)
    const motivo = url.searchParams.get("motivo") || null

    const [row] = await sql`SELECT data, estado, nombre, fecha FROM eventos WHERE id = ${id}`
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Mover a papelera
    await sql`
      INSERT INTO eventos_eliminados (id, data, estado, nombre, fecha, motivo)
      VALUES (${id}, ${row.data}, ${row.estado}, ${row.nombre}, ${row.fecha}, ${motivo})
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        estado = EXCLUDED.estado,
        eliminado_at = NOW(),
        motivo = EXCLUDED.motivo
    `

    await sql`DELETE FROM eventos WHERE id = ${id}`
    await logActivity("evento", "eliminado", row.nombre || "Sin nombre", motivo ? `Motivo: ${motivo}` : undefined)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

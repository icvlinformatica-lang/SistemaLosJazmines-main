export const dynamic = 'force-dynamic'
import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

// GET all eventos
export async function GET() {
  try {
    const rows = await sql`
      SELECT data FROM eventos
      ORDER BY fecha ASC, created_at ASC
    `
    const eventos = rows.map((r: { data: unknown }) => r.data)
    return NextResponse.json(eventos)
  } catch (err) {
    console.error("[API] Error fetching eventos:", err)
    return NextResponse.json([], { status: 200 })
  }
}

// POST create evento
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id = body.id || generateId()
    const evento = { ...body, id }
    const nombre = evento.nombrePareja || evento.nombre || "Sin nombre"

    await sql`
      INSERT INTO eventos (id, data, estado, nombre, fecha)
      VALUES (
        ${id},
        ${JSON.stringify(evento)},
        ${evento.estado || 'pendiente'},
        ${nombre},
        ${evento.fecha || null}
      )
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        estado = EXCLUDED.estado,
        nombre = EXCLUDED.nombre,
        fecha = EXCLUDED.fecha,
        updated_at = NOW()
    `

    await logActivity("evento", "creado", nombre, `Fecha: ${evento.fecha || "sin fecha"} | Salon: ${evento.salon || "sin salon"}`)
    return NextResponse.json(evento, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

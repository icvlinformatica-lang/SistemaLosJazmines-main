export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, tipo, accion, nombre, detalle, created_at
      FROM activity_log
      ORDER BY created_at DESC
      LIMIT 100
    `
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tipo, accion, nombre, detalle } = body

    if (!tipo || !accion || !nombre) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    const [row] = await sql`
      INSERT INTO activity_log (tipo, accion, nombre, detalle)
      VALUES (${tipo}, ${accion}, ${nombre}, ${detalle || null})
      RETURNING id, tipo, accion, nombre, detalle, created_at
    `
    return NextResponse.json(row, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al registrar actividad" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await sql`DELETE FROM activity_log`
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error al limpiar actividad" }, { status: 500 })
  }
}

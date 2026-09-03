export const dynamic = 'force-dynamic'
// redeploy: env vars restored
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q")?.trim()

    if (q) {
      const like = `%${q}%`
      const rows = await sql`
        SELECT id, tipo, accion, nombre, detalle, created_at
        FROM activity_log
        WHERE nombre ILIKE ${like} OR detalle ILIKE ${like} OR tipo ILIKE ${like}
        ORDER BY created_at DESC
        LIMIT 200
      `
      return NextResponse.json(rows)
    }

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

// Lee la cookie lj_usuario (Diego o Leila) para atribuir el registro
// a la persona que ingresó con el perfil Administración.
function usuarioDesdeCookie(req: Request): string | null {
  const raw = req.headers.get("cookie") || ""
  const match = raw.match(/(?:^|;\s*)lj_usuario=([^;]+)/)
  if (!match) return null
  try {
    const valor = decodeURIComponent(match[1]).trim()
    return valor || null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tipo, accion, nombre, detalle } = body

    if (!tipo || !accion || !nombre) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    const usuario = usuarioDesdeCookie(req)
    const detalleFinal = usuario
      ? detalle
        ? `${detalle} · Por ${usuario}`
        : `Por ${usuario}`
      : detalle || null

    const [row] = await sql`
      INSERT INTO activity_log (tipo, accion, nombre, detalle)
      VALUES (${tipo}, ${accion}, ${nombre}, ${detalleFinal})
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
    return NextResponse.json({ ok: true })
  }
}

export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

// GET single barra template
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const [data] = await sql`
      SELECT * FROM barra_templates WHERE id = ${id}
    `

    if (!data) {
      return NextResponse.json({ error: "Barra template not found" }, { status: 404 })
    }

    const template = {
      id: data.id,
      nombre: data.nombre,
      coctelesIncluidos: data.cocteles_incluidos || [],
    }

    return NextResponse.json(template)
  } catch (err) {
    console.error("[API] Error fetching barra_template:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT update barra template
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const cocteles: string[] = body.coctelesIncluidos || []
    const coctelesLiteral = `{${cocteles.join(",")}}`
    const [data] = await sql`
      UPDATE barra_templates SET
        nombre = ${body.nombre},
        cocteles_incluidos = ${coctelesLiteral}::text[],
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!data) {
      return NextResponse.json({ error: "Barra template not found" }, { status: 404 })
    }

    const template = {
      id: data.id,
      nombre: data.nombre,
      coctelesIncluidos: data.cocteles_incluidos || [],
    }

    return NextResponse.json(template)
  } catch (err) {
    console.error("[API] Error updating barra_template:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE barra template
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await sql`DELETE FROM barra_templates WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting barra_template:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

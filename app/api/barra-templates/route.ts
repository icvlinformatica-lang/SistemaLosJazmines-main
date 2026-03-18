import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"

// GET all barra templates
export async function GET() {
  try {
    const data = await sql`
      SELECT * FROM barra_templates ORDER BY nombre ASC
    `

    // Transform to app format
    const templates = data.map((template) => ({
      id: template.id,
      nombre: template.nombre,
      coctelesIncluidos: template.cocteles || [],
    }))

    return NextResponse.json(templates)
  } catch (err) {
    console.error("[API] Error fetching barra_templates:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST create new barra template
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const id = generateId()

    const [data] = await sql`
      INSERT INTO barra_templates (id, nombre, descripcion, cocteles)
      VALUES (
        ${id},
        ${body.nombre},
        ${body.descripcion || null},
        ${JSON.stringify(body.coctelesIncluidos || [])}
      )
      RETURNING *
    `

    const template = {
      id: data.id,
      nombre: data.nombre,
      coctelesIncluidos: data.cocteles || [],
    }

    return NextResponse.json(template, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating barra_template:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

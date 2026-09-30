export const dynamic = 'force-dynamic'
import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"
import { leerBarraTemplates } from "@/lib/lecturas-postgres"

// GET all barra templates
export async function GET() {
  try {
    // Lectura compartida con la carga inicial unificada (lib/lecturas-postgres.ts).
    return NextResponse.json(await leerBarraTemplates())
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

    const cocteles: string[] = body.coctelesIncluidos || []
    const coctelesLiteral = `{${cocteles.join(",")}}`
    const [data] = await sql`
      INSERT INTO barra_templates (id, nombre, cocteles_incluidos)
      VALUES (
        ${id},
        ${body.nombre},
        ${coctelesLiteral}::text[]
      )
      RETURNING *
    `

    const template = {
      id: data.id,
      nombre: data.nombre,
      coctelesIncluidos: data.cocteles_incluidos || [],
    }

    return NextResponse.json(template, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating barra_template:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

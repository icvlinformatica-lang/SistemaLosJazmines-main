export const dynamic = 'force-dynamic'
import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"

// en_cotizador (scripts/014) se lee con to_jsonb para no romper si la
// migración todavía no se aplicó: en ese caso vale false.
const aTemplate = (data: Record<string, unknown>) => ({
  id: data.id,
  nombre: data.nombre,
  coctelesIncluidos: (data.cocteles_incluidos as string[] | null) || [],
  enCotizador: data.en_cotizador === true || data.en_cotizador === "true",
})

// GET all barra templates
export async function GET() {
  try {
    const data = await sql`
      SELECT *, (to_jsonb(barra_templates) ->> 'en_cotizador') AS en_cotizador
      FROM barra_templates ORDER BY nombre ASC
    `
    return NextResponse.json(data.map(aTemplate))
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
    // El switch "Aparece en el cotizador" solo se escribe si viene: así las
    // pantallas viejas (Producción, store) siguen creando barras igual.
    if (typeof body.enCotizador === "boolean") {
      await sql`UPDATE barra_templates SET en_cotizador = ${body.enCotizador} WHERE id = ${id}`
      data.en_cotizador = body.enCotizador
    }

    return NextResponse.json(aTemplate(data), { status: 201 })
  } catch (err) {
    console.error("[API] Error creating barra_template:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

// en_cotizador (scripts/014) se lee con to_jsonb para no romper si la
// migración todavía no se aplicó: en ese caso vale false.
const aTemplate = (data: Record<string, unknown>) => ({
  id: data.id,
  nombre: data.nombre,
  coctelesIncluidos: (data.cocteles_incluidos as string[] | null) || [],
  enCotizador: data.en_cotizador === true || data.en_cotizador === "true",
})

// GET single barra template
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [data] = await sql`
      SELECT *, (to_jsonb(barra_templates) ->> 'en_cotizador') AS en_cotizador
      FROM barra_templates WHERE id = ${id}
    `

    if (!data) {
      return NextResponse.json({ error: "Barra template not found" }, { status: 404 })
    }

    return NextResponse.json(aTemplate(data))
  } catch (err) {
    console.error("[API] Error fetching barra_template:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT update barra template. Solo cambia lo que viene en el body: el switch
// "Aparece en el cotizador" manda nada más { enCotizador } y no tiene que
// pisar el nombre ni los cócteles.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const [actual] = await sql`SELECT nombre, cocteles_incluidos FROM barra_templates WHERE id = ${id}`
    if (!actual) {
      return NextResponse.json({ error: "Barra template not found" }, { status: 404 })
    }

    const nombre = typeof body.nombre === "string" ? body.nombre : actual.nombre
    const cocteles: string[] = Array.isArray(body.coctelesIncluidos)
      ? body.coctelesIncluidos
      : actual.cocteles_incluidos || []
    const coctelesLiteral = `{${cocteles.join(",")}}`
    const [data] = await sql`
      UPDATE barra_templates SET
        nombre = ${nombre},
        cocteles_incluidos = ${coctelesLiteral}::text[],
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    if (typeof body.enCotizador === "boolean") {
      await sql`UPDATE barra_templates SET en_cotizador = ${body.enCotizador} WHERE id = ${id}`
      data.en_cotizador = body.enCotizador
    } else {
      const [fila] = await sql`
        SELECT (to_jsonb(barra_templates) ->> 'en_cotizador') AS en_cotizador FROM barra_templates WHERE id = ${id}
      `
      data.en_cotizador = fila?.en_cotizador
    }

    return NextResponse.json(aTemplate(data))
  } catch (err) {
    console.error("[API] Error updating barra_template:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE barra template. Si algún evento la usa (eventos.barras[].barraTemplateId,
// también los de la papelera) NO se borra: responde 409 con cuántos la usan.
// Sin cascada: los eventos y sus barras no se tocan nunca.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // eventos.barras a veces está guardado como texto JSON dentro de jsonb
    // (string), así que se desarma antes de recorrerlo.
    const [{ usan }] = await sql`
      WITH ev AS (
        SELECT CASE WHEN jsonb_typeof(barras) = 'string' THEN (barras #>> '{}')::jsonb ELSE barras END AS b
        FROM eventos
      )
      SELECT count(*)::int AS usan FROM ev
      WHERE jsonb_typeof(ev.b) = 'array'
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(ev.b) x WHERE x ->> 'barraTemplateId' = ${id})
    `
    if (usan > 0) {
      return NextResponse.json(
        { error: `La usan ${usan} ${usan === 1 ? "evento" : "eventos"}`, usan },
        { status: 409 },
      )
    }

    await sql`DELETE FROM barra_templates WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting barra_template:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"

// GET single receta with insumos
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [recetaData] = await sql`SELECT * FROM recetas WHERE id = ${id}`

    if (!recetaData) {
      return NextResponse.json({ error: "Receta not found" }, { status: 404 })
    }

    const insumosData = await sql`
      SELECT * FROM receta_insumos WHERE receta_id = ${id}
    `

    const insumos = insumosData.map((i) => ({
      insumoId: i.insumo_id,
      detalleCorte: i.detalle_corte || "",
      cantidadBasePorPersona: Number(i.cantidad_base_por_persona),
      unidadReceta: i.unidad_receta,
    }))

    return NextResponse.json({
      id: recetaData.id,
      nombre: recetaData.nombre,
      categoria: recetaData.categoria,
      porcionesBase: recetaData.porciones_base || 1,
      instrucciones: recetaData.instrucciones || "",
      insumos,
    })
  } catch (err) {
    console.error("[API] Error fetching receta:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT update receta
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Explicitly convert every field to null if missing to avoid UNDEFINED_VALUE
    const nombre: string | null = (body.nombre !== undefined && body.nombre !== "") ? String(body.nombre) : null
    const categoria: string | null = (body.categoria !== undefined && body.categoria !== "") ? String(body.categoria) : null
    const porcionesBase: number | null = body.porcionesBase !== undefined ? Number(body.porcionesBase) : null
    const instrucciones: string | null = body.instrucciones !== undefined ? (body.instrucciones || null) : null

    const [recetaData] = await sql`
      UPDATE recetas SET
        nombre = COALESCE(${nombre}, nombre),
        categoria = COALESCE(${categoria}, categoria),
        porciones_base = COALESCE(${porcionesBase}, porciones_base),
        instrucciones = COALESCE(${instrucciones}, instrucciones),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!recetaData) {
      return NextResponse.json({ error: "Receta not found" }, { status: 404 })
    }

    // Accept both "insumos" and "ingredientes" keys
    const insumosList: any[] | null = body.insumos || body.ingredientes || null

    if (insumosList) {
      await sql`DELETE FROM receta_insumos WHERE receta_id = ${id}`

      for (const ing of insumosList) {
        const insumoId: string = ing.insumoId || ing.id
        const detalleCorte: string | null = ing.detalleCorte || null
        const cantidad: number = Number(ing.cantidadBasePorPersona ?? ing.cantidad ?? 0)
        const unidad: string = ing.unidadReceta || ing.unidad || "GRS"

        await sql`
          INSERT INTO receta_insumos
            (id, receta_id, insumo_id, detalle_corte, cantidad_base_por_persona, unidad_receta)
          VALUES
            (${generateId()}, ${id}, ${insumoId}, ${detalleCorte}, ${cantidad}, ${unidad})
        `
      }
    }

    return NextResponse.json({
      id: recetaData.id,
      nombre: recetaData.nombre,
      categoria: recetaData.categoria,
      porcionesBase: recetaData.porciones_base || 1,
      instrucciones: recetaData.instrucciones || "",
      insumos: insumosList || [],
    })
  } catch (err) {
    console.error("[API] Error updating receta:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE receta
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await sql`DELETE FROM receta_insumos WHERE receta_id = ${id}`
    await sql`DELETE FROM recetas WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting receta:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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
      codigo: recetaData.codigo,
      nombre: recetaData.nombre,
      descripcion: recetaData.descripcion || "",
      imagen: recetaData.imagen || "",
      categoria: recetaData.categoria,
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

    const [recetaData] = await sql`
      UPDATE recetas SET
        nombre      = COALESCE(${body.nombre ?? null}, nombre),
        codigo      = COALESCE(${body.codigo ?? null}, codigo),
        descripcion = COALESCE(${body.descripcion ?? null}, descripcion),
        imagen      = COALESCE(${body.imagen ?? null}, imagen),
        categoria   = COALESCE(${body.categoria ?? null}, categoria),
        updated_at  = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!recetaData) {
      return NextResponse.json({ error: "Receta not found" }, { status: 404 })
    }

    // Si se envían insumos, reemplazarlos completos
    if (body.insumos !== undefined) {
      await sql`DELETE FROM receta_insumos WHERE receta_id = ${id}`

      for (const insumo of body.insumos) {
        await sql`
          INSERT INTO receta_insumos (id, receta_id, insumo_id, detalle_corte, cantidad_base_por_persona, unidad_receta)
          VALUES (
            ${generateId()},
            ${id},
            ${insumo.insumoId},
            ${insumo.detalleCorte || null},
            ${insumo.cantidadBasePorPersona},
            ${insumo.unidadReceta || "GRS"}
          )
        `
      }
    }

    // Leer los insumos actualizados para devolver
    const insumosData = await sql`
      SELECT * FROM receta_insumos WHERE receta_id = ${id}
    `

    return NextResponse.json({
      id: recetaData.id,
      codigo: recetaData.codigo,
      nombre: recetaData.nombre,
      descripcion: recetaData.descripcion || "",
      imagen: recetaData.imagen || "",
      categoria: recetaData.categoria,
      insumos: insumosData.map((i) => ({
        insumoId: i.insumo_id,
        detalleCorte: i.detalle_corte || "",
        cantidadBasePorPersona: Number(i.cantidad_base_por_persona),
        unidadReceta: i.unidad_receta,
      })),
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
    // receta_insumos se borra en cascada por la FK
    await sql`DELETE FROM recetas WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting receta:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

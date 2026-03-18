import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"

// GET single receta with insumos
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const [recetaData] = await sql`
      SELECT * FROM recetas WHERE id = ${id}
    `

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

    const receta = {
      id: recetaData.id,
      nombre: recetaData.nombre,
      categoria: recetaData.categoria,
      porcionesBase: recetaData.porciones_base || 1,
      instrucciones: recetaData.instrucciones || "",
      insumos,
    }

    return NextResponse.json(receta)
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

    // Sanitize body to avoid undefined values - convert undefined to null
    const sanitized = {
      nombre: body.nombre !== undefined ? body.nombre : null,
      categoria: body.categoria !== undefined ? body.categoria : null,
      porcionesBase: body.porcionesBase !== undefined ? body.porcionesBase : null,
      instrucciones: body.instrucciones !== undefined ? body.instrucciones : null,
    }

    const [recetaData] = await sql`
      UPDATE recetas SET
        nombre = COALESCE(${sanitized.nombre}, nombre),
        categoria = COALESCE(${sanitized.categoria}, categoria),
        porciones_base = COALESCE(${sanitized.porcionesBase}, porciones_base),
        instrucciones = COALESCE(${sanitized.instrucciones}, instrucciones),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!recetaData) {
      return NextResponse.json({ error: "Receta not found" }, { status: 404 })
    }

    // Update insumos: delete existing and insert new
    if (body.insumos) {
      await sql`DELETE FROM receta_insumos WHERE receta_id = ${id}`

      if (body.insumos.length > 0) {
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
    }

    const receta = {
      id: recetaData.id,
      nombre: recetaData.nombre,
      categoria: recetaData.categoria,
      porcionesBase: recetaData.porciones_base || 1,
      instrucciones: recetaData.instrucciones || "",
      insumos: body.insumos || [],
    }

    return NextResponse.json(receta)
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

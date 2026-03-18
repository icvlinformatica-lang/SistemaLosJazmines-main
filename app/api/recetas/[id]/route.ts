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
      detalleCorte: "",
      cantidadBasePorPersona: Number(i.cantidad),
      unidadReceta: i.unidad,
    }))

    const receta = {
      id: recetaData.id,
      codigo: recetaData.nombre.substring(0, 3).toUpperCase() + recetaData.id.substring(0, 4),
      nombre: recetaData.nombre,
      descripcion: recetaData.descripcion || "",
      imagen: "",
      categoria: recetaData.categoria || "Plato Principal",
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

    const [recetaData] = await sql`
      UPDATE recetas SET
        nombre = ${body.nombre},
        descripcion = ${body.descripcion || null},
        porciones = ${body.porciones || 1},
        tiempo_preparacion = ${body.tiempoPreparacion || null},
        categoria = ${body.categoria || "Plato Principal"},
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
            INSERT INTO receta_insumos (id, receta_id, insumo_id, cantidad, unidad)
            VALUES (
              ${generateId()},
              ${id},
              ${insumo.insumoId},
              ${insumo.cantidadBasePorPersona},
              ${insumo.unidadReceta || "GRS"}
            )
          `
        }
      }
    }

    const receta = {
      id: recetaData.id,
      codigo: recetaData.nombre.substring(0, 3).toUpperCase() + recetaData.id.substring(0, 4),
      nombre: recetaData.nombre,
      descripcion: recetaData.descripcion || "",
      imagen: "",
      categoria: recetaData.categoria || "Plato Principal",
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

    // Delete insumos first (cascade should handle this, but just in case)
    await sql`DELETE FROM receta_insumos WHERE receta_id = ${id}`
    await sql`DELETE FROM recetas WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting receta:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

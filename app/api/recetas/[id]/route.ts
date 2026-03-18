import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET single receta with insumos
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data: recetaData, error: recetaError } = await supabase
      .from("recetas")
      .select("*")
      .eq("id", id)
      .single()

    if (recetaError) {
      console.error("[API] Error fetching receta:", recetaError)
      return NextResponse.json({ error: recetaError.message }, { status: 404 })
    }

    // Get insumos for this receta
    const { data: insumosData } = await supabase
      .from("receta_insumos")
      .select("*")
      .eq("receta_id", id)

    const insumos = (insumosData || []).map((i) => ({
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
    console.error("[API] Unexpected error:", err)
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
    const supabase = await createClient()
    const body = await request.json()

    // Update receta
    const { data: recetaData, error: recetaError } = await supabase
      .from("recetas")
      .update({
        nombre: body.nombre,
        descripcion: body.descripcion || null,
        porciones: body.porciones || 1,
        tiempo_preparacion: body.tiempoPreparacion || null,
        categoria: body.categoria || "Plato Principal",
      })
      .eq("id", id)
      .select()
      .single()

    if (recetaError) {
      console.error("[API] Error updating receta:", recetaError)
      return NextResponse.json({ error: recetaError.message }, { status: 500 })
    }

    // Update insumos: delete existing and insert new
    if (body.insumos) {
      await supabase.from("receta_insumos").delete().eq("receta_id", id)

      if (body.insumos.length > 0) {
        const insumosToInsert = body.insumos.map((i: { insumoId: string; cantidadBasePorPersona: number; unidadReceta?: string }) => ({
          receta_id: id,
          insumo_id: i.insumoId,
          cantidad: i.cantidadBasePorPersona,
          unidad: i.unidadReceta || "GRS",
        }))

        await supabase.from("receta_insumos").insert(insumosToInsert)
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
    console.error("[API] Unexpected error:", err)
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
    const supabase = await createClient()

    // Delete receta (insumos will cascade)
    const { error } = await supabase
      .from("recetas")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[API] Error deleting receta:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

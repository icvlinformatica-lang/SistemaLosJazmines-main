import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET all recetas with their insumos
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get recetas
    const { data: recetasData, error: recetasError } = await supabase
      .from("recetas")
      .select("*")
      .order("nombre", { ascending: true })

    if (recetasError) {
      console.error("[API] Error fetching recetas:", recetasError)
      return NextResponse.json({ error: recetasError.message }, { status: 500 })
    }

    // Get all receta_insumos
    const { data: insumosData, error: insumosError } = await supabase
      .from("receta_insumos")
      .select("*")

    if (insumosError) {
      console.error("[API] Error fetching receta_insumos:", insumosError)
      return NextResponse.json({ error: insumosError.message }, { status: 500 })
    }

    // Transform to app format
    const recetas = recetasData.map((receta) => {
      const insumos = insumosData
        .filter((i) => i.receta_id === receta.id)
        .map((i) => ({
          insumoId: i.insumo_id,
          detalleCorte: "",
          cantidadBasePorPersona: Number(i.cantidad),
          unidadReceta: i.unidad,
        }))

      return {
        id: receta.id,
        codigo: receta.nombre.substring(0, 3).toUpperCase() + receta.id.substring(0, 4),
        nombre: receta.nombre,
        descripcion: receta.descripcion || "",
        imagen: "",
        categoria: receta.categoria || "Plato Principal",
        insumos,
      }
    })

    return NextResponse.json(recetas)
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST create new receta
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Create receta
    const { data: recetaData, error: recetaError } = await supabase
      .from("recetas")
      .insert({
        nombre: body.nombre,
        descripcion: body.descripcion || null,
        porciones: body.porciones || 1,
        tiempo_preparacion: body.tiempoPreparacion || null,
        categoria: body.categoria || "Plato Principal",
      })
      .select()
      .single()

    if (recetaError) {
      console.error("[API] Error creating receta:", recetaError)
      return NextResponse.json({ error: recetaError.message }, { status: 500 })
    }

    // Create receta_insumos if provided
    if (body.insumos && body.insumos.length > 0) {
      const insumosToInsert = body.insumos.map((i: { insumoId: string; cantidadBasePorPersona: number; unidadReceta?: string }) => ({
        receta_id: recetaData.id,
        insumo_id: i.insumoId,
        cantidad: i.cantidadBasePorPersona,
        unidad: i.unidadReceta || "GRS",
      }))

      const { error: insumosError } = await supabase
        .from("receta_insumos")
        .insert(insumosToInsert)

      if (insumosError) {
        console.error("[API] Error creating receta_insumos:", insumosError)
        // Don't fail, just log
      }
    }

    // Return in app format
    const receta = {
      id: recetaData.id,
      codigo: recetaData.nombre.substring(0, 3).toUpperCase() + recetaData.id.substring(0, 4),
      nombre: recetaData.nombre,
      descripcion: recetaData.descripcion || "",
      imagen: "",
      categoria: recetaData.categoria || "Plato Principal",
      insumos: body.insumos || [],
    }

    return NextResponse.json(receta, { status: 201 })
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

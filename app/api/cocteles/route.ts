import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET all cocteles with their insumos
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get cocteles
    const { data: coctelesData, error: coctelesError } = await supabase
      .from("cocteles")
      .select("*")
      .order("nombre", { ascending: true })

    if (coctelesError) {
      console.error("[API] Error fetching cocteles:", coctelesError)
      return NextResponse.json({ error: coctelesError.message }, { status: 500 })
    }

    // Get all coctel_insumos
    const { data: insumosData, error: insumosError } = await supabase
      .from("coctel_insumos")
      .select("*")

    if (insumosError) {
      console.error("[API] Error fetching coctel_insumos:", insumosError)
      return NextResponse.json({ error: insumosError.message }, { status: 500 })
    }

    // Transform to app format
    const cocteles = coctelesData.map((coctel) => {
      const insumos = insumosData
        .filter((i) => i.coctel_id === coctel.id)
        .map((i) => ({
          insumoBarraId: i.insumo_id,
          cantidadPorCoctel: Number(i.cantidad),
          unidadCoctel: i.unidad,
        }))

      return {
        id: coctel.id,
        codigo: coctel.nombre.substring(0, 3).toUpperCase() + coctel.id.substring(0, 4),
        nombre: coctel.nombre,
        descripcion: coctel.descripcion || "",
        imagen: "",
        categoria: coctel.categoria || "Con Alcohol",
        insumos,
        preparacion: "",
      }
    })

    return NextResponse.json(cocteles)
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST create new coctel
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Create coctel
    const { data: coctelData, error: coctelError } = await supabase
      .from("cocteles")
      .insert({
        nombre: body.nombre,
        descripcion: body.descripcion || null,
        categoria: body.categoria || "Con Alcohol",
      })
      .select()
      .single()

    if (coctelError) {
      console.error("[API] Error creating coctel:", coctelError)
      return NextResponse.json({ error: coctelError.message }, { status: 500 })
    }

    // Create coctel_insumos if provided
    if (body.insumos && body.insumos.length > 0) {
      const insumosToInsert = body.insumos.map((i: { insumoBarraId: string; cantidadPorCoctel: number; unidadCoctel?: string }) => ({
        coctel_id: coctelData.id,
        insumo_id: i.insumoBarraId,
        cantidad: i.cantidadPorCoctel,
        unidad: i.unidadCoctel || "CC",
      }))

      const { error: insumosError } = await supabase
        .from("coctel_insumos")
        .insert(insumosToInsert)

      if (insumosError) {
        console.error("[API] Error creating coctel_insumos:", insumosError)
      }
    }

    const coctel = {
      id: coctelData.id,
      codigo: coctelData.nombre.substring(0, 3).toUpperCase() + coctelData.id.substring(0, 4),
      nombre: coctelData.nombre,
      descripcion: coctelData.descripcion || "",
      imagen: "",
      categoria: coctelData.categoria || "Con Alcohol",
      insumos: body.insumos || [],
      preparacion: "",
    }

    return NextResponse.json(coctel, { status: 201 })
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

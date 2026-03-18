import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET single coctel with insumos
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data: coctelData, error: coctelError } = await supabase
      .from("cocteles")
      .select("*")
      .eq("id", id)
      .single()

    if (coctelError) {
      console.error("[API] Error fetching coctel:", coctelError)
      return NextResponse.json({ error: coctelError.message }, { status: 404 })
    }

    // Get insumos for this coctel
    const { data: insumosData } = await supabase
      .from("coctel_insumos")
      .select("*")
      .eq("coctel_id", id)

    const insumos = (insumosData || []).map((i) => ({
      insumoBarraId: i.insumo_id,
      cantidadPorCoctel: Number(i.cantidad),
      unidadCoctel: i.unidad,
    }))

    const coctel = {
      id: coctelData.id,
      codigo: coctelData.nombre.substring(0, 3).toUpperCase() + coctelData.id.substring(0, 4),
      nombre: coctelData.nombre,
      descripcion: coctelData.descripcion || "",
      imagen: "",
      categoria: coctelData.categoria || "Con Alcohol",
      insumos,
      preparacion: "",
    }

    return NextResponse.json(coctel)
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT update coctel
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // Update coctel
    const { data: coctelData, error: coctelError } = await supabase
      .from("cocteles")
      .update({
        nombre: body.nombre,
        descripcion: body.descripcion || null,
        categoria: body.categoria || "Con Alcohol",
      })
      .eq("id", id)
      .select()
      .single()

    if (coctelError) {
      console.error("[API] Error updating coctel:", coctelError)
      return NextResponse.json({ error: coctelError.message }, { status: 500 })
    }

    // Update insumos: delete existing and insert new
    if (body.insumos) {
      await supabase.from("coctel_insumos").delete().eq("coctel_id", id)

      if (body.insumos.length > 0) {
        const insumosToInsert = body.insumos.map((i: { insumoBarraId: string; cantidadPorCoctel: number; unidadCoctel?: string }) => ({
          coctel_id: id,
          insumo_id: i.insumoBarraId,
          cantidad: i.cantidadPorCoctel,
          unidad: i.unidadCoctel || "CC",
        }))

        await supabase.from("coctel_insumos").insert(insumosToInsert)
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

    return NextResponse.json(coctel)
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE coctel
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from("cocteles")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[API] Error deleting coctel:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

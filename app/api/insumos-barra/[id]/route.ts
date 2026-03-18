import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET single insumo barra
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("insumos_barra")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      console.error("[API] Error fetching insumo_barra:", error)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    const insumo = {
      id: data.id,
      codigo: data.nombre.substring(0, 3).toUpperCase() + data.id.substring(0, 4),
      descripcion: data.nombre,
      unidad: data.unidad,
      stockActual: Number(data.cantidad),
      precioUnitario: Number(data.precio_unitario),
      proveedor: "",
      categoria: data.categoria || "Otros",
    }

    return NextResponse.json(insumo)
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT update insumo barra
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from("insumos_barra")
      .update({
        nombre: body.descripcion || body.nombre,
        categoria: body.categoria || "Otros",
        unidad: body.unidad,
        cantidad: body.stockActual ?? body.cantidad,
        precio_unitario: body.precioUnitario ?? body.precio_unitario,
        umbral_minimo: body.minimo ?? body.umbral_minimo,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[API] Error updating insumo_barra:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const insumo = {
      id: data.id,
      codigo: data.nombre.substring(0, 3).toUpperCase() + data.id.substring(0, 4),
      descripcion: data.nombre,
      unidad: data.unidad,
      stockActual: Number(data.cantidad),
      precioUnitario: Number(data.precio_unitario),
      proveedor: "",
      categoria: data.categoria || "Otros",
    }

    return NextResponse.json(insumo)
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE insumo barra
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from("insumos_barra")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[API] Error deleting insumo_barra:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

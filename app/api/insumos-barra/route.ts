import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET all insumos barra (bebidas)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("insumos_barra")
      .select("*")
      .order("nombre", { ascending: true })

    if (error) {
      console.error("[API] Error fetching insumos_barra:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform DB format to app format
    const insumos = data.map((item) => ({
      id: item.id,
      codigo: item.nombre.substring(0, 3).toUpperCase() + item.id.substring(0, 4),
      descripcion: item.nombre,
      unidad: item.unidad,
      stockActual: Number(item.cantidad),
      precioUnitario: Number(item.precio_unitario),
      proveedor: "",
      categoria: item.categoria || "Otros",
    }))

    return NextResponse.json(insumos)
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST create new insumo barra
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from("insumos_barra")
      .insert({
        nombre: body.descripcion || body.nombre,
        categoria: body.categoria || "Otros",
        unidad: body.unidad,
        cantidad: body.stockActual ?? body.cantidad ?? 0,
        precio_unitario: body.precioUnitario ?? body.precio_unitario ?? 0,
        umbral_minimo: body.minimo ?? body.umbral_minimo ?? 0,
      })
      .select()
      .single()

    if (error) {
      console.error("[API] Error creating insumo_barra:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return in app format
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

    return NextResponse.json(insumo, { status: 201 })
  } catch (err) {
    console.error("[API] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

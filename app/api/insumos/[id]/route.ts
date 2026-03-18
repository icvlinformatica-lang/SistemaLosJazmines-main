import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

// GET single insumo
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const [data] = await sql`
      SELECT * FROM insumos WHERE id = ${id}
    `

    if (!data) {
      return NextResponse.json({ error: "Insumo not found" }, { status: 404 })
    }

    const insumo = {
      id: data.id,
      codigo: data.nombre.substring(0, 3).toUpperCase() + data.id.substring(0, 4),
      descripcion: data.nombre,
      unidad: data.unidad,
      stockActual: Number(data.cantidad),
      precioUnitario: Number(data.precio_unitario),
      proveedor: "",
    }

    return NextResponse.json(insumo)
  } catch (err) {
    console.error("[API] Error fetching insumo:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT update insumo
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const [data] = await sql`
      UPDATE insumos SET
        nombre = ${body.descripcion || body.nombre},
        categoria = COALESCE(${body.categoria}, categoria),
        unidad = COALESCE(${body.unidad}, unidad),
        cantidad = COALESCE(${body.stockActual ?? body.cantidad}, cantidad),
        precio_unitario = COALESCE(${body.precioUnitario ?? body.precio_unitario}, precio_unitario),
        umbral_minimo = COALESCE(${body.minimo ?? body.umbral_minimo}, umbral_minimo),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!data) {
      return NextResponse.json({ error: "Insumo not found" }, { status: 404 })
    }

    const insumo = {
      id: data.id,
      codigo: data.nombre.substring(0, 3).toUpperCase() + data.id.substring(0, 4),
      descripcion: data.nombre,
      unidad: data.unidad,
      stockActual: Number(data.cantidad),
      precioUnitario: Number(data.precio_unitario),
      proveedor: "",
    }

    return NextResponse.json(insumo)
  } catch (err) {
    console.error("[API] Error updating insumo:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE insumo
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await sql`DELETE FROM insumos WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting insumo:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

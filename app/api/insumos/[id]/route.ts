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
      codigo: data.codigo,
      descripcion: data.descripcion,
      unidad: data.unidad,
      stockActual: Number(data.stock_actual),
      precioUnitario: Number(data.precio_unitario),
      proveedor: data.proveedor || "",
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
        codigo = COALESCE(${body.codigo}, codigo),
        descripcion = COALESCE(${body.descripcion}, descripcion),
        unidad = COALESCE(${body.unidad}, unidad),
        stock_actual = COALESCE(${body.stockActual}, stock_actual),
        precio_unitario = COALESCE(${body.precioUnitario}, precio_unitario),
        proveedor = COALESCE(${body.proveedor}, proveedor),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!data) {
      return NextResponse.json({ error: "Insumo not found" }, { status: 404 })
    }

    const insumo = {
      id: data.id,
      codigo: data.codigo,
      descripcion: data.descripcion,
      unidad: data.unidad,
      stockActual: Number(data.stock_actual),
      precioUnitario: Number(data.precio_unitario),
      proveedor: data.proveedor || "",
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

import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

// GET single insumo barra
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const [data] = await sql`
      SELECT * FROM insumos_barra WHERE id = ${id}
    `

    if (!data) {
      return NextResponse.json({ error: "Insumo barra not found" }, { status: 404 })
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
    console.error("[API] Error fetching insumo_barra:", err)
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
    const body = await request.json()

    const [data] = await sql`
      UPDATE insumos_barra SET
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
      return NextResponse.json({ error: "Insumo barra not found" }, { status: 404 })
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
    console.error("[API] Error updating insumo_barra:", err)
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

    await sql`DELETE FROM insumos_barra WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting insumo_barra:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

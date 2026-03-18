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
      codigo: data.codigo,
      descripcion: data.descripcion,
      unidad: data.unidad,
      stockActual: Number(data.stock_actual),
      precioUnitario: Number(data.precio_unitario),
      proveedor: data.proveedor || "",
      categoria: data.categoria,
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
        codigo = COALESCE(${body.codigo}, codigo),
        descripcion = COALESCE(${body.descripcion}, descripcion),
        unidad = COALESCE(${body.unidad}, unidad),
        stock_actual = COALESCE(${body.stockActual}, stock_actual),
        precio_unitario = COALESCE(${body.precioUnitario}, precio_unitario),
        proveedor = COALESCE(${body.proveedor}, proveedor),
        categoria = COALESCE(${body.categoria}, categoria),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!data) {
      return NextResponse.json({ error: "Insumo barra not found" }, { status: 404 })
    }

    const insumo = {
      id: data.id,
      codigo: data.codigo,
      descripcion: data.descripcion,
      unidad: data.unidad,
      stockActual: Number(data.stock_actual),
      precioUnitario: Number(data.precio_unitario),
      proveedor: data.proveedor || "",
      categoria: data.categoria,
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

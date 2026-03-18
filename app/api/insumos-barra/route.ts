import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"

// GET all insumos de barra - uses descripcion column
export async function GET() {
  try {
    const data = await sql`
      SELECT * FROM insumos_barra ORDER BY descripcion ASC
    `

    const insumos = data.map((item) => ({
      id: item.id,
      codigo: item.codigo,
      descripcion: item.descripcion,
      unidad: item.unidad,
      stockActual: Number(item.stock_actual),
      precioUnitario: Number(item.precio_unitario),
      proveedor: item.proveedor || "",
      categoria: item.categoria,
    }))

    return NextResponse.json(insumos)
  } catch (err) {
    console.error("[API] Error fetching insumos_barra:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST create new insumo barra
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const id = generateId()

    const [data] = await sql`
      INSERT INTO insumos_barra (id, codigo, descripcion, unidad, stock_actual, precio_unitario, proveedor, categoria)
      VALUES (
        ${id},
        ${body.codigo},
        ${body.descripcion},
        ${body.unidad},
        ${body.stockActual ?? 0},
        ${body.precioUnitario ?? 0},
        ${body.proveedor || null},
        ${body.categoria}
      )
      RETURNING *
    `

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

    return NextResponse.json(insumo, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating insumo_barra:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

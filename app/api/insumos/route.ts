import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"

// GET all insumos (cocina)
export async function GET() {
  try {
    const data = await sql`
      SELECT * FROM insumos ORDER BY nombre ASC
    `

    // Transform DB format to app format
    const insumos = data.map((item) => ({
      id: item.id,
      codigo: item.nombre.substring(0, 3).toUpperCase() + item.id.substring(0, 4),
      descripcion: item.nombre,
      unidad: item.unidad,
      stockActual: Number(item.cantidad),
      precioUnitario: Number(item.precio_unitario),
      proveedor: "",
    }))

    return NextResponse.json(insumos)
  } catch (err) {
    console.error("[API] Error fetching insumos:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST create new insumo
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const id = generateId()

    const [data] = await sql`
      INSERT INTO insumos (id, nombre, categoria, unidad, cantidad, precio_unitario, umbral_minimo)
      VALUES (
        ${id},
        ${body.descripcion || body.nombre},
        ${body.categoria || "General"},
        ${body.unidad},
        ${body.stockActual ?? body.cantidad ?? 0},
        ${body.precioUnitario ?? body.precio_unitario ?? 0},
        ${body.minimo ?? body.umbral_minimo ?? 0}
      )
      RETURNING *
    `

    // Return in app format
    const insumo = {
      id: data.id,
      codigo: data.nombre.substring(0, 3).toUpperCase() + data.id.substring(0, 4),
      descripcion: data.nombre,
      unidad: data.unidad,
      stockActual: Number(data.cantidad),
      precioUnitario: Number(data.precio_unitario),
      proveedor: "",
    }

    return NextResponse.json(insumo, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating insumo:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

// GET all insumos
export async function GET() {
  try {
    const data = await sql`SELECT * FROM insumos ORDER BY descripcion ASC`

    const insumos = data.map((item) => ({
      id: item.id,
      codigo: item.codigo,
      descripcion: item.descripcion,
      unidad: item.unidad,
      stockActual: Number(item.stock_actual),
      precioUnitario: Number(item.precio_unitario),
      proveedor: item.proveedor || "",
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
    const codigo = body.codigo || id.substring(0, 6).toUpperCase()

    const [data] = await sql`
      INSERT INTO insumos (id, codigo, descripcion, unidad, stock_actual, precio_unitario, proveedor)
      VALUES (
        ${id},
        ${codigo},
        ${body.descripcion},
        ${body.unidad},
        ${body.stockActual ?? 0},
        ${body.precioUnitario ?? 0},
        ${body.proveedor || null}
      )
      RETURNING *
    `

    await logActivity("insumo", "creado", data.descripcion, `Código: ${data.codigo}`)
    return NextResponse.json({
      id: data.id,
      codigo: data.codigo,
      descripcion: data.descripcion,
      unidad: data.unidad,
      stockActual: Number(data.stock_actual),
      precioUnitario: Number(data.precio_unitario),
      proveedor: data.proveedor || "",
    }, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating insumo:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

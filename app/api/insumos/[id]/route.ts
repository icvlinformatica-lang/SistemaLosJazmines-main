export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

// GET single insumo
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [data] = await sql`SELECT * FROM insumos WHERE id = ${id}`

    if (!data) {
      return NextResponse.json({ error: "Insumo not found" }, { status: 404 })
    }

    return NextResponse.json({
      id: data.id,
      codigo: data.codigo,
      descripcion: data.descripcion,
      unidad: data.unidad,
      stockActual: Number(data.stock_actual),
      precioUnitario: Number(data.precio_unitario),
      proveedor: data.proveedor || "",
    })
  } catch (err) {
    console.error("[API] Error fetching insumo:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH update insumo
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Precio actual antes de actualizar (para el historial de evolución)
    const [previo] = await sql`SELECT precio_unitario FROM insumos WHERE id = ${id}`

    const [data] = await sql`
      UPDATE insumos SET
        codigo          = COALESCE(${body.codigo ?? null}, codigo),
        descripcion     = COALESCE(${body.descripcion ?? null}, descripcion),
        unidad          = COALESCE(${body.unidad ? String(body.unidad).toUpperCase().trim() : null}, unidad),
        stock_actual    = COALESCE(${body.stockActual ?? null}, stock_actual),
        precio_unitario = COALESCE(${body.precioUnitario ?? null}, precio_unitario),
        proveedor       = COALESCE(${body.proveedor ?? null}, proveedor),
        updated_at      = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!data) {
      return NextResponse.json({ error: "Insumo not found" }, { status: 404 })
    }

    // Registro automático de evolución de precio: una fila por insumo y día.
    // Si el precio cambia varias veces el mismo día, se conserva el último.
    const precioNuevo = Number(data.precio_unitario)
    const precioPrevio = previo ? Number(previo.precio_unitario) : null
    if (body.precioUnitario != null && precioPrevio !== null && precioNuevo !== precioPrevio) {
      try {
        await sql`
          INSERT INTO insumos_precio_historial (insumo_id, precio_anterior, precio)
          VALUES (${id}, ${precioPrevio}, ${precioNuevo})
          ON CONFLICT (insumo_id, fecha)
          DO UPDATE SET precio = EXCLUDED.precio
        `
      } catch (histErr) {
        console.error("[API] Error registrando historial de precio:", histErr)
      }
    }

    return NextResponse.json({
      id: data.id,
      codigo: data.codigo,
      descripcion: data.descripcion,
      unidad: data.unidad,
      stockActual: Number(data.stock_actual),
      precioUnitario: Number(data.precio_unitario),
      proveedor: data.proveedor || "",
    })
  } catch (err) {
    console.error("[API] Error updating insumo:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT update insumo (alias for PATCH for backwards compatibility)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return PATCH(request, { params })
}

// DELETE insumo
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await sql`DELETE FROM insumos WHERE id = ${id}`
    await logActivity("insumo", "eliminado", id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting insumo:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

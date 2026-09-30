export const dynamic = 'force-dynamic'
import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"
import { permisoInsumo, type AccionInsumo, type SectorInsumo } from "@/lib/insumos-permisos"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"

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
      contenidoCantidad: item.contenido_cantidad != null ? Number(item.contenido_cantidad) : undefined,
      contenidoUnidad: item.contenido_unidad || undefined,
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
    const prohibido = await negar(request, "crear")
    if (prohibido) return prohibido

    const body = await request.json()
    const id = generateId()

    const [data] = await sql`
      INSERT INTO insumos_barra (id, codigo, descripcion, unidad, stock_actual, precio_unitario, proveedor, categoria)
      VALUES (
        ${id},
        ${body.codigo},
        ${body.descripcion},
        ${String(body.unidad || "UN").toUpperCase().trim()},
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
      contenidoCantidad: data.contenido_cantidad != null ? Number(data.contenido_cantidad) : undefined,
      contenidoUnidad: data.contenido_unidad || undefined,
      proveedor: data.proveedor || "",
      categoria: data.categoria,
    }

    await logActivity("insumo_barra", "creado", body.descripcion, `Codigo: ${body.codigo} | Unidad: ${body.unidad}`)
    return NextResponse.json(insumo, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating insumo_barra:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Cocina y Barra entran a estas pantallas para ajustar existencias, pero el
 * catálogo (unidad, contenido, precio) es de Administración: ver
 * lib/insumos-permisos.ts. El perfil sale del token firmado, no de lo que
 * diga la pantalla.
 */
async function negar(request: Request, accion: AccionInsumo, campos?: string[]) {
  const perfilId = await perfilDesdeRequest(request)
  const veredicto = permisoInsumo({ perfilId, sector: "barra" as SectorInsumo, accion, campos })
  if (veredicto.ok) return null
  return NextResponse.json({ error: veredicto.error }, { status: 403 })
}

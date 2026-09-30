export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"
import { permisoInsumo, type AccionInsumo, type SectorInsumo } from "@/lib/insumos-permisos"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"

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
      contenidoCantidad: data.contenido_cantidad != null ? Number(data.contenido_cantidad) : undefined,
      contenidoUnidad: data.contenido_unidad || undefined,
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

    // `?? null` en cada campo, como en app/api/insumos/[id]: postgres.js
    // rechaza `undefined` con UNDEFINED_VALUE, así que un body parcial
    // (ej. solo { stockActual }, que es lo único que manda Barra y lo que
    // manda el descuento automático al imprimir) tiraba 500.

    const prohibido = await negar(request, "editar", Object.keys(body ?? {}))
    if (prohibido) return prohibido

    // Contenido por unidad (una botella de gin = 700 CC). Los dos datos van
    // juntos o no van. Si no vienen en el body, no se toca lo que ya había.
    const tocaContenido = "contenidoCantidad" in body || "contenidoUnidad" in body
    const contCantidad = Number(body.contenidoCantidad) > 0 ? Number(body.contenidoCantidad) : null
    const contUnidad =
      contCantidad && (body.contenidoUnidad === "GRS" || body.contenidoUnidad === "CC") ? body.contenidoUnidad : null
    const contOk = contCantidad !== null && contUnidad !== null

    const [data] = await sql`
      UPDATE insumos_barra SET
        codigo = COALESCE(${body.codigo ?? null}, codigo),
        descripcion = COALESCE(${body.descripcion ?? null}, descripcion),
        unidad = COALESCE(${body.unidad ? String(body.unidad).toUpperCase().trim() : null}, unidad),
        stock_actual = COALESCE(${body.stockActual ?? null}, stock_actual),
        precio_unitario = COALESCE(${body.precioUnitario ?? null}, precio_unitario),
        proveedor = COALESCE(${body.proveedor ?? null}, proveedor),
        categoria = COALESCE(${body.categoria ?? null}, categoria),
        contenido_cantidad = ${tocaContenido ? (contOk ? contCantidad : null) : sql`contenido_cantidad`},
        contenido_unidad   = ${tocaContenido ? (contOk ? contUnidad : null) : sql`contenido_unidad`},
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
      contenidoCantidad: data.contenido_cantidad != null ? Number(data.contenido_cantidad) : undefined,
      contenidoUnidad: data.contenido_unidad || undefined,
      proveedor: data.proveedor || "",
      categoria: data.categoria,
    }

    await logActivity("insumo_barra", "modificado", data.descripcion, `Stock: ${data.stock_actual} | Precio: ${data.precio_unitario}`)
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
    const prohibido = await negar(request, "borrar")
    if (prohibido) return prohibido

    const [insumo] = await sql`SELECT descripcion FROM insumos_barra WHERE id = ${id}`
    await sql`DELETE FROM insumos_barra WHERE id = ${id}`
    if (insumo) await logActivity("insumo_barra", "eliminado", insumo.descripcion)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting insumo_barra:", err)
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

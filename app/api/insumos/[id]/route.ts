export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"
import { permisoInsumo, type AccionInsumo, type SectorInsumo } from "@/lib/insumos-permisos"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"

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
      contenidoCantidad: data.contenido_cantidad != null ? Number(data.contenido_cantidad) : undefined,
      contenidoUnidad: data.contenido_unidad || undefined,
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

    const prohibido = await negar(request, "editar", Object.keys(body ?? {}))
    if (prohibido) return prohibido

    // Precio actual antes de actualizar (para el historial de evolución)
    const [previo] = await sql`SELECT precio_unitario FROM insumos WHERE id = ${id}`

    // Contenido por unidad (una lata de arvejas = 200 GRS). Los dos datos van
    // juntos o no van. Mandar contenidoCantidad = 0 o null a propósito lo
    // borra: por eso se distingue "no vino en el body" de "vino vacío".
    const tocaContenido = "contenidoCantidad" in body || "contenidoUnidad" in body
    const contCantidad = Number(body.contenidoCantidad) > 0 ? Number(body.contenidoCantidad) : null
    const contUnidad =
      contCantidad && (body.contenidoUnidad === "GRS" || body.contenidoUnidad === "CC") ? body.contenidoUnidad : null
    const contenidoFinal = contCantidad !== null && contUnidad !== null ? { cantidad: contCantidad, unidad: contUnidad } : null

    const [data] = await sql`
      UPDATE insumos SET
        codigo          = COALESCE(${body.codigo ?? null}, codigo),
        descripcion     = COALESCE(${body.descripcion ?? null}, descripcion),
        unidad          = COALESCE(${body.unidad ? String(body.unidad).toUpperCase().trim() : null}, unidad),
        stock_actual    = COALESCE(${body.stockActual ?? null}, stock_actual),
        precio_unitario = COALESCE(${body.precioUnitario ?? null}, precio_unitario),
        proveedor       = COALESCE(${body.proveedor ?? null}, proveedor),
        contenido_cantidad = ${tocaContenido ? (contenidoFinal ? contenidoFinal.cantidad : null) : sql`contenido_cantidad`},
        contenido_unidad   = ${tocaContenido ? (contenidoFinal ? contenidoFinal.unidad : null) : sql`contenido_unidad`},
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
      contenidoCantidad: data.contenido_cantidad != null ? Number(data.contenido_cantidad) : undefined,
      contenidoUnidad: data.contenido_unidad || undefined,
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
    const prohibido = await negar(request, "borrar")
    if (prohibido) return prohibido

    await sql`DELETE FROM insumos WHERE id = ${id}`
    await logActivity("insumo", "eliminado", id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting insumo:", err)
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
  const veredicto = permisoInsumo({ perfilId, sector: "cocina" as SectorInsumo, accion, campos })
  if (veredicto.ok) return null
  return NextResponse.json({ error: veredicto.error }, { status: 403 })
}

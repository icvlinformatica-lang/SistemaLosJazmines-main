export const dynamic = 'force-dynamic'
import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"
import { permisoInsumo, type AccionInsumo, type SectorInsumo } from "@/lib/insumos-permisos"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"

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
      // Cuánto trae cada unidad (una lata de arvejas = 200 GRS). Sin esto,
      // una receta en gramos de un insumo por unidad no se puede convertir.
      contenidoCantidad: item.contenido_cantidad != null ? Number(item.contenido_cantidad) : undefined,
      contenidoUnidad: item.contenido_unidad || undefined,
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
    const prohibido = await negar(request, "crear")
    if (prohibido) return prohibido

    const body = await request.json()
    const id = generateId()
    const codigo = body.codigo || id.substring(0, 6).toUpperCase()
    // Los dos datos del contenido van juntos o no van: media carga no sirve
    // para convertir, y la base lo rechaza por constraint.
    const contenidoCantidad = Number(body.contenidoCantidad) > 0 ? Number(body.contenidoCantidad) : null
    const contenidoUnidad = contenidoCantidad && (body.contenidoUnidad === "GRS" || body.contenidoUnidad === "CC")
      ? body.contenidoUnidad
      : null
    const contenidoValido = contenidoCantidad !== null && contenidoUnidad !== null

    const [data] = await sql`
      INSERT INTO insumos (id, codigo, descripcion, unidad, stock_actual, precio_unitario, proveedor,
                           contenido_cantidad, contenido_unidad)
      VALUES (
        ${id},
        ${codigo},
        ${body.descripcion},
        ${String(body.unidad || "UN").toUpperCase().trim()},
        ${body.stockActual ?? 0},
        ${body.precioUnitario ?? 0},
        ${body.proveedor || null},
        ${contenidoValido ? contenidoCantidad : null},
        ${contenidoValido ? contenidoUnidad : null}
      )
      RETURNING *
    `

    await logActivity("insumo", "creado", data.descripcion, `Código: ${data.codigo}`)

    // Registrar el precio inicial en el historial de evolución
    if (Number(data.precio_unitario) > 0) {
      try {
        await sql`
          INSERT INTO insumos_precio_historial (insumo_id, precio_anterior, precio)
          VALUES (${data.id}, NULL, ${Number(data.precio_unitario)})
          ON CONFLICT (insumo_id, fecha) DO UPDATE SET precio = EXCLUDED.precio
        `
      } catch (histErr) {
        console.error("[API] Error registrando precio inicial:", histErr)
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
      contenidoCantidad: data.contenido_cantidad != null ? Number(data.contenido_cantidad) : undefined,
      contenidoUnidad: data.contenido_unidad || undefined,
    }, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating insumo:", err)
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

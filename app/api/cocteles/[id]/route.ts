export const dynamic = 'force-dynamic'
import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"
import { puedeEditarCocteles, ERROR_SIN_PERMISO_COCTELES } from "@/lib/cocteles-permisos"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { camposDelBody, filaACoctel, type FilaCoctel } from "@/lib/cocteles-api"

// GET single coctel with insumos
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const [coctelData] = await sql`
      SELECT * FROM cocteles WHERE id = ${id}
    `

    if (!coctelData) {
      return NextResponse.json({ error: "Coctel not found" }, { status: 404 })
    }

    const insumosData = await sql`
      SELECT * FROM coctel_insumos WHERE coctel_id = ${id}
    `

    const insumos = insumosData.map((i) => ({
      insumoBarraId: i.insumo_barra_id,
      cantidadPorCoctel: Number(i.cantidad_por_coctel),
      unidadCoctel: i.unidad_coctel,
    }))

    return NextResponse.json(filaACoctel(coctelData as FilaCoctel, insumos))
  } catch (err) {
    console.error("[API] Error fetching coctel:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT update coctel
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prohibido = await negar(request)
    if (prohibido) return prohibido

    const { id } = await params
    const body = await request.json()

    // null = no vino en el body, no se toca; un texto vacío sí se guarda.
    const c = camposDelBody(body)

    const [coctelData] = await sql`
      UPDATE cocteles SET
        codigo = COALESCE(${c.codigo}, codigo),
        nombre = COALESCE(${c.nombre}, nombre),
        categoria = COALESCE(${c.categoria}, categoria),
        descripcion = COALESCE(${c.descripcion}, descripcion),
        imagen = COALESCE(${c.imagen}, imagen),
        instrucciones = COALESCE(${c.instrucciones}, instrucciones),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!coctelData) {
      return NextResponse.json({ error: "Coctel not found" }, { status: 404 })
    }

    // Support both "insumos" and "ingredientes" keys
    const insumosList = body.insumos || body.ingredientes || null

    if (insumosList) {
      await sql`DELETE FROM coctel_insumos WHERE coctel_id = ${id}`

      for (const insumo of insumosList) {
        await sql`
          INSERT INTO coctel_insumos (id, coctel_id, insumo_barra_id, cantidad_por_coctel, unidad_coctel)
          VALUES (
            ${generateId()},
            ${id},
            ${insumo.insumoBarraId || insumo.insumoId},
            ${insumo.cantidadPorCoctel ?? insumo.cantidadBasePorPersona ?? insumo.cantidad ?? 0},
            ${insumo.unidadCoctel || insumo.unidadReceta || insumo.unidad || "CC"}
          )
        `
      }
    }

    // Si no vinieron insumos, se devuelven los que ya tenía (no una lista vacía).
    const insumosFinales =
      insumosList ??
      (await sql`SELECT * FROM coctel_insumos WHERE coctel_id = ${id}`).map((i) => ({
        insumoBarraId: i.insumo_barra_id,
        cantidadPorCoctel: Number(i.cantidad_por_coctel),
        unidadCoctel: i.unidad_coctel,
      }))
    const coctel = filaACoctel(coctelData as FilaCoctel, insumosFinales)

    await logActivity("coctel", "modificado", coctelData.nombre)
    return NextResponse.json(coctel)
  } catch (err) {
    console.error("[API] Error updating coctel:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE coctel
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prohibido = await negar(request)
    if (prohibido) return prohibido

    const { id } = await params

    const [coctel] = await sql`SELECT nombre FROM cocteles WHERE id = ${id}`
    await sql`DELETE FROM coctel_insumos WHERE coctel_id = ${id}`
    await sql`DELETE FROM cocteles WHERE id = ${id}`
    if (coctel) await logActivity("coctel", "eliminado", coctel.nombre)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting coctel:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * La carta de cócteles la maneja Administración: la receta de un cóctel define
 * el costo de la barra de un evento. Barra la consulta, no la cambia. El
 * perfil sale del token firmado, no de lo que diga la pantalla.
 */
async function negar(request: Request) {
  const perfilId = await perfilDesdeRequest(request)
  if (puedeEditarCocteles(perfilId)) return null
  return NextResponse.json({ error: ERROR_SIN_PERMISO_COCTELES }, { status: 403 })
}

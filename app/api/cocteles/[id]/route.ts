export const dynamic = 'force-dynamic'
import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

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

    const coctel = {
      id: coctelData.id,
      nombre: coctelData.nombre,
      categoria: coctelData.categoria,
      instrucciones: coctelData.instrucciones || "",
      insumos,
    }

    return NextResponse.json(coctel)
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
    const { id } = await params
    const body = await request.json()

    // Convert undefined/null safely
    const nombre = body.nombre != null ? body.nombre : null
    const categoria = body.categoria != null ? body.categoria : null
    const instrucciones = body.instrucciones != null ? body.instrucciones : null

    const [coctelData] = await sql`
      UPDATE cocteles SET
        nombre = COALESCE(${nombre}, nombre),
        categoria = COALESCE(${categoria}, categoria),
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

    const coctel = {
      id: coctelData.id,
      nombre: coctelData.nombre,
      categoria: coctelData.categoria,
      instrucciones: coctelData.instrucciones || "",
      insumos: insumosList || [],
    }

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

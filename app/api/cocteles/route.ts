export const dynamic = 'force-dynamic'
import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

// GET all cocteles with their insumos
export async function GET() {
  try {
    const coctelesData = await sql`
      SELECT * FROM cocteles ORDER BY nombre ASC
    `

    const insumosData = await sql`
      SELECT * FROM coctel_insumos
    `

    const cocteles = coctelesData.map((coctel) => {
      const insumos = insumosData
        .filter((i) => i.coctel_id === coctel.id)
        .map((i) => ({
          insumoBarraId: i.insumo_barra_id,
          cantidadPorCoctel: Number(i.cantidad_por_coctel),
          unidadCoctel: i.unidad_coctel,
        }))

      return {
        id: coctel.id,
        nombre: coctel.nombre,
        categoria: coctel.categoria,
        instrucciones: coctel.instrucciones || "",
        insumos,
      }
    })

    return NextResponse.json(cocteles)
  } catch (err) {
    console.error("[API] Error fetching cocteles:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST create new coctel
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const id = generateId()

    const [coctelData] = await sql`
      INSERT INTO cocteles (id, codigo, nombre, categoria)
      VALUES (
        ${id},
        ${"COC-" + id.slice(0, 8).toUpperCase()},
        ${body.nombre},
        ${body.categoria || "Con Alcohol"}
      )
      RETURNING *
    `

    // Create coctel_insumos if provided
    if (body.insumos && body.insumos.length > 0) {
      for (const insumo of body.insumos) {
        await sql`
          INSERT INTO coctel_insumos (id, coctel_id, insumo_barra_id, cantidad_por_coctel, unidad_coctel)
          VALUES (
            ${generateId()},
            ${id},
            ${insumo.insumoBarraId},
            ${insumo.cantidadPorCoctel},
            ${insumo.unidadCoctel || "CC"}
          )
        `
      }
    }

    const coctel = {
      id: coctelData.id,
      nombre: coctelData.nombre,
      categoria: coctelData.categoria,
      instrucciones: coctelData.instrucciones || "",
      insumos: body.insumos || [],
    }

    await logActivity("coctel", "creado", body.nombre, `Categoria: ${body.categoria || "Con Alcohol"}`)
    return NextResponse.json(coctel, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating coctel:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

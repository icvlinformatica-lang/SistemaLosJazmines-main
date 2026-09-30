export const dynamic = 'force-dynamic'
import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"
import { puedeEditarCocteles, ERROR_SIN_PERMISO_COCTELES } from "@/lib/cocteles-permisos"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { camposDelBody, filaACoctel, type FilaCoctel } from "@/lib/cocteles-api"

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

      return filaACoctel(coctel as FilaCoctel, insumos)
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
    const prohibido = await negar(request)
    if (prohibido) return prohibido

    const body = await request.json()
    const id = generateId()
    const campos = camposDelBody(body)

    const [coctelData] = await sql`
      INSERT INTO cocteles (id, codigo, nombre, categoria, descripcion, imagen, instrucciones)
      VALUES (
        ${id},
        ${campos.codigo?.trim() || "COC-" + id.slice(0, 8).toUpperCase()},
        ${body.nombre},
        ${body.categoria || "Con Alcohol"},
        ${campos.descripcion ?? ""},
        ${campos.imagen ?? ""},
        ${campos.instrucciones ?? ""}
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

    const coctel = filaACoctel(coctelData as FilaCoctel, body.insumos || [])

    await logActivity("coctel", "creado", body.nombre, `Categoria: ${body.categoria || "Con Alcohol"}`)
    return NextResponse.json(coctel, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating coctel:", err)
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

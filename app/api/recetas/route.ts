export const dynamic = 'force-dynamic'
import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"
import { leerRecetas } from "@/lib/lecturas-postgres"
import { logActivity } from "@/lib/activity-logger"
import { puedeEditarRecetas, ERROR_SIN_PERMISO_RECETAS } from "@/lib/recetas-permisos"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"

/**
 * El recetario lo maneja Administración: la receta define el costo de la
 * comida de un evento. El perfil sale del token firmado, no de la pantalla.
 */
async function negar(request: Request) {
  const perfilId = await perfilDesdeRequest(request)
  if (puedeEditarRecetas(perfilId)) return null
  return NextResponse.json({ error: ERROR_SIN_PERMISO_RECETAS }, { status: 403 })
}

export async function GET() {
  try {
    // Lectura compartida con la carga inicial unificada (lib/lecturas-postgres.ts).
    return NextResponse.json(await leerRecetas())
  } catch (err) {
    console.error("[API] Error fetching recetas:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const sinPermiso = await negar(request)
  if (sinPermiso) return sinPermiso
  try {
    const body = await request.json()
    const id = generateId()
    const codigo = body.codigo || id.substring(0, 6).toUpperCase()

    const [recetaData] = await sql`
      INSERT INTO recetas (id, codigo, nombre, descripcion, imagen, categoria, factor_rendimiento)
      VALUES (
        ${id},
        ${codigo},
        ${body.nombre},
        ${body.descripcion || null},
        ${body.imagen || null},
        ${body.categoria || "Plato Principal"},
        ${Number(body.factorRendimiento) || 1}
      )
      RETURNING id, codigo, nombre, descripcion, imagen, categoria, factor_rendimiento
    `

    if (body.insumos && body.insumos.length > 0) {
      for (const insumo of body.insumos) {
        await sql`
          INSERT INTO receta_insumos (id, receta_id, insumo_id, detalle_corte, cantidad_base_por_persona, unidad_receta)
          VALUES (
            ${generateId()},
            ${id},
            ${insumo.insumoId},
            ${insumo.detalleCorte || null},
            ${insumo.cantidadBasePorPersona},
            ${insumo.unidadReceta || "GRS"}
          )
        `
      }
    }

    await logActivity("receta", "creado", body.nombre, `Categoria: ${body.categoria || "Plato Principal"}`)
    return NextResponse.json({
      id: recetaData.id,
      codigo: recetaData.codigo,
      nombre: recetaData.nombre,
      descripcion: recetaData.descripcion || "",
      imagen: recetaData.imagen || "",
      categoria: recetaData.categoria,
      factorRendimiento: Number(recetaData.factor_rendimiento) || 1,
      insumos: body.insumos || [],
    }, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating receta:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

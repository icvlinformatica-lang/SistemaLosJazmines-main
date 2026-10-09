export const dynamic = 'force-dynamic'
import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"
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

// GET single receta with insumos
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [recetaData] = await sql`
      SELECT id, codigo, nombre, descripcion, imagen, categoria, factor_rendimiento
      FROM recetas WHERE id = ${id}
    `

    if (!recetaData) {
      return NextResponse.json({ error: "Receta not found" }, { status: 404 })
    }

    const insumosData = await sql`
      SELECT insumo_id, detalle_corte, cantidad_base_por_persona, unidad_receta
      FROM receta_insumos WHERE receta_id = ${id}
    `

    const insumos = insumosData.map((i) => ({
      insumoId: i.insumo_id,
      detalleCorte: i.detalle_corte || "",
      cantidadBasePorPersona: Number(i.cantidad_base_por_persona),
      unidadReceta: i.unidad_receta,
    }))

    return NextResponse.json({
      id: recetaData.id,
      codigo: recetaData.codigo,
      nombre: recetaData.nombre,
      descripcion: recetaData.descripcion || "",
      imagen: recetaData.imagen || "",
      categoria: recetaData.categoria,
      factorRendimiento: recetaData.factor_rendimiento || 1,
      insumos,
    })
  } catch (err) {
    console.error("[API] Error fetching receta:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT update receta
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sinPermiso = await negar(request)
  if (sinPermiso) return sinPermiso
  try {
    const { id } = await params
    const body = await request.json()

    // Todo en una transacción: los insumos se reemplazan borrando y volviendo
    // a cargar, y si algo fallaba en el medio la receta quedaba con menos
    // ingredientes (y cambiaba el costo de los eventos que la usan). Así se
    // guarda entero o no se guarda nada.
    const guardado = await sql.begin(async (trx) => {
      // Los tipos de postgres.js no marcan la transacción como invocable
      // (TS2349), aunque en ejecución funciona igual que sql.
      const tx = trx as unknown as typeof sql
      const [recetaData] = await tx`
        UPDATE recetas SET
          nombre             = COALESCE(${body.nombre ?? null}, nombre),
          codigo             = COALESCE(${body.codigo ?? null}, codigo),
          descripcion        = COALESCE(${body.descripcion ?? null}, descripcion),
          imagen             = COALESCE(${body.imagen ?? null}, imagen),
          categoria          = COALESCE(${body.categoria ?? null}, categoria),
          factor_rendimiento = COALESCE(${body.factorRendimiento ?? null}, factor_rendimiento),
          updated_at         = NOW()
        WHERE id = ${id}
        RETURNING *
      `

      if (!recetaData) return null

      // Si se envían insumos, reemplazarlos completos
      if (body.insumos !== undefined) {
        await tx`DELETE FROM receta_insumos WHERE receta_id = ${id}`

        for (const insumo of body.insumos) {
          await tx`
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

      // Leer los insumos actualizados para devolver
      const insumosData = await tx`
        SELECT insumo_id, detalle_corte, cantidad_base_por_persona, unidad_receta
        FROM receta_insumos WHERE receta_id = ${id}
      `
      return { recetaData, insumosData }
    })

    if (!guardado) {
      return NextResponse.json({ error: "Receta not found" }, { status: 404 })
    }
    const { recetaData, insumosData } = guardado

    return NextResponse.json({
      id: recetaData.id,
      codigo: recetaData.codigo,
      nombre: recetaData.nombre,
      descripcion: recetaData.descripcion || "",
      imagen: recetaData.imagen || "",
      categoria: recetaData.categoria,
      factorRendimiento: recetaData.factor_rendimiento || 1,
      insumos: insumosData.map((i) => ({
        insumoId: i.insumo_id,
        detalleCorte: i.detalle_corte || "",
        cantidadBasePorPersona: Number(i.cantidad_base_por_persona),
        unidadReceta: i.unidad_receta,
      })),
    })
  } catch (err) {
    console.error("[API] Error updating receta:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE receta
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sinPermiso = await negar(request)
  if (sinPermiso) return sinPermiso
  try {
    const { id } = await params
    await sql`DELETE FROM recetas WHERE id = ${id}`
    await logActivity("receta", "eliminado", id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting receta:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

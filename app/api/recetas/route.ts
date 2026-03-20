import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

// GET all recetas — factor_rendimiento column excluded (not in preview DB, exists in Supabase prod)
export async function GET() {
  try {
    const recetasData = await sql`
      SELECT id, codigo, nombre, descripcion, imagen, categoria
      FROM recetas ORDER BY nombre ASC
    `

    const insumosData = await sql`
      SELECT receta_id, insumo_id, detalle_corte, cantidad_base_por_persona, unidad_receta
      FROM receta_insumos
    `

    const recetas = recetasData.map((receta) => {
      const insumos = insumosData
        .filter((i) => i.receta_id === receta.id)
        .map((i) => ({
          insumoId: i.insumo_id,
          detalleCorte: i.detalle_corte || "",
          cantidadBasePorPersona: Number(i.cantidad_base_por_persona),
          unidadReceta: i.unidad_receta,
        }))

      return {
        id: receta.id,
        codigo: receta.codigo,
        nombre: receta.nombre,
        descripcion: receta.descripcion || "",
        imagen: receta.imagen || "",
        categoria: receta.categoria,
        factorRendimiento: 1,
        insumos,
      }
    })

    return NextResponse.json(recetas)
  } catch (err) {
    console.error("[API] Error fetching recetas:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST create new receta
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const id = generateId()
    const codigo = body.codigo || id.substring(0, 6).toUpperCase()

    const [recetaData] = await sql`
      INSERT INTO recetas (id, codigo, nombre, descripcion, imagen, categoria)
      VALUES (
        ${id},
        ${codigo},
        ${body.nombre},
        ${body.descripcion || null},
        ${body.imagen || null},
        ${body.categoria || "Plato Principal"}
      )
      RETURNING id, codigo, nombre, descripcion, imagen, categoria
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

    await logActivity("receta", "creado", body.nombre, `Categoría: ${body.categoria || "Plato Principal"}`)
    return NextResponse.json({
      id: recetaData.id,
      codigo: recetaData.codigo,
      nombre: recetaData.nombre,
      descripcion: recetaData.descripcion || "",
      imagen: recetaData.imagen || "",
      categoria: recetaData.categoria,
      factorRendimiento: 1,
      insumos: body.insumos || [],
    }, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating receta:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

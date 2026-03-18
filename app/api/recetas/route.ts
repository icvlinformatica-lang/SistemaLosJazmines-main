import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"

// GET all recetas with their insumos
export async function GET() {
  try {
    const recetasData = await sql`
      SELECT * FROM recetas ORDER BY nombre ASC
    `

    const insumosData = await sql`
      SELECT * FROM receta_insumos
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
        nombre: receta.nombre,
        categoria: receta.categoria,
        porcionesBase: receta.porciones_base || 1,
        instrucciones: receta.instrucciones || "",
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

    const [recetaData] = await sql`
      INSERT INTO recetas (id, nombre, categoria, porciones_base, instrucciones)
      VALUES (
        ${id},
        ${body.nombre},
        ${body.categoria || "Plato Principal"},
        ${body.porcionesBase || 1},
        ${body.instrucciones || null}
      )
      RETURNING *
    `

    // Create receta_insumos if provided
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

    const receta = {
      id: recetaData.id,
      nombre: recetaData.nombre,
      categoria: recetaData.categoria,
      porcionesBase: recetaData.porciones_base || 1,
      instrucciones: recetaData.instrucciones || "",
      insumos: body.insumos || [],
    }

    return NextResponse.json(receta, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating receta:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

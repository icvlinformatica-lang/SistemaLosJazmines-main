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

    // Transform to app format
    const recetas = recetasData.map((receta) => {
      const insumos = insumosData
        .filter((i) => i.receta_id === receta.id)
        .map((i) => ({
          insumoId: i.insumo_id,
          detalleCorte: "",
          cantidadBasePorPersona: Number(i.cantidad),
          unidadReceta: i.unidad,
        }))

      return {
        id: receta.id,
        codigo: receta.nombre.substring(0, 3).toUpperCase() + receta.id.substring(0, 4),
        nombre: receta.nombre,
        descripcion: receta.descripcion || "",
        imagen: "",
        categoria: receta.categoria || "Plato Principal",
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
      INSERT INTO recetas (id, nombre, descripcion, porciones, tiempo_preparacion, categoria)
      VALUES (
        ${id},
        ${body.nombre},
        ${body.descripcion || null},
        ${body.porciones || 1},
        ${body.tiempoPreparacion || null},
        ${body.categoria || "Plato Principal"}
      )
      RETURNING *
    `

    // Create receta_insumos if provided
    if (body.insumos && body.insumos.length > 0) {
      for (const insumo of body.insumos) {
        await sql`
          INSERT INTO receta_insumos (id, receta_id, insumo_id, cantidad, unidad)
          VALUES (
            ${generateId()},
            ${id},
            ${insumo.insumoId},
            ${insumo.cantidadBasePorPersona},
            ${insumo.unidadReceta || "GRS"}
          )
        `
      }
    }

    // Return in app format
    const receta = {
      id: recetaData.id,
      codigo: recetaData.nombre.substring(0, 3).toUpperCase() + recetaData.id.substring(0, 4),
      nombre: recetaData.nombre,
      descripcion: recetaData.descripcion || "",
      imagen: "",
      categoria: recetaData.categoria || "Plato Principal",
      insumos: body.insumos || [],
    }

    return NextResponse.json(receta, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating receta:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

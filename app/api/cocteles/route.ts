import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"

// GET all cocteles with their insumos
export async function GET() {
  try {
    const coctelesData = await sql`
      SELECT * FROM cocteles ORDER BY nombre ASC
    `

    const insumosData = await sql`
      SELECT * FROM coctel_insumos
    `

    // Transform to app format
    const cocteles = coctelesData.map((coctel) => {
      const insumos = insumosData
        .filter((i) => i.coctel_id === coctel.id)
        .map((i) => ({
          insumoBarraId: i.insumo_id,
          cantidadPorCoctel: Number(i.cantidad),
          unidadCoctel: i.unidad,
        }))

      return {
        id: coctel.id,
        codigo: coctel.nombre.substring(0, 3).toUpperCase() + coctel.id.substring(0, 4),
        nombre: coctel.nombre,
        descripcion: coctel.descripcion || "",
        imagen: "",
        categoria: coctel.categoria || "Con Alcohol",
        insumos,
        preparacion: "",
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
      INSERT INTO cocteles (id, nombre, descripcion, categoria)
      VALUES (
        ${id},
        ${body.nombre},
        ${body.descripcion || null},
        ${body.categoria || "Con Alcohol"}
      )
      RETURNING *
    `

    // Create coctel_insumos if provided
    if (body.insumos && body.insumos.length > 0) {
      for (const insumo of body.insumos) {
        await sql`
          INSERT INTO coctel_insumos (id, coctel_id, insumo_id, cantidad, unidad)
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
      codigo: coctelData.nombre.substring(0, 3).toUpperCase() + coctelData.id.substring(0, 4),
      nombre: coctelData.nombre,
      descripcion: coctelData.descripcion || "",
      imagen: "",
      categoria: coctelData.categoria || "Con Alcohol",
      insumos: body.insumos || [],
      preparacion: "",
    }

    return NextResponse.json(coctel, { status: 201 })
  } catch (err) {
    console.error("[API] Error creating coctel:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

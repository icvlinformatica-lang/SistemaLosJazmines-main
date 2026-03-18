import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"

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
      insumoBarraId: i.insumo_id,
      cantidadPorCoctel: Number(i.cantidad),
      unidadCoctel: i.unidad,
    }))

    const coctel = {
      id: coctelData.id,
      codigo: coctelData.nombre.substring(0, 3).toUpperCase() + coctelData.id.substring(0, 4),
      nombre: coctelData.nombre,
      descripcion: coctelData.descripcion || "",
      imagen: "",
      categoria: coctelData.categoria || "Con Alcohol",
      insumos,
      preparacion: "",
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

    const [coctelData] = await sql`
      UPDATE cocteles SET
        nombre = ${body.nombre},
        descripcion = ${body.descripcion || null},
        categoria = ${body.categoria || "Con Alcohol"},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!coctelData) {
      return NextResponse.json({ error: "Coctel not found" }, { status: 404 })
    }

    // Update insumos: delete existing and insert new
    if (body.insumos) {
      await sql`DELETE FROM coctel_insumos WHERE coctel_id = ${id}`

      if (body.insumos.length > 0) {
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

    await sql`DELETE FROM coctel_insumos WHERE coctel_id = ${id}`
    await sql`DELETE FROM cocteles WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting coctel:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

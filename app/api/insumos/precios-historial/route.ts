export const dynamic = "force-dynamic"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

// GET evolución de precios de insumos de las últimas semanas
// ?semanas=4 (default 4, max 12) — devuelve historial agrupado por insumo
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const semanas = Math.min(Number.parseInt(searchParams.get("semanas") || "4", 10) || 4, 12)

    const rows = await sql`
      SELECT h.insumo_id, h.fecha, h.precio_anterior, h.precio, i.descripcion, i.unidad
      FROM insumos_precio_historial h
      JOIN insumos i ON i.id = h.insumo_id
      WHERE h.fecha >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - (${semanas} * 7)
      ORDER BY h.insumo_id, h.fecha ASC
    `

    const porInsumo = new Map<
      string,
      {
        insumoId: string
        descripcion: string
        unidad: string
        registros: { fecha: string; precioAnterior: number | null; precio: number }[]
      }
    >()

    for (const r of rows) {
      const key = String(r.insumo_id)
      if (!porInsumo.has(key)) {
        porInsumo.set(key, {
          insumoId: key,
          descripcion: r.descripcion,
          unidad: r.unidad,
          registros: [],
        })
      }
      porInsumo.get(key)!.registros.push({
        fecha: typeof r.fecha === "string" ? r.fecha : new Date(r.fecha).toISOString().slice(0, 10),
        precioAnterior: r.precio_anterior === null ? null : Number(r.precio_anterior),
        precio: Number(r.precio),
      })
    }

    return NextResponse.json([...porInsumo.values()])
  } catch (err) {
    console.error("[API] Error fetching historial de precios:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

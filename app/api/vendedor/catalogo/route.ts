export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * Catálogo saneado para la pantalla del vendedor (/vendedor/cotizar):
 * nombre/categoría/precio de venta de servicios y recetas, NUNCA
 * costo_para_caja_eventos ni nada de insumos (eso es costo interno).
 * Protegida por el middleware normal (requiere sesión, no es pública).
 */
export async function GET() {
  try {
    const [servicios, recetas, preciosVenta] = await Promise.all([
      sql`
        SELECT id, nombre, categoria, unidad, precio_venta
        FROM servicios
        WHERE activo = true
        ORDER BY orden ASC NULLS LAST, nombre ASC
      `,
      sql`
        SELECT id, nombre, categoria
        FROM recetas
        ORDER BY categoria ASC, nombre ASC
      `,
      sql`SELECT salon, fecha, precio FROM precios_venta`,
    ])

    const preciosVentaMap: Record<string, Record<string, number>> = {}
    for (const row of preciosVenta as unknown as Array<{ salon: string; fecha: string; precio: number }>) {
      preciosVentaMap[row.salon] = preciosVentaMap[row.salon] || {}
      preciosVentaMap[row.salon][row.fecha] = Number(row.precio) || 0
    }

    return NextResponse.json({
      ok: true,
      servicios: (servicios as unknown as Array<Record<string, unknown>>).map((s) => ({
        id: s.id,
        nombre: s.nombre,
        categoria: s.categoria,
        unidad: (s.unidad as string) || "Fijo",
        precioVenta: Number(s.precio_venta) || 0,
      })),
      recetas: (recetas as unknown as Array<Record<string, unknown>>).map((r) => ({
        id: r.id,
        nombre: r.nombre,
        categoria: r.categoria,
      })),
      preciosVenta: preciosVentaMap,
    })
  } catch (err) {
    console.error("[API] Error en vendedor/catalogo:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

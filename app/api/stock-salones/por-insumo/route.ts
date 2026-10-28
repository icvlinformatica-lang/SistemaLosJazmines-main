export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest, salonesConfigurados } from "@/lib/stock-salones-server"
import { esSectorStock, puedeVerStockSector, resumirStockPorInsumo, type SectorStock } from "@/lib/stock-salones"

/**
 * GET ?sector=cocina|barra|limpieza|vajilla — SOLO LECTURA. Para la columna "Contado en
 * salones" de /admin/almacen, /admin/barra, /admin/limpieza y /admin/vajilla: por cada insumo con al menos
 * un conteo, el total contado entre los salones y el desglose (quién y
 * cuándo). Una sola consulta a stock_salones. No toca stock_actual.
 * Administración / Soporte (mismo criterio que el consolidado), y Cocina
 * solo para su vajilla y utensilios (puedeVerStockSector).
 */
export async function GET(req: Request) {
  try {
    const perfil = await perfilDesdeRequest(req)
    const sector = new URL(req.url).searchParams.get("sector") as SectorStock
    if (!puedeVerStockSector(perfil, esSectorStock(sector) ? sector : "cocina")) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 })
    }
    if (!esSectorStock(sector)) {
      return NextResponse.json({ ok: false, error: "Sector inválido" }, { status: 400 })
    }

    const filas = (await sql`
      SELECT insumo_id, salon, cantidad, actualizado_por, actualizado_en
      FROM stock_salones
      WHERE insumo_tipo = ${sector}
    `) as unknown as Array<{
      insumo_id: string
      salon: string
      cantidad: string
      actualizado_por: string | null
      actualizado_en: Date
    }>

    const salones = await salonesConfigurados()
    return NextResponse.json({
      ok: true,
      sector,
      // Orden de la configuración, con el nombre para mostrar.
      salones: [...salones].map(([id, nombre]) => ({ id, nombre })),
      insumos: resumirStockPorInsumo(
        filas.map((f) => ({
          insumoId: f.insumo_id,
          salon: f.salon,
          cantidad: Number(f.cantidad),
          actualizadoPor: f.actualizado_por,
          actualizadoEn: new Date(f.actualizado_en).toISOString(),
        })),
      ),
    })
  } catch (err) {
    console.error("[API] Error en stock-salones/por-insumo:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

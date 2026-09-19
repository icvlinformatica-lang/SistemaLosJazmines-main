export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest, salonesConfigurados } from "@/lib/stock-salones-server"
import { puedeVerConsolidado, resumirStockPorInsumo, type SectorStock } from "@/lib/stock-salones"

/**
 * GET ?sector=cocina|barra — SOLO LECTURA. Para la columna "Contado en
 * salones" de /admin/almacen y /admin/barra: por cada insumo con al menos
 * un conteo, el total contado entre los salones y el desglose (quién y
 * cuándo). Una sola consulta a stock_salones. No toca stock_actual.
 * Solo Administración / Soporte (mismo criterio que el consolidado).
 */
export async function GET(req: Request) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!puedeVerConsolidado(perfil)) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 })
    }
    const sector = new URL(req.url).searchParams.get("sector") as SectorStock
    if (sector !== "cocina" && sector !== "barra") {
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

export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest, salonesConfigurados } from "@/lib/stock-salones-server"
import { puedeVerConsolidado, type SectorStock } from "@/lib/stock-salones"

/**
 * GET ?sector=cocina|barra — vista consolidada del conteo físico por salón.
 * Se arma EN VIVO desde stock_salones (sin copias intermedias). Es
 * independiente del stock_actual global de /admin/almacen: son dos números
 * distintos a propósito. Solo Administración / Soporte.
 *
 * Devuelve el catálogo completo del sector (así se ven también los insumos
 * que todavía nadie contó) + las celdas cargadas por salón.
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

    const catalogo = (sector === "cocina"
      ? await sql`SELECT id, descripcion, unidad FROM insumos ORDER BY descripcion ASC`
      : await sql`SELECT id, descripcion, unidad FROM insumos_barra ORDER BY descripcion ASC`) as unknown as Array<{
      id: string
      descripcion: string
      unidad: string | null
    }>

    const celdas = (await sql`
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
      salones: Object.fromEntries(salones),
      insumos: catalogo.map((c) => ({ id: c.id, descripcion: c.descripcion, unidad: c.unidad })),
      celdas: celdas.map((c) => ({
        insumoId: c.insumo_id,
        salon: c.salon,
        cantidad: Number(c.cantidad),
        actualizadoPor: c.actualizado_por,
        actualizadoEn: new Date(c.actualizado_en).toISOString(),
      })),
    })
  } catch (err) {
    console.error("[API] Error en stock-salones/consolidado:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

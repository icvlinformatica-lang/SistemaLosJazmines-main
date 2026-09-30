export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { eventoPendienteEnBase, perfilDesdeRequest, salonesConfigurados } from "@/lib/stock-salones-server"
import { sectoresPermitidos, type SectorStock } from "@/lib/stock-salones"

/**
 * GET ?salon=Casona&sector=barra
 * Para la pantalla de carga de un salón:
 * - eventoPendiente: el evento que habilita el aviso "ya terminó, podés
 *   cargar el stock" (ver eventoPendienteDeCarga), o null.
 * - saldos: lo último contado de cada insumo de ese sector en ese salón
 *   (stock_salones), para mostrarlo como "antes había X".
 * Solo lectura. Nunca toca stock_actual.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const salon = searchParams.get("salon") || ""
    const sector = searchParams.get("sector") as SectorStock

    const perfil = await perfilDesdeRequest(req)
    if (!sectoresPermitidos(perfil).includes(sector)) {
      return NextResponse.json({ ok: false, error: "Este perfil no puede cargar ese sector" }, { status: 403 })
    }
    const salones = await salonesConfigurados()
    if (!salones.has(salon)) {
      return NextResponse.json({ ok: false, error: "Salón inválido" }, { status: 400 })
    }

    const pendiente = await eventoPendienteEnBase(salon, sector)

    const saldos = (await sql`
      SELECT insumo_id, cantidad, actualizado_por, actualizado_en
      FROM stock_salones
      WHERE salon = ${salon} AND insumo_tipo = ${sector}
    `) as unknown as Array<{ insumo_id: string; cantidad: string; actualizado_por: string | null; actualizado_en: Date }>

    return NextResponse.json({
      ok: true,
      salon,
      salonNombre: salones.get(salon),
      sector,
      eventoPendiente: pendiente
        ? { id: pendiente.evento.id, nombre: pendiente.evento.nombre, fin: pendiente.fin.toISOString() }
        : null,
      saldos: Object.fromEntries(
        saldos.map((s) => [
          s.insumo_id,
          { cantidad: Number(s.cantidad), actualizadoPor: s.actualizado_por, actualizadoEn: new Date(s.actualizado_en).toISOString() },
        ]),
      ),
    })
  } catch (err) {
    console.error("[API] Error en stock-salones/estado:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

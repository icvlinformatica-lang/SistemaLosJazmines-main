export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest, salonesConfigurados } from "@/lib/stock-salones-server"
import {
  eventoPendienteDeCarga,
  sectoresPermitidos,
  VENTANA_AVISO_DIAS,
  type EventoParaStock,
  type SectorStock,
} from "@/lib/stock-salones"

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

    // Traer solo eventos recientes del salón: la ventana del aviso más un
    // margen (el fin puede caer al día siguiente de la fecha).
    const desde = new Date(Date.now() - (VENTANA_AVISO_DIAS + 2) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const eventos = (await sql`
      SELECT id, nombre, nombre_pareja, fecha, horario, horario_fin, salon, estado
      FROM eventos
      WHERE deleted_at IS NULL AND salon = ${salon} AND fecha >= ${desde}
    `) as unknown as Array<{
      id: string
      nombre: string
      nombre_pareja: string | null
      fecha: string | null
      horario: string | null
      horario_fin: string | null
      salon: string | null
      estado: string | null
    }>

    const sesiones = (await sql`
      SELECT evento_id, salon, sector, cerrada_en
      FROM stock_sesiones
      WHERE salon = ${salon} AND sector = ${sector} AND cerrada_en IS NOT NULL
        AND cerrada_en >= now() - interval '15 days'
    `) as unknown as Array<{ evento_id: string | null; salon: string; sector: SectorStock; cerrada_en: Date }>

    const eventosStock: EventoParaStock[] = eventos.map((e) => ({
      id: e.id,
      nombre: e.nombre_pareja || e.nombre,
      fecha: e.fecha,
      horario: e.horario,
      horarioFin: e.horario_fin,
      salon: e.salon,
      estado: e.estado,
    }))
    const pendiente = eventoPendienteDeCarga(
      eventosStock,
      sesiones.map((s) => ({ eventoId: s.evento_id, salon: s.salon, sector: s.sector, cerradaEn: new Date(s.cerrada_en) })),
      salon,
      sector,
    )

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

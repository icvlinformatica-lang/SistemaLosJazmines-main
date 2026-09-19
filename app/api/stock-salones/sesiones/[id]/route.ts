export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest, salonesConfigurados } from "@/lib/stock-salones-server"
import { puedeVerConsolidado } from "@/lib/stock-salones"

/**
 * GET — detalle de una sesión de carga de stock (se abre desde
 * Configuración → Actividad; el id del renglón de actividad es el mismo que
 * el de la sesión). Solo Administración / Soporte.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!puedeVerConsolidado(perfil)) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 })
    }
    const { id } = await params

    const sesiones = (await sql`
      SELECT s.id, s.salon, s.sector, s.cargado_por, s.evento_id, s.iniciada_en, s.cerrada_en, s.cantidad_items,
             e.nombre AS evento_nombre, e.nombre_pareja AS evento_nombre_pareja, e.fecha AS evento_fecha
      FROM stock_sesiones s
      LEFT JOIN eventos e ON e.id = s.evento_id
      WHERE s.id = ${id}
      LIMIT 1
    `) as unknown as Array<{
      id: string
      salon: string
      sector: string
      cargado_por: string
      evento_id: string | null
      iniciada_en: Date
      cerrada_en: Date | null
      cantidad_items: number
      evento_nombre: string | null
      evento_nombre_pareja: string | null
      evento_fecha: string | null
    }>
    if (!sesiones.length) {
      return NextResponse.json({ ok: false, error: "No se encontró la sesión" }, { status: 404 })
    }
    const s = sesiones[0]

    const items = (await sql`
      SELECT insumo_id, descripcion, unidad, cantidad_anterior, cantidad_nueva
      FROM stock_sesion_items
      WHERE sesion_id = ${id}
      ORDER BY descripcion ASC
    `) as unknown as Array<{
      insumo_id: string
      descripcion: string
      unidad: string | null
      cantidad_anterior: string | null
      cantidad_nueva: string
    }>

    const salones = await salonesConfigurados()
    return NextResponse.json({
      ok: true,
      sesion: {
        id: s.id,
        salon: s.salon,
        salonNombre: salones.get(s.salon) || s.salon,
        sector: s.sector,
        cargadoPor: s.cargado_por,
        iniciadaEn: new Date(s.iniciada_en).toISOString(),
        cerradaEn: s.cerrada_en ? new Date(s.cerrada_en).toISOString() : null,
        cantidadItems: s.cantidad_items,
        evento: s.evento_id
          ? { id: s.evento_id, nombre: s.evento_nombre_pareja || s.evento_nombre, fecha: s.evento_fecha }
          : null,
      },
      items: items.map((i) => ({
        insumoId: i.insumo_id,
        descripcion: i.descripcion,
        unidad: i.unidad,
        cantidadAnterior: i.cantidad_anterior === null ? null : Number(i.cantidad_anterior),
        cantidadNueva: Number(i.cantidad_nueva),
      })),
    })
  } catch (err) {
    console.error("[API] Error en stock-salones/sesiones/[id]:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

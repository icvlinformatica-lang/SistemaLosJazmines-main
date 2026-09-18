export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { usuarioDesdeCookie } from "@/lib/usuario-cookie"
import { sanear, type PaqueteRaw } from "@/app/api/vendedor/paquetes/route"

/**
 * Papelera personal del vendedor: cotizaciones y paquetes que borró desde
 * /vendedor/paquetes (ver DELETE en .../cotizaciones/[id] y .../paquetes/[id],
 * que mueven la fila a cotizaciones_eliminadas / paquetes_salones_eliminados
 * en vez de borrarla en serio). Filtrado por eliminado_por = quien entró con
 * esta sesión (cookie lj_usuario) — cada vendedor ve solo lo que borró él
 * mismo. Administración tiene su propia vista sin ese filtro, ver
 * /api/eventos/papelera-vendedores.
 */

interface CotizacionEliminadaFila {
  id: string
  cliente_nombre: string
  fecha_evento: string | null
  salon: string | null
  tipo_evento: string | null
  nombre_festejados: string | null
  precio_venta_sugerido: number
  estado: string
  eliminado_at: string
}

interface PaqueteEliminadoFila {
  id: string
  data: PaqueteRaw | string
  eliminado_at: string
}

const parseData = (raw: PaqueteRaw | string): PaqueteRaw => (typeof raw === "string" ? JSON.parse(raw) : raw)

export async function GET(req: Request) {
  try {
    const vendedor = usuarioDesdeCookie(req)

    const [cotizaciones, paquetes] = await Promise.all([
      sql`
        SELECT id, cliente_nombre, fecha_evento, salon, tipo_evento, nombre_festejados,
               precio_venta_sugerido, estado, eliminado_at
        FROM cotizaciones_eliminadas
        WHERE eliminado_por = ${vendedor}
        ORDER BY eliminado_at DESC
      ` as unknown as CotizacionEliminadaFila[],
      sql`
        SELECT id, data, eliminado_at FROM paquetes_salones_eliminados
        WHERE eliminado_por = ${vendedor}
        ORDER BY eliminado_at DESC
      ` as unknown as PaqueteEliminadoFila[],
    ])

    return NextResponse.json({
      ok: true,
      cotizaciones: cotizaciones.map((c) => ({
        id: c.id,
        clienteNombre: c.cliente_nombre,
        fechaEvento: c.fecha_evento,
        salon: c.salon,
        tipoEvento: c.tipo_evento,
        nombreFestejados: c.nombre_festejados,
        precioVentaSugerido: Number(c.precio_venta_sugerido) || 0,
        estado: c.estado,
        eliminadoAt: c.eliminado_at,
      })),
      paquetes: paquetes.map((p) => ({
        ...sanear(p.id, parseData(p.data)),
        eliminadoAt: p.eliminado_at,
      })),
    })
  } catch (err) {
    console.error("[API] Error en vendedor/papelera GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

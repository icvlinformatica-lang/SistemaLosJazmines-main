export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * Vista de Administración sobre la papelera de los vendedores: todas las
 * cotizaciones y paquetes que cualquier vendedor borró desde
 * /vendedor/paquetes, sin el filtro por "quién borró" que usa la vista
 * personal (/api/vendedor/papelera) — para poder auditar o restaurar algo
 * aunque el vendedor que lo borró no esté. A diferencia de esa vista
 * personal, acá el paquete viaja completo (con precioInterno/costoTotal/
 * ganancia), porque Administración ya ve esos datos en /admin/servicios.
 */

interface CotizacionEliminadaFila {
  id: string
  vendedor: string
  cliente_nombre: string
  fecha_evento: string | null
  salon: string | null
  tipo_evento: string | null
  nombre_festejados: string | null
  precio_venta_sugerido: number
  estado: string
  eliminado_at: string
  eliminado_por: string | null
}

interface PaqueteEliminadoFila {
  id: string
  data: Record<string, unknown> | string
  eliminado_at: string
  eliminado_por: string | null
}

const parseData = (raw: Record<string, unknown> | string) => (typeof raw === "string" ? JSON.parse(raw) : raw)

export async function GET() {
  try {
    const [cotizaciones, paquetes] = await Promise.all([
      sql`
        SELECT id, vendedor, cliente_nombre, fecha_evento, salon, tipo_evento, nombre_festejados,
               precio_venta_sugerido, estado, eliminado_at, eliminado_por
        FROM cotizaciones_eliminadas
        ORDER BY eliminado_at DESC
      ` as unknown as CotizacionEliminadaFila[],
      sql`
        SELECT id, data, eliminado_at, eliminado_por FROM paquetes_salones_eliminados
        ORDER BY eliminado_at DESC
      ` as unknown as PaqueteEliminadoFila[],
    ])

    return NextResponse.json({
      ok: true,
      cotizaciones: cotizaciones.map((c) => ({
        id: c.id,
        vendedor: c.vendedor,
        clienteNombre: c.cliente_nombre,
        fechaEvento: c.fecha_evento,
        salon: c.salon,
        tipoEvento: c.tipo_evento,
        nombreFestejados: c.nombre_festejados,
        precioVentaSugerido: Number(c.precio_venta_sugerido) || 0,
        estado: c.estado,
        eliminadoAt: c.eliminado_at,
        eliminadoPor: c.eliminado_por,
      })),
      paquetes: paquetes.map((p) => {
        const data = parseData(p.data) as Record<string, unknown>
        return {
          id: p.id,
          salon: data.salon,
          nombre: data.nombre,
          descripcion: data.descripcion || "",
          precioOficial: Number(data.precioOficial) || 0,
          servicios: Array.isArray(data.serviciosIncluidos) ? data.serviciosIncluidos : [],
          eliminadoAt: p.eliminado_at,
          eliminadoPor: p.eliminado_por,
        }
      }),
    })
  } catch (err) {
    console.error("[API] Error en eventos/papelera-vendedores GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

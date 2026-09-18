export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * Bandeja de aprobación (Etapa 5): lista las cotizaciones en
 * "lista_para_revisar" para Administración, CON el desglose completo de
 * costos_internos — a diferencia de /api/vendedor/cotizaciones, que nunca
 * lo devuelve. Como el resto del sistema, no hay un chequeo de rol propio
 * acá (el mismo patrón de todo /api/db/* y /api/eventos): la restricción
 * real es que solo administracion/soporte tienen esta pantalla en su menú.
 */

function parseJson(raw: unknown): any {
  if (raw === null || raw === undefined) return null
  return typeof raw === "string" ? JSON.parse(raw) : raw
}

interface CotizacionFila {
  id: string
  vendedor: string
  cliente_nombre: string
  cliente_telefono: string | null
  fecha_evento: string | null
  horario: string | null
  horario_fin: string | null
  salon: string | null
  tipo_evento: string | null
  nombre_festejados: string | null
  paquete_id: string | null
  invitados: unknown
  servicios_elegidos: unknown
  precio_venta_sugerido: number
  costos_internos: unknown
  estado: string
  created_at: string
  updated_at: string
}

export async function GET() {
  try {
    const filas = (await sql`
      SELECT id, vendedor, cliente_nombre, cliente_telefono, fecha_evento, horario, horario_fin,
             salon, tipo_evento, nombre_festejados, paquete_id, invitados, servicios_elegidos,
             precio_venta_sugerido, costos_internos, estado, created_at, updated_at
      FROM cotizaciones
      WHERE estado = 'lista_para_revisar'
      ORDER BY updated_at ASC
    `) as unknown as CotizacionFila[]

    const cotizaciones = filas.map((f) => {
      const invitados = parseJson(f.invitados) || {}
      const serviciosElegidos = parseJson(f.servicios_elegidos) || {}
      const costosInternos = parseJson(f.costos_internos) || {}
      const totalPersonas =
        (Number(invitados.adultos) || 0) +
        (Number(invitados.adolescentes) || 0) +
        (Number(invitados.ninos) || 0) +
        (Number(invitados.personasDietasEspeciales) || 0)

      return {
        id: f.id,
        vendedor: f.vendedor,
        clienteNombre: f.cliente_nombre,
        clienteTelefono: f.cliente_telefono,
        fechaEvento: f.fecha_evento,
        horario: f.horario,
        horarioFin: f.horario_fin,
        salon: f.salon,
        tipoEvento: f.tipo_evento,
        nombreFestejados: f.nombre_festejados,
        paqueteId: f.paquete_id,
        invitados: {
          adultos: Number(invitados.adultos) || 0,
          adolescentes: Number(invitados.adolescentes) || 0,
          ninos: Number(invitados.ninos) || 0,
          personasDietasEspeciales: Number(invitados.personasDietasEspeciales) || 0,
        },
        totalPersonas,
        recetasElegidas: {
          adultos: Array.isArray(serviciosElegidos.recetas?.adultos) ? serviciosElegidos.recetas.adultos : [],
          adolescentes: Array.isArray(serviciosElegidos.recetas?.adolescentes) ? serviciosElegidos.recetas.adolescentes : [],
          ninos: Array.isArray(serviciosElegidos.recetas?.ninos) ? serviciosElegidos.recetas.ninos : [],
          dietasEspeciales: Array.isArray(serviciosElegidos.recetas?.dietasEspeciales) ? serviciosElegidos.recetas.dietasEspeciales : [],
        },
        servicios: Array.isArray(serviciosElegidos.servicios) ? serviciosElegidos.servicios : [],
        personalSeleccionado: Array.isArray(serviciosElegidos.personal) ? serviciosElegidos.personal : [],
        precioVentaSugerido: Number(f.precio_venta_sugerido) || 0,
        // Desglose interno: SOLO esta pantalla lo recibe.
        precioBaseSalon: Number(costosInternos.precioBaseSalon) || 0,
        costosServicios: Array.isArray(costosInternos.servicios) ? costosInternos.servicios : [],
        totalCostoServicios: Number(costosInternos.totalCostoServicios) || 0,
        estado: f.estado,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      }
    })

    return NextResponse.json({ ok: true, cotizaciones })
  } catch (err) {
    console.error("[API] Error en administracion/cotizaciones GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

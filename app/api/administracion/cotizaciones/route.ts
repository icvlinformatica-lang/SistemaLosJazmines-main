export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizarDietasDetalle } from "@/lib/dietas-evento"
import { normalizarOrigen } from "@/lib/origen-cliente"
import { soloAdministracion } from "@/lib/solo-administracion"
import { faltantesCotizacion } from "@/lib/faltantes-evento"

/**
 * Bandeja de aprobación (Etapa 5): lista las cotizaciones en
 * "lista_para_revisar" para Administración, CON el desglose completo de
 * costos_internos — a diferencia de /api/vendedor/cotizaciones, que nunca
 * lo devuelve. Solo Administración y Soporte (lib/solo-administracion.ts:
 * se chequea el PERFIL de la sesión, no solo que haya sesión).
 *
 * Modelo nuevo (Paso 2, servicios_elegidos.version 2): trae además el
 * desglose por rubro (costo, ganancia y precio), los avisos, el DNI y las
 * líneas de personal que salieron de las reglas del salón.
 *
 * Con ?historial=1 trae en cambio las ya resueltas (convertidas en evento y
 * rechazadas), las más recientes primero, para la pestaña "Historial". Mismo
 * chequeo de perfil: solo Administración y Soporte.
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
  desglose_venta: unknown
  avisos: unknown
  cliente_dni: string | null
  origen_cliente?: string | null
  comentario_admin: string | null
  evento_id: string | null
  estado: string
  created_at: string
  updated_at: string
}

export async function GET(req: Request) {
  const prohibido = await soloAdministracion(req)
  if (prohibido) return prohibido
  try {
    const historial = new URL(req.url).searchParams.get("historial") === "1"
    const filas = (historial
      ? await sql`
      SELECT id, vendedor, cliente_nombre, cliente_telefono, fecha_evento, horario, horario_fin,
             salon, tipo_evento, nombre_festejados, paquete_id, invitados, servicios_elegidos,
             precio_venta_sugerido, costos_internos, desglose_venta, avisos, cliente_dni,
             comentario_admin, evento_id, estado, created_at, updated_at,
             (to_jsonb(cotizaciones) ->> 'origen_cliente') AS origen_cliente
      FROM cotizaciones
      WHERE estado IN ('convertida', 'rechazada')
      ORDER BY updated_at DESC
      LIMIT 200
    `
      : await sql`
      SELECT id, vendedor, cliente_nombre, cliente_telefono, fecha_evento, horario, horario_fin,
             salon, tipo_evento, nombre_festejados, paquete_id, invitados, servicios_elegidos,
             precio_venta_sugerido, costos_internos, desglose_venta, avisos, cliente_dni,
             comentario_admin, evento_id, estado, created_at, updated_at,
             (to_jsonb(cotizaciones) ->> 'origen_cliente') AS origen_cliente
      FROM cotizaciones
      WHERE estado = 'lista_para_revisar'
      ORDER BY updated_at ASC
    `) as unknown as CotizacionFila[]

    const cotizaciones = filas.map((f) => {
      const invitados = parseJson(f.invitados) || {}
      const serviciosElegidos = parseJson(f.servicios_elegidos) || {}
      const costosInternos = parseJson(f.costos_internos) || {}
      const version = Number(serviciosElegidos.version) || 1
      const desglose = version === 2 ? parseJson(f.desglose_venta) : null
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
        clienteDni: f.cliente_dni,
        version,
        // Solo modelo nuevo: rubros con costo/ganancia/precio, recetas, barra,
        // servicios, personal y avisos (ver /api/vendedor/cotizaciones).
        desglose,
        personalLineas: Array.isArray(serviciosElegidos.personalLineas) ? serviciosElegidos.personalLineas : [],
        avisos: Array.isArray(parseJson(f.avisos)) ? parseJson(f.avisos) : [],
        // Qué le va a faltar al evento que se cree al aprobar (aviso "Falta: …").
        faltantes: faltantesCotizacion({
          serviciosElegidos,
          clienteNombre: f.cliente_nombre,
          clienteDni: f.cliente_dni,
          clienteTelefono: f.cliente_telefono,
        }),
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
          // Dietas por tipo que cargó el vendedor (parte de los adultos), scripts/022.
          dietasDetalle: normalizarDietasDetalle(invitados.dietasDetalle),
        },
        // "¿Cómo nos conoció?" (scripts/022). null en las de antes.
        origenCliente: normalizarOrigen(f.origen_cliente),
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
        // Costo de la barra personalizada (mismos tragos que su precio). 0 en
        // cotizaciones sin barra personalizada o anteriores a esto.
        costoBarraPersonalizada: Number(costosInternos.costoBarraPersonalizada) || 0,
        estado: f.estado,
        comentarioAdmin: f.comentario_admin,
        eventoId: f.evento_id,
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

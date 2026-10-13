// Herramientas que el chat de ayuda (solo perfil Soporte) le ofrece a la IA:
// buscar eventos con su plata, ver quién viene a pagar, el resumen del día y
// poner botones a pantallas. TODAS son de solo lectura: ninguna escribe en
// la base. Los botones se arman acá, con direcciones fijas: la IA solo elige
// el evento o la pantalla, nunca escribe una dirección.
//
// Corre SOLO en el servidor (lo usa app/api/chat/route.ts).
import { tool } from "ai"
import { z } from "zod"
import { sql } from "@/lib/db"
import { buildResumenDiario, buildVienenAPagar, historialIPCServidor } from "@/lib/resumen-diario"
import { cambiarDiaResumen, fechaResumenValida } from "@/lib/resumen-fecha"
import type { HistorialIPCEntry } from "@/lib/store"
import {
  PANTALLAS_CHAT,
  SALONES_CHAT,
  accesosEvento,
  filtrarEventosChat,
  resumenEventoChat,
  sumarAcciones,
  type AccionChat,
  type FilaEventoChat,
  type PantallaChat,
} from "@/lib/chat-ia-datos"

/** Máximo de eventos que se le pasan a la IA por búsqueda. */
export const MAX_EVENTOS_POR_BUSQUEDA = 10

const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Fecha en formato AAAA-MM-DD, por ejemplo 2026-10-06")

export function crearHerramientasChat({ hoy, acciones }: { hoy: string; acciones: AccionChat[] }) {
  // Se lee una sola vez por pregunta, y solo si la IA lo necesita.
  let eventos: Promise<FilaEventoChat[]> | null = null
  let historial: Promise<HistorialIPCEntry[]> | null = null
  // Sin DNI, teléfonos ni contrato: esto termina en el modelo de IA.
  const cargarEventos = () =>
    (eventos ??= sql`
      SELECT id, nombre, nombre_pareja, fecha, horario, salon, tipo_evento, estado,
             adultos, adolescentes, ninos, precio_venta, plan_de_cuotas, pagos
      FROM eventos
      WHERE deleted_at IS NULL
    ` as unknown as Promise<FilaEventoChat[]>)
  const cargarHistorial = () => (historial ??= historialIPCServidor())

  return {
    buscarEventos: tool({
      description:
        "Busca eventos (activos y finalizados) por nombre de los agasajados, fecha exacta, rango de fechas o salón. " +
        "Devuelve fecha, salón, estado, invitados y la plata: total, seña, cobrado, saldo pendiente y cuotas por cobrar (con vencimiento y si está atrasada). " +
        "Usala para cualquier pregunta sobre un evento o sus montos.",
      inputSchema: z.object({
        texto: z.string().max(80).optional().describe("Parte del nombre del evento o de los agasajados"),
        fecha: fechaISO.optional(),
        desde: fechaISO.optional().describe("Desde esta fecha (incluida)"),
        hasta: fechaISO.optional().describe("Hasta esta fecha (incluida)"),
        salon: z.enum(SALONES_CHAT).optional().describe('Clave del salón. "Salon" es el que se muestra como "Salón"'),
      }),
      execute: async (filtro) => {
        const [filas, hist] = await Promise.all([cargarEventos(), cargarHistorial()])
        const encontrados = filtrarEventosChat(filas, filtro)
        return {
          hoy,
          cantidad: encontrados.length,
          mostrados: Math.min(encontrados.length, MAX_EVENTOS_POR_BUSQUEDA),
          eventos: encontrados.slice(0, MAX_EVENTOS_POR_BUSQUEDA).map((f) => resumenEventoChat(f, hist, hoy)),
        }
      },
    }),

    vienenAPagar: tool({
      description:
        "Cuotas que vencen esta semana o la próxima (de lunes a domingo), por evento, más las atrasadas. Es lo mismo que la tarjeta 'Vienen a pagar' de Inicio.",
      inputSchema: z.object({ semana: z.enum(["esta", "proxima"]) }),
      execute: async ({ semana }) => {
        const referencia = semana === "proxima" ? cambiarDiaResumen(hoy, 7) : hoy
        const r = await buildVienenAPagar(referencia)
        return {
          desde: r.inicioSemana,
          hasta: r.finSemana,
          eventos: r.vienenAPagar.slice(0, 30).map((v) => ({
            eventoId: v.eventoId,
            evento: v.evento,
            salon: v.salon,
            fechaEvento: v.fechaEvento,
            cuotaDeLaSemana: v.cuotaSemana,
            cuotasAtrasadas: v.cuotasAtrasadas,
            montoAtrasado: Math.round(v.montoAtrasado * 100) / 100,
          })),
          totalEventos: r.vienenAPagar.length,
        }
      },
    }),

    resumenDelDia: tool({
      description:
        "Resumen de caja de un día: lo que entró y salió de Caja Jazmines y Caja Eventos, ingresos por salón, saldo actual de cada salón por caja y las cuotas cobradas ese día. Es el 'Resumen diario' de Inicio.",
      inputSchema: z.object({ fecha: fechaISO.optional().describe("Día a consultar; si falta, hoy") }),
      execute: async ({ fecha }) => {
        const dia = fecha && fechaResumenValida(fecha) ? fecha : hoy
        const r = await buildResumenDiario(dia)
        return {
          fecha: r.fecha,
          ingresoCajaJazmines: r.ingresoCajaJazmines,
          ingresoCajaEventos: r.ingresoCajaEventos,
          egresoCajaJazmines: r.egresoCajaJazmines,
          egresoCajaEventos: r.egresoCajaEventos,
          ingresosPorSalon: r.ingresosPorSalon,
          saldoActualPorSalon: r.saldoPorSalon,
          cuotasCobradas: r.cuotasDelDia.map((c) => ({ evento: c.evento, salon: c.salon, monto: c.monto })),
          totalCuotas: r.totalCuotas,
        }
      },
    }),

    mostrarAccesosEvento: tool({
      description:
        "Pone en el chat tres botones para un evento: verlo en la Lista de eventos (o en el Archivo si está finalizado), sus cuotas por cobrar y sus costos. " +
        "Usala cuando el usuario quiera ver, abrir o ir a un evento. Necesita el id que devolvió buscarEventos.",
      inputSchema: z.object({ eventoId: z.string().min(1).max(100) }),
      execute: async ({ eventoId }) => {
        const fila = (await cargarEventos()).find((f) => String(f.id) === eventoId)
        if (!fila) return { ok: false, motivo: "No existe un evento con ese id. Buscalo primero con buscarEventos." }
        const nombre = String(fila.nombre_pareja || fila.nombre || "Evento")
        sumarAcciones(acciones, accesosEvento(eventoId, nombre, String(fila.estado ?? "")))
        return { ok: true, botones: "Lista, cuotas por cobrar y costos" }
      },
    }),

    mostrarPantalla: tool({
      description: "Pone en el chat un botón que lleva a una pantalla del sistema.",
      inputSchema: z.object({
        pantalla: z.enum(Object.keys(PANTALLAS_CHAT) as [PantallaChat, ...PantallaChat[]]),
      }),
      execute: async ({ pantalla }) => {
        sumarAcciones(acciones, [PANTALLAS_CHAT[pantalla]])
        return { ok: true }
      },
    }),
  }
}

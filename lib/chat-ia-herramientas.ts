// Herramientas que el chat de ayuda (Administración y Soporte) le ofrece a la IA:
// buscar eventos con su plata, ver quién viene a pagar, el resumen del día,
// poner botones a pantallas y preparar un gasto. TODAS son de solo lectura:
// ninguna escribe en la base (proponerGasto solo arma la propuesta; la carga
// la hace la persona con el botón, por /api/chat/gasto). Los botones se
// arman acá, con direcciones fijas: la IA solo elige el evento o la
// pantalla, nunca escribe una dirección.
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
  tarjetaEventoChat,
  type AccionChat,
  type FilaEventoChat,
  type PantallaChat,
} from "@/lib/chat-ia-datos"
import { MAX_TARJETAS_CHAT, sumarTarjetas, type TarjetaEventoChat } from "@/lib/chat-ia-tarjetas"
import { SALONES_GASTO_CHAT, armarPropuestaGasto, type PropuestaGastoChat } from "@/lib/chat-ia-gasto"

/** Máximo de eventos que se le pasan a la IA por búsqueda. */
export const MAX_EVENTOS_POR_BUSQUEDA = 10

const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Fecha en formato AAAA-MM-DD, por ejemplo 2026-10-06")

export function crearHerramientasChat({
  hoy,
  acciones,
  tarjetas = [],
  gasto = { propuesta: null },
}: {
  hoy: string
  acciones: AccionChat[]
  tarjetas?: TarjetaEventoChat[]
  /** Dónde queda la propuesta de gasto de esta respuesta (una sola). */
  gasto?: { propuesta: PropuestaGastoChat | null }
}) {
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

    mostrarResumenEventos: tool({
      description:
        "Pone en el chat una tarjeta por evento con su plata ordenada: total, seña, cobrado (con barra), saldo, cuotas vencidas y la próxima cuota. " +
        `Usala SIEMPRE que respondas montos de uno o más eventos (hasta ${MAX_TARJETAS_CHAT}). Necesita los ids que devolvió buscarEventos.`,
      inputSchema: z.object({ eventoIds: z.array(z.string().min(1).max(100)).min(1).max(MAX_TARJETAS_CHAT) }),
      execute: async ({ eventoIds }) => {
        const [filas, hist] = await Promise.all([cargarEventos(), cargarHistorial()])
        const encontrados = eventoIds
          .map((id) => filas.find((f) => String(f.id) === id))
          .filter((f): f is FilaEventoChat => !!f)
        sumarTarjetas(tarjetas, encontrados.map((f) => tarjetaEventoChat(resumenEventoChat(f, hist, hoy))))
        if (encontrados.length === 0) return { ok: false, motivo: "Ningún id coincide. Buscalos primero con buscarEventos." }
        return { ok: true, tarjetas: encontrados.length }
      },
    }),

    proponerGasto: tool({
      description:
        "Prepara un gasto variable para Caja Jazmines (agendado, sin pagar), como 'Cargar gastos' de Inicio. NO lo carga: " +
        "pone en el chat una tarjeta con los datos y los botones 'Sí, cargar' y 'Cancelar'; solo la persona, con el botón, lo carga. " +
        "Usala solo cuando pidan cargar o agendar un gasto, y solo con concepto, monto y salón claros (si falta alguno, preguntalo antes). " +
        "El concepto incluye a nombre de quién es, por ejemplo 'Pepo - arreglo de luces'. Un gasto por respuesta. " +
        "Gastos repartidos entre varios salones, retiros o ya pagados no: para eso está 'Cargar gastos' en Inicio.",
      inputSchema: z.object({
        concepto: z.string().min(2).max(120).describe("Qué es el gasto y a nombre de quién"),
        monto: z.number().positive().describe("Monto en pesos, sin puntos de miles"),
        salon: z.enum(SALONES_GASTO_CHAT).describe('Clave del salón. "Salon" es el que se muestra como "Salón"'),
        vencimiento: fechaISO.optional().describe("Vencimiento; si no lo dicen, hoy"),
      }),
      execute: async (entrada) => {
        if (gasto.propuesta) return { ok: false, motivo: "Ya hay un gasto preparado en esta respuesta: uno por vez." }
        const r = armarPropuestaGasto(entrada, { id: crypto.randomUUID(), hoy })
        if (!r.ok) return r
        gasto.propuesta = r.propuesta
        return {
          ok: true,
          aviso: "Todavía NO está cargado: la persona tiene que tocar 'Sí, cargar' en la tarjeta. Preguntale si está seguro.",
          gasto: { concepto: r.propuesta.concepto, monto: r.propuesta.monto, salon: r.propuesta.salon, vencimiento: r.propuesta.vencimiento },
        }
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

// Marca chica del estado de pagos de un evento en Eventos → Lista. Solo
// lectura: reusa el calendario de cuotas de siempre (generarCalendarioCuotas,
// el mismo de Cobrar cuota y la planilla) y no guarda nada. Los eventos del
// store vienen proyectados con IPC; acá solo importan fechas y qué está
// pagado, no los montos.
import { generarCalendarioCuotas, type EventoGuardado } from "./store"
import { numerosPagados } from "./ipc-cuotas"

export type EstadoPagosEvento = { tipo: "al_dia" } | { tipo: "atrasado"; cuotas: number }

/**
 * null = no mostrar nada (sin plan de cuotas, o evento finalizado/cancelado,
 * que tampoco cuentan en "Vienen a pagar"). Una cuota está atrasada si su
 * vencimiento es anterior a hoy y no está completa (una parcial también
 * cuenta: todavía se debe). La que vence hoy todavía no está atrasada, igual
 * que el recargo por día de atraso de Cobrar cuota.
 */
export function estadoPagosEvento(evento: EventoGuardado, hoy: string): EstadoPagosEvento | null {
  if (evento.estado === "completado" || evento.estado === "cancelado") return null
  const calendario = generarCalendarioCuotas(evento)
  if (calendario.length === 0) return null
  const pagadas = new Set(numerosPagados(evento))
  const atrasadas = calendario.filter(
    (c) => !c.pagada && !pagadas.has(c.numeroCuota) && !!c.fechaVencimiento && c.fechaVencimiento < hoy,
  ).length
  return atrasadas > 0 ? { tipo: "atrasado", cuotas: atrasadas } : { tipo: "al_dia" }
}

export function textoEstadoPagos(estado: EstadoPagosEvento): string {
  if (estado.tipo === "al_dia") return "Al día"
  return estado.cuotas === 1 ? "1 cuota atrasada" : `${estado.cuotas} cuotas atrasadas`
}

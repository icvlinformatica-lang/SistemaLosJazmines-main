// Calendario de cuotas de un evento (fechas, montos y estado de cada cuota).
// Vive acá, sin "use client", para que lo puedan usar también las rutas del
// servidor (el chat con IA arma el cobro de una cuota con la misma cuenta que
// Cobrar cuota). lib/store.ts lo reexporta: los imports de siempre siguen igual.
import type { EventoGuardado } from "./store"
import { estadoDeCuota, saldoRestanteCuota, type EstadoCuota, type DecisionSaldoCuota, type RecargoSaldoCuota } from "./estado-cuotas"

/**
 * Calcula la fecha de vencimiento de una cuota especifica
 * @param fechaInicio - Fecha de la primera cuota (YYYY-MM-DD)
 * @param numeroCuota - Numero de cuota (1, 2, 3...)
 * @param diaVencimiento - Dia del mes para vencimiento (1-31)
 * @returns Fecha en formato "DD/MM/YYYY"
 */
export function calcularFechaCuota(
  fechaInicio: string,
  numeroCuota: number,
  diaVencimiento: number
): string {
  if (!fechaInicio) return ""

  const [year, month, day] = fechaInicio.split("-").map(Number)
  const inicio = new Date(year, month - 1, day)

  // Sumar meses (numeroCuota - 1) porque la cuota 1 es el mes inicial
  const mesVencimiento = inicio.getMonth() + (numeroCuota - 1)
  const añoVencimiento = inicio.getFullYear() + Math.floor(mesVencimiento / 12)
  const mesAjustado = mesVencimiento % 12

  // Ajustar dia si el mes no tiene suficientes dias (ej: 31 en febrero -> 28/29)
  const ultimoDia = new Date(añoVencimiento, mesAjustado + 1, 0).getDate()
  const diaAjustado = Math.min(diaVencimiento, ultimoDia)

  const fechaVencimiento = new Date(añoVencimiento, mesAjustado, diaAjustado)

  return fechaVencimiento.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/**
 * Genera array con todas las fechas de cuotas de un evento
 */
export function generarCalendarioCuotas(evento: EventoGuardado): Array<{
  numeroCuota: number
  fechaVencimiento: string // YYYY-MM-DD
  monto: number
  pagada: boolean
  estado: EstadoCuota
  montoAcumulado: number
  saldoRestante: number
  saldoDecision?: DecisionSaldoCuota
  recargoSaldo?: RecargoSaldoCuota
}> {
  if (!evento.planDeCuotas || !evento.planDeCuotas.numeroCuotas || evento.planDeCuotas.numeroCuotas <= 0) {
    return []
  }

  // fechaInicioPlan puede venir vacía (p. ej. pago completo generado desde el
  // contrato). Si el detalle de cuotas[] trae sus propias fechas pactadas,
  // igual podemos generar el calendario a partir de ese detalle.
  const tieneFechasEnDetalle = (evento.planDeCuotas.cuotas || []).some(
    (c) => typeof c.fechaVencimiento === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.fechaVencimiento),
  )
  if (!evento.planDeCuotas.fechaInicioPlan && !tieneFechasEnDetalle) {
    return []
  }

  const { numeroCuotas, montoCuota, montoTotal, fechaInicioPlan, diaVencimiento, cuotasPagadas = [], cuotas = [] } = evento.planDeCuotas

  // Fallback: if montoCuota is 0 but montoTotal exists, calculate it
  const montoReal = montoCuota > 0 ? montoCuota : (montoTotal > 0 && numeroCuotas > 0 ? montoTotal / numeroCuotas : 0)

  // Mapa de montos y fechas por cuota provenientes de planDeCuotas.cuotas[].
  // Ese detalle es el que se guardó al generar el contrato (fuente de verdad):
  // los montos reflejan financiación/IPC y las fechas son las pactadas.
  const montoPorCuota = new Map<number, number>()
  const fechaPorCuota = new Map<number, string>()
  for (const c of cuotas) {
    if (typeof c.montoCuota === "number" && c.montoCuota > 0) {
      montoPorCuota.set(c.numero, c.montoCuota)
    }
    if (typeof c.fechaVencimiento === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.fechaVencimiento)) {
      fechaPorCuota.set(c.numero, c.fechaVencimiento)
    }
  }

  const resolverMonto = (cuotaNum: number) => montoPorCuota.get(cuotaNum) ?? montoReal

  const resolverFecha = (cuotaNum: number): string => {
    // Preferir la fecha guardada en el contrato; recalcular solo como fallback
    const guardada = fechaPorCuota.get(cuotaNum)
    if (guardada) return guardada
    const fechaStr = calcularFechaCuota(fechaInicioPlan, cuotaNum, diaVencimiento || 10)
    if (!fechaStr) return ""
    const [dia, mes, año] = fechaStr.split("/")
    return `${año}-${mes}-${dia}`
  }

  const detallePorCuota = new Map(cuotas.map(c => [c.numero, c]))

  return Array.from({ length: numeroCuotas }).map((_, idx) => {
    const cuotaNum = idx + 1
    const monto = resolverMonto(cuotaNum)
    const detalle = detallePorCuota.get(cuotaNum)
    const pagadaLegado = cuotasPagadas.includes(cuotaNum) || detalle?.pagada === true
    // Compat: eventos viejos sin detalle.montoPagadoNeto (solo cuotasPagadas
    // legado) se tratan como completamente pagados sin pasar por "parcial".
    const montoAcumulado = detalle?.montoPagadoNeto ?? (pagadaLegado ? monto : 0)
    const estado = estadoDeCuota({ montoCuota: monto, montoPagadoNeto: montoAcumulado, ajusteCobro: detalle?.ajusteCobro })
    return {
      numeroCuota: cuotaNum,
      fechaVencimiento: resolverFecha(cuotaNum),
      monto,
      pagada: pagadaLegado || estado === "pagada",
      estado,
      montoAcumulado,
      saldoRestante: saldoRestanteCuota({ montoCuota: monto, montoPagadoNeto: montoAcumulado, ajusteCobro: detalle?.ajusteCobro }),
      saldoDecision: detalle?.saldoDecision,
      recargoSaldo: detalle?.recargoSaldo,
    }
  })
}

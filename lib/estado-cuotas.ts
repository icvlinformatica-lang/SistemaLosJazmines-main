// Estado derivado de una cuota con pagos parciales. Centralizado acá para no
// repetir la cuenta "cuánto se acumuló / qué estado tiene" en cada archivo
// que lee planDeCuotas.cuotas[] (pagos, caja eventos, caja jazmines, etc.).

export type EstadoCuota = "pendiente" | "parcial" | "pagada"
export type DecisionSaldoCuota = "acumular" | "aparte"
export type RecargoSaldoCuota = "acumula" | "congelado"

/** Tolerancia de redondeo en pesos para considerar una cuota completamente cobrada. */
const TOLERANCIA_CENTAVOS = 0.01

export interface CuotaConAcumulado {
  montoCuota: number
  montoPagadoNeto?: number
  /**
   * Ajuste de cobro de esta cuota (pedido del dueño, 27/10/2026): quien cobra
   * puede cobrar otro monto que el sugerido (un redondeo o un descuento).
   * La cuota se completa con montoCuota + ajusteCobro, pero montoCuota (la
   * cifra oficial, base del IPC de las cuotas siguientes) no cambia.
   */
  ajusteCobro?: number
}

/** Lo que hay que acreditar para completar la cuota: la cifra oficial más su ajuste de cobro. */
export function objetivoCuota(cuota: CuotaConAcumulado): number {
  const ajuste = Number.isFinite(cuota.ajusteCobro) ? cuota.ajusteCobro! : 0
  return Math.round((cuota.montoCuota + ajuste) * 100) / 100
}

/**
 * Estado de una cuota según cuánto se acreditó contra su monto oficial
 * (montoCuota, fijado en el primer pago y nunca recalculado después), más
 * su ajuste de cobro si lo tiene.
 */
export function estadoDeCuota(cuota: CuotaConAcumulado): EstadoCuota {
  const acumulado = cuota.montoPagadoNeto ?? 0
  if (acumulado <= 0) return "pendiente"
  if (acumulado >= objetivoCuota(cuota) - TOLERANCIA_CENTAVOS) return "pagada"
  return "parcial"
}

/** Lo que falta para completar la cuota (nunca negativo). */
export function saldoRestanteCuota(cuota: CuotaConAcumulado): number {
  const acumulado = cuota.montoPagadoNeto ?? 0
  return Math.max(0, Math.round((objetivoCuota(cuota) - acumulado) * 100) / 100)
}

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
}

/**
 * Estado de una cuota según cuánto se acreditó contra su monto oficial
 * (montoCuota, fijado en el primer pago y nunca recalculado después).
 */
export function estadoDeCuota(cuota: CuotaConAcumulado): EstadoCuota {
  const acumulado = cuota.montoPagadoNeto ?? 0
  if (acumulado <= 0) return "pendiente"
  if (acumulado >= cuota.montoCuota - TOLERANCIA_CENTAVOS) return "pagada"
  return "parcial"
}

/** Lo que falta para completar la cuota (nunca negativo). */
export function saldoRestanteCuota(cuota: CuotaConAcumulado): number {
  const acumulado = cuota.montoPagadoNeto ?? 0
  return Math.max(0, Math.round((cuota.montoCuota - acumulado) * 100) / 100)
}

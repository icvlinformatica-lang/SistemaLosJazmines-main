// Precio de referencia de una barra armada (barra_templates) para el
// cotizador rápido. Es solo una REFERENCIA DE PRECIO: los tragos reales del
// evento se eligen después en el planificador, y el costo interno de la barra
// lo sigue calculando calcularComprasBarras() de lib/store.ts, que no cambia.
//
// Regla: 1 trago de cada cóctel por adulto. Precio por adulto = suma de los
// precios por trago de los cócteles de la barra; precio por trago = costo ×
// (1 + margen de barra, que se configura en Cotizaciones > Configuración).
//
// Lógica pura: la usan Configuración, Cócteles y el catálogo del vendedor.

/** Desde cuántos cócteles se avisa que la barra cotiza muchos tragos. */
export const COCTELES_BARRA_GRANDE = 6

export function precioTragoConMargen(costo: number, margen: number): number {
  return Math.round((Number(costo) || 0) * (1 + (Number(margen) || 0)))
}

export interface PrecioBarraArmada {
  /** Tragos por adulto = cantidad de cócteles de la barra. */
  tragosPorAdulto: number
  /** Suma de los precios por trago de sus cócteles. */
  precioPorAdulto: number
  /** true si pasa de COCTELES_BARRA_GRANDE cócteles. */
  esGrande: boolean
}

export function precioBarraArmada(preciosPorTrago: number[]): PrecioBarraArmada {
  const tragosPorAdulto = preciosPorTrago.length
  return {
    tragosPorAdulto,
    precioPorAdulto: preciosPorTrago.reduce((s, p) => s + (Number(p) || 0), 0),
    esGrande: tragosPorAdulto > COCTELES_BARRA_GRANDE,
  }
}

/** Precio de una barra a partir de los costos por trago de su carta. Los
 *  cócteles que ya no existen se ignoran (no suman ni cuentan como trago). */
export function precioBarraDesdeCostos(
  coctelesIds: string[],
  costosPorTrago: Record<string, number>,
  margen: number,
): PrecioBarraArmada {
  const precios = coctelesIds
    .filter((id) => id in costosPorTrago)
    .map((id) => precioTragoConMargen(costosPorTrago[id], margen))
  return precioBarraArmada(precios)
}

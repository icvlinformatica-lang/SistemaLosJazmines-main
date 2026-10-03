// Costo y precio de UN trago de cóctel.
//
// Reglas del negocio (confirmadas, oct 2026):
//   - Costo de un trago = suma de sus insumos (cantidad convertida a la unidad
//     de stock × precio unitario). Es la misma cuenta que la carta de cócteles
//     (/admin/cocteles), que usa costoPorTrago() de acá.
//   - precioPorTrago = costo × (1 + MARGEN_BARRA): lo usaba la "barra
//     personalizada" del cotizador viejo. Desde el Paso 2 del cotizador por
//     salón, el precio de la barra sale de la barra ARMADA del salón (1 trago
//     de cada cóctel por adulto × la ganancia de barra del salón, ver
//     lib/cotizador-salon.ts). La fórmula vieja "2 tragos por adulto × precio
//     promedio" se sacó para que no queden dos.
//
// OJO: el costo interno de la barra de un evento ya cargado lo sigue
// calculando calcularComprasBarras() de lib/store.ts (1 trago por adulto por
// cada cóctel), que no se tocó.
//
// Lógica pura.

import type { Coctel, InsumoBarra } from "./store"
import { contenidoDe, normalizeToStockUnit } from "./unidades"

/** Margen sobre el costo del cóctel para el precio por trago (50 %). */
export const MARGEN_BARRA = 0.5
/** servicioId de la línea "Barra personalizada" de las cotizaciones VIEJAS (no es un servicio del catálogo). */
export const ID_BARRA_PERSONALIZADA = "barra-personalizada"

/** Costo de UN trago: suma de sus insumos a precio actual. */
export function costoPorTrago(
  coctel: Pick<Coctel, "insumos">,
  insumosBarra: Pick<InsumoBarra, "id" | "unidad" | "precioUnitario" | "contenidoCantidad" | "contenidoUnidad">[],
): number {
  return (coctel.insumos || []).reduce((total, ing) => {
    const insumo = insumosBarra.find((i) => i.id === ing.insumoBarraId)
    if (!insumo) return total
    const qtyEnStock = normalizeToStockUnit(ing.cantidadPorCoctel, ing.unidadCoctel, insumo.unidad, contenidoDe(insumo))
    return total + qtyEnStock * (insumo.precioUnitario || 0)
  }, 0)
}

/** Precio por trago para el cliente, redondeado a pesos. */
export function precioPorTrago(costo: number): number {
  return Math.round((Number(costo) || 0) * (1 + MARGEN_BARRA))
}

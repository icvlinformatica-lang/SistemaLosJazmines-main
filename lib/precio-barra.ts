// Precio de la barra personalizada del cotizador y costo de un cóctel.
//
// Reglas del negocio (confirmadas, oct 2026):
//   - Costo de un trago = suma de sus insumos (cantidad convertida a la unidad
//     de stock × precio unitario). Es la misma cuenta que la carta de cócteles
//     (/admin/cocteles), que usa costoPorTrago() de acá.
//   - Precio por trago para el cliente = costo × (1 + MARGEN_BARRA): un único
//     margen para toda la carta.
//   - Barra personalizada = TRAGOS_POR_ADULTO por adulto EN TOTAL (no por cada
//     cóctel) × el precio por trago PROMEDIO de los cócteles elegidos.
//   - Se cobra siempre, también con la modalidad "con catering".
//
// OJO: esto es solo el PRECIO que se cotiza al cliente. El costo interno de la
// barra de un evento ya cargado lo sigue calculando calcularComprasBarras()
// de lib/store.ts con su propia regla (1 trago por adulto por cada cóctel), que
// a propósito no se tocó.
//
// Lógica pura: la usan el preview del cotizador y el recálculo del servidor.

import type { Coctel, InsumoBarra } from "./store"
import { contenidoDe, normalizeToStockUnit } from "./unidades"

/** Margen sobre el costo del cóctel para el precio por trago (50 %). */
export const MARGEN_BARRA = 0.5
/** Tragos por adulto de la barra personalizada, en total. */
export const TRAGOS_POR_ADULTO = 2
/** servicioId de la línea "Barra personalizada" (no es un servicio del catálogo). */
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

export interface ResultadoBarraPersonalizada {
  tragos: number
  /** Promedio de precio por trago de los cócteles elegidos. */
  precioPromedio: number
  total: number
}

/**
 * Precio de la barra personalizada: TRAGOS_POR_ADULTO × adultos × promedio
 * del precio por trago de los cócteles elegidos. Sin cócteles o sin adultos
 * da 0.
 */
export function calcularBarraPersonalizada(
  preciosPorTrago: number[],
  adultos: number,
): ResultadoBarraPersonalizada {
  const tragos = TRAGOS_POR_ADULTO * Math.max(0, Math.floor(Number(adultos) || 0))
  if (preciosPorTrago.length === 0 || tragos === 0) return { tragos, precioPromedio: 0, total: 0 }
  const precioPromedio = preciosPorTrago.reduce((s, p) => s + (Number(p) || 0), 0) / preciosPorTrago.length
  return { tragos, precioPromedio, total: Math.round(tragos * precioPromedio) }
}

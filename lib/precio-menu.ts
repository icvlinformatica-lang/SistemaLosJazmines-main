// Precio por porción de un plato del cotizador rápido.
//
// Lógica pura (sin "use client"): la usan Configuración (preview) y el
// catálogo del vendedor (servidor).
//
// Costo por porción = la MISMA cuenta que calcularCostoReceta() de
// lib/store.ts, que no se puede importar desde el servidor:
//   - cada insumo de la receta trae su cantidad POR PERSONA
//     (cantidadBasePorPersona) en la unidad de la receta;
//   - se pasa a la unidad de stock del insumo (normalizeToStockUnit con
//     contenidoDe, para insumos que se compran por unidad);
//   - se divide por factorRendimiento (1 = la cantidad ya es de una porción;
//     20 = la receta cargada rinde para 20, ej. una bandeja de brownie);
//   - se multiplica por el precio unitario actual del insumo.
// O sea: calcularCostoReceta ya devuelve el costo de UNA porción. Una prueba
// (scripts/test-precio-menu.cjs) verifica que las dos cuentas den igual.
//
// Precio por porción = costo × (1 + margen), redondeado a pesos.

import { contenidoDe, normalizeToStockUnit } from "./unidades"
import type { Insumo, Receta } from "./store"

export function costoPorPorcion(
  receta: Pick<Receta, "insumos" | "factorRendimiento">,
  insumos: Pick<Insumo, "id" | "unidad" | "precioUnitario" | "contenidoCantidad" | "contenidoUnidad">[],
): number {
  const factor = receta.factorRendimiento || 1
  return (receta.insumos || []).reduce((total, ir) => {
    const insumo = insumos.find((i) => i.id === ir.insumoId)
    if (!insumo) return total
    const qty = normalizeToStockUnit(ir.cantidadBasePorPersona, ir.unidadReceta, insumo.unidad, contenidoDe(insumo))
    return total + (qty / factor) * insumo.precioUnitario
  }, 0)
}

/** Precio por porción para el cliente: costo × (1 + margen), redondeado a pesos. */
export function precioPorPorcion(costo: number, margen: number): number {
  return Math.round((Number(costo) || 0) * (1 + (Number(margen) || 0)))
}

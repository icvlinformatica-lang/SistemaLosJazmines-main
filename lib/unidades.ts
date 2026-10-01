// Conversión de unidades de recetas/cócteles a la unidad de stock de un
// insumo, y su contenido por unidad. Movido tal cual desde lib/store.ts (que
// es "use client") para poder usarlo también del lado del servidor (precio de
// la barra en el cotizador). store.ts lo re-exporta, así nada más cambió.
import type { Insumo, Unidad, UnidadReceta } from "./store"

/**
 * Cuánto contiene cada unidad de un insumo que se compra por unidad: una lata
 * de arvejas trae 200 GRS, una botella 750 CC. Se carga en Almacén, en el
 * insumo, y solo tiene sentido cuando la unidad de stock es "UN".
 */
export interface ContenidoPorUnidad {
  cantidad: number
  unidad: "GRS" | "CC"
}

/** Contenido por unidad de un insumo, en la forma que espera normalizeToStockUnit. */
export function contenidoDe(
  insumo: Pick<Insumo, "contenidoCantidad" | "contenidoUnidad">,
): ContenidoPorUnidad | null {
  if (!insumo.contenidoCantidad || !insumo.contenidoUnidad) return null
  return { cantidad: Number(insumo.contenidoCantidad), unidad: insumo.contenidoUnidad }
}

export function normalizeToStockUnit(
  qty: number,
  recipeUnit: UnidadReceta | undefined,
  stockUnit: Unidad,
  /**
   * Contenido de cada unidad, si el insumo lo tiene cargado. Sin esto, un
   * insumo por unidad usado con una receta en gramos NO se puede convertir
   * (ver el bloque de abajo).
   */
  contenido?: ContenidoPorUnidad | null,
): number {
  // If no recipe unit specified, assume same as stock
  if (!recipeUnit) return qty

  // Normalize unit names (GR = GRS, LT = L)
  const normalizedRecipe = recipeUnit === "GRS" ? "GRS" : recipeUnit
  const normalizedStock = stockUnit === "GR" ? "GRS" : stockUnit === "LT" ? "L" : stockUnit

  // If same unit, return as-is
  if (normalizedRecipe === normalizedStock) return qty

  // MASS conversions
  if (normalizedRecipe === "GRS" && normalizedStock === "KG") {
    return qty / 1000 // 300 GRS -> 0.3 KG
  }
  if (normalizedRecipe === "KG" && normalizedStock === "GRS") {
    return qty * 1000 // 0.3 KG -> 300 GRS
  }

  // VOLUME conversions
  if (normalizedRecipe === "CC" && normalizedStock === "L") {
    return qty / 1000 // 500 CC -> 0.5 L
  }
  if (normalizedRecipe === "L" && normalizedStock === "CC") {
    return qty * 1000 // 0.5 L -> 500 CC
  }

  // La receta pide peso o volumen y el insumo se compra por unidad (una lata,
  // una bolsa). Solo se puede convertir si sabemos cuánto trae cada unidad:
  // 30 GRS de arvejas / 200 GRS por lata = 0,15 latas.
  //
  // Sin ese dato NO se convierte y se devuelve la cantidad tal cual, que es
  // lo que hacía antes. Ojo: eso significa leer "30 grs" como "30 latas" y
  // multiplicar el costo por 200. Por eso la pantalla de Almacén pide el
  // contenido cuando la unidad es UN, y el recetario avisa cuando falta.
  if (normalizedStock === "UN" && contenido && contenido.cantidad > 0) {
    const enContenido =
      normalizedRecipe === contenido.unidad
        ? qty
        : normalizedRecipe === "KG" && contenido.unidad === "GRS"
          ? qty * 1000
          : normalizedRecipe === "L" && contenido.unidad === "CC"
            ? qty * 1000
            : null
    if (enContenido !== null) return enContenido / contenido.cantidad
  }

  // Incompatible units - return as-is and log warning
  console.warn(`[v0] Incompatible units: recipe=${recipeUnit}, stock=${stockUnit}`)
  return qty
}

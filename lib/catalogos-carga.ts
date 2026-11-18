// Catálogos que se cargan al abrir el sistema (insumos, recetas, cócteles…)
// y qué hacer cuando esa carga falla.
//
// Pedido de Rodrigo (18/11/2026): el 16/11 a las 21:05 la base tardó en
// responder justo cuando Diego abría el sistema. /api/cocteles y /api/recetas
// devolvieron 500, la app se quedó con las listas vacías y Cócteles decía
// "Todavía no hay cócteles cargados" como si no existiera ninguno. Como esas
// pantallas no se refrescan solas, siguió así hasta que cerró y volvió a abrir.
//
// Ahora el store anota qué catálogo no llegó, lo vuelve a pedir solo unas
// veces (ESPERAS_REINTENTO_CARGA) y las pantallas muestran "No se pudo
// conectar" con un botón para reintentar, en vez de decir que no hay nada.
// Solo lee: no escribe nada en la base.

export const CATALOGOS_CARGA = ["insumos", "insumosBarra", "recetas", "cocteles", "barrasTemplates"] as const
export type CatalogoCarga = (typeof CATALOGOS_CARGA)[number]

/** Rutas de la API de cada catálogo (las mismas de la carga inicial). */
export const URL_CATALOGO: Record<CatalogoCarga, string> = {
  insumos: "/api/insumos",
  insumosBarra: "/api/insumos-barra",
  recetas: "/api/recetas",
  cocteles: "/api/cocteles",
  barrasTemplates: "/api/barra-templates",
}

/** Cuánto esperar antes de cada reintento automático (en ms). Después del
 *  último queda el botón "Reintentar" (y la pantalla sigue avisando). */
export const ESPERAS_REINTENTO_CARGA = [3000, 10000, 30000, 60000]

/** Nombre de cada catálogo para el aviso de la pantalla. */
export const NOMBRE_CATALOGO: Record<CatalogoCarga, string> = {
  insumos: "los insumos de cocina",
  insumosBarra: "los insumos de barra",
  recetas: "las recetas",
  cocteles: "los cócteles",
  barrasTemplates: "las barras",
}

/** Qué catálogos fallaron: los que no vinieron como lista. */
export function catalogosFallidos(resultados: Partial<Record<CatalogoCarga, unknown>>): CatalogoCarga[] {
  return CATALOGOS_CARGA.filter((c) => c in resultados && !Array.isArray(resultados[c]))
}

/**
 * Qué reemplazar en el estado después de reintentar los catálogos pendientes.
 * Solo se pisan los que estaban pendientes y ahora llegaron bien: un catálogo
 * que ya había cargado no se toca (puede tener cambios recién hechos).
 */
export function aplicarRecarga(
  pendientes: CatalogoCarga[],
  resultados: Partial<Record<CatalogoCarga, unknown>>,
): { cambios: Partial<Record<CatalogoCarga, unknown[]>>; siguenPendientes: CatalogoCarga[] } {
  const cambios: Partial<Record<CatalogoCarga, unknown[]>> = {}
  const siguenPendientes: CatalogoCarga[] = []
  for (const c of pendientes) {
    const r = resultados[c]
    if (Array.isArray(r)) cambios[c] = r
    else siguenPendientes.push(c)
  }
  return { cambios, siguenPendientes }
}

/** Frase del aviso: "No se pudieron cargar los cócteles y los insumos de barra." */
export function textoCargaFallida(catalogos: CatalogoCarga[]): string {
  const nombres = CATALOGOS_CARGA.filter((c) => catalogos.includes(c)).map((c) => NOMBRE_CATALOGO[c])
  if (nombres.length === 0) return ""
  const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`
  return `No se pudieron cargar ${lista}.`
}

// Borrador del conteo de stock por salón (pantalla /stock).
//
// Por qué existe: el conteo se hace de madrugada desde el celular y son
// decenas de casilleros. Si el celular se bloquea, se cierra el navegador o
// se queda sin batería, se perdía todo lo escrito. Ahora lo tipeado se va
// guardando EN EL CELULAR (localStorage) y al volver a entrar al mismo
// salón y tipo de carga se ofrece seguir con ese conteo.
//
// Reglas:
// - El borrador es SOLO lo escrito en los casilleros (insumoId → texto).
//   Nunca el PIN ni el nombre de quien carga, y nunca se manda solo al
//   servidor: el conteo se sigue guardando únicamente al confirmar.
// - Una clave por salón, sector (cocina/barra) y tipo de carga (la de
//   "luego del evento X", por id del evento, o la extraordinaria).
// - Los borradores de más de 3 días se descartan solos.
//
// Estas funciones son puras (no tocan localStorage): la pantalla lee y
// escribe, siempre con try/catch.

export const PREFIJO_BORRADOR_STOCK = "lj-stock-borrador:v1:"
export const VENCIMIENTO_BORRADOR_MS = 3 * 24 * 60 * 60 * 1000

export interface BorradorStock {
  /** ISO de la última vez que se guardó (para mostrar "del {fecha y hora}"). */
  guardadoEn: string
  /** insumoId → texto escrito en el casillero. Solo los que tienen algo. */
  valores: Record<string, string>
}

/**
 * Clave del borrador. `eventoId` null = carga extraordinaria. Cada parte
 * va con encodeURIComponent para que un ":" en un id no mezcle claves.
 */
export function claveBorradorStock(salon: string, sector: string, eventoId: string | null): string {
  const tipo = eventoId ? `evento:${encodeURIComponent(eventoId)}` : "extraordinaria"
  return `${PREFIJO_BORRADOR_STOCK}${encodeURIComponent(salon)}:${encodeURIComponent(sector)}:${tipo}`
}

/** Deja solo los casilleros con algo escrito. */
function soloEscritos(valores: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [id, v] of Object.entries(valores || {})) {
    if (typeof v === "string" && v.trim()) out[id] = v
  }
  return out
}

/**
 * Texto a guardar en localStorage, o null si no hay nada escrito (en ese
 * caso la pantalla borra el borrador en vez de guardar uno vacío).
 */
export function armarBorradorStock(valores: Record<string, string>, ahora: Date): string | null {
  const escritos = soloEscritos(valores)
  if (Object.keys(escritos).length === 0) return null
  const borrador: BorradorStock = { guardadoEn: ahora.toISOString(), valores: escritos }
  return JSON.stringify(borrador)
}

/** true si el borrador tiene más de 3 días (o una fecha que no se entiende). */
export function borradorVencido(guardadoEn: string, ahora: Date): boolean {
  const t = Date.parse(guardadoEn)
  if (!Number.isFinite(t)) return true
  return ahora.getTime() - t > VENCIMIENTO_BORRADOR_MS
}

/**
 * Lee lo guardado. Devuelve null si no hay, está roto, no tiene nada
 * escrito o venció (la pantalla entonces lo borra). Tolera basura: un
 * localStorage viejo o tocado a mano no puede romper la pantalla.
 */
export function leerBorradorStock(texto: string | null | undefined, ahora: Date): BorradorStock | null {
  if (!texto) return null
  let data: unknown
  try {
    data = JSON.parse(texto)
  } catch {
    return null
  }
  if (!data || typeof data !== "object") return null
  const { guardadoEn, valores } = data as { guardadoEn?: unknown; valores?: unknown }
  if (typeof guardadoEn !== "string" || borradorVencido(guardadoEn, ahora)) return null
  if (!valores || typeof valores !== "object" || Array.isArray(valores)) return null
  const escritos = soloEscritos(valores as Record<string, unknown>)
  if (Object.keys(escritos).length === 0) return null
  return { guardadoEn, valores: escritos }
}

/**
 * Al seguir con un borrador, se descartan los casilleros de insumos que ya
 * no están en el catálogo del sector (por ejemplo, se borró el insumo):
 * si no, se mandarían al confirmar sin verse en la lista.
 */
export function valoresDelCatalogo(valores: Record<string, string>, idsCatalogo: Iterable<string>): Record<string, string> {
  const ids = new Set(idsCatalogo)
  const out: Record<string, string> = {}
  for (const [id, v] of Object.entries(valores)) if (ids.has(id)) out[id] = v
  return out
}

/**
 * De todas las entradas de localStorage (clave, texto), las claves de
 * borradores de stock que hay que borrar por vencidos o rotos. Así no
 * quedan para siempre los de eventos a los que no se vuelve a entrar.
 */
export function clavesBorradorStockVencidas(entradas: Array<[string, string | null]>, ahora: Date): string[] {
  return entradas
    .filter(([clave, texto]) => clave.startsWith(PREFIJO_BORRADOR_STOCK) && !leerBorradorStock(texto, ahora))
    .map(([clave]) => clave)
}

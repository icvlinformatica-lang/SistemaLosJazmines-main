// Lógica pura de la pantalla de carga de Stock por salón (app/stock/page.tsx):
// qué se envía al guardar y qué insumos se muestran. Sin React, para poder
// probarla sola. El guardado en sí (transaccional, idempotente) vive en
// /api/stock-salones/sesiones y no cambia.

/** Acepta coma o punto decimal. NaN si está vacío, no es número o es negativo. */
export function parseCantidad(v: string): number {
  const t = v.trim().replace(",", ".")
  if (!t) return Number.NaN
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN
}

/**
 * Arma los items a enviar a partir de lo escrito (insumoId → texto).
 * REGLA CENTRAL: se envían SOLO los insumos con un número escrito. Un campo
 * vacío se ignora por completo (no se manda, no crea fila, no se pone en 0):
 * no contar un insumo no significa que haya cero. Un "0" escrito sí se envía
 * ("conté y no queda nada").
 * Lo escrito que no es un número válido (ej. "-3", "abc") no se envía y se
 * devuelve en `invalidos`, para marcarlo y no dejar confirmar hasta que se
 * corrija o se borre (nunca se descarta en silencio algo que alguien tipeó).
 */
export function itemsParaEnviar(valores: Record<string, string>): {
  items: Array<{ insumoId: string; cantidad: number }>
  invalidos: string[]
} {
  const items: Array<{ insumoId: string; cantidad: number }> = []
  const invalidos: string[] = []
  for (const [insumoId, texto] of Object.entries(valores)) {
    if (!texto || !texto.trim()) continue
    const cantidad = parseCantidad(texto)
    if (Number.isNaN(cantidad)) invalidos.push(insumoId)
    else items.push({ insumoId, cantidad })
  }
  return { items, invalidos }
}

export interface InsumoCarga {
  id: string
  descripcion: string
  unidad: string
  categoria?: string
}

/**
 * Insumos visibles en la lista, ordenados alfabéticamente:
 * - `busqueda` solo achica la lista (no agrega nada);
 * - `soloContados` (cocina, "Los que ya conté acá") deja solo los que ya
 *   tienen conteo en ese salón (`contados`);
 * - los que tienen algo escrito quedan SIEMPRE visibles, aunque el filtro o
 *   la búsqueda no los alcancen, para no perder de vista lo ya cargado.
 */
export function insumosVisibles(
  catalogo: InsumoCarga[],
  opciones: { busqueda: string; soloContados: boolean; contados: Set<string>; valores: Record<string, string> },
): InsumoCarga[] {
  const q = opciones.busqueda.trim().toLowerCase()
  return catalogo
    .filter((i) => {
      if ((opciones.valores[i.id] || "").trim()) return true
      if (q && !i.descripcion.toLowerCase().includes(q)) return false
      if (opciones.soloContados && !opciones.contados.has(i.id)) return false
      return true
    })
    .sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es"))
}

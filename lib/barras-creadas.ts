// Filas de "Ver barras" en Cócteles (components/ver-barras-creadas.tsx).
// Solo para mostrar: no guarda nada ni cambia ninguna cuenta. El costo por
// adulto es el mismo de "Crear barra": 1 trago de cada cóctel, sin ganancia
// (precioBarraDesdeCostos de lib/precio-barra-cotizador.ts). Los cócteles que
// ya no existen no se muestran ni suman, igual que en el cotizador.
//
// Test: scripts/test-barras-creadas.cjs.

import { precioBarraDesdeCostos } from "./precio-barra-cotizador"

export interface FilaBarraCreada {
  id: string
  nombre: string
  cocteles: Array<{ id: string; nombre: string }>
  /** Cócteles de la barra que ya no están en la carta. */
  borrados: number
  costoPorAdulto: number
}

export function filasBarrasCreadas(
  barras: Array<{ id: string; nombre: string; coctelesIncluidos?: string[] | null }>,
  cocteles: Array<{ id: string; nombre: string }>,
  costosPorTrago: Record<string, number>,
): FilaBarraCreada[] {
  const porId = new Map(cocteles.map((c) => [c.id, c]))
  return barras
    .map((b) => {
      const ids = [...new Set(b.coctelesIncluidos || [])]
      const vigentes = ids.filter((id) => porId.has(id))
      return {
        id: b.id,
        nombre: b.nombre,
        cocteles: vigentes.map((id) => ({ id, nombre: porId.get(id)!.nombre })),
        borrados: ids.length - vigentes.length,
        costoPorAdulto: precioBarraDesdeCostos(vigentes, costosPorTrago, 0).precioPorAdulto,
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
}

// ── Atajos de barras en el planificador (Generar contrato) ──────────────────
// Pedido de Rodrigo (10/11/2026): arriba de la tabla de cócteles van las
// barras creadas como botones. Tocar una tilda sus cócteles; si ya estaban
// todos tildados, los destilda. Es SOLO un atajo para tildar: la barra del
// evento sigue siendo la lista de cócteles de siempre, así que el costo
// (calcularComprasBarras), Caja Eventos, las compras y el contrato no cambian
// de cuenta. No se anota de qué barra salió (barraTemplateId queda igual).

export interface AtajoBarra {
  id: string
  nombre: string
  /** Cócteles de la barra que siguen en la carta, sin repetir. */
  cocteles: string[]
  /** true si todos sus cócteles ya están tildados en el evento. */
  activa: boolean
}

/** Los atajos a mostrar: barras con al menos un cóctel vigente, por nombre. */
export function atajosBarras(
  barras: Array<{ id: string; nombre: string; coctelesIncluidos?: string[] | null }>,
  coctelesExistentes: string[],
  seleccionados: string[],
): AtajoBarra[] {
  const existen = new Set(coctelesExistentes)
  const elegidos = new Set(seleccionados)
  return barras
    .map((b) => {
      const cocteles = [...new Set(b.coctelesIncluidos || [])].filter((id) => existen.has(id))
      return { id: b.id, nombre: b.nombre, cocteles, activa: cocteles.length > 0 && cocteles.every((id) => elegidos.has(id)) }
    })
    .filter((a) => a.cocteles.length > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
}

/** Cócteles del evento después de tocar un atajo: si la barra estaba entera,
 *  saca sus cócteles; si no, suma los que faltan (sin repetir y sin tocar el
 *  resto de lo tildado). */
export function aplicarAtajoBarra(seleccionados: string[], atajo: AtajoBarra): string[] {
  if (atajo.activa) {
    const deLaBarra = new Set(atajo.cocteles)
    return seleccionados.filter((id) => !deLaBarra.has(id))
  }
  const ya = new Set(seleccionados)
  return [...seleccionados, ...atajo.cocteles.filter((id) => !ya.has(id))]
}

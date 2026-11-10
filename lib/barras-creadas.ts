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

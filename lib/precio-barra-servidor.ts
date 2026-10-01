// Costo y precio por trago de cada cóctel, leídos de la base. Solo servidor.
//
// Lo usan el catálogo del vendedor (que solo manda el PRECIO, nunca el costo)
// y el guardado de la cotización (que recalcula el precio y guarda el costo
// como dato interno). La cuenta es la de lib/precio-barra.ts.
import { sql } from "@/lib/db"
import { costoPorTrago, precioPorTrago } from "@/lib/precio-barra"
import type { InsumoCoctel, UnidadReceta, Unidad } from "@/lib/store"

export interface PrecioCoctel {
  id: string
  nombre: string
  categoria: string
  costoPorTrago: number
  precioPorTrago: number
}

export async function leerPreciosCocteles(): Promise<PrecioCoctel[]> {
  const [cocteles, coctelInsumos, insumosBarra] = (await Promise.all([
    sql`SELECT id, nombre, categoria FROM cocteles ORDER BY nombre ASC`,
    sql`SELECT coctel_id, insumo_barra_id, cantidad_por_coctel, unidad_coctel FROM coctel_insumos`,
    sql`SELECT id, unidad, precio_unitario, contenido_cantidad, contenido_unidad FROM insumos_barra`,
  ])) as unknown as [
    Array<{ id: string; nombre: string; categoria: string | null }>,
    Array<{ coctel_id: string; insumo_barra_id: string; cantidad_por_coctel: number; unidad_coctel: string | null }>,
    Array<{ id: string; unidad: string; precio_unitario: number; contenido_cantidad: number | null; contenido_unidad: string | null }>,
  ]

  // Mismas conversiones que /api/insumos-barra y /api/cocteles.
  const insumos = insumosBarra.map((i) => ({
    id: i.id,
    unidad: i.unidad as Unidad,
    precioUnitario: Number(i.precio_unitario),
    contenidoCantidad: i.contenido_cantidad != null ? Number(i.contenido_cantidad) : undefined,
    contenidoUnidad: (i.contenido_unidad || undefined) as "GRS" | "CC" | undefined,
  }))

  return cocteles.map((c) => {
    const receta: InsumoCoctel[] = coctelInsumos
      .filter((ci) => ci.coctel_id === c.id)
      .map((ci) => ({
        insumoBarraId: ci.insumo_barra_id,
        cantidadPorCoctel: Number(ci.cantidad_por_coctel),
        unidadCoctel: (ci.unidad_coctel || undefined) as UnidadReceta | undefined,
      }))
    const costo = costoPorTrago({ insumos: receta }, insumos)
    return {
      id: c.id,
      nombre: c.nombre,
      categoria: c.categoria || "Con Alcohol",
      costoPorTrago: costo,
      precioPorTrago: precioPorTrago(costo),
    }
  })
}

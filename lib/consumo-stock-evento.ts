// Mover el stock que consume (o devuelve) un evento, en el salón donde se
// hace. Envoltorio de POST /api/stock-salones/consumo, para que las cuatro
// pantallas que lo hacían a mano sobre el stock global llamen todas igual.
//
// Antes cada una hacía PATCH /api/insumos/:id restando del total, que mezcla
// los cinco salones: un evento en Quinta descontaba mercadería de Casona.

import { calcularComprasSegmentadas, type Evento, type Insumo, type Receta } from "./store"

export type MotivoConsumo = "impresion" | "cierre" | "devolucion"

export interface ItemConsumo {
  insumoId: string
  sector: "cocina" | "barra"
  /** Negativo descuenta (se usó), positivo devuelve (se recupera). */
  delta: number
}

export interface ResultadoConsumo {
  ok: boolean
  /** Cuántos se movieron de verdad. */
  aplicados: number
  /** Cuántos quedaron afuera porque ese salón nunca los contó. */
  sinConteo: number
  /** Al imprimir: el evento ya estaba descontado, no se movió nada. */
  yaDescontado?: boolean
  error?: string
}

/**
 * Sin salón no se hace nada: no hay a qué salón descontarle. Devuelve ok con
 * todo en cero para que quien llama no tenga que distinguir el caso.
 */
export async function moverStockDelEvento(params: {
  salon: string | null | undefined
  eventoId?: string | null
  nombreEvento?: string
  motivo: MotivoConsumo
  items: ItemConsumo[]
}): Promise<ResultadoConsumo> {
  const items = params.items.filter((i) => Number.isFinite(i.delta) && i.delta !== 0)
  if (!params.salon || items.length === 0) return { ok: true, aplicados: 0, sinConteo: 0 }

  try {
    const res = await fetch("/api/stock-salones/consumo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salon: params.salon,
        eventoId: params.eventoId ?? null,
        nombreEvento: params.nombreEvento || "",
        motivo: params.motivo,
        items,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.ok) {
      return { ok: false, aplicados: 0, sinConteo: 0, error: data?.error || "No se pudo mover el stock." }
    }
    return { ok: true, aplicados: data.aplicados ?? 0, sinConteo: data.sinConteo ?? 0, yaDescontado: data.yaDescontado === true }
  } catch {
    return { ok: false, aplicados: 0, sinConteo: 0, error: "Se cortó la conexión al mover el stock." }
  }
}

/** Arma los ítems desde un mapa {insumoId: cantidad} de un solo sector. */
export function itemsDesdeMapa(
  mapa: Record<string, number>,
  sector: "cocina" | "barra",
  signo: 1 | -1,
): ItemConsumo[] {
  return Object.entries(mapa).map(([insumoId, cantidad]) => ({
    insumoId,
    sector,
    delta: signo * cantidad,
  }))
}

/**
 * Cuánto de cada insumo de cocina consume un evento, en la unidad de stock
 * del insumo (la misma en la que se cuenta en /stock y se muestra en
 * Almacén). Es la "cantidad necesaria" de la lista de compras
 * (calcularComprasSegmentadas), así que respeta todo lo que respeta esa
 * cuenta:
 * - pasa gramos a kilos, cc a litros y gramos a unidades (contenido por unidad);
 * - divide por el "rinde para X personas" de la receta;
 * - aplica los multiplicadores de porción de cada receta.
 *
 * Antes la Lista de Eventos lo calculaba a mano como cantidad × personas ×
 * rinde, sin pasar de unidad: 300 GRS de carne por persona para 100
 * personas descontaban 30.000 KG en vez de 30 KG, y como el stock no baja
 * de 0, una impresión dejaba en cero casi todo el salón.
 *
 * Al imprimir se descuenta con esto y al recuperar o eliminar se devuelve
 * con esto mismo, para que lo que vuelve sea igual a lo que salió.
 */
export function consumoCocinaDelEvento(
  evento: Evento,
  recetas: Receta[],
  insumos: Insumo[],
): Record<string, number> {
  const mapa: Record<string, number> = {}
  for (const c of calcularComprasSegmentadas(evento, recetas, insumos)) {
    // 3 decimales: un gramo en KG, un cc en LT. Evita mandar 30.000000000000004.
    const cantidad = Math.round(c.cantidadNecesaria * 1000) / 1000
    // Sin invitados cargados la cuenta da NaN o 0: no se mueve nada.
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue
    mapa[c.insumoId] = cantidad
  }
  return mapa
}

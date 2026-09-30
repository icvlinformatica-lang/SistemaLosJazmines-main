// Mover el stock que consume (o devuelve) un evento, en el salón donde se
// hace. Envoltorio de POST /api/stock-salones/consumo, para que las cuatro
// pantallas que lo hacían a mano sobre el stock global llamen todas igual.
//
// Antes cada una hacía PATCH /api/insumos/:id restando del total, que mezcla
// los cinco salones: un evento en Quinta descontaba mercadería de Casona.

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
    return { ok: true, aplicados: data.aplicados ?? 0, sinConteo: data.sinConteo ?? 0 }
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

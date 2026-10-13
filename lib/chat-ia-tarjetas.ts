// Tarjetas de eventos del chat con IA: la forma de los datos y su lectura.
// Sin dependencias, para que lo usen el servidor (app/api/chat) y la
// pantalla (components/chat-ia-flotante.tsx).

/**
 * Tarjeta de un evento para el chat: los mismos números que recibe la IA
 * (resumenEventoChat), armados en el servidor para que el chat los muestre
 * ordenados. La IA solo elige qué eventos; nunca escribe un monto de tarjeta.
 */
export interface TarjetaEventoChat {
  id: string
  nombre: string
  fecha: string
  salon: string
  estado: string
  montoTotal: number | null
  sena: number
  cobrado: number
  saldoPendiente: number | null
  cuotasPendientes: number
  cuotasVencidas: number
  montoVencido: number
  /** La primera cuota pendiente que todavía no venció. */
  proximaCuota: { numero: number; vencimiento: string; monto: number } | null
  /** Alguna cuota pendiente puede cambiar porque falta el IPC. */
  ipcPendiente: boolean
}

/** Máximo de tarjetas por respuesta. */
export const MAX_TARJETAS_CHAT = 6

/** Agrega tarjetas sin repetir eventos y sin pasar el máximo. */
export function sumarTarjetas(tarjetas: TarjetaEventoChat[], nuevas: TarjetaEventoChat[]): void {
  for (const t of nuevas) {
    if (tarjetas.length >= MAX_TARJETAS_CHAT) return
    if (!tarjetas.some((x) => x.id === t.id)) tarjetas.push(t)
  }
}

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

/** Tarjetas leídas del historial o de la respuesta: descarta lo que no tenga la forma esperada. */
export function tarjetasValidas(valor: unknown): TarjetaEventoChat[] {
  if (!Array.isArray(valor)) return []
  return valor
    .filter(
      (t): t is TarjetaEventoChat =>
        !!t &&
        typeof t.id === "string" &&
        typeof t.nombre === "string" &&
        typeof t.fecha === "string" &&
        typeof t.salon === "string" &&
        typeof t.estado === "string" &&
        (t.montoTotal === null || esNumero(t.montoTotal)) &&
        (t.saldoPendiente === null || esNumero(t.saldoPendiente)) &&
        esNumero(t.sena) &&
        esNumero(t.cobrado) &&
        esNumero(t.cuotasPendientes) &&
        esNumero(t.cuotasVencidas) &&
        esNumero(t.montoVencido),
    )
    .map((t) => ({
      ...t,
      proximaCuota:
        t.proximaCuota && esNumero(t.proximaCuota.numero) && esNumero(t.proximaCuota.monto) && typeof t.proximaCuota.vencimiento === "string"
          ? t.proximaCuota
          : null,
      ipcPendiente: t.ipcPendiente === true,
    }))
    .slice(0, MAX_TARJETAS_CHAT)
}


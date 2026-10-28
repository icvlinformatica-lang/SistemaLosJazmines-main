// Ajuste de cobro de una cuota (pedido del dueño, 27/10/2026): en Cobrar
// cuota se puede cobrar otro monto que el sugerido (un redondeo para arriba
// o un descuento). Decisión del dueño: es un ajuste SOLO de esa cuota.
// - La cuota se completa con montoCuota + ajusteCobro (lib/estado-cuotas.ts).
// - montoCuota, la cifra oficial y base del IPC de las cuotas siguientes, no
//   cambia. Al cobrar la cuota siguiente se pregunta si el sugerido se
//   calcula sobre esa cifra oficial o sobre lo que se cobró (base manual).
// - El ajuste se fija con el primer pago de la cuota y queda en ese pago
//   (pago.ajusteCuota); anular todos sus pagos lo borra.
import type { EventoGuardado, PagoEvento } from "./store"
import { numeroCuotaPago, calcularIPCPeriodo, type EventoIPC } from "./ipc-cuotas"
import type { HistorialIPCEntry } from "./store"

const TOLERANCIA = 0.01
const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0)

/**
 * Control del servidor (PATCH /api/eventos/[id]) para eventos con y sin IPC.
 * Devuelve el motivo del rechazo o null.
 */
export function validarAjustesCobro(
  actual: Pick<EventoGuardado, "planDeCuotas" | "pagos">,
  updates: Partial<EventoGuardado>,
): string | null {
  const cuotasNuevas = updates.planDeCuotas?.cuotas
  if (!cuotasNuevas) return null
  const pagosSiguientes: PagoEvento[] = updates.pagos ?? actual.pagos ?? []
  const pagosNuevos = (updates.pagos ?? []).filter((p) => !(actual.pagos ?? []).some((a) => a.id === p.id))
  for (const cuota of cuotasNuevas) {
    const antes = actual.planDeCuotas?.cuotas?.find((c) => c.numero === cuota.numero)
    const ajusteNuevo = cuota.ajusteCobro
    if (ajusteNuevo !== undefined && (typeof ajusteNuevo !== "number" || !Number.isFinite(ajusteNuevo))) {
      return "El ajuste del monto a cobrar no es válido."
    }
    if (Math.abs(num(ajusteNuevo) - num(antes?.ajusteCobro)) <= TOLERANCIA) continue
    if (num(ajusteNuevo) === 0) {
      // Solo se borra cuando la cuota se libera (se anularon todos sus pagos).
      if (pagosSiguientes.some((p) => numeroCuotaPago(p) === cuota.numero)) {
        return "No se puede cambiar el monto a cobrar de una cuota que ya tiene pagos."
      }
      continue
    }
    if (num(antes?.montoPagadoNeto) > 0) return "No se puede cambiar el monto a cobrar de una cuota que ya tiene pagos."
    const pago = pagosNuevos.find((p) => numeroCuotaPago(p) === cuota.numero)
    if (!pago || Math.abs(num(pago.ajusteCuota) - num(ajusteNuevo)) > TOLERANCIA) {
      return "El ajuste del pago no coincide con el de la cuota."
    }
    if (cuota.montoCuota + num(ajusteNuevo) <= 0) return "El monto a cobrar de la cuota tiene que ser mayor a cero."
  }
  return null
}

/**
 * Pregunta al abrir Cobrar cuota: si la cuota que hace de base del IPC se
 * cobró con un ajuste, ¿el sugerido se calcula sobre su cifra oficial o
 * sobre lo que se cobró? Devuelve null si no hay nada que preguntar.
 */
export function preguntaBaseCobrada(
  evento: EventoIPC,
  historial: HistorialIPCEntry[],
  fecha?: string,
): { numero: number; oficial: number; cobrado: number } | null {
  const resultado = calcularIPCPeriodo(evento, historial, fecha)
  if (resultado.estado !== "listo") return null
  const numero = resultado.calculo.cuotaOrigen
  if (!numero || resultado.calculo.origen !== "pago") return null
  const cuota = evento.planDeCuotas?.cuotas?.find((c) => c.numero === numero)
  const ajuste = num(cuota?.ajusteCobro)
  if (!cuota || Math.abs(ajuste) <= TOLERANCIA || cuota.montoCuota !== resultado.calculo.base) return null
  return { numero, oficial: cuota.montoCuota, cobrado: Math.round((cuota.montoCuota + ajuste) * 100) / 100 }
}

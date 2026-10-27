// Saldo a favor del cliente (pedido del dueño, 26/10/2026): en Cobrar cuota
// se puede registrar CUALQUIER monto, incluso más de lo que corresponde. Lo
// que sobra después de completar la cuota queda "a favor" y se descuenta
// solo en la próxima cuota que se cobre.
//
// Reglas, para que el mes siguiente no se rompa nada:
// - La cifra oficial de la cuota (montoCuota, la que usa el IPC como base
//   del mes siguiente) NO cambia: el excedente nunca se suma a la cuota.
// - La plata entra entera a las cajas el día que se recibe (pago.monto es
//   siempre efectivo recibido). Cuando después se usa el saldo a favor, a
//   las cajas solo entra lo que se paga en efectivo ese día.
// - El saldo a favor no se guarda aparte: sale de los pagos vigentes
//   (suma de saldoAFavor menos suma de creditoAplicado). Anular un pago lo
//   recalcula solo; por eso no se puede anular un pago cuyo excedente ya se
//   usó en otra cuota (quedaría negativo).
// - Cuenta del pago: monto = montoCuotaNeto + montoMora + saldoAFavor - creditoAplicado.
import type { EventoGuardado, PagoEvento } from "./store"
import { saldoRestanteCuota } from "./estado-cuotas"

const TOLERANCIA = 0.01
const redondear = (n: number) => Math.round(n * 100) / 100
const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0)

/** Saldo a favor disponible hoy: lo que sobró en pagos vigentes menos lo ya usado. */
export function creditoDisponible(pagos: PagoEvento[] | undefined): number {
  const total = (pagos ?? []).reduce((s, p) => s + num(p.saldoAFavor) - num(p.creditoAplicado), 0)
  return redondear(total)
}

export interface RepartoPago {
  /** Lo que se acredita contra la cuota (sin mora). */
  neto: number
  /** Parte del saldo a favor que se usa en esta cuota. */
  creditoAplicado: number
  /** Lo que sobra y queda a favor para la cuota siguiente. */
  saldoAFavor: number
}

/**
 * Cómo se reparte un pago: primero se usa el saldo a favor (todo lo que
 * entre en la cuota), después el efectivo paga la mora y la cuota, y lo que
 * sobre queda a favor. Si no hay cuota siguiente, no puede sobrar nada.
 */
export function repartirPago(params: {
  /** Efectivo que se cobra ahora (incluye la mora). */
  monto: number
  mora: number
  /** creditoDisponible() del evento antes de este pago. */
  credito: number
  /** Lo que falta de la cuota (saldoRestanteCuota). */
  saldoCuota: number
  hayCuotaSiguiente: boolean
}): RepartoPago | { error: string } {
  const monto = num(params.monto), mora = num(params.mora), saldoCuota = Math.max(0, num(params.saldoCuota))
  if (monto < mora - TOLERANCIA) return { error: "El monto tiene que cubrir al menos la mora." }
  const creditoAplicado = redondear(Math.max(0, Math.min(num(params.credito), saldoCuota)))
  const paraCuota = redondear(monto - mora + creditoAplicado)
  const neto = redondear(Math.min(paraCuota, saldoCuota))
  const saldoAFavor = redondear(Math.max(0, paraCuota - saldoCuota))
  if (neto <= 0) return { error: "El monto tiene que cubrir algo de la cuota." }
  if (saldoAFavor > 0 && !params.hayCuotaSiguiente) {
    return { error: "Es la última cuota: el monto no puede superar lo que falta pagar." }
  }
  return { neto, creditoAplicado, saldoAFavor }
}

/** ¿Queda alguna cuota sin pagar después de la indicada? (donde va el excedente) */
export function hayCuotaSiguiente(plan: EventoGuardado["planDeCuotas"] | undefined, numero: number): boolean {
  return (plan?.cuotas ?? []).some((c) => c.numero > numero && !c.pagada)
}

/**
 * Control del servidor (PATCH /api/eventos/[id]) para TODOS los eventos, con
 * IPC o sin IPC. Devuelve el motivo del rechazo o null.
 * - Nunca puede quedar saldo a favor negativo (cubre la anulación de un pago
 *   cuyo excedente ya se usó).
 * - Un pago nuevo tiene que usar todo el saldo a favor que entra en la cuota,
 *   solo puede dejar excedente si completa la cuota y hay otra después, y su
 *   monto tiene que cerrar con la cuenta de arriba.
 * - El botón rápido de Caja Eventos (marca una cuota cobrada sin pago) no
 *   sabe descontar el saldo a favor: con saldo a favor se cobra desde Cobrar cuota.
 */
export function validarSaldoAFavor(
  actual: Pick<EventoGuardado, "planDeCuotas" | "pagos">,
  updates: Partial<EventoGuardado>,
): string | null {
  if (!("pagos" in updates) && !("planDeCuotas" in updates)) return null
  const pagosSiguientes = updates.pagos ?? actual.pagos ?? []
  const pagosNuevos = (updates.pagos ?? []).filter((p) => !(actual.pagos ?? []).some((a) => a.id === p.id))
  for (const p of pagosNuevos) {
    for (const campo of [p.saldoAFavor, p.creditoAplicado]) {
      if (campo !== undefined && (typeof campo !== "number" || !Number.isFinite(campo) || campo < 0)) {
        return "El saldo a favor del pago no es válido."
      }
    }
  }
  if (creditoDisponible(pagosSiguientes) < -TOLERANCIA) {
    return "El excedente de ese pago ya se usó en otra cuota: anulá primero el pago que lo usó."
  }
  const disponibleAntes = creditoDisponible(actual.pagos)
  const plan = updates.planDeCuotas ?? actual.planDeCuotas

  if (pagosNuevos.length === 0) {
    if (disponibleAntes > TOLERANCIA && updates.planDeCuotas) {
      const antes = new Set([...(actual.planDeCuotas?.cuotasPagadas ?? []), ...(actual.planDeCuotas?.cuotas ?? []).filter((c) => c.pagada).map((c) => c.numero)])
      const marcaNueva = [...(updates.planDeCuotas.cuotasPagadas ?? []), ...(updates.planDeCuotas.cuotas ?? []).filter((c) => c.pagada).map((c) => c.numero)]
        .some((n) => !antes.has(n))
      if (marcaNueva) return "Este evento tiene saldo a favor: cobrá la cuota desde Cobrar cuota para que se descuente."
    }
    return null
  }

  const conSaldo = pagosNuevos.filter((p) => num(p.saldoAFavor) > 0 || num(p.creditoAplicado) > 0)
  if (pagosNuevos.length > 1) return conSaldo.length || disponibleAntes > TOLERANCIA ? "Registrá un pago por operación." : null
  const pago = pagosNuevos[0]
  const numero = pago.numeroCuota
  if (!numero || !plan) {
    return conSaldo.length || disponibleAntes > TOLERANCIA ? "Con saldo a favor, el pago tiene que indicar a qué cuota corresponde." : null
  }
  const cuotaNueva = plan.cuotas?.find((c) => c.numero === numero)
  if (!cuotaNueva) return conSaldo.length ? "Cuota inválida." : null
  const cuotaAntes = actual.planDeCuotas?.cuotas?.find((c) => c.numero === numero)
  const saldoCuota = saldoRestanteCuota({ montoCuota: cuotaNueva.montoCuota, montoPagadoNeto: cuotaAntes?.montoPagadoNeto ?? 0, ajusteCobro: cuotaNueva.ajusteCobro })

  const credito = num(pago.creditoAplicado)
  const esperado = redondear(Math.max(0, Math.min(disponibleAntes, saldoCuota)))
  if (Math.abs(credito - esperado) > TOLERANCIA) {
    return "El saldo a favor cambió. Cerrá el formulario y volvé a abrirlo antes de cobrar."
  }
  const excedente = num(pago.saldoAFavor)
  const neto = num(pago.montoCuotaNeto)
  if (excedente > 0) {
    if (Math.abs(neto - saldoCuota) > TOLERANCIA) return "Solo puede sobrar plata si el pago completa la cuota."
    if (!hayCuotaSiguiente(plan, numero)) return "Es la última cuota: el monto no puede superar lo que falta pagar."
  }
  if (credito > 0 || excedente > 0) {
    const cuenta = redondear(neto + num(pago.montoMora) + excedente - credito)
    if (Math.abs(num(pago.monto) - cuenta) > TOLERANCIA) return "El importe debe separar cuota, mora y saldo a favor."
  }
  return null
}

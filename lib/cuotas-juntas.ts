// Qué hacer cuando el cliente entrega más de lo que se cobra (pedido del
// dueño, 27/10/2026). En Cobrar cuota se elige entre:
// - "vuelto": se cobra lo que corresponde y se devuelve el resto;
// - "favor": lo que sobra queda a favor y se descuenta de la cuota siguiente
//   (lib/saldo-a-favor.ts);
// - "juntas": con lo que sobra se pagan además una o más cuotas enteras.
//
// Las cuotas juntas son cobros comunes, uno por cuota (el servidor acepta
// un pago por operación), armados con la misma cuenta que usa el chat para
// cobrar (lib/chat-ia-cobro.ts): la cuota corriente, completa, con su IPC y
// su recargo por atraso si lo tiene. Lo que sobra después de la última queda
// a favor si hay otra cuota; si no, es vuelto.
import type { EventoGuardado, HistorialIPCEntry } from "./store"
import { armarCobroDesdePropuesta, armarPropuestaCobro, opcionesCobroChat, type CobroArmadoChat } from "./chat-ia-cobro"
import { creditoDisponible, hayCuotaSiguiente } from "./saldo-a-favor"

export type DestinoExcedente = "vuelto" | "favor" | "juntas"

const redondear = (n: number) => Math.round(n * 100) / 100

export interface CuotaJunta {
  numeroCuota: number
  /** Lo que se paga por esa cuota: su valor más el recargo por atraso, si tiene. */
  monto: number
  recargo: number
}

export interface CobroCuotaJunta extends CuotaJunta {
  cobro: CobroArmadoChat
}

/**
 * Arma el cobro completo de la cuota que toca ahora en el evento (la
 * corriente), como un cobro más. No usa saldo a favor: si el evento tiene,
 * no se arma (las cuotas juntas se ofrecen solo con el saldo ya usado).
 */
export function armarCuotaJunta(
  evento: EventoGuardado,
  historial: HistorialIPCEntry[],
  hoy: string,
  datos: { id: string; pagadoPor: string; recibidoPor: string; nota?: string },
): { ok: true; cuota: CobroCuotaJunta } | { ok: false; motivo: string } {
  if (creditoDisponible(evento.pagos) > 0.005) return { ok: false, motivo: "El evento tiene saldo a favor sin usar." }
  const opciones = opcionesCobroChat(evento, historial, hoy)
  if (!opciones.ok) return opciones
  const corriente = opciones.opciones.find((o) => o.estado === "pendiente")
  if (!corriente) return { ok: false, motivo: "No queda otra cuota para cobrar." }
  if (corriente.noSePuede) return { ok: false, motivo: corriente.noSePuede }
  const propuesta = armarPropuestaCobro(
    evento,
    historial,
    hoy,
    {
      numeroCuota: corriente.numeroCuota,
      cobrarRecargo: true,
      pagaCompleto: true,
      pagadoPor: datos.pagadoPor,
      recibidoPor: datos.recibidoPor,
    },
    datos.id,
  )
  if (!propuesta.ok) return propuesta
  const armado = armarCobroDesdePropuesta(evento, historial, hoy, propuesta.propuesta)
  if (!armado.ok) return armado
  const cobro = armado.cobro
  if (datos.nota) {
    const pago = { ...cobro.pago, notas: `${cobro.pago.notas ?? ""} ${datos.nota}`.trim() }
    cobro.pago = pago
    cobro.pagos = [...cobro.pagos.slice(0, -1), pago]
  }
  return {
    ok: true,
    cuota: { numeroCuota: corriente.numeroCuota, monto: propuesta.propuesta.monto, recargo: propuesta.propuesta.recargo, cobro },
  }
}

/** El evento como queda después de guardar el cobro. */
export function eventoConCobro(evento: EventoGuardado, cobro: CobroArmadoChat): EventoGuardado {
  return { ...evento, pagos: cobro.pagos, planDeCuotas: cobro.planDeCuotas }
}

/**
 * Cuántas cuotas enteras más alcanzan con lo que sobra, en orden, a partir
 * del evento ya con la cuota de hoy cobrada. Cada elemento es una opción:
 * pagar hasta esa cuota inclusive.
 */
export function cuotasQueAlcanzan(
  eventoTrasCobro: EventoGuardado,
  historial: HistorialIPCEntry[],
  hoy: string,
  sobrante: number,
  maximo = 12,
): CuotaJunta[] {
  const lista: CuotaJunta[] = []
  let evento = eventoTrasCobro
  let usado = 0
  for (let i = 0; i < maximo; i++) {
    const r = armarCuotaJunta(evento, historial, hoy, { id: `vista-previa-${i}`, pagadoPor: "Vista previa", recibidoPor: "Vista previa" })
    if (!r.ok) break
    if (usado + r.cuota.monto > sobrante + 0.005) break
    usado = redondear(usado + r.cuota.monto)
    lista.push({ numeroCuota: r.cuota.numeroCuota, monto: r.cuota.monto, recargo: r.cuota.recargo })
    evento = eventoConCobro(evento, r.cuota.cobro)
  }
  return lista
}

/**
 * Lo que sobra después de la última cuota junta: queda a favor en ese pago
 * si hay otra cuota después; si no, se registra como vuelto.
 */
export function cerrarUltimaCuotaJunta(cobro: CobroArmadoChat, resto: number, numeroCuota: number): CobroArmadoChat {
  const sobra = redondear(Math.max(0, resto))
  if (sobra <= 0) return cobro
  const pago = hayCuotaSiguiente(cobro.planDeCuotas, numeroCuota)
    ? { ...cobro.pago, monto: redondear(cobro.pago.monto + sobra), saldoAFavor: sobra }
    : { ...cobro.pago, montoRecibido: redondear(cobro.pago.monto + sobra), vuelto: sobra }
  return { ...cobro, pago, pagos: [...cobro.pagos.slice(0, -1), pago] }
}

/** Texto de cada opción: "la cuota 4" / "las cuotas 4 y 5" / "las cuotas 4, 5 y 6". */
export function textoCuotas(numeros: number[]): string {
  if (numeros.length === 1) return `la cuota ${numeros[0]}`
  return `las cuotas ${numeros.slice(0, -1).join(", ")} y ${numeros[numeros.length - 1]}`
}

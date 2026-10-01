// Servicios que se pagan como sueldo (columna servicios.se_paga_como_sueldo).
//
// Un servicio así (hoy solo "DJ, SONIDO, LUCES Y HUMO") no se le paga a un
// proveedor con seña y saldo: se le paga a una persona, de una sola vez, el
// día del evento. En Caja Eventos aparece en "Sueldos" como un único egreso.
//
// Solo cambia CÓMO se muestra y se paga: el monto es el mismo que hoy sumarían
// la seña y el saldo (calcularSeñaSaldoServicio, en vivo), y el costo total
// del servicio —que es lo que usa el reparto entre cajas— no se toca.

import { calcularSeñaSaldoServicio, type AppState, type Servicio, type ServicioEvento } from "./store"

type EstadoPago = NonNullable<ServicioEvento["estadoPago"]>

function estadoPagoDe(srv: ServicioEvento): EstadoPago {
  return srv.estadoPago ?? (srv.pagado ? "pagado_total" : "sin_seña")
}

/**
 * ¿Este servicio del evento se paga como sueldo?
 * - Si ya se pagó como sueldo, sigue siéndolo (aunque después se apague la
 *   marca en el catálogo): así se puede ver y revertir ese pago.
 * - Si ya se pagó completo por el camino de siempre (saldo), queda como estaba.
 * - Si no, depende de la marca del catálogo.
 */
export function sePagaComoSueldo(srv: ServicioEvento, catalogo: Pick<Servicio, "id" | "sePagaComoSueldo">[]): boolean {
  if (srv.pagoSueldo) return true
  if (estadoPagoDe(srv) === "pagado_total") return false
  return catalogo.find((s) => s.id === srv.servicioId)?.sePagaComoSueldo === true
}

/**
 * Monto del sueldo. Ya pagado: lo que se pagó (histórico). Pendiente: lo que
 * hoy falta pagar con la misma cuenta de seña + saldo — si la seña ya se había
 * pagado por el camino viejo, solo el saldo, para no pagarla dos veces.
 */
export function montoSueldoServicio(srv: ServicioEvento, state: Pick<AppState, "servicios">): number {
  if (srv.pagoSueldo) return srv.pagoSueldo.monto
  const { montoSeña, saldoPendiente } = calcularSeñaSaldoServicio(srv, state)
  return estadoPagoDe(srv) === "sin_seña" ? montoSeña + saldoPendiente : saldoPendiente
}

/**
 * Servicio del evento marcado como pagado como sueldo. Queda como un saldo
 * pagado (pagado / pagado_total, así lo leen la lista de eventos y los
 * resúmenes) y guarda el monto pagado y el estado previo para revertir. Si la
 * seña no se había pagado, la parte de seña queda en 0: se pagó todo junto.
 */
export function pagarServicioComoSueldo(srv: ServicioEvento, monto: number, fecha: string): ServicioEvento {
  const estadoPrevio = estadoPagoDe(srv)
  return {
    ...srv,
    pagado: true,
    estadoPago: "pagado_total",
    saldoPendiente: 0,
    fechaPagoSaldo: fecha,
    montoSeña: estadoPrevio === "sin_seña" ? 0 : srv.montoSeña,
    pagoSueldo: {
      monto,
      fecha,
      // Tal cual estaba guardado (puede no estar): revertir lo deja idéntico.
      estadoPagoPrevio: srv.estadoPago,
      montoSeñaPrevio: srv.montoSeña,
      saldoPendientePrevio: srv.saldoPendiente,
      pagadoPrevio: srv.pagado,
      fechaPagoSaldoPrevio: srv.fechaPagoSaldo,
    },
  }
}

/**
 * ¿La seña de este servicio se pagó por separado, por el camino viejo, antes
 * de pagarse como sueldo? (Costos del evento la sigue mostrando como pagada.)
 */
export function señaPagadaPorSeparado(srv: ServicioEvento): boolean {
  if (!srv.pagoSueldo) return estadoPagoDe(srv) !== "sin_seña"
  const { estadoPagoPrevio, pagadoPrevio } = srv.pagoSueldo
  return (estadoPagoPrevio ?? (pagadoPrevio ? "pagado_total" : "sin_seña")) !== "sin_seña"
}

/** Deshace pagarServicioComoSueldo: deja el servicio exactamente como estaba. */
export function revertirServicioPagadoComoSueldo(srv: ServicioEvento): ServicioEvento {
  if (!srv.pagoSueldo) return srv
  const { pagoSueldo, ...resto } = srv
  return {
    ...resto,
    fechaPagoSaldo: pagoSueldo.fechaPagoSaldoPrevio,
    pagado: pagoSueldo.pagadoPrevio,
    estadoPago: pagoSueldo.estadoPagoPrevio,
    montoSeña: pagoSueldo.montoSeñaPrevio,
    saldoPendiente: pagoSueldo.saldoPendientePrevio,
  }
}

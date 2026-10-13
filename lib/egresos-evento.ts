// Egresos de Caja Eventos de un evento (pagos de menú, barra, señas, saldos y
// sueldos), buscados por el principio del concepto.
//
// El concepto termina con el nombre del evento, pero no todas las pantallas lo
// escriben igual: Caja Eventos usa el nombre de los festejados primero
// (nombrePareja) y Costos del evento usaba el nombre del evento primero. Por
// eso se busca por evento + principio del concepto ("Pago saldo Torta - "),
// sin depender del nombre que venga después del guion.
//
// Sin imports a propósito: lo usan lib/store.ts y lib/costo-evento.ts.

export interface MovimientoEgresoEvento {
  id: string
  tipo: string
  concepto: string
  monto: number
  fecha: string
  eventoId?: string
  cajaDestino?: string
}

/** Nombre del evento en los conceptos de caja (mismo criterio que Caja Eventos). */
export function nombreEventoEnCaja(evento: { nombrePareja?: string; nombre?: string; tipoEvento?: string }): string {
  return evento.nombrePareja || evento.nombre || evento.tipoEvento || "Evento"
}

/**
 * Egreso más reciente de Caja Eventos de este evento cuyo concepto empieza con
 * `prefijo` (por ejemplo "Pago menú - "). El prefijo tiene que terminar en
 * " - " para que "Pago saldo Torta - " no encuentre "Pago saldo Torta grande - ".
 */
export function ultimoEgresoEvento<M extends MovimientoEgresoEvento>(
  movimientos: M[] | undefined | null,
  eventoId: string,
  prefijo: string,
): M | undefined {
  // La lista llega de la base de la más nueva a la más vieja y los pagos de
  // esta sesión se agregan al final: se elige por fecha, no por posición.
  let elegido: M | undefined
  for (const m of movimientos ?? []) {
    if (
      m.tipo === "egreso" &&
      m.cajaDestino === "caja_eventos" &&
      m.eventoId === eventoId &&
      typeof m.concepto === "string" &&
      m.concepto.startsWith(prefijo) &&
      (!elegido || (m.fecha || "") >= (elegido.fecha || ""))
    ) {
      elegido = m
    }
  }
  return elegido
}

export const prefijoPagoMenu = "Pago menú - "
export const prefijoPagoBarra = "Pago barra - "
export const prefijoPagoSeña = (servicio: string) => `Pago seña ${servicio} - `
export const prefijoPagoSaldo = (servicio: string) => `Pago saldo ${servicio} - `
export const prefijoPagoSueldoPersonal = (nombre: string, funcion: string) => `Pago sueldo ${nombre} (${funcion}) - `

// Costo de un evento para Caja Eventos.
//
// Regla del negocio: el costo de un evento para Caja Eventos es EXACTAMENTE lo
// que muestra "Costos del evento" (/eventos/costos): cocina + barra +
// servicios + personal. Todo lo demás (ej. el costo operativo / gastos fijos)
// es de Caja Jazmines.
//
// Es el cálculo que antes vivía dentro de app/eventos/costos/page.tsx, movido
// tal cual para que esa pantalla y el panel "Gastos del mes por evento" de
// Caja Eventos usen la misma cuenta:
// - cocina y barra en vivo con los precios actuales del almacén;
// - servicios en vivo desde el catálogo, pero lo YA PAGADO conserva el monto
//   real que movió la caja;
// - personal en vivo desde el roster (salvo pagado o monto personalizado);
// - si el evento está archivado, los datos congelados al archivarlo.
//
// NO es el costo que usa el reparto entre cajas (lib/cobrar-cuota.ts).

import {
  calcularComprasBarras,
  calcularComprasSegmentadas,
  calcularMontoPersonalDelEvento,
  calcularSeñaSaldoServicio,
  type AppState,
  type ArchivoCongelado,
  type EventoGuardado,
  type PersonalDelEvento,
  type ServicioEvento,
} from "./store"
import { montoSueldoServicio, sePagaComoSueldo, señaPagadaPorSeparado } from "./servicio-sueldo"

export type DatosCostoEvento = Pick<
  AppState,
  "recetas" | "insumos" | "cocteles" | "insumosBarra" | "servicios" | "personal" | "movimientosCaja"
>

export interface ServicioCostoEvento {
  srv: ServicioEvento
  senaPagada: boolean
  saldoPagado: boolean
  montoSeña: number
  saldo: number
  /** Se paga como sueldo (lib/servicio-sueldo.ts): un único pago, no seña y saldo. */
  comoSueldo: boolean
}

export interface CostoEventoCajaEventos {
  /** Foto congelada válida si el evento está archivado (si no, undefined). */
  congelado: ArchivoCongelado | undefined
  comprasCocina: ArchivoCongelado["comprasCocina"]
  comprasBarra: ArchivoCongelado["comprasBarra"]
  costoCocina: number
  costoBarra: number
  /** Personal con el sueldo resuelto (en vivo o congelado), sin los de monto 0. */
  personal: PersonalDelEvento[]
  serviciosCalc: ServicioCostoEvento[]
  totalServicios: number
  totalPersonal: number
  pagadoCocina: number
  pagadoBarra: number
  pagadoServicios: number
  pagadoPersonal: number
  /** Costo total del evento para Caja Eventos: cocina + barra + servicios + personal. */
  costoTotalEvento: number
  totalCubierto: number
}

/**
 * Foto congelada del evento si está archivado. Una foto sin ningún dato se
 * considera inválida (pudo generarse antes de que cargaran los catálogos) y
 * se ignora para no mostrar todo en cero.
 */
export function congeladoValido(evento: EventoGuardado): ArchivoCongelado | undefined {
  const raw = evento.estado === "completado" ? evento.costosCalculados?.archivoCongelado : undefined
  return raw &&
    ((raw.comprasCocina?.length ?? 0) > 0 ||
      (raw.comprasBarra?.length ?? 0) > 0 ||
      (raw.personal?.length ?? 0) > 0 ||
      (raw.serviciosCalc?.length ?? 0) > 0)
    ? raw
    : undefined
}

export function calcularCostoEventoCajaEventos(evento: EventoGuardado, datos: DatosCostoEvento): CostoEventoCajaEventos {
  const congelado = congeladoValido(evento)

  const comprasCocina = congelado?.comprasCocina ?? calcularComprasSegmentadas(evento, datos.recetas || [], datos.insumos || [])
  const comprasBarra = congelado?.comprasBarra ?? calcularComprasBarras(evento, datos.cocteles || [], datos.insumosBarra || [])
  const costoCocina = comprasCocina.reduce((s, c) => s + c.costoMateriaPrima, 0)
  const costoBarra = comprasBarra.reduce((s, c) => s + c.costoMateriaPrima, 0)

  // Sueldos EN VIVO desde el roster (Finanzas → Personal): siguen la tarifa
  // vigente salvo que estén pagados o con monto personalizado por evento.
  // Si el evento está archivado, se usan los sueldos congelados al archivar.
  const personal =
    congelado?.personal ??
    (evento.personalEvento || [])
      .map((pe) => ({ ...pe, monto: calcularMontoPersonalDelEvento(pe, datos.personal) }))
      .filter((pe) => (pe.monto || 0) > 0)

  // Monto de saldo pagado: se recupera del movimiento registrado en Caja Eventos
  const montoSaldoPagado = (nombreServicio: string): number => {
    const mov = [...(datos.movimientosCaja ?? [])]
      .reverse()
      .find(
        (m) =>
          m.tipo === "egreso" &&
          m.cajaDestino === "caja_eventos" &&
          m.eventoId === evento.id &&
          m.concepto === `Pago saldo ${nombreServicio} - ${evento.nombre || evento.nombrePareja || "Evento sin nombre"}`,
      )
    return mov?.monto || 0
  }

  // Cada servicio contratado recalcula su seña y saldo EN VIVO a partir del
  // catálogo global: si en Finanzas → Servicios se edita el costo o el % de
  // seña, el costo del servicio se actualiza al instante. Las porciones YA
  // PAGADAS conservan el monto real que movió la caja (histórico); solo las
  // pendientes reflejan el precio vigente. Si el servicio fue eliminado del
  // catálogo, se usa el valor guardado en el contrato como respaldo.
  const serviciosCalc: ServicioCostoEvento[] = (evento.servicios || []).map((srv) => {
    const senaPagada =
      srv.estadoPago === "señado" || srv.estadoPago === "saldo_pendiente" || srv.estadoPago === "pagado_total"
    const saldoPagado = srv.estadoPago === "pagado_total" || srv.pagado === true

    // Cálculo centralizado en vivo (mismo criterio que Caja Eventos, Cashflow y Balance).
    const { montoSeña: montoSeñaCalc, saldoPendiente: saldoCalc } = calcularSeñaSaldoServicio(srv, {
      servicios: datos.servicios ?? [],
    })

    // Si el evento está archivado, usar los montos congelados al archivar.
    const frozen = congelado?.serviciosCalc?.find((f) => f.servicioId === srv.servicioId)

    // Servicio que se paga como sueldo (lib/servicio-sueldo.ts): un único pago
    // desde Caja Eventos → Sueldos, por el mismo monto que muestra la caja. Si
    // la seña ya se había pagado por el camino viejo, se sigue mostrando.
    if (!frozen && sePagaComoSueldo(srv, datos.servicios ?? [])) {
      const señaViejaPagada = señaPagadaPorSeparado(srv)
      return {
        srv,
        senaPagada: señaViejaPagada,
        saldoPagado: !!srv.pagoSueldo,
        montoSeña: señaViejaPagada ? montoSeñaCalc : 0,
        saldo: montoSueldoServicio(srv, { servicios: datos.servicios ?? [] }),
        comoSueldo: true,
      }
    }

    // Preservar lo ya pagado; recalcular en vivo lo pendiente.
    const montoSeña = frozen ? frozen.montoSeña : montoSeñaCalc
    const saldo = frozen ? frozen.saldo : saldoPagado ? montoSaldoPagado(srv.nombre) : saldoCalc

    return { srv, senaPagada, saldoPagado, montoSeña, saldo, comoSueldo: false }
  })

  const totalServicios = serviciosCalc.reduce((s, c) => s + c.montoSeña + c.saldo, 0)
  const pagadoServicios = serviciosCalc.reduce(
    (s, c) => s + (c.senaPagada ? c.montoSeña : 0) + (c.saldoPagado ? c.saldo : 0),
    0,
  )
  const totalPersonal = personal.reduce((s, pe) => s + (pe.monto || 0), 0)
  const pagadoPersonal = personal.filter((pe) => pe.pagado).reduce((s, pe) => s + (pe.monto || 0), 0)
  const pagadoCocina = evento.cocinaPagada ? costoCocina : 0
  const pagadoBarra = evento.barraPagada ? costoBarra : 0

  return {
    congelado,
    comprasCocina,
    comprasBarra,
    costoCocina,
    costoBarra,
    personal,
    serviciosCalc,
    totalServicios,
    totalPersonal,
    pagadoCocina,
    pagadoBarra,
    pagadoServicios,
    pagadoPersonal,
    costoTotalEvento: costoCocina + costoBarra + totalServicios + totalPersonal,
    totalCubierto: pagadoCocina + pagadoBarra + pagadoServicios + pagadoPersonal,
  }
}

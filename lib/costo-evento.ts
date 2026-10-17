// Costo de un evento para Caja Eventos.
//
// Regla del negocio: el costo de un evento para Caja Eventos es EXACTAMENTE lo
// que muestra "Costos del evento" (/eventos/costos): cocina + barra +
// servicios + personal. Todo lo demás (ej. el costo operativo / gastos fijos)
// es de Caja Jazmines.
//
// Es el cálculo de la pantalla app/eventos/costos/page.tsx:
// - cocina y barra en vivo con los precios actuales del almacén; ya pagadas,
//   cuentan lo que salió de Caja Eventos (el precio de hoy se muestra aparte);
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
import { pagosMenuProveedor, pendienteMenuSinProveedoresPagos, totalPagosMenuProveedor } from "./pago-menu-proveedor"
import {
  prefijoPagoBarra,
  prefijoPagoMenu,
  prefijoPagoSaldo,
  prefijoPagoSeña,
  ultimoEgresoEvento,
} from "./egresos-evento"

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
  /** Seña marcada como pagada sin un egreso "Pago seña …" en Caja Eventos. */
  señaSinEgreso: boolean
  /** Saldo marcado como pagado sin un egreso "Pago saldo …" en Caja Eventos. */
  saldoSinEgreso: boolean
}

export interface CostoEventoCajaEventos {
  /** Foto congelada válida si el evento está archivado (si no, undefined). */
  congelado: ArchivoCongelado | undefined
  comprasCocina: ArchivoCongelado["comprasCocina"]
  comprasBarra: ArchivoCongelado["comprasBarra"]
  /** Costo de cocina: lo pagado si ya se pagó; si no, a precios de hoy. */
  costoCocina: number
  costoBarra: number
  /** Cocina y barra a precios de hoy (la suma de la lista de insumos). */
  costoCocinaHoy: number
  costoBarraHoy: number
  /** Fecha (ISO) del egreso con que se pagó la cocina o la barra, si se encontró. */
  fechaPagoCocina?: string
  fechaPagoBarra?: string
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
  const costoCocinaHoy = comprasCocina.reduce((s, c) => s + c.costoMateriaPrima, 0)
  const costoBarraHoy = comprasBarra.reduce((s, c) => s + c.costoMateriaPrima, 0)

  // Cocina y barra ya pagadas: cuenta lo que salió de Caja Eventos (como los
  // servicios y el personal pagados), no el precio de hoy de los insumos. Sin
  // egreso encontrado (datos viejos), sigue el precio de hoy. Archivado: lo
  // guardado al archivar (las fotos viejas no lo tienen y quedan como antes).
  const egresoMenu = evento.cocinaPagada ? ultimoEgresoEvento(datos.movimientosCaja, evento.id, prefijoPagoMenu) : undefined
  const egresoBarra = evento.barraPagada ? ultimoEgresoEvento(datos.movimientosCaja, evento.id, prefijoPagoBarra) : undefined
  // Menú pagado en parte, por proveedor (lib/pago-menu-proveedor.ts): lo
  // pagado a cada proveedor queda fijo y el resto va al precio de hoy. Si
  // después se pagó el resto entero ("Pago menú - "), se suman los dos.
  const pagosProv: ReturnType<typeof pagosMenuProveedor> = congelado ? new Map() : pagosMenuProveedor(datos.movimientosCaja, evento.id)
  const pagadoProveedores = totalPagosMenuProveedor(pagosProv)
  const costoCocina = congelado
    ? (congelado.montoPagadoCocina ?? costoCocinaHoy)
    : pagosProv.size === 0
      ? (egresoMenu?.monto ?? costoCocinaHoy)
      : pagadoProveedores + (egresoMenu?.monto ?? pendienteMenuSinProveedoresPagos(comprasCocina, pagosProv))
  const costoBarra = congelado
    ? (congelado.montoPagadoBarra ?? costoBarraHoy)
    : (egresoBarra?.monto ?? costoBarraHoy)

  // Sueldos EN VIVO desde el roster (Finanzas → Personal): siguen la tarifa
  // vigente salvo que estén pagados o con monto personalizado por evento.
  // Si el evento está archivado, se usan los sueldos congelados al archivar.
  const personal =
    congelado?.personal ??
    (evento.personalEvento || [])
      .map((pe) => ({ ...pe, monto: calcularMontoPersonalDelEvento(pe, datos.personal) }))
      .filter((pe) => (pe.monto || 0) > 0)

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
    const {
      costoTotal,
      montoSeña: montoSeñaCalc,
      saldoPendiente: saldoCalc,
    } = calcularSeñaSaldoServicio(srv, { servicios: datos.servicios ?? [] })
    const egresoSeña = ultimoEgresoEvento(datos.movimientosCaja, evento.id, prefijoPagoSeña(srv.nombre))
    const egresoSaldo = ultimoEgresoEvento(datos.movimientosCaja, evento.id, prefijoPagoSaldo(srv.nombre))

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
        señaSinEgreso: señaViejaPagada && !egresoSeña,
        saldoSinEgreso: false,
      }
    }

    // Preservar lo ya pagado; recalcular en vivo lo pendiente. Un saldo pagado
    // sin egreso en la caja (datos viejos) no se cuenta como $0: se toma lo que
    // falta para completar el costo del servicio, así el total no se achica.
    const montoSeña = frozen ? frozen.montoSeña : montoSeñaCalc
    const saldo = frozen
      ? frozen.saldo
      : saldoPagado
        ? (egresoSaldo?.monto ?? Math.max(0, costoTotal - montoSeñaCalc))
        : saldoCalc

    return {
      srv,
      senaPagada,
      saldoPagado,
      montoSeña,
      saldo,
      comoSueldo: false,
      señaSinEgreso: senaPagada && montoSeña > 0 && !egresoSeña,
      saldoSinEgreso: saldoPagado && saldo > 0 && !egresoSaldo,
    }
  })

  const totalServicios = serviciosCalc.reduce((s, c) => s + c.montoSeña + c.saldo, 0)
  const pagadoServicios = serviciosCalc.reduce(
    (s, c) => s + (c.senaPagada ? c.montoSeña : 0) + (c.saldoPagado ? c.saldo : 0),
    0,
  )
  const totalPersonal = personal.reduce((s, pe) => s + (pe.monto || 0), 0)
  const pagadoPersonal = personal.filter((pe) => pe.pagado).reduce((s, pe) => s + (pe.monto || 0), 0)
  const pagadoCocina = evento.cocinaPagada ? costoCocina : pagadoProveedores
  const pagadoBarra = evento.barraPagada ? costoBarra : 0

  return {
    congelado,
    comprasCocina,
    comprasBarra,
    costoCocina,
    costoBarra,
    costoCocinaHoy,
    costoBarraHoy,
    fechaPagoCocina: congelado
      ? undefined
      : (egresoMenu?.fecha ?? (evento.cocinaPagada ? [...pagosProv.values()].map((p) => p.fecha).sort().pop() : undefined)),
    fechaPagoBarra: congelado ? undefined : egresoBarra?.fecha,
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

/**
 * Porcentaje entero de `parte` sobre `total` para mostrar ("40% cubierto").
 * Redondea para abajo: dice 100% solo cuando no falta nada (con la tolerancia
 * de centavos de siempre), y no muestra 0% si ya hay algo.
 */
export function porcentajeEntero(parte: number, total: number): number {
  if (!(total > 0) || !(parte > 0)) return 0
  if (parte >= total - 0.005) return 100
  return Math.min(99, Math.max(1, Math.floor((parte / total) * 100)))
}

export interface CuotaResumen {
  monto: number
  montoAcumulado: number
}

export interface ResumenCobroCliente {
  /** Precio del contrato (planDeCuotas.montoTotal). */
  precioContrato: number
  /** Seña (modalidad "Seña + Cuotas"); se cobra al firmar y no es una cuota. */
  seña: number
  /** Seña + todas las cuotas, con lo que suman la financiación y el IPC. */
  totalACobrar: number
  /** totalACobrar − precioContrato (recargo por financiación o ajuste por IPC). */
  ajuste: number
  /** Seña + lo cobrado de cada cuota, incluidos los pagos parciales. */
  cobrado: number
  faltaCobrar: number
  progreso: number
}

/**
 * Lo cobrado al cliente, con el criterio de la pantalla de pagos del evento:
 * la seña cuenta como cobrada y cada cuota suma lo que ya se cobró de ella
 * (también si es un pago parcial; sin la mora). Recibe el calendario de
 * generarCalendarioCuotas.
 */
export function resumenCobroCliente(
  plan: { montoTotal?: number; modalidadPago?: string; montoSena?: number } | undefined,
  cuotas: CuotaResumen[],
): ResumenCobroCliente {
  const seña = plan?.modalidadPago === "sena" ? (plan.montoSena ?? 0) : 0
  const totalCuotas = cuotas.reduce((s, c) => s + c.monto, 0)
  const cobradoCuotas = cuotas.reduce((s, c) => s + Math.min(c.montoAcumulado ?? 0, c.monto), 0)
  const precioContrato = plan?.montoTotal ?? 0
  const totalACobrar = totalCuotas + seña
  const cobrado = cobradoCuotas + seña
  return {
    precioContrato,
    seña,
    totalACobrar,
    ajuste: precioContrato > 0 ? totalACobrar - precioContrato : 0,
    cobrado,
    faltaCobrar: Math.max(0, totalACobrar - cobrado),
    progreso: porcentajeEntero(cobrado, totalACobrar),
  }
}

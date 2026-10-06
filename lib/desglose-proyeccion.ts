// Desglose de cada mes de la "Proyección en 12 meses" de Caja Eventos
// (app/finanzas/caja-eventos): de lo que vence ese mes, cuánto ya entró o ya
// se pagó, cuánto falta y de quién.
//
// Reglas:
// - "Falta" sale de la MISMA lista que arma la proyección (calcularCajaEventos),
//   sumada en el mismo orden: el total del detalle es siempre el número que se
//   tocó en la tabla.
// - "Ya ingresó" / "Ya pagado" usan los movimientos reales de Caja Eventos: el
//   pasado no se recalcula con los precios de hoy. Si una cuota o un pago
//   figura como hecho pero no tiene movimiento en la caja, se muestra el monto
//   que calcula el sistema y se marca con `sinMovimiento`.
// - Mismo universo que la proyección: sin eventos cancelados ni completados y
//   con el mismo filtro de salón.
//
// Solo lectura: no guarda ni modifica nada.

import { calcularProporcionCajaEventos, type DatosCostosEvento } from "./cobrar-cuota"
import type { EgresoPendienteServicio, IngresoPendiente } from "./hooks/use-caja-eventos"
import type { EventoGuardado, MovimientoCaja } from "./store"

export interface CobroPendienteMes {
  id: string
  eventoId: string
  cliente: string
  eventoNombre: string
  salon: string
  numeroCuota: number
  totalCuotas: number
  fechaVencimiento: string
  /** Parte de Caja Eventos que falta cobrar (el mismo monto que suma la proyección). */
  monto: number
  parcial: boolean
  vencida: boolean
}

export interface CobroRealizadoMes {
  id: string
  eventoId: string
  cliente: string
  eventoNombre: string
  salon: string
  numeroCuota: number
  totalCuotas: number
  fechaVencimiento: string
  /** Lo que entró a Caja Eventos por esta cuota. */
  monto: number
  /** Día del último cobro registrado (YYYY-MM-DD, hora local). */
  fechaCobro?: string
  /** Figura cobrada pero no hay movimiento en Caja Eventos: monto calculado por el sistema. */
  sinMovimiento: boolean
}

export interface DesgloseCobrarMes {
  debiaIngresar: number
  yaIngreso: number
  falta: number
  pendientes: CobroPendienteMes[]
  cobrados: CobroRealizadoMes[]
}

export interface PagoMes {
  id: string
  eventoId: string
  eventoNombre: string
  salon: string
  tipo: EgresoPendienteServicio["tipo"]
  /** Nombre del servicio, "Menú del evento", "Barra del evento" o la persona del sueldo. */
  servicioNombre: string
  fechaVencimiento: string
  monto: number
  /** Solo pendientes: la fecha de pago ya pasó. */
  vencido?: boolean
  /** Solo pagados: día del último pago registrado (YYYY-MM-DD, hora local). */
  fechaPago?: string
  /** Solo pagados: figura pagado pero no hay movimiento en Caja Eventos. */
  sinMovimiento?: boolean
}

export interface DesglosePagarMes {
  totalAPagar: number
  yaPagado: number
  falta: number
  pendientes: PagoMes[]
  pagados: PagoMes[]
}

export interface DesgloseMesProyeccion {
  cobrar: DesgloseCobrarMes
  pagar: DesglosePagarMes
}

export interface EntradaDesgloseProyeccion {
  /** state.eventos: los mismos que recibió calcularCajaEventos. */
  eventos: EventoGuardado[]
  /** state.movimientosCaja */
  movimientos: MovimientoCaja[]
  salonFiltro?: string
  /** Para estimar la parte de Caja Eventos de una cuota cobrada sin movimiento. */
  datosCostos: DatosCostosEvento
  /** De calcularCajaEventos (normal): lo pendiente. */
  ingresosPendientes: IngresoPendiente[]
  egresosPendientes: EgresoPendienteServicio[]
  /** egresosPendientes de calcularCajaEventos con incluirPagados = true: las obligaciones completas. */
  egresosCompletos: EgresoPendienteServicio[]
}

const mesDe = (fecha: string | undefined) => (fecha || "").slice(0, 7)
const dinero = (n: number) => Math.round(n * 100) / 100

/** Día local (YYYY-MM-DD) de la fecha ISO de un movimiento. */
function diaLocal(fechaISO: string): string | undefined {
  const d = new Date(fechaISO)
  if (Number.isNaN(d.getTime())) return undefined
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** El más reciente de los días de una lista de movimientos. */
function ultimoDia(movs: MovimientoCaja[]): string | undefined {
  return movs.map((m) => diaLocal(m.fecha)).filter((d): d is string => !!d).sort().pop()
}

/**
 * Cómo empieza el concepto del movimiento que registra cada tipo de pago.
 * Mismos textos que arman handleMarcarPagado (app/finanzas/caja-eventos) y
 * app/eventos/costos al pagar.
 */
function prefijoPago(g: EgresoPendienteServicio): string {
  if (g.tipo === "menu") return "Pago menú - "
  if (g.tipo === "barra") return "Pago barra - "
  return `Pago ${g.tipo} ${g.servicioNombre} - `
}

function indexarPorEvento(movs: MovimientoCaja[]): Map<string, MovimientoCaja[]> {
  const porEvento = new Map<string, MovimientoCaja[]>()
  for (const m of movs) {
    if (!m.eventoId) continue
    const lista = porEvento.get(m.eventoId)
    if (lista) lista.push(m)
    else porEvento.set(m.eventoId, [m])
  }
  return porEvento
}

/** Desglose de cada mes pedido (claves "YYYY-MM", las de proyeccionMensual). */
export function desglosarProyeccion(
  entrada: EntradaDesgloseProyeccion,
  meses: string[],
): Record<string, DesgloseMesProyeccion> {
  const salonSel = entrada.salonFiltro && entrada.salonFiltro !== "todos" ? entrada.salonFiltro : null
  const eventosActivos = new Map<string, EventoGuardado>()
  for (const evento of entrada.eventos) {
    if (salonSel && evento.salon !== salonSel) continue
    if (evento.estado === "cancelado" || evento.estado === "completado") continue
    eventosActivos.set(evento.id, evento)
  }

  const resultado: Record<string, DesgloseMesProyeccion> = {}
  for (const mes of meses) {
    resultado[mes] = {
      cobrar: { debiaIngresar: 0, yaIngreso: 0, falta: 0, pendientes: [], cobrados: [] },
      pagar: { totalAPagar: 0, yaPagado: 0, falta: 0, pendientes: [], pagados: [] },
    }
  }

  // ---------------- A COBRAR ----------------
  // Lo que falta: la misma lista y el mismo orden que suma la proyección.
  for (const ing of entrada.ingresosPendientes) {
    const r = resultado[mesDe(ing.fechaVencimiento)]
    if (!r) continue
    r.cobrar.pendientes.push({
      id: ing.id,
      eventoId: ing.eventoId,
      cliente: ing.contacto.nombre,
      eventoNombre: ing.eventoNombre,
      salon: ing.salon,
      numeroCuota: ing.numeroCuota,
      totalCuotas: ing.totalCuotas,
      fechaVencimiento: ing.fechaVencimiento,
      monto: ing.monto,
      parcial: ing.estado === "parcial",
      vencida: ing.esVencida,
    })
    r.cobrar.falta += ing.monto
  }

  // Lo que ya entró: cobros de Caja Eventos por evento y número de cuota
  // (concepto "Cuota N …", como los arma construirMovimientosPago).
  const cobrosPorCuota = new Map<string, MovimientoCaja[]>()
  for (const m of entrada.movimientos) {
    if (m.tipo !== "ingreso" || m.cajaDestino !== "caja_eventos" || !m.eventoId) continue
    const numero = Number(/^Cuota\s+(\d+)\b/i.exec(m.concepto || "")?.[1])
    if (!numero) continue
    const clave = `${m.eventoId}#${numero}`
    const lista = cobrosPorCuota.get(clave)
    if (lista) lista.push(m)
    else cobrosPorCuota.set(clave, [m])
  }

  for (const evento of eventosActivos.values()) {
    const plan = evento.planDeCuotas
    if (!plan) continue
    let proporcion: number | null = null // se calcula solo si hace falta estimar
    for (const cuota of plan.cuotas ?? []) {
      const r = resultado[mesDe(cuota.fechaVencimiento)]
      if (!r) continue
      const marcadaPagada = cuota.pagada === true || (plan.cuotasPagadas ?? []).includes(cuota.numero)
      const acreditado = cuota.montoPagadoNeto ?? 0
      if (!marcadaPagada && acreditado <= 0) continue

      const movs = cobrosPorCuota.get(`${evento.id}#${cuota.numero}`) ?? []
      let monto: number
      let sinMovimiento = false
      if (movs.length > 0) {
        monto = dinero(movs.reduce((s, m) => s + m.monto, 0))
      } else {
        if (proporcion === null) proporcion = calcularProporcionCajaEventos(evento, entrada.datosCostos)
        monto = dinero((acreditado > 0 ? acreditado : cuota.montoCuota) * proporcion)
        sinMovimiento = true
      }
      if (monto <= 0) continue
      r.cobrar.cobrados.push({
        id: `${evento.id}-cuota-${cuota.numero}`,
        eventoId: evento.id,
        // Mismos nombres que usa calcularCajaEventos para los pendientes.
        cliente: evento.contrato?.nombreCompleto || evento.nombrePareja || evento.nombre || "Sin nombre",
        eventoNombre: evento.nombrePareja || evento.nombre || evento.tipoEvento || "Evento",
        salon: evento.salon || "",
        numeroCuota: cuota.numero,
        totalCuotas: plan.numeroCuotas,
        fechaVencimiento: cuota.fechaVencimiento || "",
        monto,
        fechaCobro: ultimoDia(movs),
        sinMovimiento,
      })
      r.cobrar.yaIngreso += monto
    }
  }

  // ---------------- A PAGAR ----------------
  // Lo que falta: la misma lista y el mismo orden que suma la proyección.
  const pendientePorId = new Map<string, number>()
  for (const eg of entrada.egresosPendientes) {
    const r = resultado[mesDe(eg.fechaVencimiento)]
    if (!r) continue
    r.pagar.pendientes.push({
      id: eg.id,
      eventoId: eg.eventoId,
      eventoNombre: eg.eventoNombre,
      salon: eg.salon,
      tipo: eg.tipo,
      servicioNombre: eg.servicioNombre,
      fechaVencimiento: eg.fechaVencimiento,
      monto: eg.monto,
      vencido: eg.diasRestantes < 0,
    })
    r.pagar.falta += eg.monto
    pendientePorId.set(eg.id, (pendientePorId.get(eg.id) ?? 0) + eg.monto)
  }

  // Lo que ya se pagó: cada obligación completa del mes menos lo que sigue
  // pendiente. El monto sale de los pagos reales de Caja Eventos (cada
  // movimiento se usa una sola vez); si no hay, el que calcula el sistema.
  const pagosPorEvento = indexarPorEvento(
    entrada.movimientos.filter((m) => m.tipo === "egreso" && m.cajaDestino === "caja_eventos"),
  )
  const usados = new Set<string>()
  for (const g of entrada.egresosCompletos) {
    const r = resultado[mesDe(g.fechaVencimiento)]
    if (!r || !eventosActivos.has(g.eventoId)) continue
    const pendiente = Math.min(g.monto, pendientePorId.get(g.id) ?? 0)
    if (pendiente > 0) pendientePorId.set(g.id, (pendientePorId.get(g.id) ?? 0) - pendiente)
    const pagadoSegunSistema = g.monto - pendiente
    if (pagadoSegunSistema <= 0.005) continue

    const prefijo = prefijoPago(g)
    const movs = (pagosPorEvento.get(g.eventoId) ?? []).filter(
      (m) => !usados.has(m.id) && (m.concepto || "").startsWith(prefijo),
    )
    movs.forEach((m) => usados.add(m.id))
    const monto = movs.length > 0 ? dinero(movs.reduce((s, m) => s + m.monto, 0)) : dinero(pagadoSegunSistema)
    r.pagar.pagados.push({
      id: g.id,
      eventoId: g.eventoId,
      eventoNombre: g.eventoNombre,
      salon: g.salon,
      tipo: g.tipo,
      servicioNombre: g.servicioNombre,
      fechaVencimiento: g.fechaVencimiento,
      monto,
      fechaPago: ultimoDia(movs),
      sinMovimiento: movs.length === 0,
    })
    r.pagar.yaPagado += monto
  }

  for (const mes of meses) {
    const { cobrar, pagar } = resultado[mes]
    cobrar.yaIngreso = dinero(cobrar.yaIngreso)
    cobrar.debiaIngresar = dinero(cobrar.yaIngreso + cobrar.falta)
    cobrar.cobrados.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento) || a.cliente.localeCompare(b.cliente))
    pagar.yaPagado = dinero(pagar.yaPagado)
    pagar.totalAPagar = dinero(pagar.yaPagado + pagar.falta)
  }
  return resultado
}

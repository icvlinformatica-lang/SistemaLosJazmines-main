// "Cubrir los costos" al finalizar un evento (pedido del dueño, 10/11/2026:
// "una vez que finalizo un evento, que me diga si quiero cubrir los costos del
// evento antes de mandarlo a finalizados").
//
// Arma, de una sola vez, lo mismo que hace "Marcar como pagado" de Caja
// Eventos (handleMarcarPagado en app/finanzas/caja-eventos/page.tsx) con cada
// costo que le falta pagar al evento: menú, barra, señas y saldos de servicios
// y sueldos. Los montos son los de "Por pagar" de Caja Eventos
// (calcularCajaEventos), con la fecha de hoy.
//  - Devuelve los cambios del evento (para guardarlos junto con el estado
//    "completado", así la foto de costos queda con todo pagado) y un egreso de
//    Caja Eventos por cada costo, con los mismos conceptos de esa pantalla.
//  - Lo que no se puede pagar desde acá queda afuera y se explica:
//    una seña con candado (necesita el PIN, se paga en Costos del evento) y el
//    saldo de un servicio cuya seña no se paga ahora ("primero la seña").
// Función pura: no guarda nada.

import { generateId, type EventoGuardado, type MovimientoCaja, type ServicioEvento } from "./store"
import { pagarServicioComoSueldo } from "./servicio-sueldo"
import { señaBloqueada } from "./candado-senas"

export interface CostoACubrir {
  id: string
  eventoId: string
  eventoNombre: string
  tipo: "seña" | "saldo" | "menu" | "barra" | "sueldo"
  servicioId?: string
  servicioNombre: string
  monto: number
  /** Estado de pago actual del servicio (para saber si la seña ya se pagó). */
  estadoPago?: "sin_seña" | "señado" | "saldo_pendiente" | "pagado_total"
}

export interface CostoOmitido {
  costo: CostoACubrir
  motivo: "seña_con_candado" | "seña_sin_pagar"
}

export interface PlanCubrirCostos {
  /** Cambios para el evento (servicios, personal, menú y barra pagados). */
  cambiosEvento: Partial<EventoGuardado>
  /** Egresos de Caja Eventos, uno por costo pagado. */
  movimientos: MovimientoCaja[]
  /** Compromisos de Finanzas → Personal a marcar pagados (pagos_personal). */
  compromisosPersonal: string[]
  pagados: CostoACubrir[]
  omitidos: CostoOmitido[]
  totalPagado: number
}

const redondear = (n: number) => Math.round(n * 100) / 100

function concepto(c: CostoACubrir): string {
  if (c.tipo === "menu") return `Pago menú - ${c.eventoNombre}`
  if (c.tipo === "barra") return `Pago barra - ${c.eventoNombre}`
  if (c.tipo === "sueldo") return `Pago sueldo ${c.servicioNombre} - ${c.eventoNombre}`
  return `Pago ${c.tipo === "seña" ? "seña" : "saldo"} ${c.servicioNombre} - ${c.eventoNombre}`
}

export function planCubrirCostos(params: {
  evento: EventoGuardado
  /** "Por pagar" de Caja Eventos de ESTE evento. */
  costos: CostoACubrir[]
  movimientosCaja: MovimientoCaja[]
  /** Fecha de negocio de hoy (YYYY-MM-DD). */
  hoy: string
  /** Momento del pago (ISO). */
  ahoraISO: string
}): PlanCubrirCostos {
  const { evento, movimientosCaja, hoy, ahoraISO } = params
  const costos = params.costos.filter((c) => c.eventoId === evento.id && c.monto > 0.005)
  const omitidos: CostoOmitido[] = []
  const candado = señaBloqueada(evento.fechaAlta, evento.fecha, hoy)

  // Señas que se pagan ahora (por servicio): habilitan pagar su saldo.
  const señasAPagar = new Set<string>()
  const aPagar: CostoACubrir[] = []
  for (const c of costos) {
    if (c.tipo === "seña") {
      if (candado) omitidos.push({ costo: c, motivo: "seña_con_candado" })
      else {
        aPagar.push(c)
        if (c.servicioId) señasAPagar.add(c.servicioId)
      }
    }
  }
  for (const c of costos) {
    if (c.tipo === "seña") continue
    if (c.tipo === "saldo" && c.estadoPago === "sin_seña" && !(c.servicioId && señasAPagar.has(c.servicioId))) {
      omitidos.push({ costo: c, motivo: candado ? "seña_con_candado" : "seña_sin_pagar" })
      continue
    }
    aPagar.push(c)
  }

  let servicios: ServicioEvento[] | undefined
  let personal = evento.personalEvento
  const cambiosEvento: Partial<EventoGuardado> = {}
  const compromisosPersonal: string[] = []

  for (const c of aPagar) {
    if (c.tipo === "menu") cambiosEvento.cocinaPagada = true
    else if (c.tipo === "barra") cambiosEvento.barraPagada = true
    else if (c.tipo === "sueldo") {
      if (c.id.includes("-srvsueldo-")) {
        servicios = (servicios ?? evento.servicios ?? []).map((srv) =>
          srv.servicioId === c.servicioId ? pagarServicioComoSueldo(srv, c.monto, hoy) : srv,
        )
      } else if (c.id.includes("-compromiso-")) {
        if (c.servicioId) compromisosPersonal.push(c.servicioId)
      } else {
        personal = (personal ?? []).map((pe) => (pe.id === c.servicioId ? { ...pe, pagado: true, monto: c.monto } : pe))
      }
    } else {
      servicios = (servicios ?? evento.servicios ?? []).map((srv) => {
        if (srv.servicioId !== c.servicioId) return srv
        if (c.tipo === "seña") return { ...srv, estadoPago: "señado" as const, fechaPagoSeña: hoy, montoSeña: c.monto }
        return { ...srv, pagado: true, estadoPago: "pagado_total" as const, saldoPendiente: 0, fechaPagoSaldo: hoy }
      })
    }
  }
  if (servicios) cambiosEvento.servicios = servicios
  if (personal !== evento.personalEvento) cambiosEvento.personalEvento = personal

  let saldo = movimientosCaja
    .filter((m) => m.cajaDestino === "caja_eventos")
    .reduce((s, m) => (m.tipo === "ingreso" ? s + m.monto : s - m.monto), 0)
  const movimientos: MovimientoCaja[] = aPagar.map((c) => {
    const monto = redondear(c.monto)
    saldo -= monto
    return {
      id: generateId(),
      fecha: ahoraISO,
      tipo: "egreso",
      concepto: concepto(c),
      monto,
      salon: evento.salon || "",
      eventoId: evento.id,
      cajaDestino: "caja_eventos",
      saldoResultante: redondear(saldo),
    }
  })

  return {
    cambiosEvento,
    movimientos,
    compromisosPersonal,
    pagados: aPagar,
    omitidos,
    totalPagado: redondear(movimientos.reduce((s, m) => s + m.monto, 0)),
  }
}

"use client"

import { useMemo } from "react"
import type { AppState, MovimientoCaja } from "../store"

// ============================================================
// Tipos de salida
// ============================================================

export interface UltimoIngresoCajaEventos {
  id: string
  eventoId: string | undefined
  concepto: string
  monto: number
  fecha: string
  salon: string
}

export interface ProximoACobrar {
  id: string
  eventoId: string
  eventoNombre: string
  numeroCuota: number
  totalCuotas: number
  salon: string
  fechaVencimiento: string
  diasRestantes: number
  monto: number
}

export interface IngresosPorSalon {
  [salon: string]: number
}

export interface ProyeccionCajaEventos {
  estaSemana: number
  esteMes: number
  proximos90Dias: number
}

export interface EgresoPendienteServicio {
  id: string
  eventoId: string
  eventoNombre: string
  servicioNombre: string
  tipo: "seña" | "saldo"
  monto: number
  fechaVencimiento: string // YYYY-MM-DD
  diasRestantes: number
  estadoPago: "sin_seña" | "señado" | "saldo_pendiente" | "pagado_total"
}

export interface CajaEventosData {
  saldoActual: number
  proyeccion: ProyeccionCajaEventos
  ultimosIngresos: UltimoIngresoCajaEventos[]
  proximosACobrar: ProximoACobrar[]
  ingresosPorSalon: IngresosPorSalon
  totalIngresosSalonMes: number
  mesActual: string
  egresosPendientesServicios: EgresoPendienteServicio[]
  totalEgresosPendientes: number
  balanceProyectado: number
}

// ============================================================
// Helper: parse de fecha evitando problemas de timezone
// ============================================================
function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00")
}

// ============================================================
// Hook
// ============================================================
export function useCajaEventos(state: AppState): CajaEventosData {
  return useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const en7Dias = new Date(hoy)
    en7Dias.setDate(en7Dias.getDate() + 7)

    const en30Dias = new Date(hoy)
    en30Dias.setDate(en30Dias.getDate() + 30)

    const en90Dias = new Date(hoy)
    en90Dias.setDate(en90Dias.getDate() + 90)

    const movimientos: MovimientoCaja[] = state.movimientosCaja || []
    const eventos = state.eventos || []

    // ----------------------------------------------------------
    // 1. SALDO ACTUAL
    // ----------------------------------------------------------
    const saldoActual = movimientos
      .filter((m) => m.cajaDestino === "caja_eventos")
      .reduce((sum, m) => {
        if (m.tipo === "ingreso") return sum + m.monto
        if (m.tipo === "egreso") return sum - m.monto
        return sum
      }, 0)

    // ----------------------------------------------------------
    // 2. PROYECCIÓN: cuotas pendientes (monto/2)
    // ----------------------------------------------------------
    let proyEstaSemana = 0
    let proyEsteMes = 0
    let prox90 = 0

    const proximosACobrar: ProximoACobrar[] = []

    for (const evento of eventos) {
      if (evento.estado === "cancelado" || evento.estado === "completado") continue
      const plan = evento.planDeCuotas
      if (!plan) continue

      const cuotas = plan.cuotas ?? []
      const cuotasPagadasArr = plan.cuotasPagadas ?? []

      for (const cuota of cuotas) {
        if (cuota.pagada) continue
        if (cuotasPagadasArr.includes(cuota.numero)) continue
        if (!cuota.fechaVencimiento) continue

        const fechaVenc = parseLocalDate(cuota.fechaVencimiento)
        const diasRestantes = Math.ceil(
          (fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
        )

        const montoCajaEventos = cuota.montoCuota / 2

        if (fechaVenc >= hoy && fechaVenc <= en7Dias) {
          proyEstaSemana += montoCajaEventos
        }
        if (fechaVenc >= hoy && fechaVenc <= en30Dias) {
          proyEsteMes += montoCajaEventos
          proximosACobrar.push({
            id: `${evento.id}-cuota-${cuota.numero}`,
            eventoId: evento.id,
            eventoNombre: evento.nombrePareja || evento.nombre || evento.tipoEvento || "Evento",
            numeroCuota: cuota.numero,
            totalCuotas: plan.numeroCuotas,
            salon: evento.salon || "",
            fechaVencimiento: cuota.fechaVencimiento,
            diasRestantes,
            monto: montoCajaEventos,
          })
        }
        if (fechaVenc >= hoy && fechaVenc <= en90Dias) {
          prox90 += montoCajaEventos
        }
      }
    }

    proximosACobrar.sort((a, b) =>
      a.fechaVencimiento.localeCompare(b.fechaVencimiento)
    )

    // ----------------------------------------------------------
    // 3. ÚLTIMOS INGRESOS (10 más recientes de caja_eventos)
    // ----------------------------------------------------------
    const ultimosIngresos: UltimoIngresoCajaEventos[] = movimientos
      .filter((m) => m.cajaDestino === "caja_eventos" && m.tipo === "ingreso")
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 10)
      .map((m) => ({
        id: m.id,
        eventoId: m.eventoId,
        concepto: m.concepto,
        monto: m.monto,
        fecha: m.fecha.slice(0, 10),
        salon: m.salon,
      }))

    // ----------------------------------------------------------
    // 4. INGRESOS POR SALÓN del mes actual
    // ----------------------------------------------------------
    const mesActualNum = hoy.getMonth()
    const anioActualNum = hoy.getFullYear()

    const ingresosPorSalon: IngresosPorSalon = {}
    movimientos
      .filter((m) => {
        if (m.cajaDestino !== "caja_eventos" || m.tipo !== "ingreso") return false
        const fechaMov = new Date(m.fecha)
        return (
          fechaMov.getMonth() === mesActualNum &&
          fechaMov.getFullYear() === anioActualNum
        )
      })
      .forEach((m) => {
        ingresosPorSalon[m.salon] = (ingresosPorSalon[m.salon] || 0) + m.monto
      })

    const totalIngresosSalonMes = Object.values(ingresosPorSalon).reduce(
      (s, v) => s + v,
      0
    )

    const mesActual = hoy.toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric",
    })

    // ----------------------------------------------------------
    // 5. EGRESOS PENDIENTES DE SERVICIOS
    // ----------------------------------------------------------
    const egresosPendientesServicios: EgresoPendienteServicio[] = []

    for (const evento of eventos) {
      if (evento.estado === "cancelado" || evento.estado === "completado") continue
      const serviciosEvento = evento.servicios ?? []
      const eventoNombre = evento.nombrePareja || evento.nombre || evento.tipoEvento || "Evento"

      for (const srv of serviciosEvento) {
        const estadoPago = srv.estadoPago ?? "sin_seña"

        // Egreso de seña: aplica si todavía no se pagó la seña
        if (
          (estadoPago === "sin_seña" || estadoPago === "señado") &&
          srv.montoSeña &&
          srv.montoSeña > 0 &&
          srv.fechaSeña
        ) {
          const fechaVenc = parseLocalDate(srv.fechaSeña)
          // Mostrar SIEMPRE la seña pendiente del servicio, sin importar cuán lejos
          // esté la fecha de vencimiento (debe figurar apenas se crea el evento).
          {
            egresosPendientesServicios.push({
              id: `${evento.id}-${srv.servicioId}-seña`,
              eventoId: evento.id,
              eventoNombre,
              servicioNombre: srv.nombre,
              tipo: "seña",
              monto: srv.montoSeña,
              fechaVencimiento: srv.fechaSeña,
              diasRestantes: Math.ceil(
                (fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
              ),
              estadoPago,
            })
          }
        }

        // Egreso de saldo: aplica si todavía no se pagó el total
        if (
          estadoPago !== "pagado_total" &&
          srv.saldoPendiente &&
          srv.saldoPendiente > 0 &&
          srv.fechaLimitePago
        ) {
          const fechaVenc = parseLocalDate(srv.fechaLimitePago)
          // Mostrar SIEMPRE el saldo pendiente del servicio, sin tope de días.
          {
            egresosPendientesServicios.push({
              id: `${evento.id}-${srv.servicioId}-saldo`,
              eventoId: evento.id,
              eventoNombre,
              servicioNombre: srv.nombre,
              tipo: "saldo",
              monto: srv.saldoPendiente,
              fechaVencimiento: srv.fechaLimitePago,
              diasRestantes: Math.ceil(
                (fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
              ),
              estadoPago,
            })
          }
        }
      }
    }

    egresosPendientesServicios.sort((a, b) =>
      a.fechaVencimiento.localeCompare(b.fechaVencimiento)
    )

    const totalEgresosPendientes = egresosPendientesServicios.reduce(
      (sum, e) => sum + e.monto,
      0
    )

    const balanceProyectado = saldoActual + prox90 - totalEgresosPendientes

    return {
      saldoActual,
      proyeccion: {
        estaSemana: proyEstaSemana,
        esteMes: proyEsteMes,
        proximos90Dias: prox90,
      },
      ultimosIngresos,
      proximosACobrar,
      ingresosPorSalon,
      totalIngresosSalonMes,
      mesActual,
      egresosPendientesServicios,
      totalEgresosPendientes,
      balanceProyectado,
    }
  }, [state.movimientosCaja, state.eventos])
}

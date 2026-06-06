"use client"

import { useMemo } from "react"
import type { AppState, CostoOperativo, MovimientoCaja } from "../store"

// ============================================================
// Tipos de salida
// ============================================================

export type EstadoAlerta = "vencido" | "urgente" | "proximo" | "ok"

export interface AlertaVencimiento {
  id: string
  concepto: string
  monto: number
  fechaVencimiento: string
  diasRestantes: number
  estado: EstadoAlerta
}

export interface GastoFijoMes {
  id: string
  concepto: string
  tipo: CostoOperativo["tipo"]
  frecuencia: CostoOperativo["frecuencia"]
  salon: string | null | undefined
  monto: number
  estado: EstadoAlerta | "pagado"
}

export interface GastoVariable {
  id: string
  nombre: string
  salon: string
  fecha: string
  monto: number
  estado: "pendiente" | "pagado" | "vencido"
}

export interface CajaJazminData {
  saldoActual: number
  gastosPróximos30Dias: number
  saldoProyectado30Dias: number
  alertasVencimiento: AlertaVencimiento[]
  gastosFijosMes: GastoFijoMes[]
  gastosVariables: GastoVariable[]
  ingresosProyectados30Dias: number
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
export function useCajaJazmines(state: AppState): CajaJazminData {
  return useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const en30Dias = new Date(hoy)
    en30Dias.setDate(en30Dias.getDate() + 30)

    const movimientos: MovimientoCaja[] = state.movimientosCaja || []
    const costosOperativos = state.costosOperativos || []
    const eventos = state.eventos || []

    // ----------------------------------------------------------
    // 1. SALDO ACTUAL de caja_jazmines
    // ----------------------------------------------------------
    const saldoActual = movimientos
      .filter((m) => m.cajaDestino === "caja_jazmines")
      .reduce((sum, m) => {
        if (m.tipo === "ingreso") return sum + m.monto
        if (m.tipo === "egreso") return sum - m.monto
        return sum
      }, 0)

    // ----------------------------------------------------------
    // 2. GASTOS PRÓXIMOS 30 DÍAS (costos operativos activos no por evento)
    // ----------------------------------------------------------
    let gastosPróximos30Dias = 0
    const alertasVencimiento: AlertaVencimiento[] = []
    const gastosFijosMes: GastoFijoMes[] = []

    costosOperativos
      .filter((c) => c.activo && c.frecuencia !== "Por Evento")
      .forEach((costo) => {
        const fechaVencStr = costo.fechaVencimiento
        if (!fechaVencStr) {
          // Sin fecha de vencimiento — igual aparece en gastos fijos del mes
          gastosFijosMes.push({
            id: costo.id,
            concepto: costo.concepto,
            tipo: costo.tipo,
            frecuencia: costo.frecuencia,
            salon: costo.salon,
            monto: costo.monto,
            estado: "ok",
          })
          return
        }

        const fechaVenc = parseLocalDate(fechaVencStr)
        const diasRestantes = Math.ceil(
          (fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Clasificar estado
        let estado: EstadoAlerta
        if (diasRestantes < 0) estado = "vencido"
        else if (diasRestantes <= 3) estado = "urgente"
        else if (diasRestantes <= 7) estado = "proximo"
        else estado = "ok"

        // Alertas: vencidos o que vencen en los próximos 30 días
        if (diasRestantes <= 30) {
          alertasVencimiento.push({
            id: costo.id,
            concepto: costo.concepto,
            monto: costo.monto,
            fechaVencimiento: fechaVencStr,
            diasRestantes,
            estado,
          })
          gastosPróximos30Dias += costo.monto
        }

        // Gastos fijos del mes: mensual o anual
        if (costo.frecuencia === "Mensual" || costo.frecuencia === "Anual") {
          gastosFijosMes.push({
            id: costo.id,
            concepto: costo.concepto,
            tipo: costo.tipo,
            frecuencia: costo.frecuencia,
            salon: costo.salon,
            monto: costo.monto,
            estado,
          })
        }
      })

    // Ordenar alertas por diasRestantes ascendente
    alertasVencimiento.sort((a, b) => a.diasRestantes - b.diasRestantes)

    // ----------------------------------------------------------
    // 3. INGRESOS PROYECTADOS a 30 días (50% de cuotas pendientes)
    // ----------------------------------------------------------
    let ingresosProyectados30Dias = 0

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
        if (fechaVenc >= hoy && fechaVenc <= en30Dias) {
          ingresosProyectados30Dias += cuota.montoCuota / 2
        }
      }
    }

    // ----------------------------------------------------------
    // 4. SALDO PROYECTADO A 30 DÍAS
    // ----------------------------------------------------------
    const saldoProyectado30Dias =
      saldoActual + ingresosProyectados30Dias - gastosPróximos30Dias

    // ----------------------------------------------------------
    // 5. GASTOS VARIABLES (vacío por ahora — se conectará cuando
    //    exista GastoVariable en el store)
    // ----------------------------------------------------------
    const gastosVariables: GastoVariable[] = []

    return {
      saldoActual,
      gastosPróximos30Dias,
      saldoProyectado30Dias,
      alertasVencimiento,
      gastosFijosMes,
      gastosVariables,
      ingresosProyectados30Dias,
    }
  }, [state.movimientosCaja, state.costosOperativos, state.eventos])
}

"use client"

import { useMemo } from "react"
import type { AppState, CostoOperativo, MovimientoCaja } from "../store"
import { salonLabel } from "../store"

// ============================================================
// Tipos de salida
// ============================================================

export type EstadoAlerta = "vencido" | "urgente" | "proximo" | "ok"

export interface AlertaVencimiento {
  id: string
  concepto: string
  salon: string | null | undefined
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
  fechaVencimiento?: string
}

export interface GastoVariable {
  id: string
  nombre: string
  salon: string
  fecha: string
  monto: number
  estado: "pendiente" | "pagado" | "vencido"
}

export interface CuotaPorCobrar {
  id: string
  eventoId: string
  eventoNombre: string
  salon: string
  numeroCuota: number
  totalCuotas: number
  fechaVencimiento: string
  diasRestantes: number
  montoCuota: number // cuota completa
  montoJazmines: number // 50% que va a Caja Jazmines
}

export interface CajaJazminData {
  saldoActual: number
  gastosPróximos30Dias: number
  saldoProyectado30Dias: number
  alertasVencimiento: AlertaVencimiento[]
  gastosFijosMes: GastoFijoMes[]
  /** Gastos fijos ya pagados y archivados en el período en curso */
  gastosFijosCubiertos: GastoFijoMes[]
  gastosVariables: GastoVariable[]
  ingresosProyectados30Dias: number
  /** Todas las cuotas pendientes de cobro (para marcarlas como cobradas) */
  cuotasPorCobrar: CuotaPorCobrar[]
}

// ============================================================
// Helper: parse de fecha evitando problemas de timezone
// ============================================================
function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00")
}

/**
 * Resuelve la lista de costos operativos según el salón seleccionado, aplicando
 * el reparto por porcentaje (`distribucion`) cuando existe.
 *
 * - Gasto con reparto y vista de un salón: se incluye SOLO si ese salón participa,
 *   con el monto prorrateado a su porcentaje y el concepto anotado (ej. "Luz · 50%").
 * - Gasto con reparto y vista "todos": se incluye una sola línea con el monto total
 *   y un resumen del reparto en el concepto.
 * - Gasto sin reparto (un salón o general): comportamiento clásico de filtro por salón.
 */
function resolverCostosPorSalon(
  costos: CostoOperativo[],
  salonSel: string | null,
): CostoOperativo[] {
  const out: CostoOperativo[] = []
  for (const c of costos) {
    const dist = (c.distribucion || []).filter((d) => d && d.salon && d.porcentaje > 0)
    if (dist.length > 0) {
      if (salonSel) {
        const entry = dist.find((d) => d.salon === salonSel)
        if (!entry) continue
        out.push({
          ...c,
          monto: Math.round((c.monto * entry.porcentaje) / 100),
          salon: salonSel,
          concepto: `${c.concepto} · ${entry.porcentaje}%`,
        })
      } else {
        const resumen = dist.map((d) => `${salonLabel(d.salon)} ${d.porcentaje}%`).join(" · ")
        out.push({
          ...c,
          salon: null,
          concepto: `${c.concepto} · repartido (${resumen})`,
        })
      }
    } else {
      if (salonSel && c.salon !== salonSel) continue
      out.push(c)
    }
  }
  return out
}

/**
 * Un gasto fijo se considera "cubierto este período" si existe un registro
 * archivado (origen caja_jazmines_fijo) para ese costo cuya fecha de archivo
 * cae en el mes actual (o el año actual, si es Anual).
 */
function gastoFijoCubierto(
  costoId: string,
  frecuencia: CostoOperativo["frecuencia"],
  archivados: { origen: string; refId?: string | null; fecha: string }[],
  hoy: Date,
): boolean {
  const anioHoy = hoy.getFullYear()
  const mesHoy = hoy.getMonth()
  return archivados.some((g) => {
    if (g.origen !== "caja_jazmines_fijo" || g.refId !== costoId || !g.fecha) return false
    const [gy, gm] = g.fecha.split("-").map(Number)
    if (frecuencia === "Anual") return gy === anioHoy
    return gy === anioHoy && gm - 1 === mesHoy
  })
}

// ============================================================
// Hook
// ============================================================
export function useCajaJazmines(state: AppState, salonFiltro?: string, ahora?: Date): CajaJazminData {
  const ahoraMs = ahora ? ahora.getTime() : null
  return useMemo(() => {
    const salonSel = salonFiltro && salonFiltro !== "todos" ? salonFiltro : null
    const hoy = ahora ? new Date(ahora) : new Date()
    hoy.setHours(0, 0, 0, 0)

    const en30Dias = new Date(hoy)
    en30Dias.setDate(en30Dias.getDate() + 30)

    const movimientos: MovimientoCaja[] = (state.movimientosCaja || []).filter(
      (m) => !salonSel || m.salon === salonSel
    )
    const costosOperativos = resolverCostosPorSalon(state.costosOperativos || [], salonSel)
    const eventos = (state.eventos || []).filter(
      (e) => !salonSel || e.salon === salonSel
    )
    const gastosArchivados = state.gastosArchivados || []

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
    const gastosFijosCubiertos: GastoFijoMes[] = []

    // Separar fijos (Mensual/Anual) de variables (esVariable=true)
    const costosFijos = costosOperativos.filter((c) => c.activo && !c.esVariable)
    const costosVariablesStore = costosOperativos.filter((c) => c.activo && c.esVariable === true)

    costosFijos.forEach((costo) => {
        // Si ya se pagó y archivó en el período actual, sale de la lista activa
        // y pasa a "cubiertos" (indicador con tilde verde).
        if (gastoFijoCubierto(costo.id, costo.frecuencia, gastosArchivados, hoy)) {
          gastosFijosCubiertos.push({
            id: costo.id,
            concepto: costo.concepto,
            tipo: costo.tipo,
            frecuencia: costo.frecuencia,
            salon: costo.salon,
            monto: costo.monto,
            estado: "pagado",
            fechaVencimiento: costo.fechaVencimiento,
          })
          return
        }

        const fechaVencStr = costo.fechaVencimiento
        if (!fechaVencStr) {
          gastosFijosMes.push({
            id: costo.id,
            concepto: costo.concepto,
            tipo: costo.tipo,
            frecuencia: costo.frecuencia,
            salon: costo.salon,
            monto: costo.monto,
            estado: costo.pagado ? "pagado" : "ok",
          })
          return
        }

        const fechaVenc = parseLocalDate(fechaVencStr)
        const diasRestantes = Math.ceil(
          (fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
        )

        let estado: EstadoAlerta | "pagado"
        if (costo.pagado) estado = "pagado"
        else if (diasRestantes < 0) estado = "vencido"
        else if (diasRestantes <= 3) estado = "urgente"
        else if (diasRestantes <= 7) estado = "proximo"
        else estado = "ok"

        if (!costo.pagado && diasRestantes <= 30) {
          alertasVencimiento.push({
            id: costo.id,
            concepto: costo.concepto,
            salon: costo.salon,
            monto: costo.monto,
            fechaVencimiento: fechaVencStr,
            diasRestantes,
            estado: estado as EstadoAlerta,
          })
          gastosPróximos30Dias += costo.monto
        }

        if (costo.frecuencia === "Mensual" || costo.frecuencia === "Anual") {
          gastosFijosMes.push({
            id: costo.id,
            concepto: costo.concepto,
            tipo: costo.tipo,
            frecuencia: costo.frecuencia,
            salon: costo.salon,
            monto: costo.monto,
            estado: estado as EstadoAlerta | "pagado",
            fechaVencimiento: fechaVencStr,
          })
        }
      })

    // ----------------------------------------------------------
    // Gastos variables agendados: sumar a gastosPróximos30Dias
    // y emitir alerta si vencen dentro de 15 días (no pagados)
    // ----------------------------------------------------------
    for (const costo of costosVariablesStore) {
      if (costo.pagado) continue
      if (!costo.fechaVencimiento) continue
      const fechaVenc = parseLocalDate(costo.fechaVencimiento)
      const diasRestantes = Math.ceil(
        (fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (diasRestantes <= 30) {
        gastosPróximos30Dias += costo.monto
      }
      // Alerta si vence en 15 días o menos (o ya venció)
      if (diasRestantes <= 15) {
        let estado: EstadoAlerta
        if (diasRestantes < 0) estado = "vencido"
        else if (diasRestantes <= 3) estado = "urgente"
        else if (diasRestantes <= 7) estado = "proximo"
        else estado = "ok"
        alertasVencimiento.push({
          id: costo.id,
          concepto: `[Variable] ${costo.concepto}`,
          salon: costo.salon,
          monto: costo.monto,
          fechaVencimiento: costo.fechaVencimiento,
          diasRestantes,
          estado,
        })
      }
    }
    alertasVencimiento.sort((a, b) => a.diasRestantes - b.diasRestantes)

    // ----------------------------------------------------------
    // 3. INGRESOS PROYECTADOS a 30 días (50% de cuotas pendientes)
    //    + lista completa de cuotas por cobrar (para marcarlas cobradas)
    // ----------------------------------------------------------
    let ingresosProyectados30Dias = 0
    const cuotasPorCobrar: CuotaPorCobrar[] = []

    for (const evento of eventos) {
      if (evento.estado === "cancelado" || evento.estado === "completado") continue
      const plan = evento.planDeCuotas
      if (!plan) continue

      const cuotas = plan.cuotas ?? []
      const cuotasPagadasArr = plan.cuotasPagadas ?? []
      const eventoNombre = evento.nombrePareja || evento.nombre || evento.tipoEvento || "Evento"

      for (const cuota of cuotas) {
        if (cuota.pagada) continue
        if (cuotasPagadasArr.includes(cuota.numero)) continue
        if (!cuota.fechaVencimiento) continue

        const fechaVenc = parseLocalDate(cuota.fechaVencimiento)
        if (fechaVenc >= hoy && fechaVenc <= en30Dias) {
          ingresosProyectados30Dias += cuota.montoCuota / 2
        }

        cuotasPorCobrar.push({
          id: `${evento.id}-cuota-${cuota.numero}`,
          eventoId: evento.id,
          eventoNombre,
          salon: evento.salon || "",
          numeroCuota: cuota.numero,
          totalCuotas: plan.numeroCuotas,
          fechaVencimiento: cuota.fechaVencimiento,
          diasRestantes: Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)),
          montoCuota: cuota.montoCuota,
          montoJazmines: cuota.montoCuota / 2,
        })
      }
    }

    cuotasPorCobrar.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))

    // ----------------------------------------------------------
    // 4. SALDO PROYECTADO A 30 DÍAS
    // ----------------------------------------------------------
    const saldoProyectado30Dias =
      saldoActual + ingresosProyectados30Dias - gastosPróximos30Dias

    // ----------------------------------------------------------
    // 5. GASTOS VARIABLES desde costosOperativos (esVariable=true)
    //    ordenados por fecha de vencimiento ascendente
    // ----------------------------------------------------------
    const gastosVariables: GastoVariable[] = costosVariablesStore
      .map((c) => {
        const fechaVenc = c.fechaVencimiento
          ? parseLocalDate(c.fechaVencimiento)
          : null
        const diasRestantes = fechaVenc
          ? Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
          : null

        let estado: GastoVariable["estado"] = "pendiente"
        if (c.pagado) estado = "pagado"
        else if (diasRestantes !== null && diasRestantes < 0) estado = "vencido"

        return {
          id: c.id,
          nombre: c.concepto,
          salon: c.salon ?? "",
          fecha: c.fechaVencimiento ?? "",
          monto: c.monto,
          estado,
        }
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha))

    return {
      saldoActual,
      gastosPróximos30Dias,
      saldoProyectado30Dias,
      alertasVencimiento,
      gastosFijosMes,
      gastosFijosCubiertos,
      gastosVariables,
      ingresosProyectados30Dias,
      cuotasPorCobrar,
    }
  }, [state.movimientosCaja, state.costosOperativos, state.eventos, state.gastosArchivados, salonFiltro, ahoraMs])
}

"use client"

import { useMemo } from "react"
import type { AppState, CostoOperativo, MovimientoCaja, RegistroMonto } from "../store"
import { salonLabel } from "../store"
import { calcularProporcionCajaEventos } from "../cobrar-cuota"

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
  /** Historial de montos pagados mes a mes (seguimiento de aumentos). */
  historialMontos?: RegistroMonto[]
  /** true si es el sueldo de un vendedor (generado automáticamente, no editable acá) */
  esSueldoVendedor?: boolean
}

export interface GastoVariable {
  id: string
  nombre: string
  salon: string
  fecha: string
  monto: number
  estado: "pendiente" | "pagado" | "vencido"
  /** true si es una comisión de vendedor (generada automáticamente desde los eventos) */
  esComision?: boolean
  /** Detalle de la comisión: quién comisionó, sobre qué evento y con qué % */
  comisionDetalle?: {
    vendedor: string
    eventoNombre: string
    totalEvento: number
    porcentaje: number
    /** ID del evento para poder marcar la comisión como pagada */
    eventoId: string
  }
  /**
   * Solo comisiones: true si ya se puede pagar. Se cumple cuando el evento
   * tiene 4+ cuotas pagadas, o cuando la seña cobrada ya cubre la comisión.
   */
  listaParaPagar?: boolean
  /** Explicación de por qué está lista ("4 cuotas pagadas" / "la seña la cubre") */
  motivoLista?: string
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
  montoJazmines: number // parte que va a Caja Jazmines según la regla del evento
}

export interface MesProyeccionJaz {
  key: string // YYYY-MM
  label: string // "junio 2026"
  aCobrar: number
  aPagar: number
  balance: number
  /** Saldo acumulado: saldo actual de la caja + balances de los meses hasta este inclusive */
  saldoProyectado: number
  esActual: boolean
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
  /** Proyección mes a mes (12 meses): parte Jazmines de cuotas vs gastos fijos+variables */
  proyeccionMensual: MesProyeccionJaz[]
  /** Estimado de gastos fijos a pagar el mes que viene (mensuales + sueldos + anuales que venzan) */
  gastosFijosProximoMes: number
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
            historialMontos: costo.historialMontos,
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
            historialMontos: costo.historialMontos,
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
            historialMontos: costo.historialMontos,
          })
        }
      })

    // ----------------------------------------------------------
    // SUELDOS DE VENDEDORES → gasto fijo mensual automático.
    // Son generales (sin salón), así que solo aparecen sin filtro de salón.
    // ----------------------------------------------------------
    if (!salonSel) {
      for (const v of state.vendedores || []) {
        if (!v.sueldo || v.sueldo <= 0) continue

        // Si tiene fecha de pago, calcular estado y emitir alerta de vencimiento.
        let estadoSueldo: EstadoAlerta = "ok"
        if (v.sueldoFechaPago) {
          const fechaVenc = parseLocalDate(v.sueldoFechaPago)
          const diasRestantes = Math.ceil(
            (fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
          )
          if (diasRestantes < 0) estadoSueldo = "vencido"
          else if (diasRestantes <= 3) estadoSueldo = "urgente"
          else if (diasRestantes <= 7) estadoSueldo = "proximo"

          if (diasRestantes <= 30) {
            alertasVencimiento.push({
              id: `sueldo-vendedor-${v.id}`,
              concepto: `Sueldo vendedor · ${v.emoji ? `${v.emoji} ` : ""}${v.nombre}`,
              salon: null,
              monto: v.sueldo,
              fechaVencimiento: v.sueldoFechaPago,
              diasRestantes,
              estado: estadoSueldo,
            })
            gastosPróximos30Dias += v.sueldo
          }
        }

        gastosFijosMes.push({
          id: `sueldo-vendedor-${v.id}`,
          concepto: `Sueldo vendedor · ${v.emoji ? `${v.emoji} ` : ""}${v.nombre}`,
          tipo: "Personal Fijo",
          frecuencia: "Mensual",
          salon: null,
          monto: v.sueldo,
          estado: estadoSueldo,
          fechaVencimiento: v.sueldoFechaPago,
          esSueldoVendedor: true,
        })
      }
    }

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
    // 3. INGRESOS PROYECTADOS a 30 días (parte Jazmines de cuotas pendientes,
    //    según la regla del evento: resto después de costo+5%, o 50/50 legado)
    //    + lista completa de cuotas por cobrar (para marcarlas cobradas)
    // ----------------------------------------------------------
    const datosCostos = {
      insumos: state.insumos || [],
      insumosBarra: state.insumosBarra || [],
      recetas: state.recetas || [],
      cocteles: state.cocteles || [],
    }
    let ingresosProyectados30Dias = 0
    const cuotasPorCobrar: CuotaPorCobrar[] = []

    for (const evento of eventos) {
      if (evento.estado === "cancelado" || evento.estado === "completado") continue
      const plan = evento.planDeCuotas
      if (!plan) continue

      const cuotas = plan.cuotas ?? []
      const cuotasPagadasArr = plan.cuotasPagadas ?? []
      const eventoNombre = evento.nombrePareja || evento.nombre || evento.tipoEvento || "Evento"
      // Proporción de cada cobro que va a Jazmines = 1 − proporción de Eventos.
      const propJazmines = 1 - calcularProporcionCajaEventos(evento, datosCostos)

      for (const cuota of cuotas) {
        if (cuota.pagada) continue
        if (cuotasPagadasArr.includes(cuota.numero)) continue
        if (!cuota.fechaVencimiento) continue

        const fechaVenc = parseLocalDate(cuota.fechaVencimiento)
        if (fechaVenc >= hoy && fechaVenc <= en30Dias) {
          ingresosProyectados30Dias += cuota.montoCuota * propJazmines
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
          montoJazmines: cuota.montoCuota * propJazmines,
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
        } as GastoVariable
      })

    // ----------------------------------------------------------
    // COMISIONES DE VENDEDORES → gasto variable automático por evento vendido.
    // Muestra el total del evento, el % del vendedor y el nombre de ambos.
    // ----------------------------------------------------------
    const vendedoresPorNombre = new Map(
      (state.vendedores || []).map((v) => [v.nombre.toLowerCase(), v]),
    )
    for (const evento of eventos) {
      if (evento.estado === "cancelado") continue
      const nombreVendedor = evento.contrato?.vendedor
      if (!nombreVendedor) continue
      const vendedor = vendedoresPorNombre.get(nombreVendedor.toLowerCase())
      if (!vendedor || !vendedor.comisionPct || vendedor.comisionPct <= 0) continue

      const totalEvento =
        evento.planDeCuotas && evento.planDeCuotas.montoTotal > 0
          ? evento.planDeCuotas.montoTotal
          : evento.precioVenta || 0
      if (totalEvento <= 0) continue

      const eventoNombre = evento.nombrePareja || evento.nombre || evento.tipoEvento || "Evento"
      const montoComision = Math.round((totalEvento * vendedor.comisionPct) / 100)

      // ¿Lista para pagar? Se cumple con 4+ cuotas pagadas del evento,
      // o si la seña ya cobrada (movimiento real en cajas) cubre la comisión.
      const plan = evento.planDeCuotas
      const cuotasPagadasCount = Math.max(
        plan?.cuotasPagadas?.length ?? 0,
        (plan?.cuotas ?? []).filter((c) => c.pagada).length,
      )
      const señaCobrada = (state.movimientosCaja || [])
        .filter(
          (m) =>
            m.eventoId === evento.id &&
            m.tipo === "ingreso" &&
            /^Seña/i.test(m.concepto || ""),
        )
        .reduce((s, m) => s + m.monto, 0)
      let listaParaPagar = false
      let motivoLista: string | undefined
      if (cuotasPagadasCount >= 4) {
        listaParaPagar = true
        motivoLista = `${cuotasPagadasCount} cuotas pagadas`
      } else if (señaCobrada > 0 && señaCobrada >= montoComision) {
        listaParaPagar = true
        motivoLista = "la seña cobrada la cubre"
      }

      gastosVariables.push({
        id: `comision-${vendedor.id}-${evento.id}`,
        nombre: `Comisión ${vendedor.emoji ? `${vendedor.emoji} ` : ""}${vendedor.nombre} · ${eventoNombre}`,
        salon: evento.salon || "",
        fecha: evento.fecha || "",
        monto: montoComision,
        estado: evento.comisionPagada ? "pagado" : "pendiente",
        esComision: true,
        comisionDetalle: {
          vendedor: vendedor.nombre,
          eventoNombre,
          totalEvento,
          porcentaje: vendedor.comisionPct,
          eventoId: evento.id,
        },
        listaParaPagar,
        motivoLista,
      })
    }

    gastosVariables.sort((a, b) => a.fecha.localeCompare(b.fecha))

    // ----------------------------------------------------------
    // 6. PROYECCIÓN MENSUAL (próximos 12 meses incluyendo el actual)
    //    A cobrar: parte Jazmines de las cuotas pendientes por mes.
    //    A pagar: fijos mensuales recurrentes + sueldos + anuales en su mes
    //    + variables agendados en su mes.
    // ----------------------------------------------------------
    const mesKeyJaz = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const mesLabelJaz = (d: Date) => d.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    const mesActualKeyJaz = mesKeyJaz(hoy)

    // Recurrentes de todos los meses: fijos mensuales activos + sueldos de vendedores
    const totalFijosMensuales = costosFijos
      .filter((c) => c.frecuencia === "Mensual")
      .reduce((s, c) => s + c.monto, 0)
    const totalSueldosVendedores = !salonSel
      ? (state.vendedores || []).reduce((s, v) => s + (v.sueldo && v.sueldo > 0 ? v.sueldo : 0), 0)
      : 0
    const recurrenteMensual = totalFijosMensuales + totalSueldosVendedores

    const proyeccionMensual: MesProyeccionJaz[] = []
    const idxPorKeyJaz: Record<string, number> = {}
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
      const key = mesKeyJaz(d)
      idxPorKeyJaz[key] = proyeccionMensual.length
      proyeccionMensual.push({
        key,
        label: mesLabelJaz(d),
        aCobrar: 0,
        aPagar: recurrenteMensual,
        balance: 0,
        saldoProyectado: 0,
        esActual: key === mesActualKeyJaz,
      })
    }

    // A cobrar: cuotas pendientes (parte Jazmines) en su mes de vencimiento
    for (const c of cuotasPorCobrar) {
      const idx = idxPorKeyJaz[c.fechaVencimiento.slice(0, 7)]
      if (idx !== undefined) proyeccionMensual[idx].aCobrar += c.montoJazmines
    }
    // Fijos anuales: pegan solo en el mes de su vencimiento (cada año dentro de la ventana)
    for (const c of costosFijos) {
      if (c.frecuencia !== "Anual" || !c.fechaVencimiento) continue
      const [, mm] = c.fechaVencimiento.split("-").map(Number)
      for (const mes of proyeccionMensual) {
        if (Number(mes.key.slice(5, 7)) === mm) mes.aPagar += c.monto
      }
    }
    // Variables agendados no pagados: en su mes de vencimiento
    for (const c of costosVariablesStore) {
      if (c.pagado || !c.fechaVencimiento) continue
      const idx = idxPorKeyJaz[c.fechaVencimiento.slice(0, 7)]
      if (idx !== undefined) proyeccionMensual[idx].aPagar += c.monto
    }
    // Balance de cada mes + saldo acumulado partiendo del saldo ACTUAL de la
    // caja: si se extrae/ingresa dinero hoy, toda la proyección se corre sola.
    let saldoAcumuladoJaz = saldoActual
    proyeccionMensual.forEach((m) => {
      m.balance = m.aCobrar - m.aPagar
      saldoAcumuladoJaz += m.balance
      m.saldoProyectado = saldoAcumuladoJaz
    })

    // Estimado de gastos fijos del MES QUE VIENE (tarjeta "a pagar de servicios"):
    // el aPagar del segundo mes de la proyección, sin los variables agendados
    // (solo fijos mensuales + sueldos + anuales que venzan ese mes).
    const mesProximo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)
    const mesProximoKey = mesKeyJaz(mesProximo)
    let gastosFijosProximoMes = recurrenteMensual
    for (const c of costosFijos) {
      if (c.frecuencia !== "Anual" || !c.fechaVencimiento) continue
      const [, mm] = c.fechaVencimiento.split("-").map(Number)
      if (Number(mesProximoKey.slice(5, 7)) === mm) gastosFijosProximoMes += c.monto
    }

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
      proyeccionMensual,
      gastosFijosProximoMes,
    }
  }, [state.movimientosCaja, state.costosOperativos, state.eventos, state.gastosArchivados, state.vendedores, state.insumos, state.insumosBarra, state.recetas, state.cocteles, salonFiltro, ahoraMs])
}

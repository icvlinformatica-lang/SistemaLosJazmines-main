"use client"

import { useMemo } from "react"
import { calcularComprasBarras, type AppState, type MovimientoCaja } from "../store"

// ============================================================
// Tipos de salida
// ============================================================

export interface ClienteContacto {
  nombre: string
  telefono?: string
  email?: string
  direccion?: string
  dni?: string
}

export interface IngresoPendiente {
  id: string
  eventoId: string
  eventoNombre: string
  salon: string
  numeroCuota: number
  totalCuotas: number
  fechaVencimiento: string // YYYY-MM-DD
  diasRestantes: number
  monto: number // 50% que va a Caja Eventos
  montoTotal: number // cuota completa
  contacto: ClienteContacto
  esEstaSemana: boolean
}

export interface EgresoPendienteServicio {
  id: string
  eventoId: string
  eventoNombre: string
  servicioNombre: string
  servicioId?: string // presente para egresos de servicios (no menú/barra)
  tipo: "seña" | "saldo" | "menu" | "barra"
  monto: number
  fechaVencimiento: string // YYYY-MM-DD
  diasRestantes: number
  estadoPago: "sin_seña" | "señado" | "saldo_pendiente" | "pagado_total"
}

export interface PagoRealizado {
  id: string
  fecha: string // ISO string
  concepto: string
  eventoId?: string
  eventoNombre: string
  salon: string
  monto: number
  tipoPago: "menu" | "barra" | "seña" | "saldo" | "otro"
  servicioNombre?: string // presente para pagos de servicios (seña/saldo)
}

export interface MesProyeccion {
  key: string // YYYY-MM
  label: string // "junio 2026"
  aCobrar: number
  aPagar: number
  balance: number
  esActual: boolean
}

export interface CajaEventosData {
  saldoActual: number
  porCobrarEsteMes: number
  porPagarEsteMes: number
  saldoFinMes: number
  proyeccionMensual: MesProyeccion[]
  ingresosPendientes: IngresoPendiente[]
  egresosPendientes: EgresoPendienteServicio[]
  pagosRealizados: PagoRealizado[]
  vienenEstaSemana: IngresoPendiente[]
  totalPorCobrar: number
  totalPorPagar: number
  mesActualLabel: string
}

// ============================================================
// Helpers
// ============================================================
function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00")
}

function mesKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function mesLabel(d: Date): string {
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

// ============================================================
// Hook
// ============================================================
export function useCajaEventos(state: AppState): CajaEventosData {
  return useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    // Lunes -> Viernes de la semana actual (trabajamos L-V 09-20hs)
    const diaSemana = hoy.getDay() // 0=domingo, 1=lunes...
    const offsetLunes = diaSemana === 0 ? -6 : 1 - diaSemana
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() + offsetLunes)
    const viernes = new Date(lunes)
    viernes.setDate(lunes.getDate() + 4)

    const mesActualKey = mesKey(hoy)
    const mesActualLabel = mesLabel(hoy)

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
    // 2. INGRESOS PENDIENTES (cuotas por cobrar) + proyección mensual
    // ----------------------------------------------------------
    const ingresosPendientes: IngresoPendiente[] = []

    for (const evento of eventos) {
      if (evento.estado === "cancelado" || evento.estado === "completado") continue
      const plan = evento.planDeCuotas
      if (!plan) continue

      const cuotas = plan.cuotas ?? []
      const cuotasPagadasArr = plan.cuotasPagadas ?? []
      const contacto: ClienteContacto = {
        nombre: evento.contrato?.nombreCompleto || evento.nombrePareja || evento.nombre || "Sin nombre",
        telefono: evento.contrato?.telefono,
        email: evento.contrato?.email,
        direccion: evento.contrato?.direccion,
        dni: evento.contrato?.dni,
      }

      for (const cuota of cuotas) {
        if (cuota.pagada) continue
        if (cuotasPagadasArr.includes(cuota.numero)) continue
        if (!cuota.fechaVencimiento) continue

        const fechaVenc = parseLocalDate(cuota.fechaVencimiento)
        const diasRestantes = Math.ceil(
          (fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
        )
        const fechaVencDia = new Date(fechaVenc)
        fechaVencDia.setHours(0, 0, 0, 0)
        const esEstaSemana = fechaVencDia >= lunes && fechaVencDia <= viernes

        ingresosPendientes.push({
          id: `${evento.id}-cuota-${cuota.numero}`,
          eventoId: evento.id,
          eventoNombre: evento.nombrePareja || evento.nombre || evento.tipoEvento || "Evento",
          salon: evento.salon || "",
          numeroCuota: cuota.numero,
          totalCuotas: plan.numeroCuotas,
          fechaVencimiento: cuota.fechaVencimiento,
          diasRestantes,
          monto: cuota.montoCuota / 2,
          montoTotal: cuota.montoCuota,
          contacto,
          esEstaSemana,
        })
      }
    }

    ingresosPendientes.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))

    // ----------------------------------------------------------
    // 3. EGRESOS PENDIENTES DE SERVICIOS (pagos a proveedores)
    // ----------------------------------------------------------
    const egresosPendientes: EgresoPendienteServicio[] = []

    for (const evento of eventos) {
      if (evento.estado === "cancelado" || evento.estado === "completado") continue
      const serviciosEvento = evento.servicios ?? []
      const eventoNombre = evento.nombrePareja || evento.nombre || evento.tipoEvento || "Evento"

      // --- Costo del MENÚ del evento ---
      // Se paga 2 semanas (14 días) antes de la fecha del evento.
      // El estado "pagado" se deriva de la existencia de un movimiento de egreso
      // de menú asociado a este evento en Caja Eventos.
      const costoMenu = evento.costoInsumos ?? 0
      if (costoMenu > 0 && evento.fecha) {
        const fechaEvento = parseLocalDate(evento.fecha)
        const fechaPagoMenu = new Date(fechaEvento)
        fechaPagoMenu.setDate(fechaEvento.getDate() - 14)
        const fechaPagoMenuStr = `${fechaPagoMenu.getFullYear()}-${String(fechaPagoMenu.getMonth() + 1).padStart(2, "0")}-${String(fechaPagoMenu.getDate()).padStart(2, "0")}`

        const menuPagado = evento.cocinaPagada === true

        if (!menuPagado) {
          egresosPendientes.push({
            id: `${evento.id}-menu`,
            eventoId: evento.id,
            eventoNombre,
            servicioNombre: "Menú del evento",
            tipo: "menu",
            monto: costoMenu,
            fechaVencimiento: fechaPagoMenuStr,
            diasRestantes: Math.ceil((fechaPagoMenu.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)),
            estadoPago: "saldo_pendiente",
          })
        }
      }

      // --- Costo de la BARRA del evento ---
      // Insumos de bebidas (cocteles) calculados según comensales y precio de insumos.
      // Se paga 2 semanas (14 días) antes de la fecha del evento, igual que el menú.
      const comprasBarra = calcularComprasBarras(evento, state.cocteles || [], state.insumosBarra || [])
      const costoBarra = comprasBarra.reduce((sum, c) => sum + c.costoMateriaPrima, 0)
      if (costoBarra > 0 && evento.fecha) {
        const fechaEvento = parseLocalDate(evento.fecha)
        const fechaPagoBarra = new Date(fechaEvento)
        fechaPagoBarra.setDate(fechaEvento.getDate() - 14)
        const fechaPagoBarraStr = `${fechaPagoBarra.getFullYear()}-${String(fechaPagoBarra.getMonth() + 1).padStart(2, "0")}-${String(fechaPagoBarra.getDate()).padStart(2, "0")}`

        const barraPagada = evento.barraPagada === true

        if (!barraPagada) {
          egresosPendientes.push({
            id: `${evento.id}-barra`,
            eventoId: evento.id,
            eventoNombre,
            servicioNombre: "Barra del evento",
            tipo: "barra",
            monto: costoBarra,
            fechaVencimiento: fechaPagoBarraStr,
            diasRestantes: Math.ceil((fechaPagoBarra.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)),
            estadoPago: "saldo_pendiente",
          })
        }
      }

      for (const srv of serviciosEvento) {
        const estadoPago = srv.estadoPago ?? "sin_seña"

        if (
          estadoPago === "sin_seña" &&
          srv.montoSeña &&
          srv.montoSeña > 0 &&
          srv.fechaSeña
        ) {
          const fechaVenc = parseLocalDate(srv.fechaSeña)
          egresosPendientes.push({
            id: `${evento.id}-${srv.servicioId}-seña`,
            eventoId: evento.id,
            eventoNombre,
            servicioNombre: srv.nombre,
            servicioId: srv.servicioId,
            tipo: "seña",
            monto: srv.montoSeña,
            fechaVencimiento: srv.fechaSeña,
            diasRestantes: Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)),
            estadoPago,
          })
        }

        if (
          estadoPago !== "pagado_total" &&
          srv.saldoPendiente &&
          srv.saldoPendiente > 0 &&
          srv.fechaLimitePago
        ) {
          const fechaVenc = parseLocalDate(srv.fechaLimitePago)
          egresosPendientes.push({
            id: `${evento.id}-${srv.servicioId}-saldo`,
            eventoId: evento.id,
            eventoNombre,
            servicioNombre: srv.nombre,
            servicioId: srv.servicioId,
            tipo: "saldo",
            monto: srv.saldoPendiente,
            fechaVencimiento: srv.fechaLimitePago,
            diasRestantes: Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)),
            estadoPago,
          })
        }
      }
    }

    egresosPendientes.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))

    // ----------------------------------------------------------
    // 4. PROYECCIÓN MENSUAL (próximos 6 meses incluyendo el actual)
    // ----------------------------------------------------------
    const meses: MesProyeccion[] = []
    const indexPorKey: Record<string, number> = {}
    for (let i = 0; i < 6; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
      const key = mesKey(d)
      indexPorKey[key] = meses.length
      meses.push({
        key,
        label: mesLabel(d),
        aCobrar: 0,
        aPagar: 0,
        balance: 0,
        esActual: key === mesActualKey,
      })
    }

    for (const ing of ingresosPendientes) {
      const key = ing.fechaVencimiento.slice(0, 7)
      const idx = indexPorKey[key]
      if (idx !== undefined) meses[idx].aCobrar += ing.monto
    }
    for (const eg of egresosPendientes) {
      const key = eg.fechaVencimiento.slice(0, 7)
      const idx = indexPorKey[key]
      if (idx !== undefined) meses[idx].aPagar += eg.monto
    }
    meses.forEach((m) => {
      m.balance = m.aCobrar - m.aPagar
    })

    const porCobrarEsteMes = meses[0]?.aCobrar ?? 0
    const porPagarEsteMes = meses[0]?.aPagar ?? 0
    const saldoFinMes = saldoActual + porCobrarEsteMes - porPagarEsteMes

    const totalPorCobrar = ingresosPendientes.reduce((s, i) => s + i.monto, 0)
    const totalPorPagar = egresosPendientes.reduce((s, e) => s + e.monto, 0)

    const vienenEstaSemana = ingresosPendientes.filter((i) => i.esEstaSemana)

    // ----------------------------------------------------------
    // 5. HISTORIAL DE PAGOS REALIZADOS (egresos a proveedores)
    // ----------------------------------------------------------
    const eventoNombrePorId: Record<string, string> = {}
    for (const ev of eventos) {
      eventoNombrePorId[ev.id] = ev.nombrePareja || ev.nombre || ev.tipoEvento || "Evento"
    }
    const pagosRealizados: PagoRealizado[] = movimientos
      .filter((m) => m.cajaDestino === "caja_eventos" && m.tipo === "egreso")
      .map((m) => {
        const concepto = m.concepto || "Pago"
        // Derivar el tipo de pago y el servicio desde el concepto generado al pagar.
        // Formatos: "Pago menú - X", "Pago barra - X", "Pago seña {servicio} - X", "Pago saldo {servicio} - X"
        let tipoPago: PagoRealizado["tipoPago"] = "otro"
        let servicioNombre: string | undefined
        if (/^Pago menú/i.test(concepto)) {
          tipoPago = "menu"
        } else if (/^Pago barra/i.test(concepto)) {
          tipoPago = "barra"
        } else {
          const matchServicio = concepto.match(/^Pago (seña|saldo) (.+?) - /i)
          if (matchServicio) {
            tipoPago = matchServicio[1].toLowerCase() === "seña" ? "seña" : "saldo"
            servicioNombre = matchServicio[2]
          }
        }
        return {
          id: m.id,
          fecha: m.fecha,
          concepto,
          eventoId: m.eventoId,
          eventoNombre: m.eventoId ? eventoNombrePorId[m.eventoId] || "" : "",
          salon: m.salon || "",
          monto: m.monto,
          tipoPago,
          servicioNombre,
        }
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))

    return {
      saldoActual,
      porCobrarEsteMes,
      porPagarEsteMes,
      saldoFinMes,
      proyeccionMensual: meses,
      ingresosPendientes,
      egresosPendientes,
      pagosRealizados,
      vienenEstaSemana,
      totalPorCobrar,
      totalPorPagar,
      mesActualLabel,
    }
  }, [state.movimientosCaja, state.eventos, state.cocteles, state.insumosBarra])
}

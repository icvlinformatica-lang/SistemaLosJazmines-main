"use client"

import { useMemo } from "react"
import { calcularComprasBarras, calcularComprasSegmentadas, type AppState, type MovimientoCaja } from "../store"

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
  esVencida: boolean // fecha de vencimiento ya pasó (debería haberse cobrado)
}

export interface EgresoPendienteServicio {
  id: string
  eventoId: string
  eventoNombre: string
  salon: string
  servicioNombre: string
  servicioId?: string // presente para egresos de servicios (no menú/barra); para sueldos es el id de la entrada de personal
  tipo: "seña" | "saldo" | "menu" | "barra" | "sueldo"
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
  tipoPago: "menu" | "barra" | "seña" | "saldo" | "sueldo" | "otro"
  servicioNombre?: string // presente para pagos de servicios (seña/saldo) y sueldos
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
export function useCajaEventos(state: AppState, salonFiltro?: string, ahora?: Date): CajaEventosData {
  const ahoraMs = ahora ? ahora.getTime() : null
  return useMemo(() => {
    const salonSel = salonFiltro && salonFiltro !== "todos" ? salonFiltro : null
    const hoy = ahora ? new Date(ahora) : new Date()
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

    const movimientos: MovimientoCaja[] = (state.movimientosCaja || []).filter(
      (m) => !salonSel || m.salon === salonSel
    )
    const eventos = (state.eventos || []).filter(
      (e) => !salonSel || e.salon === salonSel
    )

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
        // Vencida = la fecha de vencimiento ya pasó (debería haberse cobrado)
        const esVencida = fechaVencDia < hoy

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
          esVencida,
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
      //
      // El costo se recalcula EN VIVO con los precios actuales del almacén, en
      // lugar de usar la foto guardada `evento.costoInsumos` (que puede quedar
      // desactualizada si los precios cambiaron desde que se creó el evento).
      //
      // IMPORTANTE: el menú es SOLO cocina. La barra tiene su propio ítem de
      // egreso más abajo; incluirla acá duplicaría su costo en los pendientes.
      const comprasCocina = calcularComprasSegmentadas(evento, state.recetas || [], state.insumos || [])
      const costoMenuLive = comprasCocina.reduce((sum, c) => sum + c.costoMateriaPrima, 0)
      const barraLive = calcularComprasBarras(evento, state.cocteles || [], state.insumosBarra || []).reduce(
        (sum, c) => sum + c.costoMateriaPrima,
        0,
      )
      // Fallback a la foto guardada (que incluía cocina+barra) restándole la barra.
      const costoMenu = costoMenuLive > 0 ? costoMenuLive : Math.max(0, (evento.costoInsumos ?? 0) - barraLive)
      if (costoMenu > 0 && evento.fecha) {
        const fechaEvento = parseLocalDate(evento.fecha)
        // Fecha editada manualmente tiene prioridad; si no, evento - 14 días.
        let fechaPagoMenuStr: string
        let fechaPagoMenu: Date
        if (evento.fechaPagoMenu) {
          fechaPagoMenuStr = evento.fechaPagoMenu
          fechaPagoMenu = parseLocalDate(evento.fechaPagoMenu)
        } else {
          fechaPagoMenu = new Date(fechaEvento)
          fechaPagoMenu.setDate(fechaEvento.getDate() - 14)
          fechaPagoMenuStr = `${fechaPagoMenu.getFullYear()}-${String(fechaPagoMenu.getMonth() + 1).padStart(2, "0")}-${String(fechaPagoMenu.getDate()).padStart(2, "0")}`
        }

        const menuPagado = evento.cocinaPagada === true

        if (!menuPagado) {
          egresosPendientes.push({
            id: `${evento.id}-menu`,
            eventoId: evento.id,
            eventoNombre,
            salon: evento.salon || "",
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
        // Fecha editada manualmente tiene prioridad; si no, evento - 14 días.
        let fechaPagoBarraStr: string
        let fechaPagoBarra: Date
        if (evento.fechaPagoBarra) {
          fechaPagoBarraStr = evento.fechaPagoBarra
          fechaPagoBarra = parseLocalDate(evento.fechaPagoBarra)
        } else {
          fechaPagoBarra = new Date(fechaEvento)
          fechaPagoBarra.setDate(fechaEvento.getDate() - 14)
          fechaPagoBarraStr = `${fechaPagoBarra.getFullYear()}-${String(fechaPagoBarra.getMonth() + 1).padStart(2, "0")}-${String(fechaPagoBarra.getDate()).padStart(2, "0")}`
        }

        const barraPagada = evento.barraPagada === true

        if (!barraPagada) {
          egresosPendientes.push({
            id: `${evento.id}-barra`,
            eventoId: evento.id,
            eventoNombre,
            salon: evento.salon || "",
            servicioNombre: "Barra del evento",
            tipo: "barra",
            monto: costoBarra,
            fechaVencimiento: fechaPagoBarraStr,
            diasRestantes: Math.ceil((fechaPagoBarra.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)),
            estadoPago: "saldo_pendiente",
          })
        }
      }

      // --- COMPROMISOS de personal asignados manualmente (Finanzas → Personal) ---
      // Vencen en su fechaLimitePago (por defecto, el día del evento).
      const compromisosEvento = (state.pagosPersonal || []).filter(
        (pp) => pp.eventoId === evento.id && pp.estado !== "pagado"
      )
      for (const pp of compromisosEvento) {
        const montoPendiente = pp.montoTotal - (pp.montoSeña || 0)
        if (montoPendiente <= 0) continue
        // Prioridad: fecha límite editada > fecha ACTUAL del evento (en vivo,
        // por si se reprogramó) > foto de la fecha guardada en el compromiso.
        const fechaVenc = pp.fechaLimitePago || evento.fecha || pp.fechaEvento
        if (!fechaVenc) continue
        const fechaVencDate = parseLocalDate(fechaVenc)
        egresosPendientes.push({
          id: `${evento.id}-compromiso-${pp.id}`,
          eventoId: evento.id,
          eventoNombre,
          salon: evento.salon || "",
          servicioNombre: `${pp.nombrePersonal} (${pp.servicioNombre})`,
          servicioId: pp.id,
          tipo: "sueldo",
          monto: montoPendiente,
          fechaVencimiento: fechaVenc,
          diasRestantes: Math.ceil((fechaVencDate.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)),
          estadoPago: "saldo_pendiente",
        })
      }

      // --- SUELDOS del personal del evento ---
      // Cargados desde el generador de evento/contrato (sección Personal).
      // Vencen el mismo día del evento.
      const personalDelEvento = evento.personalEvento ?? []
      if (personalDelEvento.length > 0 && evento.fecha) {
        const fechaEvento = parseLocalDate(evento.fecha)
        const fechaEventoStr = evento.fecha
        for (const pe of personalDelEvento) {
          if (pe.pagado) continue
          if (!pe.monto || pe.monto <= 0) continue
          // Fecha de pago editada manualmente tiene prioridad; si no, el día del evento.
          const fechaVencSueldo = pe.fechaPago || fechaEventoStr
          const fechaVencSueldoDate = pe.fechaPago ? parseLocalDate(pe.fechaPago) : fechaEvento
          egresosPendientes.push({
            id: `${evento.id}-sueldo-${pe.id}`,
            eventoId: evento.id,
            eventoNombre,
            salon: evento.salon || "",
            servicioNombre: `${pe.nombre} (${pe.funcion})`,
            servicioId: pe.id,
            tipo: "sueldo",
            monto: pe.monto,
            fechaVencimiento: fechaVencSueldo,
            diasRestantes: Math.ceil((fechaVencSueldoDate.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)),
            estadoPago: "saldo_pendiente",
          })
        }
      }

      for (const srv of serviciosEvento) {
        const estadoPago = srv.estadoPago ?? "sin_seña"

        // Vencimientos EN VIVO según la fecha ACTUAL del evento:
        // si se reprograma el evento, la seña y el saldo se corren solos
        // (fecha del evento − días de anticipación del catálogo).
        // Prioridad: override manual > cálculo en vivo > foto guardada.
        const catalogoSrv = (state.servicios || []).find((s) => s.id === srv.servicioId)
        const toYMDLocal = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        let fechaSeñaLive: string | undefined
        let fechaSaldoLive: string | undefined
        if (evento.fecha) {
          const fechaEvento = parseLocalDate(evento.fecha)
          const dSeña = new Date(fechaEvento)
          dSeña.setDate(fechaEvento.getDate() - (catalogoSrv?.diasAnticipacionSeña ?? 30))
          fechaSeñaLive = toYMDLocal(dSeña)
          const dSaldo = new Date(fechaEvento)
          dSaldo.setDate(fechaEvento.getDate() - (catalogoSrv?.diasAnticipacionSaldo ?? 7))
          fechaSaldoLive = toYMDLocal(dSaldo)
        }
        const fechaSeñaFinal = srv.fechaSeñaManual || fechaSeñaLive || srv.fechaSeña
        const fechaSaldoFinal = srv.fechaSaldoManual || fechaSaldoLive || srv.fechaLimitePago

        if (
          estadoPago === "sin_seña" &&
          srv.montoSeña &&
          srv.montoSeña > 0 &&
          fechaSeñaFinal
        ) {
          const fechaVenc = parseLocalDate(fechaSeñaFinal)
          egresosPendientes.push({
            id: `${evento.id}-${srv.servicioId}-seña`,
            eventoId: evento.id,
            eventoNombre,
            salon: evento.salon || "",
            servicioNombre: srv.nombre,
            servicioId: srv.servicioId,
            tipo: "seña",
            monto: srv.montoSeña,
            fechaVencimiento: fechaSeñaFinal,
            diasRestantes: Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)),
            estadoPago,
          })
        }

        if (
          estadoPago !== "pagado_total" &&
          srv.saldoPendiente &&
          srv.saldoPendiente > 0 &&
          fechaSaldoFinal
        ) {
          const fechaVenc = parseLocalDate(fechaSaldoFinal)
          egresosPendientes.push({
            id: `${evento.id}-${srv.servicioId}-saldo`,
            eventoId: evento.id,
            eventoNombre,
            salon: evento.salon || "",
            servicioNombre: srv.nombre,
            servicioId: srv.servicioId,
            tipo: "saldo",
            monto: srv.saldoPendiente,
            fechaVencimiento: fechaSaldoFinal,
            diasRestantes: Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)),
            estadoPago,
          })
        }
      }
    }

    egresosPendientes.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))

    // ----------------------------------------------------------
    // 4. PROYECCIÓN MENSUAL (próximos 12 meses incluyendo el actual)
    // ----------------------------------------------------------
    const meses: MesProyeccion[] = []
    const indexPorKey: Record<string, number> = {}
    for (let i = 0; i < 12; i++) {
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

    // Incluye cuotas a cobrar esta semana Y cuotas ya vencidas (que deberían
    // haberse cobrado). Las vencidas van primero por ser las más urgentes; luego
    // por fecha de vencimiento (más antigua primero).
    const vienenEstaSemana = ingresosPendientes
      .filter((i) => i.esEstaSemana || i.esVencida)
      .sort((a, b) => {
        if (a.esVencida !== b.esVencida) return a.esVencida ? -1 : 1
        return a.fechaVencimiento.localeCompare(b.fechaVencimiento)
      })

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
        } else if (/^Pago sueldo/i.test(concepto)) {
          tipoPago = "sueldo"
          const matchSueldo = concepto.match(/^Pago sueldo (.+?) - /i)
          if (matchSueldo) servicioNombre = matchSueldo[1]
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
  }, [state.movimientosCaja, state.eventos, state.cocteles, state.insumosBarra, state.recetas, state.insumos, state.servicios, state.pagosPersonal, salonFiltro, ahoraMs])
}

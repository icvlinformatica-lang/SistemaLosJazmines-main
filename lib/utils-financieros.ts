import type {
  EgresoUnificado,
  IngresoEsperado,
  ResumenFinanciero,
  FiltrosEgresos,
} from "./tipos-financieros"
import type {
  CostoOperativo,
  EventoGuardado,
  PagoPersonal,
  PersonalEvento,
} from "./store"

// ==========================================
// FUNCIONES DE FORMATO
// ==========================================

/**
 * Formatea un valor numérico como moneda ARS.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Formatea una fecha ISO string a formato legible.
 */
export function formatearFecha(
  fecha: string,
  formato: "corto" | "largo" = "corto"
): string {
  try {
    const date = new Date(fecha + "T12:00:00") // Evitar problemas de timezone
    if (formato === "largo") {
      return date.toLocaleDateString("es-AR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    }
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  } catch {
    return fecha
  }
}

/**
 * Retorna un color CSS según el estado de un egreso.
 */
export function getColorEstado(
  estado: EgresoUnificado["estado"]
): string {
  switch (estado) {
    case "vencido":
      return "text-red-600"
    case "urgente":
      return "text-amber-600"
    case "pendiente":
      return "text-sky-600"
    case "pagado":
      return "text-emerald-600"
    case "archivado":
      return "text-gray-500"
    default:
      return "text-foreground"
  }
}

// ==========================================
// GENERADORES DE DATOS UNIFICADOS
// ==========================================

/**
 * Genera una lista unificada de egresos a partir de gastos fijos,
 * servicios de eventos y pagos a personal.
 */
export function generarEgresosUnificados(
  costosOperativos: CostoOperativo[],
  eventos: EventoGuardado[],
  pagosPersonal: PagoPersonal[],
  personal: PersonalEvento[],
  diasAnticipacion: number = 7
): EgresoUnificado[] {
  const egresos: EgresoUnificado[] = []
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  // 1. Gastos fijos (costos operativos activos con fechaVencimiento)
  costosOperativos
    .filter((c) => c.activo)
    .forEach((costo) => {
      const fechaVenc = costo.fechaVencimiento || ""
      const diasRest = fechaVenc
        ? Math.ceil(
            (new Date(fechaVenc + "T12:00:00").getTime() - hoy.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : undefined

      let estado: EgresoUnificado["estado"] = "pendiente"
      if (diasRest !== undefined) {
        if (diasRest < 0) estado = "vencido"
        else if (diasRest <= 3) estado = "urgente"
      }

      egresos.push({
        id: `gf-${costo.id}`,
        tipo: "gasto-fijo",
        concepto: costo.concepto,
        descripcion: costo.notas,
        monto: costo.monto,
        estado,
        fechaVencimiento: fechaVenc || hoy.toISOString().split("T")[0],
        diasRestantes: diasRest,
        archivaAutomatico: false,
        detalles: {
          salon: costo.salon,
          gastoFijoId: costo.id,
          frecuencia: costo.frecuencia,
        },
      })
    })

  // 2. Servicios de eventos (solo eventos activos y proximos)
  eventos
    .filter(
      (e) => e.estado !== "cancelado" && e.estado !== "completado"
    )
    .forEach((evento) => {
      const fechaEvento = new Date(evento.fecha + "T12:00:00")
      const diasAlEvento = Math.ceil(
        (fechaEvento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Solo incluir eventos dentro de la ventana de anticipacion
      if (diasAlEvento > diasAnticipacion * 4 || diasAlEvento < -7) return

      const eventoNombre =
        evento.nombrePareja || evento.nombre || evento.tipoEvento || "Evento"

      // Servicios del evento
      evento.servicios?.forEach((servicio, idx) => {
        const fechaVenc = new Date(fechaEvento)
        fechaVenc.setDate(fechaVenc.getDate() - diasAnticipacion)
        const fechaVencStr = fechaVenc.toISOString().split("T")[0]

        const diasRest = Math.ceil(
          (fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
        )

        let estado: EgresoUnificado["estado"] = "pendiente"
        if ((servicio as Record<string, unknown>).pagado) estado = "pagado"
        else if (diasRest < 0) estado = "vencido"
        else if (diasRest <= 3) estado = "urgente"

        egresos.push({
          id: `srv-${evento.id}-${idx}`,
          tipo: "servicio-evento",
          concepto: servicio.nombre,
          monto: servicio.precioUnitario * servicio.cantidad,
          estado,
          fechaVencimiento: fechaVencStr,
          diasRestantes: diasRest,
          eventoId: evento.id,
          eventoNombre,
          eventoFecha: evento.fecha,
          archivaAutomatico: true,
          detalles: {
            proveedor: servicio.proveedor || undefined,
            servicioIdx: idx,
          },
        })
      })
    })

  // 3. Pagos a personal
  pagosPersonal.forEach((pago) => {
    const evento = eventos.find((e) => e.id === pago.eventoId)
    const persona = personal.find((p) => p.id === pago.personalId)

    const fechaVenc = pago.fechaLimitePago || pago.fechaEvento
    const diasRest = fechaVenc
      ? Math.ceil(
          (new Date(fechaVenc + "T12:00:00").getTime() - hoy.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : undefined

    let estado: EgresoUnificado["estado"] = pago.estado as EgresoUnificado["estado"]
    if (estado !== "pagado" && diasRest !== undefined) {
      if (diasRest < 0) estado = "vencido"
      else if (diasRest <= 3) estado = "urgente"
      else estado = "pendiente"
    }

    const eventoNombre = evento
      ? evento.nombrePareja || evento.nombre || evento.tipoEvento || "Evento"
      : "Evento eliminado"

    egresos.push({
      id: `per-${pago.id}`,
      tipo: "personal",
      concepto: `${pago.nombrePersonal} - ${pago.servicioNombre}`,
      monto: pago.montoTotal,
      estado,
      fechaVencimiento: fechaVenc || "",
      diasRestantes: diasRest,
      eventoId: pago.eventoId,
      eventoNombre,
      eventoFecha: pago.fechaEvento,
      personalId: pago.personalId,
      fechaPago: pago.fechaPago,
      pago:
        pago.estado === "pagado" && pago.tipoPago
          ? {
              tipoPago: pago.tipoPago as "transferencia" | "efectivo" | "otro",
              notas: pago.notasPago,
            }
          : undefined,
      archivaAutomatico: true,
      detalles: {
        nombrePersonal: pago.nombrePersonal,
        telefonoPersonal: persona?.telefono,
        cuentaBancaria: persona?.datosBancarios
          ? {
              banco: persona.datosBancarios.banco || "",
              cbu: persona.datosBancarios.cbu,
              alias: persona.datosBancarios.alias,
            }
          : undefined,
      },
    })
  })

  // Ordenar por urgencia por defecto
  egresos.sort((a, b) => {
    const prioridad: Record<EgresoUnificado["estado"], number> = {
      vencido: 0,
      urgente: 1,
      pendiente: 2,
      pagado: 3,
      archivado: 4,
    }
    return (prioridad[a.estado] ?? 5) - (prioridad[b.estado] ?? 5)
  })

  return egresos
}

/**
 * Genera ingresos esperados a partir de los pagos y cuotas de los eventos.
 */
export function generarIngresosEsperados(
  eventos: EventoGuardado[]
): IngresoEsperado[] {
  const ingresos: IngresoEsperado[] = []
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  eventos
    .filter((e) => e.estado !== "cancelado")
    .forEach((evento) => {
      const eventoNombre =
        evento.nombrePareja || evento.nombre || evento.tipoEvento || "Evento"
      const precioVenta = evento.precioVenta || 0

      if (precioVenta <= 0) return

      // Calcular lo ya pagado
      const totalPagado = (evento.pagos || []).reduce(
        (sum, p) => sum + p.monto,
        0
      )
      const restante = precioVenta - totalPagado

      if (restante <= 0) {
        // Completamente pagado
        ingresos.push({
          id: `ing-${evento.id}-full`,
          eventoId: evento.id,
          eventoNombre,
          concepto: "Pago completo",
          monto: precioVenta,
          fechaVencimiento: evento.fecha,
          estado: "cobrado",
        })
        return
      }

      // Si tiene plan de cuotas
      if (evento.planCuotas && evento.planCuotas > 1) {
        const montoCuota = precioVenta / evento.planCuotas
        const pagosRealizados = (evento.pagos || []).length

        for (let i = 0; i < evento.planCuotas; i++) {
          const esPagada = i < pagosRealizados
          const fechaEvento = new Date(evento.fecha + "T12:00:00")
          // Distribuir cuotas: primera al reservar, resto equidistante hasta el evento
          const diasAntes = Math.max(
            0,
            ((evento.planCuotas - 1 - i) / (evento.planCuotas - 1)) * 60
          )
          const fechaCuota = new Date(fechaEvento)
          fechaCuota.setDate(fechaCuota.getDate() - diasAntes)

          let estado: IngresoEsperado["estado"] = "pendiente"
          if (esPagada) estado = "cobrado"
          else if (fechaCuota < hoy) estado = "vencido"

          ingresos.push({
            id: `ing-${evento.id}-cuota-${i}`,
            eventoId: evento.id,
            eventoNombre,
            concepto: `Cuota ${i + 1}/${evento.planCuotas}`,
            monto: montoCuota,
            fechaVencimiento: fechaCuota.toISOString().split("T")[0],
            estado,
            tipoCuota: {
              numeroCuota: i + 1,
              totalCuotas: evento.planCuotas,
            },
          })
        }
      } else {
        // Pago unico
        const estado: IngresoEsperado["estado"] =
          totalPagado > 0
            ? "cobrado"
            : new Date(evento.fecha + "T12:00:00") < hoy
              ? "vencido"
              : "pendiente"

        ingresos.push({
          id: `ing-${evento.id}-unico`,
          eventoId: evento.id,
          eventoNombre,
          concepto: totalPagado > 0 ? "Saldo parcial restante" : "Pago total",
          monto: totalPagado > 0 ? restante : precioVenta,
          fechaVencimiento: evento.fecha,
          estado,
        })
      }
    })

  return ingresos
}

/**
 * Genera un resumen financiero a partir de egresos e ingresos.
 */
export function generarResumenFinanciero(
  egresos: EgresoUnificado[],
  ingresos: IngresoEsperado[]
): ResumenFinanciero {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const en7Dias = new Date(hoy)
  en7Dias.setDate(en7Dias.getDate() + 7)

  // Egresos
  const pendientes = egresos.filter((e) => e.estado === "pendiente")
  const urgentes = egresos.filter((e) => e.estado === "urgente")
  const vencidos = egresos.filter((e) => e.estado === "vencido")
  const pagados = egresos.filter((e) => e.estado === "pagado")

  // Ingresos esta semana
  const ingresosEstaSemana = ingresos.filter((i) => {
    const fecha = new Date(i.fechaVencimiento + "T12:00:00")
    return fecha >= hoy && fecha <= en7Dias && i.estado !== "cobrado"
  })

  const ingresosPendientes = ingresos.filter((i) => i.estado === "pendiente" || i.estado === "vencido")
  const ingresosCobrados = ingresos.filter((i) => i.estado === "cobrado")

  // Cash flow esta semana
  const egresosEstaSemana = egresos.filter((e) => {
    if (e.estado === "pagado" || e.estado === "archivado") return false
    const fecha = new Date(e.fechaVencimiento + "T12:00:00")
    return fecha >= hoy && fecha <= en7Dias
  })
  const totalEgresosSemana = egresosEstaSemana.reduce(
    (sum, e) => sum + e.monto,
    0
  )
  const totalIngresosSemana = ingresosEstaSemana.reduce(
    (sum, i) => sum + i.monto,
    0
  )

  return {
    egresos: {
      total: {
        count: egresos.length,
        total: egresos.reduce((s, e) => s + e.monto, 0),
      },
      pendientes: {
        count: pendientes.length,
        total: pendientes.reduce((s, e) => s + e.monto, 0),
      },
      urgentes: {
        count: urgentes.length,
        total: urgentes.reduce((s, e) => s + e.monto, 0),
      },
      vencidos: {
        count: vencidos.length,
        total: vencidos.reduce((s, e) => s + e.monto, 0),
      },
      pagados: {
        count: pagados.length,
        total: pagados.reduce((s, e) => s + e.monto, 0),
      },
    },
    ingresos: {
      total: {
        count: ingresos.length,
        total: ingresos.reduce((s, i) => s + i.monto, 0),
      },
      estaSemana: ingresosEstaSemana,
      pendientes: {
        count: ingresosPendientes.length,
        total: ingresosPendientes.reduce((s, i) => s + i.monto, 0),
      },
      cobrados: {
        count: ingresosCobrados.length,
        total: ingresosCobrados.reduce((s, i) => s + i.monto, 0),
      },
    },
    balance: {
      cashflowEstaSemana: totalIngresosSemana - totalEgresosSemana,
      totalPendiente:
        ingresosPendientes.reduce((s, i) => s + i.monto, 0) -
        [...pendientes, ...urgentes, ...vencidos].reduce(
          (s, e) => s + e.monto,
          0
        ),
    },
  }
}

/**
 * Aplica filtros a una lista de egresos unificados.
 */
export function aplicarFiltrosEgresos(
  egresos: EgresoUnificado[],
  filtros: FiltrosEgresos
): EgresoUnificado[] {
  let resultado = [...egresos]

  // Filtrar archivados
  if (!filtros.mostrarArchivados) {
    resultado = resultado.filter((e) => e.estado !== "archivado")
  }

  // Filtrar por tipo
  if (filtros.tipo && filtros.tipo.length > 0) {
    resultado = resultado.filter((e) => filtros.tipo!.includes(e.tipo))
  }

  // Filtrar por estado
  if (filtros.estado && filtros.estado.length > 0) {
    resultado = resultado.filter((e) => filtros.estado!.includes(e.estado))
  }

  // Filtrar por periodo
  if (filtros.periodo) {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    let limite: Date

    switch (filtros.periodo) {
      case "esta-semana":
        limite = new Date(hoy)
        limite.setDate(limite.getDate() + 7)
        break
      case "este-mes":
        limite = new Date(hoy)
        limite.setMonth(limite.getMonth() + 1)
        break
      case "este-trimestre":
        limite = new Date(hoy)
        limite.setMonth(limite.getMonth() + 3)
        break
      default:
        limite = new Date(hoy)
        limite.setFullYear(limite.getFullYear() + 10)
    }

    resultado = resultado.filter((e) => {
      const fecha = new Date(e.fechaVencimiento + "T12:00:00")
      return fecha <= limite
    })
  }

  // Busqueda textual
  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const q = filtros.busqueda.toLowerCase()
    resultado = resultado.filter(
      (e) =>
        e.concepto.toLowerCase().includes(q) ||
        (e.descripcion || "").toLowerCase().includes(q) ||
        (e.eventoNombre || "").toLowerCase().includes(q) ||
        (e.detalles.nombrePersonal || "").toLowerCase().includes(q) ||
        (e.detalles.proveedor || "").toLowerCase().includes(q) ||
        (e.detalles.salon || "").toLowerCase().includes(q)
    )
  }

  // Ordenar
  resultado.sort((a, b) => {
    let comparison = 0

    switch (filtros.ordenarPor) {
      case "urgencia": {
        const prioridad: Record<EgresoUnificado["estado"], number> = {
          vencido: 0,
          urgente: 1,
          pendiente: 2,
          pagado: 3,
          archivado: 4,
        }
        comparison =
          (prioridad[a.estado] ?? 5) - (prioridad[b.estado] ?? 5)
        break
      }
      case "monto":
        comparison = a.monto - b.monto
        break
      case "fecha":
        comparison =
          new Date(a.fechaVencimiento).getTime() -
          new Date(b.fechaVencimiento).getTime()
        break
    }

    return filtros.ordenDireccion === "desc" ? -comparison : comparison
  })

  return resultado
}

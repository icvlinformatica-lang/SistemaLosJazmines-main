import { generateId, type EventoGuardado, type MovimientoCaja } from "./store"

export interface CobroCuotaResultado {
  /** true si la cuota ya figuraba como cobrada (no se hace nada) */
  yaCobrada: boolean
  /** patch para updateEvento (marca la cuota en cuotasPagadas) */
  planUpdate: { planDeCuotas: NonNullable<EventoGuardado["planDeCuotas"]> } | null
  /** movimientos a insertar (50% Caja Eventos + 50% Caja Jazmines) */
  movimientos: MovimientoCaja[]
}

/**
 * Construye la actualización necesaria para marcar una cuota como cobrada:
 * - agrega el número de cuota a `planDeCuotas.cuotasPagadas`
 * - genera dos movimientos de ingreso (50% a Caja Eventos, 50% a Caja Jazmines)
 *
 * El movimiento se data en la fecha de vencimiento de la cuota cuando existe
 * (útil al cargar eventos viejos, para que el flujo de caja quede en su período
 * histórico correcto) y cae a "ahora" solo si la cuota no tiene fecha.
 *
 * No muta nada: devuelve los datos para que el llamador use updateEvento /
 * addMovimientosCaja (ambos respetan el modo lectura del viaje en el tiempo).
 */
export function construirCobroCuota(
  evento: EventoGuardado,
  numeroCuota: number,
  montoCuotaCompleta: number,
  fechaVencimientoCuota: string | undefined,
  movimientosCaja: MovimientoCaja[],
): CobroCuotaResultado {
  const plan = evento.planDeCuotas
  const cuotasPagadas = plan?.cuotasPagadas ?? []

  if (cuotasPagadas.includes(numeroCuota)) {
    return { yaCobrada: true, planUpdate: null, movimientos: [] }
  }

  const planUpdate = plan
    ? { planDeCuotas: { ...plan, cuotasPagadas: [...cuotasPagadas, numeroCuota] } }
    : null

  const movimientos: MovimientoCaja[] = []

  if (evento.salon && montoCuotaCompleta > 0) {
    const mitad = montoCuotaCompleta / 2
    const fecha = fechaVencimientoCuota
      ? new Date(fechaVencimientoCuota + "T12:00:00").toISOString()
      : new Date().toISOString()
    const nombreEvento = evento.nombrePareja || evento.nombre || "Evento"

    const saldoPrevEventos = movimientosCaja
      .filter((m) => m.cajaDestino === "caja_eventos" && m.salon === evento.salon)
      .reduce((s, m) => (m.tipo === "ingreso" ? s + m.monto : s - m.monto), 0)
    const saldoPrevJazmines = movimientosCaja
      .filter((m) => m.cajaDestino === "caja_jazmines")
      .reduce((s, m) => (m.tipo === "ingreso" ? s + m.monto : s - m.monto), 0)

    movimientos.push(
      {
        id: generateId(),
        fecha,
        tipo: "ingreso",
        concepto: `Cuota ${numeroCuota} - ${nombreEvento} (Caja Eventos)`,
        monto: mitad,
        salon: evento.salon,
        eventoId: evento.id,
        cajaDestino: "caja_eventos",
        saldoResultante: saldoPrevEventos + mitad,
      },
      {
        id: generateId(),
        fecha,
        tipo: "ingreso",
        concepto: `Cuota ${numeroCuota} - ${nombreEvento} (Caja Jazmines)`,
        monto: mitad,
        salon: evento.salon,
        eventoId: evento.id,
        cajaDestino: "caja_jazmines",
        saldoResultante: saldoPrevJazmines + mitad,
      },
    )
  }

  return { yaCobrada: false, planUpdate, movimientos }
}

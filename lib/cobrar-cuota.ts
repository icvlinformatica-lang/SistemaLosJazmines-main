import {
  generateId,
  calcularCostoInsumosEvento,
  type EventoGuardado,
  type MovimientoCaja,
  type Insumo,
  type InsumoBarra,
  type Receta,
  type Coctel,
} from "./store"

export interface CobroCuotaResultado {
  /** true si la cuota ya figuraba como cobrada (no se hace nada) */
  yaCobrada: boolean
  /** patch para updateEvento (marca la cuota en cuotasPagadas) */
  planUpdate: { planDeCuotas: NonNullable<EventoGuardado["planDeCuotas"]> } | null
  /** movimientos a insertar (repartidos entre Caja Eventos y Caja Jazmines) */
  movimientos: MovimientoCaja[]
}

/** Datos del almacén para recalcular el costo de insumos EN VIVO al momento del cobro */
export interface DatosCostosEvento {
  insumos: Insumo[]
  insumosBarra: InsumoBarra[]
  recetas: Receta[]
  cocteles: Coctel[]
}

/**
 * Proporción de cada cobro que va a Caja Eventos (el resto va a Caja Jazmines).
 *
 * Regla ÚNICA (proporcional, "costo + 5%") para TODOS los eventos, sin importar
 * cuándo fueron creados: a Caja Eventos va SOLO el costo del evento + 5%,
 * prorrateado proporcionalmente en cada pago (seña y cuotas). El costo se
 * RECALCULA en cada cobro: insumos con precios actuales del almacén (si se
 * pasan `datos`) + servicios + operativos guardados en el evento.
 *
 * El reparto histórico 50/50 fue erradicado a pedido del negocio (jul 2026):
 * el flag legado `repartoCajas` se ignora por completo.
 *
 * Casos borde (datos faltantes):
 * - Costo del evento en 0: proporcionalmente a Eventos le corresponde $0,
 *   así que toda la cuota va a Jazmines (0).
 * - Monto total inválido (<= 0): no se puede prorratear; toda la cuota va a
 *   Caja Eventos (1) para garantizar que los costos queden cubiertos hasta
 *   que se corrija el plan de cuotas del evento.
 */
export function calcularProporcionCajaEventos(evento: EventoGuardado, datos?: DatosCostosEvento): number {
  const plan = evento.planDeCuotas
  const montoTotal = plan?.montoTotal ?? 0

  const costoInsumos = datos
    ? calcularCostoInsumosEvento(evento, datos.recetas, datos.insumos, datos.cocteles, datos.insumosBarra)
    : (evento.costoInsumos ?? 0)
  const costoEvento = costoInsumos + (evento.costoServicios ?? 0) + (evento.costoOperativo ?? 0)

  if (montoTotal <= 0) return 1
  if (costoEvento <= 0) return 0

  return Math.min(1, (costoEvento * 1.05) / montoTotal)
}

/**
 * Divide un monto entre las dos cajas según la proporción del evento.
 * Redondea a centavos y asigna el resto exacto a Jazmines (sin perder centavos).
 */
export function repartirEntreCajas(
  monto: number,
  proporcionEventos: number,
): { montoEventos: number; montoJazmines: number } {
  const montoEventos = Math.round(monto * proporcionEventos * 100) / 100
  const montoJazmines = Math.round((monto - montoEventos) * 100) / 100
  return { montoEventos, montoJazmines }
}

/**
 * Construye la actualización necesaria para marcar una cuota como cobrada:
 * - agrega el número de cuota a `planDeCuotas.cuotasPagadas`
 * - genera dos movimientos de ingreso repartidos entre Caja Eventos y Caja
 *   Jazmines según la regla proporcional única (ver calcularProporcionCajaEventos):
 *   costo del evento + 5% a Eventos y el resto a Jazmines, para TODOS los eventos.
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
  datosCostos?: DatosCostosEvento,
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
    const proporcion = calcularProporcionCajaEventos(evento, datosCostos)
    const { montoEventos, montoJazmines } = repartirEntreCajas(montoCuotaCompleta, proporcion)
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

    if (montoEventos > 0) {
      movimientos.push({
        id: generateId(),
        fecha,
        tipo: "ingreso",
        concepto: `Cuota ${numeroCuota} - ${nombreEvento} (Caja Eventos)`,
        monto: montoEventos,
        salon: evento.salon,
        eventoId: evento.id,
        cajaDestino: "caja_eventos",
        saldoResultante: saldoPrevEventos + montoEventos,
      })
    }
    if (montoJazmines > 0) {
      movimientos.push({
        id: generateId(),
        fecha,
        tipo: "ingreso",
        concepto: `Cuota ${numeroCuota} - ${nombreEvento} (Caja Jazmines)`,
        monto: montoJazmines,
        salon: evento.salon,
        eventoId: evento.id,
        cajaDestino: "caja_jazmines",
        saldoResultante: saldoPrevJazmines + montoJazmines,
      })
    }
  }

  return { yaCobrada: false, planUpdate, movimientos }
}

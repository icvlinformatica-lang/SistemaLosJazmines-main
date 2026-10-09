import { calcularIPCPeriodo, fechaNegocio } from "./ipc-cuotas"
import type { HistorialIPCEntry } from "./store"
import {
  generateId,
  calcularCostoInsumosEvento,
  calcularSeñaSaldoServicio,
  type EventoGuardado,
  type MovimientoCaja,
  type Insumo,
  type InsumoBarra,
  type Receta,
  type Coctel,
  type Servicio,
} from "./store"

export interface CobroCuotaResultado {
  error?: string
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
  /** Catálogo de servicios para recalcular su costo EN VIVO (opcional) */
  servicios?: Servicio[]
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
  // Servicios EN VIVO desde el catálogo si está disponible; si no, la foto guardada.
  const costoServicios = datos?.servicios
    ? (evento.servicios ?? []).reduce(
        (s, srv) => s + calcularSeñaSaldoServicio(srv, { servicios: datos.servicios! }).costoTotal,
        0,
      )
    : (evento.costoServicios ?? 0)
  const costoEvento = costoInsumos + costoServicios + (evento.costoOperativo ?? 0)

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
 * Movimientos de la seña que se cobra al crear un evento ("Seña + Cuotas"):
 * se reparte entre Caja Eventos y Caja Jazmines con la misma regla que las
 * cuotas (costo del evento + 5 % a Eventos y el resto a Jazmines). Una fila
 * por caja que recibe algo; nunca una fila "sin caja".
 *
 * Hasta el 7/10/2026 también se anotaba la seña ENTERA sin caja
 * (generarMovimientoIngreso de lib/store.ts): las pantallas de caja la
 * ignoraban, pero el resumen diario, el semanal y el control de comisiones la
 * contaban otra vez, así que cada seña figuraba dos veces.
 */
export function construirSenaInicial(params: {
  salon: string
  montoSena: number
  nombreEvento: string
  eventoId: string
  /** calcularProporcionCajaEventos del evento recién creado. */
  proporcionEventos: number
  movimientosCaja: MovimientoCaja[]
  /** Momento del cobro (ISO). */
  fecha: string
}): MovimientoCaja[] {
  const { salon, montoSena, nombreEvento, eventoId, proporcionEventos, movimientosCaja, fecha } = params
  const { montoEventos, montoJazmines } = repartirEntreCajas(montoSena, proporcionEventos)

  // Saldos previos como los calcula cada caja: Eventos por salón, Jazmines general.
  const saldo = (movs: MovimientoCaja[]) =>
    movs.reduce((sum, m) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto), 0)
  const saldoPrevEventos = saldo(movimientosCaja.filter((m) => m.cajaDestino === "caja_eventos" && m.salon === salon))
  const saldoPrevJazmines = saldo(movimientosCaja.filter((m) => m.cajaDestino === "caja_jazmines"))

  const movimientos: MovimientoCaja[] = []
  if (montoEventos > 0) {
    movimientos.push({
      id: generateId(),
      fecha,
      tipo: "ingreso",
      concepto: `Seña - ${nombreEvento} (Caja Eventos)`,
      monto: montoEventos,
      salon,
      eventoId,
      cajaDestino: "caja_eventos",
      saldoResultante: saldoPrevEventos + montoEventos,
    })
  }
  if (montoJazmines > 0) {
    movimientos.push({
      id: generateId(),
      fecha,
      tipo: "ingreso",
      concepto: `Seña - ${nombreEvento} (Caja Jazmines)`,
      monto: montoJazmines,
      salon,
      eventoId,
      cajaDestino: "caja_jazmines",
      saldoResultante: saldoPrevJazmines + montoJazmines,
    })
  }
  return movimientos
}

/**
 * Al EDITAR un evento que vino de una cotización: ¿cuánta seña hay que anotar
 * en las cajas? Devuelve 0 si no hay que anotar nada.
 *
 * Aprobar una cotización crea el evento sin plan de cuotas. Cuando después
 * Administración le carga "Seña + Cuotas" en el planificador, la seña no se
 * anotaba en ninguna caja (eso solo pasaba al CREAR un evento) y el control de
 * comisiones no la veía. Se anota con la misma regla que al crear
 * (construirSenaInicial), una sola vez:
 * - solo eventos que vienen de una cotización (los demás ya la anotaron al
 *   crearse, o son eventos viejos cuya seña se cobró antes del sistema);
 * - solo si el plan GUARDADO no tenía seña y el nuevo sí;
 * - y solo si el evento todavía no tiene ningún movimiento de "Seña".
 */
export function senaAAnotarAlEditar(params: {
  /** El evento como estaba guardado antes de este cambio. */
  eventoGuardado: Pick<EventoGuardado, "id" | "cotizacionId" | "planDeCuotas"> | null | undefined
  planNuevo: EventoGuardado["planDeCuotas"] | null | undefined
  salon: string | null | undefined
  movimientosCaja: MovimientoCaja[]
}): number {
  const { eventoGuardado, planNuevo, salon, movimientosCaja } = params
  if (!eventoGuardado?.cotizacionId || !salon) return 0
  const montoNuevo = planNuevo?.modalidadPago === "sena" ? Number(planNuevo.montoSena ?? 0) : 0
  if (!(montoNuevo > 0)) return 0
  const anterior = eventoGuardado.planDeCuotas
  const teniaSena = anterior?.modalidadPago === "sena" && Number(anterior.montoSena ?? 0) > 0
  if (teniaSena) return 0
  const yaAnotada = movimientosCaja.some(
    (m) => m.eventoId === eventoGuardado.id && m.tipo === "ingreso" && /^Seña/i.test(m.concepto || ""),
  )
  return yaAnotada ? 0 : Math.round(montoNuevo * 100) / 100
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
  historialIPC: HistorialIPCEntry[] = [],
  fechaReal = fechaNegocio(),
): CobroCuotaResultado {
  const plan = evento.planDeCuotas
  const cuotasPagadas = plan?.cuotasPagadas ?? []
  const cuotaExistente = plan?.cuotas?.find((cuota) => cuota.numero === numeroCuota)

  if (cuotasPagadas.includes(numeroCuota) || cuotaExistente?.pagada) {
    return { yaCobrada: true, planUpdate: null, movimientos: [] }
  }
  // Esta acción rápida es solo para cargar de una vez una cuota que nunca
  // recibió ningún pago (ej. deuda vieja de eventos cargados de golpe). Si
  // ya tiene un pago parcial, completarla tiene que pasar por "Cobrar
  // cuota" (perfil del evento), donde vive toda la lógica de saldo y de
  // qué se decide sobre el resto.
  if ((cuotaExistente?.montoPagadoNeto ?? 0) > 0) {
    return { yaCobrada: false, planUpdate: null, movimientos: [], error: "Esta cuota tiene pagos parciales registrados: completala desde el perfil del evento (Cobrar cuota)." }
  }

  const resultado = calcularIPCPeriodo(evento, historialIPC, fechaReal)
  if (resultado.estado === "pendiente" || (resultado.estado === "listo" && resultado.calculo.monto !== montoCuotaCompleta)) {
    return { yaCobrada: false, planUpdate: null, movimientos: [], error: resultado.estado === "pendiente" ? resultado.motivo : "La cuota cambió. Actualizá el desglose antes de cobrar." }
  }
  const planUpdate = plan
    ? { planDeCuotas: { ...plan, cuotasPagadas: [...cuotasPagadas, numeroCuota],
      cuotas: plan.cuotas?.map(c => c.numero === numeroCuota ? {
        ...c, pagada: true, estado: "pagada" as const, montoCuota: montoCuotaCompleta, montoPagadoNeto: montoCuotaCompleta,
        fechaPagoReal: fechaReal, calculoIPC: resultado.estado === "listo" ? resultado.calculo : undefined,
      } : c),
    } }
    : null

  const movimientos = construirMovimientosPago(
    evento, `Cuota ${numeroCuota}`, montoCuotaCompleta, fechaVencimientoCuota || fechaReal, movimientosCaja, datosCostos,
  )

  return { yaCobrada: false, planUpdate, movimientos }
}

/**
 * Reparte UN pago (parcial o completo) entre las dos cajas según la regla
 * proporcional del evento. La usan tanto construirCobroCuota (cobro
 * completo, carga rápida desde Caja Eventos) como el alta y la reversión
 * de un pago en "Cobrar cuota" (perfil del evento), para que las tres
 * cuentas usen exactamente la misma fórmula.
 */
export function construirMovimientosPago(
  evento: EventoGuardado,
  etiqueta: string,
  montoPago: number,
  fecha: string,
  movimientosCaja: MovimientoCaja[],
  datosCostos?: DatosCostosEvento,
): MovimientoCaja[] {
  if (!evento.salon || montoPago <= 0) return []
  const proporcion = calcularProporcionCajaEventos(evento, datosCostos)
  const { montoEventos, montoJazmines } = repartirEntreCajas(montoPago, proporcion)
  const nombreEvento = evento.nombrePareja || evento.nombre || "Evento"
  const fechaMov = fecha ? new Date(`${fecha}T12:00:00`).toISOString() : new Date().toISOString()

  const saldoPrevEventos = movimientosCaja
    .filter((m) => m.cajaDestino === "caja_eventos" && m.salon === evento.salon)
    .reduce((s, m) => (m.tipo === "ingreso" ? s + m.monto : s - m.monto), 0)
  const saldoPrevJazmines = movimientosCaja
    .filter((m) => m.cajaDestino === "caja_jazmines")
    .reduce((s, m) => (m.tipo === "ingreso" ? s + m.monto : s - m.monto), 0)

  const movimientos: MovimientoCaja[] = []
  if (montoEventos > 0) {
    movimientos.push({
      id: generateId(), fecha: fechaMov, tipo: "ingreso",
      concepto: `${etiqueta} - ${nombreEvento} (Caja Eventos)`,
      monto: montoEventos, salon: evento.salon, eventoId: evento.id,
      cajaDestino: "caja_eventos", saldoResultante: saldoPrevEventos + montoEventos,
    })
  }
  if (montoJazmines > 0) {
    movimientos.push({
      id: generateId(), fecha: fechaMov, tipo: "ingreso",
      concepto: `${etiqueta} - ${nombreEvento} (Caja Jazmines)`,
      monto: montoJazmines, salon: evento.salon, eventoId: evento.id,
      cajaDestino: "caja_jazmines", saldoResultante: saldoPrevJazmines + montoJazmines,
    })
  }
  return movimientos
}

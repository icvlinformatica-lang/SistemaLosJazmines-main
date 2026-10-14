// Cobro de una cuota desde el chat con IA. La IA NUNCA cobra: pregunta todo
// (qué evento, qué cuota, si paga completo, el recargo por atraso, quién
// paga y quién recibe), arma una propuesta (proponerCobroCuota en
// lib/chat-ia-herramientas.ts) y el chat la muestra con "Sí, cobrar" /
// "Cancelar". Solo el botón cobra, y lo hace por el mismo camino que la
// pantalla Cobrar cuota: updateEvento del store → PATCH /api/eventos/[id]
// (transacción, concurrencia, IPC validado en el servidor y movimientos de
// caja repartidos entre Caja Eventos y Caja Jazmines).
//
// Las cuentas son las de Cobrar cuota (app/eventos/pagos/page.tsx:
// opcionesCobro, construirProximoCobro y handleAddPago), sin el modo
// histórico ni la base corregida a mano: eso se sigue haciendo en la
// pantalla. El IPC se aplica siempre que corresponda; si falta, no se cobra
// por acá.
//
// Sin "use client" y sin lib/store.ts: lo usan el servidor (la propuesta) y
// la pantalla (al confirmar, se vuelve a calcular con los datos del momento).
import type { EventoGuardado, HistorialIPCEntry, PagoEvento } from "./store"
import { generarCalendarioCuotas } from "./calendario-cuotas"
import { aplicaIPC, resolverCalculoCobro, type CalculoIPC } from "./ipc-cuotas"
import { estadoDeCuota, saldoRestanteCuota, type DecisionSaldoCuota, type RecargoSaldoCuota } from "./estado-cuotas"
import { RECARGO_POR_DIA_ATRASO } from "./vienen-a-pagar"

export type EstadoPropuestaCobro = "pendiente" | "cobrado" | "cancelado"

/** Lo que la IA junta con sus preguntas antes de proponer el cobro. */
export interface EntradaCobroChat {
  numeroCuota: unknown
  /** false = se perdona el recargo por días de atraso (como destildarlo en Cobrar cuota). */
  cobrarRecargo: unknown
  pagaCompleto: unknown
  /** Solo si no paga completo: lo que entrega, recargo incluido. */
  monto?: unknown
  pagadoPor: unknown
  recibidoPor: unknown
  /** Si queda saldo: se suma a la cuota siguiente o queda aparte. */
  saldoRestante?: unknown
  /** Si queda saldo: sigue generando IPC o queda congelado. */
  ipcDelSaldo?: unknown
  /** Con cuánto paga (para el vuelto). Opcional. */
  pagaCon?: unknown
}

export interface PropuestaCobroChat {
  /** Id que tendrá el pago en el evento: confirmar dos veces no lo duplica. */
  id: string
  eventoId: string
  evento: string
  salon: string
  fechaEvento: string
  numeroCuota: number
  totalCuotas: number
  esPagoUnico: boolean
  /** La cuota ya tenía un pago parcial: se cobra lo que falta. */
  esSaldoDeCuota: boolean
  vencimiento: string
  diasAtraso: number
  /** Recargo por atraso que se cobra (0 si no hay atraso o si se perdonó). */
  recargo: number
  /** Recargo que se perdonó (0 si se cobra o no hay atraso). */
  recargoPerdonado: number
  /** Valor oficial de la cuota (con IPC si corresponde). */
  montoCuota: number
  /** Lo que ya se había pagado de esta cuota. */
  yaPagado: number
  /** Lo que se acredita a la cuota en este cobro (sin el recargo). */
  neto: number
  /** Total que entrega quien paga: neto + recargo. */
  monto: number
  quedaCompleta: boolean
  /** Lo que queda sin pagar de la cuota después de este cobro. */
  saldoQueQueda: number
  saldoDecision?: DecisionSaldoCuota
  recargoSaldo?: RecargoSaldoCuota
  pagadoPor: string
  recibidoPor: string
  pagaCon?: number
  vuelto?: number
  ipc?: { porcentaje: number; periodo: string; provisorio: boolean }
  /** Día (Argentina) en que se calcularon los montos: el recargo y el IPC dependen del día. */
  calculadoEl: string
  estado: EstadoPropuestaCobro
  resueltoPor?: string
  resueltoEn?: string
}

/** Una cuota que hoy se puede cobrar, con sus montos (lo que la IA usa para preguntar). */
export interface OpcionCobroChat {
  numeroCuota: number
  totalCuotas: number
  /** "pendiente": nunca recibió pagos; "parcial": ya tiene una parte paga. */
  estado: "pendiente" | "parcial"
  vencimiento: string
  esPagoUnico: boolean
  montoCuota: number
  yaPagado: number
  /** Lo que falta de la cuota (sin recargo). */
  falta: number
  diasAtraso: number
  recargoPorAtraso: number
  /** falta + recargoPorAtraso: lo que paga si paga completo con el recargo. */
  totalConRecargo: number
  ipc: { porcentaje: number; periodo: string; provisorio: boolean } | null
  /** Por qué hoy no se puede cobrar por el chat (por ejemplo, falta el IPC). */
  noSePuede?: string
}

const redondear = (n: number) => Math.round(n * 100) / 100

/** "$ 9.000", igual que formatCurrency de lib/store.ts (las notas del pago usan este formato). */
function pesosNota(valor: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor)
}

function diasEntre(desde: string, hasta: string): number {
  const dia = (ymd: string) => new Date(`${ymd}T00:00:00`).getTime()
  return Math.max(0, Math.floor((dia(hasta) - dia(desde)) / 86400000))
}

function ipcDe(calculo: CalculoIPC | null): OpcionCobroChat["ipc"] {
  if (!calculo || calculo.ipcOmitido) return null
  return { porcentaje: calculo.porcentaje, periodo: calculo.periodo, provisorio: calculo.ipcProvisorio === true }
}

interface CalculoCuota {
  cuota: ReturnType<typeof generarCalendarioCuotas>[number]
  totalCuotas: number
  esParcial: boolean
  esPagoUnico: boolean
  calculo: CalculoIPC | null
  /** Valor oficial de la cuota. */
  montoOficial: number
  /** Lo que falta (sin recargo). */
  falta: number
  diasAtraso: number
  /** Recargo si se cobra (aunque después se perdone). */
  recargoPosible: number
}

/** Cuotas que hoy se pueden cobrar, en el orden de Cobrar cuota: la corriente y las que quedaron parciales. */
function cuotasCobrables(evento: EventoGuardado) {
  const calendario = generarCalendarioCuotas(evento)
  const parciales = calendario.filter((c) => c.estado === "parcial")
  const corriente = calendario.find((c) => c.estado === "pendiente")
  return { calendario, opciones: corriente ? [corriente, ...parciales] : parciales }
}

/** Mismo cálculo que construirProximoCobro de Cobrar cuota (IPC tildado, sin base manual). */
function calcularCuota(
  evento: EventoGuardado,
  numero: number,
  historial: HistorialIPCEntry[],
  hoy: string,
): { ok: true; c: CalculoCuota } | { ok: false; motivo: string } {
  const { calendario, opciones } = cuotasCobrables(evento)
  const cuota = calendario.find((c) => c.numeroCuota === numero)
  if (!cuota) return { ok: false, motivo: `El evento no tiene cuota ${numero}.` }
  if (cuota.estado === "pagada") return { ok: false, motivo: `La cuota ${numero} ya está paga.` }
  if (!opciones.some((c) => c.numeroCuota === numero)) {
    const corriente = opciones.find((c) => c.estado === "pendiente")
    return {
      ok: false,
      motivo: corriente ? `Las cuotas se cobran en orden: primero va la cuota ${corriente.numeroCuota}.` : "Esa cuota no se puede cobrar todavía.",
    }
  }
  if (!cuota.fechaVencimiento) return { ok: false, motivo: `La cuota ${numero} no tiene fecha de vencimiento.` }
  const esPagoUnico = evento.planDeCuotas?.modalidadPago === "completo"
  const base = { cuota, totalCuotas: calendario.length, esPagoUnico }

  if (cuota.estado === "parcial") {
    // Ya tiene su cifra fijada por un pago anterior: no hay IPC ni recargo que recalcular.
    const detalle = evento.planDeCuotas?.cuotas?.find((c) => c.numero === numero)
    return {
      ok: true,
      c: {
        ...base,
        esParcial: true,
        calculo: detalle?.calculoIPC ?? null,
        montoOficial: detalle?.montoCuota ?? cuota.monto,
        falta: cuota.saldoRestante,
        diasAtraso: 0,
        recargoPosible: 0,
      },
    }
  }

  const ajusta = aplicaIPC(evento)
  const diasAtraso = diasEntre(cuota.fechaVencimiento, hoy)
  const resuelto = ajusta ? resolverCalculoCobro(evento, historial, hoy, { aplicarIPC: true }) : { calculo: null }
  const calculo = "calculo" in resuelto ? resuelto.calculo : null
  const cuotaNeta = calculo ? calculo.monto : ajusta ? 0 : cuota.monto
  if (ajusta && !(calculo && cuotaNeta > 0)) {
    const motivo = "error" in resuelto ? resuelto.error : "No se pudo calcular la cuota con el IPC."
    return { ok: false, motivo: `${motivo} Por el chat no se puede: cobrala desde Cobrar cuota.` }
  }
  return {
    ok: true,
    c: {
      ...base,
      esParcial: false,
      calculo,
      montoOficial: cuotaNeta,
      falta: cuotaNeta,
      diasAtraso,
      recargoPosible: diasAtraso * RECARGO_POR_DIA_ATRASO,
    },
  }
}

/** Para que la IA pregunte: qué cuotas se pueden cobrar hoy y cuánto vale cada una. */
export function opcionesCobroChat(
  evento: EventoGuardado,
  historial: HistorialIPCEntry[],
  hoy: string,
): { ok: true; opciones: OpcionCobroChat[] } | { ok: false; motivo: string } {
  if (evento.estado === "completado" || evento.estado === "cancelado") {
    return { ok: false, motivo: "El evento está finalizado: no tiene cuotas para cobrar." }
  }
  const { calendario, opciones } = cuotasCobrables(evento)
  if (calendario.length === 0) return { ok: false, motivo: "El evento no tiene plan de cuotas cargado." }
  if (opciones.length === 0) return { ok: false, motivo: "El evento tiene todas las cuotas pagas." }
  return {
    ok: true,
    opciones: opciones.map((o): OpcionCobroChat => {
      const r = calcularCuota(evento, o.numeroCuota, historial, hoy)
      const comun = {
        numeroCuota: o.numeroCuota,
        totalCuotas: calendario.length,
        estado: o.estado === "parcial" ? ("parcial" as const) : ("pendiente" as const),
        vencimiento: o.fechaVencimiento,
        esPagoUnico: evento.planDeCuotas?.modalidadPago === "completo",
      }
      if (!r.ok) {
        return { ...comun, montoCuota: 0, yaPagado: o.montoAcumulado, falta: 0, diasAtraso: 0, recargoPorAtraso: 0, totalConRecargo: 0, ipc: null, noSePuede: r.motivo }
      }
      const c = r.c
      return {
        ...comun,
        montoCuota: redondear(c.montoOficial),
        yaPagado: redondear(c.cuota.montoAcumulado),
        falta: redondear(c.falta),
        diasAtraso: c.diasAtraso,
        recargoPorAtraso: c.recargoPosible,
        totalConRecargo: redondear(c.falta + c.recargoPosible),
        ipc: ipcDe(c.calculo),
      }
    }),
  }
}

function textoCorto(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : ""
}

/**
 * Arma la propuesta de cobro con las mismas validaciones que Cobrar cuota, o
 * dice qué falta o qué está mal (para que la IA lo pregunte).
 */
export function armarPropuestaCobro(
  evento: EventoGuardado,
  historial: HistorialIPCEntry[],
  hoy: string,
  entrada: EntradaCobroChat,
  id: string,
): { ok: true; propuesta: PropuestaCobroChat } | { ok: false; motivo: string } {
  if (evento.estado === "completado" || evento.estado === "cancelado") {
    return { ok: false, motivo: "El evento está finalizado: no tiene cuotas para cobrar." }
  }
  if (!evento.salon) return { ok: false, motivo: "El evento no tiene salón: no se sabe a qué caja va. Cobralo desde Cobrar cuota." }
  const numero = Number(entrada.numeroCuota)
  if (!Number.isInteger(numero) || numero <= 0) return { ok: false, motivo: "Falta qué cuota se cobra." }
  if (typeof entrada.pagaCompleto !== "boolean") return { ok: false, motivo: "Falta saber si paga la cuota completa o una parte." }
  if (typeof entrada.cobrarRecargo !== "boolean") return { ok: false, motivo: "Falta saber si se cobra el recargo por atraso." }

  const r = calcularCuota(evento, numero, historial, hoy)
  if (!r.ok) return r
  const c = r.c
  const recargo = entrada.cobrarRecargo ? c.recargoPosible : 0
  const totalSugerido = redondear(c.falta + recargo)

  let monto = totalSugerido
  if (!entrada.pagaCompleto) {
    const m = typeof entrada.monto === "number" ? entrada.monto : Number.NaN
    if (!Number.isFinite(m) || m <= 0) return { ok: false, motivo: "Falta cuánto paga (si no paga la cuota completa)." }
    monto = redondear(m)
  }
  const neto = redondear(monto - recargo)
  if (neto <= 0) {
    return { ok: false, motivo: `El monto tiene que ser mayor al recargo por atraso (${pesosNota(recargo)}).` }
  }
  if (neto > c.falta + 0.01) {
    return { ok: false, motivo: `El monto supera lo que falta de la cuota: como máximo ${pesosNota(totalSugerido)}.` }
  }
  const acumuladoPrevio = c.esParcial ? c.cuota.montoAcumulado : 0
  const acumuladoNuevo = redondear(acumuladoPrevio + neto)
  const quedaCompleta = acumuladoNuevo >= c.montoOficial - 0.01

  let saldoDecision: DecisionSaldoCuota | undefined
  let recargoSaldo: RecargoSaldoCuota | undefined
  if (!quedaCompleta) {
    saldoDecision = entrada.saldoRestante === "acumular" || entrada.saldoRestante === "aparte" ? entrada.saldoRestante : undefined
    recargoSaldo = entrada.ipcDelSaldo === "acumula" || entrada.ipcDelSaldo === "congelado" ? entrada.ipcDelSaldo : undefined
    if (!saldoDecision || !recargoSaldo) {
      return {
        ok: false,
        motivo:
          "Queda un saldo sin pagar: falta decidir si se suma a la cuota siguiente o queda aparte, y si sigue generando IPC o queda congelado.",
      }
    }
  }

  const pagadoPor = textoCorto(entrada.pagadoPor, 80)
  if (pagadoPor.length < 2) return { ok: false, motivo: "Falta quién paga." }
  const recibidoPor = textoCorto(entrada.recibidoPor, 80)
  if (recibidoPor.length < 2) return { ok: false, motivo: "Falta quién recibe la plata." }

  let pagaCon: number | undefined
  let vuelto: number | undefined
  if (entrada.pagaCon !== undefined && entrada.pagaCon !== null) {
    const p = typeof entrada.pagaCon === "number" ? redondear(entrada.pagaCon) : Number.NaN
    if (!Number.isFinite(p) || p <= 0) return { ok: false, motivo: "El 'paga con' no es un monto válido." }
    if (p < monto - 0.005) return { ok: false, motivo: `Con ${pesosNota(p)} no alcanza: son ${pesosNota(monto)}.` }
    pagaCon = p
    // Como Cobrar cuota: el vuelto solo si entrega más de lo que paga.
    if (p > monto) vuelto = redondear(p - monto)
  }

  const ipc = c.esParcial ? null : ipcDe(c.calculo)
  return {
    ok: true,
    propuesta: {
      id,
      eventoId: evento.id,
      evento: evento.nombrePareja || evento.nombre || "Evento",
      salon: evento.salon,
      fechaEvento: evento.fecha || "",
      numeroCuota: numero,
      totalCuotas: c.totalCuotas,
      esPagoUnico: c.esPagoUnico,
      esSaldoDeCuota: c.esParcial,
      vencimiento: c.cuota.fechaVencimiento,
      diasAtraso: c.diasAtraso,
      recargo,
      recargoPerdonado: entrada.cobrarRecargo ? 0 : c.recargoPosible,
      montoCuota: redondear(c.montoOficial),
      yaPagado: redondear(acumuladoPrevio),
      neto,
      monto,
      quedaCompleta,
      saldoQueQueda: quedaCompleta ? 0 : redondear(c.montoOficial - acumuladoNuevo),
      ...(saldoDecision ? { saldoDecision } : {}),
      ...(recargoSaldo ? { recargoSaldo } : {}),
      pagadoPor,
      recibidoPor,
      ...(pagaCon !== undefined ? { pagaCon } : {}),
      ...(vuelto !== undefined ? { vuelto } : {}),
      ...(ipc ? { ipc } : {}),
      calculadoEl: hoy,
      estado: "pendiente",
    },
  }
}

/** Lo que se guarda en el evento al confirmar (lo mismo que arma handleAddPago de Cobrar cuota). */
export interface CobroArmadoChat {
  pago: PagoEvento
  pagos: PagoEvento[]
  planDeCuotas: NonNullable<EventoGuardado["planDeCuotas"]>
  planCuotas: number
  montoTotalPlan: number
  /** Etiqueta de los movimientos de caja ("Cuota 3 #1a2b3c4d"), como en Cobrar cuota. */
  etiquetaCaja: string
  calculo: CalculoIPC | null
}

/**
 * Al tocar "Sí, cobrar": vuelve a calcular con el evento y el IPC de ese
 * momento y arma el pago y el plan como Cobrar cuota. Si algo cambió desde
 * que el chat lo preparó (otro pago, el IPC, otro día), no cobra.
 */
export function armarCobroDesdePropuesta(
  evento: EventoGuardado,
  historial: HistorialIPCEntry[],
  hoy: string,
  propuesta: PropuestaCobroChat,
): { ok: true; cobro: CobroArmadoChat } | { ok: false; motivo: string } {
  const otraVez = "Pedile al chat que lo prepare de nuevo."
  if (propuesta.calculadoEl !== hoy) {
    return { ok: false, motivo: `Se preparó otro día y el recargo o el IPC pueden ser otros. ${otraVez}` }
  }
  if ((evento.pagos ?? []).some((p) => p.id === propuesta.id)) return { ok: false, motivo: "Ese cobro ya está registrado." }
  const r = armarPropuestaCobro(
    evento,
    historial,
    hoy,
    {
      numeroCuota: propuesta.numeroCuota,
      cobrarRecargo: propuesta.recargoPerdonado === 0,
      pagaCompleto: false,
      monto: propuesta.monto,
      pagadoPor: propuesta.pagadoPor,
      recibidoPor: propuesta.recibidoPor,
      saldoRestante: propuesta.saldoDecision,
      ipcDelSaldo: propuesta.recargoSaldo,
      pagaCon: propuesta.pagaCon,
    },
    propuesta.id,
  )
  if (!r.ok) return { ok: false, motivo: `${r.motivo} ${otraVez}` }
  const n = r.propuesta
  const igual = (a: number, b: number) => Math.abs(a - b) < 0.005
  if (
    !igual(n.monto, propuesta.monto) ||
    !igual(n.neto, propuesta.neto) ||
    !igual(n.recargo, propuesta.recargo) ||
    !igual(n.montoCuota, propuesta.montoCuota) ||
    !igual(n.yaPagado, propuesta.yaPagado) ||
    n.quedaCompleta !== propuesta.quedaCompleta
  ) {
    return { ok: false, motivo: `Los montos cambiaron desde que el chat lo preparó. ${otraVez}` }
  }

  const plan = evento.planDeCuotas
  if (!plan) return { ok: false, motivo: "El evento no tiene plan de cuotas." }
  const numero = n.numeroCuota
  // Como handleAddPago: se relee la cuota del evento más fresco.
  const cuotaVigente = plan.cuotas?.find((c) => c.numero === numero)
  if (!cuotaVigente && !n.esSaldoDeCuota) return { ok: false, motivo: `La cuota ya cambió. ${otraVez}` }
  if (cuotaVigente && estadoDeCuota(cuotaVigente) === "pagada") return { ok: false, motivo: "Esa cuota ya está paga." }

  let calculo: CalculoIPC | null = null
  let montoOficial = n.montoCuota
  if (n.esSaldoDeCuota) {
    calculo = cuotaVigente?.calculoIPC ?? null
    montoOficial = cuotaVigente?.montoCuota ?? n.montoCuota
  } else {
    const resuelto = resolverCalculoCobro(evento, historial, hoy, { aplicarIPC: true })
    if ("error" in resuelto) return { ok: false, motivo: `${resuelto.error} ${otraVez}` }
    calculo = resuelto.calculo
  }
  const acumuladoVigente = cuotaVigente?.montoPagadoNeto ?? 0
  if (n.neto > saldoRestanteCuota({ montoCuota: montoOficial, montoPagadoNeto: acumuladoVigente }) + 0.01) {
    return { ok: false, motivo: `El monto supera lo que falta de la cuota. ${otraVez}` }
  }
  const acumuladoNuevo = redondear(acumuladoVigente + n.neto)
  const quedaCompleta = acumuladoNuevo >= montoOficial - 0.01

  const notaBase = n.esSaldoDeCuota
    ? `Cuota ${numero}/${n.totalCuotas} (saldo pendiente)`
    : n.esPagoUnico
      ? "Pago único (pago completo)"
      : `Cuota ${numero}/${n.totalCuotas}`
  const notas =
    n.recargo > 0
      ? `${notaBase} + recargo por atraso ${pesosNota(n.recargo)} (${n.diasAtraso} ${n.diasAtraso === 1 ? "día" : "días"} x ${pesosNota(RECARGO_POR_DIA_ATRASO)})`
      : notaBase

  const pago: PagoEvento = {
    id: propuesta.id,
    monto: n.monto,
    fecha: hoy,
    pagadoPor: n.pagadoPor,
    dni: evento.dniNovio1 || undefined,
    porcentajeIPC: calculo ? (calculo.ipcOmitido ? 0 : calculo.porcentaje) : 0,
    montoCuotaNeto: n.neto,
    montoMora: n.recargo,
    calculoIPC: calculo ?? undefined,
    notas,
    montoRecibido: n.pagaCon,
    vuelto: n.vuelto,
    recibidoPor: n.recibidoPor,
    numeroCuota: numero,
  }

  const planDeCuotas: NonNullable<EventoGuardado["planDeCuotas"]> = {
    ...plan,
    cuotasPagadas: quedaCompleta
      ? [...new Set([...(plan.cuotasPagadas ?? []), numero])]
      : (plan.cuotasPagadas ?? []).filter((x) => x !== numero),
    cuotas: plan.cuotas?.map((c) =>
      c.numero === numero
        ? {
            ...c,
            pagada: quedaCompleta,
            estado: quedaCompleta ? ("pagada" as const) : ("parcial" as const),
            montoCuota: montoOficial,
            montoPagadoNeto: acumuladoNuevo,
            fechaPagoReal: hoy,
            calculoIPC: calculo ?? c.calculoIPC,
            saldoDecision: quedaCompleta ? undefined : n.saldoDecision,
            recargoSaldo: quedaCompleta ? undefined : n.recargoSaldo,
          }
        : c,
    ),
  }

  // planCuotas y montoTotalPlan, como cargarPlanDesdeEvento de Cobrar cuota.
  const conPlan = plan.montoTotal > 0
  const costoTotal = (evento.costoInsumos ?? 0) + (evento.costoServicios ?? 0) + (evento.costoOperativo ?? 0)
  const montoTotalPlan = conPlan
    ? plan.montoTotal
    : (evento.montoTotalPlan ?? 0) > 0
      ? evento.montoTotalPlan!
      : (evento.precioVenta ?? 0) > 0
        ? evento.precioVenta!
        : costoTotal
  const planCuotas = conPlan ? plan.numeroCuotas || 1 : (evento.planCuotas ?? 0) > 0 ? evento.planCuotas! : 1

  return {
    ok: true,
    cobro: {
      pago,
      pagos: [...(evento.pagos ?? []), pago],
      planDeCuotas,
      planCuotas,
      montoTotalPlan,
      etiquetaCaja: `Cuota ${numero} #${propuesta.id.slice(0, 8)}`,
      calculo,
    },
  }
}

/** Propuesta leída del historial o de la respuesta; null si no tiene la forma esperada. */
export function propuestaCobroValida(valor: unknown): PropuestaCobroChat | null {
  if (!valor || typeof valor !== "object") return null
  const p = valor as Record<string, unknown>
  const num = (k: string) => typeof p[k] === "number" && Number.isFinite(p[k])
  const str = (k: string) => typeof p[k] === "string"
  if (
    !["id", "eventoId", "evento", "salon", "fechaEvento", "vencimiento", "pagadoPor", "recibidoPor", "calculadoEl"].every(str) ||
    !["numeroCuota", "totalCuotas", "diasAtraso", "recargo", "recargoPerdonado", "montoCuota", "yaPagado", "neto", "monto", "saldoQueQueda"].every(num) ||
    typeof p.esPagoUnico !== "boolean" ||
    typeof p.esSaldoDeCuota !== "boolean" ||
    typeof p.quedaCompleta !== "boolean" ||
    (p.estado !== "pendiente" && p.estado !== "cobrado" && p.estado !== "cancelado")
  ) {
    return null
  }
  return p as unknown as PropuestaCobroChat
}

// Los JSON de eventos pueden venir como texto dentro de jsonb (ver CLAUDE.md).
function leerJson<T>(valor: unknown, porDefecto: T): T {
  if (valor === null || valor === undefined) return porDefecto
  if (typeof valor === "string") {
    try {
      return JSON.parse(valor) as T
    } catch {
      return porDefecto
    }
  }
  return valor as T
}

/** Evento armado desde una fila de `eventos` (servidor), con lo que usa el cobro. */
export function eventoCobroDesdeFila(fila: Record<string, unknown>): EventoGuardado {
  return {
    id: String(fila.id ?? ""),
    nombre: String(fila.nombre ?? ""),
    nombrePareja: fila.nombre_pareja ? String(fila.nombre_pareja) : undefined,
    fecha: String(fila.fecha ?? "").slice(0, 10),
    salon: fila.salon ? String(fila.salon) : "",
    estado: String(fila.estado ?? "pendiente"),
    planDeCuotas: leerJson(fila.plan_de_cuotas, undefined),
    pagos: leerJson(fila.pagos, []),
  } as unknown as EventoGuardado
}

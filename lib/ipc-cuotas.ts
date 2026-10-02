import type { EventoGuardado, HistorialIPCEntry, PagoEvento } from "./store"
import { estadoDeCuota, saldoRestanteCuota, type EstadoCuota } from "./estado-cuotas"

export type EventoIPC = Pick<EventoGuardado, "planDeCuotas" | "pagos"> & { estado?: string }
export interface CalculoIPC {
  version: "ultima-cuota-v1"
  periodo: string
  base: number
  origen: "plan" | "pago" | "manual"
  pagoOrigenId?: string
  cuotaOrigen?: number
  porcentaje: number
  monto: number
  aplicadoEsteMes: boolean
  /** true cuando quien cobra destildó el IPC: la cuota queda igual a la base. */
  ipcOmitido?: boolean
  /**
   * true cuando el mes del cobro no tenía IPC oficial cargado y se usó el
   * último publicado antes de ese mes ("se aplica el último IPC publicado al
   * día del cobro"), o cuando el IPC del mes se cargó a mano como provisorio.
   */
  ipcProvisorio?: boolean
  /** "YYYY-MM" del índice realmente usado (solo con ipcProvisorio). */
  periodoIndice?: string
}
export interface OpcionesCobro {
  aplicarIPC: boolean
  /** Base elegida a mano cuando el cálculo automático quedó pendiente. */
  baseManual?: number
}
export interface SugerenciaManual {
  base: number
  origen: "pago" | "plan"
  porcentaje: number | null
  periodo: string
  /** Presente cuando el porcentaje es provisorio (ver indiceParaPeriodo). */
  ipcProvisorio?: boolean
  periodoIndice?: string
}

/** Índice IPC que corresponde a un período de cobro. */
export interface IndiceIPC {
  porcentaje: number
  /** "YYYY-MM" del índice usado. */
  periodoIndice: string
  provisorio: boolean
}
export type ResultadoIPC =
  | { estado: "no_aplica" }
  | { estado: "pendiente"; motivo: string }
  | { estado: "listo"; calculo: CalculoIPC }

export function fechaNegocio(ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(ahora)
  const valor = (tipo: string) => partes.find(p => p.type === tipo)!.value
  return `${valor("year")}-${valor("month")}-${valor("day")}`
}

export function aplicaIPC(evento: EventoIPC): boolean {
  const plan = evento.planDeCuotas
  return evento.estado !== "completado" && plan?.ajustaPorIPC === true &&
    plan.numeroCuotas > 1 && (plan.cuotas?.length ?? 0) > 0 && plan.modalidadPago !== "completo"
}

export function numerosPagados(evento: EventoIPC): number[] {
  return [...new Set([
    ...(evento.planDeCuotas?.cuotasPagadas ?? []),
    ...(evento.planDeCuotas?.cuotas ?? []).filter(c => c.pagada).map(c => c.numero),
    ...(evento.pagos ?? []).map(numeroCuotaPago).filter((n): n is number => Number.isInteger(n) && n! > 0),
  ])].sort((a, b) => a - b)
}

export function numeroCuotaPago(pago: PagoEvento): number | undefined {
  return pago.numeroCuota ?? (Number(pago.notas?.match(/^Cuota (\d+)\/\d+(?:$| \+ recargo por atraso )/)?.[1]) || undefined)
}

function fechaValida(fecha: string | undefined): string | null {
  if (!fecha) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const date = new Date(`${fecha}T12:00:00Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === fecha ? fecha : null
  }
  const date = new Date(fecha)
  return Number.isFinite(date.getTime()) ? fechaNegocio(date) : null
}

function netoHistorico(pago: PagoEvento): number | null {
  if (Number.isFinite(pago.montoCuotaNeto) && pago.montoCuotaNeto! > 0) return pago.montoCuotaNeto!
  // Solo formatos producidos por el formulario: jamás inferir mora usando días actuales.
  if (/^Cuota \d+\/\d+$/.test(pago.notas ?? "")) return pago.monto > 0 ? pago.monto : null
  const mora = pago.notas?.match(/^Cuota \d+\/\d+ \+ recargo por atraso \$\s*([\d.]+(?:,\d+)?) \(\d+ días? x \$\s*[\d.,]+\)$/)
  if (!mora) return null
  const importe = Number(mora[1].replace(/\./g, "").replace(",", "."))
  return Number.isFinite(importe) && importe >= 0 && pago.monto > importe ? pago.monto - importe : null
}

export function calcularIPCPeriodo(
  evento: EventoIPC,
  historial: HistorialIPCEntry[],
  fecha = fechaNegocio(),
): ResultadoIPC {
  if (!aplicaIPC(evento)) return { estado: "no_aplica" }
  const pendiente = (motivo: string): ResultadoIPC => ({ estado: "pendiente", motivo })
  const dia = fechaValida(fecha)
  if (!dia) return pendiente("Fecha de cobro inválida.")
  const periodo = dia.slice(0, 7)
  const indice = indiceParaPeriodo(historial, periodo)
  if (!indice) return pendiente(`IPC de ${periodo} pendiente de definición o duplicado. Cargá un único índice antes de cobrar.`)
  const porcentaje = indice.porcentaje
  if (!Number.isFinite(porcentaje) || porcentaje <= -100) return pendiente("El porcentaje IPC no es válido.")
  const marcaIndice = marcaProvisorio(indice)
  const plan = evento.planDeCuotas!
  const pagos = evento.pagos ?? []
  if (pagos.some(p => !numeroCuotaPago(p) && !/^(seña|sena|extra|pago único)/i.test(p.notas ?? ""))) {
    return pendiente("Hay pagos sin cuota identificada. Revisá su importe neto antes de recalcular.")
  }
  // Cadena de bases mes a mes. Con pagos parciales, una cuota puede tener
  // varios pagos: la base para la cuota SIGUIENTE es siempre la cifra
  // OFICIAL ya fijada de esta cuota (cuota.montoCuota), nunca la suma de lo
  // efectivamente acreditado. Por eso "neto" acá viene de montoCuota, no de
  // netoHistorico(pago) — ese último solo sirve de resguardo para datos
  // viejos sin detalle de cuotas[] (antes de esta regla existir).
  const acreditados: Array<{ numero: number; fecha: string; neto: number; ipc?: CalculoIPC }> = []
  for (const numero of numerosPagados(evento)) {
    const cuota = plan.cuotas?.find(c => c.numero === numero)
    const pagosCuota = pagos
      .filter(p => numeroCuotaPago(p) === numero)
      .map(p => ({ pago: p, fecha: fechaValida(p.fecha) }))
      .filter((p): p is { pago: PagoEvento; fecha: string } => !!p.fecha)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    // El primer pago cronológico es el que fija la base oficial de la cuota.
    const primerPago = pagosCuota[0]?.pago
    const fechaFijacion = fechaValida(primerPago?.fecha ?? cuota?.fechaPagoReal)
    const neto = cuota?.montoCuota ?? (primerPago ? netoHistorico(primerPago) : cuota?.montoPagadoNeto)
    if (!fechaFijacion || !Number.isFinite(neto) || neto! <= 0) return pendiente(`Falta acreditar el importe sin mora o la fecha real de la cuota ${numero}. No se modifican las pendientes.`)
    // Ningún pago acreditado contra esta cuota puede ser posterior a la fecha elegida.
    const fechaMasNueva = pagosCuota.at(-1)?.fecha ?? fechaFijacion
    if (fechaMasNueva > dia) return pendiente("Hay pagos posteriores a la fecha elegida. Revisá la fecha antes de cobrar.")
    acreditados.push({ numero, fecha: fechaFijacion, neto: neto!, ipc: primerPago?.calculoIPC ?? cuota?.calculoIPC })
  }
  acreditados.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero)
  const delMes = acreditados.filter(p => p.fecha.slice(0, 7) === periodo)
  const primeroDelMes = delMes[0]
  if (primeroDelMes) {
    const foto = primeroDelMes.ipc
    if (!foto || foto.version !== "ultima-cuota-v1" || foto.periodo !== periodo) {
      return pendiente("Hay una cuota cobrada este mes sin base mensual auditada. Confirmá esa base antes de aplicar la nueva regla.")
    }
    // No se audita por id de pago puntual (una cuota puede tener varios
    // pagos parciales): alcanza con que la cuota que originó la base siga
    // teniendo al menos un pago acreditado.
    if (foto.origen === "pago" && !acreditados.some(p => p.numero === foto.cuotaOrigen)) {
      return pendiente("La base mensual depende de un pago anulado. Revisá la base antes de cobrar otra cuota.")
    }
    if (!Number.isFinite(foto.base) || foto.base <= 0) return pendiente("La base mensual guardada no es válida.")
    // La marca de provisorio es la del índice de HOY, no la que tenía la foto.
    const { ipcProvisorio: _p, periodoIndice: _i, ...fotoSinMarca } = foto
    return { estado: "listo", calculo: { ...fotoSinMarca, porcentaje, monto: Math.round(foto.base * (1 + porcentaje / 100)), aplicadoEsteMes: true, ...marcaIndice } }
  }
  const ultima = acreditados.at(-1)
  const base = ultima?.neto ?? plan.montoCuota
  if (!Number.isFinite(base) || base <= 0) return pendiente("La cuota base original del plan no está disponible.")
  return { estado: "listo", calculo: {
    version: "ultima-cuota-v1", periodo, base, origen: ultima ? "pago" : "plan",
    cuotaOrigen: ultima?.numero, porcentaje,
    monto: Math.round(base * (1 + porcentaje / 100)), aplicadoEsteMes: false,
    ...marcaIndice,
  } }
}

const ordenMes = (anio: number, mes0: number) => anio * 12 + mes0

/**
 * Índice IPC que se aplica a un cobro del período "YYYY-MM".
 * Criterio del negocio: "se aplica el último IPC publicado al día del cobro".
 * - Si el mes tiene UN índice cargado, se usa ese (provisorio solo si se cargó
 *   a mano marcado como provisorio).
 * - Si el mes NO tiene índice, se usa el más reciente de un mes ANTERIOR
 *   (nunca uno posterior), marcado como provisorio.
 * - null (queda pendiente, como siempre) si el mes tiene índices duplicados,
 *   si no hay ninguno anterior, o si el último anterior está duplicado.
 */
export function indiceParaPeriodo(historial: HistorialIPCEntry[], periodo: string): IndiceIPC | null {
  const [anio, mes] = periodo.split("-").map(Number)
  if (!Number.isInteger(anio) || !Number.isInteger(mes)) return null
  const objetivo = ordenMes(anio, mes - 1)
  const delMes = historial.filter(h => ordenMes(h.anio, h.mes) === objetivo)
  if (delMes.length > 1) return null
  if (delMes.length === 1) {
    return { porcentaje: delMes[0].porcentaje, periodoIndice: periodo, provisorio: delMes[0].provisorio === true }
  }
  const anteriores = historial.filter(h => ordenMes(h.anio, h.mes) < objetivo)
  if (!anteriores.length) return null
  const ultimoOrden = Math.max(...anteriores.map(h => ordenMes(h.anio, h.mes)))
  const ultimos = anteriores.filter(h => ordenMes(h.anio, h.mes) === ultimoOrden)
  if (ultimos.length !== 1) return null
  const h = ultimos[0]
  return { porcentaje: h.porcentaje, periodoIndice: `${h.anio}-${String(h.mes + 1).padStart(2, "0")}`, provisorio: true }
}

/** Campos de la foto calculoIPC que marcan un índice provisorio (vacío si es oficial). */
function marcaProvisorio(indice: Pick<IndiceIPC, "provisorio" | "periodoIndice"> | null | undefined): Pick<CalculoIPC, "ipcProvisorio" | "periodoIndice"> {
  return indice?.provisorio ? { ipcProvisorio: true, periodoIndice: indice.periodoIndice } : {}
}

function indiceDelPeriodo(historial: HistorialIPCEntry[], periodo: string): IndiceIPC | null {
  const indice = indiceParaPeriodo(historial, periodo)
  return indice && Number.isFinite(indice.porcentaje) && indice.porcentaje > -100 ? indice : null
}

/**
 * Cuando el cálculo automático queda pendiente, propone una base para cobrar a mano:
 * el último pago registrado (neto si se conoce, si no su importe) o la cuota original del plan.
 * Es solo una sugerencia editable; nunca se guarda por sí sola.
 */
export function sugerirBaseManual(evento: EventoIPC, historial: HistorialIPCEntry[], fecha = fechaNegocio()): SugerenciaManual | null {
  const plan = evento.planDeCuotas
  if (!plan) return null
  const periodo = (fechaValida(fecha) ?? fechaNegocio()).slice(0, 7)
  const pagos = (evento.pagos ?? [])
    .filter(p => !/^(seña|sena|extra)/i.test(p.notas ?? ""))
    .map(p => ({ fecha: fechaValida(p.fecha) ?? "", neto: netoHistorico(p) ?? (p.monto > 0 ? p.monto : null) }))
    .filter(p => p.fecha && p.neto)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ultimo = pagos.at(-1)
  const base = ultimo?.neto ?? plan.montoCuota
  if (!Number.isFinite(base) || base <= 0) return null
  const indice = indiceDelPeriodo(historial, periodo)
  return { base, origen: ultimo ? "pago" : "plan", porcentaje: indice?.porcentaje ?? null, periodo, ...marcaProvisorio(indice) }
}

/**
 * Resuelve el cálculo que se va a guardar con un cobro, respetando lo que tildó quien cobra:
 * - automático listo: usa la base auditada; si se destilda el IPC, la cuota queda en la base.
 * - automático pendiente: permite una base manual (sugerida o editada) y queda marcado como "manual".
 */
export function resolverCalculoCobro(
  evento: EventoIPC,
  historial: HistorialIPCEntry[],
  fecha: string,
  opciones: OpcionesCobro,
): { calculo: CalculoIPC } | { error: string } | { calculo: null } {
  const resultado = calcularIPCPeriodo(evento, historial, fecha)
  if (resultado.estado === "no_aplica") return { calculo: null }
  if (resultado.estado === "listo") {
    const calculo = resultado.calculo
    // Quien cobra puede corregir la base a mano (ej. un descuento puntual) antes
    // de aplicar el IPC y la mora, incluso cuando el cálculo automático está listo.
    if (opciones.baseManual != null && Number.isFinite(opciones.baseManual) && opciones.baseManual > 0 && opciones.baseManual !== calculo.base) {
      const base = opciones.baseManual
      return { calculo: {
        version: "ultima-cuota-v1", periodo: calculo.periodo, base, origen: "manual", porcentaje: calculo.porcentaje,
        monto: opciones.aplicarIPC ? Math.round(base * (1 + calculo.porcentaje / 100)) : base,
        aplicadoEsteMes: false, ipcOmitido: !opciones.aplicarIPC,
        ...marcaProvisorio(calculo.ipcProvisorio ? { provisorio: true, periodoIndice: calculo.periodoIndice! } : null),
      } }
    }
    return { calculo: opciones.aplicarIPC ? calculo : { ...calculo, monto: calculo.base, ipcOmitido: true } }
  }
  const sugerencia = sugerirBaseManual(evento, historial, fecha)
  const base = opciones.baseManual ?? sugerencia?.base
  if (!sugerencia || !Number.isFinite(base) || base! <= 0) return { error: resultado.motivo }
  if (opciones.aplicarIPC && sugerencia.porcentaje === null) {
    return { error: `IPC de ${sugerencia.periodo} pendiente de definición o duplicado. Cargalo o destildá el IPC para cobrar sin ajuste.` }
  }
  const porcentaje = sugerencia.porcentaje ?? 0
  return { calculo: {
    version: "ultima-cuota-v1", periodo: sugerencia.periodo, base: base!, origen: "manual", porcentaje,
    monto: opciones.aplicarIPC ? Math.round(base! * (1 + porcentaje / 100)) : base!,
    aplicadoEsteMes: false, ipcOmitido: !opciones.aplicarIPC,
    ...marcaProvisorio(sugerencia.ipcProvisorio && sugerencia.porcentaje !== null ? { provisorio: true, periodoIndice: sugerencia.periodoIndice! } : null),
  } }
}

/** Cuánto falta para completar una cuota puntual del plan (0 si no existe o ya está paga). */
export function saldoDeCuota(evento: EventoIPC, numero: number): number {
  const cuota = evento.planDeCuotas?.cuotas?.find(c => c.numero === numero)
  if (!cuota) return 0
  return saldoRestanteCuota(cuota)
}

/** Estado (pendiente/parcial/pagada) de una cuota puntual del plan. */
export function estadoCuotaPlan(evento: EventoIPC, numero: number): EstadoCuota {
  const cuota = evento.planDeCuotas?.cuotas?.find(c => c.numero === numero)
  if (!cuota) return "pendiente"
  return estadoDeCuota(cuota)
}

/** Proyección de lectura: no guarda, no cambia cobros ni inventa importes cuando falta evidencia. */
export function proyectarIPC<T extends EventoIPC>(evento: T, historial: HistorialIPCEntry[], fecha = fechaNegocio()): T {
  const resultado = calcularIPCPeriodo(evento, historial, fecha)
  if (resultado.estado === "no_aplica") return evento
  const pagadas = numerosPagados(evento)
  return { ...evento, planDeCuotas: {
    ...evento.planDeCuotas!, ipcVigente: resultado,
    cuotas: evento.planDeCuotas!.cuotas?.map(c =>
      resultado.estado === "listo" && !pagadas.includes(c.numero) ? { ...c, montoCuota: resultado.calculo.monto } : c),
  } }
}

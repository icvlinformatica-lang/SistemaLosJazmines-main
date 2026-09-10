import type { EventoGuardado, HistorialIPCEntry, PagoEvento } from "./store"

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
  const [anio, mes] = periodo.split("-").map(Number)
  const indices = historial.filter(h => h.anio === anio && h.mes === mes - 1)
  if (indices.length !== 1) return pendiente(`IPC de ${periodo} pendiente de definición o duplicado. Cargá un único índice antes de cobrar.`)
  const porcentaje = indices[0].porcentaje
  if (!Number.isFinite(porcentaje) || porcentaje <= -100) return pendiente("El porcentaje IPC no es válido.")
  const plan = evento.planDeCuotas!
  const pagos = evento.pagos ?? []
  if (pagos.some(p => !numeroCuotaPago(p) && !/^(seña|sena|extra|pago único)/i.test(p.notas ?? ""))) {
    return pendiente("Hay pagos sin cuota identificada. Revisá su importe neto antes de recalcular.")
  }
  const acreditados: Array<{ numero: number; fecha: string; neto: number; id?: string; ipc?: CalculoIPC }> = []
  for (const numero of numerosPagados(evento)) {
    const cuota = plan.cuotas?.find(c => c.numero === numero)
    const candidatos = pagos.filter(p => numeroCuotaPago(p) === numero)
    if (candidatos.length > 1) return pendiente(`La cuota ${numero} tiene más de un pago asociado. Revisá su base neta.`)
    const pago = candidatos[0]
    const fechaReal = fechaValida(pago?.fecha ?? cuota?.fechaPagoReal)
    const neto = pago ? netoHistorico(pago) : cuota?.montoPagadoNeto
    if (!fechaReal || !Number.isFinite(neto) || neto! <= 0) return pendiente(`Falta acreditar el importe sin mora o la fecha real de la cuota ${numero}. No se modifican las pendientes.`)
    if (fechaReal > dia) return pendiente("Hay pagos posteriores a la fecha elegida. Revisá la fecha antes de cobrar.")
    acreditados.push({ numero, fecha: fechaReal, neto: neto!, id: pago?.id, ipc: pago?.calculoIPC ?? cuota?.calculoIPC })
  }
  acreditados.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero || (a.id ?? "").localeCompare(b.id ?? ""))
  const delMes = acreditados.filter(p => p.fecha.slice(0, 7) === periodo)
  const primeroDelMes = delMes[0]
  if (primeroDelMes) {
    const foto = primeroDelMes.ipc
    if (!foto || foto.version !== "ultima-cuota-v1" || foto.periodo !== periodo) {
      return pendiente("Hay una cuota cobrada este mes sin base mensual auditada. Confirmá esa base antes de aplicar la nueva regla.")
    }
    if (foto.origen === "pago" && !acreditados.some(p => foto.pagoOrigenId ? p.id === foto.pagoOrigenId : p.numero === foto.cuotaOrigen)) {
      return pendiente("La base mensual depende de un pago anulado. Revisá la base antes de cobrar otra cuota.")
    }
    if (!Number.isFinite(foto.base) || foto.base <= 0) return pendiente("La base mensual guardada no es válida.")
    return { estado: "listo", calculo: { ...foto, porcentaje, monto: Math.round(foto.base * (1 + porcentaje / 100)), aplicadoEsteMes: true } }
  }
  const ultima = acreditados.at(-1)
  const base = ultima?.neto ?? plan.montoCuota
  if (!Number.isFinite(base) || base <= 0) return pendiente("La cuota base original del plan no está disponible.")
  return { estado: "listo", calculo: {
    version: "ultima-cuota-v1", periodo, base, origen: ultima ? "pago" : "plan",
    pagoOrigenId: ultima?.id, cuotaOrigen: ultima?.numero, porcentaje,
    monto: Math.round(base * (1 + porcentaje / 100)), aplicadoEsteMes: false,
  } }
}

function indiceDelPeriodo(historial: HistorialIPCEntry[], periodo: string): number | null {
  const [anio, mes] = periodo.split("-").map(Number)
  const indices = historial.filter(h => h.anio === anio && h.mes === mes - 1)
  return indices.length === 1 && Number.isFinite(indices[0].porcentaje) && indices[0].porcentaje > -100 ? indices[0].porcentaje : null
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
  return { base, origen: ultimo ? "pago" : "plan", porcentaje: indiceDelPeriodo(historial, periodo), periodo }
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
  } }
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

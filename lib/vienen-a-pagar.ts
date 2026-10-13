import type { VieneAPagar } from "@/lib/resumen-diario"
import type { IngresoPendiente } from "@/lib/hooks/use-caja-eventos"

export type CuotaPorPagar = VieneAPagar["cuotasPendientes"][number] & {
  eventoId: string
  evento: string
  fechaEvento: string
  /** Teléfono del cliente (del contrato), para el botón de WhatsApp. */
  telefono?: string
}

export function limiteCuotasVisibles(ampliaciones: number): number {
  return ampliaciones >= 3 ? Infinity : 5 * (ampliaciones + 1)
}

export function ordenarCuotasPorEvento(grupos: ReturnType<typeof agruparCuotasPorSalon>) {
  return grupos.flatMap((grupo) => grupo.cuotas.map((cuota) => ({ ...cuota, salon: grupo.salon })))
    .sort((a, b) => (a.fechaEvento || "9999-12-31").localeCompare(b.fechaEvento || "9999-12-31")
      || a.evento.localeCompare(b.evento) || a.salon.localeCompare(b.salon) || a.numero - b.numero)
}

export function agruparCuotasPorSalon(lista: VieneAPagar[]) {
  const grupos = new Map<string, CuotaPorPagar[]>()
  for (const evento of lista) {
    const salon = evento.salonId
    const cuotas = grupos.get(salon) ?? []
    for (const cuota of evento.cuotasPendientes) {
      cuotas.push({ ...cuota, eventoId: evento.eventoId, evento: evento.evento, fechaEvento: evento.fechaEvento, telefono: evento.telefono })
    }
    if (cuotas.length) grupos.set(salon, cuotas)
  }
  return [...grupos].map(([salon, cuotas]) => {
    cuotas.sort((a, b) => Number(a.atrasada) - Number(b.atrasada) || a.fechaVencimiento.localeCompare(b.fechaVencimiento) || a.evento.localeCompare(b.evento) || a.numero - b.numero)
    const columnas: CuotaPorPagar[][] = []
    for (let i = 0; i < cuotas.length; i += 5) columnas.push(cuotas.slice(i, i + 5))
    return {
      salon,
      cuotas,
      columnas,
      cantidadSemana: cuotas.filter((c) => !c.atrasada).length,
      cantidadAtrasada: cuotas.filter((c) => c.atrasada).length,
      totalSemana: cuotas.reduce((s, c) => s + (c.atrasada ? 0 : c.monto), 0),
      totalAtrasado: cuotas.reduce((s, c) => s + (c.atrasada ? c.monto : 0), 0),
    }
  })
}

/**
 * Cuántas cuotas atrasadas hay en total. Sale de la misma agrupación que usa
 * el modal "Vienen a pagar", para que el número del botón de Inicio coincida
 * siempre con el recuadro "Atrasado" del modal.
 */
export function contarCuotasAtrasadas(lista: VieneAPagar[]): number {
  return agruparCuotasPorSalon(lista).reduce((s, g) => s + g.cantidadAtrasada, 0)
}

/** Último día (YYYY-MM-DD) del mes de `hoy` (YYYY-MM-DD). */
export function finDeMes(hoy: string): string {
  const [anio, mes] = hoy.split("-").map(Number)
  const ultimoDia = new Date(anio, mes, 0).getDate()
  return `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`
}

/** Recargo fijo por día de atraso de una cuota (el mismo de Cobrar cuota y del resumen diario). */
export const RECARGO_POR_DIA_ATRASO = 3000

/** Días enteros entre el vencimiento y hoy (0 si todavía no venció). */
function diasDeAtraso(vencimiento: string, hoy: string): number {
  const dia = (ymd: string) => { const [a, m, d] = ymd.split("-").map(Number); return Date.UTC(a, m - 1, d) }
  return Math.max(0, Math.round((dia(hoy) - dia(vencimiento)) / 86400000))
}

export interface PorEntrarSalon {
  salon: string
  cajaEventos: number
  cajaJazmines: number
}

/**
 * Cuánto falta entrar a cada caja, por salón, si se pagan todas las cuotas
 * que vencen hasta fin de este mes (incluidas las atrasadas de meses
 * anteriores). Parte de la lista de cuotas pendientes que arma Caja Eventos
 * (calcularCajaEventos), así el reparto es el mismo que al cobrar: a Caja
 * Eventos va la parte proporcional (costo del evento + 5 %) del saldo que
 * falta de cada cuota, y el resto va a Caja Jazmines.
 *
 * Con `conRecargo`, a cada cuota vencida se le suma el recargo por atraso
 * ($3.000 por día, como en la lista de "Vienen a pagar"), repartido entre las
 * cajas con la misma proporción, igual que cuando se cobra cuota + recargo.
 */
export function porEntrarDelMesPorSalon(
  ingresos: Pick<IngresoPendiente, "salon" | "fechaVencimiento" | "monto" | "saldoRestante">[],
  hoy: string,
  salones: readonly string[],
  conRecargo = false,
): PorEntrarSalon[] {
  const limite = finDeMes(hoy)
  const totales = new Map(salones.map((salon) => [salon, { salon, cajaEventos: 0, cajaJazmines: 0 }]))
  for (const ingreso of ingresos) {
    if (ingreso.fechaVencimiento > limite) continue
    const fila = totales.get(ingreso.salon)
    if (!fila) continue
    const recargo = conRecargo ? diasDeAtraso(ingreso.fechaVencimiento, hoy) * RECARGO_POR_DIA_ATRASO : 0
    const proporcionEventos = ingreso.saldoRestante > 0 ? ingreso.monto / ingreso.saldoRestante : 0
    const total = ingreso.saldoRestante + recargo
    const eventos = Math.round((ingreso.monto + recargo * proporcionEventos) * 100) / 100
    fila.cajaEventos += eventos
    fila.cajaJazmines += Math.round((total - eventos) * 100) / 100
  }
  return [...totales.values()].map((fila) => ({
    salon: fila.salon,
    cajaEventos: Math.round(fila.cajaEventos * 100) / 100,
    cajaJazmines: Math.round(fila.cajaJazmines * 100) / 100,
  }))
}

import type { VieneAPagar } from "@/lib/resumen-diario"

export type CuotaPorPagar = VieneAPagar["cuotasPendientes"][number] & {
  evento: string
  fechaEvento: string
}

export function agruparCuotasPorSalon(lista: VieneAPagar[]) {
  const grupos = new Map<string, CuotaPorPagar[]>()
  for (const evento of lista) {
    const salon = evento.salonId
    const cuotas = grupos.get(salon) ?? []
    for (const cuota of evento.cuotasPendientes) {
      cuotas.push({ ...cuota, evento: evento.evento, fechaEvento: evento.fechaEvento })
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

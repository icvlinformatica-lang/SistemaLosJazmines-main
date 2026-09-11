import type { EventoGuardado } from "@/lib/store"

export function obtenerAgendaPersonal(eventos: EventoGuardado[], personalId: string, hoy: string) {
  const vistos = new Set<string>()
  return eventos.filter((evento) => {
    if (evento.estado === "cancelado" || vistos.has(evento.id)) return false
    const asignado = evento.personalEvento?.some((p) => p.personalId === personalId)
      || evento.asignaciones?.some((a) => a.personalAsignadoId === personalId)
    if (!asignado) return false
    vistos.add(evento.id)
    return true
  }).sort((a, b) => {
    const anteriorA = a.fecha < hoy || a.estado === "completado"
    const anteriorB = b.fecha < hoy || b.estado === "completado"
    if (anteriorA !== anteriorB) return anteriorA ? 1 : -1
    return (anteriorA ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha))
      || a.id.localeCompare(b.id)
  })
}

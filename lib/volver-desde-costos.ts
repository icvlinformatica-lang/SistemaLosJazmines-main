// A dónde lleva la flecha de "volver" de Costos del evento.
// Si se entró desde Caja de eventos, se vuelve ahí y al mismo mes del
// calendario que se estaba mirando; desde cualquier otro lugar se sigue
// volviendo a la lista de eventos, como siempre.

export const ORIGEN_CAJA_EVENTOS = "caja-eventos"

const MES_RE = /^(\d{4})-(\d{2})$/

/** Mes "YYYY-MM" (1 a 12) de una fecha, para pasarlo en la dirección. */
export function mesParaUrl(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`
}

/** Lee un mes "YYYY-MM" de la dirección. Devuelve el día 1 de ese mes o null si no es válido. */
export function mesDesdeUrl(valor: string | null | undefined): Date | null {
  const m = MES_RE.exec(valor ?? "")
  if (!m) return null
  const anio = Number(m[1])
  const mes = Number(m[2])
  if (mes < 1 || mes > 12) return null
  return new Date(anio, mes - 1, 1)
}

/** Dirección de Costos del evento abierta desde Caja de eventos. */
export function urlCostosDesdeCaja(eventoId: string, mesCalendario: Date): string {
  const params = new URLSearchParams({ id: eventoId, from: ORIGEN_CAJA_EVENTOS, mes: mesParaUrl(mesCalendario) })
  return `/eventos/costos?${params.toString()}`
}

/** A dónde vuelve la flecha de Costos del evento según de dónde se entró. */
export function destinoVolverCostos(from: string | null | undefined, mes: string | null | undefined): {
  href: string
  etiqueta: string
} {
  if (from === ORIGEN_CAJA_EVENTOS) {
    const fecha = mesDesdeUrl(mes)
    return {
      href: fecha ? `/finanzas/caja-eventos?mes=${mesParaUrl(fecha)}` : "/finanzas/caja-eventos",
      etiqueta: "Volver a Caja de eventos",
    }
  }
  return { href: "/eventos/lista", etiqueta: "Volver a la lista de eventos" }
}

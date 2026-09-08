export function fechaResumenValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < "0001-01-01") return false
  const date = new Date(`${fecha}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === fecha
}

export function cambiarDiaResumen(fecha: string, dias: number): string {
  if (!fechaResumenValida(fecha)) return fecha
  const date = new Date(`${fecha}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + dias)
  const siguiente = date.toISOString().slice(0, 10)
  return fechaResumenValida(siguiente) ? siguiente : fecha
}

/** Viernes a domingo de la semana de la fecha elegida. */
export function rangoFinde(fecha = fechaArgentina()): { desde: string; hasta: string } {
  const base = fechaResumenValida(fecha) ? fecha : fechaArgentina()
  const dia = new Date(`${base}T12:00:00Z`).getUTCDay()
  const desde = cambiarDiaResumen(base, dia === 0 ? -2 : 5 - dia)
  return { desde, hasta: cambiarDiaResumen(desde, 2) }
}

export function fechaArgentina(ahora = new Date()): string {
  return ahora.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
}

// Candado de señas a proveedores: la seña de un servicio recién se puede pagar
// cuando pasaron 4 meses de la fecha de alta del evento (evento.fechaAlta), o
// cuando falta un mes para la fiesta — lo que llegue PRIMERO. Antes de eso
// solo se paga como "extraordinario", con PIN de Administración y motivo.
//
// Lógica pura (sin React ni fetch) para poder probarla en
// scripts/test-candado-senas.cjs. Todas las fechas son "YYYY-MM-DD" y se
// manejan en hora local (parseLocalDate), nunca en UTC.

export const MESES_CANDADO_SEÑA = 4
export const DIAS_ANTES_FIESTA_SEÑA = 30

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})/

/** "YYYY-MM-DD" → Date local al mediodía (sin corrimientos por UTC). */
export function parseLocalDate(fecha: string): Date | null {
  const m = RE_FECHA.exec((fecha ?? "").trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Date → "YYYY-MM-DD" en hora local. */
export function aFechaISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Suma meses calendario; si el día no existe en el mes destino, usa el último
 *  día de ese mes (31/07 + 4 meses = 30/11). */
function sumarMeses(d: Date, meses: number): Date {
  const total = d.getMonth() + meses
  const anio = d.getFullYear() + Math.floor(total / 12)
  const mes = ((total % 12) + 12) % 12
  const ultimoDia = new Date(anio, mes + 1, 0).getDate()
  return new Date(anio, mes, Math.min(d.getDate(), ultimoDia), 12, 0, 0)
}

function restarDias(d: Date, dias: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dias, 12, 0, 0)
}

/**
 * Fecha ("YYYY-MM-DD") desde la que se puede pagar la seña: la MÁS TEMPRANA
 * entre (fechaAlta + 4 meses) y (fechaEvento − 30 días). Sin fecha de alta
 * válida → null (no hay candado). Sin fecha de evento → solo alta + 4 meses.
 */
export function fechaHabilitacionSeña(fechaAlta?: string | null, fechaEvento?: string | null): string | null {
  const alta = parseLocalDate(fechaAlta ?? "")
  if (!alta) return null
  const porAlta = sumarMeses(alta, MESES_CANDADO_SEÑA)
  const fiesta = parseLocalDate(fechaEvento ?? "")
  if (!fiesta) return aFechaISO(porAlta)
  const porFiesta = restarDias(fiesta, DIAS_ANTES_FIESTA_SEÑA)
  return aFechaISO(porFiesta < porAlta ? porFiesta : porAlta)
}

/** true si hoy es ANTERIOR a la fecha de habilitación. Sin fecha de alta → false. */
export function señaBloqueada(
  fechaAlta: string | null | undefined,
  fechaEvento: string | null | undefined,
  hoy: string | Date,
): boolean {
  const habilitacion = fechaHabilitacionSeña(fechaAlta, fechaEvento)
  if (!habilitacion) return false
  const hoyISO = typeof hoy === "string" ? aFechaISO(parseLocalDate(hoy) ?? new Date()) : aFechaISO(hoy)
  return hoyISO < habilitacion
}

/** "YYYY-MM-DD" → "DD/MM/AA" para el texto "Se habilita el ...". */
export function formatoHabilitacion(fecha: string): string {
  const [a, m, d] = fecha.split("-")
  return `${d}/${m}/${a.slice(2)}`
}

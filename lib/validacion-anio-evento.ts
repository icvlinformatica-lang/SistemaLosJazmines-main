// Restricción de años válidos para la fecha de un evento.
// Existe porque se detectaron eventos creados con años mal escritos
// (ej: "0027" en vez de "2027") al tipear la fecha a mano.
// No modifica cómo se carga o guarda la fecha, solo valida el año antes
// de permitir que un evento se cree o se modifique.

export const ANIOS_EVENTO_PERMITIDOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032] as const
export const ANIO_EVENTO_MIN = 2026
export const ANIO_EVENTO_MAX = 2032

// Límites listos para usar como min/max en un <input type="date">
export const FECHA_EVENTO_MIN = `${ANIO_EVENTO_MIN}-01-01`
export const FECHA_EVENTO_MAX = `${ANIO_EVENTO_MAX}-12-31`

/**
 * Extrae el año de una fecha en formato "YYYY-MM-DD" (o cualquier string que
 * empiece así). Devuelve null si no se puede determinar un año de 4 dígitos.
 */
export function extraerAnioFecha(fecha: string | null | undefined): number | null {
  if (!fecha) return null
  const match = /^(\d{4})-\d{2}-\d{2}/.exec(fecha)
  if (!match) return null
  const anio = Number(match[1])
  return Number.isFinite(anio) ? anio : null
}

/**
 * Valida que la fecha de un evento tenga un año dentro del rango permitido.
 * Si no hay fecha, se considera válido (esa ausencia la maneja otra validación).
 */
export function validarAnioEvento(fecha: string | null | undefined): { valido: boolean; anio: number | null } {
  const anio = extraerAnioFecha(fecha)
  if (anio === null) return { valido: true, anio: null }
  return { valido: anio >= ANIO_EVENTO_MIN && anio <= ANIO_EVENTO_MAX, anio }
}

export function mensajeAnioEventoInvalido(anio: number | null): string {
  return `El año ${anio ?? "ingresado"} no es válido. La fecha del evento debe estar entre ${ANIO_EVENTO_MIN} y ${ANIO_EVENTO_MAX}.`
}

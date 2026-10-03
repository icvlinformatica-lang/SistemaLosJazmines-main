// Fecha de alta de un evento (fecha real de venta). Columna eventos.fecha_alta
// (date, default current_date): los eventos nuevos la toman de la base y los
// existentes se cargan aparte. Ver supabase/migrations/20261002_fecha_alta_eventos.sql.
//
// Regla al guardar un evento (PATCH /api/eventos/[id]):
// - Guardar un evento NUNCA la borra ni la pisa: si llega vacía, inválida o
//   igual a la guardada, se ignora.
// - Cambiarla solo puede hacerlo Administración (o Soporte). Si la manda otro
//   perfil, se ignora EN SILENCIO (no se escribe) y el resto del evento se
//   guarda igual: hay pantallas que mandan el evento completo y no pueden
//   fallar por arrastrar una fecha de alta vieja.

/** Perfiles que pueden editar la fecha de alta. */
export const PERFILES_EDITAN_FECHA_ALTA = ["administracion", "soporte"] as const

export function puedeEditarFechaAlta(perfil: string | null | undefined): boolean {
  return !!perfil && (PERFILES_EDITAN_FECHA_ALTA as readonly string[]).includes(perfil)
}

/** "YYYY-MM-DD" de una fecha real (rechaza 2026-02-30, formatos raros, etc.). */
export function esFechaAltaValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const d = new Date(`${valor}T12:00:00Z`)
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === valor
}

export type DecisionFechaAlta = { accion: "ignorar" } | { accion: "guardar"; fecha: string }

/**
 * Qué hacer con `fechaAlta` cuando viene en un guardado del evento.
 * @param nueva lo que mandó la app (puede no venir, venir vacía o igual)
 * @param actual lo guardado en la base ("YYYY-MM-DD" o null)
 * @param perfil perfil de la sesión que guarda
 */
export function decidirFechaAlta(nueva: unknown, actual: string | null | undefined, perfil: string | null | undefined): DecisionFechaAlta {
  if (!esFechaAltaValida(nueva) || nueva === (actual ?? null)) return { accion: "ignorar" }
  return puedeEditarFechaAlta(perfil) ? { accion: "guardar", fecha: nueva } : { accion: "ignorar" }
}

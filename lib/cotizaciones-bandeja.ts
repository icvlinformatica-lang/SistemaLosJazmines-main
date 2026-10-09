// Bandeja de cotizaciones de Administración (/eventos/cotizaciones): hace
// cuánto llegó cada una, la fecha del evento en corto y el orden de la lista.
// Funciones puras para poder probarlas (scripts/test-cotizaciones-bandeja.cjs).
// Solo pantalla: no cambian ningún dato guardado.
import { fechaNegocio } from "./ipc-cuotas"

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]

/** Días entre dos fechas "YYYY-MM-DD" (b - a), sin depender de la hora. */
function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number)
  const [yb, mb, db] = b.split("-").map(Number)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000)
}

/**
 * "enviada hoy", "enviada ayer" o "enviada hace N días", contando días de
 * Argentina (fechaNegocio): una que llegó a las 22:00 sigue siendo "hoy" y
 * no "ayer", como pasaría con el día UTC. `cuando` es el updated_at que deja
 * "Enviar a revisión" (cada reenvío lo vuelve a poner en ese momento).
 */
export function haceCuanto(cuando: string | null | undefined, verbo = "enviada", ahora = new Date()): string | null {
  if (!cuando) return null
  const fecha = new Date(cuando)
  if (Number.isNaN(fecha.getTime())) return null
  const dias = Math.max(0, diasEntre(fechaNegocio(fecha), fechaNegocio(ahora)))
  if (dias === 0) return `${verbo} hoy`
  if (dias === 1) return `${verbo} ayer`
  return `${verbo} hace ${dias} días`
}

/** Días desde que se envió, para marcar las que esperan hace mucho. */
export function diasEsperando(cuando: string | null | undefined, ahora = new Date()): number {
  if (!cuando) return 0
  const fecha = new Date(cuando)
  if (Number.isNaN(fecha.getTime())) return 0
  return Math.max(0, diasEntre(fechaNegocio(fecha), fechaNegocio(ahora)))
}

/** "sáb 21/11/2026" a partir de "2026-11-21". Si no tiene ese formato, se devuelve tal cual. */
export function fechaEventoCorta(fecha: string | null | undefined): string {
  if (!fecha) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  if (!m) return fecha
  const [, y, mes, d] = m
  const dia = DIAS[new Date(Date.UTC(Number(y), Number(mes) - 1, Number(d))).getUTCDay()]
  return `${dia} ${d}/${mes}/${y}`
}

/**
 * Orden de la bandeja: primero el evento más cercano (es el que más apura
 * aprobar). Las que no tienen fecha válida van al final; a igual fecha, la
 * que llegó antes.
 */
export function ordenarPorFechaEvento<T extends { fechaEvento: string | null; updatedAt?: string | null }>(lista: T[]): T[] {
  const valida = (f: string | null) => !!f && /^\d{4}-\d{2}-\d{2}$/.test(f)
  return [...lista].sort((a, b) => {
    const va = valida(a.fechaEvento)
    const vb = valida(b.fechaEvento)
    if (va !== vb) return va ? -1 : 1
    if (va && vb && a.fechaEvento !== b.fechaEvento) return a.fechaEvento! < b.fechaEvento! ? -1 : 1
    return String(a.updatedAt ?? "").localeCompare(String(b.updatedAt ?? ""))
  })
}

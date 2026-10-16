// Anotaciones de cada perfil en cada evento (tabla anotaciones_evento,
// migración 024). Lógica pura, sin base: la usan la ruta
// app/api/eventos/[id]/anotacion y el cuadro components/anotacion-evento.tsx.

/** Largo máximo de una anotación. Alcanza para varios párrafos. */
export const LARGO_MAX_ANOTACION = 5000

/** Espera desde la última tecla hasta guardar solo. */
export const ESPERA_GUARDADO_MS = 800

/** Ids de evento como los arma el sistema (letras, números, guiones). */
export function idEventoValido(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_.:-]{1,100}$/.test(id)
}

/**
 * Texto que se guarda: tiene que ser texto y no pasarse del largo. No se le
 * sacan espacios ni saltos de línea, porque se guarda mientras la persona
 * escribe y recortarlos le movería el cursor.
 */
export function textoAnotacionValido(texto: unknown): { ok: true; texto: string } | { ok: false; error: string } {
  if (typeof texto !== "string") return { ok: false, error: "La anotación tiene que ser texto" }
  if (texto.length > LARGO_MAX_ANOTACION) {
    return { ok: false, error: `La anotación no puede pasar de ${LARGO_MAX_ANOTACION} caracteres` }
  }
  return { ok: true, texto }
}

/** El error de Postgres es "la tabla no existe" (migración 024 sin aplicar). */
export function faltaTablaAnotaciones(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  return e?.code === "42P01" || /anotaciones_evento.*does not exist/i.test(e?.message || "")
}

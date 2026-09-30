// Símbolo del tipo de fiesta, para reconocerla de un vistazo en los
// calendarios (/eventos/calendario, /eventos/produccion, /eventos/staff).
//
// OJO CON LA Ñ: en la base los tipos están guardados SIN acentos ni eñe
// ("Cumpleanos de 15", 113 eventos), mientras que el tipo de TypeScript los
// declara con eñe ("Cumpleaños de 15"). Una comparación literal fallaría en
// casi todos los eventos. Por eso se normaliza antes de comparar: fuera
// acentos, eñe y mayúsculas.
//
// Los 15 van primero porque son la mayoría del salón y porque "Cumpleanos de
// 15" también empieza con "cumpleanos": si se buscara el cumpleaños común
// primero, se comería a los de 15.

/** Sin acentos, sin eñe, en minúscula y con los espacios colapsados. */
function normalizar(tipo: string): string {
  return (tipo || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca tildes y el virgulillo de la ñ
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

interface TipoConocido {
  /** Se compara contra el tipo normalizado con "empieza con". */
  prefijo: string
  emoji: string
  /** Para el `title` y los lectores de pantalla. */
  etiqueta: string
}

// El orden importa: gana el primero que coincide.
const TIPOS: TipoConocido[] = [
  { prefijo: "cumpleanos de 15", emoji: "👑", etiqueta: "Cumpleaños de 15" },
  { prefijo: "casamiento", emoji: "💍", etiqueta: "Casamiento" },
  { prefijo: "empresarial", emoji: "💼", etiqueta: "Empresarial" },
  { prefijo: "bautismo", emoji: "🕊️", etiqueta: "Bautismo" },
  { prefijo: "cumpleanos", emoji: "🎂", etiqueta: "Cumpleaños" },
]

/** Cuando no se reconoce el tipo (incluye "Otro" y los eventos sin tipo). */
const OTRO = { emoji: "🎉", etiqueta: "Otro" }

/**
 * Emoji y nombre lindo del tipo de fiesta. Nunca devuelve vacío: un evento sin
 * tipo cargado igual muestra un símbolo, así todas las filas del calendario
 * quedan alineadas.
 */
export function iconoTipoEvento(tipo: string | null | undefined): { emoji: string; etiqueta: string } {
  const n = normalizar(tipo || "")
  if (!n) return OTRO
  const encontrado = TIPOS.find((t) => n.startsWith(t.prefijo))
  return encontrado ? { emoji: encontrado.emoji, etiqueta: encontrado.etiqueta } : OTRO
}

/** Solo el emoji, para cuando no hace falta la etiqueta. */
export function emojiTipoEvento(tipo: string | null | undefined): string {
  return iconoTipoEvento(tipo).emoji
}

/** Todos los tipos con su símbolo, para la referencia arriba del calendario. */
export function referenciaTiposEvento(): Array<{ emoji: string; etiqueta: string }> {
  return [...TIPOS.map((t) => ({ emoji: t.emoji, etiqueta: t.etiqueta })), { ...OTRO }]
}

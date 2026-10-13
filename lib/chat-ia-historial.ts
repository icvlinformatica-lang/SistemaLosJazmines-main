// Historial del chat con IA (tabla chat_ia_mensajes, migración 023). Es una
// sola conversación compartida entre Administración y Soporte, que no se
// borra. Si la tabla todavía no existe, el chat sigue andando: guardar
// devuelve false y leer devuelve { disponible: false }.
//
// Corre SOLO en el servidor (app/api/chat).
import { sql } from "@/lib/db"
import type { AccionChat } from "@/lib/chat-ia-datos"

/** Perfiles que tienen el chat con IA. */
export const PERFILES_CHAT_IA = ["administracion", "soporte"]

export interface MensajeHistorial {
  id: string
  perfil: string
  rol: "user" | "assistant"
  contenido: string
  acciones: AccionChat[]
  fecha: string
}

/** Mensajes por página al abrir el chat o al tocar "Ver anteriores". */
export const MENSAJES_POR_PAGINA = 40

/** Id armado en el navegador (crypto.randomUUID o similar). */
export function idMensajeValido(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(id)
}

function leerAcciones(valor: unknown): AccionChat[] {
  let v = valor
  if (typeof v === "string") {
    try {
      v = JSON.parse(v)
    } catch {
      return []
    }
  }
  if (!Array.isArray(v)) return []
  return v.filter(
    (a): a is AccionChat => !!a && typeof a.etiqueta === "string" && typeof a.href === "string" && a.href.startsWith("/"),
  )
}

export function filaAMensaje(f: Record<string, unknown>): MensajeHistorial {
  const fecha = f.created_at instanceof Date ? f.created_at.toISOString() : String(f.created_at ?? "")
  return {
    id: String(f.id),
    perfil: String(f.perfil ?? ""),
    rol: f.rol === "assistant" ? "assistant" : "user",
    contenido: String(f.contenido ?? ""),
    acciones: leerAcciones(f.acciones),
    fecha,
  }
}

/**
 * Guarda la pregunta y la respuesta. El id de la pregunta lo arma el
 * navegador; la respuesta usa el mismo id con "-r". Con ON CONFLICT DO
 * NOTHING, un reintento del mismo envío no duplica nada.
 */
export async function guardarIntercambio(p: {
  id: string
  perfil: string
  pregunta: string
  respuesta: string
  acciones: AccionChat[]
}): Promise<boolean> {
  try {
    await sql`
      INSERT INTO chat_ia_mensajes (id, perfil, rol, contenido, acciones, created_at)
      VALUES
        (${p.id}, ${p.perfil}, 'user', ${p.pregunta}, NULL, now()),
        (${`${p.id}-r`}, ${p.perfil}, 'assistant', ${p.respuesta}, ${p.acciones.length > 0 ? JSON.stringify(p.acciones) : null}::jsonb, now() + interval '1 millisecond')
      ON CONFLICT (id) DO NOTHING
    `
    return true
  } catch (error) {
    console.error("[chat-ia] No se pudo guardar el historial:", error)
    return false
  }
}

/**
 * Últimos mensajes, del más viejo al más nuevo. Con `antes` (fecha ISO del
 * mensaje más viejo que ya se ve) trae la página anterior.
 */
export async function leerHistorial(antes?: string): Promise<{ disponible: boolean; mensajes: MensajeHistorial[]; hayMas: boolean }> {
  const limite = MENSAJES_POR_PAGINA + 1
  try {
    const filas = (antes
      ? await sql`
          SELECT id, perfil, rol, contenido, acciones, created_at FROM chat_ia_mensajes
          WHERE created_at < ${antes}::timestamptz
          ORDER BY created_at DESC LIMIT ${limite}`
      : await sql`
          SELECT id, perfil, rol, contenido, acciones, created_at FROM chat_ia_mensajes
          ORDER BY created_at DESC LIMIT ${limite}`) as unknown as Record<string, unknown>[]
    const hayMas = filas.length > MENSAJES_POR_PAGINA
    const mensajes = filas.slice(0, MENSAJES_POR_PAGINA).map(filaAMensaje).reverse()
    return { disponible: true, mensajes, hayMas }
  } catch (error) {
    console.error("[chat-ia] No se pudo leer el historial:", error)
    return { disponible: false, mensajes: [], hayMas: false }
  }
}

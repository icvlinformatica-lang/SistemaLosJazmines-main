// Historial del chat con IA (tabla chat_ia_mensajes, migración 023). Cada
// persona tiene su propia conversación (Diego, Leila, Ricky y Soporte), que
// no se borra. Soporte puede leer las de los demás, sin escribir en ellas.
// Si la tabla todavía no existe, el chat sigue andando: guardar devuelve
// false y leer devuelve { disponible: false }.
//
// Corre SOLO en el servidor (app/api/chat).
import { sql } from "@/lib/db"
import type { AccionChat } from "@/lib/chat-ia-datos"
import { tarjetasValidas, type TarjetaEventoChat } from "@/lib/chat-ia-tarjetas"

/** Perfiles que tienen el chat con IA. */
export const PERFILES_CHAT_IA = ["administracion", "soporte"]

/** Personas de Administración (las mismas que elige el login, NOMBRES_POR_PERFIL). */
export const USUARIOS_ADMINISTRACION_CHAT = ["Diego", "Leila", "Ricky"]
const USUARIO_SOPORTE = "Soporte"
/** Para una sesión de Administración sin nombre elegido (cookie vieja o borrada). */
const USUARIO_ADMINISTRACION_SIN_NOMBRE = "Administración"

/**
 * De quién es el chat. Soporte es uno solo. En Administración sale de la
 * cookie lj_usuario que setea el login: es la misma atribución que usa el
 * resto del sistema (no está firmada, así que separa las charlas pero no es
 * un candado entre Diego, Leila y Ricky).
 */
export function usuarioChat(perfilId: string, nombreCookie: string | null): string {
  if (perfilId === "soporte") return USUARIO_SOPORTE
  const nombre = (nombreCookie ?? "").trim()
  return USUARIOS_ADMINISTRACION_CHAT.includes(nombre) ? nombre : USUARIO_ADMINISTRACION_SIN_NOMBRE
}

/** Chats que Soporte puede abrir (lectura). Las personas fijas van siempre, aunque todavía no hayan escrito. */
export const USUARIOS_CHAT = [USUARIO_SOPORTE, ...USUARIOS_ADMINISTRACION_CHAT, USUARIO_ADMINISTRACION_SIN_NOMBRE]

export interface MensajeHistorial {
  id: string
  perfil: string
  rol: "user" | "assistant"
  contenido: string
  acciones: AccionChat[]
  tarjetas: TarjetaEventoChat[]
  fecha: string
}

/** Mensajes por página al abrir el chat o al tocar "Ver anteriores". */
export const MENSAJES_POR_PAGINA = 40

/** Id armado en el navegador (crypto.randomUUID o similar). */
export function idMensajeValido(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(id)
}

/**
 * La columna `acciones` guarda los botones como lista ([{etiqueta, href}]),
 * o, si la respuesta trae tarjetas de eventos, { botones, tarjetas }. Los
 * mensajes viejos son siempre la lista: se leen los dos formatos.
 */
function leerAdjuntos(valor: unknown): { acciones: AccionChat[]; tarjetas: TarjetaEventoChat[] } {
  let v = valor
  if (typeof v === "string") {
    try {
      v = JSON.parse(v)
    } catch {
      return { acciones: [], tarjetas: [] }
    }
  }
  const objeto = v && typeof v === "object" && !Array.isArray(v) ? (v as { botones?: unknown; tarjetas?: unknown }) : null
  const botones = objeto ? objeto.botones : v
  const acciones = Array.isArray(botones)
    ? botones.filter(
        (a): a is AccionChat => !!a && typeof a.etiqueta === "string" && typeof a.href === "string" && a.href.startsWith("/"),
      )
    : []
  return { acciones, tarjetas: objeto ? tarjetasValidas(objeto.tarjetas) : [] }
}

/** Lo que se guarda en `acciones` (null si no hay nada). */
export function adjuntosAGuardar(acciones: AccionChat[], tarjetas: TarjetaEventoChat[]): string | null {
  if (tarjetas.length > 0) return JSON.stringify({ botones: acciones, tarjetas })
  return acciones.length > 0 ? JSON.stringify(acciones) : null
}

export function filaAMensaje(f: Record<string, unknown>): MensajeHistorial {
  const fecha = f.created_at instanceof Date ? f.created_at.toISOString() : String(f.created_at ?? "")
  return {
    id: String(f.id),
    perfil: String(f.perfil ?? ""),
    rol: f.rol === "assistant" ? "assistant" : "user",
    contenido: String(f.contenido ?? ""),
    ...leerAdjuntos(f.acciones),
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
  usuario: string
  pregunta: string
  respuesta: string
  acciones: AccionChat[]
  tarjetas?: TarjetaEventoChat[]
}): Promise<boolean> {
  try {
    await sql`
      INSERT INTO chat_ia_mensajes (id, perfil, usuario, rol, contenido, acciones, created_at)
      VALUES
        (${p.id}, ${p.perfil}, ${p.usuario}, 'user', ${p.pregunta}, NULL, now()),
        (${`${p.id}-r`}, ${p.perfil}, ${p.usuario}, 'assistant', ${p.respuesta}, ${adjuntosAGuardar(p.acciones, p.tarjetas ?? [])}::jsonb, now() + interval '1 millisecond')
      ON CONFLICT (id) DO NOTHING
    `
    return true
  } catch (error) {
    console.error("[chat-ia] No se pudo guardar el historial:", error)
    return false
  }
}

/**
 * Últimos mensajes del chat de una persona, del más viejo al más nuevo. Con
 * `antes` (fecha ISO del mensaje más viejo que ya se ve) trae la página anterior.
 */
export async function leerHistorial(
  usuario: string,
  antes?: string,
): Promise<{ disponible: boolean; mensajes: MensajeHistorial[]; hayMas: boolean }> {
  const limite = MENSAJES_POR_PAGINA + 1
  try {
    const filas = (antes
      ? await sql`
          SELECT id, perfil, rol, contenido, acciones, created_at FROM chat_ia_mensajes
          WHERE usuario = ${usuario} AND created_at < ${antes}::timestamptz
          ORDER BY created_at DESC LIMIT ${limite}`
      : await sql`
          SELECT id, perfil, rol, contenido, acciones, created_at FROM chat_ia_mensajes
          WHERE usuario = ${usuario}
          ORDER BY created_at DESC LIMIT ${limite}`) as unknown as Record<string, unknown>[]
    const hayMas = filas.length > MENSAJES_POR_PAGINA
    const mensajes = filas.slice(0, MENSAJES_POR_PAGINA).map(filaAMensaje).reverse()
    return { disponible: true, mensajes, hayMas }
  } catch (error) {
    console.error("[chat-ia] No se pudo leer el historial:", error)
    return { disponible: false, mensajes: [], hayMas: false }
  }
}

/**
 * Chats que Soporte puede abrir: las personas fijas y cualquier otro nombre
 * que ya tenga mensajes guardados. Si no se puede leer, quedan las fijas.
 */
export async function listarChats(): Promise<string[]> {
  const nombres = [...USUARIOS_CHAT]
  try {
    const filas = (await sql`
      SELECT DISTINCT usuario FROM chat_ia_mensajes WHERE usuario IS NOT NULL
    `) as unknown as Record<string, unknown>[]
    for (const f of filas) {
      const u = String(f.usuario ?? "").trim()
      if (u && !nombres.includes(u)) nombres.push(u)
    }
  } catch (error) {
    console.error("[chat-ia] No se pudo listar los chats:", error)
  }
  return nombres
}

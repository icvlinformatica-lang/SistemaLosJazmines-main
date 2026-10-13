// Historial del chat con IA — SOLO Administración y Soporte. Cada persona
// tiene su chat (lib/chat-ia-historial.ts).
// GET            → los últimos mensajes del chat propio
// GET ?antes=ISO → la página anterior a esa fecha
// GET ?de=Nombre → SOLO Soporte: el chat de otra persona (para leer)
// Siempre devuelve `usuario` (de quién es el chat) y, a Soporte, `chats`
// (la lista para elegir).
import { verifyToken, SESSION_COOKIE, SESSION_HEADER } from "@/lib/auth/server"
import { PERFILES_CHAT_IA, leerHistorial, listarChats, usuarioChat } from "@/lib/chat-ia-historial"
import { usuarioDesdeCookie } from "@/lib/usuario-cookie"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const cookieToken = (req.headers.get("cookie") || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1)
  const session = await verifyToken(cookieToken || req.headers.get(SESSION_HEADER))
  if (!session || !PERFILES_CHAT_IA.includes(session.perfilId)) {
    return Response.json({ error: "Disponible solo para Administración y Soporte" }, { status: 403 })
  }
  const params = new URL(req.url).searchParams
  const antes = params.get("antes") || undefined
  if (antes && Number.isNaN(Date.parse(antes))) {
    return Response.json({ error: "Fecha inválida" }, { status: 400 })
  }

  const propio = usuarioChat(session.perfilId, usuarioDesdeCookie(req, ""))
  const esSoporte = session.perfilId === "soporte"
  const de = (params.get("de") || "").trim().slice(0, 60)
  // Administración solo ve su propio chat.
  if (de && de !== propio && !esSoporte) {
    return Response.json({ error: "Solo Soporte puede ver el chat de otra persona" }, { status: 403 })
  }
  const usuario = de || propio
  const [historial, chats] = await Promise.all([leerHistorial(usuario, antes), esSoporte ? listarChats() : null])
  return Response.json({ ...historial, usuario, propio: usuario === propio, ...(chats ? { chats } : {}) })
}

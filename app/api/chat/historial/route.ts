// Historial del chat con IA — SOLO Administración y Soporte.
// GET            → los últimos mensajes
// GET ?antes=ISO → la página anterior a esa fecha
import { verifyToken, SESSION_COOKIE, SESSION_HEADER } from "@/lib/auth/server"
import { PERFILES_CHAT_IA, leerHistorial } from "@/lib/chat-ia-historial"

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
  const antes = new URL(req.url).searchParams.get("antes") || undefined
  if (antes && Number.isNaN(Date.parse(antes))) {
    return Response.json({ error: "Fecha inválida" }, { status: 400 })
  }
  return Response.json(await leerHistorial(antes))
}

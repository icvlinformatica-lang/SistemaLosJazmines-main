// Chat de ayuda con IA — SOLO para el perfil Soporte.
// Responde preguntas sobre cómo usar el sistema basándose en la guía
// embebida (lib/guia-sistema.ts). NO consulta ni modifica la base de datos.
import { generateText } from "ai"
import { verifyToken, SESSION_COOKIE, SESSION_HEADER } from "@/lib/auth/server"
import { GUIA_SISTEMA } from "@/lib/guia-sistema"

export const maxDuration = 30

// Rate limit simple en memoria: máx 20 preguntas por sesión cada 10 minutos
const ventanas = new Map<string, { count: number; reset: number }>()
function permitido(clave: string): boolean {
  const ahora = Date.now()
  const v = ventanas.get(clave)
  if (!v || ahora > v.reset) {
    ventanas.set(clave, { count: 1, reset: ahora + 10 * 60 * 1000 })
    return true
  }
  if (v.count >= 20) return false
  v.count++
  return true
}

export async function POST(req: Request) {
  // El middleware ya exige sesión; acá verificamos que sea el perfil Soporte
  const cookieHeader = req.headers.get("cookie") || ""
  const cookieToken = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1)
  const token = cookieToken || req.headers.get(SESSION_HEADER)
  const session = await verifyToken(token)
  if (!session || session.perfilId !== "soporte") {
    return Response.json({ error: "Disponible solo para el perfil Soporte" }, { status: 403 })
  }

  if (!permitido(session.perfilId)) {
    return Response.json({ error: "Demasiadas preguntas seguidas. Esperá unos minutos." }, { status: 429 })
  }

  let body: { messages?: { role: string; content: string }[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  // Validación estricta: solo roles user/assistant, últimas 10, texto acotado
  const messages = (body.messages || [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 1000) }))

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "Falta la pregunta" }, { status: 400 })
  }

  try {
    const { text } = await generateText({
      model: "openai/gpt-5-mini",
      system: `Sos el asistente de ayuda del sistema Los Jazmines. Respondés SIEMPRE en español rioplatense, de forma breve y práctica (2-5 oraciones), indicando en qué pantalla se hace cada cosa y los pasos. Si la pregunta pide datos concretos del negocio (montos, eventos, nombres), aclarás que por ahora solo ayudás con el USO del sistema, no con datos. Si no sabés algo, lo decís sin inventar. Esta es la guía del sistema:\n\n${GUIA_SISTEMA}`,
      messages,
    })
    return Response.json({ text })
  } catch (error) {
    console.error("[chat-ia] Error generando respuesta:", error)
    // Caso especial: la cuenta de Vercel todavía no habilitó el AI Gateway
    const msg = error instanceof Error ? error.message : ""
    if (msg.includes("credit card") || msg.includes("customer_verification")) {
      return Response.json(
        { error: "La IA todavía no está habilitada: hay que agregar una tarjeta en la cuenta de Vercel (vercel.com → AI Gateway) para activar los créditos gratuitos." },
        { status: 503 },
      )
    }
    return Response.json({ error: "No pude generar la respuesta. Probá de nuevo." }, { status: 500 })
  }
}

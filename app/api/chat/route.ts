// Chat con IA — SOLO para Administración y Soporte (botón flotante en todo
// el sistema). Cada pregunta y su respuesta se guardan en chat_ia_mensajes
// (lib/chat-ia-historial.ts), en el chat de quien pregunta (Diego, Leila,
// Ricky o Soporte), y no se borran.
// Responde cómo usar el sistema (guía embebida, lib/guia-sistema.ts) y
// consulta eventos, cuotas y cajas con herramientas de SOLO LECTURA
// (lib/chat-ia-herramientas.ts). Puede devolver botones a pantallas.
// NUNCA modifica la base de datos.
import { generateText, stepCountIs } from "ai"
import { verifyToken, SESSION_COOKIE, SESSION_HEADER } from "@/lib/auth/server"
import { GUIA_SISTEMA } from "@/lib/guia-sistema"
import { mensajeErrorChatIA } from "@/lib/chat-ia-errores"
import { crearHerramientasChat } from "@/lib/chat-ia-herramientas"
import type { AccionChat } from "@/lib/chat-ia-datos"
import { fechaNegocio } from "@/lib/ipc-cuotas"
import { PERFILES_CHAT_IA, guardarIntercambio, idMensajeValido, usuarioChat } from "@/lib/chat-ia-historial"
import { usuarioDesdeCookie } from "@/lib/usuario-cookie"

export const maxDuration = 60

// Rate limit simple en memoria: máx 20 preguntas por persona cada 10 minutos
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
  // El middleware ya exige sesión; acá verificamos que sea Administración o Soporte
  const cookieHeader = req.headers.get("cookie") || ""
  const cookieToken = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1)
  const token = cookieToken || req.headers.get(SESSION_HEADER)
  const session = await verifyToken(token)
  if (!session || !PERFILES_CHAT_IA.includes(session.perfilId)) {
    return Response.json({ error: "Disponible solo para Administración y Soporte" }, { status: 403 })
  }

  const usuario = usuarioChat(session.perfilId, usuarioDesdeCookie(req, ""))
  if (!permitido(usuario)) {
    return Response.json({ error: "Demasiadas preguntas seguidas. Esperá unos minutos." }, { status: 429 })
  }

  let body: { id?: unknown; messages?: { role: string; content: string }[] }
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

  const hoy = fechaNegocio()
  // Los botones los agregan las herramientas mientras la IA responde.
  const acciones: AccionChat[] = []
  try {
    const { text } = await generateText({
      model: "openai/gpt-5-mini",
      system: `Sos el asistente del sistema Los Jazmines (salones de eventos). Hoy es ${hoy}. Respondés SIEMPRE en español rioplatense, breve y práctico.

Podés hacer dos cosas:
1. Explicar cómo se usa el sistema, con la guía de abajo (en qué pantalla se hace cada cosa y los pasos).
2. Consultar datos con tus herramientas: eventos y su plata (total, seña, cobrado, saldo, cuotas por cobrar), quién viene a pagar en la semana y el resumen de caja de un día.

Reglas:
- Los montos y datos salen SIEMPRE de las herramientas. Nunca inventes ni calcules un monto que no te dieron; si algo no está, decilo.
- Texto plano, sin markdown ni asteriscos; para listas usá un renglón por ítem con guion.
- Montos en pesos con punto de miles, por ejemplo $1.250.000. Fechas como 6/10/2026.
- Si el usuario nombra una fecha ("6 de octubre", "el sábado"), pasala a AAAA-MM-DD tomando hoy (${hoy}) como referencia.
- Cuando quiera ver, abrir o ir a un evento, o pregunte por un evento puntual, buscalo y llamá a mostrarAccesosEvento con su id: eso pone los botones a la Lista, las cuotas y los costos. Si hay varios eventos posibles, mostrá la lista y preguntá cuál.
- Si te pide ir a una pantalla, usá mostrarPantalla. No escribas direcciones web: los botones aparecen solos debajo de tu respuesta.
- Los costos del evento (menú, barra, servicios, personal) no los tenés: para eso está el botón de costos.
- Si una cuota tiene ipcPendiente, aclarás que el monto puede cambiar porque falta el IPC.
- No podés modificar nada (cobrar, borrar, editar): si te lo piden, indicá la pantalla y poné el botón.

Esta es la guía del sistema:

${GUIA_SISTEMA}`,
      messages,
      tools: crearHerramientasChat({ hoy, acciones }),
      stopWhen: stepCountIs(6),
    })
    // Sin id válido (pantalla vieja abierta) responde igual, sin guardar.
    const guardado = idMensajeValido(body.id)
      ? await guardarIntercambio({
          id: body.id,
          perfil: session.perfilId,
          usuario,
          pregunta: messages[messages.length - 1].content,
          respuesta: text,
          acciones,
        })
      : false
    return Response.json({ text, acciones, guardado })
  } catch (error) {
    console.error("[chat-ia] Error generando respuesta:", error)
    const { mensaje, status } = mensajeErrorChatIA(error)
    return Response.json({ error: mensaje }, { status })
  }
}

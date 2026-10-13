// Chat con IA — SOLO para Administración y Soporte (botón flotante en todo
// el sistema). Cada pregunta y su respuesta se guardan en chat_ia_mensajes
// (lib/chat-ia-historial.ts), en el chat de quien pregunta (Diego, Leila,
// Ricky o Soporte), y no se borran.
// Responde cómo usar el sistema (guía embebida, lib/guia-sistema.ts) y
// consulta eventos, cuotas y cajas con herramientas de SOLO LECTURA
// (lib/chat-ia-herramientas.ts). Puede devolver botones a pantallas y
// proponer un gasto o el cobro de una cuota, que solo se hacen cuando la
// persona toca el botón de la tarjeta. Esta ruta NUNCA modifica datos (solo
// guarda el historial del chat).
import { generateText, stepCountIs } from "ai"
import { verifyToken, SESSION_COOKIE, SESSION_HEADER } from "@/lib/auth/server"
import { GUIA_SISTEMA } from "@/lib/guia-sistema"
import { mensajeErrorChatIA } from "@/lib/chat-ia-errores"
import { crearHerramientasChat } from "@/lib/chat-ia-herramientas"
import type { AccionChat } from "@/lib/chat-ia-datos"
import type { TarjetaEventoChat } from "@/lib/chat-ia-tarjetas"
import type { PropuestaGastoChat } from "@/lib/chat-ia-gasto"
import type { PropuestaCobroChat } from "@/lib/chat-ia-cobro"
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

  // Validación estricta: solo roles user/assistant, últimas 20 (un cobro lleva varias preguntas), texto acotado
  const messages = (body.messages || [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 1000) }))

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "Falta la pregunta" }, { status: 400 })
  }

  const hoy = fechaNegocio()
  // Los botones los agregan las herramientas mientras la IA responde.
  const acciones: AccionChat[] = []
  // Las tarjetas de eventos también: los montos salen del servidor, no del texto de la IA.
  const tarjetas: TarjetaEventoChat[] = []
  // Un gasto propuesto (no cargado): lo carga la persona con el botón (/api/chat/gasto).
  const gasto: { propuesta: PropuestaGastoChat | null } = { propuesta: null }
  // Un cobro de cuota propuesto (no cobrado): lo cobra la persona con el botón, como en Cobrar cuota.
  const cobro: { propuesta: PropuestaCobroChat | null } = { propuesta: null }
  try {
    const { text } = await generateText({
      model: "openai/gpt-5-mini",
      system: `Sos el asistente del sistema Los Jazmines (salones de eventos). Hoy es ${hoy}. Respondés SIEMPRE en español rioplatense, breve y práctico.

Podés hacer dos cosas:
1. Explicar cómo se usa el sistema, con la guía de abajo (en qué pantalla se hace cada cosa y los pasos).
2. Consultar datos con tus herramientas: eventos y su plata (total, seña, cobrado, saldo, cuotas por cobrar), quién viene a pagar en la semana y el resumen de caja de un día.

Reglas:
- Cuando respondas la plata de uno o más eventos (total, cobrado, saldo, cuotas), llamá a mostrarResumenEventos con sus ids: aparece una tarjeta ordenada por evento. En ese caso NO repitas en el texto los montos de cada evento; escribí solo una o dos frases con lo importante (por ejemplo, cuál tiene más vencido o cuál está al día).
- Los montos y datos salen SIEMPRE de las herramientas. Nunca inventes ni calcules un monto que no te dieron; si algo no está, decilo.
- Texto plano, sin markdown ni asteriscos; para listas usá un renglón por ítem con guion.
- Montos en pesos con punto de miles, por ejemplo $1.250.000. Fechas como 6/10/2026.
- Si el usuario nombra una fecha ("6 de octubre", "el sábado"), pasala a AAAA-MM-DD tomando hoy (${hoy}) como referencia.
- Cuando quiera ver, abrir o ir a un evento, o pregunte por un evento puntual, buscalo y llamá a mostrarAccesosEvento con su id: eso pone los botones a la Lista, las cuotas y los costos. Si hay varios eventos posibles, mostrá la lista y preguntá cuál.
- Si te pide ir a una pantalla, usá mostrarPantalla. No escribas direcciones web: los botones aparecen solos debajo de tu respuesta.
- Los costos del evento (menú, barra, servicios, personal) no los tenés: para eso está el botón de costos.
- Si una cuota tiene ipcPendiente, aclarás que el monto puede cambiar porque falta el IPC.
- Podés preparar un gasto variable de Caja Jazmines, con proponerGasto. Nunca lo cargás vos: aparece una tarjeta y la persona lo carga con el botón "Sí, cargar". Antes de proponerlo necesitás concepto (qué es y a nombre de quién), monto y salón; si falta algo, preguntalo. Después de proponerlo, preguntá en una frase si está seguro, por ejemplo: "¿Seguro que querés cargar un gasto variable en Salón a nombre de Pepo por $50.000?". Nunca digas que ya está cargado. Si la persona responde "sí" escribiendo, recordale que lo confirme con el botón de la tarjeta.
- También podés preparar el cobro de una cuota, con proponerCobroCuota. Nunca lo cobrás vos: aparece una tarjeta y la persona cobra con el botón "Sí, cobrar". Es plata real: preguntá con cuidado, de a una o dos preguntas por mensaje, y no supongas nada. Los pasos:
  1. Qué evento: buscalo con buscarEventos. Si hay más de uno posible, mostrá la lista y preguntá cuál. Confirmá el nombre, el salón y la fecha.
  2. Llamá a consultarCobroCuota con su id y contá qué cuota toca (número, vencimiento y cuánto vale; si tiene IPC, decilo con su porcentaje y si es provisorio). Si hay más de una cuota para cobrar (una con pago parcial), preguntá cuál. Si dice noSePuede, explicá el motivo y poné el botón a Cobrar cuota.
  3. Si la cuota está atrasada, avisá cuántos días y el recargo (diasAtraso x $3.000) y preguntá si se cobra el recargo o se perdona.
  4. Preguntá si paga la cuota completa (decí el total, con el recargo si se cobra) o una parte. Si paga una parte: cuánto entrega; y después qué pasa con lo que queda: si se suma a la cuota siguiente o queda aparte, y si sigue generando IPC o queda congelado.
  5. Preguntá quién paga (nombre de la persona).
  6. Preguntá quién recibe la plata; si quienUsaElChat tiene un nombre, ofrecelo ("¿La recibís vos, Leila?").
  7. Opcional: si paga en efectivo y quiere el vuelto, con cuánto paga.
  Con todo respondido, llamá a proponerCobroCuota y preguntá en una frase si está seguro, por ejemplo: "¿Seguro que querés cobrar $350.000 de la cuota 3 de 10 de Lucía y Tomás, que paga Marta y recibe Leila?". Si proponerCobroCuota devuelve un motivo, preguntá lo que falta. Nunca digas que ya está cobrado. Si la persona responde "sí" escribiendo, recordale que lo confirme con el botón de la tarjeta. Cargar pagos viejos (modo histórico), cambiar la base de la cuota a mano o cobrar sin IPC se hace en la pantalla Cobrar cuota: poné el botón.
- Fuera de eso no podés modificar nada (borrar, editar, anular pagos, retiros, gastos repartidos entre salones): si te lo piden, indicá la pantalla y poné el botón.

Esta es la guía del sistema:

${GUIA_SISTEMA}`,
      messages,
      tools: crearHerramientasChat({ hoy, acciones, tarjetas, gasto, cobro, usuario: usuario === "Soporte" || usuario === "Administración" ? "" : usuario }),
      stopWhen: stepCountIs(8),
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
          tarjetas,
          gasto: gasto.propuesta,
          cobro: cobro.propuesta,
        })
      : false
    // Sin historial no hay de dónde confirmar el gasto: se avisa en vez de mostrar el botón.
    const propuesta = gasto.propuesta && guardado ? gasto.propuesta : null
    // Lo mismo con el cobro: sin historial, no hay botón para confirmarlo.
    const propuestaCobro = cobro.propuesta && guardado ? cobro.propuesta : null
    return Response.json({
      text,
      acciones,
      tarjetas,
      gasto: propuesta,
      gastoSinGuardar: !!gasto.propuesta && !guardado,
      cobro: propuestaCobro,
      cobroSinGuardar: !!cobro.propuesta && !guardado,
      guardado,
    })
  } catch (error) {
    console.error("[chat-ia] Error generando respuesta:", error)
    const { mensaje, status } = mensajeErrorChatIA(error)
    return Response.json({ error: mensaje }, { status })
  }
}

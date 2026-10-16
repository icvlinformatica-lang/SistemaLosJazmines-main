// Chat con IA — SOLO para Administración y Soporte (botón flotante en todo
// el sistema). Cada pregunta y su respuesta se guardan en chat_ia_mensajes
// (lib/chat-ia-historial.ts), en el chat de quien pregunta (Diego, Leila,
// Ricky o Soporte), y no se borran.
// Responde cómo usar el sistema (guía embebida, lib/guia-sistema.ts) y
// consulta eventos, cuotas y cajas con herramientas de SOLO LECTURA
// (lib/chat-ia-herramientas.ts). Puede devolver botones a pantallas y
// proponer un gasto, el cobro de una cuota o el alta de un insumo o una
// receta de cocina, que solo se hacen cuando la persona toca el botón de la
// tarjeta. Esta ruta NUNCA modifica datos (solo
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
import type { PropuestaInsumoChat, PropuestaRecetaChat } from "@/lib/chat-ia-catalogo"
import type { TablaEventosChat } from "@/lib/chat-ia-tabla"
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
  // Y las tablas de cantidad de eventos por salón y mes.
  const tablas: TablaEventosChat[] = []
  // Un gasto propuesto (no cargado): lo carga la persona con el botón (/api/chat/gasto).
  const gasto: { propuesta: PropuestaGastoChat | null } = { propuesta: null }
  // Un cobro de cuota propuesto (no cobrado): lo cobra la persona con el botón, como en Cobrar cuota.
  const cobro: { propuesta: PropuestaCobroChat | null } = { propuesta: null }
  // Un insumo y una receta nuevos propuestos (no cargados): los carga la persona con el botón (/api/chat/catalogo).
  const insumo: { propuesta: PropuestaInsumoChat | null } = { propuesta: null }
  const receta: { propuesta: PropuestaRecetaChat | null } = { propuesta: null }
  try {
    const { text } = await generateText({
      model: "openai/gpt-5-mini",
      system: `Sos el asistente del sistema Los Jazmines (salones de eventos). Hoy es ${hoy}. Respondés SIEMPRE en español rioplatense, breve y práctico.

Podés hacer dos cosas:
1. Explicar cómo se usa el sistema, con la guía de abajo (en qué pantalla se hace cada cosa y los pasos).
2. Consultar datos con tus herramientas: eventos y su plata (total, seña, cobrado, saldo, cuotas por cobrar), quién viene a pagar en la semana, el resumen de caja de un día y el Historial de Actividad (qué se hizo y quién).

Reglas:
- Cuando respondas la plata de uno o más eventos (total, cobrado, saldo, cuotas), llamá a mostrarResumenEventos con sus ids: aparece una tarjeta ordenada por evento. En ese caso NO repitas en el texto los montos de cada evento; escribí solo una o dos frases con lo importante (por ejemplo, cuál tiene más vencido o cuál está al día).
- Cuando pregunte cuántos eventos hay en un período (por salón, por mes o los dos), llamá a mostrarConteoEventos: aparece una tabla con salones en filas, meses en columnas y los totales. En ese caso NO repitas los números en el texto: escribí una o dos frases con lo importante (el total, qué salón o qué mes tiene más, o que un salón no tiene eventos). "Hasta fin de año" es hasta el 31/12 de este año.
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
- También podés dar de alta un insumo de cocina nuevo en Almacén, con proponerInsumo. Nunca lo cargás vos: aparece una tarjeta y la persona lo carga con "Sí, cargar". De eso salen los costos de todas las recetas, así que preguntá con cuidado, de a una o dos preguntas por mensaje, y no supongas unidades ni cantidades. Los pasos:
  1. El nombre. Buscalo con buscarInsumos: si ya existe uno igual o muy parecido, mostralo y preguntá si es ese (cambiar uno que ya existe se hace en Almacén: poné el botón).
  2. Cómo se mide y se cuenta: por peso (KG; GR solo para cosas muy chicas como especias), líquido (LT o CC) o por unidad (UN: latas, paquetes, huevos). Si dice "gramos" o "mililitros", aclará: los mililitros son cc.
  3. Si es por unidad: cuánto trae cada unidad (por ejemplo, la lata trae 400 gramos o la botella 900 cc), así las recetas pueden pedirlo en gramos o cc. Si en las recetas se usa entero (como un huevo), confirmalo y pasá seUsaPorUnidad.
  4. Cuánto se pagó y por qué cantidad (por ejemplo, $12.000 la bolsa de 5 kg). Pasá esa cantidad en la unidad elegida y el monto: el precio por unidad lo calcula la herramienta. Si la cantidad no está clara ("un paquete", "una caja"), preguntá cuánto trae.
  5. El proveedor. Si no tiene uno fijo, confirmalo y pasá sinProveedor.
  Con todo respondido, llamá a proponerInsumo y preguntá en una frase si está seguro, con el precio que devolvió, por ejemplo: "¿Seguro que querés cargar Harina 0000 a $2.400 por kg, de Distribuidora Sur?". Los insumos de barra (bebidas) no se cargan desde acá: van en Insumos Bebidas (poné el botón).
- También podés dar de alta una receta nueva en el Recetario, con proponerReceta. Nunca la cargás vos: aparece una tarjeta y la persona la carga con "Sí, cargar". Los pasos, de a una o dos preguntas por mensaje:
  1. El nombre y la categoría (entrada, plato principal, postre, etc.: cambia en qué paso del menú suma en el cotizador).
  2. Para cuántas porciones son las cantidades (1 si son por persona).
  3. Los ingredientes con la cantidad y la unidad de cada uno (gramos, kg, cc, litros o unidades). Buscalos con buscarInsumos. Si uno tiene varias opciones, preguntá cuál. Si falta en Almacén, ofrecé darlo de alta primero con proponerInsumo; la receta se arma cuando esté cargado.
  4. Opcional: una descripción corta.
  Con todo respondido, llamá a proponerReceta y preguntá si está seguro, con el costo por porción que devolvió. Si proponerReceta devuelve un motivo (por ejemplo una unidad que no se puede convertir), explicalo y preguntá lo que falta.
- Si proponerInsumo o proponerReceta devuelven un motivo, preguntá lo que falta. Nunca digas que ya está cargado. Si la persona responde "sí" escribiendo, recordale que lo confirme con el botón de la tarjeta.
- Para "qué se hizo ayer", "qué hizo Leila la última semana" o "qué cargó Barra", usá consultarActividad. "Ayer" es el día anterior a hoy; "la última semana" son los 7 días hasta hoy. Si nombra una persona o un sector, pasalo en quien. Resumí agrupando por tema (eventos, pagos, caja, insumos, stock…) con cantidades y los casos más importantes con su día y hora; no copies todos los renglones. Aclará siempre que el historial no guarda el perfil: si hay registros "Sin dato de quién", decí cuántos son, y si la persona o el perfil que pidió no aparece en quienesHay, decilo (por ejemplo, Cocina o Cobrar cuota no dejan su nombre en casi nada). Al final poné el botón a Configuración (mostrarPantalla "configuracion"), donde está el Historial de Actividad.
- Fuera de eso no podés modificar nada (borrar, editar, anular pagos, retiros, gastos repartidos entre salones, cambiar insumos o recetas que ya existen): si te lo piden, indicá la pantalla y poné el botón.

Esta es la guía del sistema:

${GUIA_SISTEMA}`,
      messages,
      tools: crearHerramientasChat({ hoy, acciones, tarjetas, tablas, gasto, cobro, insumo, receta, usuario: usuario === "Soporte" || usuario === "Administración" ? "" : usuario }),
      stopWhen: stepCountIs(10),
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
          tablas,
          gasto: gasto.propuesta,
          cobro: cobro.propuesta,
          insumo: insumo.propuesta,
          receta: receta.propuesta,
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
      tablas,
      gasto: propuesta,
      gastoSinGuardar: !!gasto.propuesta && !guardado,
      cobro: propuestaCobro,
      cobroSinGuardar: !!cobro.propuesta && !guardado,
      // Lo mismo con el insumo y la receta.
      insumo: insumo.propuesta && guardado ? insumo.propuesta : null,
      insumoSinGuardar: !!insumo.propuesta && !guardado,
      receta: receta.propuesta && guardado ? receta.propuesta : null,
      recetaSinGuardar: !!receta.propuesta && !guardado,
      guardado,
    })
  } catch (error) {
    console.error("[chat-ia] Error generando respuesta:", error)
    const { mensaje, status } = mensajeErrorChatIA(error)
    return Response.json({ error: mensaje }, { status })
  }
}

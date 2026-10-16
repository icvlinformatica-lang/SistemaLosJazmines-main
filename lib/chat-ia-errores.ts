// Traduce los errores de la IA (AI Gateway de Vercel) a un mensaje claro para
// el chat de ayuda. El chat es solo del perfil Soporte, así que conviene que
// diga QUÉ falta configurar en vez de un "probá de nuevo" que no ayuda.

export interface ErrorChatIA {
  mensaje: string
  status: number
}

interface ErrorLike {
  name?: unknown
  message?: unknown
  type?: unknown
  statusCode?: unknown
  lastError?: unknown
  cause?: unknown
}

// generateText reintenta y envuelve el error en un RetryError (lastError);
// algunos errores traen el original en cause. Se recorre la cadena entera.
function cadenaDeErrores(error: unknown): ErrorLike[] {
  const cadena: ErrorLike[] = []
  let actual: unknown = error
  while (actual && typeof actual === "object" && cadena.length < 5) {
    const e = actual as ErrorLike
    cadena.push(e)
    actual = e.lastError ?? e.cause
  }
  return cadena
}

export function mensajeErrorChatIA(error: unknown): ErrorChatIA {
  const cadena = cadenaDeErrores(error)
  const nombres = cadena.map((e) => String(e.name ?? ""))
  const texto = cadena
    .map((e) => String(e.message ?? ""))
    .join(" | ")
  const textoMin = texto.toLowerCase()

  if (textoMin.includes("credit card") || textoMin.includes("customer_verification")) {
    return {
      mensaje:
        "La IA todavía no está habilitada: hay que agregar una tarjeta en la cuenta de Vercel (vercel.com → AI Gateway) para activar los créditos gratuitos.",
      status: 503,
    }
  }
  if (
    textoMin.includes("insufficient") ||
    textoMin.includes("credits") ||
    textoMin.includes("balance") ||
    textoMin.includes("quota")
  ) {
    return {
      mensaje:
        "Se terminaron los créditos de IA de la cuenta de Vercel. Se recargan en vercel.com → AI Gateway, o se espera al mes que viene.",
      status: 503,
    }
  }
  if (nombres.includes("GatewayAuthenticationError")) {
    return {
      mensaje:
        "La IA no está conectada: Vercel no reconoce a este proyecto. Hay que activar el AI Gateway del proyecto en vercel.com, o cargar la variable AI_GATEWAY_API_KEY y volver a publicar.",
      status: 503,
    }
  }
  if (nombres.includes("GatewayRateLimitError")) {
    return { mensaje: "La IA está saturada en este momento. Probá en un minuto.", status: 503 }
  }
  if (nombres.includes("GatewayModelNotFoundError")) {
    return {
      mensaje: "El modelo de IA configurado ya no está disponible en Vercel. Hay que cambiarlo en el código (app/api/chat/route.ts).",
      status: 503,
    }
  }

  // Desconocido: se agrega un detalle corto para poder diagnosticarlo.
  const detalle = texto.replace(/\s+/g, " ").trim().slice(0, 160)
  return {
    mensaje: detalle
      ? `No pude generar la respuesta. Probá de nuevo. (Detalle: ${detalle})`
      : "No pude generar la respuesta. Probá de nuevo.",
    status: 500,
  }
}

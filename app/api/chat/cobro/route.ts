// Marcar como cobrado o cancelado el cobro de cuota que propuso el chat con
// IA. SOLO Administración y Soporte, y solo en su propio chat.
// POST { mensajeId, accion: "confirmar" | "cancelar" }
//
// Esta ruta NO cobra: el cobro lo hace la tarjeta del chat por el mismo
// camino que Cobrar cuota (PATCH /api/eventos/[id], con la transacción, la
// concurrencia y el IPC validado de siempre). Acá solo se deja asentado en el
// mensaje del chat, y al confirmar se verifica que el pago (su id es el de la
// propuesta) esté de verdad en el evento antes de marcarlo como cobrado.
// También deja el rastro en activity_log, como Cobrar cuota.
import { verifyToken, SESSION_COOKIE, SESSION_HEADER } from "@/lib/auth/server"
import { PERFILES_CHAT_IA, adjuntosConPropuesta, leerAdjuntos, usuarioChat } from "@/lib/chat-ia-historial"
import type { PropuestaCobroChat } from "@/lib/chat-ia-cobro"
import { usuarioDesdeCookie } from "@/lib/usuario-cookie"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

class Problema extends Error {
  constructor(
    mensaje: string,
    public status: number,
  ) {
    super(mensaje)
  }
}

// Igual que formatCurrency de Cobrar cuota ("$ 350.000").
const pesos = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

function pagosDe(valor: unknown): Array<{ id?: unknown }> {
  let v = valor
  if (typeof v === "string") {
    try {
      v = JSON.parse(v)
    } catch {
      return []
    }
  }
  return Array.isArray(v) ? v : []
}

export async function POST(req: Request) {
  const cookieToken = (req.headers.get("cookie") || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1)
  const session = await verifyToken(cookieToken || req.headers.get(SESSION_HEADER))
  if (!session || !PERFILES_CHAT_IA.includes(session.perfilId)) {
    return Response.json({ error: "Disponible solo para Administración y Soporte" }, { status: 403 })
  }

  let body: { mensajeId?: unknown; accion?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 })
  }
  const mensajeId = typeof body.mensajeId === "string" ? body.mensajeId : ""
  const accion = body.accion === "confirmar" || body.accion === "cancelar" ? body.accion : null
  if (!mensajeId || mensajeId.length > 80 || !accion) {
    return Response.json({ error: "Falta el mensaje o la acción" }, { status: 400 })
  }

  const usuario = usuarioChat(session.perfilId, usuarioDesdeCookie(req, ""))
  try {
    const cobro = await sql.begin(async (trx) => {
      const tx = trx as unknown as typeof sql
      // Solo el chat de quien confirma: Soporte mirando el chat de otro no puede.
      const filas = (await tx`
        SELECT acciones FROM chat_ia_mensajes
        WHERE id = ${mensajeId} AND usuario = ${usuario} AND rol = 'assistant'
        FOR UPDATE
      `) as unknown as { acciones: unknown }[]
      if (filas.length === 0) throw new Problema("No encontré ese mensaje en tu chat.", 404)
      const adjuntos = leerAdjuntos(filas[0].acciones)
      const propuesta = adjuntos.cobro
      if (!propuesta) throw new Problema("Ese mensaje no tiene un cobro.", 404)
      // Ya resuelto (por ejemplo, un doble toque): se devuelve como quedó.
      if (propuesta.estado !== "pendiente") return propuesta

      const eventos = (await tx`
        SELECT pagos FROM eventos WHERE id = ${propuesta.eventoId} AND deleted_at IS NULL
      `) as unknown as { pagos: unknown }[]
      const pagoGuardado = eventos.length > 0 && pagosDe(eventos[0].pagos).some((p) => p?.id === propuesta.id)
      if (accion === "confirmar" && !pagoGuardado) {
        throw new Problema("El cobro no figura en el evento: no se marcó como cobrado. Probá de nuevo.", 409)
      }
      // Si el pago ya está en el evento, la tarjeta no puede quedar "cancelada".
      const estado: PropuestaCobroChat["estado"] = accion === "confirmar" || pagoGuardado ? "cobrado" : "cancelado"
      const resuelto: PropuestaCobroChat = {
        ...propuesta,
        estado,
        resueltoPor: usuario,
        resueltoEn: new Date().toISOString(),
      }
      if (estado === "cobrado") {
        // Mismo rastro que Cobrar cuota (tipo "pago"), aclarando que vino del chat.
        await tx`
          INSERT INTO activity_log (tipo, accion, nombre, detalle)
          VALUES ('pago', 'creado', ${`Cuota ${propuesta.numeroCuota} - ${propuesta.evento}`},
                  ${`Pago registrado por ${pesos(propuesta.monto)} | Pagado por: ${propuesta.pagadoPor} | Recibido por: ${propuesta.recibidoPor} | Ingreso repartido entre Caja Eventos y Caja Jazmines | Cobrado desde el asistente con IA · Por ${usuario}`})
        `
        if (propuesta.ipc?.provisorio) {
          await tx`
            INSERT INTO activity_log (tipo, accion, nombre, detalle)
            VALUES ('ipc', 'cobro_provisorio', ${`Cuota ${propuesta.numeroCuota} - ${propuesta.evento}`},
                    ${`Cobrado el ${propuesta.calculadoEl} por ${pesos(propuesta.monto)} con IPC provisorio (${propuesta.ipc.porcentaje.toLocaleString("es-AR")}%) | Período del cobro: ${propuesta.ipc.periodo} | Desde el asistente con IA`})
          `
        }
      }
      const nuevosAdjuntos = adjuntosConPropuesta(adjuntos, { cobro: resuelto })
      await tx`UPDATE chat_ia_mensajes SET acciones = ${nuevosAdjuntos}::jsonb WHERE id = ${mensajeId}`
      return resuelto
    })
    return Response.json({ cobro })
  } catch (error) {
    if (error instanceof Problema) return Response.json({ error: error.message }, { status: error.status })
    console.error("[chat-ia] No se pudo resolver el cobro:", error)
    return Response.json({ error: "No se pudo marcar el cobro. Probá de nuevo." }, { status: 500 })
  }
}

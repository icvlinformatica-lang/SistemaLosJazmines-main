// Confirmar o cancelar el gasto que propuso el chat con IA. SOLO
// Administración y Soporte, y solo en su propio chat.
// POST { mensajeId, accion: "confirmar" | "cancelar" }
//
// La IA nunca carga nada: arma la propuesta y queda guardada en el mensaje
// (chat_ia_mensajes.acciones). Esta ruta la lee de ahí (no de lo que manda el
// navegador), y al confirmar la agenda como gasto variable en
// costos_operativos, igual que "Cargar gastos" de Inicio en modo alta: sin
// pagar y sin movimiento de caja. Todo en una transacción con FOR UPDATE; el
// id del gasto es el de la propuesta, así que confirmar dos veces no lo duplica.
import { verifyToken, SESSION_COOKIE, SESSION_HEADER } from "@/lib/auth/server"
import { PERFILES_CHAT_IA, adjuntosConPropuesta, leerAdjuntos, usuarioChat } from "@/lib/chat-ia-historial"
import type { PropuestaGastoChat } from "@/lib/chat-ia-gasto"
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

const pesos = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`

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
    const gasto = await sql.begin(async (trx) => {
      const tx = trx as unknown as typeof sql
      // Solo el chat de quien confirma: Soporte mirando el chat de otro no puede.
      const filas = (await tx`
        SELECT acciones FROM chat_ia_mensajes
        WHERE id = ${mensajeId} AND usuario = ${usuario} AND rol = 'assistant'
        FOR UPDATE
      `) as unknown as { acciones: unknown }[]
      if (filas.length === 0) throw new Problema("No encontré ese mensaje en tu chat.", 404)
      const adjuntos = leerAdjuntos(filas[0].acciones)
      const propuesta = adjuntos.gasto
      if (!propuesta) throw new Problema("Ese mensaje no tiene un gasto para cargar.", 404)
      // Ya resuelto (por ejemplo, un doble toque): se devuelve como quedó.
      if (propuesta.estado !== "pendiente") return propuesta

      const resuelto: PropuestaGastoChat = {
        ...propuesta,
        estado: accion === "confirmar" ? "cargado" : "cancelado",
        resueltoPor: usuario,
        resueltoEn: new Date().toISOString(),
      }
      if (accion === "confirmar") {
        // Mismos datos que addCostoOperativo desde "Cargar gastos" (gasto variable, carpeta "varios").
        await tx`
          INSERT INTO costos_operativos
            (id, concepto, monto, frecuencia, activo, categoria, salon, fecha_vencimiento,
             es_variable, es_servicio, pagado, cargado_por, created_at, updated_at)
          VALUES
            (${propuesta.id}, ${propuesta.concepto}, ${propuesta.monto}, 'Por Evento', true, 'varios', ${propuesta.salon},
             ${propuesta.vencimiento}, true, false, false, ${usuario}, now(), now())
          ON CONFLICT (id) DO NOTHING
        `
        const salonVisible = propuesta.salon === "Salon" ? "Salón" : propuesta.salon
        await tx`
          INSERT INTO activity_log (tipo, accion, nombre, detalle)
          VALUES ('caja', 'creado', ${`Gasto variable · ${pesos(propuesta.monto)} (${salonVisible})`},
                  ${`${propuesta.concepto} · Vence ${propuesta.vencimiento} · Cargado desde el asistente con IA · Por ${usuario}`})
        `
      }
      const nuevosAdjuntos = adjuntosConPropuesta(adjuntos, { gasto: resuelto })
      await tx`UPDATE chat_ia_mensajes SET acciones = ${nuevosAdjuntos}::jsonb WHERE id = ${mensajeId}`
      return resuelto
    })
    return Response.json({ gasto })
  } catch (error) {
    if (error instanceof Problema) return Response.json({ error: error.message }, { status: error.status })
    console.error("[chat-ia] No se pudo resolver el gasto:", error)
    return Response.json({ error: "No se pudo cargar el gasto. Probá de nuevo." }, { status: 500 })
  }
}

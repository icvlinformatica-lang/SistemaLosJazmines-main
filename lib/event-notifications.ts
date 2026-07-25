// Notificaciones por email cuando se crean, modifican o eliminan eventos.
// Usa la API REST de Resend (https://resend.com) — requiere RESEND_API_KEY y NOTIFICATION_EMAIL.

type EventAction = "creado" | "modificado" | "eliminado"

interface EventInfo {
  nombre?: string | null
  fecha?: string | null
  horario?: string | null
  salon?: string | null
  tipoEvento?: string | null
  estado?: string | null
  adultos?: number
  adolescentes?: number
  ninos?: number
}

const ACTION_LABELS: Record<EventAction, { subject: string; color: string }> = {
  creado: { subject: "Nuevo evento cargado", color: "#16a34a" },
  modificado: { subject: "Evento modificado", color: "#d97706" },
  eliminado: { subject: "Evento eliminado", color: "#dc2626" },
}

function formatFecha(fecha?: string | null): string {
  if (!fecha) return "Sin fecha"
  try {
    const d = new Date(fecha + (fecha.length === 10 ? "T00:00:00" : ""))
    return d.toLocaleDateString("es-AR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch {
    return fecha
  }
}

function buildHtml(action: EventAction, ev: EventInfo): string {
  const { subject, color } = ACTION_LABELS[action]
  const totalInvitados = (ev.adultos || 0) + (ev.adolescentes || 0) + (ev.ninos || 0)

  const rows: Array<[string, string]> = [
    ["Evento", ev.nombre || "Sin nombre"],
    ["Fecha", formatFecha(ev.fecha)],
    ["Horario", ev.horario || "Sin horario"],
    ["Salon", ev.salon || "Sin salon"],
    ["Tipo", ev.tipoEvento || "Sin tipo"],
    ["Estado", ev.estado || "pendiente"],
    ["Invitados", totalInvitados > 0 ? String(totalInvitados) : "Sin datos"],
  ]

  const tableRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;color:#6b7280;font-size:14px;border-bottom:1px solid #e5e7eb;">${label}</td>
          <td style="padding:8px 12px;color:#111827;font-size:14px;font-weight:600;border-bottom:1px solid #e5e7eb;">${value}</td>
        </tr>`
    )
    .join("")

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <div style="background:${color};color:#ffffff;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:18px;">${subject}</h2>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Sistema Los Jazmines</p>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        ${tableRows}
      </table>
      <p style="color:#9ca3af;font-size:12px;margin-top:16px;">
        Notificacion automatica generada el ${new Date().toLocaleString("es-AR")}.
      </p>
    </div>`
}

/**
 * Envia una notificacion por email. No lanza errores: si falla, solo lo registra
 * en consola para no interrumpir la operacion principal del sistema.
 */
export async function sendEventNotification(action: EventAction, ev: EventInfo): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  // Acepta uno o varios emails separados por coma, normalizados a minusculas.
  const to = (process.env.NOTIFICATION_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (!apiKey || to.length === 0) {
    console.warn("[Notificaciones] RESEND_API_KEY o NOTIFICATION_EMAIL no configurados, se omite el envio")
    return
  }

  const { subject } = ACTION_LABELS[action]

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sistema Los Jazmines <onboarding@resend.dev>",
        to,
        subject: `${subject}: ${ev.nombre || "Sin nombre"} (${formatFecha(ev.fecha)})`,
        html: buildHtml(action, ev),
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error("[Notificaciones] Error enviando email:", res.status, errBody)
    }
  } catch (err) {
    console.error("[Notificaciones] Fallo al enviar email:", err)
  }
}

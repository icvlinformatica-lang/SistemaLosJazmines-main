import { NextResponse } from "next/server"

// Envía por email (Resend) el comprobante de un pago/cuota cobrada.
// Va dirigido a los emails internos configurados en NOTIFICATION_EMAIL.

interface ComprobantePago {
  evento: string
  concepto: string
  pagadoPor: string
  fecha: string
  monto: string
  restante: string | null
  recibidoPor: string
}

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function buildHtml(c: ComprobantePago): string {
  const rows: Array<[string, string]> = [
    ["Evento", c.evento],
    ["Concepto", c.concepto],
    ["Pagado por", c.pagadoPor],
    ["Fecha del pago", c.fecha],
    ["Monto abonado", c.monto],
    ...(c.restante !== null ? ([["Saldo restante", c.restante]] as Array<[string, string]>) : []),
    ["Recibido por", c.recibidoPor],
  ]

  const tableRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;color:#6b7280;font-size:14px;border-bottom:1px solid #e5e7eb;">${esc(label)}</td>
          <td style="padding:8px 12px;color:#111827;font-size:14px;font-weight:600;border-bottom:1px solid #e5e7eb;">${esc(value)}</td>
        </tr>`,
    )
    .join("")

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <div style="background:#16a34a;color:#ffffff;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:18px;">Pago registrado</h2>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Sistema Los Jazmines</p>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        ${tableRows}
      </table>
      <p style="color:#9ca3af;font-size:12px;margin-top:16px;">
        Comprobante automatico generado el ${new Date().toLocaleString("es-AR")}.
      </p>
    </div>`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { evento, concepto, pagadoPor, fecha, monto, restante, recibidoPor } = body

    if (!evento || !pagadoPor || !monto || !recibidoPor) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    const to = (process.env.NOTIFICATION_EMAIL || "")
      .split(",")
      .map((e: string) => e.trim().toLowerCase())
      .filter(Boolean)

    if (!apiKey || to.length === 0) {
      return NextResponse.json({ error: "Emails no configurados" }, { status: 503 })
    }

    const comprobante: ComprobantePago = {
      evento: String(evento),
      concepto: String(concepto || "Pago"),
      pagadoPor: String(pagadoPor),
      fecha: String(fecha || new Date().toLocaleDateString("es-AR")),
      monto: String(monto),
      restante: restante ? String(restante) : null,
      recibidoPor: String(recibidoPor),
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sistema Los Jazmines <onboarding@resend.dev>",
        to,
        subject: `Pago registrado: ${comprobante.evento} - ${comprobante.monto} (${comprobante.concepto})`,
        html: buildHtml(comprobante),
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error("[Comprobante] Error enviando email:", res.status, errBody)
      return NextResponse.json({ error: "Error al enviar el email" }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error al procesar el comprobante" }, { status: 500 })
  }
}

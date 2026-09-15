// Resumen semanal del sistema: se manda por mail los viernes a las 21:00
// (hora argentina), junto con el resumen diario de ese mismo día.
// Cubre la semana de trabajo lunes a viernes (no incluye el fin de
// semana, que todavía no pasó al momento de mandarlo). Muestra, PARA CADA
// SALÓN POR SEPARADO (nunca la suma de todos juntos): cuánto entró y
// salió de Caja Eventos y de Caja Jazmines, los movimientos más
// importantes de la semana, y quiénes vienen a pagar la semana que
// arranca el lunes siguiente. Corre SOLO en el servidor.

import { sql } from "@/lib/db"
import { hoyArgentina, buildVienenAPagar, type MovimientoResumen, type VieneAPagar } from "@/lib/resumen-diario"

// Mismos 5 salones que lib/store.ts (SALONES). Se repite acá en vez de
// importar ese módulo (tiene "use client") para no arrastrarlo a este
// código de servidor.
const SALONES = ["Quinta", "Casona", "Salon", "Salon 4", "Salon 5"] as const

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR")
}

function diaDe(fecha: unknown): string {
  if (!fecha) return ""
  const s = String(fecha)
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    return new Date(s).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
  } catch {
    return s.slice(0, 10)
  }
}

function cajaDe(m: Record<string, unknown>): string {
  const destino = m.caja_destino as string | null
  if (destino === "caja_eventos") return "Caja Eventos"
  if (destino === "caja_jazmines") return "Caja Jazmines"
  return m.salon === "admin" ? "Caja Jazmines" : "Caja Eventos"
}

function salonLegible(salon: unknown): string {
  const s = String(salon || "").trim()
  if (!s) return "Sin salón"
  if (s === "admin") return "Administración"
  if (s === "Salon" || s.toLowerCase() === "salon") return "Salón"
  return s
}

function fechaLegibleCorta(fecha: string): string {
  try {
    return new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long" })
  } catch {
    return fecha
  }
}

/** Lunes (YYYY-MM-DD) de la semana que contiene `fecha`. */
function lunesDeLaSemana(fecha: string): string {
  const d = new Date(fecha + "T12:00:00")
  const diaSemana = (d.getDay() + 6) % 7 // 0 = lunes
  const lunes = new Date(d)
  lunes.setDate(d.getDate() - diaSemana)
  return lunes.toLocaleDateString("en-CA")
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + "T12:00:00")
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString("en-CA")
}

export interface CajaSalonResumen {
  salon: string
  ingresoCajaEventos: number
  egresoCajaEventos: number
  ingresoCajaJazmines: number
  egresoCajaJazmines: number
  /** Saldo acumulado histórico (todos los ingresos menos todos los egresos), no solo de esta semana. */
  saldoCajaEventos: number
  saldoCajaJazmines: number
}

export interface ResumenSemanal {
  inicio: string // lunes YYYY-MM-DD
  fin: string // viernes YYYY-MM-DD
  rangoLegible: string
  porSalon: CajaSalonResumen[]
  movimientosImportantes: MovimientoResumen[]
  cantidadMovimientos: number
  proximaSemanaInicio: string
  vienenAPagar: VieneAPagar[]
}

export async function buildResumenSemanal(hoy = hoyArgentina()): Promise<ResumenSemanal> {
  const inicio = lunesDeLaSemana(hoy)
  const fin = sumarDias(inicio, 4) // viernes

  const movRows = (await sql`
    SELECT tipo, concepto, monto, salon, caja_destino, fecha
    FROM movimientos_caja
    WHERE LEFT(fecha, 10) BETWEEN ${sumarDias(inicio, -1)} AND ${sumarDias(fin, 1)}
    ORDER BY created_at DESC
  `) as unknown as Record<string, unknown>[]

  const movsSemana = movRows.filter((m) => {
    const d = diaDe(m.fecha)
    return d >= inicio && d <= fin
  })

  // Los 5 salones siempre aparecen, tengan o no movimientos esta semana.
  const porSalonMap = new Map<string, CajaSalonResumen>()
  for (const salon of SALONES) {
    porSalonMap.set(salon, {
      salon, ingresoCajaEventos: 0, egresoCajaEventos: 0, ingresoCajaJazmines: 0, egresoCajaJazmines: 0,
      saldoCajaEventos: 0, saldoCajaJazmines: 0,
    })
  }
  for (const m of movsSemana) {
    const salonRaw = String(m.salon || "").trim()
    const entry = porSalonMap.get(salonRaw)
    if (!entry) continue // "admin" y sin salón no se reparten entre los 5 salones
    const monto = Number(m.monto) || 0
    const caja = cajaDe(m)
    if (m.tipo === "ingreso") {
      if (caja === "Caja Jazmines") entry.ingresoCajaJazmines += monto
      else entry.ingresoCajaEventos += monto
    } else if (m.tipo === "egreso") {
      if (caja === "Caja Jazmines") entry.egresoCajaJazmines += monto
      else entry.egresoCajaEventos += monto
    }
  }

  // Saldo acumulado (histórico, no solo de la semana): se agrega en la base
  // para no traer todos los movimientos de siempre a memoria.
  const saldoRows = (await sql`
    SELECT salon, caja_destino, tipo, SUM(monto)::float AS total
    FROM movimientos_caja
    WHERE salon = ANY(${SALONES as unknown as string[]})
    GROUP BY salon, caja_destino, tipo
  `) as unknown as Record<string, unknown>[]
  for (const r of saldoRows) {
    const salonRaw = String(r.salon || "").trim()
    const entry = porSalonMap.get(salonRaw)
    if (!entry) continue
    const monto = Number(r.total) || 0
    const caja = cajaDe(r)
    const signo = r.tipo === "egreso" ? -1 : r.tipo === "ingreso" ? 1 : 0
    if (caja === "Caja Jazmines") entry.saldoCajaJazmines += signo * monto
    else entry.saldoCajaEventos += signo * monto
  }

  const porSalon = SALONES.map((salon) => porSalonMap.get(salon)!)

  const movimientosImportantes: MovimientoResumen[] = [...movsSemana]
    .sort((a, b) => (Number(b.monto) || 0) - (Number(a.monto) || 0))
    .slice(0, 15)
    .map((m) => ({
      tipo: String(m.tipo || ""),
      concepto: String(m.concepto || "Sin concepto"),
      monto: Number(m.monto) || 0,
      caja: cajaDe(m),
      salon: salonLegible(m.salon),
    }))

  const proximaSemanaInicio = sumarDias(inicio, 7)
  const { vienenAPagar } = await buildVienenAPagar(proximaSemanaInicio)

  return {
    inicio,
    fin,
    rangoLegible: `${fechaLegibleCorta(inicio)} al ${fechaLegibleCorta(fin)}`,
    porSalon,
    movimientosImportantes,
    cantidadMovimientos: movsSemana.length,
    proximaSemanaInicio,
    vienenAPagar,
  }
}

function buildEmailHtml(r: ResumenSemanal): string {
  const seccion = (titulo: string, contenido: string) => `
    <h3 style="margin:20px 0 8px;font-size:14px;color:#111827;">${titulo}</h3>
    <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
      ${contenido}
    </table>`

  // Una sola tabla con los 5 salones (Caja Eventos + Caja Jazmines cada
  // uno), con una fila vacía de separación entre salones. Los montos de un
  // salón NUNCA se suman con los de otro.
  const filaSalon = (s: CajaSalonResumen) => `
        <tr>
          <td style="padding:6px 12px;color:#111827;font-size:13px;font-weight:700;border-bottom:1px solid #f3f4f6;">${salonLegible(s.salon)}</td>
          <td style="padding:6px 12px;color:#374151;font-size:13px;border-bottom:1px solid #f3f4f6;">Caja Eventos</td>
          <td style="padding:6px 12px;color:#16a34a;font-size:13px;font-weight:700;border-bottom:1px solid #f3f4f6;text-align:right;">+ ${fmt(s.ingresoCajaEventos)}</td>
          <td style="padding:6px 12px;color:#dc2626;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;text-align:right;">- ${fmt(s.egresoCajaEventos)}</td>
          <td style="padding:6px 12px;color:#111827;font-size:13px;font-weight:700;border-bottom:1px solid #f3f4f6;text-align:right;">${fmt(s.saldoCajaEventos)}</td>
        </tr>
        <tr>
          <td style="padding:6px 12px;color:#111827;font-size:13px;font-weight:700;border-bottom:1px solid #f3f4f6;">${salonLegible(s.salon)}</td>
          <td style="padding:6px 12px;color:#374151;font-size:13px;border-bottom:1px solid #f3f4f6;">Caja Jazmines</td>
          <td style="padding:6px 12px;color:#16a34a;font-size:13px;font-weight:700;border-bottom:1px solid #f3f4f6;text-align:right;">+ ${fmt(s.ingresoCajaJazmines)}</td>
          <td style="padding:6px 12px;color:#dc2626;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;text-align:right;">- ${fmt(s.egresoCajaJazmines)}</td>
          <td style="padding:6px 12px;color:#111827;font-size:13px;font-weight:700;border-bottom:1px solid #f3f4f6;text-align:right;">${fmt(s.saldoCajaJazmines)}</td>
        </tr>
        <tr><td colspan="5" style="padding:6px 0;">&nbsp;</td></tr>`

  const salonesHtml = `
    <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
      <tr>
        <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:left;border-bottom:1px solid #e5e7eb;">Salón</th>
        <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:left;border-bottom:1px solid #e5e7eb;">Caja</th>
        <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Entró esta semana</th>
        <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Salió esta semana</th>
        <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Saldo actual</th>
      </tr>
      ${r.porSalon.map(filaSalon).join("")}
    </table>`

  const movRows = r.movimientosImportantes.length
    ? r.movimientosImportantes
        .map(
          (m) => `
        <tr>
          <td style="padding:6px 12px;color:#374151;font-size:13px;border-bottom:1px solid #f3f4f6;">${m.concepto}</td>
          <td style="padding:6px 12px;color:#6b7280;font-size:12px;border-bottom:1px solid #f3f4f6;">${m.salon}<br/><span style="font-size:11px;color:#9ca3af;">${m.caja}</span></td>
          <td style="padding:6px 12px;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;text-align:right;color:${m.tipo === "ingreso" ? "#16a34a" : "#dc2626"};">${m.tipo === "ingreso" ? "+" : "-"} ${fmt(m.monto)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" style="padding:10px 12px;color:#9ca3af;font-size:13px;">Sin movimientos importantes esta semana.</td></tr>`

  // Vienen a pagar la semana que arranca, agrupado por salón (igual criterio que el diario).
  const cobrarPorSalon = new Map<string, { semana: number; atrasado: number }>()
  for (const v of r.vienenAPagar) {
    const acc = cobrarPorSalon.get(v.salon) || { semana: 0, atrasado: 0 }
    if (v.cuotaSemana) acc.semana += v.cuotaSemana.monto
    acc.atrasado += v.montoAtrasado
    cobrarPorSalon.set(v.salon, acc)
  }
  const cobrarEntries = [...cobrarPorSalon.entries()].sort((a, b) => b[1].semana - a[1].semana)
  const pagarRows = cobrarEntries.length
    ? cobrarEntries
        .map(
          ([salon, v]) => `
        <tr>
          <td style="padding:6px 12px;color:#374151;font-size:13px;border-bottom:1px solid #f3f4f6;">${salon}</td>
          <td style="padding:6px 12px;color:#111827;font-size:13px;font-weight:700;border-bottom:1px solid #f3f4f6;text-align:right;">${v.semana > 0 ? fmt(v.semana) : "-"}</td>
          <td style="padding:6px 12px;color:#dc2626;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;text-align:right;">${v.atrasado > 0 ? fmt(v.atrasado) : "-"}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" style="padding:10px 12px;color:#9ca3af;font-size:13px;">No hay cuotas por cobrar la semana que viene.</td></tr>`

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:#2d5a3d;color:#ffffff;padding:16px 20px;border-radius:8px;">
        <h2 style="margin:0;font-size:18px;">Resumen semanal</h2>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Sistema Los Jazmines — ${r.rangoLegible}</p>
      </div>
      <h3 style="margin:20px 0 8px;font-size:14px;color:#111827;">Caja por salón</h3>
      ${salonesHtml}
      ${seccion(
        "Movimientos importantes de la semana",
        `<tr>
          <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:left;border-bottom:1px solid #e5e7eb;">Concepto</th>
          <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:left;border-bottom:1px solid #e5e7eb;">Salón / Caja</th>
          <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Monto</th>
        </tr>` + movRows,
      )}
      ${seccion(
        "Vienen a pagar la semana que arranca",
        `<tr>
          <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:left;border-bottom:1px solid #e5e7eb;">Salón</th>
          <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Vence esa semana</th>
          <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Atrasado</th>
        </tr>` + pagarRows,
      )}
      <p style="color:#9ca3af;font-size:12px;margin-top:16px;">
        Resumen automático generado los viernes a las 21:00 (hora argentina). ${r.cantidadMovimientos} movimiento${r.cantidadMovimientos === 1 ? "" : "s"} en la semana.
      </p>
    </div>`
}

/** Envía el mail del resumen semanal. Devuelve true si se envió bien. */
export async function sendResumenSemanalEmail(resumen?: ResumenSemanal): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const to = (process.env.NOTIFICATION_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (!apiKey || to.length === 0) {
    console.warn("[ResumenSemanal] RESEND_API_KEY o NOTIFICATION_EMAIL no configurados, se omite el envío")
    return false
  }

  const r = resumen ?? (await buildResumenSemanal())

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
        subject: `Resumen semanal — ${r.rangoLegible}`,
        html: buildEmailHtml(r),
      }),
    })
    if (!res.ok) {
      console.error("[ResumenSemanal] Error enviando email:", res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error("[ResumenSemanal] Fallo al enviar email:", err)
    return false
  }
}

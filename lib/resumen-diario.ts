// Resumen diario del sistema: dinero que ingresó a cada caja, movimientos
// importantes y desglose de cada cuota cobrada en el día.
// Se usa en dos lugares: la sección "Resumen diario" de Inicio (vía
// /api/resumen-diario) y el mail automático de las 21:00 (vía el cron
// /api/cron/resumen-diario). Corre SOLO en el servidor.

import { sql } from "@/lib/db"

const TZ = "America/Argentina/Buenos_Aires"

export interface MovimientoResumen {
  tipo: string
  concepto: string
  monto: number
  caja: string
  salon: string
}

export interface CuotaResumen {
  evento: string
  monto: number
  pagadoPor: string
  notas: string
}

export interface ResumenDiario {
  fecha: string // YYYY-MM-DD (día en Argentina)
  fechaLegible: string
  ingresoCajaJazmines: number
  ingresoCajaEventos: number
  egresoCajaJazmines: number
  egresoCajaEventos: number
  movimientosImportantes: MovimientoResumen[]
  cuotasDelDia: CuotaResumen[]
  totalCuotas: number
  cantidadMovimientos: number
}

/** Día de hoy (YYYY-MM-DD) en horario argentino. */
export function hoyArgentina(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ })
}

function fechaLegible(fecha: string): string {
  try {
    return new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return fecha
  }
}

/** Convierte la fecha de un movimiento/pago a día YYYY-MM-DD en Argentina. */
function diaDe(fecha: unknown): string {
  if (!fecha) return ""
  const s = String(fecha)
  try {
    // Fecha simple sin hora: se toma tal cual
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    return new Date(s).toLocaleDateString("en-CA", { timeZone: TZ })
  } catch {
    return s.slice(0, 10)
  }
}

function cajaDe(m: Record<string, unknown>): string {
  const destino = m.caja_destino as string | null
  if (destino === "caja_eventos") return "Caja Eventos"
  if (destino === "caja_jazmines") return "Caja Jazmines"
  // Movimientos históricos sin caja_destino: inferir por salón
  return m.salon === "admin" ? "Caja Jazmines" : "Caja Eventos"
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

export async function buildResumenDiario(): Promise<ResumenDiario> {
  const hoy = hoyArgentina()

  // Movimientos recientes (últimas 48 hs) y se filtran por día argentino en JS
  // para no depender del tipo de la columna fecha.
  const movRows = (await sql`
    SELECT tipo, concepto, monto, salon, caja_destino, fecha
    FROM movimientos_caja
    WHERE created_at >= NOW() - INTERVAL '3 days'
    ORDER BY created_at DESC
    LIMIT 500
  `) as unknown as Record<string, unknown>[]

  const movsHoy = movRows.filter((m) => diaDe(m.fecha) === hoy)

  let ingresoCajaJazmines = 0
  let ingresoCajaEventos = 0
  let egresoCajaJazmines = 0
  let egresoCajaEventos = 0

  for (const m of movsHoy) {
    const monto = Number(m.monto) || 0
    const caja = cajaDe(m)
    if (m.tipo === "ingreso") {
      if (caja === "Caja Jazmines") ingresoCajaJazmines += monto
      else ingresoCajaEventos += monto
    } else if (m.tipo === "egreso") {
      if (caja === "Caja Jazmines") egresoCajaJazmines += monto
      else egresoCajaEventos += monto
    }
  }

  // Movimientos importantes: los de mayor monto del día (hasta 10)
  const movimientosImportantes: MovimientoResumen[] = [...movsHoy]
    .sort((a, b) => (Number(b.monto) || 0) - (Number(a.monto) || 0))
    .slice(0, 10)
    .map((m) => ({
      tipo: String(m.tipo || ""),
      concepto: String(m.concepto || "Sin concepto"),
      monto: Number(m.monto) || 0,
      caja: cajaDe(m),
      salon: String(m.salon || ""),
    }))

  // Cuotas cobradas hoy: pagos dentro de cada evento con fecha de hoy
  const evRows = (await sql`
    SELECT nombre, nombre_pareja, pagos
    FROM eventos
    WHERE pagos IS NOT NULL AND pagos::text <> '[]'
  `) as unknown as Record<string, unknown>[]

  const cuotasDelDia: CuotaResumen[] = []
  for (const ev of evRows) {
    const pagos = parseJson<Array<Record<string, unknown>>>(ev.pagos, [])
    for (const p of pagos) {
      if (diaDe(p.fecha) === hoy) {
        cuotasDelDia.push({
          evento: String(ev.nombre || ev.nombre_pareja || "Sin nombre"),
          monto: Number(p.monto) || 0,
          pagadoPor: String(p.pagadoPor || ""),
          notas: String(p.notas || ""),
        })
      }
    }
  }
  cuotasDelDia.sort((a, b) => b.monto - a.monto)

  return {
    fecha: hoy,
    fechaLegible: fechaLegible(hoy),
    ingresoCajaJazmines,
    ingresoCajaEventos,
    egresoCajaJazmines,
    egresoCajaEventos,
    movimientosImportantes,
    cuotasDelDia,
    totalCuotas: cuotasDelDia.reduce((s, c) => s + c.monto, 0),
    cantidadMovimientos: movsHoy.length,
  }
}

// ==========================================
// EMAIL DE LAS 21:00
// ==========================================

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR")
}

function buildEmailHtml(r: ResumenDiario): string {
  const filaCaja = (nombre: string, ingreso: number, egreso: number) => `
    <tr>
      <td style="padding:8px 12px;color:#374151;font-size:14px;border-bottom:1px solid #e5e7eb;">${nombre}</td>
      <td style="padding:8px 12px;color:#16a34a;font-size:14px;font-weight:700;border-bottom:1px solid #e5e7eb;text-align:right;">+ ${fmt(ingreso)}</td>
      <td style="padding:8px 12px;color:#dc2626;font-size:14px;font-weight:600;border-bottom:1px solid #e5e7eb;text-align:right;">- ${fmt(egreso)}</td>
    </tr>`

  const movRows = r.movimientosImportantes.length
    ? r.movimientosImportantes
        .map(
          (m) => `
        <tr>
          <td style="padding:6px 12px;color:#374151;font-size:13px;border-bottom:1px solid #f3f4f6;">${m.concepto}</td>
          <td style="padding:6px 12px;color:#6b7280;font-size:12px;border-bottom:1px solid #f3f4f6;">${m.caja}</td>
          <td style="padding:6px 12px;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;text-align:right;color:${m.tipo === "ingreso" ? "#16a34a" : "#dc2626"};">${m.tipo === "ingreso" ? "+" : "-"} ${fmt(m.monto)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="3" style="padding:10px 12px;color:#9ca3af;font-size:13px;">Sin movimientos registrados hoy.</td></tr>`

  const cuotaRows = r.cuotasDelDia.length
    ? r.cuotasDelDia
        .map(
          (c) => `
        <tr>
          <td style="padding:6px 12px;color:#374151;font-size:13px;border-bottom:1px solid #f3f4f6;">
            ${c.evento}
            ${c.notas ? `<br/><span style="color:#9ca3af;font-size:11px;">${c.notas}</span>` : ""}
          </td>
          <td style="padding:6px 12px;color:#6b7280;font-size:12px;border-bottom:1px solid #f3f4f6;">${c.pagadoPor || "-"}</td>
          <td style="padding:6px 12px;color:#16a34a;font-size:13px;font-weight:700;border-bottom:1px solid #f3f4f6;text-align:right;">${fmt(c.monto)}</td>
        </tr>`
        )
        .join("") +
      `<tr>
        <td colspan="2" style="padding:8px 12px;color:#111827;font-size:13px;font-weight:700;">Total cuotas del día</td>
        <td style="padding:8px 12px;color:#16a34a;font-size:14px;font-weight:700;text-align:right;">${fmt(r.totalCuotas)}</td>
      </tr>`
    : `<tr><td colspan="3" style="padding:10px 12px;color:#9ca3af;font-size:13px;">No entraron cuotas hoy.</td></tr>`

  const seccion = (titulo: string, contenido: string) => `
    <h3 style="margin:20px 0 8px;font-size:14px;color:#111827;">${titulo}</h3>
    <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
      ${contenido}
    </table>`

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:#2d5a3d;color:#ffffff;padding:16px 20px;border-radius:8px;">
        <h2 style="margin:0;font-size:18px;">Resumen diario</h2>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Sistema Los Jazmines — ${r.fechaLegible}</p>
      </div>
      ${seccion(
        "Dinero por caja",
        `<tr>
          <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:left;border-bottom:1px solid #e5e7eb;">Caja</th>
          <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Ingresó</th>
          <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Salió</th>
        </tr>` +
          filaCaja("Caja Jazmines", r.ingresoCajaJazmines, r.egresoCajaJazmines) +
          filaCaja("Caja Eventos", r.ingresoCajaEventos, r.egresoCajaEventos)
      )}
      ${seccion("Movimientos importantes del día", movRows)}
      ${seccion("Cuotas que entraron hoy", cuotaRows)}
      <p style="color:#9ca3af;font-size:12px;margin-top:16px;">
        Resumen automático generado a las 21:00 (hora argentina). ${r.cantidadMovimientos} movimiento${r.cantidadMovimientos === 1 ? "" : "s"} en el día.
      </p>
    </div>`
}

/** Envía el mail del resumen diario. Devuelve true si se envió bien. */
export async function sendResumenDiarioEmail(resumen?: ResumenDiario): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const to = (process.env.NOTIFICATION_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (!apiKey || to.length === 0) {
    console.warn("[ResumenDiario] RESEND_API_KEY o NOTIFICATION_EMAIL no configurados, se omite el envío")
    return false
  }

  const r = resumen ?? (await buildResumenDiario())

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
        subject: `Resumen diario — ${r.fechaLegible}`,
        html: buildEmailHtml(r),
      }),
    })
    if (!res.ok) {
      console.error("[ResumenDiario] Error enviando email:", res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error("[ResumenDiario] Fallo al enviar email:", err)
    return false
  }
}

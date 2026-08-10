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
  salon: string
  monto: number
  pagadoPor: string
  notas: string
}

export interface IngresoSalonResumen {
  salon: string
  total: number
}

/** Evento que tiene cuota por pagar esta semana (o cuotas atrasadas). */
export interface VieneAPagar {
  evento: string
  salon: string
  fechaEvento: string // YYYY-MM-DD
  /** Próxima cuota que vence esta semana (si hay) */
  cuotaSemana: { numero: number; fechaVencimiento: string; monto: number } | null
  /** Deuda de cuotas vencidas sin pagar (semana pasada o antes) */
  montoAtrasado: number
  cuotasAtrasadas: number
}

export interface ResumenDiario {
  fecha: string // YYYY-MM-DD (día en Argentina)
  fechaLegible: string
  ingresoCajaJazmines: number
  ingresoCajaEventos: number
  egresoCajaJazmines: number
  egresoCajaEventos: number
  /** Total que ingresó hoy a cada salón */
  ingresosPorSalon: IngresoSalonResumen[]
  movimientosImportantes: MovimientoResumen[]
  cuotasDelDia: CuotaResumen[]
  totalCuotas: number
  cantidadMovimientos: number
  /** Quiénes deben venir a pagar esta semana (incluye atrasados) */
  vienenAPagar: VieneAPagar[]
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

/** Nombre legible del salón para mostrar en resumen y mail. */
function salonLegible(salon: unknown): string {
  const s = String(salon || "").trim()
  if (!s) return "Sin salón"
  if (s === "admin") return "Administración"
  if (s === "Salon" || s.toLowerCase() === "salon") return "Salón"
  return s
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

  // Total que ingresó hoy a cada salón
  const porSalon = new Map<string, number>()
  for (const m of movsHoy) {
    if (m.tipo !== "ingreso") continue
    const s = salonLegible(m.salon)
    porSalon.set(s, (porSalon.get(s) || 0) + (Number(m.monto) || 0))
  }
  const ingresosPorSalon: IngresoSalonResumen[] = [...porSalon.entries()]
    .map(([salon, total]) => ({ salon, total }))
    .sort((a, b) => b.total - a.total)

  // Movimientos importantes: los de mayor monto del día (hasta 10)
  const movimientosImportantes: MovimientoResumen[] = [...movsHoy]
    .sort((a, b) => (Number(b.monto) || 0) - (Number(a.monto) || 0))
    .slice(0, 10)
    .map((m) => ({
      tipo: String(m.tipo || ""),
      concepto: String(m.concepto || "Sin concepto"),
      monto: Number(m.monto) || 0,
      caja: cajaDe(m),
      salon: salonLegible(m.salon),
    }))

  // Cuotas cobradas hoy + plan de cuotas para saber quién viene a pagar
  const evRows = (await sql`
    SELECT nombre, nombre_pareja, salon, fecha, estado, pagos, plan_de_cuotas
    FROM eventos
    WHERE deleted_at IS NULL
  `) as unknown as Record<string, unknown>[]

  const cuotasDelDia: CuotaResumen[] = []
  for (const ev of evRows) {
    const pagos = parseJson<Array<Record<string, unknown>>>(ev.pagos, [])
    for (const p of pagos) {
      if (diaDe(p.fecha) === hoy) {
        cuotasDelDia.push({
          evento: String(ev.nombre || ev.nombre_pareja || "Sin nombre"),
          salon: salonLegible(ev.salon),
          monto: Number(p.monto) || 0,
          pagadoPor: String(p.pagadoPor || ""),
          notas: String(p.notas || ""),
        })
      }
    }
  }
  cuotasDelDia.sort((a, b) => b.monto - a.monto)

  // ------------------------------------------
  // VIENEN A PAGAR ESTA SEMANA (+ atrasados)
  // ------------------------------------------
  // Semana actual: de lunes a domingo (hora argentina). Una cuota sin pagar
  // que vence dentro de la semana => "viene a pagar". Cuotas sin pagar que
  // vencieron ANTES del lunes => deuda atrasada (se suma el monto).
  const hoyDate = new Date(hoy + "T12:00:00")
  const diaSemana = (hoyDate.getDay() + 6) % 7 // 0 = lunes
  const lunes = new Date(hoyDate)
  lunes.setDate(hoyDate.getDate() - diaSemana)
  const domingo = new Date(lunes)
  domingo.setDate(lunes.getDate() + 6)
  const toYmd = (d: Date) => d.toLocaleDateString("en-CA")
  const inicioSemana = toYmd(lunes)
  const finSemana = toYmd(domingo)

  const vienenAPagar: VieneAPagar[] = []
  for (const ev of evRows) {
    // Solo eventos activos (no archivados ni cancelados)
    const estado = String(ev.estado || "")
    if (estado === "completado" || estado === "cancelado") continue

    const plan = parseJson<Record<string, unknown> | null>(ev.plan_de_cuotas, null)
    if (!plan || !Number(plan.numeroCuotas)) continue

    const numeroCuotas = Number(plan.numeroCuotas) || 0
    const montoCuotaBase = Number(plan.montoCuota) || (Number(plan.montoTotal) || 0) / (numeroCuotas || 1)
    const cuotasPagadas = parseJson<number[]>(plan.cuotasPagadas, [])
    const detalle = parseJson<Array<Record<string, unknown>>>(plan.cuotas, [])
    const fechaInicioPlan = String(plan.fechaInicioPlan || "")
    const diaVencimiento = Number(plan.diaVencimiento) || 10

    // Fecha y monto por cuota: el detalle guardado en el contrato es la
    // fuente de verdad; si falta, se calcula desde fechaInicioPlan.
    const fechaDeCuota = (n: number): string => {
      const d = detalle.find((c) => Number(c.numero) === n)
      const guardada = String(d?.fechaVencimiento || "")
      if (/^\d{4}-\d{2}-\d{2}$/.test(guardada)) return guardada
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicioPlan)) return ""
      const [y, mo] = fechaInicioPlan.split("-").map(Number)
      const mesTotal = mo - 1 + (n - 1)
      const año = y + Math.floor(mesTotal / 12)
      const mes = mesTotal % 12
      const ultimoDia = new Date(año, mes + 1, 0).getDate()
      return `${año}-${String(mes + 1).padStart(2, "0")}-${String(Math.min(diaVencimiento, ultimoDia)).padStart(2, "0")}`
    }
    const montoDeCuota = (n: number): number => {
      const d = detalle.find((c) => Number(c.numero) === n)
      const m = Number(d?.montoCuota)
      return m > 0 ? m : montoCuotaBase
    }

    let cuotaSemana: VieneAPagar["cuotaSemana"] = null
    let montoAtrasado = 0
    let cuotasAtrasadas = 0

    for (let n = 1; n <= numeroCuotas; n++) {
      if (cuotasPagadas.includes(n)) continue
      const venc = fechaDeCuota(n)
      if (!venc) continue
      if (venc < inicioSemana) {
        // Vencida antes de esta semana y sin pagar => atrasada
        montoAtrasado += montoDeCuota(n)
        cuotasAtrasadas++
      } else if (venc >= inicioSemana && venc <= finSemana && !cuotaSemana) {
        cuotaSemana = { numero: n, fechaVencimiento: venc, monto: montoDeCuota(n) }
      }
    }

    if (cuotaSemana || montoAtrasado > 0) {
      vienenAPagar.push({
        evento: String(ev.nombre || ev.nombre_pareja || "Sin nombre"),
        salon: salonLegible(ev.salon),
        fechaEvento: diaDe(ev.fecha),
        cuotaSemana,
        montoAtrasado,
        cuotasAtrasadas,
      })
    }
  }
  // Primero los que tienen cuota esta semana (por fecha de vencimiento), después los solo-atrasados
  vienenAPagar.sort((a, b) => {
    if (a.cuotaSemana && b.cuotaSemana) return a.cuotaSemana.fechaVencimiento.localeCompare(b.cuotaSemana.fechaVencimiento)
    if (a.cuotaSemana) return -1
    if (b.cuotaSemana) return 1
    return b.montoAtrasado - a.montoAtrasado
  })

  return {
    fecha: hoy,
    fechaLegible: fechaLegible(hoy),
    ingresoCajaJazmines,
    ingresoCajaEventos,
    egresoCajaJazmines,
    egresoCajaEventos,
    ingresosPorSalon,
    movimientosImportantes,
    cuotasDelDia,
    totalCuotas: cuotasDelDia.reduce((s, c) => s + c.monto, 0),
    cantidadMovimientos: movsHoy.length,
    vienenAPagar,
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

  const salonRows = r.ingresosPorSalon.length
    ? r.ingresosPorSalon
        .map(
          (s) => `
        <tr>
          <td style="padding:6px 12px;color:#374151;font-size:13px;border-bottom:1px solid #f3f4f6;">${s.salon}</td>
          <td style="padding:6px 12px;color:#16a34a;font-size:13px;font-weight:700;border-bottom:1px solid #f3f4f6;text-align:right;">+ ${fmt(s.total)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="2" style="padding:10px 12px;color:#9ca3af;font-size:13px;">Sin ingresos registrados hoy.</td></tr>`

  const movRows = r.movimientosImportantes.length
    ? r.movimientosImportantes
        .map(
          (m) => `
        <tr>
          <td style="padding:6px 12px;color:#374151;font-size:13px;border-bottom:1px solid #f3f4f6;">${m.concepto}</td>
          <td style="padding:6px 12px;color:#6b7280;font-size:12px;border-bottom:1px solid #f3f4f6;">${m.salon}<br/><span style="font-size:11px;color:#9ca3af;">${m.caja}</span></td>
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
          <td style="padding:6px 12px;color:#6b7280;font-size:12px;border-bottom:1px solid #f3f4f6;">${c.salon}</td>
          <td style="padding:6px 12px;color:#16a34a;font-size:13px;font-weight:700;border-bottom:1px solid #f3f4f6;text-align:right;">${fmt(c.monto)}</td>
        </tr>`
        )
        .join("") +
      `<tr>
        <td colspan="2" style="padding:8px 12px;color:#111827;font-size:13px;font-weight:700;">Total cuotas del día</td>
        <td style="padding:8px 12px;color:#16a34a;font-size:14px;font-weight:700;text-align:right;">${fmt(r.totalCuotas)}</td>
      </tr>`
    : `<tr><td colspan="3" style="padding:10px 12px;color:#9ca3af;font-size:13px;">No entraron cuotas hoy.</td></tr>`

  const fechaCorta = (ymd: string) => {
    try {
      return new Date(ymd + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })
    } catch {
      return ymd
    }
  }

  const pagarRows = r.vienenAPagar.length
    ? r.vienenAPagar
        .map(
          (v) => `
        <tr>
          <td style="padding:6px 12px;color:#374151;font-size:13px;border-bottom:1px solid #f3f4f6;">
            ${v.evento}
            <br/><span style="color:#9ca3af;font-size:11px;">${v.salon} · evento ${fechaCorta(v.fechaEvento)}</span>
          </td>
          <td style="padding:6px 12px;font-size:12px;border-bottom:1px solid #f3f4f6;">
            ${v.cuotaSemana ? `<span style="color:#374151;">Cuota ${v.cuotaSemana.numero} vence ${fechaCorta(v.cuotaSemana.fechaVencimiento)}</span>` : `<span style="color:#9ca3af;">Sin cuota esta semana</span>`}
            ${v.montoAtrasado > 0 ? `<br/><span style="color:#dc2626;font-weight:700;">ATRASADO: debe ${fmt(v.montoAtrasado)} (${v.cuotasAtrasadas} cuota${v.cuotasAtrasadas === 1 ? "" : "s"})</span>` : ""}
          </td>
          <td style="padding:6px 12px;color:#111827;font-size:13px;font-weight:700;border-bottom:1px solid #f3f4f6;text-align:right;">${v.cuotaSemana ? fmt(v.cuotaSemana.monto) : "-"}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="3" style="padding:10px 12px;color:#9ca3af;font-size:13px;">Nadie tiene cuotas por pagar esta semana.</td></tr>`

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
      ${seccion(
        "Ingresos por salón",
        `<tr>
          <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:left;border-bottom:1px solid #e5e7eb;">Salón</th>
          <th style="padding:8px 12px;color:#6b7280;font-size:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Ingresó hoy</th>
        </tr>` + salonRows
      )}
      ${seccion("Movimientos importantes del día", movRows)}
      ${seccion("Cuotas que entraron hoy", cuotaRows)}
      ${seccion("Vienen a pagar esta semana", pagarRows)}
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

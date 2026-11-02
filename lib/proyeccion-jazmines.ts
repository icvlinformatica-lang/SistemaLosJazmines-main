// "Proyección a 12 meses" de Caja Jazmines y el desglose de cada mes (lo que
// se abre al tocar "A cobrar" o "A pagar"), igual que la de Caja Eventos
// (lib/desglose-proyeccion.ts). Pedido de Rodrigo, 2/11/2026.
//
// Reglas:
// - A cobrar: la parte Jazmines de cada cuota pendiente, en el mes en que
//   vence; las atrasadas, en el mes actual (mesEsperadoCobro, la misma regla
//   de Caja Eventos). Antes una cuota vencida el mes pasado quedaba fuera de
//   los 12 meses y no sumaba en ninguno.
// - Ya ingresó: los cobros reales de cuotas y señas que entraron a Caja
//   Jazmines ese mes (fecha del movimiento).
// - A pagar: gastos fijos mensuales todos los meses, anuales en su mes,
//   sueldos de vendedores y variables agendados sin pagar en su mes (los
//   vencidos, en el mes actual). En el mes actual, de cada gasto fijo cuenta
//   solo lo que falta pagar de ese mes: lo ya pagado salió del saldo actual,
//   del que parte la proyección, y antes se restaba dos veces.
// - Ya pagado: los pagos de gastos fijos y variables que salieron de Caja
//   Jazmines ese mes (movimientos con ref_id "gf:" o "gv:").
// - El total de "Falta" de cada mes es exactamente el número de la tabla.
//
// Solo lectura: no guarda ni modifica nada.

import { mesDeFecha, mesEsperadoCobro } from "./mes-cobro"
import type { MovimientoCaja } from "./store"

export interface MesProyeccionJaz {
  key: string // YYYY-MM
  label: string // "junio de 2026"
  aCobrar: number
  aPagar: number
  balance: number
  /** Saldo acumulado: saldo actual de la caja + balances de los meses hasta este inclusive */
  saldoProyectado: number
  esActual: boolean
}

/** Cuota pendiente: la parte de Caja Jazmines que falta cobrar. */
export interface CuotaJazPendiente {
  id: string
  eventoId: string
  eventoNombre: string
  salon: string
  numeroCuota: number
  totalCuotas: number
  fechaVencimiento: string
  montoJazmines: number
}

/** Gasto fijo mensual o anual, ya prorrateado al salón elegido. */
export interface GastoFijoProyeccion {
  id: string
  concepto: string
  salon?: string | null
  frecuencia: "Mensual" | "Anual"
  /** Monto de un mes futuro (el vigente del gasto). */
  monto: number
  /** Lo que falta pagar en el mes actual (0 si ya está pagado o cubierto). */
  faltaMesActual: number
  /** Solo anuales: fecha de vencimiento cargada (se toma el mes). */
  fechaVencimiento?: string
  /** Mensuales: día del mes en que vence (para mostrar). */
  diaVencimiento?: number
}

export interface SueldoProyeccion {
  id: string
  concepto: string
  monto: number
  diaVencimiento?: number
}

export interface VariableProyeccion {
  id: string
  concepto: string
  salon?: string | null
  monto: number
  fechaVencimiento: string
}

export interface EntradaProyeccionJaz {
  /** Meses de la proyección, el primero es el actual. */
  meses: { key: string; label: string }[]
  saldoActual: number
  cuotas: CuotaJazPendiente[]
  fijos: GastoFijoProyeccion[]
  sueldos: SueldoProyeccion[]
  /** Variables agendados SIN pagar. */
  variables: VariableProyeccion[]
  /** Movimientos ya filtrados por el salón elegido. */
  movimientos: MovimientoCaja[]
  /** Nombre de cada evento por id, para los cobros que ya entraron. */
  nombreEvento: (eventoId: string) => string | undefined
  /** Hoy (YYYY-MM-DD), para marcar vencidos. */
  hoy: string
}

export interface CobroJazPendienteMes {
  id: string
  eventoNombre: string
  salon: string
  numeroCuota: number
  totalCuotas: number
  fechaVencimiento: string
  monto: number
  vencida: boolean
}

export interface CobroJazHechoMes {
  id: string
  eventoNombre: string
  concepto: string
  salon: string
  fecha: string
  monto: number
}

export interface PagoJazPendienteMes {
  id: string
  concepto: string
  tipo: "fijo" | "anual" | "sueldo" | "variable"
  salon?: string | null
  /** YYYY-MM-DD si se sabe. */
  fechaVencimiento?: string
  monto: number
  vencido: boolean
}

export interface PagoJazHechoMes {
  id: string
  concepto: string
  salon: string
  fecha: string
  monto: number
}

export interface DesgloseMesJaz {
  cobrar: { total: number; yaIngreso: number; falta: number; pendientes: CobroJazPendienteMes[]; cobrados: CobroJazHechoMes[] }
  pagar: { total: number; yaPagado: number; falta: number; pendientes: PagoJazPendienteMes[]; pagados: PagoJazHechoMes[] }
}

const dinero = (n: number) => Math.round(n * 100) / 100

/** Día local (YYYY-MM-DD) de la fecha ISO de un movimiento. */
function diaLocal(fechaISO: string): string {
  const d = new Date(fechaISO)
  if (Number.isNaN(d.getTime())) return (fechaISO || "").slice(0, 10)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** "2026-11" + día 10 → "2026-11-10" (con tope en el último día del mes). */
function fechaDelMes(mes: string, dia: number | undefined): string | undefined {
  if (!dia) return undefined
  const [y, m] = mes.split("-").map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  return `${mes}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`
}

/** Concepto del movimiento sin el nombre del evento del final ("Cuota 3 #ab12 - Ana" → "Cuota 3"). */
function conceptoCorto(concepto: string): string {
  return (concepto || "").split(" - ")[0].replace(/\s+#[0-9a-z]+$/i, "").trim()
}

export function armarProyeccionJazmines(e: EntradaProyeccionJaz): {
  proyeccionMensual: MesProyeccionJaz[]
  desglose: Record<string, DesgloseMesJaz>
} {
  const mesActual = e.meses[0]?.key ?? ""
  const desglose: Record<string, DesgloseMesJaz> = {}
  for (const m of e.meses) {
    desglose[m.key] = {
      cobrar: { total: 0, yaIngreso: 0, falta: 0, pendientes: [], cobrados: [] },
      pagar: { total: 0, yaPagado: 0, falta: 0, pendientes: [], pagados: [] },
    }
  }

  // ---------------- A COBRAR: falta ----------------
  for (const c of e.cuotas) {
    if (!c.fechaVencimiento || c.montoJazmines <= 0) continue
    const r = desglose[mesEsperadoCobro(c.fechaVencimiento, mesActual)]
    if (!r) continue
    r.cobrar.pendientes.push({
      id: c.id,
      eventoNombre: c.eventoNombre,
      salon: c.salon,
      numeroCuota: c.numeroCuota,
      totalCuotas: c.totalCuotas,
      fechaVencimiento: c.fechaVencimiento,
      monto: c.montoJazmines,
      vencida: c.fechaVencimiento < e.hoy,
    })
    r.cobrar.falta += c.montoJazmines
  }

  // ---------------- A PAGAR: falta ----------------
  const agregarPago = (mes: string, p: PagoJazPendienteMes) => {
    const r = desglose[mes]
    if (!r || p.monto <= 0) return
    r.pagar.pendientes.push(p)
    r.pagar.falta += p.monto
  }
  for (const g of e.fijos) {
    if (g.frecuencia === "Mensual") {
      for (const m of e.meses) {
        const monto = m.key === mesActual ? g.faltaMesActual : g.monto
        const fecha = fechaDelMes(m.key, g.diaVencimiento)
        agregarPago(m.key, {
          id: `${g.id}-${m.key}`,
          concepto: g.concepto,
          tipo: "fijo",
          salon: g.salon,
          fechaVencimiento: fecha,
          monto,
          vencido: !!fecha && fecha < e.hoy,
        })
      }
    } else {
      const mm = Number((g.fechaVencimiento || "").split("-")[1])
      if (!mm) continue
      for (const m of e.meses) {
        if (Number(m.key.slice(5, 7)) !== mm) continue
        const monto = m.key === mesActual ? g.faltaMesActual : g.monto
        const fecha = fechaDelMes(m.key, Number((g.fechaVencimiento || "").split("-")[2]) || undefined)
        agregarPago(m.key, {
          id: `${g.id}-${m.key}`,
          concepto: g.concepto,
          tipo: "anual",
          salon: g.salon,
          fechaVencimiento: fecha,
          monto,
          vencido: !!fecha && fecha < e.hoy,
        })
      }
    }
  }
  for (const s of e.sueldos) {
    for (const m of e.meses) {
      const fecha = fechaDelMes(m.key, s.diaVencimiento)
      agregarPago(m.key, {
        id: `${s.id}-${m.key}`,
        concepto: s.concepto,
        tipo: "sueldo",
        fechaVencimiento: fecha,
        monto: s.monto,
        vencido: !!fecha && fecha < e.hoy,
      })
    }
  }
  for (const v of e.variables) {
    if (!v.fechaVencimiento) continue
    // Vencido sin pagar: se sigue debiendo, va en el mes actual.
    agregarPago(mesEsperadoCobro(v.fechaVencimiento, mesActual), {
      id: v.id,
      concepto: v.concepto,
      tipo: "variable",
      salon: v.salon,
      fechaVencimiento: v.fechaVencimiento,
      monto: v.monto,
      vencido: v.fechaVencimiento < e.hoy,
    })
  }

  // ---------------- Lo que ya entró y lo que ya se pagó ----------------
  for (const m of e.movimientos) {
    if (m.cajaDestino !== "caja_jazmines") continue
    const fecha = diaLocal(m.fecha)
    const r = desglose[mesDeFecha(fecha)]
    if (!r || !(m.monto > 0)) continue
    if (m.tipo === "ingreso" && m.eventoId && /^(Cuota|Seña)/i.test(m.concepto || "")) {
      r.cobrar.cobrados.push({
        id: m.id,
        eventoNombre: e.nombreEvento(m.eventoId) || (m.concepto || "").split(" - ").slice(1).join(" - ") || "Evento",
        concepto: conceptoCorto(m.concepto),
        salon: m.salon || "",
        fecha,
        monto: m.monto,
      })
      r.cobrar.yaIngreso += m.monto
    } else if (m.tipo === "egreso" && /^(gf|gv):/.test(m.refId || "")) {
      r.pagar.pagados.push({ id: m.id, concepto: m.concepto || "Pago", salon: m.salon || "", fecha, monto: m.monto })
      r.pagar.yaPagado += m.monto
    }
  }

  // ---------------- Totales y tabla ----------------
  const proyeccionMensual: MesProyeccionJaz[] = []
  let saldo = e.saldoActual
  for (const m of e.meses) {
    const { cobrar, pagar } = desglose[m.key]
    cobrar.falta = dinero(cobrar.falta)
    cobrar.yaIngreso = dinero(cobrar.yaIngreso)
    cobrar.total = dinero(cobrar.falta + cobrar.yaIngreso)
    pagar.falta = dinero(pagar.falta)
    pagar.yaPagado = dinero(pagar.yaPagado)
    pagar.total = dinero(pagar.falta + pagar.yaPagado)
    cobrar.pendientes.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
    cobrar.cobrados.sort((a, b) => a.fecha.localeCompare(b.fecha))
    pagar.pendientes.sort((a, b) => (a.fechaVencimiento || "9").localeCompare(b.fechaVencimiento || "9") || a.concepto.localeCompare(b.concepto))
    pagar.pagados.sort((a, b) => a.fecha.localeCompare(b.fecha))

    const balance = cobrar.falta - pagar.falta
    saldo += balance
    proyeccionMensual.push({
      key: m.key,
      label: m.label,
      aCobrar: cobrar.falta,
      aPagar: pagar.falta,
      balance,
      saldoProyectado: saldo,
      esActual: m.key === mesActual,
    })
  }
  return { proyeccionMensual, desglose }
}

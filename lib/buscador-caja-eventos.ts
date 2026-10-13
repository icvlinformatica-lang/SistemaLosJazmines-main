// Buscador, filtro por mes e historial completo de Caja Eventos.
//
// SOLO PANTALLA: estas funciones filtran y ordenan lo que la caja ya tiene
// cargado en memoria (state.movimientosCaja, los egresos pendientes que arma
// lib/hooks/use-caja-eventos.ts y el personal). No calculan montos nuevos,
// no guardan nada y no hacen consultas a la base.

import type { MovimientoCaja, PagoPersonal, PersonalEvento, EventoGuardado } from "./store"
import type { EgresoPendienteServicio, IngresoPendiente, PagoRealizado } from "./hooks/use-caja-eventos"
import { fechaNegocio } from "./ipc-cuotas"

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/** Minúsculas y sin tildes, para que "Peña" encuentre "pena" y "MENÚ" a "menu". */
export function normalizarTexto(s?: string | null): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
}

/**
 * true si TODAS las palabras buscadas aparecen en alguno de los campos.
 * Así "casona dj" encuentra el sueldo del DJ de un evento de Casona aunque
 * cada palabra esté en un campo distinto. Búsqueda vacía: coincide todo.
 */
export function coincideBusqueda(q: string, campos: Array<string | null | undefined>): boolean {
  const palabras = normalizarTexto(q).split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return true
  const texto = campos.map(normalizarTexto).join(" | ")
  return palabras.every((p) => texto.includes(p))
}

// ---------------------------------------------------------------------------
// Meses
// ---------------------------------------------------------------------------

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

/**
 * Mes "YYYY-MM" de una fecha. Las fechas sueltas ("YYYY-MM-DD", como los
 * vencimientos) se toman tal cual; los movimientos de caja guardan un ISO con
 * hora en UTC, así que se pasan al día de negocio de Argentina (fechaNegocio):
 * un cobro del 31 a las 22 hs es de ese mes y no del siguiente.
 * Fecha vacía o inválida: "".
 */
export function mesDeFecha(fecha?: string | null): string {
  if (!fecha) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha.slice(0, 7)
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return ""
  return fechaNegocio(d).slice(0, 7)
}

/** "2026-10" → "octubre 2026". */
export function etiquetaMes(key: string): string {
  const [y, m] = key.split("-").map(Number)
  if (!y || !m || m < 1 || m > 12) return key
  return `${MESES[m - 1]} ${y}`
}

/** Meses distintos presentes en las fechas, del más nuevo al más viejo. */
export function mesesDisponibles(fechas: Array<string | null | undefined>): string[] {
  const set = new Set<string>()
  for (const f of fechas) {
    const k = mesDeFecha(f)
    if (k) set.add(k)
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a))
}

/** "todos" (o vacío) deja pasar todo; si no, compara el mes de la fecha. */
export function coincideMes(mes: string | null | undefined, fecha?: string | null): boolean {
  if (!mes || mes === "todos") return true
  return mesDeFecha(fecha) === mes
}

// ---------------------------------------------------------------------------
// "Por pagar" y "Por cobrar"
// ---------------------------------------------------------------------------

const ETIQUETA_TIPO_EGRESO: Record<EgresoPendienteServicio["tipo"], string> = {
  "seña": "seña servicio",
  saldo: "saldo servicio",
  menu: "menú cocina",
  barra: "barra",
  sueldo: "sueldo personal",
}

/** Búsqueda de un renglón de "Por pagar": evento, proveedor/servicio, persona y tipo de pago. */
export function coincideEgresoBusqueda(e: EgresoPendienteServicio, q: string): boolean {
  return coincideBusqueda(q, [e.eventoNombre, e.servicioNombre, e.persona, e.eventoTipo, ETIQUETA_TIPO_EGRESO[e.tipo]])
}

/** Búsqueda y mes (de vencimiento) de una cuota de "Por cobrar". */
export function filtrarIngresosPendientes(
  items: IngresoPendiente[],
  filtro: { q: string; mes: string },
): IngresoPendiente[] {
  return items.filter(
    (i) =>
      coincideMes(filtro.mes, i.fechaVencimiento) &&
      coincideBusqueda(filtro.q, [i.eventoNombre, i.contacto?.nombre, `cuota ${i.numeroCuota}`]),
  )
}

// ---------------------------------------------------------------------------
// Historial completo (cobros y pagos)
// ---------------------------------------------------------------------------

export interface MovimientoHistorial {
  id: string
  tipo: "ingreso" | "egreso"
  fecha: string // ISO, tal como está en movimientos_caja
  concepto: string
  eventoId?: string
  eventoNombre: string
  salon: string
  monto: number
  /** Solo egresos: el pago original, para las acciones Archivar / Revertir. */
  pago?: PagoRealizado
}

/**
 * Une en una sola lista lo que entró a Caja Eventos (cuotas, señas, ajustes a
 * favor) y lo que salió (los pagos de `pagosRealizados`, sin los archivados),
 * del más nuevo al más viejo. Los ingresos salen de los mismos movimientos
 * que suma el saldo de la caja, filtrados por el salón elegido igual que
 * calcularCajaEventos. No cambia ningún monto.
 */
export function armarHistorialCajaEventos(params: {
  movimientos: MovimientoCaja[]
  pagosRealizados: PagoRealizado[]
  pagosArchivadosIds: Set<string>
  eventos: Pick<EventoGuardado, "id" | "nombrePareja" | "nombre" | "tipoEvento">[]
  salonFiltro?: string
}): MovimientoHistorial[] {
  const salonSel = params.salonFiltro && params.salonFiltro !== "todos" ? params.salonFiltro : null
  const nombrePorId = new Map<string, string>()
  for (const ev of params.eventos) nombrePorId.set(ev.id, ev.nombrePareja || ev.nombre || ev.tipoEvento || "Evento")

  const ingresos: MovimientoHistorial[] = params.movimientos
    .filter((m) => m.cajaDestino === "caja_eventos" && m.tipo === "ingreso" && (!salonSel || m.salon === salonSel))
    .map((m) => ({
      id: m.id,
      tipo: "ingreso" as const,
      fecha: m.fecha,
      concepto: m.concepto || "Ingreso",
      eventoId: m.eventoId,
      eventoNombre: m.eventoId ? nombrePorId.get(m.eventoId) ?? "" : "",
      salon: m.salon || "",
      monto: m.monto,
    }))

  const egresos: MovimientoHistorial[] = params.pagosRealizados
    .filter((p) => !params.pagosArchivadosIds.has(p.id))
    .map((p) => ({
      id: p.id,
      tipo: "egreso" as const,
      fecha: p.fecha,
      concepto: p.concepto,
      eventoId: p.eventoId,
      eventoNombre: p.eventoNombre,
      salon: p.salon,
      monto: p.monto,
      pago: p,
    }))

  return [...ingresos, ...egresos].sort((a, b) => {
    const t = (b.fecha || "").localeCompare(a.fecha || "")
    return t !== 0 ? t : a.id.localeCompare(b.id)
  })
}

export interface FiltroHistorial {
  q: string
  mes: string // "todos" o "YYYY-MM"
  tipo: "todos" | "ingreso" | "egreso"
}

export const FILTRO_HISTORIAL_INICIAL: FiltroHistorial = { q: "", mes: "todos", tipo: "todos" }

export function filtrarHistorial(items: MovimientoHistorial[], f: FiltroHistorial): MovimientoHistorial[] {
  return items.filter(
    (it) =>
      (f.tipo === "todos" || it.tipo === f.tipo) &&
      coincideMes(f.mes, it.fecha) &&
      coincideBusqueda(f.q, [
        it.concepto,
        it.eventoNombre,
        it.pago?.servicioNombre,
        it.tipo === "ingreso" ? "cobro ingreso" : "pago egreso",
      ]),
  )
}

/** Totales de lo que se ve (redondeados a centavos, como el resto de la caja). */
export function totalesHistorial(items: MovimientoHistorial[]): { ingresos: number; egresos: number } {
  let ingresos = 0
  let egresos = 0
  for (const it of items) {
    if (it.tipo === "ingreso") ingresos += it.monto
    else egresos += it.monto
  }
  const r = (n: number) => Math.round(n * 100) / 100
  return { ingresos: r(ingresos), egresos: r(egresos) }
}

// ---------------------------------------------------------------------------
// Datos bancarios del personal al pagar un sueldo
// ---------------------------------------------------------------------------

/**
 * Persona del roster (Finanzas → Personal) a la que corresponde un sueldo de
 * "Por pagar", para mostrar su banco, CBU y alias. Solo para el personal: un
 * servicio que se paga como sueldo es un proveedor, no tiene CBU cargado.
 * - "-sueldo-": personal del evento (evento.personalEvento → personalId).
 * - "-compromiso-": compromiso de Finanzas → Personal (pagosPersonal → personalId).
 * Devuelve null si no es sueldo o no se encuentra la persona.
 */
export function personalDelSueldo(
  egreso: Pick<EgresoPendienteServicio, "id" | "tipo" | "eventoId" | "servicioId">,
  ctx: {
    eventos: Pick<EventoGuardado, "id" | "personalEvento">[]
    pagosPersonal: Pick<PagoPersonal, "id" | "personalId">[]
    personal: PersonalEvento[]
  },
): PersonalEvento | null {
  if (egreso.tipo !== "sueldo" || !egreso.servicioId) return null
  let personalId: string | undefined
  if (egreso.id.includes("-srvsueldo-")) return null
  if (egreso.id.includes("-compromiso-")) {
    personalId = ctx.pagosPersonal.find((pp) => pp.id === egreso.servicioId)?.personalId
  } else if (egreso.id.includes("-sueldo-")) {
    const ev = ctx.eventos.find((e) => e.id === egreso.eventoId)
    personalId = ev?.personalEvento?.find((pe) => pe.id === egreso.servicioId)?.personalId
  }
  if (!personalId) return null
  return ctx.personal.find((p) => p.id === personalId) ?? null
}

/** Datos bancarios para mostrar; null si la persona no tiene ni CBU ni alias. */
export function datosBancarios(
  persona: Pick<PersonalEvento, "cuentaBancaria"> | null | undefined,
): { banco: string; cbu: string; alias: string } | null {
  const c = persona?.cuentaBancaria
  const banco = (c?.banco ?? "").trim()
  const cbu = (c?.cbu ?? "").trim()
  const alias = (c?.alias ?? "").trim()
  if (!cbu && !alias) return null
  return { banco, cbu, alias }
}

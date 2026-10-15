/**
 * Pagar un gasto de Caja Jazmines descuenta la plata del saldo (pedido del
 * dueño, 14/10/2026: "el saldo actual es lo que debería tener en mis manos").
 *
 * Cada pago deja un EGRESO en movimientos_caja (caja_jazmines) con un
 * `refId` que dice qué gasto, qué mes y qué salón pagó. Al deshacer el pago
 * se borra ese egreso y la plata vuelve al saldo.
 *
 * Este archivo solo calcula (no escribe nada): qué "unidades pagadas" tiene
 * un gasto y qué egresos hay que crear o borrar cuando cambia. Lo usa
 * `sincronizarPagosGasto` del store.
 *
 * Qué genera egreso:
 * - Gasto fijo: cada mes pagado, con la MISMA regla que la tira de meses
 *   (lib/pago-gasto-fijo.ts). En un gasto repartido, una unidad por salón
 *   con su parte (en el período vigente manda la parte de cada salón; en los
 *   demás meses, el registro del mes). Solo se miran los meses que se
 *   tocaron en ese cambio: así reacomodar el período vigente no borra pagos
 *   viejos.
 * - Gasto variable: pagado = una unidad (o una por salón si está repartido).
 * Las comisiones y los sueldos de vendedores no pasan por acá.
 * Los meses de gastos fijos hasta ULTIMO_MES_CONCILIADO no generan egresos.
 */

import type { CostoOperativo, RegistroMonto } from "./store"
import { registroMarcadoPagado } from "./pago-gasto-fijo"

export interface UnidadPagada {
  /** Identifica el pago: gf:<gasto>:<mes>:<salón> o gv:<gasto>:<salón>. */
  ref: string
  monto: number
  /** Salón del egreso ("" = general, sin salón). */
  salon: string
  concepto: string
  /** Solo gastos fijos: mes pagado (YYYY-MM). */
  mes?: string
}

type GastoPago = Pick<CostoOperativo, "id" | "concepto" | "monto"> &
  Partial<Pick<CostoOperativo, "historialMontos" | "distribucion" | "salon" | "esVariable" | "pagado" | "activo">>

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

function nombreMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number)
  return m >= 1 && m <= 12 ? `${MESES[m - 1]} ${y}` : mes
}

/** Redondeo a centavos, como el resto del módulo financiero. */
function aCentavos(x: number): number {
  return Math.round(x * 100) / 100
}

function partes(gasto: GastoPago) {
  return (gasto.distribucion || []).filter((d) => d && d.salon && d.porcentaje > 0)
}

export function refFijo(gastoId: string, mes: string, salon: string): string {
  return `gf:${gastoId}:${mes}:${salon || "-"}`
}

export function refVariable(gastoId: string, salon: string): string {
  return `gv:${gastoId}:${salon || "-"}`
}

/** Datos que se leen de un refId: el gasto y, si es fijo, el mes. */
export function leerRef(ref: string | null | undefined): { gastoId: string; mes?: string } | null {
  if (!ref) return null
  const [tipo, gastoId, mes] = ref.split(":")
  if (tipo === "gf" && gastoId) return { gastoId, mes }
  if (tipo === "gv" && gastoId) return { gastoId }
  return null
}

/**
 * Último mes ya conciliado: la caja se puso a la realidad contando la plata
 * (agosto 2026), así que los gastos fijos de ese mes o anteriores ya están
 * reflejados en el saldo. Marcarlos pagados (o deshacerlos) acomoda la tira
 * pero NO descuenta ni devuelve plata. Decisión del dueño, 15/10/2026.
 */
export const ULTIMO_MES_CONCILIADO = "2026-08"

/** true si pagar ese mes de un gasto fijo no toca el saldo (ya conciliado). */
export function mesYaConciliado(mes: string): boolean {
  return mes <= ULTIMO_MES_CONCILIADO
}

/** Unidades pagadas de UN mes de un gasto fijo. */
function unidadesFijoDelMes(gasto: GastoPago, mes: string): UnidadPagada[] {
  // Meses ya conciliados: su plata ya está en el saldo, no generan egresos.
  if (mesYaConciliado(mes)) return []
  const hist: RegistroMonto[] = gasto.historialMontos || []
  const registro = hist.find((r) => r.mes === mes)
  if (!registro) return []
  const vigente = hist.length > 0 ? hist[hist.length - 1].mes : null
  const dist = partes(gasto)
  const concepto = `Pago gasto fijo - ${gasto.concepto} (${nombreMes(mes)})`
  if (dist.length === 0) {
    if (!registroMarcadoPagado(registro)) return []
    return [{ ref: refFijo(gasto.id, mes, gasto.salon || ""), monto: aCentavos(registro.monto), salon: gasto.salon || "", concepto, mes }]
  }
  // Repartido: en el período vigente manda la parte de cada salón; en los
  // demás meses, el registro del mes (igual que la tira de meses).
  const pagadas = mes === vigente ? dist.filter((d) => d.pagado === true) : !registroMarcadoPagado(registro) ? [] : dist
  return pagadas.map((d) => ({
    ref: refFijo(gasto.id, mes, d.salon),
    monto: aCentavos((registro.monto * d.porcentaje) / 100),
    salon: d.salon,
    concepto: `${concepto} · ${d.porcentaje}%`,
    mes,
  }))
}

/** Unidades pagadas de un gasto variable. */
function unidadesVariable(gasto: GastoPago): UnidadPagada[] {
  if (!gasto.pagado || gasto.activo === false) return []
  const concepto = `Pago gasto - ${gasto.concepto}`
  const dist = partes(gasto)
  if (dist.length === 0) {
    return [{ ref: refVariable(gasto.id, gasto.salon || ""), monto: aCentavos(gasto.monto), salon: gasto.salon || "", concepto }]
  }
  return dist.map((d) => ({
    ref: refVariable(gasto.id, d.salon),
    monto: aCentavos((gasto.monto * d.porcentaje) / 100),
    salon: d.salon,
    concepto: `${concepto} · ${d.porcentaje}%`,
  }))
}

/**
 * Unidades pagadas de un gasto. Para un gasto fijo hay que decir qué meses
 * mirar (los que tocó el cambio); un variable no tiene meses.
 */
export function unidadesPagadas(gasto: GastoPago | undefined, meses: string[] = []): UnidadPagada[] {
  if (!gasto) return []
  if (gasto.esVariable) return unidadesVariable(gasto)
  return [...new Set(meses)].flatMap((mes) => unidadesFijoDelMes(gasto, mes))
}

export interface DiferenciaPagos {
  /** Egresos a crear. */
  altas: UnidadPagada[]
  /** refs de egresos a borrar. */
  bajas: string[]
}

/**
 * Qué egresos crear y borrar cuando un gasto pasa de `antes` a `despues`.
 * - Unidad nueva → egreso nuevo.
 * - Unidad que desaparece → se borra su egreso (si existe).
 * - Unidad que cambió de monto → se reemplaza, solo si ya tenía egreso (un
 *   pago anterior a este sistema no se descuenta por editar el gasto).
 * `refsConEgreso`: refs que ya tienen egreso en la caja.
 */
export function diferenciaPagos(
  antes: GastoPago | undefined,
  despues: GastoPago | undefined,
  meses: string[],
  refsConEgreso: Set<string>,
): DiferenciaPagos {
  const a = new Map(unidadesPagadas(antes, meses).map((u) => [u.ref, u]))
  const d = new Map(unidadesPagadas(despues, meses).map((u) => [u.ref, u]))
  const altas: UnidadPagada[] = []
  const bajas: string[] = []
  for (const [ref, u] of d) {
    const previa = a.get(ref)
    if (!previa) {
      // Pago nuevo. Si ya tiene egreso (por ejemplo, un doble clic), no se repite.
      if (!refsConEgreso.has(ref)) altas.push(u)
    } else if (previa.monto !== u.monto && refsConEgreso.has(ref)) {
      bajas.push(ref)
      altas.push(u)
    }
  }
  for (const ref of a.keys()) {
    if (!d.has(ref) && refsConEgreso.has(ref)) bajas.push(ref)
  }
  return { altas, bajas }
}

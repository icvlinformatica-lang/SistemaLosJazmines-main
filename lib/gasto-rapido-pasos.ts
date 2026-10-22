/**
 * Pasos de "Cargar gastos" (components/gasto-rapido-modal.tsx), tipo
 * pasarela de pago. Pedido de Rodrigo (22/10/2026): el formulario de una sola
 * hoja confundía el orden de carga y llevaba a errores.
 *
 * Gasto:  1 Qué (concepto y monto) → 2 Salones (uno o repartido) →
 *         3 Fecha y pago (vencimiento, carpeta, ya pagado) → 4 Revisar.
 * Retiro: 1 Qué → 2 Salón → 3 Revisar (no tiene vencimiento ni carpeta).
 *
 * Solo ordena lo que se pide: los requisitos para guardar son los mismos de
 * camposFaltantesGasto (lib/gasto-rapido-validacion.ts), repartidos por paso.
 * Lógica pura para poder probarla (scripts/test-gasto-rapido-pasos.cjs).
 */

import { camposFaltantesGasto, type CampoGasto, type DatosGastoRapido } from "@/lib/gasto-rapido-validacion"

export type PasoGasto = "que" | "salones" | "fecha" | "revisar"

export const ETIQUETA_PASO: Record<PasoGasto, string> = {
  que: "Qué",
  salones: "Salones",
  fecha: "Fecha y pago",
  revisar: "Revisar",
}

export function pasosGasto(modo: "gasto" | "retiro", editando: boolean): PasoGasto[] {
  return modo === "retiro" && !editando ? ["que", "salones", "revisar"] : ["que", "salones", "fecha", "revisar"]
}

/** En qué paso se carga cada dato. */
const PASO_DE_CAMPO: Record<CampoGasto, PasoGasto> = {
  nombre: "que",
  monto: "que",
  salon: "salones",
  reparto: "salones",
  fecha: "fecha",
}

/** Datos extra de una compra de limpieza (si se tildó un artículo). */
export interface CompraEnPasos {
  /** Cantidad comprada tal como se escribió ("10", "2,5"). */
  cantidad: string
  /** Salón donde queda guardado lo comprado (solo importa si se reparte). */
  salonStock: string
}

export type FaltaPaso = CampoGasto | "cantidad" | "salonStock"

export const MENSAJE_FALTA_PASO: Record<"cantidad" | "salonStock", string> = {
  cantidad: "Poné cuánto compraste.",
  salonStock: "Elegí en qué salón se guarda lo comprado.",
}

/** Lo que falta para pasar del paso `paso`. */
export function faltantesDelPaso(paso: PasoGasto, d: DatosGastoRapido, compra?: CompraEnPasos | null): FaltaPaso[] {
  const faltan: FaltaPaso[] = camposFaltantesGasto(d).filter((c) => PASO_DE_CAMPO[c] === paso)
  // El monto tiene que ser un número mayor a 0, no solo "algo escrito".
  if (paso === "que" && !faltan.includes("monto") && !(Number(d.monto) > 0)) faltan.push("monto")
  if (compra && d.modo === "gasto" && !d.editando) {
    if (paso === "que" && !(Number(compra.cantidad.replace(",", ".")) > 0)) faltan.push("cantidad")
    if (paso === "salones" && d.repartir && !compra.salonStock) faltan.push("salonStock")
  }
  return faltan
}

/**
 * Primer paso con algo sin completar, o null si está todo. Sirve para no
 * dejar saltar a "Revisar" con datos faltantes y para volver al paso justo.
 */
export function primerPasoIncompleto(
  pasos: PasoGasto[],
  d: DatosGastoRapido,
  compra?: CompraEnPasos | null,
): PasoGasto | null {
  for (const p of pasos) {
    if (p === "revisar") continue
    if (faltantesDelPaso(p, d, compra).length > 0) return p
  }
  return null
}

/** Se puede ir a un paso si todos los anteriores están completos (volver atrás, siempre). */
export function puedeIrAlPaso(
  destino: PasoGasto,
  actual: PasoGasto,
  pasos: PasoGasto[],
  d: DatosGastoRapido,
  compra?: CompraEnPasos | null,
): boolean {
  const iDestino = pasos.indexOf(destino)
  if (iDestino < 0) return false
  if (iDestino <= pasos.indexOf(actual)) return true
  return pasos.slice(0, iDestino).every((p) => p === "revisar" || faltantesDelPaso(p, d, compra).length === 0)
}

/**
 * Cuánto le toca a cada salón de un gasto repartido, en pesos con centavos.
 * El último salón se lleva el redondeo para que la suma dé exacto el monto.
 * Es solo para mostrar en "Revisar": el reparto que se guarda son los %.
 */
export function montosPorSalon(
  monto: number,
  distribucion: Array<{ salon: string; porcentaje: number }>,
): Array<{ salon: string; porcentaje: number; monto: number }> {
  const activos = distribucion.filter((x) => x.salon && x.porcentaje > 0)
  let asignado = 0
  return activos.map((x, i) => {
    const parte =
      i === activos.length - 1
        ? Math.round((monto - asignado) * 100) / 100
        : Math.round(((monto * x.porcentaje) / 100) * 100) / 100
    asignado += parte
    return { salon: x.salon, porcentaje: x.porcentaje, monto: parte }
  })
}

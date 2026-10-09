/**
 * Qué falta para poder guardar desde "Gasto rápido" (gasto o retiro).
 *
 * Antes, si faltaba un dato el botón quedaba apagado sin explicar por qué.
 * Esta función dice qué campo falta para marcarlo en rojo con un texto corto.
 * No cambia ninguna regla: son los mismos requisitos que ya pedía el modal.
 */

export type CampoGasto = "salon" | "reparto" | "nombre" | "monto" | "fecha"

export interface DatosGastoRapido {
  modo: "gasto" | "retiro"
  /** true cuando se está editando un gasto existente (ahí no aplica el retiro). */
  editando: boolean
  nombre: string
  monto: string
  salon: string
  fecha: string
  repartir: boolean
  /** Resultado de repartoValido(distribucion), que calcula el editor de reparto. */
  repartoValido: boolean
}

/** Mensaje corto de cada campo faltante, para mostrar debajo del campo. */
export const MENSAJE_CAMPO_FALTANTE: Record<CampoGasto, string> = {
  salon: "Elegí el salón.",
  reparto: "Revisá el reparto entre salones.",
  nombre: "Falta el concepto.",
  monto: "Falta el monto.",
  fecha: "Falta el vencimiento.",
}

export function camposFaltantesGasto(d: DatosGastoRapido): CampoGasto[] {
  const faltan: CampoGasto[] = []
  const esRetiro = d.modo === "retiro" && !d.editando
  if (esRetiro) {
    if (!d.salon) faltan.push("salon")
  } else if (d.repartir) {
    if (!d.repartoValido) faltan.push("reparto")
  } else if (!d.salon) {
    faltan.push("salon")
  }
  if (!d.nombre) faltan.push("nombre")
  if (!d.monto) faltan.push("monto")
  if (!esRetiro && !d.fecha) faltan.push("fecha")
  return faltan
}

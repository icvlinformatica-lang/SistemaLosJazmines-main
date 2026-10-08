/**
 * Qué le falta a un evento para quedar bien cargado en el sistema.
 *
 * Se usa para los eventos que nacen de una cotización aprobada: la
 * cotización trae el salón, la fecha, los invitados, el menú, la barra, los
 * servicios y el nombre/DNI/teléfono del cliente, pero NO trae la dirección
 * del cliente ni la forma de pago (seña y cuotas). Eso lo completa
 * Administración en el planificador, y este aviso le dice qué le queda.
 *
 * Solo lee el evento: no cambia ningún cálculo ni ningún dato guardado.
 */

export type FaltanteEvento = "contrato" | "plan de pagos" | "servicios" | "menú" | "barra"

/** Lo mínimo del evento que hace falta mirar (sirve el de lib/store.ts). */
export interface EventoParaFaltantes {
  contrato?: {
    nombreCompleto?: string
    dni?: string
    telefono?: string
    direccion?: string
    vendedor?: string
  } | null
  planDeCuotas?: { montoTotal?: number } | null
  servicios?: unknown[] | null
  recetasAdultos?: unknown[] | null
  recetasAdolescentes?: unknown[] | null
  recetasNinos?: unknown[] | null
  recetasDietasEspeciales?: unknown[] | null
  barras?: Array<{ coctelesIncluidos?: unknown[] | null } | null> | null
}

const lleno = (s: unknown) => typeof s === "string" && s.trim() !== ""
const cantidad = (a: unknown) => (Array.isArray(a) ? a.length : 0)

/**
 * Lista, en orden fijo, lo que falta:
 * - contrato: nombre completo, DNI, teléfono o dirección del cliente, o el
 *   vendedor (sin vendedor no hay comisión);
 * - plan de pagos: no hay plan de cuotas con un total mayor a 0 (sin plan no
 *   se cobra la seña ni las cuotas, y la comisión no se habilita);
 * - servicios: ningún servicio contratado;
 * - menú: ningún plato elegido para ningún grupo de invitados;
 * - barra: ninguna barra con cócteles (la barra clásica de la cotización
 *   llega sin cócteles: hay que cargarlos en el planificador).
 */
export function faltantesEvento(evento: EventoParaFaltantes): FaltanteEvento[] {
  const faltan: FaltanteEvento[] = []
  const c = evento.contrato || {}
  if (!lleno(c.nombreCompleto) || !lleno(c.dni) || !lleno(c.telefono) || !lleno(c.direccion) || !lleno(c.vendedor)) {
    faltan.push("contrato")
  }
  if (!((Number(evento.planDeCuotas?.montoTotal) || 0) > 0)) faltan.push("plan de pagos")
  if (cantidad(evento.servicios) === 0) faltan.push("servicios")
  const platos =
    cantidad(evento.recetasAdultos) +
    cantidad(evento.recetasAdolescentes) +
    cantidad(evento.recetasNinos) +
    cantidad(evento.recetasDietasEspeciales)
  if (platos === 0) faltan.push("menú")
  const hayBarra = (evento.barras || []).some((b) => cantidad(b?.coctelesIncluidos) > 0)
  if (!hayBarra) faltan.push("barra")
  return faltan
}

/** "Falta: contrato, menú" — o null si no falta nada. */
export function textoFaltantes(faltan: FaltanteEvento[]): string | null {
  return faltan.length ? `Falta: ${faltan.join(", ")}` : null
}

/** Detalle de qué datos del contrato faltan, para el planificador. */
export function faltantesContrato(contrato: EventoParaFaltantes["contrato"]): string[] {
  const c = contrato || {}
  const faltan: string[] = []
  if (!lleno(c.nombreCompleto)) faltan.push("nombre completo")
  if (!lleno(c.dni)) faltan.push("DNI")
  if (!lleno(c.telefono)) faltan.push("teléfono")
  if (!lleno(c.direccion)) faltan.push("dirección")
  if (!lleno(c.vendedor)) faltan.push("vendedor")
  return faltan
}

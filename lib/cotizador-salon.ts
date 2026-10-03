// Cotizador por salón — modelo COSTO + GANANCIA (scripts/015).
//
// Cada salón funciona como una empresa aparte y tiene 5 rubros, cada uno
// con su costo y su % de ganancia:
//   1. Salón:     costo fijo cargado a mano (no depende de invitados ni día).
//   2. Cocina:    costo por porción de cada receta (lib/precio-menu.ts).
//   3. Barra:     barras armadas; por adulto = 1 trago de cada cóctel
//                 (lib/precio-barra-cotizador.ts).
//   4. Servicios: costoParaCajaEventos de cada servicio.
//   5. Personal:  reglas por función, cada una con su propia ganancia.
//
// Precio = costo × (1 + ganancia / 100), redondeado a pesos POR UNIDAD
// (por porción, por trago, por persona), igual que la Parte 1.
//
// Lógica pura (sin "use client" ni base): la usan la pantalla de
// Configuración, el servidor y scripts/test-cotizador-salon.cjs.

import { precioBarraDesdeCostos, type PrecioBarraArmada } from "./precio-barra-cotizador"

/** Misma lista y orden que SALONES de lib/store.ts (que es de cliente y no
 *  se puede importar desde el servidor). Una prueba verifica que coincidan. */
export const SALONES_COTIZADOR = ["Quinta", "Casona", "Salon", "Salon 4", "Salon 5"] as const

export function esSalonCotizador(salon: unknown): salon is (typeof SALONES_COTIZADOR)[number] {
  return typeof salon === "string" && (SALONES_COTIZADOR as readonly string[]).includes(salon)
}

/** Precio de una unidad: costo × (1 + ganancia%), redondeado a pesos. */
export function precioConGanancia(costo: number, gananciaPct: number): number {
  return Math.round((Number(costo) || 0) * (1 + (Number(gananciaPct) || 0) / 100))
}

// ── Cocina y barra ──────────────────────────────────────────────────────────

/** Precio de cocina para un evento: precio por porción × comensales. */
export function precioCocina(costoPorcion: number, gananciaPct: number, comensales: number): number {
  return precioConGanancia(costoPorcion, gananciaPct) * Math.max(0, Math.floor(Number(comensales) || 0))
}

/** Precio por adulto de una barra armada con la ganancia de barra del salón. */
export function precioBarraSalon(
  coctelesIds: string[],
  costosPorTrago: Record<string, number>,
  gananciaPct: number,
): PrecioBarraArmada {
  return precioBarraDesdeCostos(coctelesIds, costosPorTrago, (Number(gananciaPct) || 0) / 100)
}

// ── Personal ────────────────────────────────────────────────────────────────

export type AplicaRegla = "siempre" | "con_menu" | "con_barra"

export const APLICA_OPCIONES: Array<{ valor: AplicaRegla; etiqueta: string }> = [
  { valor: "siempre", etiqueta: "Siempre" },
  { valor: "con_menu", etiqueta: "Si hay menú" },
  { valor: "con_barra", etiqueta: "Si hay barra" },
]

export interface ReglaPersonalSalon {
  funcion: string
  /** "Uno cada N invitados". 0 = personal fijo: siempre el mínimo. */
  cadaNInvitados: number
  minimo: number
  /** Tarifa escrita a mano. null = la tarifa base más alta de esa función. */
  tarifa: number | null
  /** % de ganancia propio de esta función. */
  ganancia: number
  aplica: AplicaRegla
}

export interface PersonaConTarifa {
  id: string
  nombre: string
  apellido: string
  funcion: string
  tarifaBase: number
}

/** Cantidad = max(mínimo, ⌈invitados / N⌉). N = 0 → siempre el mínimo. */
export function cantidadPersonal(regla: Pick<ReglaPersonalSalon, "cadaNInvitados" | "minimo">, invitados: number): number {
  const minimo = Math.max(0, Math.floor(Number(regla.minimo) || 0))
  const n = Math.max(0, Math.floor(Number(regla.cadaNInvitados) || 0))
  const inv = Math.max(0, Number(invitados) || 0)
  return n > 0 ? Math.max(minimo, Math.ceil(inv / n)) : minimo
}

/** La tarifa base más alta del personal activo con esa función (texto exacto),
 *  y de quién es. null si nadie tiene esa función. */
export function tarifaMasAlta(funcion: string, roster: PersonaConTarifa[]): { tarifa: number; de: string } | null {
  let mejor: PersonaConTarifa | null = null
  for (const p of roster) {
    if (p.funcion !== funcion) continue
    if (!mejor || (Number(p.tarifaBase) || 0) > (Number(mejor.tarifaBase) || 0)) mejor = p
  }
  return mejor ? { tarifa: Number(mejor.tarifaBase) || 0, de: `${mejor.nombre} ${mejor.apellido}`.trim() } : null
}

export interface TarifaResuelta {
  tarifa: number
  origen: "manual" | "personal" | "sin_costo"
  /** Nombre de la persona con la tarifa más alta (solo origen "personal"). */
  de?: string
}

/** Tarifa que usa una regla: la escrita a mano, o la más alta de su función.
 *  Sin ninguna de las dos (o en $0) → "sin_costo", que la pantalla marca. */
export function tarifaDeRegla(regla: Pick<ReglaPersonalSalon, "funcion" | "tarifa">, roster: PersonaConTarifa[]): TarifaResuelta {
  if (regla.tarifa != null && Number.isFinite(Number(regla.tarifa))) {
    const t = Number(regla.tarifa)
    return { tarifa: t, origen: t > 0 ? "manual" : "sin_costo" }
  }
  const alta = tarifaMasAlta(regla.funcion, roster)
  if (!alta || alta.tarifa <= 0) return { tarifa: 0, origen: "sin_costo" }
  return { tarifa: alta.tarifa, origen: "personal", de: alta.de }
}

/** ¿La regla se suma en este evento? */
export function reglaAplica(aplica: AplicaRegla, evento: { conMenu: boolean; conBarra: boolean }): boolean {
  if (aplica === "con_menu") return evento.conMenu
  if (aplica === "con_barra") return evento.conBarra
  return true
}

export interface LineaPersonal {
  funcion: string
  cantidad: number
  tarifa: TarifaResuelta
  /** Precio de UNA persona: tarifa × (1 + ganancia%). */
  precioUnitario: number
  costoTotal: number
  precioTotal: number
}

/** Simulación del personal de un evento: solo las reglas que aplican y que
 *  dan al menos una persona. */
export function simularPersonal(
  reglas: ReglaPersonalSalon[],
  roster: PersonaConTarifa[],
  evento: { invitados: number; conMenu: boolean; conBarra: boolean },
): { lineas: LineaPersonal[]; costoTotal: number; precioTotal: number } {
  const lineas: LineaPersonal[] = []
  for (const regla of reglas) {
    if (!reglaAplica(regla.aplica, evento)) continue
    const cantidad = cantidadPersonal(regla, evento.invitados)
    if (cantidad <= 0) continue
    const tarifa = tarifaDeRegla(regla, roster)
    const precioUnitario = precioConGanancia(tarifa.tarifa, regla.ganancia)
    lineas.push({
      funcion: regla.funcion,
      cantidad,
      tarifa,
      precioUnitario,
      costoTotal: tarifa.tarifa * cantidad,
      precioTotal: precioUnitario * cantidad,
    })
  }
  return {
    lineas,
    costoTotal: lineas.reduce((s, l) => s + l.costoTotal, 0),
    precioTotal: lineas.reduce((s, l) => s + l.precioTotal, 0),
  }
}

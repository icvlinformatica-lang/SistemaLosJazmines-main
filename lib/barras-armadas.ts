// Barras armadas (barra_templates) vistas desde Cócteles y usadas en el
// planificador de eventos (pedido de Rodrigo, 10/11/2026).
//
// En Cócteles cada barra tiene dos interruptores:
// - "Cotizaciones": si aparece en el cotizador del vendedor. Eso se guarda
//   POR SALÓN (cotizador_salon_barra, scripts/015); el interruptor la prende
//   o la apaga en todos los salones del cotizador a la vez.
// - "Generar contrato": si se ofrece en el planificador (barra_templates.
//   en_planificador, scripts/029).
//
// En el planificador elegir una barra es SOLO un atajo para tildar sus
// cócteles: la barra del evento sigue siendo la misma lista de cócteles de
// siempre, así que el costo (calcularComprasBarras), Caja Eventos, la lista de
// compras y el precio de venta no cambian de cuenta. Lo único nuevo es que
// queda anotado de qué barra salió (BarraEvento.barraTemplateId, que ya
// existía), para que el contrato diga su nombre.
//
// Lógica pura, sin base ni React (scripts/test-barras-armadas.cjs).

export interface BarraArmadaBasica {
  id: string
  nombre: string
  coctelesIncluidos: string[]
  enPlanificador?: boolean
}

export interface EstadoCotizadorBarra {
  /** Salones del cotizador en los que aparece, en el orden de `salones`. */
  enSalones: string[]
  /** true si aparece en todos los salones del cotizador. */
  enTodos: boolean
  /** true si aparece en al menos uno. */
  enAlguno: boolean
}

/**
 * Salones que cuentan para el interruptor "Cotizaciones": los que el
 * cotizador ofrece de verdad (con costo de salón cargado). Los salones sin
 * costo (hoy "Salon 4" y "Salon 5") no se cotizan, así que no se tocan.
 */
export function salonesDelCotizador(filas: Array<{ salon: string; costoSalon: number }>): string[] {
  return filas.filter((f) => (Number(f.costoSalon) || 0) > 0).map((f) => f.salon)
}

/** En qué salones del cotizador aparece una barra. */
export function estadoCotizadorBarra(
  barraId: string,
  filasSalonBarra: Array<{ salon: string; barraTemplateId: string }>,
  salones: string[],
): EstadoCotizadorBarra {
  const conBarra = new Set(filasSalonBarra.filter((f) => f.barraTemplateId === barraId).map((f) => f.salon))
  const enSalones = salones.filter((s) => conBarra.has(s))
  return {
    enSalones,
    enTodos: salones.length > 0 && enSalones.length === salones.length,
    enAlguno: enSalones.length > 0,
  }
}

/** Cócteles de la barra que siguen en la carta (los borrados no cuentan). */
export function coctelesVigentes(barra: BarraArmadaBasica, coctelesExistentes: string[]): string[] {
  const existen = new Set(coctelesExistentes)
  return [...new Set(barra.coctelesIncluidos || [])].filter((id) => existen.has(id))
}

/** Barras que se ofrecen en el planificador: marcadas para "Generar
 *  contrato" y con al menos un cóctel que todavía existe. */
export function barrasParaPlanificador<T extends BarraArmadaBasica>(barras: T[], coctelesExistentes: string[]): T[] {
  return barras
    .filter((b) => b.enPlanificador === true && coctelesVigentes(b, coctelesExistentes).length > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
}

/**
 * Cócteles del evento al elegir una barra armada: los de la barra, en su
 * orden. Reemplaza lo que estaba tildado (es "la opción antes de elegir
 * cócteles sueltos"); después se pueden sumar o sacar sueltos como siempre.
 */
export function coctelesAlElegirBarra(barra: BarraArmadaBasica, coctelesExistentes: string[]): string[] {
  return coctelesVigentes(barra, coctelesExistentes)
}

/**
 * De qué barra armada sale la barra del evento después de tildar o destildar
 * un cóctel. Se mantiene mientras estén TODOS los cócteles de esa barra
 * (sumar sueltos está bien: "Barra X + extras"). Si se saca uno de la barra,
 * deja de ser esa barra y queda "" (barra a medida), así el contrato nunca
 * dice el nombre de una barra que no es la que se contrató.
 */
export function barraTemplateTrasCambio(
  barraTemplateId: string,
  coctelesNuevos: string[],
  barras: BarraArmadaBasica[],
  coctelesExistentes: string[],
): string {
  if (!barraTemplateId) return ""
  const barra = barras.find((b) => b.id === barraTemplateId)
  // Si la plantilla no está cargada (o se borró), no se sabe: se deja como estaba.
  if (!barra) return barraTemplateId
  const elegidos = new Set(coctelesNuevos)
  const deLaBarra = coctelesVigentes(barra, coctelesExistentes)
  if (deLaBarra.length === 0) return ""
  return deLaBarra.every((id) => elegidos.has(id)) ? barraTemplateId : ""
}

/** Cócteles sueltos sumados a la barra armada (los que no son de la barra). */
export function coctelesExtra(barra: BarraArmadaBasica | undefined, coctelesEvento: string[]): string[] {
  if (!barra) return []
  const deLaBarra = new Set(barra.coctelesIncluidos || [])
  return coctelesEvento.filter((id) => !deLaBarra.has(id))
}

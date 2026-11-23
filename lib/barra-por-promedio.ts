// Cuántos tragos de cada cóctel se cuentan en la barra de un evento.
//
// Pedido de Diego (confirmado por el dueño el 23/11/2026): cuando eligen
// muchos tragos, contar 1 trago por adulto de CADA cóctel disparaba el costo.
// Desde ahora:
//  - Cócteles con alcohol: cada adulto toma TRAGOS_POR_ADULTO (4) tragos en
//    total, repartidos en partes iguales entre los elegidos, sean 3 o 15. Es
//    lo mismo que "promedio del costo de los tragos elegidos × 4 × adultos",
//    pero así también salen bien las cantidades a comprar y el stock.
//  - Bebida de mesa (cerveza y vino): queda FUERA del promedio y se suma
//    aparte, 1 por adulto.
//  - Cócteles sin alcohol: como antes, 1 trago por adolescente y niño de cada
//    uno (hoy no hay ninguno cargado).
// Es una cuenta de costo: el precio que cotiza el vendedor no cambia.
// Lógica pura.

import { esBebidaDeMesa } from "./cotizador-salon"

/** Tragos con alcohol que toma cada adulto, sin importar cuántos se elijan. */
export const TRAGOS_POR_ADULTO = 4

/** Categoría de cóctel para la bebida de mesa (texto guardado en cocteles.categoria: no renombrar). */
export const CATEGORIA_BEBIDA_DE_MESA = "Bebida de mesa"

/** true si el cóctel es bebida de mesa: por su categoría o, los cargados
 *  antes de que existiera la categoría, porque su nombre dice "bebida de mesa". */
export function esCoctelDeMesa(coctel: { categoria?: string | null; nombre?: string | null }): boolean {
  return coctel.categoria === CATEGORIA_BEBIDA_DE_MESA || esBebidaDeMesa(coctel.nombre ?? "")
}

type CoctelBarra = { id: string; categoria?: string | null; nombre?: string | null }
type Invitados = { adultos?: number | null; adolescentes?: number | null; ninos?: number | null }

/** Tragos que se cuentan de cada cóctel elegido (id → tragos en todo el evento). */
export function tragosPorCoctelEvento(
  invitados: Invitados,
  coctelesElegidos: string[],
  cocteles: CoctelBarra[],
): Map<string, number> {
  const adultos = Number(invitados.adultos) || 0
  const menores = (Number(invitados.adolescentes) || 0) + (Number(invitados.ninos) || 0)
  const porId = new Map(cocteles.map((c) => [c.id, c]))
  // Cada cóctel una sola vez, aunque aparezca en dos barras.
  const elegidos = [...new Set(coctelesElegidos)].map((id) => porId.get(id)).filter((c): c is CoctelBarra => !!c)

  const deMesa = elegidos.filter((c) => esCoctelDeMesa(c))
  const sinAlcohol = elegidos.filter((c) => !esCoctelDeMesa(c) && c.categoria === "Sin Alcohol")
  const conAlcohol = elegidos.filter((c) => !esCoctelDeMesa(c) && c.categoria !== "Sin Alcohol")

  const tragos = new Map<string, number>()
  for (const c of deMesa) if (adultos > 0) tragos.set(c.id, adultos)
  for (const c of sinAlcohol) if (menores > 0) tragos.set(c.id, menores)
  if (conAlcohol.length > 0 && adultos > 0) {
    const porCoctel = (adultos * TRAGOS_POR_ADULTO) / conAlcohol.length
    for (const c of conAlcohol) tragos.set(c.id, porCoctel)
  }
  return tragos
}

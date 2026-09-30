// Las compras de un evento miran el stock DEL SALÓN donde se hace, no el
// total de los cinco.
//
// El problema que resuelve: `calcularCompras*` (lib/store.ts) hace
// "lo que necesito − insumo.stockActual", y stockActual es la suma de todos
// los salones. Un evento en Quinta descontaba mercadería que está físicamente
// en Casona, y la lista de compras salía corta.
//
// Cómo se resuelve SIN tocar esas funciones: en vez de cambiarles la firma,
// se les pasa el mismo catálogo de siempre pero con `stockActual` ya
// reemplazado por lo que hay en ese salón (`insumosEnSalon`). Para la función
// de compras no cambió nada; cambió el número que recibe.
//
// Lo que NO cambia: `costoMateriaPrima` = lo que necesito × precio, que no
// mira el stock. Ése es el que va al reparto Caja Eventos / Caja Jazmines
// (lib/hooks/use-caja-eventos.ts), así que este cambio no mueve un peso: solo
// cambia qué hay que ir a comprar.

export interface ConteoSalon {
  salon: string
  cantidad: number
}

/** insumoId → lo contado en cada salón. Sale de /api/stock-salones/por-insumo. */
export type StockPorSalon = Map<string, ConteoSalon[]>

/** Lo mínimo que necesita un insumo para que se le pueda proyectar el stock. */
interface ConStock {
  id: string
  stockActual: number
}

/**
 * El mismo catálogo, con `stockActual` = lo que hay en ese salón.
 *
 * Un insumo que en ese salón nadie contó vale 0, o sea que se compra entero.
 * Es a propósito: "nadie contó acá" no es "hay", y comprar de más se devuelve
 * o queda para la próxima, mientras que quedarse corto en el evento no se
 * arregla. La pantalla avisa cuáles son (ver `hayEnOtrosSalones`, que dice si
 * eso mismo está en otro salón y se puede trasladar en vez de comprarlo).
 *
 * Sin salón (un borrador que todavía no lo eligió) devuelve el catálogo tal
 * cual: sin salón no hay nada mejor que el total, y es el comportamiento que
 * había antes.
 *
 * Devuelve objetos nuevos: nunca modifica los que recibe, porque son los del
 * store y los comparten todas las pantallas.
 */
export function insumosEnSalon<T extends ConStock>(
  insumos: T[],
  stock: StockPorSalon,
  salon: string | null | undefined,
): T[] {
  if (!salon) return insumos
  return insumos.map((insumo) => {
    const enSalon = stock.get(insumo.id)?.find((c) => c.salon === salon)
    return { ...insumo, stockActual: enSalon ? enSalon.cantidad : 0 }
  })
}

/**
 * Cuánto hay de ese insumo en los OTROS salones. Sirve para que quien compra
 * vea "faltan 50, pero hay 222 en Casona" y decida si los trae en vez de
 * comprarlos. Sin salón devuelve todo lo contado.
 */
export function hayEnOtrosSalones(
  stock: StockPorSalon,
  insumoId: string,
  salon: string | null | undefined,
): { total: number; detalle: ConteoSalon[] } {
  const detalle = (stock.get(insumoId) || []).filter((c) => c.salon !== salon && c.cantidad > 0)
  return { total: detalle.reduce((s, c) => s + c.cantidad, 0), detalle }
}

/**
 * ¿Este salón no cargó todavía ningún conteo? Mientras sea así, TODAS sus
 * listas de compras van a pedir todo de cero, que es correcto pero sorprende.
 * Las pantallas lo avisan en vez de dejar que parezca un error.
 */
export function salonSinConteos(stock: StockPorSalon, salon: string | null | undefined): boolean {
  if (!salon) return false
  for (const conteos of stock.values()) {
    if (conteos.some((c) => c.salon === salon)) return false
  }
  return true
}

/**
 * Arma el mapa desde lo que devuelve /api/stock-salones/por-insumo, que trae
 * un `detalle` por insumo con más datos (quién cargó, cuándo) de los que hacen
 * falta acá.
 */
export function mapaDesdeResumen(
  insumos: Array<{ insumoId: string; detalle: Array<{ salon: string; cantidad: number }> }>,
): StockPorSalon {
  return new Map(
    insumos.map((i) => [i.insumoId, i.detalle.map((d) => ({ salon: d.salon, cantidad: d.cantidad }))]),
  )
}

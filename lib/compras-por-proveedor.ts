// Compras de cocina agrupadas por proveedor, para el filtro "Proveedor" de
// "Por pagar" en Caja Eventos. A veces se compra por proveedor (primero toda
// la carne de todos los eventos) en vez de por evento: esto suma, de los
// menús que se ven en la lista, lo que hay que comprarle a uno.
//
// Las cantidades y los costos son los mismos que forman el monto del menú en
// Caja Eventos (calcularComprasSegmentadas: precio de hoy del Almacén y
// cantidad necesaria, sin descontar stock). No cambia ningún monto.
//
// El proveedor es el texto libre del insumo en el Almacén. Se agrupa sin
// mirar mayúsculas, tildes ni espacios de más ("Grido", "grido" y "GRido"
// son el mismo); dos nombres distintos ("SANTI AMARENA" y "Santiago Amarena")
// siguen siendo dos.

/** Clave del grupo de los insumos sin proveedor cargado. */
export const SIN_PROVEEDOR = "__sin_proveedor__"

/** Lo mínimo de una compra de cocina que hace falta (CalculoCompraSegmentado). */
export interface CompraInsumo {
  insumoId: string
  insumo: { descripcion: string; unidad: string; proveedor?: string }
  cantidadNecesaria: number
  costoMateriaPrima: number
}

export function claveProveedor(proveedor: string | undefined | null): string {
  const limpio = (proveedor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
  return limpio || SIN_PROVEEDOR
}

/** Claves de los proveedores que aparecen en las compras de un menú. */
export function proveedoresDeCompras(compras: CompraInsumo[]): Set<string> {
  const s = new Set<string>()
  for (const c of compras) if (c.cantidadNecesaria > 0) s.add(claveProveedor(c.insumo.proveedor))
  return s
}

/**
 * Nombre a mostrar de cada proveedor: la forma escrita que más se repite
 * entre los insumos.
 */
export function etiquetasProveedores(insumos: { proveedor?: string }[]): Map<string, string> {
  const conteo = new Map<string, Map<string, number>>()
  for (const i of insumos) {
    const clave = claveProveedor(i.proveedor)
    if (clave === SIN_PROVEEDOR) continue
    const forma = (i.proveedor ?? "").replace(/\s+/g, " ").trim()
    const formas = conteo.get(clave) ?? new Map<string, number>()
    formas.set(forma, (formas.get(forma) ?? 0) + 1)
    conteo.set(clave, formas)
  }
  const etiquetas = new Map<string, string>()
  for (const [clave, formas] of conteo) {
    // A igualdad, la que tiene más mayúsculas ("Grido" antes que "grido").
    const [mejor] = [...formas.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    etiquetas.set(clave, mejor[0])
  }
  etiquetas.set(SIN_PROVEEDOR, "Sin proveedor")
  return etiquetas
}

export interface InsumoAComprar {
  insumoId: string
  descripcion: string
  unidad: string
  cantidad: number
  costo: number
  /** En cuántos de los eventos sumados aparece. */
  eventos: number
}

export interface MenuEvento {
  eventoId: string
  eventoNombre: string
  eventoFecha?: string
  compras: CompraInsumo[]
}

export interface ComprasDeProveedor {
  insumos: InsumoAComprar[]
  porEvento: { eventoId: string; eventoNombre: string; eventoFecha?: string; costo: number }[]
  total: number
}

const redondear = (n: number) => Math.round(n * 100) / 100

/**
 * Suma, entre los menús dados, lo que hay que comprarle a un proveedor:
 * cada insumo una sola vez con la cantidad y el costo de todos los eventos,
 * y cuánto le toca a cada evento. Los eventos sin nada de ese proveedor no
 * aparecen en `porEvento`.
 */
export function comprasDeProveedor(menus: MenuEvento[], clave: string): ComprasDeProveedor {
  const insumos = new Map<string, InsumoAComprar>()
  const porEvento: ComprasDeProveedor["porEvento"] = []
  for (const m of menus) {
    let costoEvento = 0
    let tiene = false
    for (const c of m.compras) {
      if (c.cantidadNecesaria <= 0 || claveProveedor(c.insumo.proveedor) !== clave) continue
      tiene = true
      costoEvento += c.costoMateriaPrima
      const prev = insumos.get(c.insumoId)
      if (prev) {
        prev.cantidad += c.cantidadNecesaria
        prev.costo += c.costoMateriaPrima
        prev.eventos += 1
      } else {
        insumos.set(c.insumoId, {
          insumoId: c.insumoId,
          descripcion: c.insumo.descripcion,
          unidad: c.insumo.unidad,
          cantidad: c.cantidadNecesaria,
          costo: c.costoMateriaPrima,
          eventos: 1,
        })
      }
    }
    if (tiene) porEvento.push({ eventoId: m.eventoId, eventoNombre: m.eventoNombre, eventoFecha: m.eventoFecha, costo: redondear(costoEvento) })
  }
  const lista = [...insumos.values()]
    .map((i) => ({ ...i, cantidad: redondear(i.cantidad), costo: redondear(i.costo) }))
    .sort((a, b) => b.costo - a.costo || a.descripcion.localeCompare(b.descripcion, "es"))
  return { insumos: lista, porEvento, total: redondear(lista.reduce((s, i) => s + i.costo, 0)) }
}

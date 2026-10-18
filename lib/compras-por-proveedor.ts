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

export interface InsumoDeEvento {
  insumoId: string
  descripcion: string
  unidad: string
  cantidad: number
  costo: number
}

export interface CompraDeEvento {
  eventoId: string
  eventoNombre: string
  eventoFecha?: string
  /** Costo de hoy de lo de este proveedor en el menú del evento. */
  costo: number
  insumos: InsumoDeEvento[]
  // Pagos a este proveedor en este evento (lib/pago-menu-proveedor.ts), como
  // la seña y el saldo de un servicio: una parte a cuenta y después el resto.
  /** Lo que se le dio a cuenta. */
  aCuenta: number
  fechaACuenta?: string
  /** Ya se le pagó el resto (o todo de una vez). */
  saldado: boolean
  /** Fecha del último pago. */
  fechaPago?: string
  /** Todo lo que se le pagó. */
  pagado: number
  /** Lo que falta pagarle: costo de hoy menos lo dado a cuenta (0 si está saldado). */
  resta: number
}

/** Pagos a un proveedor en un evento (PagoProveedorMenu de lib/pago-menu-proveedor.ts). */
export interface PagoDeEvento {
  monto: number
  aCuenta: number
  fecha: string
  fechaACuenta?: string
  saldado: boolean
}

export interface ComprasDeProveedor {
  /** Lo que falta comprar: insumos sumados de los eventos sin ningún pago. */
  insumos: InsumoAComprar[]
  porEvento: CompraDeEvento[]
  /** Lo que falta pagarle, sumando lo que resta de cada evento. */
  total: number
  /** Lo que ya se le pagó, en los eventos de la lista. */
  pagado: number
}

const redondear = (n: number) => Math.round(n * 100) / 100

/**
 * Suma, entre los menús dados, lo que hay que comprarle a un proveedor:
 * cada insumo una sola vez con la cantidad y el costo de todos los eventos
 * en los que todavía no se le pagó nada, y el detalle de cada evento (con sus
 * cantidades, lo pagado y lo que resta). Los eventos sin nada de ese
 * proveedor no aparecen. `pagoDe` da los pagos a ese proveedor en un evento.
 */
export function comprasDeProveedor(
  menus: MenuEvento[],
  clave: string,
  pagoDe?: (eventoId: string) => PagoDeEvento | undefined,
): ComprasDeProveedor {
  const insumos = new Map<string, InsumoAComprar>()
  const porEvento: CompraDeEvento[] = []
  let pagado = 0
  let falta = 0
  for (const m of menus) {
    const deEvento = new Map<string, InsumoDeEvento>()
    for (const c of m.compras) {
      if (c.cantidadNecesaria <= 0 || claveProveedor(c.insumo.proveedor) !== clave) continue
      const prev = deEvento.get(c.insumoId)
      if (prev) {
        prev.cantidad += c.cantidadNecesaria
        prev.costo += c.costoMateriaPrima
      } else {
        deEvento.set(c.insumoId, {
          insumoId: c.insumoId,
          descripcion: c.insumo.descripcion,
          unidad: c.insumo.unidad,
          cantidad: c.cantidadNecesaria,
          costo: c.costoMateriaPrima,
        })
      }
    }
    if (deEvento.size === 0) continue
    const pago = pagoDe?.(m.eventoId)
    const lista = [...deEvento.values()]
      .map((i) => ({ ...i, cantidad: redondear(i.cantidad), costo: redondear(i.costo) }))
      .sort((a, b) => b.costo - a.costo || a.descripcion.localeCompare(b.descripcion, "es"))
    const costo = redondear(lista.reduce((s, i) => s + i.costo, 0))
    const aCuenta = redondear(pago?.aCuenta ?? 0)
    const saldado = pago?.saldado === true
    // Misma cuenta que restaProveedor (lib/pago-menu-proveedor.ts).
    const resta = saldado ? 0 : Math.max(0, redondear(costo - aCuenta))
    porEvento.push({
      eventoId: m.eventoId,
      eventoNombre: m.eventoNombre,
      eventoFecha: m.eventoFecha,
      costo,
      insumos: lista,
      aCuenta,
      ...(pago?.fechaACuenta ? { fechaACuenta: pago.fechaACuenta } : {}),
      saldado,
      ...(pago?.fecha ? { fechaPago: pago.fecha } : {}),
      pagado: redondear(pago?.monto ?? 0),
      resta,
    })
    falta += resta
    if (pago && pago.monto > 0) {
      pagado += pago.monto
      continue
    }
    for (const i of deEvento.values()) {
      const prev = insumos.get(i.insumoId)
      if (prev) {
        prev.cantidad += i.cantidad
        prev.costo += i.costo
        prev.eventos += 1
      } else {
        insumos.set(i.insumoId, { ...i, eventos: 1 })
      }
    }
  }
  const lista = [...insumos.values()]
    .map((i) => ({ ...i, cantidad: redondear(i.cantidad), costo: redondear(i.costo) }))
    .sort((a, b) => b.costo - a.costo || a.descripcion.localeCompare(b.descripcion, "es"))
  return { insumos: lista, porEvento, total: redondear(falta), pagado: redondear(pagado) }
}

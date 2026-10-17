// Pago del menú de un evento por proveedor (Caja Eventos → Por pagar → Menú →
// Proveedor). Antes el menú se pagaba solo entero; ahora también se puede
// pagar la parte de un proveedor (lo que lleva el menú de sus insumos).
//
// Cada pago deja un egreso en Caja Eventos con:
//   - concepto "Pago menú (Grido) - <evento>": empieza con "Pago menú", así el
//     historial lo reconoce como pago de menú (y revertirlo desmarca el menú),
//     pero NO con "Pago menú - ", que es el pago del menú entero
//     (prefijoPagoMenu en lib/egresos-evento.ts).
//   - refId "menuprov:<evento>:<proveedor>" (claveProveedor), para saber qué
//     proveedor de qué evento quedó pago sin depender del nombre.
//
// Lo pagado queda fijo (el monto del egreso); lo que falta es el costo de hoy
// de los proveedores sin pagar. Con todos los proveedores pagos, el menú queda
// pagado (cocinaPagada), igual que si se hubiera pagado entero.
//
// Sin imports de la app a propósito: lo usan lib/store.ts y lib/costo-evento.ts.

import { claveProveedor } from "./compras-por-proveedor"

const PREFIJO_REF = "menuprov:"

export function refPagoMenuProveedor(eventoId: string, clave: string): string {
  return `${PREFIJO_REF}${eventoId}:${clave}`
}

export function conceptoPagoMenuProveedor(proveedor: string, eventoNombre: string): string {
  return `Pago menú (${proveedor}) - ${eventoNombre}`
}

interface MovimientoPago {
  id: string
  tipo: string
  monto: number
  fecha: string
  eventoId?: string
  cajaDestino?: string
  refId?: string | null
}

export interface PagoProveedorMenu {
  movimientoId: string
  monto: number
  fecha: string
}

/** Pagos por proveedor del menú de un evento: clave del proveedor → pago. */
export function pagosMenuProveedor(
  movimientos: MovimientoPago[] | undefined | null,
  eventoId: string,
): Map<string, PagoProveedorMenu> {
  const pagos = new Map<string, PagoProveedorMenu>()
  const prefijo = `${PREFIJO_REF}${eventoId}:`
  for (const m of movimientos ?? []) {
    if (m.tipo !== "egreso" || m.cajaDestino !== "caja_eventos" || m.eventoId !== eventoId) continue
    if (!m.refId || !m.refId.startsWith(prefijo)) continue
    const clave = m.refId.slice(prefijo.length)
    const previo = pagos.get(clave)
    // Si por algo hubiera dos, cuentan los dos (la plata salió dos veces).
    pagos.set(clave, {
      movimientoId: previo?.movimientoId ?? m.id,
      monto: (previo?.monto ?? 0) + m.monto,
      fecha: previo && previo.fecha > m.fecha ? previo.fecha : m.fecha,
    })
  }
  return pagos
}

export function totalPagosMenuProveedor(pagos: Map<string, PagoProveedorMenu>): number {
  let total = 0
  for (const p of pagos.values()) total += p.monto
  return Math.round(total * 100) / 100
}

interface CompraCosto {
  insumo: { proveedor?: string }
  cantidadNecesaria: number
  costoMateriaPrima: number
}

/**
 * Lo que falta pagar del menú: el costo de hoy de los insumos cuyos
 * proveedores todavía no se pagaron en este evento.
 */
export function pendienteMenuSinProveedoresPagos(compras: CompraCosto[], pagos: Map<string, PagoProveedorMenu>): number {
  let total = 0
  for (const c of compras) {
    if (pagos.has(claveProveedor(c.insumo.proveedor))) continue
    total += c.costoMateriaPrima
  }
  return total
}

/** Proveedores del menú (con algo que comprar) que todavía no se pagaron. */
export function proveedoresSinPagar(compras: CompraCosto[], pagos: Map<string, PagoProveedorMenu>): string[] {
  const faltan = new Set<string>()
  for (const c of compras) {
    if (c.cantidadNecesaria <= 0 || c.costoMateriaPrima <= 0) continue
    const clave = claveProveedor(c.insumo.proveedor)
    if (!pagos.has(clave)) faltan.add(clave)
  }
  return [...faltan]
}

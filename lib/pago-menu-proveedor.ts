// Pago del menú de un evento por proveedor (Caja Eventos → Por pagar → Menú →
// Proveedor). Antes el menú se pagaba solo entero; ahora también se puede
// pagar la parte de un proveedor (lo que lleva el menú de sus insumos).
//
// Como la seña y el saldo de un servicio, a cada proveedor se le puede pagar
// una parte "a cuenta" (lo que se le dio ese día, el resto queda fiado) y
// después el resto. Cada pago deja un egreso en Caja Eventos con:
//   - concepto "Pago menú (Grido) - <evento>" (resto o todo) o
//     "Pago menú (Grido) a cuenta - <evento>": empieza con "Pago menú", así el
//     historial lo reconoce como pago de menú (y revertirlo desmarca el menú),
//     pero NO con "Pago menú - ", que es el pago del menú entero
//     (prefijoPagoMenu en lib/egresos-evento.ts).
//   - refId "menuprov:<evento>:<proveedor>" (resto o todo: el proveedor queda
//     saldado) o "menuprovcuenta:<evento>:<proveedor>" (a cuenta), con la
//     clave del proveedor (claveProveedor), para no depender del nombre.
//
// Lo pagado queda fijo (el monto de los egresos). Lo que falta de un
// proveedor es su costo de hoy menos lo que se le dio a cuenta; saldado, nada.
// Con todos los proveedores saldados, el menú queda pagado (cocinaPagada),
// igual que si se hubiera pagado entero.
//
// Sin imports de la app a propósito: lo usan lib/store.ts y lib/costo-evento.ts.

import { claveProveedor } from "./compras-por-proveedor"

const PREFIJO_REF = "menuprov:"
const PREFIJO_REF_CUENTA = "menuprovcuenta:"

/** refId del pago que salda al proveedor (el resto, o todo de una vez). */
export function refPagoMenuProveedor(eventoId: string, clave: string): string {
  return `${PREFIJO_REF}${eventoId}:${clave}`
}

/** refId de un pago a cuenta: el proveedor queda debiendo el resto. */
export function refPagoMenuProveedorACuenta(eventoId: string, clave: string): string {
  return `${PREFIJO_REF_CUENTA}${eventoId}:${clave}`
}

export function conceptoPagoMenuProveedor(proveedor: string, eventoNombre: string, aCuenta = false): string {
  return `Pago menú (${proveedor})${aCuenta ? " a cuenta" : ""} - ${eventoNombre}`
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
  /** Todo lo que se le pagó (a cuenta + resto). */
  monto: number
  /** Lo que se le dio a cuenta. */
  aCuenta: number
  /** Fecha del último pago. */
  fecha: string
  /** Fecha del último pago a cuenta. */
  fechaACuenta?: string
  /** Ya se le pagó el resto (o todo): no se le debe nada de este evento. */
  saldado: boolean
}

/** Pagos por proveedor del menú de un evento: clave del proveedor → pago. */
export function pagosMenuProveedor(
  movimientos: MovimientoPago[] | undefined | null,
  eventoId: string,
): Map<string, PagoProveedorMenu> {
  const pagos = new Map<string, PagoProveedorMenu>()
  const prefijoSaldo = `${PREFIJO_REF}${eventoId}:`
  const prefijoCuenta = `${PREFIJO_REF_CUENTA}${eventoId}:`
  for (const m of movimientos ?? []) {
    if (m.tipo !== "egreso" || m.cajaDestino !== "caja_eventos" || m.eventoId !== eventoId || !m.refId) continue
    const aCuenta = m.refId.startsWith(prefijoCuenta)
    if (!aCuenta && !m.refId.startsWith(prefijoSaldo)) continue
    const clave = m.refId.slice((aCuenta ? prefijoCuenta : prefijoSaldo).length)
    const previo = pagos.get(clave) ?? { monto: 0, aCuenta: 0, fecha: "", saldado: false }
    // Si hubiera varios, cuentan todos (la plata salió cada vez).
    pagos.set(clave, {
      monto: previo.monto + m.monto,
      aCuenta: previo.aCuenta + (aCuenta ? m.monto : 0),
      fecha: previo.fecha > m.fecha ? previo.fecha : m.fecha,
      fechaACuenta: aCuenta && (!previo.fechaACuenta || m.fecha > previo.fechaACuenta) ? m.fecha : previo.fechaACuenta,
      saldado: previo.saldado || !aCuenta,
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

/** Costo de hoy del menú de un evento, por proveedor. */
export function costoMenuPorProveedor(compras: CompraCosto[]): Map<string, number> {
  const costos = new Map<string, number>()
  for (const c of compras) {
    if (c.cantidadNecesaria <= 0) continue
    const clave = claveProveedor(c.insumo.proveedor)
    costos.set(clave, (costos.get(clave) ?? 0) + c.costoMateriaPrima)
  }
  return costos
}

/** Lo que falta pagarle a un proveedor: su costo de hoy menos lo dado a cuenta. */
export function restaProveedor(costo: number, pago: PagoProveedorMenu | undefined): number {
  if (pago?.saldado) return 0
  return Math.max(0, Math.round((costo - (pago?.aCuenta ?? 0)) * 100) / 100)
}

/**
 * Lo que falta pagar del menú: por cada proveedor sin saldar, su costo de
 * hoy menos lo que se le dio a cuenta.
 */
export function pendienteMenuSinProveedoresPagos(compras: CompraCosto[], pagos: Map<string, PagoProveedorMenu>): number {
  let total = 0
  for (const [clave, costo] of costoMenuPorProveedor(compras)) total += restaProveedor(costo, pagos.get(clave))
  return total
}

/** Proveedores del menú (con algo que comprar) que todavía no están saldados. */
export function proveedoresSinPagar(compras: CompraCosto[], pagos: Map<string, PagoProveedorMenu>): string[] {
  const faltan: string[] = []
  for (const [clave, costo] of costoMenuPorProveedor(compras)) {
    if (costo > 0 && !pagos.get(clave)?.saldado) faltan.push(clave)
  }
  return faltan
}

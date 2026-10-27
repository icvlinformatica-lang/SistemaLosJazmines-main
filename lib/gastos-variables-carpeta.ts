/**
 * Cómo se ordena una carpeta de gastos variables de Caja Jazmines ("Varios" y
 * las creadas al agendar). Pedido de Rodrigo (26/10/2026): "es muy difícil
 * verlos". Antes era una lista plana, por vencimiento, con lo pagado y lo
 * pendiente mezclados y cortada a los 5 primeros.
 *
 * Ahora:
 * - Arriba, "Sin pagar": lo pendiente y lo vencido, del vencimiento más
 *   cercano al más lejano.
 * - Abajo, lo pagado agrupado por mes, del más reciente al más viejo. El mes
 *   es el de la fecha en que se hizo el gasto; si no la tiene, el del
 *   vencimiento. Sin ninguna de las dos va al final, en "Sin fecha".
 *
 * Es solo para mostrar: no cambia montos, estados ni lo que se guarda.
 */

export interface GastoVariableCarpeta {
  id: string
  monto: number
  estado: "pendiente" | "pagado" | "vencido"
  /** Vencimiento (YYYY-MM-DD) */
  fecha: string
  /** Fecha en que se hizo el gasto (YYYY-MM-DD) */
  fechaGasto?: string
}

export interface MesDeGastos<T> {
  /** "YYYY-MM", o "" para los que no tienen fecha. */
  mes: string
  items: T[]
  subtotal: number
}

export interface CarpetaOrdenada<T> {
  sinPagar: T[]
  subtotalSinPagar: number
  pagadosPorMes: MesDeGastos<T>[]
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

/** "2026-03" → "Marzo 2026"; "" → "Sin fecha". */
export function nombreMesGasto(mes: string): string {
  const [y, m] = mes.split("-").map(Number)
  if (!y || !m || m < 1 || m > 12) return "Sin fecha"
  return `${MESES[m - 1]} ${y}`
}

/** Fecha que manda para ubicar un gasto: la del gasto o, si falta, el vencimiento. */
export function fechaDelGasto(g: Pick<GastoVariableCarpeta, "fecha" | "fechaGasto">): string {
  return g.fechaGasto || g.fecha || ""
}

const sumar = (items: { monto: number }[]) => Math.round(items.reduce((s, g) => s + g.monto, 0) * 100) / 100

export function ordenarCarpetaVariables<T extends GastoVariableCarpeta>(items: T[]): CarpetaOrdenada<T> {
  const sinPagar = items
    .filter((g) => g.estado !== "pagado")
    // Sin vencimiento, al final.
    .sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"))

  const porMes = new Map<string, T[]>()
  for (const g of items) {
    if (g.estado !== "pagado") continue
    const mes = fechaDelGasto(g).slice(0, 7)
    const clave = /^\d{4}-\d{2}$/.test(mes) ? mes : ""
    porMes.set(clave, [...(porMes.get(clave) || []), g])
  }
  const pagadosPorMes = [...porMes.entries()]
    // Más reciente primero; "Sin fecha" al final.
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : b.localeCompare(a)))
    .map(([mes, lista]) => {
      const ordenados = [...lista].sort((a, b) => fechaDelGasto(b).localeCompare(fechaDelGasto(a)))
      return { mes, items: ordenados, subtotal: sumar(ordenados) }
    })

  return { sinPagar, subtotalSinPagar: sumar(sinPagar), pagadosPorMes }
}

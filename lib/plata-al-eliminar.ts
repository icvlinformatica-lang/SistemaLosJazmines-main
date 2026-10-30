// Qué pasa con la plata de un evento cuando se lo elimina. Pedido del dueño
// el 30/10/2026: antes, al eliminar, todo lo cobrado (y lo pagado a
// proveedores) dejaba de verse en las cajas y en los resúmenes, como si nunca
// hubiera pasado, y los saldos daban de menos.
//
// Ahora los movimientos del evento se DESVINCULAN (quedan sin evento y con
// " (evento eliminado)" al final del concepto), así siguen contando en su
// caja. Además, quien elimina elige si al cliente se le devuelve algo: nada,
// todo lo cobrado o una parte. La devolución es un egreso por caja y salón,
// en la misma proporción en que entró la plata. Restaurar el evento vuelve a
// vincular sus movimientos; las devoluciones quedan, porque esa plata salió.
// Sin "use client" ni imports de servidor: lo usan la pantalla, el store y la ruta.

export const SUFIJO_EVENTO_ELIMINADO = " (evento eliminado)"

/** Clave del JSON de la papelera donde queda qué se desvinculó y qué se devolvió. */
export const CLAVE_PLATA_AL_ELIMINAR = "_plataAlEliminar"

export interface MovimientoParaEliminar {
  id: string
  tipo: string
  monto: number
  salon: string | null
  cajaDestino: string | null
}

export interface DevolucionCaja {
  salon: string | null
  cajaDestino: string | null
  monto: number
}

const redondear = (n: number) => Math.round(n * 100) / 100

/** Lo que el cliente pagó: los ingresos del evento (cuotas y seña), en pesos con centavos. */
export function cobradoDelEvento(movimientos: Pick<MovimientoParaEliminar, "tipo" | "monto">[]): number {
  return redondear(movimientos.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + (Number(m.monto) || 0), 0))
}

/** ref_id de los egresos de devolución de un evento. */
export function refDevolucion(eventoId: string): string {
  return `devolucion:${eventoId}`
}

/**
 * Lo que todavía se le puede devolver al cliente: lo cobrado menos lo que ya
 * se le devolvió en una eliminación anterior (si el evento se eliminó, se
 * restauró y se vuelve a eliminar).
 */
export function cobradoDisponible(
  movimientosDelEvento: Pick<MovimientoParaEliminar, "tipo" | "monto">[],
  devolucionesPrevias: Pick<MovimientoParaEliminar, "monto">[],
): number {
  const devuelto = devolucionesPrevias.reduce((s, m) => s + (Number(m.monto) || 0), 0)
  return Math.max(0, redondear(cobradoDelEvento(movimientosDelEvento) - devuelto))
}

/** Lo mismo, desde los movimientos de caja del store (la pantalla). */
export function cobradoDisponibleEnCaja(
  movimientos: { eventoId?: string; refId?: string; tipo: string; monto: number }[],
  eventoId: string,
): number {
  return cobradoDisponible(
    movimientos.filter((m) => m.eventoId === eventoId),
    movimientos.filter((m) => m.refId === refDevolucion(eventoId)),
  )
}

/**
 * null si se puede devolver ese monto; si no, el porqué. Se devuelve como
 * máximo lo cobrado (con la tolerancia de centavos del resto del código).
 */
export function validarDevolucion(monto: number, cobrado: number): string | null {
  if (!Number.isFinite(monto) || monto < 0) return "El monto a devolver no es válido."
  if (monto > cobrado + 0.005) return "No se puede devolver más de lo que se cobró."
  return null
}

/**
 * Reparte lo que se devuelve entre cada caja y salón en la misma proporción
 * en que entraron los ingresos. Lo que sobra del redondeo va al grupo más
 * grande, así la suma da exacto el monto.
 */
export function repartirDevolucion(movimientos: MovimientoParaEliminar[], monto: number): DevolucionCaja[] {
  const total = redondear(monto)
  if (total <= 0) return []
  const grupos = new Map<string, DevolucionCaja>()
  for (const m of movimientos) {
    if (m.tipo !== "ingreso") continue
    const clave = `${m.cajaDestino ?? ""}|${m.salon ?? ""}`
    const previo = grupos.get(clave) ?? { salon: m.salon, cajaDestino: m.cajaDestino, monto: 0 }
    previo.monto += Number(m.monto) || 0
    grupos.set(clave, previo)
  }
  const lista = [...grupos.values()].filter((g) => g.monto > 0)
  const cobrado = lista.reduce((s, g) => s + g.monto, 0)
  if (cobrado <= 0) return []
  const partes = lista.map((g) => ({ ...g, monto: redondear((g.monto / cobrado) * total) }))
  const diferencia = redondear(total - partes.reduce((s, p) => s + p.monto, 0))
  if (diferencia !== 0) {
    const mayor = partes.reduce((a, b) => (b.monto > a.monto ? b : a))
    mayor.monto = redondear(mayor.monto + diferencia)
  }
  return partes.filter((p) => p.monto > 0)
}

export function conceptoDesvinculado(concepto: string | null | undefined): string {
  const c = concepto ?? ""
  return c.endsWith(SUFIJO_EVENTO_ELIMINADO) ? c : c + SUFIJO_EVENTO_ELIMINADO
}

export function conceptoRestaurado(concepto: string | null | undefined): string {
  const c = concepto ?? ""
  return c.endsWith(SUFIJO_EVENTO_ELIMINADO) ? c.slice(0, -SUFIJO_EVENTO_ELIMINADO.length) : c
}

export function conceptoDevolucion(nombreEvento: string): string {
  return `Devolución por evento eliminado - ${nombreEvento}`
}

export type OpcionPlataAlEliminar = "queda" | "todo" | "parte"

/** Cuánto se devuelve según lo que se eligió en la ventana de eliminar. */
export function montoADevolver(opcion: OpcionPlataAlEliminar, parte: number, cobrado: number): number {
  if (opcion === "todo") return redondear(cobrado)
  if (opcion === "parte") return redondear(Number(parte) || 0)
  return 0
}

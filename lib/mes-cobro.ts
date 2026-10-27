// En qué mes cuenta una cuota en la proyección de Caja Eventos (pedido del
// dueño, 27/10/2026: "si me pagan en septiembre una cuota de agosto, que
// figure que entró en septiembre").
// - Lo que falta cobrar cuenta en el mes en que vence, salvo que ya esté
//   vencida: una cuota atrasada se sigue esperando, así que suma al mes
//   actual (antes quedaba en un mes pasado y no aparecía en ningún total).
// - Lo que ya entró cuenta en el mes en que entró la plata (la fecha del
//   movimiento de caja), no en el mes en que vencía la cuota.
// Solo cambia en qué mes se muestra cada monto: no cambia ningún monto.

/** "YYYY-MM" de una fecha "YYYY-MM-DD" (o "" si no hay). */
export const mesDeFecha = (fecha: string | undefined): string => (fecha || "").slice(0, 7)

/** Mes en que se espera cobrar una cuota pendiente: el de su vencimiento, o el actual si ya venció antes. */
export function mesEsperadoCobro(fechaVencimiento: string | undefined, mesActual: string): string {
  const mes = mesDeFecha(fechaVencimiento)
  return mes && mes < mesActual ? mesActual : mes
}

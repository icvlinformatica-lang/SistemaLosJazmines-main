// Pagar el menú o la barra de un evento ya finalizado (pedido de Rodrigo,
// 3/11/2026: "que se descuenten de la caja los costos de los eventos
// finalizados"). Antes, Costos del evento no dejaba tildar nada con el evento
// en Finalizados y esa plata seguía figurando en el saldo de Caja Eventos.
//
// Se hace A MANO, viendo el monto antes de confirmar: la foto de costos que se
// guarda al finalizar puede estar mal (en la Casona hay fotos infladas por el
// error de unidades del Daiquiri), así que el monto se puede corregir.
//
// Al pagar se anota el egreso de siempre en Caja Eventos ("Pago menú - …" /
// "Pago barra - …") y lo pagado queda en la foto (`montoPagadoCocina` /
// `montoPagadoBarra`), que es lo que Costos del evento usa como costo de un
// evento finalizado ya pagado. Revertir saca las dos cosas.

export type RubroFinalizado = "cocina" | "barra"

const redondear = (n: number) => Math.round(n * 100) / 100

/**
 * Monto que se propone pagar: el costo guardado en la foto menos lo que ya se
 * le dio a proveedores a cuenta (solo menú). Nunca negativo.
 */
export function montoSugeridoFinalizado(costoFoto: number, pagadoAntes = 0): number {
  const costo = Number.isFinite(costoFoto) ? costoFoto : 0
  const antes = Number.isFinite(pagadoAntes) ? pagadoAntes : 0
  return redondear(Math.max(0, costo - antes))
}

/** Un monto a pagar sirve si es un número mayor a cero. */
export function montoPagoFinalizadoValido(monto: number): boolean {
  return Number.isFinite(monto) && monto > 0.005
}

const CLAVE: Record<RubroFinalizado, "montoPagadoCocina" | "montoPagadoBarra"> = {
  cocina: "montoPagadoCocina",
  barra: "montoPagadoBarra",
}

/**
 * Devuelve `costosCalculados` con lo pagado anotado en la foto del evento
 * finalizado (`montoPagado` = total pagado del rubro) o, con null, sin él.
 * No toca nada más de la foto. Sin foto, no cambia nada.
 */
export function costosConPagoFinalizado<T extends Record<string, unknown>>(
  costosCalculados: T | null | undefined,
  rubro: RubroFinalizado,
  montoPagado: number | null,
): T | null | undefined {
  const foto = costosCalculados?.archivoCongelado as Record<string, unknown> | undefined
  if (!costosCalculados || !foto) return costosCalculados
  const { [CLAVE[rubro]]: _anterior, ...resto } = foto
  const nuevaFoto = montoPagado === null ? resto : { ...resto, [CLAVE[rubro]]: redondear(montoPagado) }
  return { ...costosCalculados, archivoCongelado: nuevaFoto }
}

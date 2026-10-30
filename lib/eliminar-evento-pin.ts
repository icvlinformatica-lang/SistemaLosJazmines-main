// Borrar un evento desde su Perfil (Cobrar cuota) con el PIN de
// Administración. Pedido del dueño el 30/10/2026. Sin imports de servidor:
// lo usan la pantalla, el store y la ruta.

/** Encabezado donde viaja el PIN al borrar (no en la dirección, para que no quede en los logs). */
export const HEADER_PIN_ELIMINAR_EVENTO = "x-lj-pin-administracion"

/**
 * Por qué no se puede borrar desde el Perfil del evento, o null si se puede.
 * Un evento con el stock descontado se borra desde la Lista, que ofrece
 * devolver la mercadería al salón (la misma regla del aviso de la semana).
 */
export function motivoNoEliminarDesdePerfil(evento: { stockDescontado?: boolean }): string | null {
  if (evento.stockDescontado) {
    return "Tiene el stock descontado: eliminalo desde la Lista de eventos, que te deja devolver la mercadería al salón."
  }
  return null
}

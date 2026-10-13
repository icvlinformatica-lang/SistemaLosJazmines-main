// Aviso "¿La fecha está bien?" al cargar la fecha de un evento o de una
// cotización. Pedido del dueño (13/10/2026): si el año no está entre 2026 y
// 2032, consultar en el momento, porque casi siempre es un error de tipeo
// ("0027", "2062"...). Solo pantalla: la regla que de verdad frena el guardado
// sigue siendo validarAnioEvento en el servidor (lib/validacion-anio-evento.ts).
import { ANIO_EVENTO_MAX, ANIO_EVENTO_MIN, extraerAnioFecha, validarAnioEvento } from "./validacion-anio-evento"

/**
 * Texto del aviso, o null si la fecha está bien (o vacía). Si la fecha es la
 * misma que ya tenía guardada el evento, no avisa: así un evento viejo (por
 * ejemplo de 2025) no muestra el cartel cada vez que se lo abre.
 */
export function avisoFechaEvento(fecha: string | null | undefined, fechaGuardada?: string | null): string | null {
  if (!fecha) return null
  if (fechaGuardada && fecha === fechaGuardada) return null
  if (validarAnioEvento(fecha).valido) return null
  const anio = extraerAnioFecha(fecha)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha)
  const legible = m ? `${m[3]}/${m[2]}/${m[1]}` : fecha
  return `Pusiste el ${legible}${anio !== null ? ` (año ${anio})` : ""}. Los eventos van de ${ANIO_EVENTO_MIN} a ${ANIO_EVENTO_MAX}: revisá el año antes de seguir.`
}

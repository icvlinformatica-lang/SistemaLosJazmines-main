// Reglas de pantalla de Eventos → Lista (y del aviso al finalizar). Son
// funciones puras: solo deciden qué se muestra, no tocan datos guardados.
// "hoy" siempre llega desde fechaNegocio() (lib/ipc-cuotas.ts), nunca de
// toISOString(), que desde las 21:00 de Argentina ya da el día siguiente.
import { fechaEventoCorta } from "./fecha-evento"

/** Valor del botón "Ya pasaron" en la fila de estados de la Lista. */
export const FILTRO_YA_PASARON = "ya_pasaron"

type EventoFecha = { estado?: string; fecha?: string }

/**
 * Evento que ya pasó y nadie marcó como finalizado. No se mezclan con los
 * próximos: van aparte en el botón "Ya pasaron", así la lista arranca por
 * lo que viene. El evento de hoy todavía no pasó.
 */
export function esPasadoSinFinalizar(evento: EventoFecha, hoy: string): boolean {
  return evento.estado !== "completado" && !!evento.fecha && evento.fecha < hoy
}

/**
 * Si el evento entra en la Lista con el botón de estado elegido. Los
 * completados nunca (tienen su archivo). "Todos" y cada estado muestran solo
 * de hoy en adelante (y los que no tienen fecha); "Ya pasaron" muestra solo
 * los pasados sin finalizar, sea cual sea su estado.
 */
export function entraEnFiltroDeLista(evento: EventoFecha, filtroEstado: string, hoy: string): boolean {
  if (evento.estado === "completado") return false
  const pasado = esPasadoSinFinalizar(evento, hoy)
  if (filtroEstado === FILTRO_YA_PASARON) return pasado
  if (pasado) return false
  return filtroEstado === "todos" || evento.estado === filtroEstado
}

type EventoBuscable = {
  nombre?: string
  nombrePareja?: string
  dniNovio1?: string
  dniNovio2?: string
  contrato?: { dni?: string; telefono?: string }
}

const soloDigitos = (v?: string) => (v ?? "").replace(/\D/g, "")

/**
 * Búsqueda de la Lista: nombre, nombre de la pareja, DNI (de los dos novios
 * o del contrato, como en Cobrar cuota) y teléfono del contrato. Para DNI y
 * teléfono se comparan solo los dígitos ("12.345.678" = "12345678",
 * "11 4444-5555" = "1144445555"), y hacen falta al menos 3 dígitos y que lo
 * escrito sea un número: si no, buscar "2" traería medio padrón.
 */
export function coincideBusquedaEvento(evento: EventoBuscable, busqueda: string): boolean {
  const term = busqueda.toLowerCase().trim()
  if (!term) return true
  if ((evento.nombre ?? "").toLowerCase().includes(term)) return true
  if ((evento.nombrePareja ?? "").toLowerCase().includes(term)) return true
  const pareceNumero = /^[\d\s.\-+()]+$/.test(term)
  const digitos = soloDigitos(term)
  if (!pareceNumero || digitos.length < 3) return false
  const numeros = [evento.dniNovio1, evento.dniNovio2, evento.contrato?.dni, evento.contrato?.telefono]
  return numeros.some((n) => soloDigitos(n).includes(digitos))
}

/**
 * Aviso al finalizar un evento cuya fecha todavía no llegó. El del día de
 * hoy no avisa: finalizarlo esa misma noche es lo normal.
 */
export function avisoEventoTodaviaNoPaso(fecha: string | undefined, hoy: string): string | null {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha <= hoy) return null
  return `Ojo: este evento es el ${fechaEventoCorta(fecha)}, todavía no pasó.`
}

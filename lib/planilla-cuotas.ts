// Reglas de pantalla de la Planilla de cuotas (Cobrar cuota → /eventos/pagos):
// buscador, filtro "Solo con atrasos" y color de cada cuota. Son funciones
// puras y SOLO VISUALES: no calculan montos ni IPC (los eventos llegan ya
// proyectados) y no guardan nada. "hoy" llega siempre desde fechaNegocio().
import { cuotaAtrasada, estadoPagosEvento } from "./estado-pagos-evento"
import type { EventoGuardado } from "./store"

/** Minúsculas y sin tildes: "Martínez" y "martinez" son lo mismo. */
export function normalizarBusqueda(texto: string | undefined | null): string {
  return (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

const soloDigitos = (v?: string) => (v ?? "").replace(/\D/g, "")

type EventoBuscable = {
  nombre?: string
  nombrePareja?: string
  dniNovio1?: string
  dniNovio2?: string
  contrato?: { nombreCompleto?: string; dni?: string }
}

/**
 * Búsqueda de la planilla: nombre del evento, festejados (nombrePareja),
 * nombre del cliente del contrato y DNI (de los novios o del contrato).
 * El DNI se compara solo por dígitos ("12.345.678" = "12345678") y pide al
 * menos 3, igual que la búsqueda de Eventos → Lista.
 */
export function coincideBusquedaPlanilla(evento: EventoBuscable, busqueda: string): boolean {
  const term = normalizarBusqueda(busqueda)
  if (!term) return true
  const textos = [evento.nombre, evento.nombrePareja, evento.contrato?.nombreCompleto]
  if (textos.some((t) => normalizarBusqueda(t).includes(term))) return true
  const digitos = soloDigitos(term)
  if (!/^[\d\s.\-]+$/.test(term) || digitos.length < 3) return false
  return [evento.dniNovio1, evento.dniNovio2, evento.contrato?.dni].some((d) => soloDigitos(d).includes(digitos))
}

/**
 * "Solo con atrasos": el evento tiene alguna cuota vencida sin cobrar. Es la
 * misma regla de la marca "N cuotas atrasadas" de Eventos → Lista
 * (estadoPagosEvento), así los dos números coinciden.
 */
export function tieneCuotasAtrasadas(evento: EventoGuardado, hoy: string): boolean {
  return estadoPagosEvento(evento, hoy)?.tipo === "atrasado"
}

export type TonoCuota = "pagada" | "atrasada" | "este_mes" | "futura"

/**
 * Color de una cuota en la planilla:
 * - pagada: verde.
 * - atrasada: rojo. Vencida antes de hoy y sin completar (una parcial vencida
 *   también), la misma regla que cuotaAtrasada / estadoPagosEvento.
 * - este_mes: ámbar. Sin completar, vence este mes y todavía no venció (la que
 *   vence hoy también va acá: hoy todavía no está atrasada).
 * - futura: neutra.
 * `pagadas` = numerosPagados(evento).
 */
export function tonoCuota(
  cuota: { numeroCuota: number; fechaVencimiento: string; pagada: boolean; estado?: string },
  pagadas: ReadonlySet<number>,
  hoy: string,
): TonoCuota {
  if (cuota.estado === "pagada" || cuota.pagada || pagadas.has(cuota.numeroCuota)) return "pagada"
  if (cuotaAtrasada(cuota, pagadas, hoy)) return "atrasada"
  if (cuota.fechaVencimiento.slice(0, 7) === hoy.slice(0, 7)) return "este_mes"
  return "futura"
}

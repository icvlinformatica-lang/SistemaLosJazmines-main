// Aviso de los lunes para Administración: recuerda finalizar los eventos del
// finde que pasó, cuenta lo que viene a pagar esta semana y muestra los
// eventos del próximo finde. Aparece una vez por semana y por persona; después
// queda en Novedades, con punto rojo mientras falte finalizar algún evento.
// No acumula: cada semana habla solo del finde anterior a su lunes.
// Funciones puras (sin window) para poder probarlas.

/** Perfiles que reciben el aviso. */
export const PERFILES_AVISO_SEMANAL = ["administracion", "soporte"]

/** Prefijo de la clave de localStorage donde se anota el lunes ya visto. */
export const CLAVE_AVISO_SEMANAL = "lj_aviso_semanal"

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Lunes (YYYY-MM-DD) de la semana de `hoy`. El domingo cierra la semana. */
export function lunesDeLaSemana(hoy: string): string {
  const dia = new Date(`${hoy}T12:00:00Z`).getUTCDay() // 0 = domingo
  return sumarDias(hoy, dia === 0 ? -6 : 1 - dia)
}

/** Viernes a domingo anteriores al lunes de la semana de `hoy`. */
export function findeAnterior(hoy: string): { desde: string; hasta: string } {
  const lunes = lunesDeLaSemana(hoy)
  return { desde: sumarDias(lunes, -3), hasta: sumarDias(lunes, -1) }
}

/** Viernes a domingo de la semana de `hoy`. */
export function proximoFinde(hoy: string): { desde: string; hasta: string } {
  const lunes = lunesDeLaSemana(hoy)
  return { desde: sumarDias(lunes, 4), hasta: sumarDias(lunes, 6) }
}

interface EventoAviso {
  fecha?: string
  estado?: string
}

/**
 * Eventos del finde anterior que todavía no se finalizaron. Los borradores y
 * los cancelados no cuentan: no hay nada que cerrar.
 */
export function eventosParaFinalizar<T extends EventoAviso>(eventos: T[], hoy: string): T[] {
  const { desde, hasta } = findeAnterior(hoy)
  return eventos
    .filter((e) => e.fecha && e.fecha >= desde && e.fecha <= hasta)
    .filter((e) => e.estado !== "completado" && e.estado !== "cancelado" && e.estado !== "borrador")
    .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))
}

/** Eventos del próximo finde, con el mismo criterio que "Este finde". */
export function eventosProximoFinde<T extends EventoAviso>(eventos: T[], hoy: string): T[] {
  const { desde, hasta } = proximoFinde(hoy)
  return eventos
    .filter((e) => e.fecha && e.fecha >= desde && e.fecha <= hasta)
    .filter((e) => e.estado !== "cancelado" && e.estado !== "borrador")
    .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))
}

interface CuotaAviso {
  monto: number
  atrasada: boolean
  ipcPendiente?: string
}

/**
 * Lo que viene a pagar esta semana, con la lista de "Vienen a pagar"
 * (`/api/resumen-diario`). Misma cuenta que el total de la semana de ese
 * modal: las cuotas que vencen de lunes a domingo, sin las atrasadas, que van
 * aparte. Las de IPC sin publicar se cuentan como "a definir".
 */
export function ingresosDeLaSemana(lista: Array<{ cuotasPendientes: CuotaAviso[] }>) {
  let cantidad = 0
  let total = 0
  let aDefinir = 0
  let cantidadAtrasada = 0
  let totalAtrasado = 0
  for (const evento of lista) {
    for (const cuota of evento.cuotasPendientes) {
      if (cuota.atrasada) {
        cantidadAtrasada++
        totalAtrasado += cuota.monto
      } else {
        cantidad++
        total += cuota.monto
        if (cuota.ipcPendiente) aDefinir++
      }
    }
  }
  return { cantidad, total, aDefinir, cantidadAtrasada, totalAtrasado }
}

/** Clave de localStorage: por perfil y, si eligió nombre al entrar, por persona. */
export function claveAvisoVisto(perfilId: string, usuario: string): string {
  return `${CLAVE_AVISO_SEMANAL}_${perfilId}${usuario ? `_${usuario.toLowerCase()}` : ""}`
}

/**
 * Si hay que abrir la ventana: solo a los perfiles del aviso y si esa persona
 * todavía no la vio esta semana. Se guarda el último lunes visto, nada más.
 */
export function debeAbrirAviso(perfilId: string | undefined, lunesVisto: string | null, hoy: string): boolean {
  if (!perfilId || !PERFILES_AVISO_SEMANAL.includes(perfilId)) return false
  return lunesVisto !== lunesDeLaSemana(hoy)
}

/**
 * Si el aviso puede ofrecer "Se suspendió, eliminar". Un evento con el stock
 * ya descontado se manda a la Lista: ahí se elige si se devuelve el stock al
 * borrarlo, y desde el aviso no hay que adivinarlo.
 */
export function puedeEliminarDesdeAviso(evento: { stockDescontado?: boolean }): boolean {
  return !evento.stockDescontado
}

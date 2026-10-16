// Tabla de cantidad de eventos por salón y por mes para el chat con IA
// ("¿cuántos eventos hay hasta fin de año, por salón y mes?"). La arma el
// servidor con los eventos de la base: los números no salen del texto de la
// IA. Se guarda en el mensaje como las tarjetas de eventos ({…, tablas}).
// Solo tipos de chat-ia-datos (que es del servidor): esta tabla la lee también la pantalla.
import type { FilaEventoChat } from "@/lib/chat-ia-datos"

/** Mismo orden que SALONES_CHAT (lib/chat-ia-datos.ts). */
const ORDEN_SALONES = ["Quinta", "Casona", "Salon", "Salon 4", "Salon 5"]

export const MAX_TABLAS_CHAT = 2
const MAX_MESES_TABLA = 13

export interface FilaTablaChat {
  /** Clave del salón ("Salon", "Casona"…): la pantalla muestra su nombre con salonLabel. */
  salon: string
  porMes: number[]
  total: number
}

export interface TablaEventosChat {
  desde: string
  hasta: string
  /** "2026-10", "2026-11"… en orden. */
  meses: string[]
  filas: FilaTablaChat[]
  totalPorMes: number[]
  total: number
  /** Cuántos de esos son borradores (cuentan igual). */
  borradores: number
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

/** "2026-10" → "Octubre 2026" (o "Octubre" si todos los meses son del mismo año). */
export function nombreMes(mes: string, conAnio = true): string {
  const [a, m] = mes.split("-").map(Number)
  const nombre = MESES[(m ?? 1) - 1] ?? mes
  return conAnio ? `${nombre} ${a}` : nombre
}

function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  let [a, m] = desde.slice(0, 7).split("-").map(Number)
  const fin = hasta.slice(0, 7)
  while (out.length < MAX_MESES_TABLA) {
    const mes = `${a}-${String(m).padStart(2, "0")}`
    out.push(mes)
    if (mes >= fin) break
    m += 1
    if (m > 12) {
      m = 1
      a += 1
    }
  }
  return out
}

/** Valida el período: fechas AAAA-MM-DD, en orden y de hasta 13 meses. */
export function periodoTablaValido(desde: string, hasta: string): string | null {
  const ok = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && Number.isFinite(new Date(`${f}T12:00:00Z`).getTime())
  if (!ok(desde) || !ok(hasta)) return "Las fechas van como AAAA-MM-DD."
  if (hasta < desde) return "La fecha de fin es anterior a la de inicio."
  if (mesesEntre(desde, hasta).slice(-1)[0] < hasta.slice(0, 7)) return `Como máximo ${MAX_MESES_TABLA} meses por tabla.`
  return null
}

/**
 * Cuenta los eventos (no borrados) con fecha entre desde y hasta, por salón y
 * por mes. Los salones sin ningún evento en el período no aparecen.
 */
export function tablaEventosPorSalonYMes(
  eventos: FilaEventoChat[],
  { desde, hasta, salon }: { desde: string; hasta: string; salon?: string },
): TablaEventosChat {
  const meses = mesesEntre(desde, hasta)
  const enPeriodo = eventos.filter((e) => {
    const fecha = String(e.fecha ?? "").slice(0, 10)
    return fecha >= desde && fecha <= hasta && (!salon || String(e.salon ?? "") === salon)
  })
  // Primero los salones conocidos, en su orden; después cualquier otro que aparezca.
  const claves = [...ORDEN_SALONES, ...new Set(enPeriodo.map((e) => String(e.salon ?? "")).filter((s) => !ORDEN_SALONES.includes(s)))]
  const filas: FilaTablaChat[] = claves
    .map((clave) => {
      const delSalon = enPeriodo.filter((e) => String(e.salon ?? "") === clave)
      const porMes = meses.map((mes) => delSalon.filter((e) => String(e.fecha ?? "").startsWith(mes)).length)
      return { salon: clave, porMes, total: delSalon.length }
    })
    .filter((f) => f.total > 0)
  return {
    desde,
    hasta,
    meses,
    filas,
    totalPorMes: meses.map((_, i) => filas.reduce((s, f) => s + f.porMes[i], 0)),
    total: enPeriodo.length,
    borradores: enPeriodo.filter((e) => e.estado === "borrador").length,
  }
}

const esNumero = (n: unknown) => typeof n === "number" && Number.isFinite(n)

/** Tablas leídas del historial; descarta lo que no tenga la forma esperada. */
export function tablasValidas(valor: unknown): TablaEventosChat[] {
  if (!Array.isArray(valor)) return []
  return valor
    .filter(
      (t): t is TablaEventosChat =>
        !!t &&
        typeof t === "object" &&
        typeof t.desde === "string" &&
        typeof t.hasta === "string" &&
        Array.isArray(t.meses) &&
        t.meses.every((m: unknown) => typeof m === "string") &&
        Array.isArray(t.filas) &&
        t.filas.every(
          (f: unknown) =>
            !!f &&
            typeof f === "object" &&
            typeof (f as FilaTablaChat).salon === "string" &&
            Array.isArray((f as FilaTablaChat).porMes) &&
            (f as FilaTablaChat).porMes.length === t.meses.length &&
            (f as FilaTablaChat).porMes.every(esNumero) &&
            esNumero((f as FilaTablaChat).total),
        ) &&
        Array.isArray(t.totalPorMes) &&
        t.totalPorMes.length === t.meses.length &&
        esNumero(t.total),
    )
    .slice(0, MAX_TABLAS_CHAT)
}

// Gasto variable propuesto por el chat con IA. La IA NUNCA carga nada: arma
// una propuesta (proponerGasto en lib/chat-ia-herramientas.ts), el chat la
// muestra con "Sí, cargar" / "Cancelar", y solo el botón (POST
// /api/chat/gasto) la escribe en costos_operativos, igual que "Cargar gastos"
// de Inicio en modo alta: gasto variable agendado, sin pagar, sin mover caja.
//
// Sin dependencias, para que lo usen el servidor y la pantalla.

export const SALONES_GASTO_CHAT = ["Quinta", "Casona", "Salon", "Salon 4", "Salon 5"] as const

export type EstadoPropuestaGasto = "pendiente" | "cargado" | "cancelado"

export interface PropuestaGastoChat {
  /** Id que tendrá el gasto en costos_operativos: confirmar dos veces no lo duplica. */
  id: string
  concepto: string
  monto: number
  /** Clave del salón ("Salon" es el que se muestra como "Salón"). */
  salon: string
  /** Vencimiento, AAAA-MM-DD. */
  vencimiento: string
  estado: EstadoPropuestaGasto
  /** Quién lo confirmó o canceló, y cuándo (ISO). */
  resueltoPor?: string
  resueltoEn?: string
}

/** Monto máximo que acepta el chat (un error de tipeo de ceros no pasa). */
export const MONTO_MAXIMO_GASTO_CHAT = 100_000_000

function fechaValida(f: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false
  const d = new Date(`${f}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f
}

/**
 * Arma la propuesta a partir de lo que pidió la IA, o dice qué falta. El
 * vencimiento, si no se dijo, es hoy (como en "Cargar gastos").
 */
export function armarPropuestaGasto(
  entrada: { concepto?: unknown; monto?: unknown; salon?: unknown; vencimiento?: unknown },
  { id, hoy }: { id: string; hoy: string },
): { ok: true; propuesta: PropuestaGastoChat } | { ok: false; motivo: string } {
  const concepto = typeof entrada.concepto === "string" ? entrada.concepto.trim().replace(/\s+/g, " ") : ""
  if (concepto.length < 2) return { ok: false, motivo: "Falta el concepto del gasto (qué es y a nombre de quién)." }
  if (concepto.length > 120) return { ok: false, motivo: "El concepto es muy largo: como máximo 120 letras." }

  const montoCrudo = typeof entrada.monto === "number" ? entrada.monto : Number.NaN
  if (!Number.isFinite(montoCrudo) || montoCrudo <= 0) return { ok: false, motivo: "Falta el monto, mayor a cero." }
  const monto = Math.round(montoCrudo * 100) / 100
  if (monto > MONTO_MAXIMO_GASTO_CHAT) return { ok: false, motivo: "El monto es demasiado grande: revisalo." }

  const salon = typeof entrada.salon === "string" ? entrada.salon : ""
  if (!(SALONES_GASTO_CHAT as readonly string[]).includes(salon)) return { ok: false, motivo: "Falta el salón." }

  const vencimiento = typeof entrada.vencimiento === "string" && entrada.vencimiento ? entrada.vencimiento : hoy
  if (!fechaValida(vencimiento)) return { ok: false, motivo: "La fecha de vencimiento no es válida." }

  return { ok: true, propuesta: { id, concepto, monto, salon, vencimiento, estado: "pendiente" } }
}

/** Propuesta leída del historial o de la respuesta; null si no tiene la forma esperada. */
export function propuestaGastoValida(valor: unknown): PropuestaGastoChat | null {
  if (!valor || typeof valor !== "object") return null
  const p = valor as Record<string, unknown>
  if (
    typeof p.id !== "string" ||
    typeof p.concepto !== "string" ||
    typeof p.monto !== "number" ||
    !Number.isFinite(p.monto) ||
    typeof p.salon !== "string" ||
    typeof p.vencimiento !== "string" ||
    (p.estado !== "pendiente" && p.estado !== "cargado" && p.estado !== "cancelado")
  ) {
    return null
  }
  return {
    id: p.id,
    concepto: p.concepto,
    monto: p.monto,
    salon: p.salon,
    vencimiento: p.vencimiento,
    estado: p.estado,
    ...(typeof p.resueltoPor === "string" ? { resueltoPor: p.resueltoPor } : {}),
    ...(typeof p.resueltoEn === "string" ? { resueltoEn: p.resueltoEn } : {}),
  }
}

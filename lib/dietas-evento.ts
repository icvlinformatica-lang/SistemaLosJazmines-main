// Dietas especiales con su tipo. Antes "dietas especiales" era un solo número
// y un solo menú: la cocina no sabía si eran celíacos, veganos o una alergia,
// que se cocinan distinto y algunas son de riesgo.
//
// El TOTAL de dietas sigue siendo `personasDietasEspeciales` (el número de
// siempre, el que usa el costo de cocina). El detalle es el desglose de ese
// total: lo que no está detallado se muestra como "sin detallar". Así los
// eventos viejos, que solo tienen el número, no pierden nada.
//
// Funciones puras. Test: scripts/test-dietas-evento.cjs

export const TIPOS_DIETA = ["celiaco", "vegetariano", "vegano", "sin_lactosa", "alergia", "otro"] as const
export type TipoDieta = (typeof TIPOS_DIETA)[number]

/** [singular, plural] para mostrar "1 celíaco" / "3 celíacos". */
const NOMBRES: Record<TipoDieta, [string, string]> = {
  celiaco: ["celíaco", "celíacos"],
  vegetariano: ["vegetariano", "vegetarianos"],
  vegano: ["vegano", "veganos"],
  sin_lactosa: ["sin lactosa", "sin lactosa"],
  alergia: ["alergia", "alergias"],
  otro: ["otra dieta", "otras dietas"],
}

export const ETIQUETA_DIETA: Record<TipoDieta, string> = {
  celiaco: "Celíaco",
  vegetariano: "Vegetariano",
  vegano: "Vegano",
  sin_lactosa: "Sin lactosa",
  alergia: "Alergia",
  otro: "Otro",
}

export interface DietaDetalle {
  tipo: TipoDieta
  cantidad: number
  /** Aclaración: "maní", "no come cerdo"... En alergias es lo más importante. */
  nota?: string
}

const MAX_LINEAS = 20
const MAX_CANTIDAD = 2000

/** Valida lo que llega (navegador o base). Tolera null, texto JSON o basura. */
export function normalizarDietasDetalle(raw: unknown): DietaDetalle[] {
  let lista = raw
  if (typeof lista === "string") {
    try {
      lista = JSON.parse(lista)
    } catch {
      return []
    }
  }
  if (!Array.isArray(lista)) return []
  const out: DietaDetalle[] = []
  for (const item of lista) {
    if (!item || typeof item !== "object") continue
    const it = item as Record<string, unknown>
    const tipo = (TIPOS_DIETA as readonly string[]).includes(it.tipo as string) ? (it.tipo as TipoDieta) : null
    const cantidad = Math.floor(Number(it.cantidad))
    if (!tipo || !Number.isFinite(cantidad) || cantidad <= 0) continue
    const nota = typeof it.nota === "string" && it.nota.trim() ? it.nota.trim().slice(0, 120) : undefined
    out.push({ tipo, cantidad: Math.min(cantidad, MAX_CANTIDAD), ...(nota ? { nota } : {}) })
    if (out.length >= MAX_LINEAS) break
  }
  return out
}

export function totalDietasDetalle(detalle: DietaDetalle[] | null | undefined): number {
  return (detalle ?? []).reduce((s, d) => s + d.cantidad, 0)
}

/**
 * Total de dietas a guardar cuando se edita el detalle: nunca menos que lo que
 * suma el detalle (si detallaron 5, son al menos 5), pero si el total cargado
 * es mayor se respeta (el resto queda "sin detallar").
 */
export function totalConDetalle(totalCargado: number | null | undefined, detalle: DietaDetalle[] | null | undefined): number {
  return Math.max(Math.floor(Number(totalCargado) || 0), totalDietasDetalle(detalle))
}

export interface LineaDieta {
  texto: string
  alergia: boolean
}

/**
 * Lo que ve la cocina: "3 celíacos", "1 alergia: maní", "2 sin detallar".
 * Las alergias van primero y marcadas, porque son de riesgo.
 */
export function lineasDietas(total: number | null | undefined, detalle: DietaDetalle[] | null | undefined): LineaDieta[] {
  const lista = normalizarDietasDetalle(detalle)
  const ordenadas = [...lista].sort((a, b) => Number(b.tipo === "alergia") - Number(a.tipo === "alergia"))
  const lineas: LineaDieta[] = ordenadas.map((d) => {
    const [uno, varios] = NOMBRES[d.tipo]
    const base = `${d.cantidad} ${d.cantidad === 1 ? uno : varios}`
    return { texto: d.nota ? `${base}: ${d.nota}` : base, alergia: d.tipo === "alergia" }
  })
  const sinDetallar = Math.floor(Number(total) || 0) - totalDietasDetalle(lista)
  if (sinDetallar > 0) lineas.push({ texto: `${sinDetallar} sin detallar`, alergia: false })
  return lineas
}

/** Una sola línea: "3 celíacos · 1 alergia: maní". Vacío si no hay dietas. */
export function textoDietas(total: number | null | undefined, detalle: DietaDetalle[] | null | undefined): string {
  return lineasDietas(total, detalle)
    .map((l) => l.texto)
    .join(" · ")
}

export function hayAlergias(detalle: DietaDetalle[] | null | undefined): boolean {
  return normalizarDietasDetalle(detalle).some((d) => d.tipo === "alergia")
}

/**
 * Al aprobar una cotización: el vendedor carga las dietas como parte de los
 * adultos (el precio no cambia: una dieta se cobra como un adulto). En el
 * evento, la cocina los cuenta aparte: se restan de los adultos, sin dejarlos
 * en negativo.
 */
export function separarDietasDeAdultos(
  adultos: number,
  detalle: DietaDetalle[] | null | undefined,
): { adultos: number; personasDietasEspeciales: number; dietasDetalle: DietaDetalle[] } {
  const lista = normalizarDietasDetalle(detalle)
  const base = Math.max(0, Math.floor(Number(adultos) || 0))
  const dietas = Math.min(totalDietasDetalle(lista), base)
  return { adultos: base - dietas, personasDietasEspeciales: dietas, dietasDetalle: dietas > 0 ? lista : [] }
}

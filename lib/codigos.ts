// Códigos automáticos del catálogo (INS001, P012…). Vive acá, sin "use
// client", para que lo pueda usar también el servidor (el chat con IA da de
// alta insumos y recetas). lib/store.ts lo reexporta: los imports de siempre
// siguen igual.
import type { RecetaCategoria } from "./store"

// Prefijo de código automático por categoría de receta (respeta la convención existente: R, E, P, K...)
export const RECETA_CODIGO_PREFIX: Record<RecetaCategoria, string> = {
  "Recepción": "R",
  "Entrada": "E",
  "Plato Principal": "P",
  "Guarnición": "G",
  "Postre": "PS",
  "Menú para Niños": "K",
  "Menú Adolescente": "AD",
  "Celiaco": "CL",
  "Vegano": "VG",
  "Vegetariano": "VT",
  "Sin Sal": "SS",
  "Mesa Dulce": "MD",
}

/**
 * Genera el próximo código secuencial disponible para un prefijo dado.
 * Escanea los códigos existentes con formato `<PREFIJO><número>` (ej: INS001),
 * toma el número más alto y devuelve el siguiente con relleno de ceros.
 */
export function generateNextCodigo(existingCodigos: (string | undefined | null)[], prefix: string, pad = 3): string {
  const re = new RegExp(`^${prefix}(\\d+)$`, "i")
  let max = 0
  for (const c of existingCodigos) {
    const m = re.exec((c || "").trim())
    if (m) {
      const n = Number.parseInt(m[1], 10)
      if (Number.isFinite(n) && n > max) max = n
    }
  }
  return `${prefix}${String(max + 1).padStart(pad, "0")}`
}

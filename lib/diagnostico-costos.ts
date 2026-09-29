/**
 * Detector de costos mal calculados por unidades que no se pueden convertir.
 *
 * EL PROBLEMA QUE BUSCA: cuando una receta pide gramos (o cc) pero el insumo
 * se compra por unidad (una lata, una botella) y no tiene cargado cuánto trae
 * esa unidad, normalizeToStockUnit() no puede convertir y devuelve la cantidad
 * tal cual. O sea, lee "30 gramos" como "30 latas" y el costo sale
 * multiplicado por cuánto trae el envase: 200 veces en las arvejas, 700 en una
 * botella de gin.
 *
 * Por eso hay eventos con costo de insumos de cientos de millones y cócteles
 * que "cuestan" un millón de pesos el trago.
 *
 * Se detecta la CAUSA, no el síntoma: buscar por monto dejaría afuera los
 * casos chicos, que están igual de mal (un ajo a $740 por persona). El monto
 * se usa solo para ordenar y para marcar lo urgente.
 */

import type { Unidad, UnidadReceta } from "./store"

/** Cuánto se multiplica el costo de un evento de referencia para marcarlo urgente. */
export const UMBRAL_URGENTE = 50_000_000

/** Invitados de un evento tipo, para estimar el impacto en plata de una línea. */
export const INVITADOS_REFERENCIA = 100

export type Sector = "cocina" | "barra"

export interface InsumoDiagnostico {
  id: string
  descripcion: string
  unidad: Unidad
  precioUnitario: number
  contenidoCantidad?: number
  contenidoUnidad?: "GRS" | "CC"
}

export interface LineaDiagnostico {
  /** Receta (cocina) o cóctel (barra) que usa el insumo. */
  contenedorId: string
  contenedorNombre: string
  insumoId: string
  cantidad: number
  unidadPedida: UnidadReceta
}

export interface ProblemaCosto {
  sector: Sector
  contenedorId: string
  contenedorNombre: string
  insumoId: string
  insumoDescripcion: string
  unidadInsumo: Unidad
  precioUnitario: number
  cantidadPedida: number
  unidadPedida: UnidadReceta
  /** Lo que el sistema está cobrando hoy por persona/trago. */
  costoActual: number
  /** Lo que costaría si el contenido sugerido fuera el correcto. Null si no hay sugerencia. */
  costoCorregido: number | null
  /** Cuántas veces de más se está cobrando. Null si no hay sugerencia. */
  vecesDeMas: number | null
  /** Contenido leído del nombre del insumo, para precargar el campo. */
  sugerencia: { cantidad: number; unidad: "GRS" | "CC"; origen: string } | null
  /** Impacto estimado en un evento de 100 personas. */
  impactoEstimado: number
  urgente: boolean
}

/**
 * Lee el contenido del nombre del insumo: "GIN GORDON´S 700" → 700,
 * "COCA COLA 2L" → 2000 cc, "FERNET BRANCA 750CC" → 750 cc.
 *
 * Es solo una SUGERENCIA para precargar el campo: quien lo carga confirma.
 * La unidad se toma de lo que pide la receta, porque un "750" suelto en una
 * bebida son cc y en un paquete de fideos serían gramos.
 */
export function sugerirContenidoDesdeNombre(
  descripcion: string,
  unidadPedida: UnidadReceta,
): { cantidad: number; unidad: "GRS" | "CC"; origen: string } | null {
  const texto = (descripcion || "").toUpperCase()

  // Litros / kilos primero: "2L", "1,5 LT", "2 KG" — hay que multiplicar.
  const enGrande = /(\d+(?:[.,]\d+)?)\s*(L|LT|LTS|KG)\b/.exec(texto)
  if (enGrande) {
    const valor = Number(enGrande[1].replace(",", "."))
    if (valor > 0) {
      const esPeso = enGrande[2] === "KG"
      return {
        cantidad: valor * 1000,
        unidad: esPeso ? "GRS" : "CC",
        origen: `del nombre: "${enGrande[0].trim()}"`,
      }
    }
  }

  // Unidad chica explícita: "750CC", "500 ML", "200 GRS"
  const enChico = /(\d+(?:[.,]\d+)?)\s*(CC|ML|GRS?|G)\b/.exec(texto)
  if (enChico) {
    const valor = Number(enChico[1].replace(",", "."))
    if (valor > 0) {
      const esPeso = enChico[2].startsWith("G")
      return {
        cantidad: valor,
        unidad: esPeso ? "GRS" : "CC",
        origen: `del nombre: "${enChico[0].trim()}"`,
      }
    }
  }

  // Número suelto al final: "GIN GORDON´S 700", "CAMPARI 750". Se interpreta
  // en la unidad que pide la receta. Se pide un mínimo de 50 para no tomar
  // por contenido un número que sea parte del nombre ("COCA COLA 3").
  const suelto = /(\d{2,5})\s*$/.exec(texto.trim())
  if (suelto) {
    const valor = Number(suelto[1])
    const unidad = unidadPedida === "GRS" || unidadPedida === "KG" ? "GRS" : "CC"
    if (valor >= 50) {
      return { cantidad: valor, unidad, origen: `del nombre: "${suelto[1]}"` }
    }
  }

  return null
}

/**
 * ¿Esta línea tiene el problema? Solo cuando el insumo se compra por unidad,
 * la receta lo pide en peso o volumen, y no hay contenido cargado para poder
 * convertir.
 */
function lineaEstaMal(insumo: InsumoDiagnostico, unidadPedida: UnidadReceta): boolean {
  if (insumo.unidad !== "UN") return false
  if (unidadPedida === "UN") return false
  if (insumo.contenidoCantidad && insumo.contenidoUnidad) return false
  return unidadPedida === "GRS" || unidadPedida === "KG" || unidadPedida === "CC" || unidadPedida === "L"
}

/** Pasa la cantidad pedida a la unidad del contenido sugerido. */
function cantidadEnUnidadDelContenido(cantidad: number, unidadPedida: UnidadReceta, unidadContenido: "GRS" | "CC"): number | null {
  if (unidadPedida === unidadContenido) return cantidad
  if (unidadPedida === "KG" && unidadContenido === "GRS") return cantidad * 1000
  if (unidadPedida === "L" && unidadContenido === "CC") return cantidad * 1000
  return null
}

export function detectarProblemas(
  sector: Sector,
  lineas: LineaDiagnostico[],
  insumos: InsumoDiagnostico[],
): ProblemaCosto[] {
  const problemas: ProblemaCosto[] = []

  for (const linea of lineas) {
    const insumo = insumos.find((i) => i.id === linea.insumoId)
    if (!insumo) continue
    if (!lineaEstaMal(insumo, linea.unidadPedida)) continue

    // Lo que se está cobrando hoy: la cantidad se usa como si fueran unidades.
    const costoActual = linea.cantidad * (Number(insumo.precioUnitario) || 0)

    const sugerencia = sugerirContenidoDesdeNombre(insumo.descripcion, linea.unidadPedida)
    let costoCorregido: number | null = null
    if (sugerencia) {
      const enUnidad = cantidadEnUnidadDelContenido(linea.cantidad, linea.unidadPedida, sugerencia.unidad)
      if (enUnidad !== null && sugerencia.cantidad > 0) {
        costoCorregido = (enUnidad / sugerencia.cantidad) * (Number(insumo.precioUnitario) || 0)
      }
    }

    const impactoEstimado = (costoActual - (costoCorregido ?? 0)) * INVITADOS_REFERENCIA

    problemas.push({
      sector,
      contenedorId: linea.contenedorId,
      contenedorNombre: linea.contenedorNombre,
      insumoId: insumo.id,
      insumoDescripcion: insumo.descripcion,
      unidadInsumo: insumo.unidad,
      precioUnitario: Number(insumo.precioUnitario) || 0,
      cantidadPedida: linea.cantidad,
      unidadPedida: linea.unidadPedida,
      costoActual,
      costoCorregido,
      vecesDeMas: costoCorregido && costoCorregido > 0 ? costoActual / costoCorregido : null,
      sugerencia,
      impactoEstimado,
      urgente: impactoEstimado >= UMBRAL_URGENTE,
    })
  }

  // El que más plata está inflando, primero.
  return problemas.sort((a, b) => b.impactoEstimado - a.impactoEstimado)
}

/**
 * Los problemas agrupados por insumo: es la unidad de trabajo real, porque
 * cargar el contenido de un insumo arregla de una vez todas las recetas que
 * lo usan. El gin arregla 4 cócteles con un solo dato.
 */
export interface InsumoConProblema {
  insumoId: string
  insumoDescripcion: string
  sector: Sector
  precioUnitario: number
  /** Recetas o cócteles afectados por este insumo. */
  afectados: Array<{ nombre: string; cantidad: number; unidad: UnidadReceta; costoActual: number }>
  sugerencia: ProblemaCosto["sugerencia"]
  impactoTotal: number
  urgente: boolean
}

export function agruparPorInsumo(problemas: ProblemaCosto[]): InsumoConProblema[] {
  const porInsumo = new Map<string, InsumoConProblema>()

  for (const p of problemas) {
    const actual = porInsumo.get(p.insumoId)
    const afectado = {
      nombre: p.contenedorNombre,
      cantidad: p.cantidadPedida,
      unidad: p.unidadPedida,
      costoActual: p.costoActual,
    }
    if (actual) {
      actual.afectados.push(afectado)
      actual.impactoTotal += p.impactoEstimado
      actual.urgente = actual.urgente || p.urgente
      // Entre varias líneas del mismo insumo, se queda la sugerencia que haya.
      if (!actual.sugerencia && p.sugerencia) actual.sugerencia = p.sugerencia
    } else {
      porInsumo.set(p.insumoId, {
        insumoId: p.insumoId,
        insumoDescripcion: p.insumoDescripcion,
        sector: p.sector,
        precioUnitario: p.precioUnitario,
        afectados: [afectado],
        sugerencia: p.sugerencia,
        impactoTotal: p.impactoEstimado,
        urgente: p.urgente,
      })
    }
  }

  return [...porInsumo.values()].sort((a, b) => b.impactoTotal - a.impactoTotal)
}

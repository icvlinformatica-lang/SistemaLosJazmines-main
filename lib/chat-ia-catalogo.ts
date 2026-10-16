// Alta de insumos de cocina y de recetas desde el chat con IA. La IA NUNCA
// carga nada: pregunta lo necesario, arma una propuesta (proponerInsumo y
// proponerReceta en lib/chat-ia-herramientas.ts) y el chat la muestra con
// "Sí, cargar" / "Cancelar". Solo el botón la carga (POST /api/chat/catalogo),
// con los mismos datos que Almacén y Recetario.
//
// Lo delicado es la unidad: el precio de un insumo es POR SU UNIDAD (por kg,
// por litro, por unidad) y las recetas lo convierten (normalizeToStockUnit).
// Por eso el precio por unidad lo calcula esta cuenta a partir de lo que se
// pagó y por cuánto ("$10.000 la bolsa de 5 kg" → $2.000 por kg), nunca la IA,
// y un insumo que se compra por unidad pide cuánto trae cada una (una lata =
// 400 gramos), si no las recetas en gramos calculan mal el costo.
//
// Sin "use client" y sin lib/store.ts: lo usan el servidor y la pantalla.
import type { Insumo, RecetaCategoria, Unidad, UnidadReceta } from "./store"
import { contenidoDe, normalizeToStockUnit } from "./unidades"
import { costoPorPorcion } from "./precio-menu"

export type EstadoPropuestaCatalogo = "pendiente" | "cargado" | "cancelado"

/** Unidades de stock que ofrece Almacén. */
export const UNIDADES_INSUMO_CHAT = ["KG", "GR", "LT", "CC", "UN"] as const
export type UnidadInsumoChat = (typeof UNIDADES_INSUMO_CHAT)[number]
/** Unidades en que una receta pide un insumo (las del Recetario). */
export const UNIDADES_RECETA_CHAT = ["GRS", "KG", "CC", "L", "UN"] as const

export const CATEGORIAS_RECETA_CHAT: RecetaCategoria[] = [
  "Recepción",
  "Entrada",
  "Plato Principal",
  "Guarnición",
  "Postre",
  "Menú para Niños",
  "Menú Adolescente",
  "Celiaco",
  "Vegano",
  "Vegetariano",
  "Sin Sal",
  "Mesa Dulce",
]

/** Precio máximo por unidad que acepta el chat (un error de ceros no pasa). */
export const PRECIO_MAXIMO_INSUMO_CHAT = 50_000_000
export const MAX_INGREDIENTES_RECETA_CHAT = 40

export interface PropuestaInsumoChat {
  /** Id que tendrá el insumo: confirmar dos veces no lo duplica. */
  id: string
  descripcion: string
  unidad: UnidadInsumoChat
  /** Precio por unidad de stock (por kg, por litro, por unidad…). */
  precioUnitario: number
  /** Lo que se dijo de la compra, para mostrar de dónde sale el precio. */
  compra: { cantidad: number; monto: number }
  /** Solo si la unidad es UN: cuánto trae cada unidad. */
  contenidoCantidad?: number
  contenidoUnidad?: "GRS" | "CC"
  proveedor: string
  estado: EstadoPropuestaCatalogo
  /** Código que le tocó al cargarlo (INS031…). */
  codigo?: string
  resueltoPor?: string
  resueltoEn?: string
}

export interface IngredienteRecetaChat {
  insumoId: string
  descripcion: string
  cantidad: number
  unidadReceta: (typeof UNIDADES_RECETA_CHAT)[number]
  detalleCorte: string
  /** Costo de este ingrediente por porción, con el precio de hoy. */
  costoPorPorcion: number
}

export interface PropuestaRecetaChat {
  /** Id que tendrá la receta: confirmar dos veces no la duplica. */
  id: string
  nombre: string
  categoria: RecetaCategoria
  descripcion: string
  /** factorRendimiento: las cantidades son para esta cantidad de porciones. */
  rindePara: number
  ingredientes: IngredienteRecetaChat[]
  costoPorPorcion: number
  estado: EstadoPropuestaCatalogo
  codigo?: string
  resueltoPor?: string
  resueltoEn?: string
}

const redondear = (n: number) => Math.round(n * 100) / 100

/** Minúsculas, sin tildes ni espacios de más: "Harina 0000" y "harina  0000" son lo mismo. */
export function nombreComparable(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : ""
}

const NOMBRE_UNIDAD: Record<string, string> = { KG: "kg", GR: "gramo", LT: "litro", CC: "cc", UN: "unidad", GRS: "gramos", L: "litros" }

/** "por kg", "por litro", "por unidad"… */
export function porUnidad(unidad: string): string {
  return `por ${NOMBRE_UNIDAD[unidad] ?? unidad.toLowerCase()}`
}

/** Insumo de la base en la forma que usan las cuentas (servidor). */
export type InsumoCatalogo = Pick<Insumo, "id" | "descripcion" | "unidad" | "precioUnitario" | "contenidoCantidad" | "contenidoUnidad"> & {
  codigo?: string
  proveedor?: string
}

export function insumoDesdeFila(f: Record<string, unknown>): InsumoCatalogo {
  return {
    id: String(f.id ?? ""),
    codigo: f.codigo ? String(f.codigo) : undefined,
    descripcion: String(f.descripcion ?? ""),
    unidad: String(f.unidad ?? "UN").toUpperCase() as Unidad,
    precioUnitario: Number(f.precio_unitario) || 0,
    proveedor: f.proveedor ? String(f.proveedor) : "",
    contenidoCantidad: f.contenido_cantidad != null ? Number(f.contenido_cantidad) : undefined,
    contenidoUnidad: f.contenido_unidad === "GRS" || f.contenido_unidad === "CC" ? f.contenido_unidad : undefined,
  }
}

/**
 * Arma el insumo nuevo con lo que se respondió, o dice qué falta o qué está
 * mal (para que la IA lo pregunte).
 */
export function armarPropuestaInsumo(
  entrada: {
    descripcion?: unknown
    unidad?: unknown
    cantidadComprada?: unknown
    montoPagado?: unknown
    contenidoCantidad?: unknown
    contenidoUnidad?: unknown
    seUsaPorUnidad?: unknown
    proveedor?: unknown
    sinProveedor?: unknown
  },
  { id, existentes }: { id: string; existentes: Pick<InsumoCatalogo, "descripcion" | "unidad" | "precioUnitario">[] },
): { ok: true; propuesta: PropuestaInsumoChat } | { ok: false; motivo: string } {
  const descripcion = texto(entrada.descripcion, 80)
  if (descripcion.length < 2) return { ok: false, motivo: "Falta el nombre del insumo." }
  const igual = existentes.find((i) => nombreComparable(i.descripcion) === nombreComparable(descripcion))
  if (igual) {
    return {
      ok: false,
      motivo: `Ya existe "${igual.descripcion}" en Almacén (${igual.unidad}, $${igual.precioUnitario.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${porUnidad(igual.unidad)}). Para cambiarle el precio o el proveedor, se hace en Almacén.`,
    }
  }

  const unidad = typeof entrada.unidad === "string" ? entrada.unidad.toUpperCase() : ""
  if (!(UNIDADES_INSUMO_CHAT as readonly string[]).includes(unidad)) {
    return { ok: false, motivo: "Falta cómo se mide: por peso (KG), por volumen (LT) o por unidad (UN)." }
  }

  const cantidad = typeof entrada.cantidadComprada === "number" ? entrada.cantidadComprada : Number.NaN
  const monto = typeof entrada.montoPagado === "number" ? entrada.montoPagado : Number.NaN
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, motivo: "Falta cuánto se pagó." }
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { ok: false, motivo: `Falta por qué cantidad se pagó eso, en ${NOMBRE_UNIDAD[unidad]}.` }
  }
  const precioUnitario = redondear(monto / cantidad)
  if (precioUnitario <= 0) return { ok: false, motivo: "El precio por unidad da cero: revisá el monto y la cantidad." }
  if (precioUnitario > PRECIO_MAXIMO_INSUMO_CHAT) return { ok: false, motivo: "El precio por unidad es demasiado grande: revisalo." }

  let contenidoCantidad: number | undefined
  let contenidoUnidad: "GRS" | "CC" | undefined
  if (unidad === "UN") {
    const c = typeof entrada.contenidoCantidad === "number" ? entrada.contenidoCantidad : Number.NaN
    const u = entrada.contenidoUnidad === "GRS" || entrada.contenidoUnidad === "CC" ? entrada.contenidoUnidad : null
    if (Number.isFinite(c) && c > 0 && u) {
      contenidoCantidad = redondear(c)
      contenidoUnidad = u
    } else if (entrada.seUsaPorUnidad !== true) {
      return {
        ok: false,
        motivo:
          "Falta cuánto trae cada unidad (en gramos o en cc), o confirmar que en las recetas se usa por unidad (como los huevos). Sin eso, una receta en gramos calcula mal el costo.",
      }
    }
  }

  const proveedor = texto(entrada.proveedor, 80)
  if (!proveedor && entrada.sinProveedor !== true) return { ok: false, motivo: "Falta el proveedor (o confirmar que no tiene uno fijo)." }

  return {
    ok: true,
    propuesta: {
      id,
      descripcion,
      unidad: unidad as UnidadInsumoChat,
      precioUnitario,
      compra: { cantidad: redondear(cantidad), monto: redondear(monto) },
      ...(contenidoCantidad ? { contenidoCantidad, contenidoUnidad } : {}),
      proveedor,
      estado: "pendiente",
    },
  }
}

/**
 * ¿La receta puede pedir este insumo en esta unidad? Tiene que poder
 * convertirse a la unidad del insumo; si no, el costo sale mal sin avisar
 * (normalizeToStockUnit devuelve la cantidad tal cual).
 */
export function unidadRecetaCompatible(unidadReceta: string, insumo: InsumoCatalogo): boolean {
  const stock = insumo.unidad === "GR" ? "GRS" : insumo.unidad === "LT" ? "L" : insumo.unidad
  if (unidadReceta === stock) return true
  const peso = ["GRS", "KG"]
  const volumen = ["CC", "L"]
  if (peso.includes(unidadReceta) && peso.includes(stock)) return true
  if (volumen.includes(unidadReceta) && volumen.includes(stock)) return true
  const contenido = contenidoDe(insumo)
  if (stock === "UN" && contenido) {
    return contenido.unidad === "GRS" ? peso.includes(unidadReceta) : volumen.includes(unidadReceta)
  }
  return false
}

function unidadesPosibles(insumo: InsumoCatalogo): string {
  return (UNIDADES_RECETA_CHAT as readonly string[])
    .filter((u) => unidadRecetaCompatible(u, insumo))
    .map((u) => NOMBRE_UNIDAD[u] ?? u)
    .join(" o ")
}

/** Arma la receta nueva, o dice qué falta o qué está mal. */
export function armarPropuestaReceta(
  entrada: {
    nombre?: unknown
    categoria?: unknown
    descripcion?: unknown
    rindePara?: unknown
    ingredientes?: unknown
  },
  { id, insumos, recetasExistentes }: { id: string; insumos: InsumoCatalogo[]; recetasExistentes: { nombre: string }[] },
): { ok: true; propuesta: PropuestaRecetaChat } | { ok: false; motivo: string } {
  const nombre = texto(entrada.nombre, 80)
  if (nombre.length < 2) return { ok: false, motivo: "Falta el nombre de la receta." }
  const igual = recetasExistentes.find((r) => nombreComparable(r.nombre) === nombreComparable(nombre))
  if (igual) return { ok: false, motivo: `Ya existe la receta "${igual.nombre}". Para cambiarla, se hace en Recetario.` }

  const categoria = CATEGORIAS_RECETA_CHAT.find((c) => c === entrada.categoria)
  if (!categoria) return { ok: false, motivo: `Falta la categoría: ${CATEGORIAS_RECETA_CHAT.join(", ")}.` }

  const rinde = typeof entrada.rindePara === "number" ? entrada.rindePara : Number.NaN
  if (!Number.isInteger(rinde) || rinde < 1 || rinde > 1000) {
    return { ok: false, motivo: "Falta para cuántas porciones son las cantidades (1 si son por persona)." }
  }

  const lista = Array.isArray(entrada.ingredientes) ? entrada.ingredientes : []
  if (lista.length === 0) return { ok: false, motivo: "Faltan los ingredientes." }
  if (lista.length > MAX_INGREDIENTES_RECETA_CHAT) return { ok: false, motivo: `Como máximo ${MAX_INGREDIENTES_RECETA_CHAT} ingredientes.` }

  const ingredientes: IngredienteRecetaChat[] = []
  for (const crudo of lista) {
    const ing = (crudo ?? {}) as Record<string, unknown>
    const insumo = insumos.find((i) => i.id === ing.insumoId)
    if (!insumo) return { ok: false, motivo: "Hay un ingrediente que no está en Almacén: buscalo con buscarInsumos o cargalo primero." }
    if (ingredientes.some((x) => x.insumoId === insumo.id)) {
      return { ok: false, motivo: `"${insumo.descripcion}" está dos veces: sumá las cantidades en una sola línea.` }
    }
    const cantidad = typeof ing.cantidad === "number" ? ing.cantidad : Number.NaN
    if (!Number.isFinite(cantidad) || cantidad <= 0) return { ok: false, motivo: `Falta la cantidad de "${insumo.descripcion}".` }
    const unidadReceta = typeof ing.unidad === "string" ? ing.unidad.toUpperCase() : ""
    if (!(UNIDADES_RECETA_CHAT as readonly string[]).includes(unidadReceta)) {
      return { ok: false, motivo: `Falta en qué unidad va "${insumo.descripcion}" (gramos, kg, cc, litros o unidades).` }
    }
    if (!unidadRecetaCompatible(unidadReceta, insumo)) {
      const posibles = unidadesPosibles(insumo)
      return {
        ok: false,
        motivo:
          insumo.unidad === "UN" && !contenidoDe(insumo)
            ? `"${insumo.descripcion}" se compra por unidad y no tiene cargado cuánto trae cada una: pedilo en unidades, o cargale el contenido en Almacén.`
            : `"${insumo.descripcion}" está en ${insumo.unidad}: en la receta va en ${posibles}, no en ${NOMBRE_UNIDAD[unidadReceta] ?? unidadReceta}.`,
      }
    }
    const qty = normalizeToStockUnit(cantidad, unidadReceta as UnidadReceta, insumo.unidad, contenidoDe(insumo))
    ingredientes.push({
      insumoId: insumo.id,
      descripcion: insumo.descripcion,
      cantidad: Math.round(cantidad * 1000) / 1000,
      unidadReceta: unidadReceta as IngredienteRecetaChat["unidadReceta"],
      detalleCorte: texto(ing.detalleCorte, 60),
      costoPorPorcion: redondear((qty / rinde) * insumo.precioUnitario),
    })
  }

  // La misma cuenta del Recetario y del cotizador (lib/precio-menu.ts).
  const costo = costoPorPorcion(
    {
      factorRendimiento: rinde,
      insumos: ingredientes.map((i) => ({
        insumoId: i.insumoId,
        cantidadBasePorPersona: i.cantidad,
        unidadReceta: i.unidadReceta,
        detalleCorte: i.detalleCorte,
      })),
    },
    insumos,
  )

  return {
    ok: true,
    propuesta: {
      id,
      nombre,
      categoria,
      descripcion: texto(entrada.descripcion, 300),
      rindePara: rinde,
      ingredientes,
      costoPorPorcion: redondear(costo),
      estado: "pendiente",
    },
  }
}

const ESTADOS = ["pendiente", "cargado", "cancelado"]

/** Propuesta de insumo leída del historial; null si no tiene la forma esperada. */
export function propuestaInsumoValida(valor: unknown): PropuestaInsumoChat | null {
  if (!valor || typeof valor !== "object") return null
  const p = valor as Record<string, unknown>
  const compra = p.compra as Record<string, unknown> | undefined
  if (
    typeof p.id !== "string" ||
    typeof p.descripcion !== "string" ||
    !(UNIDADES_INSUMO_CHAT as readonly unknown[]).includes(p.unidad) ||
    typeof p.precioUnitario !== "number" ||
    !Number.isFinite(p.precioUnitario) ||
    !compra ||
    typeof compra.cantidad !== "number" ||
    typeof compra.monto !== "number" ||
    typeof p.proveedor !== "string" ||
    !ESTADOS.includes(String(p.estado))
  ) {
    return null
  }
  return p as unknown as PropuestaInsumoChat
}

/** Propuesta de receta leída del historial; null si no tiene la forma esperada. */
export function propuestaRecetaValida(valor: unknown): PropuestaRecetaChat | null {
  if (!valor || typeof valor !== "object") return null
  const p = valor as Record<string, unknown>
  if (
    typeof p.id !== "string" ||
    typeof p.nombre !== "string" ||
    !CATEGORIAS_RECETA_CHAT.includes(p.categoria as RecetaCategoria) ||
    typeof p.rindePara !== "number" ||
    typeof p.costoPorPorcion !== "number" ||
    !Array.isArray(p.ingredientes) ||
    !p.ingredientes.every(
      (i) =>
        i &&
        typeof i === "object" &&
        typeof (i as Record<string, unknown>).insumoId === "string" &&
        typeof (i as Record<string, unknown>).descripcion === "string" &&
        typeof (i as Record<string, unknown>).cantidad === "number" &&
        typeof (i as Record<string, unknown>).unidadReceta === "string",
    ) ||
    !ESTADOS.includes(String(p.estado))
  ) {
    return null
  }
  return p as unknown as PropuestaRecetaChat
}

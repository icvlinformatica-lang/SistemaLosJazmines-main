// Catálogo de artículos de limpieza (tabla insumos_limpieza, scripts/026).
// Pedido de Diego (21/10/2026): un tercer stock, aparte de cocina y barra,
// para limpieza, papelería y mantenimiento. Se cuenta por salón igual que los
// otros dos (stock_salones con insumo_tipo 'limpieza') y el total es la suma
// de los salones. No tiene precio: no entra en costos de eventos ni en cajas.
//
// Lógica pura (sin base ni React) para poder probarla sola
// (scripts/test-insumos-limpieza.cjs). La usan app/api/insumos-limpieza/** y
// la pantalla /admin/limpieza.

export interface ArticuloLimpieza {
  id: string
  descripcion: string
  unidad: string
  categoria: string | null
}

/** Agrupan la lista de carga en /stock. Se puede escribir otra. */
export const CATEGORIAS_LIMPIEZA = ["Limpieza", "Papelería", "Baño", "Mantenimiento"] as const

/** Las más comunes, para elegir rápido. Se puede escribir otra. */
export const UNIDADES_LIMPIEZA = ["UN", "PAQ", "ROLLO", "CAJA", "LT", "KG", "RESMA"] as const

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Para comparar nombres: sin mayúsculas, tildes ni espacios de más. */
export function claveDescripcion(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

export type ValidacionArticulo =
  | { ok: true; articulo: ArticuloLimpieza }
  | { ok: false; error: string }

/**
 * Valida lo que manda la pantalla al crear o editar un artículo. El id lo
 * genera la pantalla (uuid) para que un reintento no cree dos iguales; al
 * editar, el id viene de la dirección y se pasa en `idFijo`.
 */
export function validarArticuloLimpieza(body: unknown, idFijo?: string): ValidacionArticulo {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const id = idFijo ?? (typeof b.id === "string" ? b.id.trim() : "")
  if (!idFijo && !RE_UUID.test(id)) return { ok: false, error: "Id inválido" }
  if (!id) return { ok: false, error: "Id inválido" }
  const descripcion = typeof b.descripcion === "string" ? b.descripcion.replace(/\s+/g, " ").trim() : ""
  if (!descripcion) return { ok: false, error: "Falta el nombre del artículo" }
  if (descripcion.length > 120) return { ok: false, error: "El nombre es demasiado largo" }
  const unidad = (typeof b.unidad === "string" ? b.unidad : "").trim().toUpperCase() || "UN"
  if (unidad.length > 20) return { ok: false, error: "La unidad es demasiado larga" }
  const categoriaTexto = typeof b.categoria === "string" ? b.categoria.replace(/\s+/g, " ").trim() : ""
  if (categoriaTexto.length > 40) return { ok: false, error: "La categoría es demasiado larga" }
  return { ok: true, articulo: { id, descripcion, unidad, categoria: categoriaTexto || null } }
}

/** ¿Ya hay otro artículo con el mismo nombre (sin contar mayúsculas ni tildes)? */
export function nombreRepetido(
  descripcion: string,
  existentes: Array<{ id: string; descripcion: string }>,
  idPropio?: string,
): boolean {
  const clave = claveDescripcion(descripcion)
  return existentes.some((e) => e.id !== idPropio && claveDescripcion(e.descripcion) === clave)
}

export interface CeldaLimpieza {
  insumoId: string
  salon: string
  cantidad: number
}

/**
 * Total de cada artículo: la suma de lo contado en todos los salones (un
 * salón sin conteo no suma). Sin entrada = ningún salón lo contó todavía,
 * que no es lo mismo que 0.
 */
export function totalesPorArticulo(celdas: CeldaLimpieza[]): Map<string, number> {
  const totales = new Map<string, number>()
  for (const c of celdas) {
    totales.set(c.insumoId, Math.round(((totales.get(c.insumoId) ?? 0) + c.cantidad) * 10000) / 10000)
  }
  return totales
}

/** La tabla todavía no existe (falta correr scripts/026_stock_limpieza.sql). */
export function faltaTabla(err: unknown): boolean {
  return (err as { code?: string })?.code === "42P01"
}

export const AVISO_SIN_TABLA = "Falta crear la tabla del stock de limpieza en la base (scripts/026_stock_limpieza.sql)."

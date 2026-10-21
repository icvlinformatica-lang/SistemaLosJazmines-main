// Catálogo de artículos de limpieza (tabla insumos_limpieza, scripts/026).
// Pedido de Diego (21/10/2026): un tercer stock, aparte de cocina y barra,
// para limpieza, papelería y mantenimiento. Se cuenta por salón igual que los
// otros dos (stock_salones con insumo_tipo 'limpieza') y el total es la suma
// de los salones.
//
// Precio y contenido por unidad (pedido de Rodrigo, 21/10/2026): se cargan
// para tenerlos a mano, pero por ahora NO entran en costos de eventos ni en
// cajas. Cuando se sumen a Caja Eventos, se toman de acá.
//
// Lógica pura (sin base ni React) para poder probarla sola
// (scripts/test-insumos-limpieza.cjs). La usan app/api/insumos-limpieza/** y
// la pantalla /admin/limpieza.

export interface ArticuloLimpieza {
  id: string
  descripcion: string
  unidad: string
  categoria: string | null
  /** Precio de una unidad (la de `unidad`). 0 = sin cargar. */
  precioUnitario: number
  /** Cuánto trae cada unidad, en gramos o cc (como Almacén y Barra). null = sin cargar. */
  contenidoCantidad: number | null
  contenidoUnidad: "GRS" | "CC" | null
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
  // Sin precio = 0 (sin cargar). Pesos con centavos, redondeado a 2 decimales.
  const precioCrudo = b.precioUnitario ?? 0
  const precio = typeof precioCrudo === "number" ? precioCrudo : Number(precioCrudo)
  if (!Number.isFinite(precio) || precio < 0) return { ok: false, error: "El precio no es válido" }
  if (precio > 1e10) return { ok: false, error: "El precio es demasiado alto" }
  const precioUnitario = Math.round(precio * 100) / 100
  // Contenido: 0 o vacío = sin cargar. Siempre en gramos o cc (la pantalla
  // deja escribir litros o kilos y los convierte).
  const contenidoCrudo = b.contenidoCantidad ?? 0
  const contenido = typeof contenidoCrudo === "number" ? contenidoCrudo : Number(contenidoCrudo)
  if (!Number.isFinite(contenido) || contenido < 0) return { ok: false, error: "El contenido no es válido" }
  let contenidoCantidad: number | null = null
  let contenidoUnidad: "GRS" | "CC" | null = null
  if (contenido > 0) {
    const u = typeof b.contenidoUnidad === "string" ? b.contenidoUnidad.trim().toUpperCase() : ""
    if (u !== "GRS" && u !== "CC") return { ok: false, error: "El contenido va en gramos o cc" }
    contenidoCantidad = Math.round(contenido * 1000) / 1000
    contenidoUnidad = u
  }
  return {
    ok: true,
    articulo: { id, descripcion, unidad, categoria: categoriaTexto || null, precioUnitario, contenidoCantidad, contenidoUnidad },
  }
}

/** Una fila de insumos_limpieza (numeric llega como texto) → artículo. */
export function articuloDesdeFila(f: {
  id: string
  descripcion: string
  unidad: string | null
  categoria: string | null
  precio_unitario?: string | number | null
  contenido_cantidad?: string | number | null
  contenido_unidad?: string | null
}): ArticuloLimpieza {
  const precio = Number(f.precio_unitario ?? 0)
  const contenido = Number(f.contenido_cantidad ?? 0)
  const unidadContenido = f.contenido_unidad === "GRS" || f.contenido_unidad === "CC" ? f.contenido_unidad : null
  const hayContenido = Number.isFinite(contenido) && contenido > 0 && unidadContenido !== null
  return {
    id: f.id,
    descripcion: f.descripcion,
    unidad: f.unidad || "UN",
    categoria: f.categoria,
    precioUnitario: Number.isFinite(precio) ? precio : 0,
    contenidoCantidad: hayContenido ? contenido : null,
    contenidoUnidad: hayContenido ? unidadContenido : null,
  }
}

/** "5 L", "500 g" o "sin cargar", para el historial y la tabla. */
export function describirContenido(cantidad: number | null, unidad: "GRS" | "CC" | null): string {
  if (!cantidad || cantidad <= 0 || !unidad) return "sin cargar"
  const fmt = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n)
  if (unidad === "CC") return cantidad >= 1000 ? `${fmt(cantidad / 1000)} L` : `${fmt(cantidad)} cc`
  return cantidad >= 1000 ? `${fmt(cantidad / 1000)} kg` : `${fmt(cantidad)} g`
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

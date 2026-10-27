// Vajilla y utensilios de cocina (tabla insumos_vajilla, scripts/028).
// Pedido de Rodrigo (27/10/2026): el inventario de lo que la cocina tiene
// guardado para trabajar (platos, cubiertos, tazas, ollas, sartenes,
// utensilios...). Se cuenta por salón como cocina, barra y limpieza
// (stock_salones con insumo_tipo 'vajilla') y el total es la suma de los
// salones.
//
// Es SOLO stock: no tiene precio y no entra en costos de eventos ni en las
// cajas. Lo arma y lo cuenta Cocina; Administración y Soporte lo ven.
//
// Lógica pura (sin base ni React) para poder probarla sola
// (scripts/test-stock-vajilla.cjs). La usan app/api/insumos-vajilla/** y la
// pantalla /admin/vajilla.

import { nombreRepetido } from "@/lib/insumos-limpieza"

export { nombreRepetido }

export interface ArticuloVajilla {
  id: string
  descripcion: string
  unidad: string
  categoria: string | null
}

/** Agrupan la lista de carga en /stock. Se puede escribir otra. */
export const CATEGORIAS_VAJILLA = ["Vajilla", "Cubiertos", "Cristalería", "Ollas y sartenes", "Utensilios", "Bandejas y fuentes"] as const

/** Las más comunes, para elegir rápido. Se puede escribir otra. */
export const UNIDADES_VAJILLA = ["UN", "JUEGO", "DOCENA", "CAJA", "PACK"] as const

/** El nombre de la sección, igual en el menú, la pantalla y el stock. */
export const NOMBRE_SECCION_VAJILLA = "Vajilla y utensilios"

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ValidacionArticuloVajilla =
  | { ok: true; articulo: ArticuloVajilla }
  | { ok: false; error: string }

/**
 * Valida lo que manda la pantalla al crear o editar un artículo. El id lo
 * genera la pantalla (uuid) para que un reintento no cree dos iguales; al
 * editar, el id viene de la dirección y se pasa en `idFijo`.
 */
export function validarArticuloVajilla(body: unknown, idFijo?: string): ValidacionArticuloVajilla {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const id = idFijo ?? (typeof b.id === "string" ? b.id.trim() : "")
  if (!idFijo && !RE_UUID.test(id)) return { ok: false, error: "Id inválido" }
  if (!id) return { ok: false, error: "Id inválido" }
  const descripcion = typeof b.descripcion === "string" ? b.descripcion.replace(/\s+/g, " ").trim() : ""
  if (!descripcion) return { ok: false, error: "Falta el nombre del artículo" }
  if (descripcion.length > 120) return { ok: false, error: "El nombre es demasiado largo" }
  const unidad = (typeof b.unidad === "string" ? b.unidad : "").trim().toUpperCase() || "UN"
  if (unidad.length > 20) return { ok: false, error: "La unidad es demasiado larga" }
  const categoria = typeof b.categoria === "string" ? b.categoria.replace(/\s+/g, " ").trim() : ""
  if (categoria.length > 40) return { ok: false, error: "La categoría es demasiado larga" }
  return { ok: true, articulo: { id, descripcion, unidad, categoria: categoria || null } }
}

/** Una fila de insumos_vajilla → artículo. */
export function articuloVajillaDesdeFila(f: {
  id: string
  descripcion: string
  unidad: string | null
  categoria: string | null
}): ArticuloVajilla {
  return { id: f.id, descripcion: f.descripcion, unidad: f.unidad || "UN", categoria: f.categoria || null }
}

/** La tabla todavía no existe (falta correr scripts/028_vajilla_cocina.sql). */
export function faltaTablaVajilla(err: unknown): boolean {
  return (err as { code?: string })?.code === "42P01"
}

export const AVISO_SIN_TABLA_VAJILLA =
  "Falta crear la tabla de vajilla y utensilios en la base (scripts/028_vajilla_cocina.sql)."

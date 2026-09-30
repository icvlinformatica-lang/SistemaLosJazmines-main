// Quién puede tocar qué de un insumo (tablas `insumos` y `insumos_barra`).
//
// El catálogo de insumos (unidad, contenido por unidad, precio, y también el
// stock) es de Administración y Soporte: la unidad, el contenido y el precio
// mueven los costos de recetas y menús, y el stock real ya no se edita acá —
// es la suma de los conteos por salón.
//
// COCINA y BARRA no entran a /admin/almacen ni a /admin/barra: su trabajo es
// contar lo que quedó en el salón (/stock, que escribe en stock_salones y de
// ahí sale el total). Si alguna vez se les devuelve alguna de esas pantallas,
// hay que devolverles también la ruta en lib/profile-context.tsx y volver a
// permitirla acá.
//
// Lógica pura, sin Request ni base, para poder probarla sola
// (scripts/test-insumos-permisos.cjs). Las rutas la usan en
// app/api/insumos[-barra]/**.

export type SectorInsumo = "cocina" | "barra"
export type AccionInsumo = "crear" | "editar" | "borrar"

const ACCESO_TOTAL = new Set(["administracion", "soporte"])

export interface Veredicto {
  ok: boolean
  /** Motivo para el usuario, en castellano. Solo cuando `ok` es false. */
  error?: string
}

const OK: Veredicto = { ok: true }

/**
 * ¿Puede este perfil hacer esta acción sobre un insumo de este sector?
 *
 * - Administración y Soporte: todo.
 * - El resto, incluidas Cocina y Barra: nada. Ninguno tiene estas pantallas en
 *   su menú; si aparece uno pegándole al endpoint, es que algo está mal.
 *
 * `sector`, `accion` y `campos` hoy no cambian la respuesta, pero se reciben
 * para que las rutas no tengan que cambiar si el día de mañana vuelve a haber
 * un permiso parcial.
 */
export function permisoInsumo({
  perfilId,
}: {
  perfilId: string | null | undefined
  sector: SectorInsumo
  accion: AccionInsumo
  campos?: string[]
}): Veredicto {
  if (ACCESO_TOTAL.has(perfilId ?? "")) return OK
  return {
    ok: false,
    error:
      perfilId === "cocina" || perfilId === "barra"
        ? "Los insumos los maneja Administración. El stock se carga desde Stock por salón."
        : "No tenés permiso para modificar insumos. Pedíselo a Administración.",
  }
}

/**
 * ¿Este perfil puede tocar el catálogo (descripción, unidad, contenido,
 * precio, proveedor)? Lo usan las pantallas para mostrar el formulario
 * completo o el chico; el que manda igual es el servidor (`permisoInsumo`).
 */
export function puedeEditarCatalogo(perfilId: string | null | undefined): boolean {
  return ACCESO_TOTAL.has(perfilId ?? "")
}

// Quién puede tocar qué de un insumo (tablas `insumos` y `insumos_barra`).
//
// Ahora que el stock real es la suma de los conteos por salón, Cocina entra a
// /admin/almacen para ver y ajustar existencias, pero NO es dueña del
// catálogo: la unidad, el contenido por unidad y el precio mueven costos de
// recetas y menús, así que quedan para Administración y Soporte.
//
// BARRA no entra a /admin/barra: su trabajo es contar lo que quedó en el salón
// (/stock, que escribe en stock_salones y de ahí sale el total). No tiene nada
// que hacer en el catálogo de insumos de bebidas, así que acá tampoco pasa —
// si alguna vez se le devuelve esa pantalla, hay que devolverle también la
// ruta en lib/profile-context.tsx y volver a permitirla acá.
//
// Lógica pura, sin Request ni base, para poder probarla sola
// (scripts/test-insumos-permisos.cjs). Las rutas la usan en
// app/api/insumos[-barra]/**.

export type SectorInsumo = "cocina" | "barra"
export type AccionInsumo = "crear" | "editar" | "borrar"

/** Lo ÚNICO que Cocina y Barra pueden mandar en un editar. */
export const CAMPOS_STOCK = new Set(["stockActual"])

/**
 * Claves del body que no son un campo a guardar y por eso no se miran: el id
 * viene en la URL y algunas pantallas lo mandan igual dentro del objeto.
 */
const CLAVES_IGNORADAS = new Set(["id"])

const ACCESO_TOTAL = new Set(["administracion", "soporte"])

export interface Veredicto {
  ok: boolean
  /** Motivo para el usuario, en castellano. Solo cuando `ok` es false. */
  error?: string
}

const OK: Veredicto = { ok: true }

function nombrePerfil(perfilId: string | null | undefined): string {
  if (perfilId === "cocina") return "Cocina"
  return "Tu perfil"
}

/**
 * ¿Puede este perfil hacer esta acción sobre un insumo de este sector?
 *
 * - Administración y Soporte: todo.
 * - Cocina: solo editar el stock de `insumos`. Crear y borrar, nunca.
 * - El resto, incluida Barra: nada. Ninguno tiene esta pantalla en su menú;
 *   si aparece uno pegándole al endpoint, es que algo está mal.
 *
 * `campos` son las claves del body del editar. Un campo no permitido NO se
 * ignora en silencio: se devuelve el error, así se nota si una pantalla lo
 * está mandando sin querer.
 */
export function permisoInsumo({
  perfilId,
  sector,
  accion,
  campos = [],
}: {
  perfilId: string | null | undefined
  sector: SectorInsumo
  accion: AccionInsumo
  campos?: string[]
}): Veredicto {
  if (ACCESO_TOTAL.has(perfilId ?? "")) return OK

  // Cocina es la única que ajusta stock por acá, y solo sobre `insumos`.
  if (perfilId !== "cocina" || sector !== "cocina") {
    return {
      ok: false,
      error:
        perfilId === "cocina"
          ? "Cocina no puede tocar los insumos de barra."
          : perfilId === "barra"
            ? "Barra no edita el catálogo de bebidas: el stock se carga desde Stock por salón."
            : "No tenés permiso para modificar insumos. Pedíselo a Administración.",
    }
  }

  if (accion !== "editar") {
    return {
      ok: false,
      error: `${nombrePerfil(perfilId)} solo puede ajustar el stock: ${
        accion === "crear" ? "crear" : "borrar"
      } insumos es de Administración.`,
    }
  }

  const prohibidos = campos.filter((c) => !CAMPOS_STOCK.has(c) && !CLAVES_IGNORADAS.has(c))
  if (prohibidos.length > 0) {
    return {
      ok: false,
      error: `${nombrePerfil(perfilId)} solo puede cambiar el stock. No se puede tocar: ${prohibidos.join(", ")}.`,
    }
  }

  return OK
}

/**
 * ¿Este perfil puede tocar el catálogo (descripción, unidad, contenido,
 * precio, proveedor), o solo ajustar existencias? Lo usan las pantallas para
 * mostrar el formulario completo o el chico; el que manda igual es el
 * servidor (`permisoInsumo`). Hoy el "solo existencias" es Cocina: Barra ya no
 * llega a esa pantalla.
 */
export function puedeEditarCatalogo(perfilId: string | null | undefined): boolean {
  return ACCESO_TOTAL.has(perfilId ?? "")
}

// Quién puede tocar qué de un insumo (tablas `insumos` y `insumos_barra`).
//
// Ahora que el stock real es la suma de los conteos por salón, Cocina y Barra
// entran a /admin/almacen y /admin/barra para ver y ajustar existencias, pero
// NO son dueños del catálogo: la unidad, el contenido por unidad y el precio
// mueven costos de recetas, menús y barras, así que quedan para Administración
// y Soporte.
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
  if (perfilId === "barra") return "Barra"
  return "Tu perfil"
}

/**
 * ¿Puede este perfil hacer esta acción sobre un insumo de este sector?
 *
 * - Administración y Soporte: todo.
 * - Cocina: solo editar el stock de `insumos`. Barra: ídem sobre
 *   `insumos_barra`. Crear y borrar, nunca.
 * - El resto de los perfiles: nada. Ninguno tiene estas pantallas en su menú;
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

  if (perfilId !== sector) {
    return {
      ok: false,
      error:
        perfilId === "cocina" || perfilId === "barra"
          ? `${nombrePerfil(perfilId)} no puede tocar los insumos de ${sector === "cocina" ? "cocina" : "barra"}.`
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
 * servidor (`permisoInsumo`).
 */
export function puedeEditarCatalogo(perfilId: string | null | undefined): boolean {
  return ACCESO_TOTAL.has(perfilId ?? "")
}

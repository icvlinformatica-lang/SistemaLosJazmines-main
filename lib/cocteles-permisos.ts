// Quién puede tocar la carta de cócteles, y quién ve lo que cuestan.
//
// Barra entra a /admin/cocteles solo para consultar de qué está hecho cada
// cóctel: qué insumos lleva y cuánto de cada uno. No ve precios ni costos, y
// no puede crear, editar ni borrar nada. La receta de un cóctel define el
// costo de la barra de un evento, así que se maneja desde Administración.
//
// Barra tampoco entra a /admin/barra (el catálogo de insumos de bebidas): ahí
// se editan unidades y precios. Eso se define en `rutas` de su perfil
// (lib/profile-context.tsx) y lo aplica components/app-shell.tsx.
//
// Lógica pura, sin Request ni base, para poder probarla sola
// (scripts/test-cocteles-permisos.cjs).

const ACCESO_TOTAL = new Set(["administracion", "soporte"])

/** Crear, editar o borrar un cóctel. Solo Administración y Soporte. */
export function puedeEditarCocteles(perfilId: string | null | undefined): boolean {
  return ACCESO_TOTAL.has(perfilId ?? "")
}

/**
 * Ver el costo de un cóctel. Mismo criterio que editar: el costo sale de los
 * precios de los insumos, que es información interna del negocio.
 */
export function puedeVerCostosCocteles(perfilId: string | null | undefined): boolean {
  return ACCESO_TOTAL.has(perfilId ?? "")
}

/** Motivo para devolver en el 403, en castellano. */
export const ERROR_SIN_PERMISO_COCTELES =
  "Solo Administración puede cambiar la carta de cócteles. Desde Barra se pueden consultar, no editar."

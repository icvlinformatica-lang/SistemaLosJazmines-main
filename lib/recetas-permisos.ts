// Quién puede tocar el recetario (tablas `recetas` y `receta_insumos`).
//
// La receta de un plato define el costo de la comida de un evento, y con eso el
// reparto entre Caja Eventos y Caja Jazmines, así que el recetario es de
// Administración y Soporte. Cocina NO entra a /admin/recetario (ver `rutas` de
// su perfil en lib/profile-context.tsx, que aplica components/app-shell.tsx);
// esto cierra además el servidor, con el perfil del token firmado.
//
// Leer recetas (GET) sigue abierto: las guías de producción y la lista de
// compras de Cocina las necesitan.
//
// Lógica pura, sin Request ni base, para poder probarla sola
// (scripts/test-recetas-permisos.cjs).

const ACCESO_TOTAL = new Set(["administracion", "soporte"])

/** Crear, editar o borrar una receta. Solo Administración y Soporte. */
export function puedeEditarRecetas(perfilId: string | null | undefined): boolean {
  return ACCESO_TOTAL.has(perfilId ?? "")
}

/** Motivo para devolver en el 403, en castellano. */
export const ERROR_SIN_PERMISO_RECETAS = "Solo Administración puede cambiar el recetario."

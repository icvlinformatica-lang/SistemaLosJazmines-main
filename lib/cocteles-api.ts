// Cómo viaja un cóctel entre la tabla `cocteles` y la pantalla.
//
// La API solo devolvía id, nombre, categoría e instrucciones, y al guardar
// solo escribía nombre y categoría: el código, la descripción, la imagen y la
// preparación que se cargaban en el formulario se perdían sin aviso, y la
// preparación ya cargada (columna `instrucciones`) nunca se mostraba porque la
// pantalla la lee como `preparacion`.
//
// La preparación vive en `instrucciones` (es donde está cargada). La columna
// `preparacion` de la tabla está vacía y no se usa. Se aceptan los dos nombres
// al guardar: la pantalla manda `preparacion` y la restauración de copias de
// Configuración manda `instrucciones`.
//
// Lógica pura, sin base, para poder probarla sola (scripts/test-cocteles-api.cjs).

export interface FilaCoctel {
  id: string
  codigo?: string | null
  nombre: string
  descripcion?: string | null
  imagen?: string | null
  categoria?: string | null
  instrucciones?: string | null
  preparacion?: string | null
}

export interface InsumoCoctelApi {
  insumoBarraId: string
  cantidadPorCoctel: number
  unidadCoctel?: string
}

/** Fila de la base → objeto que usa la pantalla. */
export function filaACoctel(fila: FilaCoctel, insumos: InsumoCoctelApi[]) {
  const preparacion = fila.instrucciones || fila.preparacion || ""
  return {
    id: fila.id,
    codigo: fila.codigo || "",
    nombre: fila.nombre,
    descripcion: fila.descripcion || "",
    imagen: fila.imagen || "",
    categoria: fila.categoria || "Con Alcohol",
    preparacion,
    // Nombre viejo, por compatibilidad con la copia de seguridad.
    instrucciones: preparacion,
    insumos,
  }
}

/**
 * Campos de texto a guardar desde el body. `undefined` = no vino, no se toca
 * (el UPDATE usa COALESCE); un texto vacío sí se guarda (sirve para borrar).
 */
export function camposDelBody(body: Record<string, unknown>) {
  const texto = (v: unknown): string | null => (typeof v === "string" ? v : null)
  return {
    codigo: texto(body.codigo),
    nombre: texto(body.nombre),
    descripcion: texto(body.descripcion),
    imagen: texto(body.imagen),
    categoria: texto(body.categoria),
    instrucciones: texto(body.preparacion) ?? texto(body.instrucciones),
  }
}

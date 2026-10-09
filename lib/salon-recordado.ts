/**
 * Recordar el último salón elegido en Caja Eventos y Caja Jazmines.
 *
 * Antes había que elegir el salón cada vez que se entraba a la caja. Ahora se
 * guarda la elección en el navegador (solo es una comodidad de pantalla: no
 * toca datos ni plata). Si el navegador no deja guardar, o lo guardado ya no
 * es un salón válido (por ejemplo, un salón que se dio de baja), se abre el
 * selector como siempre.
 */

/** Interfaz mínima de localStorage (así se puede probar sin navegador). */
export interface AlmacenSimple {
  getItem(clave: string): string | null
  setItem(clave: string, valor: string): void
}

/** Clave por pantalla, para que cada caja recuerde su propio salón. */
export function claveSalonRecordado(pantalla: string): string {
  return `lj:salon-recordado:${pantalla}`
}

/**
 * Devuelve el salón guardado si sigue siendo válido, o null.
 * "todos" (Todos los salones) también es válido si se pasa en la lista.
 * Nunca tira error: en modo privado o con datos bloqueados devuelve null.
 */
export function leerSalonRecordado(
  almacen: AlmacenSimple | null | undefined,
  pantalla: string,
  validos: readonly string[],
): string | null {
  if (!almacen) return null
  try {
    const valor = almacen.getItem(claveSalonRecordado(pantalla))
    if (typeof valor !== "string" || valor === "") return null
    return validos.includes(valor) ? valor : null
  } catch {
    return null
  }
}

/** Guarda el salón elegido. Si el navegador no deja, no pasa nada. */
export function guardarSalonRecordado(
  almacen: AlmacenSimple | null | undefined,
  pantalla: string,
  salon: string,
): void {
  if (!almacen) return
  try {
    almacen.setItem(claveSalonRecordado(pantalla), salon)
  } catch {
    // Sin almacenamiento disponible: la próxima vez se vuelve a preguntar.
  }
}

/** localStorage del navegador, o null si no existe o el acceso tira error. */
export function almacenDelNavegador(): AlmacenSimple | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage ?? null
  } catch {
    return null
  }
}

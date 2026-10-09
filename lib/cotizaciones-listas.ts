// Filtros de "Mis cotizaciones" del vendedor (/vendedor/paquetes) y los
// conteos de su inicio (/vendedor). Funciones puras, para que el inicio y la
// lista cuenten igual y para poder probarlas (scripts/test-cotizaciones-listas.cjs).
// Solo pantalla: no cambian ningún dato guardado.
import type { EstadoCotizacion } from "./estado-cotizacion"

export type FiltroCotizacion = "todas" | "borrador" | "rechazada" | "lista_para_revisar" | "convertida"

/** Botones de filtro, en el orden en que se muestran. Etiquetas cortas
 *  (para el celular) de los estados de lib/estado-cotizacion.ts. "Aprobada"
 *  no tiene botón: es un paso intermedio que dura segundos (al aprobar se
 *  crea el evento y pasa a "convertida"); queda en "Todas". */
export const FILTROS_COTIZACION: Array<{ clave: FiltroCotizacion; etiqueta: string }> = [
  { clave: "todas", etiqueta: "Todas" },
  { clave: "borrador", etiqueta: "Sin enviar" },
  { clave: "rechazada", etiqueta: "Rechazadas" },
  { clave: "lista_para_revisar", etiqueta: "Esperando revisión" },
  { clave: "convertida", etiqueta: "Convertidas en evento" },
]

/** Filtro inicial desde la dirección (?estado=rechazada). Cualquier otra cosa: "todas". */
export function filtroDesdeParam(param: string | null | undefined): FiltroCotizacion {
  return FILTROS_COTIZACION.some((f) => f.clave === param) ? (param as FiltroCotizacion) : "todas"
}

/** Cuántas hay en cada botón. */
export function contarPorFiltro(lista: Array<{ estado: EstadoCotizacion | string }>): Record<FiltroCotizacion, number> {
  const conteo: Record<FiltroCotizacion, number> = { todas: lista.length, borrador: 0, rechazada: 0, lista_para_revisar: 0, convertida: 0 }
  for (const c of lista) {
    if (c.estado !== "todas" && c.estado in conteo) conteo[c.estado as FiltroCotizacion] += 1
  }
  return conteo
}

/** Sin mayúsculas ni tildes, para buscar "jose" y encontrar "José". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

export function filtrarCotizaciones<T extends { estado: string; clienteNombre: string }>(
  lista: T[],
  filtro: FiltroCotizacion,
  busqueda: string,
): T[] {
  const buscado = normalizar(busqueda)
  return lista.filter(
    (c) => (filtro === "todas" || c.estado === filtro) && (!buscado || normalizar(c.clienteNombre || "").includes(buscado)),
  )
}

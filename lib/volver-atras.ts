// Flecha de "volver" de arriba: lleva a la pantalla de la que se vino, como el
// botón "atrás" del navegador. Solo vuelve atrás si la pantalla anterior es de
// este mismo sistema (y no es el login); si se entró directo (link, pestaña
// nueva, recarga sin historial) la flecha va a la pantalla fija de siempre.
//
// Usa la Navigation API del navegador (`window.navigation`), que dice con
// exactitud cuál es la entrada anterior del historial de esta pestaña. Si el
// navegador no la tiene, la flecha sigue funcionando como antes (pantalla fija).

export type EntradaHistorial = { url: string | null; index: number }

export type NavegacionDelNavegador = {
  canGoBack?: boolean
  currentEntry?: EntradaHistorial | null
  entries?: () => EntradaHistorial[]
}

/**
 * Cuántos pasos hay que ir para atrás para llegar a la pantalla anterior del
 * sistema, o 0 si no hay (se entró directo, la anterior es de otro sitio o es
 * el login). Las entradas de la misma pantalla que la actual (por ejemplo
 * Contratos y Contratos con un evento elegido) se saltean: volver a ellas no
 * cambia nada a la vista y la flecha parecía no andar.
 */
export function pasosParaVolver(nav: NavegacionDelNavegador | null | undefined, origen: string): number {
  if (!nav || !nav.canGoBack || !nav.currentEntry || typeof nav.entries !== "function") return 0
  const actual = nav.currentEntry
  const entradas = nav.entries()
  const pantallaActual = pantallaDe(actual.url, origen)
  for (let i = actual.index - 1; i >= 0; i--) {
    const entrada = entradas.find((e) => e.index === i)
    const pantalla = entrada ? pantallaDe(entrada.url, origen) : null
    if (!pantalla) return 0
    if (pantalla === "/login") return 0
    if (pantalla !== pantallaActual) return actual.index - i
  }
  return 0
}

/** true si "atrás" lleva a otra pantalla de este sistema (que no sea el login). */
export function puedeVolverAtras(nav: NavegacionDelNavegador | null | undefined, origen: string): boolean {
  return pasosParaVolver(nav, origen) > 0
}

/** La ruta (sin ?…) de una dirección de este sistema, o null si es de otro sitio. */
function pantallaDe(direccion: string | null, origen: string): string | null {
  if (!direccion) return null
  try {
    const url = new URL(direccion)
    return url.origin === origen ? url.pathname : null
  } catch {
    return null
  }
}

/** Lee la Navigation API del navegador, si existe. */
export function navegacionDelNavegador(): NavegacionDelNavegador | null {
  if (typeof window === "undefined") return null
  return ((window as unknown as { navigation?: NavegacionDelNavegador }).navigation) ?? null
}

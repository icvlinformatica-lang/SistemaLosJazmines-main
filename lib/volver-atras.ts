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

/** true si "atrás" lleva a otra pantalla de este sistema (que no sea el login). */
export function puedeVolverAtras(nav: NavegacionDelNavegador | null | undefined, origen: string): boolean {
  if (!nav || !nav.canGoBack || !nav.currentEntry || typeof nav.entries !== "function") return false
  const anterior = nav.entries().find((e) => e.index === nav.currentEntry!.index - 1)
  if (!anterior?.url) return false
  let url: URL
  try {
    url = new URL(anterior.url)
  } catch {
    return false
  }
  if (url.origin !== origen) return false
  if (url.pathname === "/login") return false
  return true
}

/** Lee la Navigation API del navegador, si existe. */
export function navegacionDelNavegador(): NavegacionDelNavegador | null {
  if (typeof window === "undefined") return null
  return ((window as unknown as { navigation?: NavegacionDelNavegador }).navigation) ?? null
}

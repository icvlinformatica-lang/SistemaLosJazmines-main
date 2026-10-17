// Botón "Instalar app" de Inicio: decide qué mostrar según el aparato.
// En Android (Chrome) el navegador ofrece instalar en un toque; en iPhone y
// iPad no existe ese toque y hay que explicar los pasos de Safari. Funciones
// puras (sin window) para poder probarlas.

export type PlataformaInstalacion = "ios" | "android" | "compu"

/**
 * De qué aparato se trata. El iPad nuevo se presenta como una Mac, pero tiene
 * pantalla táctil: por eso se mira también maxTouchPoints.
 */
export function plataformaInstalacion(userAgent: string, maxTouchPoints = 0): PlataformaInstalacion {
  const ua = userAgent || ""
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios"
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "ios"
  if (/Android/i.test(ua)) return "android"
  return "compu"
}

/**
 * Si la app ya se abrió instalada (desde el ícono de la pantalla de inicio),
 * el botón no tiene sentido. displayModeStandalone sale de
 * matchMedia("(display-mode: standalone)"); navigatorStandalone es el dato
 * propio de Safari en iPhone.
 */
export function yaInstalada(displayModeStandalone: boolean, navigatorStandalone?: boolean): boolean {
  return displayModeStandalone || navigatorStandalone === true
}

/** Pasos a mano para cada aparato, cuando el navegador no ofrece instalar solo. */
export const PASOS_INSTALACION: Record<PlataformaInstalacion, string[]> = {
  ios: [
    "Abrí el sistema en Safari.",
    "Tocá el botón Compartir (el cuadradito con la flecha para arriba).",
    "Elegí \"Agregar a pantalla de inicio\" y después \"Agregar\".",
  ],
  android: [
    "Abrí el sistema en Chrome.",
    "Tocá el menú de los tres puntitos, arriba a la derecha.",
    "Elegí \"Instalar app\" o \"Agregar a pantalla de inicio\" y confirmá.",
  ],
  compu: [
    "Abrí el sistema en Chrome o Edge.",
    "Tocá el ícono de instalar, a la derecha de la barra de direcciones.",
    "Confirmá con \"Instalar\".",
  ],
}

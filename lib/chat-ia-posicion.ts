// Dónde va el botón flotante del asistente con IA y dónde se abre su chat.
// El botón arranca arriba a la izquierda, al lado del panel lateral, y se
// puede arrastrar a cualquier lado; el chat se abre pegado al botón, hacia
// donde haya lugar. Funciones puras (sin window) para poder probarlas.

export interface Punto {
  x: number
  y: number
}

export interface Pantalla {
  ancho: number
  alto: number
}

/** Tamaño del botón redondo, en px (h-12 w-12). */
export const TAM_BOTON_IA = 48
/** Distancia mínima a los bordes de la pantalla. */
export const MARGEN_IA = 12
/** Lo que hay que mover el dedo o el mouse para que cuente como arrastre y no como toque. */
export const UMBRAL_ARRASTRE_IA = 6

/** Posición inicial: arriba a la izquierda del contenido (a la derecha del panel lateral). */
export function posicionInicialBoton(bordeIzquierdoContenido: number): Punto {
  return { x: Math.max(0, bordeIzquierdoContenido) + MARGEN_IA, y: MARGEN_IA }
}

/** Mantiene el botón entero dentro de la pantalla (por ejemplo, al achicar la ventana). */
export function ajustarBoton(p: Punto, pantalla: Pantalla): Punto {
  const maxX = Math.max(MARGEN_IA, pantalla.ancho - TAM_BOTON_IA - MARGEN_IA)
  const maxY = Math.max(MARGEN_IA, pantalla.alto - TAM_BOTON_IA - MARGEN_IA)
  return {
    x: Math.min(Math.max(p.x, MARGEN_IA), maxX),
    y: Math.min(Math.max(p.y, MARGEN_IA), maxY),
  }
}

/** Tamaño del chat: hasta 384 × 544 px, o lo que entre. */
export function tamanoPanel(pantalla: Pantalla): { ancho: number; alto: number } {
  return {
    ancho: Math.min(384, pantalla.ancho - 2 * MARGEN_IA),
    alto: Math.min(544, pantalla.alto - TAM_BOTON_IA - 3 * MARGEN_IA),
  }
}

/**
 * Dónde se abre el chat: debajo del botón si está en la mitad de arriba,
 * encima si está abajo; alineado a su izquierda si está a la izquierda y a
 * su derecha si está a la derecha. Siempre entero dentro de la pantalla.
 */
export function posicionPanel(boton: Punto, pantalla: Pantalla): Punto & { ancho: number; alto: number } {
  const { ancho, alto } = tamanoPanel(pantalla)
  const centroX = boton.x + TAM_BOTON_IA / 2
  const centroY = boton.y + TAM_BOTON_IA / 2
  let x = centroX < pantalla.ancho / 2 ? boton.x : boton.x + TAM_BOTON_IA - ancho
  let y = centroY < pantalla.alto / 2 ? boton.y + TAM_BOTON_IA + 8 : boton.y - 8 - alto
  x = Math.min(Math.max(x, MARGEN_IA), Math.max(MARGEN_IA, pantalla.ancho - ancho - MARGEN_IA))
  y = Math.min(Math.max(y, MARGEN_IA), Math.max(MARGEN_IA, pantalla.alto - alto - MARGEN_IA))
  return { x, y, ancho, alto }
}

/** Lee la posición guardada en el navegador; null si no hay o está rota. */
export function leerPosicionGuardada(texto: string | null): Punto | null {
  if (!texto) return null
  try {
    const p = JSON.parse(texto)
    if (typeof p?.x === "number" && typeof p?.y === "number" && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      return { x: p.x, y: p.y }
    }
  } catch {
    // posición rota: se usa la inicial
  }
  return null
}

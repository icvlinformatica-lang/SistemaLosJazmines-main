"use client"

import { useState, type PointerEvent } from "react"

/**
 * Plegado de las tarjetas de métricas de arriba en Caja Eventos y Caja
 * Jazmines. El monto principal de cada tarjeta se ve siempre; lo que se
 * pliega es solo el detalle (la línea de abajo).
 *
 * - Con mouse: pasar el cursor por el grupo despliega el detalle y sacarlo lo
 *   vuelve a plegar (como antes).
 * - Con el dedo o el teclado: el chevron de cada tarjeta despliega/pliega
 *   todo el grupo con un toque. El hover se escucha solo para punteros de
 *   mouse, porque en el celular el toque dispara un "mouseenter" falso que
 *   abría y no dejaba volver a cerrar.
 */
export function useTarjetasPlegables() {
  const [porHover, setPorHover] = useState(false)
  const [fijadas, setFijadas] = useState(false)
  const abiertas = porHover || fijadas

  return {
    abiertas,
    /** Abre el detalle (sin cerrarlo si ya estaba abierto). */
    abrir: () => setFijadas(true),
    /** Toque/clic en el chevron: si está abierto lo pliega, si no lo abre. */
    alternar: () => {
      if (abiertas) {
        setFijadas(false)
        setPorHover(false)
      } else {
        setFijadas(true)
      }
    },
    /** Props para el contenedor del grupo de tarjetas. */
    propsGrupo: {
      onPointerEnter: (e: PointerEvent) => {
        if (e.pointerType === "mouse") setPorHover(true)
      },
      onPointerLeave: (e: PointerEvent) => {
        if (e.pointerType === "mouse") setPorHover(false)
      },
    },
  }
}

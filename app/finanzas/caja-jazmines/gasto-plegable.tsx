"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

/**
 * Lógica de plegado por hover, compartida por los gastos individuales y
 * por las tarjetas grandes de Caja Jazmines.
 *
 * Comportamiento pedido por el usuario:
 * - El contenido arranca PLEGADO.
 * - Se despliega automáticamente si el mouse queda encima al menos
 *   0,5 segundos. Pasadas rápidas (menos de 0,5s) no lo despliegan.
 * - Al sacar el mouse, espera 2 segundos antes de volver a plegarse.
 * - No se pliega mientras haya un popover, menú o diálogo abierto (se está
 *   operando adentro); reintenta cada segundo hasta que cierre.
 * - También se despliega si el teclado enfoca algo adentro (accesibilidad).
 */
export function useHoverPlegado() {
  const [abierto, setAbierto] = useState(false)
  const timerAbrir = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerCerrar = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Limpia los timers al desmontar para no setear estado en un componente muerto
  useEffect(
    () => () => {
      if (timerAbrir.current) clearTimeout(timerAbrir.current)
      if (timerCerrar.current) clearTimeout(timerCerrar.current)
    },
    [],
  )

  function programarCierre(ms: number) {
    if (timerCerrar.current) clearTimeout(timerCerrar.current)
    timerCerrar.current = setTimeout(() => {
      timerCerrar.current = null
      // Con un popover/menú/diálogo abierto el usuario sigue operando:
      // esperar a que lo cierre antes de plegar.
      if (document.querySelector("[data-slot=popover-content], [role=menu], [role=dialog]")) {
        programarCierre(1000)
        return
      }
      setAbierto(false)
    }, ms)
  }

  function alEntrar() {
    if (timerCerrar.current) {
      clearTimeout(timerCerrar.current)
      timerCerrar.current = null
    }
    if (!abierto && !timerAbrir.current) {
      timerAbrir.current = setTimeout(() => {
        timerAbrir.current = null
        setAbierto(true)
      }, 500)
    }
  }

  function alSalir() {
    if (timerAbrir.current) {
      clearTimeout(timerAbrir.current)
      timerAbrir.current = null
    }
    if (abierto) programarCierre(2000)
  }

  function alEnfocar() {
    if (timerCerrar.current) {
      clearTimeout(timerCerrar.current)
      timerCerrar.current = null
    }
    setAbierto(true)
  }

  /** Props para esparcir en el contenedor que dispara el hover. */
  const props = {
    onMouseEnter: alEntrar,
    onMouseLeave: alSalir,
    onFocusCapture: alEnfocar,
  }

  return { abierto, props }
}

/**
 * Tarjeta de gasto fijo con contenido plegable por hover: solo se ve el
 * encabezado hasta que el mouse queda encima (ver useHoverPlegado).
 */
export function GastoPlegable({ header, children }: { header: ReactNode; children?: ReactNode }) {
  const { abierto, props } = useHoverPlegado()

  return (
    <div className="rounded-lg border border-border bg-card" {...props}>
      {header}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          abierto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

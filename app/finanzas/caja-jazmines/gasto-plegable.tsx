"use client"

import { Children, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

/**
 * Lógica de plegado por hover, compartida por los gastos individuales y
 * por las tarjetas grandes de Caja Jazmines.
 *
 * Comportamiento pedido por el usuario:
 * - El contenido arranca PLEGADO.
 * - Se despliega automáticamente si el mouse queda encima al menos
 *   0,5 segundos. Pasadas rápidas (menos de 0,5s) no lo despliegan.
 * - Al sacar el mouse, espera 2 segundos antes de volver a plegarse.
 * - Un click en cualquier parte "vacía" de la tarjeta la abre o la cierra al
 *   instante (los clicks sobre botones, links o inputs internos no cuentan).
 * - No se pliega mientras haya un popover, menú o diálogo abierto (se está
 *   operando adentro); reintenta cada segundo hasta que cierre.
 * - También se despliega si el teclado enfoca algo adentro (accesibilidad).
 */
export function useHoverPlegado({ hover = true, inicial = false }: { hover?: boolean; inicial?: boolean } = {}) {
  const [abierto, setAbierto] = useState(inicial)
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

  function alClick(e: ReactMouseEvent) {
    // Los controles internos (botones, links, inputs, menús) conservan su
    // acción propia: solo el click sobre zona "vacía" alterna la tarjeta.
    const objetivo = e.target as HTMLElement
    if (objetivo.closest("button, a, input, select, textarea, label, [role=menu], [data-slot=popover-content]")) {
      return
    }
    if (timerAbrir.current) {
      clearTimeout(timerAbrir.current)
      timerAbrir.current = null
    }
    if (timerCerrar.current) {
      clearTimeout(timerCerrar.current)
      timerCerrar.current = null
    }
    setAbierto((v) => !v)
  }

  /**
   * Props para esparcir en el contenedor. Con `hover: false` (Caja Jazmines
   * desde el 14/10/2026) solo el click abre y cierra: nada se pliega solo.
   */
  const props = hover
    ? {
        onMouseEnter: alEntrar,
        onMouseLeave: alSalir,
        onFocusCapture: alEnfocar,
        onClick: alClick,
      }
    : { onClick: alClick }

  return { abierto, props, alternar: () => setAbierto((v) => !v) }
}

/**
 * Cuerpo plegable con la MISMA animación que las tarjetas del dashboard
 * (CuerpoColapsable de las métricas): transición suave de altura con
 * grid-rows + fundido de opacidad, 700ms ease-in-out.
 *
 * El contenido se monta al abrir y se desmonta 700ms después de cerrar
 * (cuando termina la animación), para no pagar el costo de listas grandes
 * mientras la tarjeta está plegada.
 */
export function CuerpoTarjeta({ abierto, children }: { abierto: boolean; children: ReactNode }) {
  const [renderizar, setRenderizar] = useState(abierto)

  useEffect(() => {
    if (abierto) {
      setRenderizar(true)
      return
    }
    const t = setTimeout(() => setRenderizar(false), 700)
    return () => clearTimeout(t)
  }, [abierto])

  return (
    <div
      className={`grid transition-all duration-700 ease-in-out ${
        abierto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="overflow-hidden flex min-h-0 flex-col">{renderizar ? children : null}</div>
    </div>
  )
}

/**
 * Tarjeta de gasto fijo con contenido plegable: se abre y cierra con un click
 * en la fila o en la flecha de la derecha (no se pliega sola).
 */
export function GastoPlegable({ header, children }: { header: ReactNode; children?: ReactNode }) {
  const { abierto, props, alternar } = useHoverPlegado({ hover: false })

  return (
    <div
      className={`rounded-lg border bg-card transition-shadow ${abierto ? "border-purple-200 shadow-sm" : "border-border"}`}
    >
      {/* Solo la fila de arriba abre/cierra: tocar dentro de los meses no lo pliega. */}
      <div className="flex items-center" {...props}>
        <div className="min-w-0 flex-1 cursor-pointer">{header}</div>
        {Children.toArray(children).length > 0 ? (
          <button
            type="button"
            onClick={alternar}
            aria-expanded={abierto}
            className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={abierto ? "Ocultar meses" : "Ver meses y pagar"}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`} />
            <span className="sr-only">{abierto ? "Ocultar meses" : "Ver meses y pagar"}</span>
          </button>
        ) : null}
      </div>
      <CuerpoTarjeta abierto={abierto}>{children}</CuerpoTarjeta>
    </div>
  )
}

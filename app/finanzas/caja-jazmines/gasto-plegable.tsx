"use client"

import { useEffect, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react"

/**
 * Plegado con un clic, compartido por los gastos individuales y por las
 * tarjetas de Caja Jazmines que no tienen flechita propia.
 *
 * Comportamiento pedido por el dueño:
 * - El contenido arranca PLEGADO.
 * - Se abre o se cierra con un clic sobre una parte "vacía" (los clics sobre
 *   botones, links, inputs o menús internos hacen lo suyo y no cuentan).
 * - Pasar el mouse por encima NO lo abre (pedido del 13/10/2026): eso queda
 *   solo para el dashboard de arriba (useTarjetasPlegables).
 */

/**
 * Controles con acción propia: un clic sobre ellos no abre ni cierra la
 * tarjeta. Un botón marcado con data-alterna-plegado (por ejemplo el nombre
 * de un gasto cuando no abre nada) sí cuenta como parte de la tarjeta.
 */
const CONTROLES =
  "button:not([data-alterna-plegado]), a, input, select, textarea, label, [role=menu], [data-slot=popover-content]"

/** true si el clic fue sobre un control con acción propia (no abre ni cierra). */
export function esClicEnControl(e: ReactMouseEvent): boolean {
  return (e.target as HTMLElement).closest(CONTROLES) !== null
}

export function usePlegadoConClick() {
  const [abierto, setAbierto] = useState(false)

  function alClick(e: ReactMouseEvent) {
    if (esClicEnControl(e)) return
    setAbierto((v) => !v)
  }

  /** Props para esparcir en la zona que abre y cierra con un clic. */
  return { abierto, props: { onClick: alClick } }
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
 * Tarjeta de gasto fijo con contenido plegable: solo se ve el encabezado
 * hasta que se le hace clic (ver usePlegadoConClick).
 */
export function GastoPlegable({ header, children }: { header: ReactNode; children?: ReactNode }) {
  const { abierto, props } = usePlegadoConClick()

  return (
    <div className="cursor-pointer rounded-lg border border-border bg-card" {...props}>
      {header}
      <CuerpoTarjeta abierto={abierto}>{children}</CuerpoTarjeta>
    </div>
  )
}

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, type ComponentProps, type MouseEvent } from "react"
import { navegacionDelNavegador, pasosParaVolver } from "@/lib/volver-atras"

/**
 * Devuelve una función que vuelve a la pantalla anterior del sistema o, si no
 * hay (se entró directo), va a `destinoFijo`.
 */
export function useVolverAtras(destinoFijo: string) {
  const router = useRouter()
  return useCallback(() => {
    if (!volverPasos(router)) router.push(destinoFijo)
  }, [router, destinoFijo])
}

/**
 * Va atrás hasta la pantalla anterior del sistema (salteando las entradas de la
 * misma pantalla). Devuelve false si no hay a dónde volver.
 */
function volverPasos(router: ReturnType<typeof useRouter>): boolean {
  const pasos = pasosParaVolver(navegacionDelNavegador(), window.location.origin)
  if (pasos <= 0) return false
  if (pasos === 1) router.back()
  else window.history.go(-pasos)
  return true
}

/**
 * Link de la flecha de "volver". `href` es la pantalla fija de siempre: se usa
 * si no hay una pantalla anterior del sistema, y para abrir en otra pestaña.
 */
export function LinkVolver({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter()
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    // Ctrl/Cmd/clic del medio: que el navegador abra el link como siempre
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    if (volverPasos(router)) e.preventDefault()
  }
  return <Link href={href} onClick={handleClick} {...props} />
}

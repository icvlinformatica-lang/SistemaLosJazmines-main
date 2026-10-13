"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, type ComponentProps, type MouseEvent } from "react"
import { navegacionDelNavegador, puedeVolverAtras } from "@/lib/volver-atras"

/**
 * Devuelve una función que vuelve a la pantalla anterior del sistema o, si no
 * hay (se entró directo), va a `destinoFijo`.
 */
export function useVolverAtras(destinoFijo: string) {
  const router = useRouter()
  return useCallback(() => {
    if (puedeVolverAtras(navegacionDelNavegador(), window.location.origin)) router.back()
    else router.push(destinoFijo)
  }, [router, destinoFijo])
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
    if (puedeVolverAtras(navegacionDelNavegador(), window.location.origin)) {
      e.preventDefault()
      router.back()
    }
  }
  return <Link href={href} onClick={handleClick} {...props} />
}

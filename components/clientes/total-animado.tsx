"use client"

import { useEffect, useRef, useState } from "react"

/** Número que corre hasta el valor nuevo cuando cambia (unos 450 ms). Con
 *  "reducir movimiento" cambia de una. Es la respuesta a lo que toca la
 *  persona: muestra cuánto sumó o restó lo que eligió. */
export function TotalAnimado({
  valor,
  formato,
  className,
}: {
  valor: number
  formato: (n: number) => string
  className?: string
}) {
  const [mostrado, setMostrado] = useState(valor)
  const desde = useRef(valor)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const reducir =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (frame.current != null) cancelAnimationFrame(frame.current)
    const inicio = desde.current
    if (reducir || inicio === valor) {
      desde.current = valor
      setMostrado(valor)
      return
    }
    const t0 = performance.now()
    const duracion = 450
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / duracion)
      const suave = 1 - Math.pow(1 - p, 3)
      const actual = Math.round(inicio + (valor - inicio) * suave)
      desde.current = actual
      setMostrado(actual)
      if (p < 1) frame.current = requestAnimationFrame(paso)
      else frame.current = null
    }
    frame.current = requestAnimationFrame(paso)
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current)
    }
  }, [valor])

  return <span className={className}>{formato(mostrado)}</span>
}

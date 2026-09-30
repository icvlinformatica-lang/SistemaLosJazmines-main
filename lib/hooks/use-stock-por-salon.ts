"use client"

// Trae lo contado en cada salón (tabla stock_salones) para que las pantallas
// puedan calcular las compras de un evento contra el stock DEL SALÓN donde se
// hace, en vez del total de los cinco. Ver lib/stock-salon-evento.ts.
//
// `listo` es importante: mientras no terminó de cargar, las pantallas siguen
// usando el total de siempre. Si proyectaran con el mapa vacío, todos los
// insumos valdrían 0 y la lista pediría comprar todo por un instante. Ante la
// duda, el comportamiento viejo.

import { useEffect, useState } from "react"
import { mapaDesdeResumen, type StockPorSalon } from "@/lib/stock-salon-evento"

export interface StockSalones {
  cocina: StockPorSalon
  barra: StockPorSalon
  /** false mientras carga o si falló: las pantallas usan el total global. */
  listo: boolean
  error: boolean
}

const VACIO: StockPorSalon = new Map()

export function useStockPorSalon(): StockSalones {
  const [datos, setDatos] = useState<{ cocina: StockPorSalon; barra: StockPorSalon } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelado = false
    const traer = async (sector: "cocina" | "barra") => {
      const res = await fetch(`/api/stock-salones/por-insumo?sector=${sector}`)
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || "no se pudo leer el stock por salón")
      return mapaDesdeResumen(data.insumos || [])
    }
    Promise.all([traer("cocina"), traer("barra")])
      .then(([cocina, barra]) => {
        if (!cancelado) setDatos({ cocina, barra })
      })
      .catch(() => {
        if (!cancelado) setError(true)
      })
    return () => {
      cancelado = true
    }
  }, [])

  return {
    cocina: datos?.cocina ?? VACIO,
    barra: datos?.barra ?? VACIO,
    listo: datos !== null,
    error,
  }
}

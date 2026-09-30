"use client"

// La vista consolidada del conteo por salón se mudó: ahora es la pestaña
// "Stock por salón" adentro de Insumos Cocina (/admin/almacen) y de Insumos
// Bebidas (/admin/barra), al lado del catálogo que le corresponde. Ver
// components/stock-por-salon-tabla.tsx.
//
// Esta ruta queda solo para que no se rompan los enlaces viejos (favoritos,
// el renglón de Actividad, una pestaña que alguien dejó abierta).

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function StockConsolidadoPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/admin/almacen")
  }, [router])

  return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground">
        El stock por salón ahora está adentro de Insumos, en la pestaña &quot;Stock por salón&quot;. Te estamos
        llevando para allá...
      </p>
    </div>
  )
}

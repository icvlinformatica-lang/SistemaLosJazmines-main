"use client"

import { useEffect, useRef } from "react"
import { useStore } from "@/lib/store-context"

/**
 * Sincronización en tiempo real con la base: refresca insumos (cocina/barra),
 * recetas, cócteles, eventos y el catálogo de servicios cada `intervaloMs`
 * (15s por defecto) y al volver a la pestaña.
 *
 * Con esto, las listas derivadas (p. ej. "Por pagar" en Caja Eventos) se
 * recalculan solas cuando cambia la fecha de un evento, un precio de servicio
 * o un contrato, sin necesidad de recargar la página.
 */
export function useSyncTiempoReal(intervaloMs = 15000) {
  const { setInsumos, setInsumosBarra, setRecetas, setCocteles, setEventos, setServicios } = useStore()
  const sincronizando = useRef(false)

  useEffect(() => {
    const refrescar = async () => {
      if (sincronizando.current) return
      sincronizando.current = true
      try {
        const fetchSafe = async (url: string) => {
          try {
            const r = await fetch(url, { cache: "no-store" })
            if (!r.ok) return null
            const data = await r.json()
            return Array.isArray(data) ? data : null
          } catch {
            return null
          }
        }
        // El catálogo de servicios (precios, % de seña) vive en Supabase vía
        // data-service, no en un endpoint HTTP.
        const fetchServiciosSafe = async () => {
          try {
            const { fetchServicios } = await import("@/lib/supabase/data-service")
            const data = await fetchServicios()
            return Array.isArray(data) ? data : null
          } catch {
            return null
          }
        }
        const [insumosRes, insumosBarraRes, recetasRes, coctelesRes, eventosRes, serviciosRes] = await Promise.all([
          fetchSafe("/api/insumos"),
          fetchSafe("/api/insumos-barra"),
          fetchSafe("/api/recetas"),
          fetchSafe("/api/cocteles"),
          fetchSafe("/api/eventos"),
          fetchServiciosSafe(),
        ])
        if (insumosRes) setInsumos(insumosRes)
        if (insumosBarraRes) setInsumosBarra(insumosBarraRes)
        if (recetasRes) setRecetas(recetasRes)
        if (coctelesRes) setCocteles(coctelesRes)
        if (eventosRes) setEventos(eventosRes)
        if (serviciosRes) setServicios(serviciosRes)
      } finally {
        sincronizando.current = false
      }
    }

    const interval = setInterval(refrescar, intervaloMs)
    const onVisible = () => {
      if (document.visibilityState === "visible") refrescar()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervaloMs])
}

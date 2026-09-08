"use client"

import { useEffect, useRef } from "react"
import useSWR from "swr"
import { useStore } from "@/lib/store-context"
import { useClock } from "@/lib/clock-context"
import { useToast } from "@/hooks/use-toast"
import type { RemoteStoreData } from "@/lib/store-sync"

async function fetchList<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`No se pudo actualizar ${url}`)
  const data = await response.json()
  if (!Array.isArray(data)) throw new Error(`Respuesta inválida de ${url}`)
  return data
}

/** Refresca al entrar, al volver a la pestaña y cada 15s, sin escribir en la base. */
export function useSyncTiempoReal(intervaloMs = 15000, incluirFinanzas = false, incluirResumen = false) {
  const { state, syncGuard, applyRemoteState } = useStore()
  const { soloLectura } = useClock()
  const { toast } = useToast()
  const stateRef = useRef(state)
  stateRef.current = state

  const { data, error, isValidating, mutate } = useSWR(
    soloLectura ? null : ["store-tiempo-real", incluirFinanzas, incluirResumen],
    async () => {
      const revision = syncGuard.snapshot()
      if (revision === null) return null
      const baseline = stateRef.current
      const db = await import("@/lib/supabase/data-service")
      const [insumos, insumosBarra, recetas, cocteles, eventos, servicios, finanzas, resumen] = await Promise.all([
        fetchList<(typeof state.insumos)[number]>("/api/insumos"),
        fetchList<(typeof state.insumosBarra)[number]>("/api/insumos-barra"),
        fetchList<(typeof state.recetas)[number]>("/api/recetas"),
        fetchList<(typeof state.cocteles)[number]>("/api/cocteles"),
        fetchList<(typeof state.eventos)[number]>("/api/eventos"),
        db.fetchServicios(),
        incluirFinanzas ? Promise.all([db.fetchMovimientosCaja(), db.fetchPagosPersonal()]) : null,
        incluirResumen ? Promise.all([db.fetchCostosOperativos(true), db.fetchGastosArchivados(true), db.fetchVendedores(true), db.fetchPersonal(true)]) : null,
      ])
      const updates: RemoteStoreData = { insumos, insumosBarra, recetas, cocteles, eventos, servicios }
      if (finanzas) {
        const ids = new Set(eventos.map((evento) => evento.id))
        updates.movimientosCaja = finanzas[0].filter((mov) => !mov.eventoId || ids.has(mov.eventoId))
        updates.pagosPersonal = finanzas[1]
      }
      if (resumen) {
        updates.costosOperativos = resumen[0]
        updates.gastosArchivados = resumen[1]
        updates.vendedores = resumen[2]
        updates.personal = resumen[3]
      }
      if (!syncGuard.isCurrent(revision)) return null
      return { baseline, updates, revision, fecha: new Date() }
    },
    {
      refreshInterval: intervaloMs,
      revalidateOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshWhenHidden: false,
      dedupingInterval: 2000,
      errorRetryInterval: intervaloMs,
    },
  )

  useEffect(() => {
    if (data && !soloLectura) applyRemoteState(data.baseline, data.updates, data.revision)
  }, [data, soloLectura, applyRemoteState])

  const errorNotificado = useRef(false)
  useEffect(() => {
    if (error && !errorNotificado.current) {
      toast({
        title: "No se pudo actualizar la información",
        description: "Se conserva la última información disponible. Reintentaremos automáticamente al recuperar la conexión.",
        variant: "destructive",
      })
    }
    errorNotificado.current = Boolean(error)
  }, [error, toast])

  return { ultimaSync: data?.fecha ?? null, errorSync: Boolean(error), sincronizando: isValidating, refrescar: mutate }
}

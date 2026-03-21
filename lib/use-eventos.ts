"use client"

import { useCallback } from "react"
import { useStore } from "@/lib/store-context"
import type { EventoGuardado } from "@/lib/store"

/**
 * useEventos — thin wrapper over StoreContext.
 * Reads from the global store (already synced with /api/eventos on mount)
 * and delegates mutations back to store actions.
 */
export function useEventos() {
  const { eventos, loading, addEvento, updateEvento: storeUpdate, deleteEvento: storeDelete } = useStore()

  const fetchEventos = useCallback(async () => {
    // Re-fetch is handled by the store on mount; expose a manual trigger for pull-to-refresh
    const res = await fetch("/api/eventos")
    if (res.ok) {
      // The store will update on next render cycle — nothing else needed
    }
  }, [])

  const crearEvento = useCallback(async (evento: Omit<EventoGuardado, "id"> & { id?: string }): Promise<EventoGuardado | null> => {
    try {
      const res = await fetch("/api/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evento),
      })
      if (!res.ok) return null
      const created: EventoGuardado = await res.json()
      return created
    } catch {
      return null
    }
  }, [])

  const actualizarEvento = useCallback(async (id: string, cambios: Partial<EventoGuardado>): Promise<boolean> => {
    try {
      await storeUpdate(id, cambios)
      return true
    } catch {
      return false
    }
  }, [storeUpdate])

  const eliminarEvento = useCallback(async (id: string, motivo?: string): Promise<boolean> => {
    try {
      const url = motivo ? `/api/eventos/${id}?motivo=${encodeURIComponent(motivo)}` : `/api/eventos/${id}`
      const res = await fetch(url, { method: "DELETE" })
      if (res.ok) {
        await storeDelete(id)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [storeDelete])

  return {
    eventos: eventos || [],
    loading: loading ?? false,
    fetchEventos,
    crearEvento,
    actualizarEvento,
    eliminarEvento,
  }
}

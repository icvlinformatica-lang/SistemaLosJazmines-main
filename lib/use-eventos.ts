"use client"

import { useCallback } from "react"
import { useStore } from "@/lib/store-context"
import type { EventoGuardado } from "@/lib/store"

export function useEventos() {
  const { eventos, loading, addEvento, updateEvento: storeUpdate, deleteEvento: storeDelete, setEventos } = useStore()

  // Fetch desde la API y actualiza el store con los datos frescos
  const fetchEventos = useCallback(async () => {
    try {
      const res = await fetch("/api/eventos")
      if (res.ok) {
        const data: EventoGuardado[] = await res.json()
        setEventos(data)
      }
    } catch (err) {
      console.error("[useEventos] Error fetching:", err)
    }
  }, [setEventos])

  // Delega a addEvento del store, que hace el POST y actualiza el store en memoria
  const crearEvento = useCallback(async (evento: Omit<EventoGuardado, "id"> & { id?: string }): Promise<EventoGuardado | null> => {
    try {
      await addEvento(evento as EventoGuardado)
      return null
    } catch {
      return null
    }
  }, [addEvento])

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

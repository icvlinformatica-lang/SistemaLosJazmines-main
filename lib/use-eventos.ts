"use client"

import { useCallback, useRef } from "react"
import { useStore } from "@/lib/store-context"
import { generateId, type EventoGuardado } from "@/lib/store"

export function useEventos() {
  const { state, eventos, loading, addEvento, updateEvento: storeUpdate, deleteEvento: storeDelete, syncGuard, applyRemoteState } = useStore()
  const stateRef = useRef(state)
  stateRef.current = state

  const fetchEventos = useCallback(async () => {
    const revision = syncGuard.snapshot()
    if (revision === null) return
    const baseline = stateRef.current
    try {
      const res = await fetch("/api/eventos", { cache: "no-store" })
      if (!res.ok) throw new Error("No se pudieron actualizar los eventos")
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error("Respuesta inválida de eventos")
      applyRemoteState(baseline, { eventos: data }, revision)
    } catch (err) {
      console.error("[useEventos] Error fetching:", err)
    }
  }, [syncGuard, applyRemoteState])

  const crearEvento = useCallback(async (evento: Omit<EventoGuardado, "id"> & { id?: string }): Promise<EventoGuardado | null> => {
    const nuevo = { ...evento, id: evento.id || generateId() } as EventoGuardado
    return await addEvento(nuevo) ? nuevo : null
  }, [addEvento])

  const actualizarEvento = useCallback(async (id: string, cambios: Partial<EventoGuardado>): Promise<boolean> => {
    return await storeUpdate(id, cambios)
  }, [storeUpdate])

  const eliminarEvento = useCallback(async (id: string, motivo?: string): Promise<boolean> => {
    return await storeDelete(id, motivo)
  }, [storeDelete])

  return { eventos: eventos || [], loading: loading ?? false, fetchEventos, crearEvento, actualizarEvento, eliminarEvento }
}

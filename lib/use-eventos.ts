"use client"

import { useState, useEffect, useCallback } from "react"
import type { EventoGuardado } from "@/lib/store"

export function useEventos() {
  const [eventos, setEventos] = useState<EventoGuardado[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEventos = useCallback(async () => {
    try {
      const res = await fetch("/api/eventos")
      if (res.ok) {
        const data = await res.json()
        setEventos(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error("[useEventos] Error fetching:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEventos()
  }, [fetchEventos])

  const crearEvento = useCallback(async (evento: Omit<EventoGuardado, "id"> & { id?: string }): Promise<EventoGuardado | null> => {
    try {
      const res = await fetch("/api/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evento),
      })
      if (!res.ok) return null
      const created: EventoGuardado = await res.json()
      setEventos((prev) => [...prev, created])
      return created
    } catch {
      return null
    }
  }, [])

  const actualizarEvento = useCallback(async (id: string, cambios: Partial<EventoGuardado>): Promise<boolean> => {
    try {
      // Optimistic update
      setEventos((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...cambios } : e))
      )
      const eventoActual = await fetch(`/api/eventos/${id}`).then((r) => r.json())
      const updated = { ...eventoActual, ...cambios }
      const res = await fetch(`/api/eventos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      })
      if (!res.ok) {
        // Revert on failure
        await fetchEventos()
        return false
      }
      return true
    } catch {
      await fetchEventos()
      return false
    }
  }, [fetchEventos])

  const eliminarEvento = useCallback(async (id: string, motivo?: string): Promise<boolean> => {
    try {
      setEventos((prev) => prev.filter((e) => e.id !== id))
      const url = motivo ? `/api/eventos/${id}?motivo=${encodeURIComponent(motivo)}` : `/api/eventos/${id}`
      const res = await fetch(url, { method: "DELETE" })
      if (!res.ok) {
        await fetchEventos()
        return false
      }
      return true
    } catch {
      await fetchEventos()
      return false
    }
  }, [fetchEventos])

  return { eventos, loading, fetchEventos, crearEvento, actualizarEvento, eliminarEvento }
}

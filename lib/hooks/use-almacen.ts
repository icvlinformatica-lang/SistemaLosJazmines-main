"use client"

import useSWR from "swr"
import type { Insumo, InsumoBarra } from "@/lib/store"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`[v0] Fetch error for ${url}:`, res.status)
    return []
  }
  const data = await res.json()
  // If API returns an error object, return empty array
  if (data && data.error) {
    console.error(`[v0] API error for ${url}:`, data.error)
    return []
  }
  return Array.isArray(data) ? data : []
}

// Hook for Insumos (Cocina)
export function useInsumos() {
  const { data, error, isLoading, mutate } = useSWR<Insumo[]>("/api/insumos", fetcher)

  const addInsumo = async (insumo: Omit<Insumo, "id">) => {
    const res = await fetch("/api/insumos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(insumo),
    })
    if (!res.ok) throw new Error("Failed to add insumo")
    const newInsumo = await res.json()
    mutate([...(data || []), newInsumo], false)
    return newInsumo
  }

  const updateInsumo = async (id: string, updates: Partial<Insumo>) => {
    const res = await fetch(`/api/insumos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error("Failed to update insumo")
    const updated = await res.json()
    mutate(
      (data || []).map((i) => (i.id === id ? updated : i)),
      false
    )
    return updated
  }

  const deleteInsumo = async (id: string) => {
    const res = await fetch(`/api/insumos/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Failed to delete insumo")
    mutate(
      (data || []).filter((i) => i.id !== id),
      false
    )
  }

  return {
    insumos: data || [],
    isLoading,
    error,
    addInsumo,
    updateInsumo,
    deleteInsumo,
    mutate,
  }
}

// Hook for Insumos Barra (Bebidas)
export function useInsumosBarra() {
  const { data, error, isLoading, mutate } = useSWR<InsumoBarra[]>("/api/insumos-barra", fetcher)

  const addInsumoBarra = async (insumo: Omit<InsumoBarra, "id">) => {
    const res = await fetch("/api/insumos-barra", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(insumo),
    })
    if (!res.ok) throw new Error("Failed to add insumo barra")
    const newInsumo = await res.json()
    mutate([...(data || []), newInsumo], false)
    return newInsumo
  }

  const updateInsumoBarra = async (id: string, updates: Partial<InsumoBarra>) => {
    const res = await fetch(`/api/insumos-barra/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error("Failed to update insumo barra")
    const updated = await res.json()
    mutate(
      (data || []).map((i) => (i.id === id ? updated : i)),
      false
    )
    return updated
  }

  const deleteInsumoBarra = async (id: string) => {
    const res = await fetch(`/api/insumos-barra/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Failed to delete insumo barra")
    mutate(
      (data || []).filter((i) => i.id !== id),
      false
    )
  }

  return {
    insumosBarra: data || [],
    isLoading,
    error,
    addInsumoBarra,
    updateInsumoBarra,
    deleteInsumoBarra,
    mutate,
  }
}

"use client"

import useSWR from "swr"
import type { Receta, Coctel, BarraTemplate } from "@/lib/store"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`[v0] Fetch error for ${url}:`, res.status)
    return []
  }
  const data = await res.json()
  if (data && data.error) {
    console.error(`[v0] API error for ${url}:`, data.error)
    return []
  }
  return Array.isArray(data) ? data : []
}

// Hook for Recetas
export function useRecetas() {
  const { data, error, isLoading, mutate } = useSWR<Receta[]>("/api/recetas", fetcher)

  const addReceta = async (receta: Omit<Receta, "id">) => {
    const res = await fetch("/api/recetas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(receta),
    })
    if (!res.ok) throw new Error("Failed to add receta")
    const newReceta = await res.json()
    mutate([...(data || []), newReceta], false)
    return newReceta
  }

  const updateReceta = async (id: string, updates: Partial<Receta>) => {
    const res = await fetch(`/api/recetas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error("Failed to update receta")
    const updated = await res.json()
    mutate(
      (data || []).map((r) => (r.id === id ? updated : r)),
      false
    )
    return updated
  }

  const deleteReceta = async (id: string) => {
    const res = await fetch(`/api/recetas/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Failed to delete receta")
    mutate(
      (data || []).filter((r) => r.id !== id),
      false
    )
  }

  return {
    recetas: data || [],
    isLoading,
    error,
    addReceta,
    updateReceta,
    deleteReceta,
    mutate,
  }
}

// Hook for Cocteles
export function useCocteles() {
  const { data, error, isLoading, mutate } = useSWR<Coctel[]>("/api/cocteles", fetcher)

  const addCoctel = async (coctel: Omit<Coctel, "id">) => {
    const res = await fetch("/api/cocteles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coctel),
    })
    if (!res.ok) throw new Error("Failed to add coctel")
    const newCoctel = await res.json()
    mutate([...(data || []), newCoctel], false)
    return newCoctel
  }

  const updateCoctel = async (id: string, updates: Partial<Coctel>) => {
    const res = await fetch(`/api/cocteles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error("Failed to update coctel")
    const updated = await res.json()
    mutate(
      (data || []).map((c) => (c.id === id ? updated : c)),
      false
    )
    return updated
  }

  const deleteCoctel = async (id: string) => {
    const res = await fetch(`/api/cocteles/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Failed to delete coctel")
    mutate(
      (data || []).filter((c) => c.id !== id),
      false
    )
  }

  return {
    cocteles: data || [],
    isLoading,
    error,
    addCoctel,
    updateCoctel,
    deleteCoctel,
    mutate,
  }
}

// Hook for Barra Templates
export function useBarraTemplates() {
  const { data, error, isLoading, mutate } = useSWR<BarraTemplate[]>("/api/barra-templates", fetcher)

  const addBarraTemplate = async (template: Omit<BarraTemplate, "id">) => {
    const res = await fetch("/api/barra-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(template),
    })
    if (!res.ok) throw new Error("Failed to add barra template")
    const newTemplate = await res.json()
    mutate([...(data || []), newTemplate], false)
    return newTemplate
  }

  const updateBarraTemplate = async (id: string, updates: Partial<BarraTemplate>) => {
    const res = await fetch(`/api/barra-templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error("Failed to update barra template")
    const updated = await res.json()
    mutate(
      (data || []).map((t) => (t.id === id ? updated : t)),
      false
    )
    return updated
  }

  const deleteBarraTemplate = async (id: string) => {
    const res = await fetch(`/api/barra-templates/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Failed to delete barra template")
    mutate(
      (data || []).filter((t) => t.id !== id),
      false
    )
  }

  return {
    barraTemplates: data || [],
    isLoading,
    error,
    addBarraTemplate,
    updateBarraTemplate,
    deleteBarraTemplate,
    mutate,
  }
}

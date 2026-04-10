"use client"

import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function useRecetas() {
  const { data, error, isLoading, mutate } = useSWR("/api/recetas", fetcher, {
    refreshInterval: 30000,      // refresca cada 30 segundos
    revalidateOnFocus: true,     // revalida cuando la ventana recupera el foco
    revalidateOnReconnect: true,
  })

  return {
    recetas: data ?? [],
    loading: isLoading,
    error,
    mutate,
  }
}

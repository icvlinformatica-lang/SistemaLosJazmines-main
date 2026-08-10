"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

interface UIContextType {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

const UIContext = createContext<UIContextType | null>(null)

const SIDEBAR_STORAGE_KEY = "lj-sidebar-open"

export function UIProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Restaurar preferencia guardada (plegado/desplegado) al cargar
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (guardado !== null) setSidebarOpen(guardado === "true")
    } catch {
      // localStorage no disponible: mantener valor por defecto
    }
  }, [])

  // Guardar la preferencia cada vez que cambia
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen))
    } catch {
      // ignorar
    }
  }, [sidebarOpen])

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev)
  }

  return (
    <UIContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
      }}
    >
      {children}
    </UIContext.Provider>
  )
}

export function useUI() {
  const context = useContext(UIContext)
  if (!context) {
    throw new Error("useUI must be used within a UIProvider")
  }
  return context
}

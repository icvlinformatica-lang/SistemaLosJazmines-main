"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface UIContextType {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

const UIContext = createContext<UIContextType | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

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

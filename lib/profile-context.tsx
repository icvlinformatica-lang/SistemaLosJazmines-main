"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export interface Perfil {
  id: string
  nombre: string
  pin: string
  color: string
  emoji: string
  rutas: string[]
}

export const PERFILES: Perfil[] = [
  {
    id: "cocina",
    nombre: "Cocina",
    pin: "1234",
    color: "#e67e22",
    emoji: "👨‍🍳",
    rutas: ["/admin/almacen", "/admin/recetario"],
  },
  {
    id: "barra",
    nombre: "Barra",
    pin: "4321",
    color: "#2980b9",
    emoji: "🍹",
    rutas: ["/admin/barra", "/admin/cocteles"],
  },
  {
    id: "administracion",
    nombre: "Administración",
    pin: "112233",
    color: "#8e44ad",
    emoji: "📊",
    rutas: [],
  },
  {
    id: "soporte",
    nombre: "Soporte",
    pin: "5757",
    color: "#1a3a2a",
    emoji: "🛠️",
    rutas: ["*"],
  },
]

interface ProfileContextType {
  perfilActivo: Perfil | null
  seleccionarPerfil: (id: string, pin: string) => boolean
  cerrarSesion: () => void
}

const ProfileContext = createContext<ProfileContextType | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [perfilActivo, setPerfilActivo] = useState<Perfil | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const guardado = sessionStorage.getItem("perfil_activo")
      if (guardado) {
        const perfil = PERFILES.find((p) => p.id === guardado)
        if (perfil) setPerfilActivo(perfil)
      }
    } catch {}
    setHydrated(true)
  }, [])

  const seleccionarPerfil = (id: string, pin: string): boolean => {
    const perfil = PERFILES.find((p) => p.id === id)
    if (!perfil) return false
    if (perfil.pin !== pin) return false
    setPerfilActivo(perfil)
    try {
      sessionStorage.setItem("perfil_activo", perfil.id)
      localStorage.setItem(`pin_guardado_${perfil.id}`, pin)
    } catch {}
    return true
  }

  const cerrarSesion = () => {
    setPerfilActivo(null)
    try {
      sessionStorage.removeItem("perfil_activo")
    } catch {}
  }

  if (!hydrated) return null

  return (
    <ProfileContext.Provider value={{ perfilActivo, seleccionarPerfil, cerrarSesion }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error("useProfile debe usarse dentro de ProfileProvider")
  return ctx
}

"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export interface Perfil {
  id: string
  nombre: string
  color: string
  emoji: string
  rutas: string[]
  rutasExcluidas?: string[]
}

// NOTA DE SEGURIDAD: los PINs ya NO viven en el cliente.
// La verificación se hace en el servidor (/api/auth/login) contra lib/auth/server.ts.
export const PERFILES: Perfil[] = [
  {
    id: "cocina",
    nombre: "Cocina",
    color: "#e67e22",
    emoji: "👨‍🍳",
    rutas: ["/admin/almacen", "/admin/recetario", "/eventos/produccion"],
  },
  {
    id: "barra",
    nombre: "Barra",
    color: "#2980b9",
    emoji: "🍹",
    rutas: ["/admin/barra", "/admin/cocteles", "/eventos/produccion"],
  },
  {
    id: "administracion",
    nombre: "Administración",
    color: "#8e44ad",
    emoji: "📊",
    rutas: ["*"],
    rutasExcluidas: ["/eventos/produccion", "/admin/almacen", "/admin/barra", "/admin/recetario", "/admin/cocteles"],
  },
  {
    id: "soporte",
    nombre: "Soporte",
    color: "#1a3a2a",
    emoji: "🛠️",
    rutas: ["*"],
    rutasExcluidas: ["/eventos/produccion"],
  },
  {
    id: "cobro",
    nombre: "Cobrar cuota",
    color: "#c9a227",
    emoji: "💰",
    rutas: ["/", "/eventos/pagos"],
  },
]

interface ProfileContextType {
  perfilActivo: Perfil | null
  hydrated: boolean
  seleccionarPerfil: (id: string, pin: string) => Promise<boolean>
  seleccionarPerfilRapido: (id: string) => Promise<boolean>
  cerrarSesion: () => void
}

const ProfileContext = createContext<ProfileContextType | null>(null)

const QUICK_TOKEN_KEY = (id: string) => `acceso_rapido_${id}`
const SESSION_TOKEN_KEY = "lj_session_token"

// Adjunta el token de sesión como header a todas las llamadas fetch a /api/*.
// Necesario porque en la vista previa embebida (iframe) las cookies pueden
// estar bloqueadas por el navegador (third-party cookie blocking).
let fetchPatched = false
function patchFetchWithSession() {
  if (fetchPatched || typeof window === "undefined") return
  fetchPatched = true
  const originalFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      const esApiPropia = url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`)
      if (esApiPropia && !url.includes("/api/auth/login")) {
        const token = sessionStorage.getItem(SESSION_TOKEN_KEY)
        if (token) {
          const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
          if (!headers.has("x-lj-session")) headers.set("x-lj-session", token)
          return originalFetch(input, { ...init, headers })
        }
      }
    } catch {}
    return originalFetch(input, init)
  }
}

// Aplicar el parche apenas se carga el módulo en el navegador, antes de que
// cualquier hook de datos (SWR, useEffect) dispare sus fetches.
if (typeof window !== "undefined") {
  patchFetchWithSession()
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [perfilActivo, setPerfilActivo] = useState<Perfil | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    patchFetchWithSession()
    try {
      // Migración: eliminar PINs en texto plano guardados por versiones anteriores
      PERFILES.forEach((p) => {
        try {
          localStorage.removeItem(`pin_guardado_${p.id}`)
        } catch {}
      })

      const guardado = sessionStorage.getItem("perfil_activo")
      if (guardado) {
        const perfil = PERFILES.find((p) => p.id === guardado)
        if (perfil) {
          const validar = async () => {
            try {
              // 1. ¿La sesión actual (cookie o token) sigue vigente?
              const res = await fetch("/api/auth/session")
              if (res.ok) {
                setPerfilActivo(perfil)
                return
              }
              // 2. Intentar renovar automáticamente con el token de acceso rápido
              const quickToken = localStorage.getItem(QUICK_TOKEN_KEY(perfil.id))
              if (quickToken) {
                const login = await fetch("/api/auth/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ perfilId: perfil.id, quickToken }),
                })
                if (login.ok) {
                  const data = await login.json()
                  if (data.ok) {
                    try {
                      if (data.sessionToken) sessionStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken)
                      if (data.quickToken) localStorage.setItem(QUICK_TOKEN_KEY(perfil.id), data.quickToken)
                    } catch {}
                    setPerfilActivo(perfil)
                    return
                  }
                }
              }
              // 3. Sin sesión válida: volver al login
              sessionStorage.removeItem("perfil_activo")
              sessionStorage.removeItem(SESSION_TOKEN_KEY)
            } catch {
              // Si falla la red, permitir el uso local para no bloquear al usuario
              setPerfilActivo(perfil)
            } finally {
              setHydrated(true)
            }
          }
          validar()
          return
        }
      }
    } catch {}
    setHydrated(true)
  }, [])

  const activar = (perfil: Perfil, quickToken?: string, sessionToken?: string) => {
    setPerfilActivo(perfil)
    try {
      sessionStorage.setItem("perfil_activo", perfil.id)
      if (quickToken) localStorage.setItem(QUICK_TOKEN_KEY(perfil.id), quickToken)
      if (sessionToken) sessionStorage.setItem(SESSION_TOKEN_KEY, sessionToken)
    } catch {}
  }

  const seleccionarPerfil = async (id: string, pin: string): Promise<boolean> => {
    const perfil = PERFILES.find((p) => p.id === id)
    if (!perfil) return false
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfilId: id, pin }),
      })
      if (!res.ok) return false
      const data = await res.json()
      if (!data.ok) return false
      activar(perfil, data.quickToken, data.sessionToken)
      return true
    } catch {
      return false
    }
  }

  const seleccionarPerfilRapido = async (id: string): Promise<boolean> => {
    const perfil = PERFILES.find((p) => p.id === id)
    if (!perfil) return false
    let quickToken: string | null = null
    try {
      quickToken = localStorage.getItem(QUICK_TOKEN_KEY(id))
    } catch {}
    if (!quickToken) return false
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfilId: id, quickToken }),
      })
      if (!res.ok) {
        // Token vencido o inválido: limpiar para pedir PIN de nuevo
        try {
          localStorage.removeItem(QUICK_TOKEN_KEY(id))
        } catch {}
        return false
      }
      const data = await res.json()
      if (!data.ok) return false
      activar(perfil, data.quickToken, data.sessionToken)
      return true
    } catch {
      return false
    }
  }

  const cerrarSesion = () => {
    setPerfilActivo(null)
    try {
      sessionStorage.removeItem("perfil_activo")
      sessionStorage.removeItem(SESSION_TOKEN_KEY)
    } catch {}
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
  }

  return (
    <ProfileContext.Provider
      value={{ perfilActivo, hydrated, seleccionarPerfil, seleccionarPerfilRapido, cerrarSesion }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error("useProfile debe usarse dentro de ProfileProvider")
  return ctx
}

export function tieneAccesoRapido(id: string): boolean {
  try {
    return !!localStorage.getItem(QUICK_TOKEN_KEY(id))
  } catch {
    return false
  }
}

export function olvidarAccesosRapidos() {
  PERFILES.forEach((p) => {
    try {
      localStorage.removeItem(QUICK_TOKEN_KEY(p.id))
    } catch {}
  })
}

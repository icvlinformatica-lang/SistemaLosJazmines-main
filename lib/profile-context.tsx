"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import {
  ChefHat,
  Wine,
  BarChart2,
  ClipboardList,
  DollarSign,
  Headphones,
  Camera,
  Shirt,
  Monitor,
  Wrench,
  Briefcase,
  type LucideIcon,
} from "lucide-react"

export interface Perfil {
  id: string
  nombre: string
  categoria: "gestion" | "evento"
  color: string
  icon: LucideIcon
  iconColor: string
  rutas: string[]
  rutasExcluidas?: string[]
}

// Paleta de marca: negro / crema / dorado sobre fondo verde oscuro.
const NEGRO = "#1a1a1a"
const CREMA = "#f5f0e8"
// Color por categoría (no por perfil individual): "gestión" (backoffice,
// dinero, coordinación) en dorado, "evento" (operativo/proveedores del día
// del evento) en verde. Cobrar cuota mantiene además su propio tratamiento
// especial de tarjeta (ver esDorado en app/login/page.tsx).
const DORADO = "#c9a227"
const VERDE_EVENTO = "#2f8f5b"

// NOTA DE SEGURIDAD: los PINs ya NO viven en el cliente.
// La verificación se hace en el servidor (/api/auth/login) contra lib/auth/server.ts.
// Orden pensado para la grilla de 5 columnas del login: dos filas de 5.
// Fila 1: cocina, barra, administración, coordinación, cobrar cuota.
// Fila 2: dj, fotógrafo, vestido, pantalla, soporte (soporte queda
// abajo a la derecha, justo debajo de "Cobrar cuota").
export const PERFILES: Perfil[] = [
  {
    id: "cocina",
    nombre: "Cocina",
    categoria: "evento",
    color: VERDE_EVENTO,
    icon: ChefHat,
    iconColor: CREMA,
    rutas: ["/admin/almacen", "/admin/recetario", "/eventos/produccion", "/stock"],
  },
  {
    id: "barra",
    nombre: "Barra",
    categoria: "evento",
    color: VERDE_EVENTO,
    icon: Wine,
    iconColor: CREMA,
    rutas: ["/admin/barra", "/admin/cocteles", "/eventos/produccion", "/stock"],
  },
  {
    id: "administracion",
    nombre: "Administración",
    categoria: "gestion",
    color: DORADO,
    icon: BarChart2,
    iconColor: NEGRO,
    rutas: ["*"],
    rutasExcluidas: ["/eventos/produccion"],
  },
  {
    id: "coordinacion",
    nombre: "Coordinación",
    categoria: "gestion",
    color: DORADO,
    icon: ClipboardList,
    iconColor: NEGRO,
    rutas: ["/eventos/staff"],
  },
  {
    id: "cobro",
    nombre: "Cobrar cuota",
    categoria: "gestion",
    color: DORADO,
    icon: DollarSign,
    iconColor: NEGRO,
    rutas: ["/", "/eventos/pagos"],
  },
  {
    id: "vendedor",
    nombre: "Vendedor",
    categoria: "gestion",
    color: DORADO,
    icon: Briefcase,
    iconColor: NEGRO,
    // OJO: nunca dejar `rutas: []` — components/app-shell.tsx y
    // components/sidebar.tsx tratan un array vacío como "acceso total"
    // (mismo criterio que "*"), no como "sin acceso".
    rutas: ["/vendedor", "/vendedor/cotizar", "/vendedor/paquetes", "/vendedor/papelera"],
  },
  // Perfiles de solo lectura para staff externo: ven el calendario de
  // próximos eventos con su servicio resaltado (ver app/eventos/staff).
  {
    id: "dj",
    nombre: "DJ",
    categoria: "evento",
    color: VERDE_EVENTO,
    icon: Headphones,
    iconColor: CREMA,
    rutas: ["/eventos/staff"],
  },
  {
    id: "fotografo",
    nombre: "Fotógrafo",
    categoria: "evento",
    color: VERDE_EVENTO,
    icon: Camera,
    iconColor: CREMA,
    rutas: ["/eventos/staff"],
  },
  {
    id: "vestido",
    nombre: "Vestido",
    categoria: "evento",
    color: VERDE_EVENTO,
    icon: Shirt,
    iconColor: CREMA,
    rutas: ["/eventos/staff"],
  },
  {
    id: "pantalla",
    nombre: "Pantalla",
    categoria: "evento",
    color: VERDE_EVENTO,
    icon: Monitor,
    iconColor: CREMA,
    rutas: ["/eventos/staff"],
  },
  {
    id: "soporte",
    nombre: "Soporte",
    categoria: "gestion",
    color: DORADO,
    icon: Wrench,
    iconColor: NEGRO,
    rutas: ["*"],
    rutasExcluidas: ["/eventos/produccion"],
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
const PERFIL_ACTIVO_KEY = "perfil_activo"
// Marca que lee el login para avisar "tu sesión venció" (ver app/login/page.tsx).
export const SESION_VENCIDA_KEY = "lj_sesion_vencida"

// Borra los rastros locales de la sesión. Vive a nivel módulo (y no dentro de
// ProfileProvider) porque también la usa el fetch parcheado de abajo, que
// corre fuera de React y no puede llamar a cerrarSesion().
function limpiarSesionLocal() {
  try {
    sessionStorage.removeItem(PERFIL_ACTIVO_KEY)
    sessionStorage.removeItem(SESSION_TOKEN_KEY)
    sessionStorage.removeItem("admin_usuario")
  } catch {}
  // Limpiar la atribución de actividad (Diego/Leila)
  try {
    document.cookie = "lj_usuario=; path=/; max-age=0"
  } catch {}
}

// Adjunta el token de sesión como header a todas las llamadas fetch a /api/*.
// Necesario porque en la vista previa embebida (iframe) las cookies pueden
// estar bloqueadas por el navegador (third-party cookie blocking).
//
// También reintenta una vez las llamadas a /api/db/* (el proxy a Supabase
// que usa lib/supabase/data-service.ts) si vienen con error 5xx: en dev,
// apenas arranca el servidor, StoreProvider dispara ~14 fetches en paralelo
// y Next/Turbopack todavía puede estar compilando esa ruta bajo demanda —
// la primera respuesta puede fallar aunque los datos estén bien (se ve como
// "Error fetching X: {}" en la consola). Un solo reintento alcanza porque
// una vez compilada la ruta, las siguientes llamadas ya funcionan solas.
//
// Y, por último, renueva la sesión cuando vence estando la pestaña abierta.
// La sesión dura 12 h (SESSION_DURATION_MS en lib/auth/server.ts) pero solo
// se validaba al montar ProfileProvider: una pestaña abierta de un día para
// el otro seguía pintada y funcionando en apariencia, mientras cada /api/*
// rebotaba en middleware.ts con 401 "No autorizado" (ej: "Marcar como
// finalizado" mostraba el toast "No se pudo guardar — No autorizado").
// Ahora un 401 dispara una renovación con el token de acceso rápido (30 días)
// y reintenta el pedido una sola vez; si no se puede renovar, va al login.
//
// SEGURIDAD (plata): el 401 lo corta el middleware ANTES de ejecutar la ruta,
// así que el reintento es la primera ejecución real — no puede duplicar un
// cobro ni un movimiento de caja. Además, cobrar cuota ya trae su propio
// candado de idempotencia (_operacionCobro / planDeCuotas.ultimaOperacionCobro
// en app/api/eventos/[id]/route.ts), que corta cualquier reejecución.
let fetchPatched = false

// Una sola renovación compartida: si varios pedidos vuelven 401 a la vez
// (lo normal, porque las pantallas disparan varios fetches en paralelo),
// todos esperan la misma promesa en vez de pedir un token cada uno.
let renovacionEnCurso: Promise<string | null> | null = null

function perfilActivoGuardado(): string | null {
  try {
    return sessionStorage.getItem(PERFIL_ACTIVO_KEY)
  } catch {
    return null
  }
}

/**
 * Renueva la sesión con el token de acceso rápido guardado en localStorage,
 * igual que hace el useEffect de validación del ProfileProvider.
 * Devuelve el sessionToken nuevo, o null si no se pudo renovar.
 * Nunca lanza: las llamadas de arriba solo miran si vino token o no.
 */
function renovarSesion(originalFetch: typeof window.fetch): Promise<string | null> {
  if (renovacionEnCurso) return renovacionEnCurso

  const promesa = (async (): Promise<string | null> => {
    const perfilId = perfilActivoGuardado()
    if (!perfilId) return null
    let quickToken: string | null = null
    try {
      quickToken = localStorage.getItem(QUICK_TOKEN_KEY(perfilId))
    } catch {}
    if (!quickToken) return null
    try {
      const res = await originalFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfilId, quickToken }),
      })
      if (!res.ok) return null
      const data = await res.json()
      if (!data?.ok || !data.sessionToken) return null
      try {
        sessionStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken)
        if (data.quickToken) localStorage.setItem(QUICK_TOKEN_KEY(perfilId), data.quickToken)
      } catch {}
      return data.sessionToken as string
    } catch {
      return null
    }
  })()

  renovacionEnCurso = promesa
  promesa.finally(() => {
    if (renovacionEnCurso === promesa) renovacionEnCurso = null
  })
  return promesa
}

/**
 * Sesión imposible de renovar: limpiar y mandar al login con el aviso.
 * No hace falta un flag de "ya estoy redirigiendo": limpiarSesionLocal() borra
 * el perfil activo, y el 401 de arriba se corta antes de llegar acá cuando no
 * hay perfil. Si dos 401 simultáneos llegan igual, asignar dos veces el mismo
 * href es inofensivo — y así evitamos un flag global que quede pegado y termine
 * bloqueando una redirección legítima más adelante.
 */
function mandarAlLogin() {
  limpiarSesionLocal()
  try {
    sessionStorage.setItem(SESION_VENCIDA_KEY, "1")
  } catch {}
  if (window.location.pathname !== "/login") {
    window.location.href = "/login"
  }
}

/**
 * ¿Se puede repetir este pedido tal cual? Un body ya consumido (FormData,
 * stream, o un Request cuyo cuerpo se leyó) no se puede reenviar: en ese caso
 * preferimos devolver el 401 antes que mandar un pedido incompleto.
 */
function sePuedeReintentar(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (input instanceof Request) return false
  const body = init?.body
  return body === undefined || body === null || typeof body === "string"
}
function patchFetchWithSession() {
  if (fetchPatched || typeof window === "undefined") return
  fetchPatched = true
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // Armar el request (agregar el header de sesión si corresponde) puede
    // fallar por motivos ajenos a la red (ej: sessionStorage bloqueado) —
    // ese try/catch queda separado del fetch en sí, para no confundir un
    // fallo de red real con "no hacía falta parchear nada".
    let finalInit = init
    let esProxyDb = false
    // Las rutas de /api/auth/* quedan siempre fuera del manejo de 401: son
    // las que usamos para renovar, y reintentarlas armaría un loop.
    let manejar401 = false
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      const esApiPropia = url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`)
      esProxyDb = url.includes("/api/db/")
      const esAuth = url.includes("/api/auth/")
      manejar401 = esApiPropia && !esAuth
      if (esApiPropia && !esAuth) {
        const token = sessionStorage.getItem(SESSION_TOKEN_KEY)
        if (token) {
          const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
          if (!headers.has("x-lj-session")) headers.set("x-lj-session", token)
          finalInit = { ...init, headers }
        }
      }
    } catch {}

    let res = await originalFetch(input, finalInit)
    if (esProxyDb && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 400))
      res = await originalFetch(input, finalInit)
    }

    if (res.status === 401 && manejar401) {
      // Sin perfil guardado no hay sesión que renovar: es alguien que todavía
      // no entró. Devolvemos el 401 tal cual y dejamos que la app haga lo suyo
      // (las páginas ya redirigen solas al login).
      if (!perfilActivoGuardado()) return res

      const nuevoToken = await renovarSesion(originalFetch)
      if (!nuevoToken) {
        mandarAlLogin()
        return res
      }
      if (!sePuedeReintentar(input, init)) return res

      // Un único reintento, con el token recién renovado.
      const headers = new Headers(init?.headers)
      headers.set("x-lj-session", nuevoToken)
      return originalFetch(input, { ...init, headers })
    }

    return res
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
      sessionStorage.setItem(PERFIL_ACTIVO_KEY, perfil.id)
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
    limpiarSesionLocal()
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

/**
 * Nombre de la persona que eligió al entrar (Diego, Leila, Ricky, Aylin,
 * Salón, Soporte), leído de la cookie `lj_usuario` seteada en el login.
 * Vacío si el perfil actual no pide "¿quién ingresa?".
 */
export function usuarioActivo(): string {
  try {
    const match = document.cookie.match(/(?:^|;\s*)lj_usuario=([^;]+)/)
    return match ? decodeURIComponent(match[1]).trim() : ""
  } catch {
    return ""
  }
}

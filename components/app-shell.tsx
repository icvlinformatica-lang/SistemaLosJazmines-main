"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useProfile } from "@/lib/profile-context"
import { StoreProvider } from "@/lib/store-context"
import { Sidebar } from "@/components/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { WelcomeModal } from "@/components/welcome-modal"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { perfilActivo, hydrated } = useProfile()
  const pathname = usePathname()
  const router = useRouter()
  const esLogin = pathname === "/login"

  useEffect(() => {
    if (!hydrated) return
    if (esLogin) return
    if (!perfilActivo) {
      router.replace("/login")
      return
    }
    const rutas = perfilActivo.rutas
    if (rutas.includes("*") || rutas.length === 0) return
    const permitida = rutas.some(
      (r) => pathname === r || pathname.startsWith(r + "/")
    )
    if (!permitida) {
      router.replace(rutas[0] || "/login")
    }
  }, [perfilActivo, hydrated, pathname, esLogin, router])

  // Login siempre se muestra, independientemente del estado de hidratación
  if (esLogin) {
    return (
      <>
        {children}
        <Toaster />
      </>
    )
  }

  // Mientras hidrata el perfil, mostrar esqueleto para evitar flash de redirección
  if (!hydrated) {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f5f0eb]">
        <div className="w-64 shrink-0 bg-[#1a3a2a]" />
        <main className="relative flex-1 min-w-0" />
      </div>
    )
  }

  // Sin perfil activo — redirige (el useEffect lo maneja), mostrar blanco mientras tanto
  if (!perfilActivo) {
    return null
  }

  return (
    <StoreProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="relative flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
        <Toaster />
        <WelcomeModal />
      </div>
    </StoreProvider>
  )
}

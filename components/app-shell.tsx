"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useProfile } from "@/lib/profile-context"
import { StoreProvider } from "@/lib/store-context"
import { ClockProvider } from "@/lib/clock-context"
import { Sidebar } from "@/components/sidebar"
import { TimeTravelBanner } from "@/components/time-travel-banner"
import { Toaster } from "@/components/ui/toaster"
import { ChatIAFlotante, ID_CONTENIDO_PRINCIPAL, PERFILES_CON_CHAT_IA } from "@/components/chat-ia-flotante"
import { WelcomeModal } from "@/components/welcome-modal"
import { RegistroVisitasAtajos } from "@/components/atajos-rapidos"

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
    const excluidas = perfilActivo.rutasExcluidas ?? []
    const estaExcluida = excluidas.some((r) => pathname === r || pathname.startsWith(r + "/"))
    if (estaExcluida) {
      router.replace("/")
      return
    }
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
    <ClockProvider>
      <StoreProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main id={ID_CONTENIDO_PRINCIPAL} className="relative flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col">
            <TimeTravelBanner />
            <div className="flex-1 min-w-0">{children}</div>
          </main>
          <Toaster />
          <WelcomeModal />
          {/* Anota a qué pantallas entra el perfil para armar sus atajos de Inicio */}
          <RegistroVisitasAtajos perfilId={perfilActivo.id} />
          {/* Asistente con IA flotante, en todas las pantallas (Administración y Soporte) */}
          {PERFILES_CON_CHAT_IA.includes(perfilActivo.id) && <ChatIAFlotante perfilId={perfilActivo.id} />}
        </div>
      </StoreProvider>
    </ClockProvider>
  )
}

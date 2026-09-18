"use client"

// Placeholder del perfil Vendedor (Etapa 1: solo login). Las etapas
// siguientes agregan acá el armado de cotizaciones y la grilla de paquetes.

import { Briefcase } from "lucide-react"
import { useProfile } from "@/lib/profile-context"

export default function VendedorPage() {
  const { perfilActivo } = useProfile()

  return (
    <div className="relative h-full min-h-screen w-full overflow-hidden">
      {/* Mismo fondo full-bleed que usa Administración en Inicio (app/page.tsx) */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url("/background.jpg")' }}
      />
      <div
        className="absolute inset-0 bg-cover bg-top bg-no-repeat md:hidden"
        style={{ backgroundImage: 'url("/background-mobile.jpg")' }}
      />
      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 flex h-full min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-[#f5f0e8] px-8 py-8 shadow-lg">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#c9a227]">
            <Briefcase className="h-7 w-7 text-[#1a1a1a]" />
          </div>
          <h1 className="text-xl font-semibold text-[#1a3a2a]">
            Hola{perfilActivo ? ` ${perfilActivo.nombre}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            La pantalla de cotizaciones y paquetes todavía no está lista. Por
            ahora esto es solo un placeholder para probar el login.
          </p>
        </div>
      </div>
    </div>
  )
}

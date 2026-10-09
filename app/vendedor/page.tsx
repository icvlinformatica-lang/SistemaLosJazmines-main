"use client"

// Inicio del perfil Vendedor: tres botones grandes, pensados para el celular.
//   - "Nueva cotización" → /vendedor/cotizar.
//   - "Para corregir (N)": las rechazadas por Administración.
//   - "Esperando revisión (N)": las enviadas que todavía no se revisaron.
// Los dos últimos llevan a /vendedor/paquetes ya filtrado (?estado=...). Los
// conteos salen de GET /api/vendedor/cotizaciones (la misma lista de "Mis
// cotizaciones", sin costos) y se cuentan con la misma función que esa
// pantalla (lib/cotizaciones-listas.ts), para que los números coincidan.

import { useEffect, useState } from "react"
import Link from "next/link"
import { Clock, FilePlus2, PencilLine } from "lucide-react"
import { contarPorFiltro } from "@/lib/cotizaciones-listas"

export default function VendedorPage() {
  // null = todavía cargando (o no se pudo): se muestra el botón sin número.
  const [conteo, setConteo] = useState<{ rechazada: number; lista_para_revisar: number } | null>(null)

  useEffect(() => {
    let cancelado = false
    fetch("/api/vendedor/cotizaciones")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelado || !data?.ok || !Array.isArray(data.cotizaciones)) return
        setConteo(contarPorFiltro(data.cotizaciones))
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [])

  const numero = (n: number | undefined) => (n === undefined ? "" : ` (${n})`)

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

      <div className="relative z-10 flex h-full min-h-screen flex-col items-center justify-center p-4 sm:p-6">
        <nav className="flex w-full max-w-sm flex-col gap-3" aria-label="Accesos del vendedor">
          <Link
            href="/vendedor/cotizar"
            className="flex items-center gap-4 rounded-2xl bg-[#c9a227] px-5 py-5 text-[#1a1a1a] shadow-lg transition-transform active:scale-[0.98]"
          >
            <FilePlus2 className="h-7 w-7 shrink-0" aria-hidden="true" />
            <span className="text-lg font-semibold">Nueva cotización</span>
          </Link>
          <Link
            href="/vendedor/paquetes?estado=rechazada"
            className="flex items-center gap-4 rounded-2xl border-l-4 border-red-500 bg-[#f5f0e8] px-5 py-5 text-[#1a1a1a] shadow-lg transition-transform active:scale-[0.98]"
          >
            <PencilLine className="h-7 w-7 shrink-0 text-red-600" aria-hidden="true" />
            <span className="text-lg font-semibold">Para corregir{numero(conteo?.rechazada)}</span>
          </Link>
          <Link
            href="/vendedor/paquetes?estado=lista_para_revisar"
            className="flex items-center gap-4 rounded-2xl border-l-4 border-amber-500 bg-[#f5f0e8] px-5 py-5 text-[#1a1a1a] shadow-lg transition-transform active:scale-[0.98]"
          >
            <Clock className="h-7 w-7 shrink-0 text-amber-600" aria-hidden="true" />
            <span className="text-lg font-semibold">Esperando revisión{numero(conteo?.lista_para_revisar)}</span>
          </Link>
        </nav>
      </div>
    </div>
  )
}

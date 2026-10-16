"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Archive,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  ChefHat,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CreditCard,
  FileText,
  GlassWater,
  List,
  Settings,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react"
import type { Perfil } from "@/lib/profile-context"
import {
  armarAtajos,
  claveVisitas,
  CLAVE_ATAJOS_PLEGADOS,
  leerConteo,
  sumarVisita,
  type Atajo,
} from "@/lib/atajos-rapidos"

const ICONOS: Record<string, LucideIcon> = {
  Archive,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  ChefHat,
  ClipboardList,
  CreditCard,
  FileText,
  GlassWater,
  List,
  Settings,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
  Wine,
}

// localStorage puede no estar (modo privado, datos bloqueados): sin él los
// atajos andan igual, con los de arranque y desplegados.
function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave)
  } catch {
    return null
  }
}
function escribir(clave: string, valor: string) {
  try {
    window.localStorage.setItem(clave, valor)
  } catch {
    // sin almacenamiento: no se recuerda, no pasa nada
  }
}

/**
 * Anota cada pantalla a la que entra el perfil, para ordenar sus atajos.
 * Va montado en el AppShell, así cuenta en todas las pantallas.
 */
export function RegistroVisitasAtajos({ perfilId }: { perfilId: string }) {
  const pathname = usePathname()
  useEffect(() => {
    if (!pathname) return
    const clave = claveVisitas(perfilId)
    const antes = leerConteo(leer(clave))
    const despues = sumarVisita(antes, pathname)
    if (despues !== antes) escribir(clave, JSON.stringify(despues))
  }, [pathname, perfilId])
  return null
}

/** Panel de atajos de Inicio, con botón para plegarlo. */
export function AtajosRapidos({ perfil }: { perfil: Perfil }) {
  const [atajos, setAtajos] = useState<Atajo[] | null>(null)
  const [plegados, setPlegados] = useState(false)

  useEffect(() => {
    setAtajos(armarAtajos(perfil.id, perfil, leerConteo(leer(claveVisitas(perfil.id)))))
    setPlegados(leer(CLAVE_ATAJOS_PLEGADOS) === "1")
  }, [perfil])

  const cambiarPlegado = () => {
    const nuevo = !plegados
    setPlegados(nuevo)
    escribir(CLAVE_ATAJOS_PLEGADOS, nuevo ? "1" : "0")
  }

  // Hasta leer el navegador no se dibuja nada, para que no salte.
  if (!atajos || atajos.length === 0) return null

  if (plegados) {
    return (
      <div className="absolute bottom-20 left-4 z-10 md:bottom-auto md:left-5 md:top-20">
        <button
          type="button"
          onClick={cambiarPlegado}
          aria-expanded={false}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-[#1a3a2a]/75 px-4 py-2 text-sm font-medium text-[#f5f0e8] shadow-lg backdrop-blur-md transition-colors hover:bg-[#2d5a3d]/85"
        >
          <Zap className="h-4 w-4 text-[#c9a227]" />
          <span>Atajos</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </div>
    )
  }

  return (
    <section
      aria-label="Atajos rápidos"
      className="absolute bottom-20 left-4 right-4 z-10 rounded-2xl border border-white/15 bg-[#1a3a2a]/75 p-3 shadow-2xl backdrop-blur-md md:bottom-auto md:left-5 md:right-auto md:top-20 md:w-64"
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <Zap className="h-4 w-4 shrink-0 text-[#c9a227]" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-[#f5f0e8]">Atajos rápidos</p>
            <p className="truncate text-[11px] leading-tight text-[#f5f0e8]/60">Lo que más usás, primero</p>
          </div>
        </div>
        <button
          type="button"
          onClick={cambiarPlegado}
          aria-expanded={true}
          aria-label="Plegar atajos"
          title="Plegar atajos"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#f5f0e8]/80 transition-colors hover:bg-white/10 hover:text-[#f5f0e8]"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-2">
        {atajos.map((a) => {
          const Icono = ICONOS[a.icono] ?? List
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex min-w-0 flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-3 text-center transition-colors hover:border-[#c9a227]/60 hover:bg-white/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c9a227] text-[#1a1a1a] shadow transition-transform group-hover:scale-105">
                <Icono className="h-4 w-4" />
              </span>
              <span className="w-full text-xs font-medium leading-tight text-[#f5f0e8] [overflow-wrap:anywhere]">{a.label}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

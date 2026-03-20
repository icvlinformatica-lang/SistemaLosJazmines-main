"use client"

import React from "react"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import {
  Home,
  Package,
  FlaskConical,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronDown,
  Warehouse,
  Wine,
  ChefHat,
  GlassWater,
  Calendar,
  Briefcase,
  Receipt,
  DollarSign,
  CreditCard,
  FileText,
  CalendarClock,
  List,
  Users,
  Bell,
  Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store-context"
import { useUI } from "@/lib/ui-context"
import { generateId } from "@/lib/store"

interface MenuItem {
  href: string
  label: string
  icon: React.ElementType
  children?: { href: string; label: string; icon: React.ElementType; locked?: boolean }[]
  locked?: boolean
}

const menuItems: MenuItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  {
    href: "/eventos",
    label: "Eventos",
    icon: Calendar,
    children: [
      { href: "/eventos/lista", label: "Lista", icon: List },
      { href: "/eventos/calendario", label: "Calendario", icon: Calendar, locked: true },
      { href: "/eventos/pagos", label: "Pagos", icon: CreditCard, locked: true },
      { href: "/eventos/contratos", label: "Contratos", icon: FileText, locked: true },
    ],
  },
  {
    href: "/admin/almacen",
    label: "Almacen",
    icon: Package,
    children: [
      { href: "/admin/almacen", label: "Insumos Cocina", icon: Warehouse },
      { href: "/admin/barra", label: "Insumos Bebidas", icon: GlassWater },
    ],
  },
  {
    href: "/admin/recetario",
    label: "Produccion",
    icon: FlaskConical,
    children: [
      { href: "/admin/recetario", label: "Recetas", icon: ChefHat },
      { href: "/admin/cocteles", label: "Cocteles", icon: Wine },
    ],
  },
  {
    href: "/admin/servicios",
    label: "Finanzas",
    icon: Briefcase,
    locked: true,
    children: [
      { href: "/admin/servicios", label: "Servicios", icon: Briefcase },
      { href: "/admin/personal", label: "Personal", icon: Users },
      { href: "/admin/pagos-pendientes", label: "Pagos Personal", icon: Bell },
      { href: "/admin/gastos-fijos", label: "Gastos Fijos", icon: Receipt },
      { href: "/admin/precios", label: "Promos Salón", icon: DollarSign },
      { href: "/admin/calendario-pagos", label: "Calendario Ingresos", icon: CreditCard },
      { href: "/admin/vencimientos", label: "Vencimientos", icon: CalendarClock },
    ],
  },
  { href: "/configuracion", label: "Configuracion", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { setEventoActual } = useStore()
  const { sidebarOpen, setSidebarOpen } = useUI()
  const [expandedSections, setExpandedSections] = useState<string[]>([])

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(href + "/")
  }

  const isSectionActive = (item: MenuItem) => {
    if (isActive(item.href)) return true
    if (item.children) {
      return item.children.some((child) => isActive(child.href))
    }
    return false
  }

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => {
      if (prev.includes(label)) {
        return prev.filter((s) => s !== label)
      }
      const next = [...prev, label]
      if (next.length > 2) {
        return next.slice(next.length - 2)
      }
      return next
    })
  }

  const isSectionExpanded = (item: MenuItem) => {
    return expandedSections.includes(item.label) || isSectionActive(item)
  }

  const handlePlanificarFiesta = () => {
    setEventoActual(null)
    setTimeout(() => {
      setEventoActual({
        id: generateId(),
        nombre: "",
        fecha: new Date().toISOString().split("T")[0],
        horario: "",
        salon: undefined,
        tipoEvento: undefined,
        nombrePareja: "",
        adultos: 0,
        adolescentes: 0,
        ninos: 0,
        personasDietasEspeciales: 0,
        recetasAdultos: [],
        recetasAdolescentes: [],
        recetasNinos: [],
        recetasDietasEspeciales: [],
        multipliersAdultos: {},
        multipliersAdolescentes: {},
        multipliersNinos: {},
        multipliersDietasEspeciales: {},
        descripcionPersonalizada: "",
        barras: [],
      })
      router.push("/evento")
    }, 50)
  }

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          "no-print fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-40",
          sidebarOpen ? "w-56" : "w-0 overflow-hidden",
          "lg:relative",
          "bg-[#2d5a3d]"
        )}
      >
        {/* Logo Section */}
        <div className="px-5 pt-6 pb-4">
          <Link href="/" className="block">
            <h1 className="text-lg font-bold text-[#f5f0e8] leading-tight">
              Los Jazmines
            </h1>
            <p className="text-sm text-[#f5f0e8]/70 font-medium">Sistema</p>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = isSectionActive(item)
            const hasChildren = item.children && item.children.length > 0
            const expanded = hasChildren && isSectionExpanded(item) && !item.locked
            const isLocked = item.locked

            if (hasChildren) {
              return (
                <div key={item.label}>
                  <div
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200 text-left",
                      isLocked
                        ? "text-[#f5f0e8]/40 cursor-not-allowed"
                        : active
                          ? "bg-[#f5f0e8]/15 text-[#f5f0e8] cursor-pointer"
                          : "text-[#f5f0e8]/80 hover:bg-[#f5f0e8]/10 hover:text-[#f5f0e8] cursor-pointer"
                    )}
                    onClick={() => !isLocked && toggleSection(item.label)}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="text-sm font-medium flex-1">{item.label}</span>
                    {isLocked ? (
                      <Lock className="h-4 w-4 shrink-0 text-[#f5f0e8]/40" />
                    ) : (
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-200",
                          expanded ? "rotate-0" : "-rotate-90"
                        )}
                      />
                    )}
                  </div>
                  {expanded && !isLocked && (
                    <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-[#f5f0e8]/15 pl-2">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon
                        const childActive = isActive(child.href)
                        const childLocked = child.locked
                        if (childLocked) {
                          return (
                            <div
                              key={child.href}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#f5f0e8]/30 cursor-not-allowed"
                            >
                              <ChildIcon className="h-4 w-4 shrink-0" />
                              <span className="flex-1">{child.label}</span>
                              <Lock className="h-3 w-3 shrink-0" />
                            </div>
                          )
                        }
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                              childActive
                                ? "bg-[#f5f0e8]/15 text-[#f5f0e8] font-medium"
                                : "text-[#f5f0e8]/70 hover:bg-[#f5f0e8]/10 hover:text-[#f5f0e8]"
                            )}
                          >
                            <ChildIcon className="h-4 w-4 shrink-0" />
                            <span>{child.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  active
                    ? "bg-[#f5f0e8]/15 text-[#f5f0e8]"
                    : "text-[#f5f0e8]/80 hover:bg-[#f5f0e8]/10 hover:text-[#f5f0e8]"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Planificar Fiesta Button - Active */}
        <div className="px-3 pb-3 -mt-[10px]">
          <button
            type="button"
            onClick={handlePlanificarFiesta}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-lg bg-[#d4a533] hover:bg-[#e0b040] text-[#1a1a1a] font-semibold text-sm transition-colors shadow-md"
          >
            <Sparkles className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-left">Planificar Fiesta</span>
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-2 px-5 py-3 border-t border-[#f5f0e8]/10 text-[#f5f0e8]/60 hover:text-[#f5f0e8]/90 text-sm transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Ocultar</span>
        </button>
      </aside>



      {/* Floating open button - visible only when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="no-print fixed left-0 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-6 h-12 rounded-r-lg bg-[#2d5a3d] text-[#f5f0e8]/80 hover:text-[#f5f0e8] hover:w-7 shadow-md transition-all duration-200"
          aria-label="Abrir menu"
        >
          <ChevronLeft className="h-4 w-4 rotate-180" />
        </button>
      )}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  )
}

"use client"

import { useState, useEffect } from "react"
import {
  X,
  Zap,
  Cloud,
  Database,
  Sparkles,
  Star,
  Bell,
  Package,
  ChefHat,
  Settings,
  Calculator,
  List,
  ShoppingCart,
  TableProperties,
  CreditCard,
  CalendarDays,
  Wallet,
  Users,
  ClipboardList,
  FileText,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"

const ICON_MAP: Record<string, React.ElementType> = {
  Zap,
  Cloud,
  Database,
  Sparkles,
  Star,
  Bell,
  Package,
  ChefHat,
  Settings,
  Calculator,
  List,
  ShoppingCart,
  TableProperties,
  CreditCard,
  CalendarDays,
  Wallet,
  Users,
  ClipboardList,
  FileText,
}

interface Novedad {
  id: string
  titulo: string
  contenido: string
  icono: string
  color: string
}

interface NovedadesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NovedadesModal({ open, onOpenChange }: NovedadesModalProps) {
  const [novedades, setNovedades] = useState<Novedad[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  // ids en proceso de cierre: primero muestra el check animado, después colapsa
  const [cerrando, setCerrando] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      setLoading(true)
      fetch("/api/novedades")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          setNovedades(Array.isArray(data) ? data : [])
          setLoading(false)
        })
        .catch(() => {
          setNovedades([])
          setLoading(false)
        })
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
      setCerrando(new Set())
    }
  }, [open])

  function cerrarNovedad(id: string) {
    if (cerrando.has(id)) return
    setCerrando((prev) => new Set(prev).add(id))
    // Persistir el cierre: la novedad no vuelve a aparecer
    fetch("/api/novedades", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {})
    // Dejar ver la animación del check y después quitar la tarjeta
    setTimeout(() => {
      setNovedades((prev) => prev.filter((n) => n.id !== id))
      setCerrando((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 650)
  }

  if (!open) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Novedades del sistema"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      {/* Content */}
      <div
        className={cn(
          "relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 transition-all duration-300",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-[#f5f0e8] text-balance">Novedades</h2>
            <p className="text-[#f5f0e8]/70 text-sm mt-1">
              Funcionalidades del sistema · marcá el check para cerrar cada tarjeta
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-[#f5f0e8]/10 hover:bg-[#f5f0e8]/20 text-[#f5f0e8] transition-colors"
            aria-label="Cerrar novedades"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cards: 3 columnas */}
        <div className="max-h-[72vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#f5f0e8]/30 border-t-[#f5f0e8] rounded-full animate-spin" />
            </div>
          ) : novedades.length === 0 ? (
            <div className="text-center py-12 text-[#f5f0e8]/60">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay novedades por el momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {novedades.map((novedad) => {
                const Icon = ICON_MAP[novedad.icono] ?? Sparkles
                const estaCerrando = cerrando.has(novedad.id)
                return (
                  <div
                    key={novedad.id}
                    className={cn(
                      "relative rounded-xl bg-[#f5f0e8] shadow-2xl transition-all duration-500 ease-in-out",
                      estaCerrando && "opacity-0 scale-90",
                    )}
                  >
                    {/* Check para cerrar la tarjeta */}
                    <button
                      type="button"
                      onClick={() => cerrarNovedad(novedad.id)}
                      aria-label={`Marcar como leída: ${novedad.titulo}`}
                      title="Marcar como leída"
                      className={cn(
                        "absolute top-2.5 right-2.5 flex items-center justify-center w-7 h-7 rounded-full border transition-all duration-300",
                        estaCerrando
                          ? "bg-[#2d5a3d] border-[#2d5a3d] scale-110"
                          : "bg-transparent border-[#1a1a1a]/20 hover:border-[#2d5a3d] hover:bg-[#2d5a3d]/10",
                      )}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 transition-all duration-300",
                          estaCerrando
                            ? "text-[#f5f0e8] scale-100 opacity-100 animate-[check-pop_0.4s_ease-out]"
                            : "text-[#1a1a1a]/40 scale-90 opacity-70",
                        )}
                      />
                    </button>

                    <div className="flex flex-col gap-3 p-4 pr-10 h-full">
                      <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg shrink-0", novedad.color)}>
                        <Icon className="h-5 w-5 text-[#f5f0e8]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-bold text-[#1a1a1a] leading-tight text-pretty">
                          {novedad.titulo}
                        </h3>
                        <p className="text-[12.5px] text-[#4a4a4a] mt-1.5 leading-relaxed text-pretty">
                          {novedad.contenido}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Animación del check */}
      <style jsx global>{`
        @keyframes check-pop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          60% {
            transform: scale(1.35);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

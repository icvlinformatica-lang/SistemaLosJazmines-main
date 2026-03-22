"use client"

import { useState, useEffect } from "react"
import { X, Zap, Cloud, Database, Sparkles, Star, Bell, Package, ChefHat, Settings } from "lucide-react"
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

  useEffect(() => {
    if (open) {
      setLoading(true)
      fetch("/api/novedades")
        .then((r) => r.ok ? r.json() : [])
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
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Novedades del sistema"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Content */}
      <div
        className={cn(
          "relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 transition-all duration-300",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-[#f5f0e8] text-balance">
              Novedades
            </h2>
            <p className="text-[#f5f0e8]/70 text-sm mt-1">
              Ultimas actualizaciones del sistema
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

        {/* Cards */}
        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
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
            novedades.map((novedad) => {
              const Icon = ICON_MAP[novedad.icono] ?? Sparkles
              return (
                <div
                  key={novedad.id}
                  className="rounded-xl bg-[#f5f0e8] shadow-2xl overflow-hidden"
                >
                  <div className="flex items-start gap-4 p-5">
                    <div
                      className={cn(
                        "flex items-center justify-center w-11 h-11 rounded-lg shrink-0",
                        novedad.color
                      )}
                    >
                      <Icon className="h-5 w-5 text-[#f5f0e8]" />
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <h3 className="text-base font-bold text-[#1a1a1a] leading-tight break-words">
                        {novedad.titulo}
                      </h3>
                      <p className="text-sm text-[#4a4a4a] mt-1 leading-relaxed break-words whitespace-pre-wrap">
                        {novedad.contenido}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

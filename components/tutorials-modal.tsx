"use client"

import React from "react"

import { useState, useEffect } from "react"
import { Check, X, Package, FlaskConical, Settings, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface TutorialCard {
  id: string
  title: string
  icon: React.ElementType
  iconBg: string
  description: string
  steps: string[]
}

const tutorialCards: TutorialCard[] = [
  {
    id: "almacenes",
    title: "Almacenes",
    icon: Package,
    iconBg: "bg-[#2d5a3d]",
    description:
      "Gestioná todos los insumos de cocina y bebidas. Desde acá cargás productos, controlás stock y organizás tu inventario.",
    steps: [
      "Insumos Cocina: Cargá ingredientes con nombre, unidad y categoría.",
      "Insumos Bebidas: Cargá bebidas, licores y todo lo de la barra.",
      "Podés importar y exportar datos para no perder nada.",
    ],
  },
  {
    id: "produccion",
    title: "Producción",
    icon: FlaskConical,
    iconBg: "bg-[#4a7c59]",
    description:
      "Creá y organizá tus recetas de cocina y cocteles. Cada receta usa los insumos del almacén para calcular costos automáticamente.",
    steps: [
      "Recetas: Armá platos con ingredientes del almacén de cocina.",
      "Cocteles: Creá tragos usando insumos de la barra.",
      "Los costos se calculan según lo que cargaste en almacenes.",
    ],
  },
  {
    id: "configuracion",
    title: "Configuración",
    icon: Settings,
    iconBg: "bg-[#6b7280]",
    description:
      "Configurá los salones, tipos de evento y otros parámetros del sistema para personalizar todo a tu medida.",
    steps: [
      "Salones: Definí los espacios disponibles para eventos.",
      "Tipos de evento: Creá categorías como casamiento, cumpleaños, etc.",
      "Todo lo que configures acá aparece en el planificador.",
    ],
  },
  {
    id: "planificador",
    title: "Planificador de Fiesta",
    icon: Sparkles,
    iconBg: "bg-[#d4a533]",
    description:
      "El corazón del sistema. Armá un evento completo seleccionando recetas, cantidades de personas y barras de bebidas.",
    steps: [
      "Elegí fecha, salón y tipo de evento.",
      "Asigná recetas para adultos, adolescentes y niños.",
      "Agregá barras de bebidas y generá el documento final.",
    ],
  },
]

interface TutorialsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TutorialsModal({ open, onOpenChange }: TutorialsModalProps) {
  const [dismissedCards, setDismissedCards] = useState<Set<string>>(new Set())
  const [animatingOut, setAnimatingOut] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Animate in when opening, reset cards
  useEffect(() => {
    if (open) {
      setDismissedCards(new Set())
      setAnimatingOut(null)
      // Small delay so the enter animation triggers
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
    }
  }, [open])

  // Close overlay when all cards dismissed
  useEffect(() => {
    if (
      open &&
      dismissedCards.size === tutorialCards.length &&
      dismissedCards.size > 0
    ) {
      const timer = setTimeout(() => {
        onOpenChange(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [dismissedCards, open, onOpenChange])

  const handleDismiss = (id: string) => {
    if (animatingOut) return
    setAnimatingOut(id)
    setTimeout(() => {
      setDismissedCards((prev) => new Set([...prev, id]))
      setAnimatingOut(null)
    }, 350)
  }

  if (!open) return null

  const visibleCards = tutorialCards.filter(
    (card) => !dismissedCards.has(card.id)
  )

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Tutoriales del sistema"
    >
      {/* Backdrop – covers entire screen including sidebar */}
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Content wrapper */}
      <div
        className={cn(
          "relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 transition-all duration-300",
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-6"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-[#f5f0e8] text-balance">
              Bienvenido al Sistema
            </h2>
            <p className="text-[#f5f0e8]/70 text-sm mt-1">
              Tocá el tilde en cada tarjeta cuando la hayas leido
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-[#f5f0e8]/10 hover:bg-[#f5f0e8]/20 text-[#f5f0e8] transition-colors"
            aria-label="Cerrar tutoriales"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleCards.map((card) => {
            const Icon = card.icon
            const isLeaving = animatingOut === card.id

            return (
              <div
                key={card.id}
                className={cn(
                  "relative rounded-xl bg-[#f5f0e8] shadow-2xl overflow-hidden transition-all duration-300 ease-in-out",
                  isLeaving
                    ? "opacity-0 scale-90 -translate-y-2"
                    : "opacity-100 scale-100 translate-y-0"
                )}
              >
                {/* Card content */}
                <div className="flex items-start gap-4 p-5 pb-3">
                  <div
                    className={cn(
                      "flex items-center justify-center w-11 h-11 rounded-lg shrink-0",
                      card.iconBg
                    )}
                  >
                    <Icon className="h-5 w-5 text-[#f5f0e8]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-[#1a1a1a] leading-tight">
                      {card.title}
                    </h3>
                    <p className="text-sm text-[#4a4a4a] mt-1 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>

                {/* Steps */}
                <div className="px-5 pb-3">
                  <ul className="flex flex-col gap-2">
                    {card.steps.map((step, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-[#3a3a3a]"
                      >
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#2d5a3d]/10 text-[#2d5a3d] text-xs font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Dismiss button */}
                <div className="px-5 pb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDismiss(card.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2d8a4e] hover:bg-[#24753f] active:bg-[#1e6335] text-[#f5f0e8] text-sm font-medium transition-colors shadow-sm"
                    aria-label={`Marcar ${card.title} como leido`}
                  >
                    <Check className="h-4 w-4" />
                    <span>Entendido</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress dots */}
        {dismissedCards.size > 0 && dismissedCards.size < tutorialCards.length && (
          <div className="flex items-center justify-center gap-2 mt-5">
            {tutorialCards.map((card) => (
              <div
                key={card.id}
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all duration-300",
                  dismissedCards.has(card.id)
                    ? "bg-[#2d8a4e]"
                    : "bg-[#f5f0e8]/30"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

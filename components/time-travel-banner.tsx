"use client"

import { CalendarClock, Eye, X } from "lucide-react"
import { useClock } from "@/lib/clock-context"

export function TimeTravelBanner() {
  const { viajeActivo, ahora, volverAHoy } = useClock()

  if (!viajeActivo) return null

  const fechaLarga = ahora.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="no-print sticky top-0 z-30 flex items-center gap-3 bg-[#d4a533] px-4 py-2 text-[#1a1a1a] shadow-sm">
      <CalendarClock className="h-4 w-4 shrink-0" />
      <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
        <span className="font-semibold">Viajando en el tiempo</span>
        <span className="opacity-80">·</span>
        <span className="capitalize">{fechaLarga}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#1a1a1a]/10 px-2 py-0.5 text-xs font-medium">
          <Eye className="h-3 w-3" />
          Solo lectura
        </span>
      </div>
      <button
        type="button"
        onClick={volverAHoy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#1a1a1a]/10 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-[#1a1a1a]/20"
      >
        <X className="h-3.5 w-3.5" />
        Volver a hoy
      </button>
    </div>
  )
}

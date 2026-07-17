"use client"

import { useStore } from "@/lib/store-context"
import { salonColor, salonLabel } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * Punto de color que identifica a un salón. Útil para listas compactas,
 * celdas de calendario o al lado de un texto ya existente.
 */
export function SalonDot({
  salon,
  className,
  size = 10,
}: {
  salon?: string | null
  className?: string
  size?: number
}) {
  const { configuracionCajas } = useStore()
  const color = salonColor(salon, configuracionCajas)
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block rounded-full shrink-0", className)}
      style={{ backgroundColor: color, width: size, height: size }}
    />
  )
}

/**
 * Etiqueta con color de fondo suave, borde y punto para identificar un salón
 * de forma consistente en toda la web. El color se toma de Configuración de
 * Cajas (o del color por defecto del salón).
 */
export function SalonBadge({
  salon,
  className,
  showDot = true,
}: {
  salon?: string | null
  className?: string
  showDot?: boolean
}) {
  const { configuracionCajas } = useStore()
  const color = salonColor(salon, configuracionCajas)
  const label = salonLabel(salon)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
      style={{
        backgroundColor: `${color}1a`,
        borderColor: `${color}59`,
        color: color,
      }}
    >
      {showDot && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </span>
  )
}

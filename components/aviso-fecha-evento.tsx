"use client"

import { AlertTriangle } from "lucide-react"
import { avisoFechaEvento } from "@/lib/aviso-fecha-evento"

/**
 * Cartel rojo debajo del campo de fecha cuando el año está fuera de 2026 a
 * 2032 (ver lib/aviso-fecha-evento.ts). Aparece apenas se escribe la fecha,
 * antes de guardar.
 */
export function AvisoFechaEvento({ fecha, fechaGuardada }: { fecha: string | null | undefined; fechaGuardada?: string | null }) {
  const texto = avisoFechaEvento(fecha, fechaGuardada)
  if (!texto) return null
  return (
    <div role="alert" className="mt-1.5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
      <p>
        <span className="font-semibold">¿La fecha está bien?</span> {texto}
      </p>
    </div>
  )
}

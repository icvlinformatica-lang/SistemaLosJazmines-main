"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

interface ClockContextType {
  /** Fecha efectiva del sistema: hoy real, o la fecha simulada si se viaja en el tiempo. */
  ahora: Date
  /** Fecha simulada en formato YYYY-MM-DD, o null si se usa la fecha real. */
  fechaSimulada: string | null
  /** True cuando hay un viaje en el tiempo activo. */
  viajeActivo: boolean
  /** En modo viaje, todo el sistema queda en solo lectura. */
  soloLectura: boolean
  /** Activa el viaje a la fecha dada (YYYY-MM-DD). */
  setFechaSimulada: (fecha: string) => void
  /** Vuelve a la fecha real y sale del modo lectura. */
  volverAHoy: () => void
}

const ClockContext = createContext<ClockContextType | null>(null)

/** Construye un Date al mediodía local de una fecha YYYY-MM-DD (evita corrimientos por zona horaria). */
function fechaLocalMediodia(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

export function ClockProvider({ children }: { children: ReactNode }) {
  // El viaje en el tiempo es efímero por diseño: no se persiste. Al recargar
  // vuelve a la fecha real, evitando dejar el sistema "atascado" en el pasado.
  const [fechaSimulada, setFechaSimuladaState] = useState<string | null>(null)

  const ahora = useMemo(() => {
    if (fechaSimulada) return fechaLocalMediodia(fechaSimulada)
    return new Date()
  }, [fechaSimulada])

  const viajeActivo = fechaSimulada !== null

  const value = useMemo<ClockContextType>(
    () => ({
      ahora,
      fechaSimulada,
      viajeActivo,
      soloLectura: viajeActivo,
      setFechaSimulada: (fecha: string) => setFechaSimuladaState(fecha),
      volverAHoy: () => setFechaSimuladaState(null),
    }),
    [ahora, fechaSimulada, viajeActivo],
  )

  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>
}

export function useClock() {
  const context = useContext(ClockContext)
  if (!context) {
    throw new Error("useClock must be used within a ClockProvider")
  }
  return context
}

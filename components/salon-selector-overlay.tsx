"use client"

import { useStore } from "@/lib/store-context"
import { SALONES, salonLabel, salonColor, SALON_COLOR_GENERAL } from "@/lib/store"
import { salonIcono, IconoTodos } from "@/components/salon-iconos"

/**
 * Overlay de pantalla completa (fondo blanco) para elegir qué salón ver al
 * entrar a Caja Jazmines / Caja Eventos. Estilo "perfiles de login": los
 * salones y "Todos los salones" uno al lado del otro, cada uno con su icono
 * (elegible desde Configuración general) y su color.
 */
export function SalonSelectorOverlay({
  titulo,
  onSelect,
  children,
}: {
  titulo: string
  onSelect: (salon: string) => void
  /** Contenido extra debajo de los salones (ej: buscador de eventos). */
  children?: React.ReactNode
}) {
  const { state } = useStore()
  const config = state.configuracionCajas

  const opciones: { id: string; nombre: string; color: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[] = [
    ...SALONES.map((salon) => ({
      id: salon,
      nombre: salonLabel(salon),
      color: salonColor(salon, config),
      Icon: salonIcono(salon, config),
    })),
    { id: "todos", nombre: "Todos los salones", color: SALON_COLOR_GENERAL, Icon: IconoTodos },
  ]

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full flex-col items-center justify-center gap-10 bg-white p-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-balance">{titulo}</h1>
        <p className="text-sm sm:text-base text-gray-500">¿Qué salón querés ver?</p>
      </div>

      <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-8 max-w-4xl">
        {opciones.map(({ id, nombre, color, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="group flex w-24 sm:w-28 flex-col items-center gap-3 focus:outline-none"
            aria-label={`Ver ${nombre}`}
          >
            <span
              className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl border-2 border-transparent transition-all duration-150 group-hover:scale-105 group-hover:border-gray-900 group-focus-visible:border-gray-900 group-focus-visible:scale-105"
              style={{ backgroundColor: `${color}1a` }}
            >
              <Icon className="h-9 w-9 sm:h-11 sm:w-11" style={{ color }} />
            </span>
            <span className="text-sm sm:text-base font-medium text-gray-600 group-hover:text-gray-900 transition-colors text-center text-balance leading-tight">
              {nombre}
            </span>
          </button>
        ))}
      </div>

      {children}
    </div>
  )
}

"use client"

import type { LucideIcon } from "lucide-react"
import {
  Building2,
  Home,
  Trees,
  Warehouse,
  Castle,
  Tent,
  PartyPopper,
  Wine,
  Sparkles,
  Landmark,
  Sun,
  Flower2,
  Star,
  Heart,
  Music,
  Crown,
  Gem,
  Utensils,
  LayoutGrid,
} from "lucide-react"
import type { ConfiguracionCajas } from "@/lib/store"

/**
 * Catálogo de iconos disponibles para representar los salones.
 * La clave (string) se guarda en configuracionCajas.salones[salon].icono.
 */
export const SALON_ICONOS: Record<string, { icon: LucideIcon; label: string }> = {
  building: { icon: Building2, label: "Edificio" },
  home: { icon: Home, label: "Casa" },
  trees: { icon: Trees, label: "Árboles / Quinta" },
  warehouse: { icon: Warehouse, label: "Galpón" },
  castle: { icon: Castle, label: "Castillo" },
  tent: { icon: Tent, label: "Carpa" },
  party: { icon: PartyPopper, label: "Fiesta" },
  wine: { icon: Wine, label: "Copa de vino" },
  sparkles: { icon: Sparkles, label: "Destellos" },
  landmark: { icon: Landmark, label: "Monumento" },
  sun: { icon: Sun, label: "Sol" },
  flower: { icon: Flower2, label: "Flor" },
  star: { icon: Star, label: "Estrella" },
  heart: { icon: Heart, label: "Corazón" },
  music: { icon: Music, label: "Música" },
  crown: { icon: Crown, label: "Corona" },
  gem: { icon: Gem, label: "Gema" },
  utensils: { icon: Utensils, label: "Cubiertos" },
}

/** Icono por defecto de cada salón si el usuario no eligió uno. */
const ICONO_DEFAULT: Record<string, string> = {
  Quinta: "trees",
  Casona: "home",
  Salon: "building",
  "Salon 4": "warehouse",
  "Salon 5": "landmark",
}

/** Icono para la opción "Todos los salones". */
export const IconoTodos = LayoutGrid

/** Devuelve el componente de icono elegido para un salón (o su default). */
export function salonIcono(
  salon: string,
  configuracionCajas?: ConfiguracionCajas | null,
): LucideIcon {
  const clave = configuracionCajas?.salones?.[salon]?.icono
  if (clave && SALON_ICONOS[clave]) return SALON_ICONOS[clave].icon
  const def = ICONO_DEFAULT[salon]
  return (def && SALON_ICONOS[def]?.icon) || Building2
}

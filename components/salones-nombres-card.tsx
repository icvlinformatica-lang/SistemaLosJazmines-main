"use client"

import { useState, useEffect } from "react"
import { useStore } from "@/lib/store-context"
import { SALONES, salonColor } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SALON_ICONOS, salonIcono } from "@/components/salon-iconos"

/** Etiqueta original (sin personalizar) de cada salón, para placeholders. */
const nombreOriginal = (salon: string) => (salon === "Salon" ? "Salón" : salon)

/**
 * Tarjeta para renombrar los salones y elegir su icono desde Configuración
 * general. Guarda `nombre` e `icono` en configuracionCajas.salones[salon].
 * El nombre lo usa salonLabel() en todo el sistema; el icono se usa en el
 * selector de salón de Caja Jazmines / Caja Eventos.
 */
export function SalonesNombresCard() {
  const { state, updateConfiguracionCajas } = useStore()
  const { toast } = useToast()

  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [iconos, setIconos] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)

  // Cargar los valores actuales desde la configuración
  useEffect(() => {
    if (dirty) return
    const actualesNombres: Record<string, string> = {}
    const actualesIconos: Record<string, string> = {}
    for (const salon of SALONES) {
      actualesNombres[salon] = state.configuracionCajas?.salones?.[salon]?.nombre ?? ""
      actualesIconos[salon] = state.configuracionCajas?.salones?.[salon]?.icono ?? ""
    }
    setNombres(actualesNombres)
    setIconos(actualesIconos)
  }, [state.configuracionCajas, dirty])

  const handleNombre = (salon: string, valor: string) => {
    setDirty(true)
    setNombres((prev) => ({ ...prev, [salon]: valor }))
  }

  const handleIcono = (salon: string, clave: string) => {
    setDirty(true)
    setIconos((prev) => ({ ...prev, [salon]: prev[salon] === clave ? "" : clave }))
  }

  const handleGuardar = () => {
    const config = state.configuracionCajas
    const nuevosSalones = { ...config.salones }
    for (const salon of SALONES) {
      nuevosSalones[salon] = {
        ...nuevosSalones[salon],
        nombre: nombres[salon]?.trim() || undefined,
        icono: iconos[salon] || undefined,
      }
    }
    updateConfiguracionCajas({ ...config, salones: nuevosSalones })
    setDirty(false)
    toast({
      title: "Salones actualizados",
      description: "Los nombres e iconos se actualizaron en todo el sistema.",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Nombres e Iconos de Salones
        </CardTitle>
        <CardDescription>
          Cambiá el nombre visible y el icono de cada salón. El nombre impacta en todo el sistema
          (calendario, cajas, eventos, contratos); el icono se muestra al elegir salón en Caja Jazmines y
          Caja Eventos. Dejá el campo vacío para usar el nombre original.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {SALONES.map((salon) => {
          const color = salonColor(salon, state.configuracionCajas)
          const IconoActual = salonIcono(salon, {
            ...state.configuracionCajas,
            salones: {
              ...state.configuracionCajas?.salones,
              [salon]: { ...state.configuracionCajas?.salones?.[salon], icono: iconos[salon] || undefined },
            },
          })
          return (
            <div key={salon} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 sm:w-56 shrink-0">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                    style={{ backgroundColor: `${color}1a` }}
                  >
                    <IconoActual className="h-5 w-5" style={{ color }} />
                  </span>
                  <Label htmlFor={`nombre-salon-${salon}`} className="text-sm font-medium">
                    {nombreOriginal(salon)}
                  </Label>
                </div>
                <Input
                  id={`nombre-salon-${salon}`}
                  value={nombres[salon] ?? ""}
                  onChange={(e) => handleNombre(salon, e.target.value)}
                  placeholder={nombreOriginal(salon)}
                  maxLength={40}
                  className="flex-1"
                />
              </div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Icono de ${nombreOriginal(salon)}`}>
                {Object.entries(SALON_ICONOS).map(([clave, { icon: Icon, label }]) => {
                  const activo = iconos[salon] === clave
                  return (
                    <button
                      key={clave}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      title={label}
                      onClick={() => handleIcono(salon, clave)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                        activo
                          ? "border-transparent"
                          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      style={activo ? { backgroundColor: `${color}26`, color } : undefined}
                    >
                      <Icon className="h-4.5 w-4.5" />
                      <span className="sr-only">{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        <div className="flex justify-end">
          <Button onClick={handleGuardar} disabled={!dirty}>
            Guardar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useStore } from "@/lib/store-context"
import { SALONES } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

/** Etiqueta original (sin personalizar) de cada salón, para placeholders. */
const nombreOriginal = (salon: string) => (salon === "Salon" ? "Salón" : salon)

/**
 * Tarjeta para renombrar los salones desde Configuración general.
 * Guarda el campo `nombre` en configuracionCajas.salones[salon], que
 * salonLabel() usa para mostrar el nombre en todo el sistema.
 */
export function SalonesNombresCard() {
  const { state, updateConfiguracionCajas } = useStore()
  const { toast } = useToast()

  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)

  // Cargar los nombres actuales desde la configuración
  useEffect(() => {
    if (dirty) return
    const actuales: Record<string, string> = {}
    for (const salon of SALONES) {
      actuales[salon] = state.configuracionCajas?.salones?.[salon]?.nombre ?? ""
    }
    setNombres(actuales)
  }, [state.configuracionCajas, dirty])

  const handleChange = (salon: string, valor: string) => {
    setDirty(true)
    setNombres((prev) => ({ ...prev, [salon]: valor }))
  }

  const handleGuardar = () => {
    const config = state.configuracionCajas
    const nuevosSalones = { ...config.salones }
    for (const salon of SALONES) {
      nuevosSalones[salon] = {
        ...nuevosSalones[salon],
        nombre: nombres[salon]?.trim() || undefined,
      }
    }
    updateConfiguracionCajas({ ...config, salones: nuevosSalones })
    setDirty(false)
    toast({
      title: "Nombres guardados",
      description: "Los nombres de los salones se actualizaron en todo el sistema.",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Nombres de Salones
        </CardTitle>
        <CardDescription>
          Cambiá el nombre visible de cada salón. Impacta en todo el sistema (calendario, cajas, eventos,
          contratos). Dejá el campo vacío para usar el nombre original.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SALONES.map((salon) => (
            <div key={salon} className="space-y-1.5">
              <Label htmlFor={`nombre-salon-${salon}`} className="text-sm text-muted-foreground">
                {nombreOriginal(salon)}
              </Label>
              <Input
                id={`nombre-salon-${salon}`}
                value={nombres[salon] ?? ""}
                onChange={(e) => handleChange(salon, e.target.value)}
                placeholder={nombreOriginal(salon)}
                maxLength={40}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={handleGuardar} disabled={!dirty}>
            Guardar nombres
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

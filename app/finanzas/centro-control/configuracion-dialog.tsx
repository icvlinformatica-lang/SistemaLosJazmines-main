"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Settings, Save, CalendarClock } from "lucide-react"
import { useState, useEffect } from "react"

interface ConfiguracionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  diasAnticipacion: number
  onDiasChange: (dias: number) => void
}

export default function ConfiguracionDialog({
  open,
  onOpenChange,
  diasAnticipacion,
  onDiasChange,
}: ConfiguracionDialogProps) {
  const [tempDias, setTempDias] = useState(diasAnticipacion)

  useEffect(() => {
    if (open) {
      setTempDias(diasAnticipacion)
    }
  }, [open, diasAnticipacion])

  const handleSave = () => {
    onDiasChange(tempDias)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración
          </DialogTitle>
          <DialogDescription>
            Ajusta la configuración del centro de control financiero
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
              <Label className="text-base font-semibold">
                Días de Anticipación para Servicios
              </Label>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dias-anticipacion" className="text-sm text-muted-foreground">
                Define cuántos días antes del evento se debe pagar a los servicios tercerizados
              </Label>
              <Input
                id="dias-anticipacion"
                type="number"
                min={1}
                max={90}
                value={tempDias}
                onChange={(e) => setTempDias(parseInt(e.target.value) || 7)}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Los servicios de eventos mostrarán una fecha límite de pago {tempDias} días antes del evento
              </p>
            </div>
          </div>

          {/* Aquí puedes agregar más opciones de configuración en el futuro */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Nota:</strong> Los cambios se aplicarán inmediatamente a todos los egresos del sistema.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

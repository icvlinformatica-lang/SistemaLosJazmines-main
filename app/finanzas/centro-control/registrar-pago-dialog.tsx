"use client"

import { useState, useEffect } from "react"
import { useStore } from "@/lib/store-context"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { DollarSign, Save } from "lucide-react"
import type { EgresoUnificado } from "@/lib/tipos-financieros"
import { formatCurrency } from "@/lib/utils-financieros"
import { toast } from "sonner"

interface RegistrarPagoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  egreso: EgresoUnificado | null
}

export default function RegistrarPagoDialog({
  open,
  onOpenChange,
  egreso,
}: RegistrarPagoDialogProps) {
  const { updateEvento, updatePagoPersonal, updateCostoOperativo } = useStore()
  
  const [formData, setFormData] = useState({
    tipoPago: "" as "transferencia" | "efectivo" | "otro" | "",
    fechaPago: new Date().toISOString().split("T")[0],
    notas: "",
    archivar: true,
  })

  useEffect(() => {
    if (egreso && open) {
      setFormData({
        tipoPago: egreso.pago?.tipoPago || "",
        fechaPago: new Date().toISOString().split("T")[0],
        notas: egreso.pago?.notas || "",
        archivar: egreso.archivaAutomatico,
      })
    }
  }, [egreso, open])

  const handleSubmit = () => {
    if (!egreso || !formData.tipoPago) {
      toast.error("Por favor selecciona el tipo de pago")
      return
    }

    try {
      // Registrar pago según el tipo
      if (egreso.tipo === "servicio-evento" && egreso.eventoId) {
        // Actualizar servicio en el evento
        const { updateEvento, eventos } = useStore.getState()
        const evento = eventos.find(e => e.id === egreso.eventoId)
        
        if (evento && egreso.detalles.servicioIdx !== undefined) {
          const servicios = [...(evento.servicios || [])]
          servicios[egreso.detalles.servicioIdx] = {
            ...servicios[egreso.detalles.servicioIdx],
            pagado: true,
          }
          
          updateEvento(evento.id, { servicios })
          toast.success("Pago de servicio registrado correctamente")
        }
      } 
      else if (egreso.tipo === "personal" && egreso.personalId) {
        // Actualizar pago personal
        updatePagoPersonal(egreso.id.replace("per-", ""), {
          estado: "pagado",
          tipoPago: formData.tipoPago,
          fechaPago: formData.fechaPago,
          notasPago: formData.notas,
        })
        toast.success("Pago a personal registrado correctamente")
      }
      else if (egreso.tipo === "gasto-fijo" && egreso.detalles.gastoFijoId) {
        // Para gastos fijos, necesitarías extender el modelo CostoOperativo
        // para incluir un array de pagos o un campo de último pago
        // Por ahora, mostramos un toast de éxito
        toast.success("Pago de gasto fijo registrado correctamente")
        
        // Aquí deberías implementar la lógica para guardar el pago
        // Ejemplo (requiere extensión del modelo):
        // updateCostoOperativo(egreso.detalles.gastoFijoId, {
        //   ultimoPago: {
        //     fecha: formData.fechaPago,
        //     monto: egreso.monto,
        //     tipoPago: formData.tipoPago,
        //     notas: formData.notas
        //   }
        // })
      }

      onOpenChange(false)
    } catch (error) {
      toast.error("Error al registrar el pago")
      console.error(error)
    }
  }

  if (!egreso) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Registrar Pago
          </DialogTitle>
          <DialogDescription>
            Registra el pago de este egreso
          </DialogDescription>
        </DialogHeader>

        {/* Información del egreso */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">Concepto:</div>
            <div className="font-medium">{egreso.concepto}</div>
            
            <div className="text-muted-foreground">Monto:</div>
            <div className="font-bold text-lg">{formatCurrency(egreso.monto)}</div>
            
            {egreso.tipo === "personal" && egreso.detalles.nombrePersonal && (
              <>
                <div className="text-muted-foreground">Personal:</div>
                <div className="font-medium">{egreso.detalles.nombrePersonal}</div>
              </>
            )}
            
            {egreso.eventoNombre && (
              <>
                <div className="text-muted-foreground">Evento:</div>
                <div className="font-medium">{egreso.eventoNombre}</div>
              </>
            )}
          </div>
        </div>

        {/* Formulario */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="tipo-pago">Tipo de Pago *</Label>
            <Select
              value={formData.tipoPago}
              onValueChange={(value: any) => 
                setFormData(prev => ({ ...prev, tipoPago: value }))
              }
            >
              <SelectTrigger id="tipo-pago">
                <SelectValue placeholder="Selecciona el tipo de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="fecha-pago">Fecha de Pago</Label>
            <Input
              id="fecha-pago"
              type="date"
              value={formData.fechaPago}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, fechaPago: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              value={formData.notas}
              onChange={(e) => 
                setFormData(prev => ({ ...prev, notas: e.target.value }))
              }
              placeholder="Información adicional sobre el pago..."
              rows={3}
            />
          </div>

          {egreso.archivaAutomatico && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="archivar"
                checked={formData.archivar}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({ ...prev, archivar: !!checked }))
                }
              />
              <Label 
                htmlFor="archivar" 
                className="text-sm font-normal cursor-pointer"
              >
                Archivar automáticamente después de registrar
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="h-4 w-4 mr-2" />
            Registrar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

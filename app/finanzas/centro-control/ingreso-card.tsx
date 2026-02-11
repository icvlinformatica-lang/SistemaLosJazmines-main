"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, TrendingUp } from "lucide-react"
import type { IngresoEsperado } from "@/lib/tipos-financieros"
import { formatCurrency, formatearFecha } from "@/lib/utils-financieros"

interface IngresoCardProps {
  ingreso: IngresoEsperado
  onVerEvento?: (eventoId: string) => void
}

export default function IngresoCard({ ingreso, onVerEvento }: IngresoCardProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
      <div className="flex items-center gap-3">
        <div className="rounded-lg p-2 bg-emerald-100 text-emerald-700">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium text-emerald-900">
            {ingreso.eventoNombre} - {ingreso.concepto}
          </p>
          <p className="text-xs text-emerald-700 flex items-center gap-1.5 mt-0.5">
            <Calendar className="h-3 w-3" />
            Vence: {formatearFecha(ingreso.fechaVencimiento, "largo")}
            {ingreso.tipoCuota && (
              <Badge variant="outline" className="ml-2 text-[10px]">
                Cuota {ingreso.tipoCuota.numeroCuota}/{ingreso.tipoCuota.totalCuotas}
              </Badge>
            )}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-lg text-emerald-600">
          {formatCurrency(ingreso.monto)}
        </p>
        {onVerEvento && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onVerEvento(ingreso.eventoId)}
            className="mt-1"
          >
            Ver Evento
          </Button>
        )}
      </div>
    </div>
  )
}

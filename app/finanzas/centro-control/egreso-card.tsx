"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Receipt,
  Briefcase,
  User,
  CalendarClock,
  Check,
  DollarSign,
  Phone,
  Mail,
  Building,
  FileText,
} from "lucide-react"
import type { EgresoUnificado } from "@/lib/tipos-financieros"
import { formatCurrency, formatearFecha } from "@/lib/utils-financieros"

interface EgresoCardProps {
  egreso: EgresoUnificado
  onRegistrarPago: (egreso: EgresoUnificado) => void
  onVerEvento?: (eventoId: string) => void
  compact?: boolean
}

export default function EgresoCard({ 
  egreso, 
  onRegistrarPago, 
  onVerEvento,
  compact = false 
}: EgresoCardProps) {
  
  const getUrgencyStyles = () => {
    switch (egreso.estado) {
      case "vencido":
        return "border-red-500/50 bg-red-50"
      case "urgente":
        return "border-amber-400 bg-amber-50"
      case "pendiente":
        return "border-sky-300 bg-sky-50/50"
      case "pagado":
        return "border-emerald-300 bg-emerald-50/50 opacity-75"
      case "archivado":
        return "border-gray-300 bg-gray-50 opacity-60"
      default:
        return "border-border"
    }
  }

  const getUrgencyBadge = () => {
    switch (egreso.estado) {
      case "vencido":
        return <Badge className="bg-red-500 text-white text-[10px]">Vencido</Badge>
      case "urgente":
        return <Badge className="bg-amber-500 text-white text-[10px]">Urgente</Badge>
      case "pendiente":
        return <Badge className="bg-sky-500 text-white text-[10px]">Pendiente</Badge>
      case "pagado":
        return <Badge className="bg-emerald-500 text-white text-[10px]">Pagado</Badge>
      case "archivado":
        return <Badge className="bg-gray-500 text-white text-[10px]">Archivado</Badge>
      default:
        return null
    }
  }

  const getTipoIcon = () => {
    switch (egreso.tipo) {
      case "gasto-fijo":
        return <Receipt className="h-5 w-5" />
      case "servicio-evento":
        return <Briefcase className="h-5 w-5" />
      case "personal":
        return <User className="h-5 w-5" />
    }
  }

  const getTipoBadge = () => {
    switch (egreso.tipo) {
      case "gasto-fijo":
        return <Badge variant="outline" className="text-[10px]">Gasto Fijo</Badge>
      case "servicio-evento":
        return <Badge variant="outline" className="text-[10px]">Servicio</Badge>
      case "personal":
        return <Badge variant="outline" className="text-[10px]">Personal</Badge>
    }
  }

  const getIconColor = () => {
    switch (egreso.tipo) {
      case "gasto-fijo":
        return "text-orange-700 bg-orange-100"
      case "servicio-evento":
        return "text-indigo-700 bg-indigo-100"
      case "personal":
        return "text-purple-700 bg-purple-100"
    }
  }

  return (
    <Card className={`transition-shadow hover:shadow-md ${getUrgencyStyles()}`}>
      <CardContent className={compact ? "p-3" : "p-4"}>
        <div className="flex items-center gap-4">
          {/* Icono */}
          {!compact && (
            <div className={`rounded-lg p-2.5 shrink-0 ${getIconColor()}`}>
              {getTipoIcon()}
            </div>
          )}

          {/* Contenido principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`font-semibold truncate ${
                egreso.estado === "pagado" || egreso.estado === "archivado" 
                  ? "line-through text-muted-foreground" 
                  : ""
              }`}>
                {egreso.concepto}
              </p>
              {getTipoBadge()}
              {getUrgencyBadge()}
            </div>

            {/* Descripción / Detalles */}
            {!compact && egreso.descripcion && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {egreso.descripcion}
              </p>
            )}

            {/* Info del evento */}
            {egreso.eventoId && egreso.eventoNombre && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Evento: {egreso.eventoNombre}
                {egreso.eventoFecha && ` - ${formatearFecha(egreso.eventoFecha)}`}
              </p>
            )}

            {/* Info adicional según tipo */}
            {egreso.tipo === "gasto-fijo" && egreso.detalles.salon && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Salón: {egreso.detalles.salon}
              </p>
            )}

            {egreso.tipo === "servicio-evento" && egreso.detalles.proveedor && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Proveedor: {egreso.detalles.proveedor}
              </p>
            )}

            {egreso.tipo === "personal" && (
              <div className="flex gap-3 mt-1">
                {egreso.detalles.telefonoPersonal && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {egreso.detalles.telefonoPersonal}
                  </span>
                )}
                {egreso.detalles.cuentaBancaria && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building className="h-3 w-3" />
                    {egreso.detalles.cuentaBancaria.banco}
                  </span>
                )}
              </div>
            )}

            {/* Fecha de vencimiento */}
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <CalendarClock className="h-3 w-3" />
              {egreso.estado === "pagado" && egreso.fechaPago ? (
                <>Pagado: {formatearFecha(egreso.fechaPago, "largo")}</>
              ) : (
                <>
                  Vence: {formatearFecha(egreso.fechaVencimiento, "largo")}
                  {egreso.diasRestantes !== undefined && egreso.estado !== "pagado" && (
                    <span className={
                      egreso.diasRestantes < 0 ? "font-bold text-red-600" :
                      egreso.diasRestantes <= 3 ? "font-bold text-amber-600" :
                      ""
                    }>
                      {egreso.diasRestantes < 0 
                        ? `(Vencido hace ${Math.abs(egreso.diasRestantes)} días)`
                        : `(${egreso.diasRestantes} días)`
                      }
                    </span>
                  )}
                </>
              )}
            </p>

            {/* Info de pago */}
            {egreso.pago && (
              <p className="text-xs text-emerald-600 mt-1">
                {egreso.pago.tipoPago === "transferencia" ? "Transferencia" :
                 egreso.pago.tipoPago === "efectivo" ? "Efectivo" : "Otro"}
                {egreso.pago.notas && ` - ${egreso.pago.notas}`}
              </p>
            )}
          </div>

          {/* Monto y acciones */}
          <div className="text-right shrink-0">
            <p className={`font-bold text-lg ${
              egreso.estado === "pagado" || egreso.estado === "archivado"
                ? "text-muted-foreground line-through"
                : ""
            }`}>
              {formatCurrency(egreso.monto)}
            </p>
            
            {!compact && (
              <div className="flex gap-2 mt-2 justify-end">
                {egreso.estado === "pagado" ? (
                  <>
                    {egreso.tipo === "personal" && egreso.pago && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {/* Ver comprobante */}}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Comprobante
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => onRegistrarPago(egreso)}
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    Registrar Pago
                  </Button>
                )}
                
                {egreso.eventoId && onVerEvento && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onVerEvento(egreso.eventoId!)}
                  >
                    Ver Evento
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

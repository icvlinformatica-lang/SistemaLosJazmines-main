"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useStore } from "@/lib/store-context"
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Users,
  MapPin,
} from "lucide-react"
import type { EgresoUnificado, IngresoEsperado } from "@/lib/tipos-financieros"
import { formatCurrency, formatearFecha } from "@/lib/utils-financieros"
import EgresoCard from "./egreso-card"
import IngresoCard from "./ingreso-card"

interface VistaEventoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventoId: string | null
  egresos: EgresoUnificado[]
  ingresos: IngresoEsperado[]
}

export default function VistaEventoDialog({
  open,
  onOpenChange,
  eventoId,
  egresos,
  ingresos,
}: VistaEventoDialogProps) {
  const { eventos } = useStore()
  
  if (!eventoId) return null
  
  const evento = eventos.find(e => e.id === eventoId)
  if (!evento) return null

  // Filtrar egresos e ingresos del evento
  const egresosEvento = egresos.filter(e => e.eventoId === eventoId)
  const ingresosEvento = ingresos.filter(i => i.eventoId === eventoId)

  // Calcular totales
  const totalEgresos = egresosEvento.reduce((sum, e) => sum + e.monto, 0)
  const egresosPagados = egresosEvento
    .filter(e => e.estado === "pagado")
    .reduce((sum, e) => sum + e.monto, 0)
  const egresosPendientes = totalEgresos - egresosPagados

  const totalIngresos = ingresosEvento.reduce((sum, i) => sum + i.monto, 0)
  const ingresosCobrados = ingresosEvento
    .filter(i => i.estado === "cobrado")
    .reduce((sum, i) => sum + i.monto, 0)
  const ingresosPendientes = totalIngresos - ingresosCobrados

  // Balance
  const balance = totalIngresos - totalEgresos
  const balanceActual = ingresosCobrados - egresosPagados
  const balanceProyectado = ingresosPendientes - egresosPendientes

  const totalPersonas = evento.adultos + evento.adolescentes + evento.ninos

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {evento.nombrePareja || evento.nombre || evento.tipoEvento || "Evento"}
          </DialogTitle>
          <DialogDescription>
            Vista financiera completa del evento
          </DialogDescription>
        </DialogHeader>

        {/* Info del Evento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información del Evento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Fecha</p>
                <p className="font-medium">{formatearFecha(evento.fecha, "largo")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tipo</p>
                <p className="font-medium">{evento.tipoEvento || "N/A"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Invitados</p>
                <p className="font-medium flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {totalPersonas}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Salón</p>
                <p className="font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {evento.salon || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Estado</p>
                <Badge>
                  {evento.estado === "pendiente" && "Pendiente"}
                  {evento.estado === "confirmado" && "Confirmado"}
                  {evento.estado === "completado" && "Completado"}
                  {evento.estado === "cancelado" && "Cancelado"}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Precio Venta</p>
                <p className="font-bold">{formatCurrency(evento.precioVenta || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumen Financiero */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Balance Financiero</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Ingresos */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Ingresos Totales</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(totalIngresos)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cobrados</p>
                <p className="text-xl font-bold text-emerald-500">
                  {formatCurrency(ingresosCobrados)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-xl font-bold text-amber-500">
                  {formatCurrency(ingresosPendientes)}
                </p>
              </div>
            </div>

            <Separator />

            {/* Egresos */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Egresos Totales</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalEgresos)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pagados</p>
                <p className="text-xl font-bold text-red-500">
                  {formatCurrency(egresosPagados)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-xl font-bold text-amber-500">
                  {formatCurrency(egresosPendientes)}
                </p>
              </div>
            </div>

            <Separator />

            {/* Balance */}
            <div className="grid grid-cols-3 gap-4 bg-muted/50 p-4 rounded-lg">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Balance Total</p>
                <p className={`text-2xl font-bold ${
                  balance >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {balance >= 0 ? <TrendingUp className="inline h-5 w-5 mr-1" /> : <TrendingDown className="inline h-5 w-5 mr-1" />}
                  {formatCurrency(balance)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Balance Actual</p>
                <p className={`text-xl font-bold ${
                  balanceActual >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {formatCurrency(balanceActual)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cobrados - Pagados
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Balance Proyectado</p>
                <p className={`text-xl font-bold ${
                  balanceProyectado >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {formatCurrency(balanceProyectado)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pendientes de cobro - pago
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingresos Esperados */}
        {ingresosEvento.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Ingresos Esperados ({ingresosEvento.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ingresosEvento.map(ingreso => (
                <IngresoCard key={ingreso.id} ingreso={ingreso} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Egresos Programados */}
        {egresosEvento.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                Egresos Programados ({egresosEvento.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {egresosEvento.map(egreso => (
                <EgresoCard
                  key={egreso.id}
                  egreso={egreso}
                  onRegistrarPago={() => {}}
                  compact
                />
              ))}
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  )
}

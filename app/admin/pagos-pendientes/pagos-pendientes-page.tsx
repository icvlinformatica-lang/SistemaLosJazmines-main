"use client"

import { useState, useEffect } from "react"
import { useStore } from "@/lib/store-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Calendar,
  User,
  Filter
} from "lucide-react"
import type { PagoPersonal } from "@/lib/store"
import ComprobantePago from "./comprobante-pago"

export default function PagosPendientesPage() {
  const {
    pagosPersonal,
    eventos,
    personal,
    updatePagoPersonal,
    generarPagosPendientes,
  } = useStore()

  const [filtroEstado, setFiltroEstado] = useState<string>("todos")
  const [pagoSeleccionado, setPagoSeleccionado] = useState<PagoPersonal | null>(null)
  const [dialogoPagoAbierto, setDialogoPagoAbierto] = useState(false)
  const [dialogoComprobanteAbierto, setDialogoComprobanteAbierto] = useState(false)

  const [formPago, setFormPago] = useState({
    tipoPago: "" as "transferencia" | "efectivo" | "otro" | "",
    notasPago: "",
  })

  // Generar pagos pendientes al cargar
  useEffect(() => {
    generarPagosPendientes()
  }, [])

  const pagosFiltrados = filtroEstado === "todos" 
    ? pagosPersonal 
    : pagosPersonal.filter(p => p.estado === filtroEstado)

  const pagosPendientes = pagosPersonal.filter(p => p.estado === "pendiente")
  const pagosVencidos = pagosPersonal.filter(p => p.estado === "vencido")
  const pagosPagados = pagosPersonal.filter(p => p.estado === "pagado")

  const handleAbrirPago = (pago: PagoPersonal) => {
    setPagoSeleccionado(pago)
    setFormPago({
      tipoPago: pago.tipoPago || "",
      notasPago: pago.notasPago || "",
    })
    setDialogoPagoAbierto(true)
  }

  const handleRegistrarPago = () => {
    if (!pagoSeleccionado || !formPago.tipoPago) {
      alert("Por favor selecciona el tipo de pago")
      return
    }

    const hoy = new Date().toISOString().split("T")[0]
    
    updatePagoPersonal(pagoSeleccionado.id, {
      estado: "pagado",
      tipoPago: formPago.tipoPago,
      fechaPago: hoy,
      notasPago: formPago.notasPago,
    })

    setDialogoPagoAbierto(false)
    // Abrir diálogo de comprobante
    setPagoSeleccionado({
      ...pagoSeleccionado,
      estado: "pagado",
      tipoPago: formPago.tipoPago,
      fechaPago: hoy,
      notasPago: formPago.notasPago,
    })
    setDialogoComprobanteAbierto(true)
  }

  const handleVerComprobante = (pago: PagoPersonal) => {
    setPagoSeleccionado(pago)
    setDialogoComprobanteAbierto(true)
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "pendiente":
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>
      case "vencido":
        return <Badge className="bg-red-500"><AlertCircle className="h-3 w-3 mr-1" />Vencido</Badge>
      case "pagado":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Pagado</Badge>
      default:
        return <Badge variant="outline">{estado}</Badge>
    }
  }

  const formatearPrecio = (precio: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(precio)
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getDiasRestantes = (fechaLimite: string) => {
    const hoy = new Date()
    const limite = new Date(fechaLimite)
    const diffTime = limite.getTime() - hoy.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Agrupar pagos por evento
  const pagosPorEvento = pagosFiltrados.reduce((acc, pago) => {
    if (!acc[pago.eventoId]) {
      acc[pago.eventoId] = []
    }
    acc[pago.eventoId].push(pago)
    return acc
  }, {} as Record<string, PagoPersonal[]>)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pagos Pendientes al Personal</h1>
          <p className="text-muted-foreground">
            Gestiona los pagos próximos a vencer para eventos
          </p>
        </div>
        <Button onClick={() => generarPagosPendientes()}>
          Actualizar Pagos
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagosPendientes.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatearPrecio(pagosPendientes.reduce((sum, p) => sum + p.montoTotal, 0))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{pagosVencidos.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatearPrecio(pagosVencidos.reduce((sum, p) => sum + p.montoTotal, 0))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{pagosPagados.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatearPrecio(pagosPagados.reduce((sum, p) => sum + p.montoTotal, 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Label>Filtrar por estado:</Label>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
                <SelectItem value="pagado">Pagados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pagos Agrupados por Evento */}
      <div className="space-y-6">
        {Object.entries(pagosPorEvento).map(([eventoId, pagosEvento]) => {
          const evento = eventos.find(e => e.id === eventoId)
          if (!evento) return null

          return (
            <Card key={eventoId} className="border-l-4 border-l-indigo-500">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {evento.nombre}
                    </CardTitle>
                    <CardDescription>
                      Fecha del evento: {formatearFecha(evento.fecha)}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {pagosEvento.length} pago{pagosEvento.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pagosEvento.map((pago) => {
                    const diasRestantes = getDiasRestantes(pago.fechaLimitePago)
                    
                    return (
                      <div
                        key={pago.id}
                        className={`border rounded-lg p-4 ${
                          pago.estado === "vencido" ? "bg-red-50 border-red-200" :
                          pago.estado === "pagado" ? "bg-green-50 border-green-200" :
                          diasRestantes <= 3 ? "bg-yellow-50 border-yellow-200" :
                          "bg-white"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">{pago.nombrePersonal}</span>
                              {getEstadoBadge(pago.estado)}
                            </div>

                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>Servicio: <span className="font-medium">{pago.servicioNombre}</span></div>
                              <div>Fecha límite de pago: <span className="font-medium">{formatearFecha(pago.fechaLimitePago)}</span></div>
                              {pago.estado !== "pagado" && (
                                <div className={diasRestantes <= 3 ? "font-bold text-orange-600" : ""}>
                                  {diasRestantes > 0 ? `${diasRestantes} días restantes` : "Vencido"}
                                </div>
                              )}
                              {pago.estado === "pagado" && pago.fechaPago && (
                                <div className="text-green-600">
                                  Pagado el {formatearFecha(pago.fechaPago)} - {pago.tipoPago}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600 mb-2">
                              {formatearPrecio(pago.montoTotal)}
                            </div>
                            <div className="flex gap-2">
                              {pago.estado === "pagado" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleVerComprobante(pago)}
                                >
                                  <FileText className="h-4 w-4 mr-1" />
                                  Ver Comprobante
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleAbrirPago(pago)}
                                >
                                  <DollarSign className="h-4 w-4 mr-1" />
                                  Registrar Pago
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {pagosFiltrados.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-muted-foreground mb-4">
              No hay pagos {filtroEstado !== "todos" ? filtroEstado + "s" : ""} en este momento
            </p>
          </CardContent>
        </Card>
      )}

      {/* Diálogo de Registrar Pago */}
      <Dialog open={dialogoPagoAbierto} onOpenChange={setDialogoPagoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>

          {pagoSeleccionado && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div><strong>Personal:</strong> {pagoSeleccionado.nombrePersonal}</div>
                  <div><strong>Servicio:</strong> {pagoSeleccionado.servicioNombre}</div>
                  <div><strong>Monto:</strong> {formatearPrecio(pagoSeleccionado.montoTotal)}</div>
                </div>
              </div>

              <div>
                <Label>Tipo de Pago *</Label>
                <Select
                  value={formPago.tipoPago}
                  onValueChange={(value: any) => setFormPago({ ...formPago, tipoPago: value })}
                >
                  <SelectTrigger>
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
                <Label>Notas (opcional)</Label>
                <Textarea
                  value={formPago.notasPago}
                  onChange={(e) => setFormPago({ ...formPago, notasPago: e.target.value })}
                  placeholder="Información adicional sobre el pago..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDialogoPagoAbierto(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleRegistrarPago}>
                  Confirmar Pago
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Comprobante */}
      {pagoSeleccionado && (
        <ComprobantePago
          open={dialogoComprobanteAbierto}
          onOpenChange={setDialogoComprobanteAbierto}
          pago={pagoSeleccionado}
          personal={personal.find(p => p.id === pagoSeleccionado.personalId)}
        />
      )}
    </div>
  )
}

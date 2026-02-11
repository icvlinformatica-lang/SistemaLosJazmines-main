"use client"

import { useState, useEffect, useMemo } from "react"
import { useStore } from "@/lib/store-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Calendar,
  User,
  Filter,
  Link2,
  RefreshCw,
  Briefcase,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from "lucide-react"
import type { PagoPersonal } from "@/lib/store"
import ComprobantePago from "./comprobante-pago"

type FiltroAsignacion = "todos" | "confirmado" | "sinConfirmar" | "desasignado"

export default function PagosPendientesPage() {
  const {
    pagosPersonal,
    eventos,
    personal,
    updatePagoPersonal,
    generarPagosPendientes,
    sincronizarPagos,
  } = useStore()

  const [filtroEstado, setFiltroEstado] = useState<string>("todos")
  const [filtroEvento, setFiltroEvento] = useState<string>("todos")
  const [filtroRol, setFiltroRol] = useState<string>("todos")
  const [filtroAsignacion, setFiltroAsignacion] = useState<FiltroAsignacion>("todos")
  const [pagoSeleccionado, setPagoSeleccionado] = useState<PagoPersonal | null>(null)
  const [dialogoPagoAbierto, setDialogoPagoAbierto] = useState(false)
  const [dialogoComprobanteAbierto, setDialogoComprobanteAbierto] = useState(false)
  const [dialogoDetalleAbierto, setDialogoDetalleAbierto] = useState(false)

  const [formPago, setFormPago] = useState({
    tipoPago: "" as "transferencia" | "efectivo" | "otro" | "",
    notasPago: "",
  })

  // Generar pagos pendientes al cargar
  useEffect(() => {
    generarPagosPendientes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Derivar opciones de filtro ---
  const eventosConPagos = useMemo(() => {
    const ids = new Set(pagosPersonal.map((p) => p.eventoId))
    return eventos.filter((e) => ids.has(e.id))
  }, [pagosPersonal, eventos])

  const rolesUnicos = useMemo(() => {
    const roles = new Set<string>()
    pagosPersonal.forEach((p) => {
      // Extraer rol del servicioNombre que tiene formato "NombreServicio (Rol)"
      const match = p.servicioNombre.match(/\(([^)]+)\)$/)
      if (match) roles.add(match[1])
    })
    return Array.from(roles).sort()
  }, [pagosPersonal])

  // --- Helper: estado de asignacion de un pago ---
  const getEstadoAsignacion = (pago: PagoPersonal): "confirmado" | "sinConfirmar" | "desasignado" | "legacy" => {
    if (!pago.asignacionId) return "legacy"
    const evento = eventos.find((e) => e.id === pago.eventoId)
    const asignacion = evento?.asignaciones?.find((a) => a.id === pago.asignacionId)
    if (!asignacion) return "desasignado"
    if (!asignacion.personalAsignadoId) return "desasignado"
    if (asignacion.confirmado) return "confirmado"
    return "sinConfirmar"
  }

  // --- Filtrado combinado ---
  const pagosFiltrados = useMemo(() => {
    return pagosPersonal.filter((p) => {
      if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false
      if (filtroEvento !== "todos" && p.eventoId !== filtroEvento) return false
      if (filtroRol !== "todos") {
        const match = p.servicioNombre.match(/\(([^)]+)\)$/)
        const rol = match ? match[1] : ""
        if (rol !== filtroRol) return false
      }
      if (filtroAsignacion !== "todos") {
        const estado = getEstadoAsignacion(p)
        if (estado === "legacy" && filtroAsignacion !== "todos") return false
        if (estado !== filtroAsignacion) return false
      }
      return true
    })
  }, [pagosPersonal, filtroEstado, filtroEvento, filtroRol, filtroAsignacion, eventos]) // eslint-disable-line react-hooks/exhaustive-deps

  const pagosPendientes = pagosPersonal.filter((p) => p.estado === "pendiente")
  const pagosVencidos = pagosPersonal.filter((p) => p.estado === "vencido")
  const pagosPagados = pagosPersonal.filter((p) => p.estado === "pagado")

  // --- Handlers ---
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

  const handleVerDetalle = (pago: PagoPersonal) => {
    setPagoSeleccionado(pago)
    setDialogoDetalleAbierto(true)
  }

  const handleSincronizar = () => {
    const resultado = sincronizarPagos()
    alert(
      `Sincronizacion completada:\n- Pagos creados: ${resultado.pagosCreados}\n- Pagos obsoletos: ${resultado.pagosObsoletos}`
    )
  }

  // --- Helpers UI ---
  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "pendiente":
        return (
          <Badge className="bg-yellow-500 text-white">
            <Clock className="h-3 w-3 mr-1" />
            Pendiente
          </Badge>
        )
      case "vencido":
        return (
          <Badge className="bg-red-500 text-white">
            <AlertCircle className="h-3 w-3 mr-1" />
            Vencido
          </Badge>
        )
      case "pagado":
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Pagado
          </Badge>
        )
      default:
        return <Badge variant="outline">{estado}</Badge>
    }
  }

  const getAsignacionBadge = (pago: PagoPersonal) => {
    const estado = getEstadoAsignacion(pago)
    switch (estado) {
      case "confirmado":
        return (
          <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Confirmado
          </Badge>
        )
      case "sinConfirmar":
        return (
          <Badge variant="outline" className="border-yellow-300 text-yellow-700 bg-yellow-50">
            <ShieldAlert className="h-3 w-3 mr-1" />
            Sin confirmar
          </Badge>
        )
      case "desasignado":
        return (
          <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
            <ShieldX className="h-3 w-3 mr-1" />
            Desasignado
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Legacy
          </Badge>
        )
    }
  }

  const formatearPrecio = (precio: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
    }).format(precio)
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
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
  const pagosPorEvento = pagosFiltrados.reduce(
    (acc, pago) => {
      if (!acc[pago.eventoId]) {
        acc[pago.eventoId] = []
      }
      acc[pago.eventoId].push(pago)
      return acc
    },
    {} as Record<string, PagoPersonal[]>
  )

  // --- Info de asignacion para el dialog de detalle ---
  const getAsignacionInfo = (pago: PagoPersonal) => {
    if (!pago.asignacionId) return null
    const evento = eventos.find((e) => e.id === pago.eventoId)
    if (!evento) return null
    const asignacion = evento.asignaciones?.find((a) => a.id === pago.asignacionId)
    if (!asignacion) return null
    const persona = personal.find((p) => p.id === asignacion.personalAsignadoId)
    return { asignacion, persona, evento }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Pagos Pendientes al Personal
          </h1>
          <p className="text-muted-foreground">
            Gestiona los pagos proximos a vencer para eventos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSincronizar}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sincronizar
          </Button>
          <Button onClick={() => generarPagosPendientes()}>Actualizar Pagos</Button>
        </div>
      </div>

      {/* Estadisticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagosPendientes.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatearPrecio(
                pagosPendientes.reduce((sum, p) => sum + p.montoTotal, 0)
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {pagosVencidos.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatearPrecio(
                pagosVencidos.reduce((sum, p) => sum + p.montoTotal, 0)
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {pagosPagados.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatearPrecio(
                pagosPagados.reduce((sum, p) => sum + p.montoTotal, 0)
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Filter className="h-3 w-3" />
                Estado
              </Label>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="vencido">Vencidos</SelectItem>
                  <SelectItem value="pagado">Pagados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Evento
              </Label>
              <Select value={filtroEvento} onValueChange={setFiltroEvento}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los eventos</SelectItem>
                  {eventosConPagos.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre || e.nombrePareja || "Evento"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {rolesUnicos.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Briefcase className="h-3 w-3" />
                  Rol
                </Label>
                <Select value={filtroRol} onValueChange={setFiltroRol}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los roles</SelectItem>
                    {rolesUnicos.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                Asignacion
              </Label>
              <Select
                value={filtroAsignacion}
                onValueChange={(v) => setFiltroAsignacion(v as FiltroAsignacion)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="confirmado">Confirmadas</SelectItem>
                  <SelectItem value="sinConfirmar">Sin confirmar</SelectItem>
                  <SelectItem value="desasignado">Desasignadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pagos Agrupados por Evento */}
      <div className="space-y-6">
        {Object.entries(pagosPorEvento).map(([eventoId, pagosEvento]) => {
          const evento = eventos.find((e) => e.id === eventoId)
          if (!evento) return null

          return (
            <Card key={eventoId} className="border-l-4 border-l-primary">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {evento.nombre || evento.nombrePareja || "Evento"}
                    </CardTitle>
                    <CardDescription>
                      Fecha del evento: {formatearFecha(evento.fecha)}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {pagosEvento.length} pago
                    {pagosEvento.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pagosEvento.map((pago) => {
                    const diasRestantes = getDiasRestantes(pago.fechaLimitePago)
                    const persona = personal.find(
                      (p) => p.id === pago.personalId
                    )

                    return (
                      <div
                        key={pago.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                          pago.estado === "vencido"
                            ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
                            : pago.estado === "pagado"
                              ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
                              : diasRestantes <= 3
                                ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900"
                                : "bg-card"
                        }`}
                        onClick={() => handleVerDetalle(pago)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") handleVerDetalle(pago)
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              {persona ? (
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                    {persona.nombre[0]}
                                    {persona.apellido[0]}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <User className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-semibold">
                                {pago.nombrePersonal}
                              </span>
                              {getEstadoBadge(pago.estado)}
                              {getAsignacionBadge(pago)}
                            </div>

                            <div className="text-sm text-muted-foreground space-y-1">
                              {/* Columna Origen */}
                              <div className="flex items-center gap-1.5">
                                <Briefcase className="h-3.5 w-3.5" />
                                <span>
                                  Origen:{" "}
                                  <span className="font-medium text-foreground">
                                    {pago.servicioNombre}
                                  </span>
                                </span>
                                {pago.asignacionId && (
                                  <Link2 className="h-3 w-3 text-primary" />
                                )}
                              </div>

                              <div>
                                Fecha limite:{" "}
                                <span className="font-medium">
                                  {formatearFecha(pago.fechaLimitePago)}
                                </span>
                              </div>
                              {pago.estado !== "pagado" && (
                                <div
                                  className={
                                    diasRestantes <= 3
                                      ? "font-bold text-orange-600"
                                      : ""
                                  }
                                >
                                  {diasRestantes > 0
                                    ? `${diasRestantes} dias restantes`
                                    : "Vencido"}
                                </div>
                              )}
                              {pago.estado === "pagado" && pago.fechaPago && (
                                <div className="text-green-600">
                                  Pagado el {formatearFecha(pago.fechaPago)} -{" "}
                                  {pago.tipoPago}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right flex flex-col items-end gap-2">
                            <div className="text-2xl font-bold text-foreground">
                              {formatearPrecio(pago.montoTotal)}
                            </div>
                            <div className="flex gap-2">
                              {pago.estado === "pagado" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleVerComprobante(pago)
                                  }}
                                >
                                  <FileText className="h-4 w-4 mr-1" />
                                  Comprobante
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleAbrirPago(pago)
                                  }}
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
              No hay pagos{" "}
              {filtroEstado !== "todos" ? filtroEstado + "s" : ""} en este
              momento
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialogo de Detalle de Pago + Asignacion */}
      <Dialog open={dialogoDetalleAbierto} onOpenChange={setDialogoDetalleAbierto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle del Pago</DialogTitle>
          </DialogHeader>

          {pagoSeleccionado && (() => {
            const info = getAsignacionInfo(pagoSeleccionado)
            const persona = personal.find(
              (p) => p.id === pagoSeleccionado.personalId
            )

            return (
              <div className="space-y-4">
                {/* Info del pago */}
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estado</span>
                    {getEstadoBadge(pagoSeleccionado.estado)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Monto</span>
                    <span className="font-bold text-lg">
                      {formatearPrecio(pagoSeleccionado.montoTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Origen</span>
                    <span className="text-sm font-medium">
                      {pagoSeleccionado.servicioNombre}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Estado asignacion
                    </span>
                    {getAsignacionBadge(pagoSeleccionado)}
                  </div>
                </div>

                {/* Info de persona asignada */}
                {persona && (
                  <div className="rounded-lg border p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-3">
                      Personal asignado
                    </p>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {persona.nombre[0]}
                          {persona.apellido[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">
                          {persona.nombre} {persona.apellido}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {persona.funcion} - Tarifa base:{" "}
                          {formatearPrecio(persona.tarifaBase)}
                        </p>
                        {persona.telefono && (
                          <p className="text-xs text-muted-foreground">
                            Tel: {persona.telefono}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Info de asignacion */}
                {info && (
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Detalles de asignacion
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Rol:</span>{" "}
                        <span className="font-medium">
                          {info.asignacion.rolRequerido}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Costo planeado:
                        </span>{" "}
                        <span className="font-medium">
                          {formatearPrecio(info.asignacion.costoPlaneado)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Costo real:</span>{" "}
                        <span className="font-medium">
                          {formatearPrecio(info.asignacion.costoReal)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Diferencia:</span>{" "}
                        <span
                          className={`font-medium ${
                            info.asignacion.costoPlaneado - info.asignacion.costoReal >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatearPrecio(
                            info.asignacion.costoPlaneado - info.asignacion.costoReal
                          )}
                        </span>
                      </div>
                    </div>
                    {info.asignacion.notas && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        {info.asignacion.notas}
                      </p>
                    )}
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2 justify-end pt-2">
                  {pagoSeleccionado.estado === "pagado" ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDialogoDetalleAbierto(false)
                        handleVerComprobante(pagoSeleccionado)
                      }}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Ver Comprobante
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setDialogoDetalleAbierto(false)
                        handleAbrirPago(pagoSeleccionado)
                      }}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Marcar como Pagado
                    </Button>
                  )}
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialogo de Registrar Pago */}
      <Dialog open={dialogoPagoAbierto} onOpenChange={setDialogoPagoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>

          {pagoSeleccionado && (
            <div className="space-y-4">
              <div className="bg-primary/5 border rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Personal:</strong> {pagoSeleccionado.nombrePersonal}
                  </div>
                  <div>
                    <strong>Servicio:</strong> {pagoSeleccionado.servicioNombre}
                  </div>
                  <div>
                    <strong>Monto:</strong>{" "}
                    {formatearPrecio(pagoSeleccionado.montoTotal)}
                  </div>
                </div>
              </div>

              <div>
                <Label>Tipo de Pago *</Label>
                <Select
                  value={formPago.tipoPago}
                  onValueChange={(value: string) =>
                    setFormPago({ ...formPago, tipoPago: value as "transferencia" | "efectivo" | "otro" })
                  }
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
                  onChange={(e) =>
                    setFormPago({ ...formPago, notasPago: e.target.value })
                  }
                  placeholder="Informacion adicional sobre el pago..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDialogoPagoAbierto(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleRegistrarPago}>Confirmar Pago</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialogo de Comprobante */}
      {pagoSeleccionado && (
        <ComprobantePago
          open={dialogoComprobanteAbierto}
          onOpenChange={setDialogoComprobanteAbierto}
          pago={pagoSeleccionado}
          personal={personal.find(
            (p) => p.id === pagoSeleccionado.personalId
          )}
        />
      )}
    </div>
  )
}

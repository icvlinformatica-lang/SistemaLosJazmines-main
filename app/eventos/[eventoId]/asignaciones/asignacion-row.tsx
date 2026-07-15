"use client"

import { useState, useMemo } from "react"
import {
  formatCurrency,
  generateId,
  type AsignacionPersonal,
  type PersonalEvento,
  type PagoPersonal,
} from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UserPlus, UserMinus, ArrowRightLeft, DollarSign, Calendar, Banknote } from "lucide-react"
import { useStore } from "@/lib/store-context"

interface AsignacionRowProps {
  asignacion: AsignacionPersonal
  personal: PersonalEvento[]
  personalYaAsignado: Set<string>
  eventoId: string
  eventoFecha: string
  servicioNombre: string
  onAsignar: (asignacionId: string, personalId: string) => void
  onDesasignar: (asignacionId: string) => void
}

export function AsignacionRow({
  asignacion,
  personal,
  personalYaAsignado,
  eventoId,
  eventoFecha,
  servicioNombre,
  onAsignar,
  onDesasignar,
}: AsignacionRowProps) {
  const { addPagoPersonal } = useStore()
  
  const [showSelect, setShowSelect] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  
  // Flujo de asignacion en dos pasos
  const [dialogoAsignacionAbierto, setDialogoAsignacionAbierto] = useState(false)
  const [personaSeleccionada, setPersonaSeleccionada] = useState<PersonalEvento | null>(null)
  const [tarifaSeleccionadaId, setTarifaSeleccionadaId] = useState<string>("")
  const [montoPersonalizado, setMontoPersonalizado] = useState<number>(0)
  const [montoSeña, setMontoSeña] = useState<number>(0)
  const [fechaSeña, setFechaSeña] = useState<string>("")
  const [fechaLimitePago, setFechaLimitePago] = useState<string>("")

  const estaAsignado = asignacion.personalAsignadoId !== null

  // Filter personal by matching role
  const personalDisponible = personal.filter((p) => {
    if (!p.activo) return false
    const rolMatch = p.funcion.toLowerCase() === asignacion.rolRequerido.toLowerCase()
    return rolMatch
  })

  // Sort: available first, then already assigned
  const personalOrdenado = [...personalDisponible].sort((a, b) => {
    const aAsignado = personalYaAsignado.has(a.id)
    const bAsignado = personalYaAsignado.has(b.id)
    if (aAsignado && !bAsignado) return 1
    if (!aAsignado && bAsignado) return -1
    return a.apellido.localeCompare(b.apellido)
  })

  // Tarifas de la persona seleccionada
  const tarifasPersona = useMemo(() => {
    if (!personaSeleccionada) return []
    return personaSeleccionada.tarifas || []
  }, [personaSeleccionada])

  // Calcular fecha limite default (7 dias antes del evento)
  const calcularFechaLimiteDefault = () => {
    const fechaEvento = new Date(eventoFecha)
    fechaEvento.setDate(fechaEvento.getDate() - 7)
    return fechaEvento.toISOString().split("T")[0]
  }

  const handleSeleccionarPersona = (personalId: string) => {
    const persona = personal.find(p => p.id === personalId)
    if (!persona) return

    setPersonaSeleccionada(persona)
    setTarifaSeleccionadaId("")
    setMontoPersonalizado(persona.tarifaBase || 0)
    setMontoSeña(0)
    setFechaSeña("")
    setFechaLimitePago(calcularFechaLimiteDefault())
    setDialogoAsignacionAbierto(true)
    setShowSelect(false)
  }

  const handleSeleccionarTarifa = (tarifaId: string) => {
    setTarifaSeleccionadaId(tarifaId)
    const tarifa = tarifasPersona.find(t => t.id === tarifaId)
    if (tarifa) {
      setMontoPersonalizado(tarifa.monto)
    }
  }

  const handleConfirmarAsignacion = () => {
    if (!personaSeleccionada) return

    // Primero hacer la asignacion
    onAsignar(asignacion.id, personaSeleccionada.id)

    // Luego crear el PagoPersonal con los datos completos
    const nuevoPago: Omit<PagoPersonal, "id"> = {
      personalId: personaSeleccionada.id,
      eventoId,
      nombrePersonal: `${personaSeleccionada.nombre} ${personaSeleccionada.apellido}`,
      servicioNombre,
      montoTotal: montoPersonalizado,
      montoSeña: montoSeña || 0,
      fechaSeña: fechaSeña || undefined,
      fechaEvento: eventoFecha,
      fechaLimitePago: fechaLimitePago || calcularFechaLimiteDefault(),
      estado: "pendiente",
      tarifaId: tarifaSeleccionadaId || undefined,
      asignacionId: asignacion.id,
    }

    addPagoPersonal(nuevoPago)
    setDialogoAsignacionAbierto(false)
    setPersonaSeleccionada(null)
  }

  const handleConfirmRemove = () => {
    onDesasignar(asignacion.id)
    setConfirmRemove(false)
  }

  const getInitials = (nombre: string) => {
    const parts = nombre.split(" ")
    return parts
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase()
  }

  // Determine badge state
  const estadoBadge = () => {
    if (!estaAsignado) {
      return (
        <Badge variant="secondary" className="text-xs">
          Sin asignar
        </Badge>
      )
    }
    if (asignacion.confirmado) {
      return (
        <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">
          Confirmado
        </Badge>
      )
    }
    return (
      <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-xs">
        Asignado
      </Badge>
    )
  }

  // Cost difference
  const costDiff = asignacion.costoPlaneado - asignacion.costoReal
  const hasCostDiff = estaAsignado && costDiff !== 0

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
        {/* Role */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {estaAsignado ? (
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {getInitials(asignacion.personalNombre || "?")}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">
                {asignacion.rolRequerido}
              </span>
              {estadoBadge()}
            </div>
            {estaAsignado && asignacion.personalNombre && (
              <p className="text-xs text-muted-foreground truncate">
                {asignacion.personalNombre}
              </p>
            )}
          </div>
        </div>

        {/* Costs */}
        <div className="flex items-center gap-4 text-xs shrink-0">
          <div className="text-right">
            <span className="text-muted-foreground">Planeado</span>
            <p className="font-medium text-foreground">
              {formatCurrency(asignacion.costoPlaneado)}
            </p>
          </div>
          {estaAsignado && (
            <div className="text-right">
              <span className="text-muted-foreground">Real</span>
              <p className="font-medium text-foreground">
                {formatCurrency(asignacion.costoReal)}
              </p>
            </div>
          )}
          {hasCostDiff && (
            <Badge
              variant="outline"
              className={
                costDiff > 0
                  ? "border-primary/30 bg-primary/10 text-primary text-xs"
                  : "border-destructive/30 bg-destructive/10 text-destructive text-xs"
              }
            >
              {costDiff > 0 ? "+" : ""}
              {formatCurrency(costDiff)}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!estaAsignado || showSelect ? (
            <div className="w-48">
              <Select onValueChange={handleSeleccionarPersona}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Seleccionar persona..." />
                </SelectTrigger>
                <SelectContent>
                  {personalOrdenado.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      {"No hay personal con el rol "}
                      {`"${asignacion.rolRequerido}"`}
                    </div>
                  ) : (
                    personalOrdenado.map((p) => {
                      const yaAsignado = personalYaAsignado.has(p.id)
                      const cantTarifas = (p.tarifas || []).length
                      return (
                        <SelectItem
                          key={p.id}
                          value={p.id}
                          disabled={yaAsignado}
                        >
                          <div className="flex items-center gap-2">
                            <span>
                              {p.nombre} {p.apellido}
                            </span>
                            {cantTarifas > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {cantTarifas} tarifas
                              </Badge>
                            )}
                            {yaAsignado && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1 py-0"
                              >
                                ocupado
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setShowSelect(true)}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cambiar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmRemove(true)}
              >
                <UserMinus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Remover</span>
              </Button>
            </>
          )}
          {showSelect && estaAsignado && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowSelect(false)}
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Dialog de asignacion con tarifa */}
      <Dialog open={dialogoAsignacionAbierto} onOpenChange={setDialogoAsignacionAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Asignar Personal
            </DialogTitle>
            <DialogDescription>
              {personaSeleccionada && (
                <>Asignando a <span className="font-medium text-foreground">{personaSeleccionada.nombre} {personaSeleccionada.apellido}</span> como {asignacion.rolRequerido}</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selector de tarifa */}
            {tarifasPersona.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Seleccionar Tarifa
                </Label>
                <Select value={tarifaSeleccionadaId} onValueChange={handleSeleccionarTarifa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir tarifa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tarifasPersona.map(tarifa => (
                      <SelectItem key={tarifa.id} value={tarifa.id}>
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span>{tarifa.descripcion}</span>
                          <span className="font-mono text-green-600">{formatCurrency(tarifa.monto)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Monto personalizado */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-amber-600" />
                Monto Total
              </Label>
              <MoneyInput
                value={montoPersonalizado}
                onValueChange={(v) => setMontoPersonalizado(v)}
                placeholder="Monto"
              />
              <p className="text-xs text-muted-foreground">
                {tarifasPersona.length > 0 
                  ? "Se completa automaticamente con la tarifa elegida, pero puedes ajustarlo"
                  : `Tarifa base de la persona: ${formatCurrency(personaSeleccionada?.tarifaBase || 0)}`
                }
              </p>
            </div>

            {/* Seña */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto de Seña</Label>
                <MoneyInput
                  value={montoSeña}
                  onValueChange={(v) => setMontoSeña(v)}
                  placeholder="0 (opcional)"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Seña</Label>
                <Input
                  type="date"
                  value={fechaSeña}
                  onChange={(e) => setFechaSeña(e.target.value)}
                />
              </div>
            </div>

            {/* Fecha limite */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                Fecha Limite de Pago
              </Label>
              <Input
                type="date"
                value={fechaLimitePago}
                onChange={(e) => setFechaLimitePago(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Por defecto: 7 dias antes del evento
              </p>
            </div>

            {/* Resumen */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Monto total:</span>
                <span className="font-semibold">{formatCurrency(montoPersonalizado)}</span>
              </div>
              {montoSeña > 0 && (
                <>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Seña:</span>
                    <span>- {formatCurrency(montoSeña)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium border-t pt-1 mt-1">
                    <span>Saldo pendiente:</span>
                    <span className="text-amber-600">{formatCurrency(montoPersonalizado - montoSeña)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoAsignacionAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmarAsignacion} disabled={!montoPersonalizado}>
              Confirmar Asignacion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm removal dialog */}
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover asignacion</AlertDialogTitle>
            <AlertDialogDescription>
              {"Estas seguro de que deseas remover a "}
              <span className="font-medium text-foreground">
                {asignacion.personalNombre}
              </span>
              {" de la asignacion como "}
              <span className="font-medium text-foreground">
                {asignacion.rolRequerido}
              </span>
              {"? Si existe un pago pendiente asociado, tambien sera eliminado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

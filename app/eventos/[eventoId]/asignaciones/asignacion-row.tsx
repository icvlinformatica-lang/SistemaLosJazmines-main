"use client"

import { useState } from "react"
import {
  formatCurrency,
  type AsignacionPersonal,
  type PersonalEvento,
} from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { UserPlus, UserMinus, ArrowRightLeft } from "lucide-react"

interface AsignacionRowProps {
  asignacion: AsignacionPersonal
  personal: PersonalEvento[]
  personalYaAsignado: Set<string>
  onAsignar: (asignacionId: string, personalId: string) => void
  onDesasignar: (asignacionId: string) => void
}

export function AsignacionRow({
  asignacion,
  personal,
  personalYaAsignado,
  onAsignar,
  onDesasignar,
}: AsignacionRowProps) {
  const [showSelect, setShowSelect] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const estaAsignado = asignacion.personalAsignadoId !== null

  // Filter personal by matching role
  const personalDisponible = personal.filter((p) => {
    if (!p.activo) return false
    // Filter by function matching the required role
    const rolMatch =
      p.funcion.toLowerCase() === asignacion.rolRequerido.toLowerCase()
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

  const handleSelectChange = (personalId: string) => {
    onAsignar(asignacion.id, personalId)
    setShowSelect(false)
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
              <Select onValueChange={handleSelectChange}>
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
                            <span className="text-muted-foreground">
                              {formatCurrency(p.tarifaBase)}
                            </span>
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

"use client"

import { useState, useMemo } from "react"
import {
  formatCurrency,
  type AsignacionPersonal,
  type PersonalEvento,
} from "@/lib/store"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  Phone,
  Mail,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Search,
  ArrowUpDown,
  ChevronDown,
  CheckCircle2,
  Clock,
  CircleDashed,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AsignacionCardProps {
  asignacion: AsignacionPersonal
  personalDisponible: PersonalEvento[]
  eventoFecha: string
  onAsignar: (personalId: string) => void
  onDesasignar: () => void
  onVerDetalles: () => void
}

type SortField = "nombre" | "tarifa-asc" | "tarifa-desc"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(text: string): string {
  return text
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
}

function isEventoPasado(fecha: string): boolean {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const f = new Date(fecha)
  f.setHours(0, 0, 0, 0)
  return f < hoy
}

// ---------------------------------------------------------------------------
// Border / state colour logic
// ---------------------------------------------------------------------------

function getBorderClass(a: AsignacionPersonal): string {
  if (!a.personalAsignadoId) return "border-muted-foreground/25"
  if (a.costoPlaneado > 0 && a.costoReal > a.costoPlaneado * 1.2)
    return "border-destructive/60"
  if (a.confirmado) return "border-primary/50"
  return "border-amber-500/50"
}

function getStatusIcon(a: AsignacionPersonal) {
  if (!a.personalAsignadoId)
    return <CircleDashed className="h-4 w-4 text-muted-foreground" />
  if (a.confirmado)
    return <CheckCircle2 className="h-4 w-4 text-primary" />
  return <Clock className="h-4 w-4 text-amber-600" />
}

function getStatusLabel(a: AsignacionPersonal): string {
  if (!a.personalAsignadoId) return "Sin asignar"
  if (a.confirmado) return "Confirmado"
  return "Pendiente"
}

function getStatusBadgeClasses(a: AsignacionPersonal): string {
  if (!a.personalAsignadoId) return ""
  if (a.confirmado)
    return "bg-primary/10 text-primary border-primary/30"
  return "bg-amber-500/10 text-amber-700 border-amber-500/30"
}

// ---------------------------------------------------------------------------
// Sub-component: Personal Selector Dialog
// ---------------------------------------------------------------------------

function PersonalSelectorDialog({
  open,
  onOpenChange,
  personalDisponible,
  costoPlaneado,
  onSelect,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  personalDisponible: PersonalEvento[]
  costoPlaneado: number
  onSelect: (id: string) => void
}) {
  const [busqueda, setBusqueda] = useState("")
  const [sort, setSort] = useState<SortField>("nombre")

  const filtrados = useMemo(() => {
    let list = [...personalDisponible]

    // Filter
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      list = list.filter(
        (p) =>
          `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) ||
          p.funcion.toLowerCase().includes(q)
      )
    }

    // Sort
    list.sort((a, b) => {
      switch (sort) {
        case "tarifa-asc":
          return a.tarifaBase - b.tarifaBase
        case "tarifa-desc":
          return b.tarifaBase - a.tarifaBase
        default:
          return a.apellido.localeCompare(b.apellido)
      }
    })

    return list
  }, [personalDisponible, busqueda, sort])

  const cycleSortField = () => {
    setSort((prev) => {
      if (prev === "nombre") return "tarifa-asc"
      if (prev === "tarifa-asc") return "tarifa-desc"
      return "nombre"
    })
  }

  const sortLabel =
    sort === "nombre"
      ? "Nombre"
      : sort === "tarifa-asc"
        ? "Tarifa (menor)"
        : "Tarifa (mayor)"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Seleccionar Personal</DialogTitle>
          <DialogDescription>
            {"Elige una persona para asignar a este puesto."}
          </DialogDescription>
        </DialogHeader>

        {/* Search + sort bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o funcion..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 h-9 text-sm"
              aria-label="Buscar personal"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs shrink-0"
            onClick={cycleSortField}
            aria-label={`Ordenar por ${sortLabel}`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortLabel}
          </Button>
        </div>

        {/* List */}
        <div
          className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1"
          role="listbox"
          aria-label="Lista de personal disponible"
        >
          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {"No se encontro personal disponible."}
              </p>
            </div>
          ) : (
            filtrados.map((p) => {
              const diferencia = costoPlaneado - p.tarifaBase
              const sobrecosto = p.tarifaBase > costoPlaneado && costoPlaneado > 0
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors",
                    "hover:bg-secondary/80 focus-visible:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !p.activo && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => {
                    onSelect(p.id)
                    onOpenChange(false)
                  }}
                  disabled={!p.activo}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {getInitials(`${p.nombre} ${p.apellido}`)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {p.nombre} {p.apellido}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {p.funcion}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {p.telefono && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {p.telefono}
                        </span>
                      )}
                      {p.email && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {p.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(p.tarifaBase)}
                    </p>
                    {costoPlaneado > 0 && diferencia !== 0 && (
                      <span
                        className={cn(
                          "text-xs font-medium",
                          sobrecosto
                            ? "text-destructive"
                            : "text-primary"
                        )}
                      >
                        {diferencia > 0 ? "+" : ""}
                        {formatCurrency(diferencia)}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          {filtrados.length}{" "}
          {filtrados.length === 1 ? "persona disponible" : "personas disponibles"}
        </p>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: Sobrecosto Confirm Dialog
// ---------------------------------------------------------------------------

function SobrecostoConfirmDialog({
  open,
  onOpenChange,
  personalNombre,
  costoPlaneado,
  costoReal,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  personalNombre: string
  costoPlaneado: number
  costoReal: number
  onConfirm: () => void
}) {
  const porcentaje =
    costoPlaneado > 0
      ? Math.round(((costoReal - costoPlaneado) / costoPlaneado) * 100)
      : 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Sobrecosto detectado
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                {"Asignar a "}
                <span className="font-medium text-foreground">{personalNombre}</span>
                {" genera un sobrecosto del "}
                <span className="font-semibold text-destructive">{porcentaje}%</span>
                {" respecto al costo planeado."}
              </p>
              <div className="flex items-center gap-4 rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Planeado</span>
                  <p className="font-medium">{formatCurrency(costoPlaneado)}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                <div>
                  <span className="text-muted-foreground">Real</span>
                  <p className="font-semibold text-destructive">
                    {formatCurrency(costoReal)}
                  </p>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Asignar de todos modos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ---------------------------------------------------------------------------
// Main Component: AsignacionCard
// ---------------------------------------------------------------------------

export function AsignacionCard({
  asignacion,
  personalDisponible,
  eventoFecha,
  onAsignar,
  onDesasignar,
  onVerDetalles,
}: AsignacionCardProps) {
  const [showSelector, setShowSelector] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [pendingSobrecosto, setPendingSobrecosto] = useState<{
    personalId: string
    nombre: string
    tarifa: number
  } | null>(null)

  const estaAsignado = asignacion.personalAsignadoId !== null
  const pasado = isEventoPasado(eventoFecha)

  // Cost calculations
  const costDiff = asignacion.costoPlaneado - asignacion.costoReal
  const hasCostDiff = estaAsignado && costDiff !== 0
  const sobrecostoPorcentaje =
    estaAsignado && asignacion.costoPlaneado > 0
      ? ((asignacion.costoReal - asignacion.costoPlaneado) / asignacion.costoPlaneado) * 100
      : 0

  // Find assigned person details from the available list (for contact info)
  const personalAsignado = useMemo(() => {
    if (!asignacion.personalAsignadoId) return null
    return personalDisponible.find(
      (p) => p.id === asignacion.personalAsignadoId
    ) ?? null
  }, [asignacion.personalAsignadoId, personalDisponible])

  // Handle selection with sobrecosto validation
  const handleSelectPersonal = (personalId: string) => {
    const persona = personalDisponible.find((p) => p.id === personalId)
    if (!persona) return

    // Check if >30% sobrecosto
    if (
      asignacion.costoPlaneado > 0 &&
      persona.tarifaBase > asignacion.costoPlaneado * 1.3
    ) {
      setPendingSobrecosto({
        personalId: persona.id,
        nombre: `${persona.nombre} ${persona.apellido}`,
        tarifa: persona.tarifaBase,
      })
      return
    }

    onAsignar(personalId)
  }

  const handleConfirmSobrecosto = () => {
    if (pendingSobrecosto) {
      onAsignar(pendingSobrecosto.personalId)
      setPendingSobrecosto(null)
    }
  }

  const handleConfirmRemove = () => {
    onDesasignar()
    setConfirmRemove(false)
  }

  return (
    <>
      <Card
        className={cn(
          "transition-all duration-200 hover:shadow-md group",
          getBorderClass(asignacion),
          pasado && "opacity-70"
        )}
      >
        {/* Header: Role + Status */}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {getStatusIcon(asignacion)}
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground leading-tight">
                  {asignacion.rolRequerido}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={estaAsignado ? "outline" : "secondary"}
                className={cn("text-xs", getStatusBadgeClasses(asignacion))}
              >
                {getStatusLabel(asignacion)}
              </Badge>
              {!pasado && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={onVerDetalles}
                  aria-label="Ver detalles de la asignacion"
                >
                  Detalles
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Assigned person info */}
          {estaAsignado && personalAsignado ? (
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={onVerDetalles}
                className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                aria-label={`Ver perfil de ${personalAsignado.nombre} ${personalAsignado.apellido}`}
              >
                <Avatar className="h-11 w-11 transition-transform group-hover:scale-105">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {getInitials(`${personalAsignado.nombre} ${personalAsignado.apellido}`)}
                  </AvatarFallback>
                </Avatar>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {personalAsignado.nombre} {personalAsignado.apellido}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {"Tarifa: "}
                  {formatCurrency(personalAsignado.tarifaBase)}
                </p>
                {/* Contact row */}
                <div className="flex items-center gap-3 mt-1.5">
                  {personalAsignado.telefono && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`tel:${personalAsignado.telefono}`}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          aria-label={`Llamar a ${personalAsignado.telefono}`}
                        >
                          <Phone className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">
                            {personalAsignado.telefono}
                          </span>
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        {"Llamar a "}{personalAsignado.telefono}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {personalAsignado.email && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`mailto:${personalAsignado.email}`}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          aria-label={`Enviar email a ${personalAsignado.email}`}
                        >
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">
                            {personalAsignado.email}
                          </span>
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        {"Enviar email a "}{personalAsignado.email}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                <UserPlus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Sin personal asignado
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  {"Selecciona una persona para cubrir este puesto."}
                </p>
              </div>
            </div>
          )}

          {/* Cost comparison section */}
          <div className="space-y-2">
            <Separator />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Costo Planeado
                </span>
                <span className="text-xs font-medium text-foreground">
                  {formatCurrency(asignacion.costoPlaneado)}
                </span>
              </div>

              {estaAsignado ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Costo Real
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {formatCurrency(asignacion.costoReal)}
                  </span>
                </div>
              ) : (
                <div />
              )}
            </div>

            {/* Difference badge */}
            {hasCostDiff && (
              <div className="flex items-center justify-end">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs gap-1",
                    costDiff > 0
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  )}
                >
                  {costDiff > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {costDiff > 0 ? "Ahorro " : "Sobrecosto "}
                  {formatCurrency(Math.abs(costDiff))}
                  {sobrecostoPorcentaje > 20 && costDiff < 0 && (
                    <span className="ml-0.5">
                      {"("}{Math.round(Math.abs(sobrecostoPorcentaje))}{"%)"}
                    </span>
                  )}
                </Badge>
              </div>
            )}
          </div>

          {/* Actions */}
          {!pasado && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                {!estaAsignado ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 h-9 gap-1.5 text-sm"
                    onClick={() => setShowSelector(true)}
                    aria-label="Asignar personal a este puesto"
                  >
                    <UserPlus className="h-4 w-4" />
                    Asignar Personal
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 gap-1.5 text-sm"
                      onClick={() => setShowSelector(true)}
                      aria-label="Cambiar personal asignado"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Cambiar Personal
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmRemove(true)}
                      aria-label="Remover personal de esta asignacion"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Remover
                    </Button>
                  </>
                )}
              </div>
            </>
          )}

          {pasado && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground text-center py-1">
                {"Este evento ya paso. No se pueden modificar asignaciones."}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Select Personal Dialog */}
      <PersonalSelectorDialog
        open={showSelector}
        onOpenChange={setShowSelector}
        personalDisponible={personalDisponible}
        costoPlaneado={asignacion.costoPlaneado}
        onSelect={handleSelectPersonal}
      />

      {/* Confirm Remove Dialog */}
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

      {/* Sobrecosto Confirm Dialog */}
      {pendingSobrecosto && (
        <SobrecostoConfirmDialog
          open={!!pendingSobrecosto}
          onOpenChange={(v) => {
            if (!v) setPendingSobrecosto(null)
          }}
          personalNombre={pendingSobrecosto.nombre}
          costoPlaneado={asignacion.costoPlaneado}
          costoReal={pendingSobrecosto.tarifa}
          onConfirm={handleConfirmSobrecosto}
        />
      )}
    </>
  )
}

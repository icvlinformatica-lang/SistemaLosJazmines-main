"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store-context"
import { formatCurrency, obtenerPreciosServicio } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  Receipt,
  Briefcase,
  Filter,
  Save,
} from "lucide-react"

interface VencimientoGastoFijo {
  tipo: "gasto-fijo"
  id: string
  concepto: string
  monto: number
  fechaVencimiento: string
  tipoGasto: string
  salon?: string
}

interface VencimientoServicio {
  tipo: "servicio"
  eventoId: string
  eventoNombre: string
  eventoFecha: string
  servicioIdx: number
  servicioNombre: string
  proveedor?: string
  monto: number
  pagado: boolean
  fechaLimite: string
}

type VencimientoItem = VencimientoGastoFijo | VencimientoServicio

export default function VencimientosPage() {
  const { costosOperativos, eventos, updateEvento, state } = useStore()
  const [filtro, setFiltro] = useState<"todos" | "pendientes" | "pagados">("todos")
  const [diasAnticipacion, setDiasAnticipacion] = useState(7)
  const [editDiasDialog, setEditDiasDialog] = useState(false)
  const [tempDias, setTempDias] = useState(7)

  // Build all vencimientos
  const items = useMemo(() => {
    const result: VencimientoItem[] = []

    // A) Gastos fijos con fecha de vencimiento
    for (const costo of costosOperativos || []) {
      if (!costo.activo || !costo.fechaVencimiento) continue
      result.push({
        tipo: "gasto-fijo",
        id: costo.id,
        concepto: costo.concepto,
        monto: costo.monto,
        fechaVencimiento: costo.fechaVencimiento,
        tipoGasto: costo.tipo,
        salon: costo.salon,
      })
    }

    // B) Servicios tercerizados en eventos
    for (const ev of eventos || []) {
      if (ev.estado === "cancelado" || ev.estado === "completado") continue
      const srvs = ev.servicios || []
      srvs.forEach((srv, idx) => {
        // Calculate fecha limite: X days before event
        const eventoDate = new Date(ev.fecha + "T00:00:00")
        const limitDate = new Date(eventoDate)
        limitDate.setDate(limitDate.getDate() - diasAnticipacion)

        result.push({
          tipo: "servicio",
          eventoId: ev.id,
          eventoNombre: ev.nombrePareja || ev.nombre || ev.tipoEvento || "Evento",
          eventoFecha: ev.fecha,
          servicioIdx: idx,
          servicioNombre: srv.nombre,
          proveedor: srv.proveedor,
          monto: (() => {
            const servicioCat = state.servicios.find((s: any) => s.id === srv.servicioId)
            if (!servicioCat) return 0
            const { precioOficial } = obtenerPreciosServicio(servicioCat, state)
            return precioOficial * srv.cantidad
          })(),
          pagado: srv.pagado || false,
          fechaLimite: srv.fechaLimitePago || limitDate.toISOString().split("T")[0],
        })
      })
    }

    // Sort by date (earliest first)
    result.sort((a, b) => {
      const dateA = a.tipo === "gasto-fijo" ? a.fechaVencimiento : a.fechaLimite
      const dateB = b.tipo === "gasto-fijo" ? b.fechaVencimiento : b.fechaLimite
      return dateA.localeCompare(dateB)
    })

    return result
  }, [costosOperativos, eventos, diasAnticipacion])

  // Filter
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filtro === "pendientes") {
        return item.tipo === "gasto-fijo" || !item.pagado
      }
      if (filtro === "pagados") {
        return item.tipo === "servicio" && item.pagado
      }
      return true
    })
  }, [items, filtro])

  // Stats
  const stats = useMemo(() => {
    const totalItems = items.length
    const gastosCount = items.filter((i) => i.tipo === "gasto-fijo").length
    const serviciosCount = items.filter((i) => i.tipo === "servicio").length
    const pendientes = items.filter((i) => i.tipo === "servicio" && !i.pagado).length
    const pagados = items.filter((i) => i.tipo === "servicio" && i.pagado).length
    const montoTotal = items.reduce((s, i) => s + i.monto, 0)
    const montoPendiente = items
      .filter((i) => i.tipo === "servicio" && !i.pagado)
      .reduce((s, i) => s + i.monto, 0) +
      items.filter((i) => i.tipo === "gasto-fijo").reduce((s, i) => s + i.monto, 0)

    return { totalItems, gastosCount, serviciosCount, pendientes, pagados, montoTotal, montoPendiente }
  }, [items])

  const handleTogglePagado = (eventoId: string, servicioIdx: number, pagado: boolean) => {
    const ev = (eventos || []).find((e) => e.id === eventoId)
    if (!ev) return
    const updatedServicios = [...(ev.servicios || [])]
    updatedServicios[servicioIdx] = {
      ...updatedServicios[servicioIdx],
      pagado,
    }
    updateEvento(ev.id, { servicios: updatedServicios })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function getUrgency(dateStr: string): "vencido" | "urgente" | "proximo" | "normal" {
    const date = new Date(dateStr + "T00:00:00")
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return "vencido"
    if (diffDays <= 3) return "urgente"
    if (diffDays <= 7) return "proximo"
    return "normal"
  }

  function getUrgencyStyles(urgency: string) {
    switch (urgency) {
      case "vencido":
        return "border-destructive/50 bg-destructive/5"
      case "urgente":
        return "border-amber-400 bg-amber-50"
      case "proximo":
        return "border-sky-300 bg-sky-50/50"
      default:
        return "border-border"
    }
  }

  function getUrgencyBadge(urgency: string) {
    switch (urgency) {
      case "vencido":
        return <Badge className="bg-destructive text-destructive-foreground text-[10px]">Vencido</Badge>
      case "urgente":
        return <Badge className="bg-amber-500 text-amber-50 text-[10px]">Urgente</Badge>
      case "proximo":
        return <Badge className="bg-sky-500 text-sky-50 text-[10px]">Proximo</Badge>
      default:
        return null
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Vencimientos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Pagos pendientes de gastos fijos y servicios tercerizados por evento
        </p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
          <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Gastos fijos:</span>
          <span className="font-bold">{stats.gastosCount}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Servicios:</span>
          <span className="font-bold">{stats.serviciosCount}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-amber-700">Pendientes:</span>
          <span className="font-bold text-amber-700">{stats.pendientes}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50">
          <Check className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-emerald-700">Pagados:</span>
          <span className="font-bold text-emerald-700">{stats.pagados}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted ml-auto">
          <span className="text-muted-foreground">Monto pendiente:</span>
          <span className="font-bold">{formatCurrency(stats.montoPendiente)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["todos", "pendientes", "pagados"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
                  filtro === f
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setTempDias(diasAnticipacion)
            setEditDiasDialog(true)
          }}
        >
          <CalendarClock className="h-4 w-4 mr-2" />
          Anticipacion: {diasAnticipacion} dias
        </Button>
      </div>

      {/* Vencimientos List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarClock className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No hay vencimientos</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filtro !== "todos"
                ? "Cambia el filtro para ver otros vencimientos"
                : "Agrega fechas de vencimiento a gastos fijos o servicios a eventos"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, idx) => {
            if (item.tipo === "gasto-fijo") {
              const urgency = getUrgency(item.fechaVencimiento)
              return (
                <Card key={`gf-${item.id}`} className={`transition-shadow hover:shadow-md ${getUrgencyStyles(urgency)}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg p-2.5 bg-orange-100 text-orange-700 shrink-0">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{item.concepto}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">Gasto Fijo</Badge>
                          {getUrgencyBadge(urgency)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {item.tipoGasto}
                          {item.salon && <span> - {item.salon}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <CalendarClock className="h-3 w-3" />
                          Vence: {new Date(item.fechaVencimiento + "T00:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-lg">{formatCurrency(item.monto)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            }

            // Servicio
            const urgency = getUrgency(item.fechaLimite)
            return (
              <Card key={`srv-${item.eventoId}-${item.servicioIdx}`} className={`transition-shadow hover:shadow-md ${item.pagado ? "opacity-70" : getUrgencyStyles(urgency)}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTogglePagado(item.eventoId, item.servicioIdx, !item.pagado)}
                        className={`flex items-center justify-center h-10 w-10 rounded-full border-2 transition-colors ${
                          item.pagado
                            ? "bg-emerald-500 border-emerald-500 text-emerald-50"
                            : "border-muted-foreground/30 hover:border-emerald-400 text-transparent hover:text-emerald-400"
                        }`}
                        title={item.pagado ? "Marcar como pendiente" : "Marcar como pagado"}
                      >
                        <Check className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-semibold truncate ${item.pagado ? "line-through text-muted-foreground" : ""}`}>
                          {item.servicioNombre}
                        </p>
                        <Badge variant="outline" className="text-[10px] shrink-0">Servicio</Badge>
                        {item.pagado ? (
                          <Badge className="bg-emerald-500 text-emerald-50 text-[10px]">Pagado</Badge>
                        ) : (
                          getUrgencyBadge(urgency)
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Evento: {item.eventoNombre} - {new Date(item.eventoFecha + "T00:00:00").toLocaleDateString("es-AR")}
                      </p>
                      {item.proveedor && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Proveedor: {item.proveedor}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <CalendarClock className="h-3 w-3" />
                        Limite de pago: {new Date(item.fechaLimite + "T00:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-lg ${item.pagado ? "text-muted-foreground line-through" : ""}`}>
                        {formatCurrency(item.monto)}
                      </p>
                      {item.pagado && (
                        <span className="text-xs text-emerald-600 font-medium">Pagado</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit dias anticipacion dialog */}
      <Dialog open={editDiasDialog} onOpenChange={setEditDiasDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dias de Anticipacion</DialogTitle>
            <DialogDescription>
              Define cuantos dias antes del evento se muestra la fecha limite de pago de servicios
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Dias antes del evento</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={tempDias}
                onChange={(e) => setTempDias(parseInt(e.target.value) || 7)}
              />
              <p className="text-xs text-muted-foreground">
                Los servicios mostraran una fecha limite de pago {tempDias} dias antes del evento
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDiasDialog(false)}>Cancelar</Button>
            <Button onClick={() => { setDiasAnticipacion(tempDias); setEditDiasDialog(false) }}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

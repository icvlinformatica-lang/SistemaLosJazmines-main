"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store-context"
import { formatCurrency } from "@/lib/store"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Receipt,
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

type VencimientoItem = VencimientoGastoFijo

export default function VencimientosPage() {
  const { costosOperativos } = useStore()
  const [filtro, setFiltro] = useState<"todos" | "vencidos" | "proximos">("todos")

  // Build all vencimientos - SOLO gastos fijos
  const items = useMemo(() => {
    const result: VencimientoItem[] = []

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

    result.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
    return result
  }, [costosOperativos])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const date = new Date(item.fechaVencimiento + "T00:00:00")
      const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (filtro === "vencidos") return diffDays < 0
      if (filtro === "proximos") return diffDays >= 0 && diffDays <= 7
      return true
    })
  }, [items, filtro])

  const stats = useMemo(() => {
    const totalItems = items.length
    const vencidos = items.filter((i) => {
      const d = new Date(i.fechaVencimiento + "T00:00:00")
      return d < today
    }).length
    const proximos = items.filter((i) => {
      const d = new Date(i.fechaVencimiento + "T00:00:00")
      const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return diff >= 0 && diff <= 7
    }).length
    const montoTotal = items.reduce((s, i) => s + i.monto, 0)

    return { totalItems, vencidos, proximos, montoTotal }
  }, [items])

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
        <h1 className="text-2xl font-bold">Vencimientos - Gastos Fijos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Control de vencimientos de gastos fijos operativos (alquileres, servicios, seguros, etc.)
        </p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
          <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Total gastos:</span>
          <span className="font-bold">{stats.totalItems}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          <span className="text-destructive">Vencidos:</span>
          <span className="font-bold text-destructive">{stats.vencidos}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-amber-700">Proximos 7 dias:</span>
          <span className="font-bold text-amber-700">{stats.proximos}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted ml-auto">
          <span className="text-muted-foreground">Monto total mensual:</span>
          <span className="font-bold">{formatCurrency(stats.montoTotal)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["todos", "vencidos", "proximos"] as const).map((f) => (
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
              {f === "proximos" ? "Proximos 7 dias" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Vencimientos List - Solo Gastos Fijos */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarClock className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No hay vencimientos</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filtro !== "todos"
                ? "Cambia el filtro para ver otros vencimientos"
                : "Agrega fechas de vencimiento a tus gastos fijos operativos"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
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
          })}
        </div>
      )}
    </div>
  )
}

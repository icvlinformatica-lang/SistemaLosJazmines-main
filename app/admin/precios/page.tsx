"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store-context"
import { formatCurrency, SALONES } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  DollarSign,
  Copy,
} from "lucide-react"

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const DIAS_SEMANA = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

// Salon color coding
const SALON_COLORS: Record<string, { bg: string; border: string; text: string; activeBg: string }> = {
  Quinta: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", activeBg: "bg-emerald-500" },
  Casona: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700", activeBg: "bg-sky-500" },
  Salon: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", activeBg: "bg-amber-500" },
}

const DAY_NAMES_SHORT = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"]

function getDayStyle(dayOfWeek: number): { bg: string; text: string; label: string } {
  switch (dayOfWeek) {
    case 5: return { bg: "bg-violet-100", text: "text-violet-700", label: "Vie" }
    case 6: return { bg: "bg-rose-100", text: "text-rose-700", label: "Sab" }
    case 0: return { bg: "bg-sky-100", text: "text-sky-700", label: "Dom" }
    default: return { bg: "bg-muted", text: "text-muted-foreground", label: DAY_NAMES_SHORT[dayOfWeek] }
  }
}

export default function PreciosPage() {
  const { preciosVenta, setPrecioVenta, deletePrecioVenta } = useStore()

  const today = new Date()
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [selectedSalon, setSelectedSalon] = useState<string>(SALONES[0])

  // Edit dialog
  const [editDialog, setEditDialog] = useState(false)
  const [editDate, setEditDate] = useState("")
  const [editPrice, setEditPrice] = useState(0)

  // Bulk assign dialog
  const [bulkDialog, setBulkDialog] = useState(false)
  const [bulkPrice, setBulkPrice] = useState(0)
  const [bulkMonth, setBulkMonth] = useState(today.getMonth())
  const [bulkDays, setBulkDays] = useState<string>("all") // "all", "weekdays", "weekends", "fri-sat"

  // Expand/collapse price detail per month
  const [expandedMonths, setExpandedMonths] = useState<number[]>([])
  const toggleMonth = (m: number) => {
    setExpandedMonths((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m])
  }

  const salonColors = SALON_COLORS[selectedSalon] || SALON_COLORS["Quinta"]

  // Get prices for the selected salon
  const salonPrecios = useMemo(() => {
    return preciosVenta[selectedSalon] || {}
  }, [preciosVenta, selectedSalon])

  // Stats
  const stats = useMemo(() => {
    let datesWithPrice = 0
    let totalRevenue = 0
    const monthlyRevenue: number[] = new Array(12).fill(0)

    Object.entries(salonPrecios).forEach(([fecha, precio]) => {
      const [y] = fecha.split("-").map(Number)
      if (y === selectedYear) {
        datesWithPrice++
        totalRevenue += precio
        const m = parseInt(fecha.split("-")[1]) - 1
        monthlyRevenue[m] += precio
      }
    })

    return { datesWithPrice, totalRevenue, monthlyRevenue }
  }, [salonPrecios, selectedYear])

  const handleDayClick = (year: number, month: number, day: number) => {
    const fecha = formatDate(year, month, day)
    const currentPrice = salonPrecios[fecha] || 0
    setEditDate(fecha)
    setEditPrice(currentPrice)
    setEditDialog(true)
  }

  const handleSavePrice = () => {
    if (editPrice > 0) {
      setPrecioVenta(selectedSalon, editDate, editPrice)
    } else {
      deletePrecioVenta(selectedSalon, editDate)
    }
    setEditDialog(false)
  }

  const handleBulkAssign = () => {
    const year = selectedYear
    const daysInMonth = getDaysInMonth(year, bulkMonth)

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, bulkMonth, day)
      const dayOfWeek = date.getDay() // 0=Sun, 6=Sat

      let shouldAssign = false
      switch (bulkDays) {
        case "all":
          shouldAssign = true
          break
        case "weekdays":
          shouldAssign = dayOfWeek >= 1 && dayOfWeek <= 5
          break
        case "weekends":
          shouldAssign = dayOfWeek === 0 || dayOfWeek === 6
          break
        case "fri-sat":
          shouldAssign = dayOfWeek === 5 || dayOfWeek === 6
          break
      }

      if (shouldAssign && bulkPrice > 0) {
        const fecha = formatDate(year, bulkMonth, day)
        setPrecioVenta(selectedSalon, fecha, bulkPrice)
      }
    }
    setBulkDialog(false)
  }

  const renderMonth = (monthIdx: number) => {
    const daysInMonth = getDaysInMonth(selectedYear, monthIdx)
    const firstDay = getFirstDayOfMonth(selectedYear, monthIdx)
    const isCurrentMonth = today.getFullYear() === selectedYear && today.getMonth() === monthIdx

    // Count prices this month
    let monthPriceCount = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const fecha = formatDate(selectedYear, monthIdx, d)
      if (salonPrecios[fecha]) monthPriceCount++
    }

    return (
      <Card
        key={monthIdx}
        className={`transition-shadow hover:shadow-md ${isCurrentMonth ? "ring-2 ring-primary/30" : ""}`}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm font-semibold ${isCurrentMonth ? "text-primary" : ""}`}>
              {MESES[monthIdx]}
            </h3>
            {monthPriceCount > 0 && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${salonColors.bg} ${salonColors.text}`}>
                {monthPriceCount} dias
              </span>
            )}
          </div>

          <div className="grid grid-cols-7 gap-px text-center mb-1">
            {DIAS_SEMANA.map((d) => (
              <span key={d} className="text-[9px] text-muted-foreground font-medium leading-4">{d.charAt(0)}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: firstDay }, (_, i) => (
              <span key={`e-${i}`} className="text-[9px] leading-5" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const fecha = formatDate(selectedYear, monthIdx, day)
              const hasPrice = !!salonPrecios[fecha]
              const isToday = today.getFullYear() === selectedYear && today.getMonth() === monthIdx && today.getDate() === day

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(selectedYear, monthIdx, day)}
                  className={`text-[9px] leading-5 rounded-sm transition-colors cursor-pointer ${
                    isToday
                      ? "bg-primary text-primary-foreground font-bold"
                      : hasPrice
                        ? `${salonColors.bg} ${salonColors.text} font-semibold`
                        : "text-muted-foreground hover:bg-muted"
                  }`}
                  title={hasPrice ? `${formatCurrency(salonPrecios[fecha])}` : "Sin precio"}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Expandable day-price list */}
          {(() => {
            const daysWithPrices: { day: number; fecha: string; precio: number; dayOfWeek: number }[] = []
            for (let d = 1; d <= daysInMonth; d++) {
              const fecha = formatDate(selectedYear, monthIdx, d)
              if (salonPrecios[fecha]) {
                const date = new Date(selectedYear, monthIdx, d)
                daysWithPrices.push({ day: d, fecha, precio: salonPrecios[fecha], dayOfWeek: date.getDay() })
              }
            }
            if (daysWithPrices.length === 0) return null
            const isExpanded = expandedMonths.includes(monthIdx)
            return (
              <div className="mt-2 pt-1.5 border-t border-border">
                <button
                  type="button"
                  onClick={() => toggleMonth(monthIdx)}
                  className="flex items-center justify-between w-full text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{daysWithPrices.length} {daysWithPrices.length === 1 ? "precio" : "precios"}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
                </button>
                {isExpanded && (
                  <div className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto">
                    {daysWithPrices.map(({ day, precio, dayOfWeek }) => {
                      const style = getDayStyle(dayOfWeek)
                      return (
                        <div
                          key={day}
                          className={`flex items-center justify-between rounded px-1.5 py-0.5 text-[10px] ${style.bg}`}
                        >
                          <span className={`font-medium ${style.text}`}>
                            {style.label} {day}
                          </span>
                          <span className={`font-bold ${style.text}`}>
                            {formatCurrency(precio)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Calendario de Precios</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Define el precio de venta por salon y fecha. Estos precios se mostraran automaticamente en el Planificador.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          {/* Salon selector */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {SALONES.map((salon) => {
              const colors = SALON_COLORS[salon] || SALON_COLORS["Quinta"]
              const isActive = selectedSalon === salon
              return (
                <button
                  key={salon}
                  type="button"
                  onClick={() => setSelectedSalon(salon)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? `${colors.activeBg} text-white`
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {salon}
                </button>
              )
            })}
          </div>

          {/* Year navigation */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSelectedYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-bold min-w-16 text-center">{selectedYear}</span>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSelectedYear((y) => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Button variant="outline" onClick={() => {
          setBulkPrice(0)
          setBulkMonth(today.getMonth())
          setBulkDays("all")
          setBulkDialog(true)
        }}>
          <Copy className="h-4 w-4 mr-2" />
          Asignar en bloque
        </Button>
      </div>

      {/* Compact Stats */}
      <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Fechas con precio:</span>
          <span className="font-bold">{stats.datesWithPrice}</span>
        </div>
      </div>

      {/* Annual Calendar Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, i) => renderMonth(i))}
      </div>

      {/* Edit Price Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Precio de Venta</DialogTitle>
            <DialogDescription>
              {selectedSalon} - {editDate}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Precio ($)</Label>
              <Input
                type="number"
                min={0}
                value={editPrice || ""}
                onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                placeholder="Ingresa el precio de venta"
                autoFocus
              />
            </div>
            {editPrice > 0 && (
              <p className="text-sm text-muted-foreground">
                Se guardara {formatCurrency(editPrice)} para {selectedSalon} el {editDate}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            {salonPrecios[editDate] && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  deletePrecioVenta(selectedSalon, editDate)
                  setEditDialog(false)
                }}
              >
                Quitar precio
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleSavePrice}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={bulkDialog} onOpenChange={setBulkDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Asignar precio en bloque</DialogTitle>
            <DialogDescription>
              Asignar un precio a multiples dias de {selectedSalon}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Mes</Label>
              <Select value={String(bulkMonth)} onValueChange={(v) => setBulkMonth(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Dias a asignar</Label>
              <Select value={bulkDays} onValueChange={setBulkDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los dias</SelectItem>
                  <SelectItem value="weekdays">Lunes a Viernes</SelectItem>
                  <SelectItem value="weekends">Sabados y Domingos</SelectItem>
                  <SelectItem value="fri-sat">Viernes y Sabados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Precio ($)</Label>
              <Input
                type="number"
                min={0}
                value={bulkPrice || ""}
                onChange={(e) => setBulkPrice(parseFloat(e.target.value) || 0)}
                placeholder="Precio para los dias seleccionados"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(false)}>Cancelar</Button>
            <Button onClick={handleBulkAssign} disabled={bulkPrice <= 0}>Asignar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

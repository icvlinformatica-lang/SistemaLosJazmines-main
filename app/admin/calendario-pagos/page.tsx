"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import { formatCurrency, generarCalendarioCuotas, type EventoGuardado } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CreditCard,
  Check,
  Clock,
  ExternalLink,
  AlertCircle,
  Building2,
} from "lucide-react"

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const SALONES_FILTER = [
  { key: "todos", label: "Todos", icon: null },
  { key: "Salon", label: "Salon", icon: Building2 },
  { key: "Casona", label: "Casona", icon: Building2 },
  { key: "Quinta", label: "Quinta", icon: Building2 },
] as const

type SalonFilter = "todos" | "Salon" | "Casona" | "Quinta"

interface CuotaMes {
  evento: EventoGuardado
  cuotaNumero: number
  cuotasTotal: number
  montoCuota: number
  montoTotal: number
  pagada: boolean
  fechaVencimiento: string
  fechaEvento: string
  nombreDisplay: string
  salon: string
}

function getCuotasPorMes(eventos: EventoGuardado[]): Record<string, CuotaMes[]> {
  const result: Record<string, CuotaMes[]> = {}

  for (const ev of eventos) {
    if (ev.estado === "cancelado" || ev.estado === "completado") continue

    const calendario = generarCalendarioCuotas(ev)
    if (calendario.length === 0) continue

    const nombreDisplay = ev.nombrePareja || ev.nombre || ev.tipoEvento || "Evento"
    const plan = ev.planDeCuotas!

    for (const cuota of calendario) {
      if (!cuota.fechaVencimiento) continue

      const mKey = cuota.fechaVencimiento.substring(0, 7)

      if (!result[mKey]) result[mKey] = []
      result[mKey].push({
        evento: ev,
        cuotaNumero: cuota.numeroCuota,
        cuotasTotal: plan.numeroCuotas,
        montoCuota: cuota.monto,
        montoTotal: plan.montoTotal,
        pagada: cuota.pagada,
        fechaVencimiento: cuota.fechaVencimiento,
        fechaEvento: ev.fecha,
        nombreDisplay,
        salon: ev.salon || "Sin salon",
      })
    }
  }

  return result
}

function CuotaItem({ c, variant = "default" }: { c: CuotaMes; variant?: "urgent" | "default" }) {
  if (c.pagada) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
        <div className="flex items-center justify-center h-8 w-8 rounded-full shrink-0 bg-emerald-500 text-white">
          <Check className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{c.nombreDisplay}</p>
            <Badge variant="outline" className="text-[10px] shrink-0">{c.salon}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cuota {c.cuotaNumero}/{c.cuotasTotal} - Evento: {c.fechaEvento}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-emerald-700">{formatCurrency(c.montoCuota)}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Pagado</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
      variant === "urgent"
        ? "border-amber-300 bg-amber-50/80"
        : "border-border bg-background hover:bg-accent/30"
    }`}>
      <div className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${
        variant === "urgent"
          ? "bg-amber-100 text-amber-700"
          : "bg-muted text-muted-foreground"
      }`}>
        <CreditCard className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{c.nombreDisplay}</p>
          <Badge variant="outline" className="text-[10px] shrink-0">{c.salon}</Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Cuota {c.cuotaNumero}/{c.cuotasTotal} - Evento: {c.fechaEvento}
          {c.fechaVencimiento && ` - Vence: ${new Date(c.fechaVencimiento + "T12:00:00").toLocaleDateString("es-AR")}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold">{formatCurrency(c.montoCuota)}</p>
      </div>
      <Link
        href={`/eventos/pagos?evento=${encodeURIComponent(c.evento.id)}`}
        className="shrink-0"
      >
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  )
}

function MonthCollapsible({
  monthLabel,
  cuotas,
  defaultOpen = false,
  isCurrent = false,
}: {
  monthLabel: string
  cuotas: CuotaMes[]
  defaultOpen?: boolean
  isCurrent?: boolean
}) {
  const pendientes = cuotas.filter(c => !c.pagada)
  const pagadas = cuotas.filter(c => c.pagada)
  const totalMes = cuotas.reduce((s, c) => s + c.montoCuota, 0)
  const pagadoMes = pagadas.reduce((s, c) => s + c.montoCuota, 0)
  const pendienteMes = totalMes - pagadoMes

  if (cuotas.length === 0) return null

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger asChild>
        <button className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer group ${
          isCurrent
            ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
            : "border-border bg-card hover:bg-accent/30"
        }`}>
          <div className="flex items-center gap-3">
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            <span className={`font-semibold ${isCurrent ? "text-primary" : ""}`}>
              {monthLabel}
            </span>
            {isCurrent && (
              <Badge variant="secondary" className="text-[10px] py-0">Mes actual</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            {pendientes.length > 0 && (
              <Badge variant="outline" className="text-xs text-amber-700 border-amber-400 bg-amber-50">
                {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {pagadas.length > 0 && (
              <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-400 bg-emerald-50">
                {pagadas.length} pagada{pagadas.length !== 1 ? "s" : ""}
              </Badge>
            )}
            <span className="text-sm font-bold">{formatCurrency(totalMes)}</span>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2 pl-2">
          {pendientes.map((c, idx) => (
            <CuotaItem key={`${c.evento.id}-${c.cuotaNumero}-p-${idx}`} c={c} />
          ))}
          {pagadas.map((c, idx) => (
            <CuotaItem key={`${c.evento.id}-${c.cuotaNumero}-d-${idx}`} c={c} />
          ))}
          <div className="flex items-center justify-between pt-2 pb-1 px-1 border-t border-border text-xs">
            <div className="flex items-center gap-3">
              <span className="text-emerald-600 font-medium">
                Cobrado: {formatCurrency(pagadoMes)}
              </span>
              {pendienteMes > 0 && (
                <span className="text-amber-600 font-medium">
                  Pendiente: {formatCurrency(pendienteMes)}
                </span>
              )}
            </div>
            <span className="font-bold">{formatCurrency(totalMes)}</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function CalendarioPagosPage() {
  const { eventos } = useStore()
  const today = new Date()
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [salonFilter, setSalonFilter] = useState<SalonFilter>("todos")

  const cuotasPorMes = useMemo(() => getCuotasPorMes(eventos), [eventos])

  // Filter by salon
  const filteredCuotasPorMes = useMemo(() => {
    if (salonFilter === "todos") return cuotasPorMes
    const filtered: Record<string, CuotaMes[]> = {}
    for (const [key, cuotas] of Object.entries(cuotasPorMes)) {
      const f = cuotas.filter(c => c.salon === salonFilter)
      if (f.length > 0) filtered[key] = f
    }
    return filtered
  }, [cuotasPorMes, salonFilter])

  // Pending in the next 10 days
  const pendientesProximos = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const limite = new Date(hoy)
    limite.setDate(limite.getDate() + 10)

    const resultado: CuotaMes[] = []
    for (const cuotas of Object.values(filteredCuotasPorMes)) {
      for (const c of cuotas) {
        if (c.pagada) continue
        if (!c.fechaVencimiento) continue
        const fv = new Date(c.fechaVencimiento + "T12:00:00")
        if (fv >= hoy && fv <= limite) {
          resultado.push(c)
        }
      }
    }
    return resultado.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
  }, [filteredCuotasPorMes])

  // Months for the selected year
  const monthsData = useMemo(() => {
    const now = new Date()
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    return Array.from({ length: 12 }, (_, m) => {
      const key = `${selectedYear}-${String(m + 1).padStart(2, "0")}`
      const cuotas = filteredCuotasPorMes[key] || []
      return {
        key,
        month: m,
        label: `${MESES[m]} ${selectedYear}`,
        cuotas,
        isCurrent: key === currentKey,
      }
    }).filter(m => m.cuotas.length > 0)
  }, [selectedYear, filteredCuotasPorMes])

  // Count per salon for filter badges
  const countsBySalon = useMemo(() => {
    const counts: Record<string, number> = { todos: 0, Salon: 0, Casona: 0, Quinta: 0 }
    for (const cuotas of Object.values(cuotasPorMes)) {
      for (const c of cuotas) {
        if (c.pagada) continue
        counts.todos++
        if (c.salon === "Salon") counts.Salon++
        if (c.salon === "Casona") counts.Casona++
        if (c.salon === "Quinta") counts.Quinta++
      }
    }
    return counts
  }, [cuotasPorMes])

  const totalPendienteProximos = pendientesProximos.reduce((s, c) => s + c.montoCuota, 0)

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-balance">Calendario de Pagos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visualiza las cuotas pendientes de cobro por salon y mes.
        </p>
      </div>

      {/* Salon Filter Buttons */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {SALONES_FILTER.map(({ key, label, icon: Icon }) => {
          const isActive = salonFilter === key
          const count = countsBySalon[key] || 0
          return (
            <button
              key={key}
              onClick={() => setSalonFilter(key as SalonFilter)}
              className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 transition-all cursor-pointer ${
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:bg-accent/30"
              }`}
            >
              {Icon ? (
                <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              ) : (
                <CreditCard className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              )}
              <span className={`text-sm font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>
                {label}
              </span>
              {count > 0 && (
                <span className={`text-xs font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {count} pendiente{count !== 1 ? "s" : ""}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Pending next 10 days */}
      {pendientesProximos.length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Pendientes proximos 10 dias
              <Badge variant="outline" className="ml-auto text-xs text-amber-700 border-amber-400 bg-amber-100">
                {pendientesProximos.length} cuota{pendientesProximos.length !== 1 ? "s" : ""} - {formatCurrency(totalPendienteProximos)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {pendientesProximos.map((c, idx) => (
              <CuotaItem key={`urgent-${c.evento.id}-${c.cuotaNumero}-${idx}`} c={c} variant="urgent" />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Year navigation */}
      <div className="flex items-center justify-between mb-4">
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

      {/* Collapsible months */}
      <div className="space-y-3">
        {monthsData.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">
              Sin cuotas programadas para {selectedYear}
              {salonFilter !== "todos" ? ` en ${salonFilter}` : ""}
            </p>
          </div>
        ) : (
          monthsData.map(({ key, label, cuotas, isCurrent }) => (
            <MonthCollapsible
              key={key}
              monthLabel={label}
              cuotas={cuotas}
              defaultOpen={isCurrent}
              isCurrent={isCurrent}
            />
          ))
        )}
      </div>
    </div>
  )
}

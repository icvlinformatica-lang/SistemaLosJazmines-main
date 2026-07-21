"use client"

import { useState } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import { formatCurrency, type EventoGuardado, type Vendedor } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Calendar, Percent, Banknote, ChevronDown, ChevronUp, UserCheck, Eye, EyeOff, TrendingUp } from "lucide-react"

// Emojis disponibles como foto de perfil
const EMOJIS_PERFIL = [
  "😀", "😎", "🤓", "🥳", "😇", "🤠",
  "👩", "👨", "👩‍🦰", "👨‍🦱", "👱‍♀️", "🧔",
  "💼", "📞", "⭐", "🔥", "🏆", "💪",
  "🌸", "🌟", "🍀", "🎯", "🚀", "❤️",
]

function formatFecha(fecha: string | undefined) {
  if (!fecha) return "Sin fecha"
  const [y, m, d] = fecha.split("-")
  if (!y || !m || !d) return fecha
  return `${d}/${m}/${y}`
}

/** Total de venta de un evento: prioriza el plan de cuotas del contrato */
function totalVentaEvento(e: EventoGuardado): number {
  if (e.planDeCuotas && e.planDeCuotas.montoTotal > 0) return e.planDeCuotas.montoTotal
  return e.precioVenta || 0
}

/** Fecha en que se vendió el evento: inicio del plan de cuotas o, si no hay, la fecha del evento */
function fechaVentaEvento(e: EventoGuardado): string {
  return e.planDeCuotas?.fechaInicioPlan || e.fecha || ""
}

/** Texto usado para tapar montos cuando el ojito está activado */
const MONTO_TAPADO = "•••••••"

function VendedorCard({
  vendedor,
  eventosAsignados,
}: {
  vendedor: Vendedor
  eventosAsignados: EventoGuardado[]
}) {
  const { updateVendedor } = useStore()
  const { toast } = useToast()
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [expandido, setExpandido] = useState(false)
  const [oculto, setOculto] = useState(false)
  const [sueldoLocal, setSueldoLocal] = useState<number>(vendedor.sueldo || 0)
  const [comisionLocal, setComisionLocal] = useState<string>(String(vendedor.comisionPct || 0))

  const totalVendido = eventosAsignados.reduce((s, e) => s + totalVentaEvento(e), 0)
  const pct = Number.parseFloat(comisionLocal) || 0
  const totalComisiones = (totalVendido * pct) / 100

  // Eventos vendidos en los últimos 30 días (según fecha de venta del contrato)
  const hace30Dias = new Date()
  hace30Dias.setDate(hace30Dias.getDate() - 30)
  const hace30ISO = `${hace30Dias.getFullYear()}-${String(hace30Dias.getMonth() + 1).padStart(2, "0")}-${String(hace30Dias.getDate()).padStart(2, "0")}`
  const vendidosUltimoMes = eventosAsignados
    .filter((e) => {
      const f = fechaVentaEvento(e)
      return f && f >= hace30ISO
    })
    .sort((a, b) => fechaVentaEvento(b).localeCompare(fechaVentaEvento(a)))
  const totalUltimoMes = vendidosUltimoMes.reduce((s, e) => s + totalVentaEvento(e), 0)

  /** Muestra el monto o lo tapa según el ojito */
  const monto = (v: number) => (oculto ? MONTO_TAPADO : formatCurrency(v))

  const guardarSueldo = () => {
    if (sueldoLocal === vendedor.sueldo) return
    updateVendedor(vendedor.id, { sueldo: sueldoLocal })
    toast({ title: "Sueldo actualizado", description: `${vendedor.nombre}: ${formatCurrency(sueldoLocal)}` })
  }

  const guardarComision = () => {
    const nueva = Math.max(0, Math.min(100, Number.parseFloat(comisionLocal) || 0))
    setComisionLocal(String(nueva))
    if (nueva === vendedor.comisionPct) return
    updateVendedor(vendedor.id, { comisionPct: nueva })
    toast({ title: "Comisión actualizada", description: `${vendedor.nombre}: ${nueva}% por evento vendido` })
  }

  const elegirEmoji = (emoji: string) => {
    updateVendedor(vendedor.id, { emoji })
    setEmojiOpen(false)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          {/* Avatar emoji editable */}
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title="Cambiar foto de perfil"
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-border bg-muted text-2xl hover:border-teal-500 transition-colors shrink-0"
              >
                {vendedor.emoji ? (
                  <span aria-hidden="true">{vendedor.emoji}</span>
                ) : (
                  <UserCheck className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="sr-only">Cambiar emoji de {vendedor.nombre}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <p className="text-xs font-medium text-muted-foreground mb-2">Elegí un emoji de perfil</p>
              <div className="grid grid-cols-6 gap-1">
                {EMOJIS_PERFIL.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => elegirEmoji(em)}
                    className={`flex h-9 w-9 items-center justify-center rounded-md text-xl hover:bg-muted transition-colors ${
                      vendedor.emoji === em ? "bg-teal-100 ring-2 ring-teal-500" : ""
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
              {vendedor.emoji && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-muted-foreground"
                  onClick={() => elegirEmoji("")}
                >
                  Quitar emoji
                </Button>
              )}
            </PopoverContent>
          </Popover>

          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg">{vendedor.nombre}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {eventosAsignados.length} evento{eventosAsignados.length !== 1 ? "s" : ""} asignado
              {eventosAsignados.length !== 1 ? "s" : ""}
            </p>
          </div>

          <Badge variant="secondary" className="shrink-0 tabular-nums">
            Vendió {monto(totalVendido)}
          </Badge>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={() => setOculto((v) => !v)}
            title={oculto ? "Mostrar montos" : "Ocultar montos"}
          >
            {oculto ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="sr-only">
              {oculto ? "Mostrar" : "Ocultar"} montos de {vendedor.nombre}
            </span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sueldo y comisión */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`sueldo-${vendedor.id}`} className="text-xs font-medium flex items-center gap-1.5">
              <Banknote className="h-3.5 w-3.5 text-teal-600" />
              Sueldo base mensual
            </Label>
            {oculto ? (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground select-none">
                {MONTO_TAPADO}
              </div>
            ) : (
              <MoneyInput
                id={`sueldo-${vendedor.id}`}
                value={sueldoLocal}
                onValueChange={(v) => setSueldoLocal(v || 0)}
                onBlur={guardarSueldo}
                className="h-10"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`comision-${vendedor.id}`} className="text-xs font-medium flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5 text-amber-600" />
              Comisión por evento vendido (%)
            </Label>
            {oculto ? (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground select-none">
                {MONTO_TAPADO}
              </div>
            ) : (
              <Input
                id={`comision-${vendedor.id}`}
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={comisionLocal}
                onChange={(e) => setComisionLocal(e.target.value)}
                onBlur={guardarComision}
                className="h-10"
              />
            )}
          </div>
        </div>

        {/* Resumen de comisiones */}
        <div className="rounded-lg bg-muted/60 p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            Comisiones ({oculto ? "•••" : `${pct}% de ${formatCurrency(totalVendido)}`}):
          </span>
          <span className="font-bold text-teal-700 tabular-nums">{monto(totalComisiones)}</span>
          <span className="text-muted-foreground">Total con sueldo:</span>
          <span className="font-bold text-foreground tabular-nums">
            {monto((vendedor.sueldo || 0) + totalComisiones)}
          </span>
        </div>

        {/* Vendidos en el último mes */}
        <div className="rounded-lg border border-teal-200 bg-teal-50/60 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-teal-200/70">
            <TrendingUp className="h-3.5 w-3.5 text-teal-700 shrink-0" />
            <span className="text-xs font-semibold text-teal-900 flex-1">Vendidos el último mes</span>
            <Badge className="bg-teal-600 text-white border-transparent text-[11px]">
              {vendidosUltimoMes.length}
            </Badge>
            <span className="text-xs font-bold text-teal-800 tabular-nums">{monto(totalUltimoMes)}</span>
          </div>
          {vendidosUltimoMes.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">Sin ventas en los últimos 30 días.</p>
          ) : (
            <div className="divide-y divide-teal-100">
              {vendidosUltimoMes.map((e) => (
                <div key={`mes-${e.id}`} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.nombrePareja || e.nombre || "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground">
                      Vendido el {formatFecha(fechaVentaEvento(e))}
                      {e.salon ? ` · ${e.salon}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-teal-800 tabular-nums shrink-0">
                    {monto(totalVentaEvento(e))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Eventos asignados */}
        {eventosAsignados.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              aria-expanded={expandido}
              className="w-full flex items-center gap-2 bg-muted/50 hover:bg-muted px-3 py-2 text-left transition-colors"
            >
              {expandido ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <Calendar className="h-3.5 w-3.5 text-teal-600 shrink-0" />
              <span className="text-xs font-semibold flex-1">Eventos vendidos</span>
              <Badge variant="outline" className="text-[11px]">{eventosAsignados.length}</Badge>
            </button>
            {expandido && (
              <div className="divide-y divide-border">
                {eventosAsignados.map((e) => {
                  const total = totalVentaEvento(e)
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {e.nombrePareja || e.nombre || "Sin nombre"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFecha(e.fecha)}
                          {e.salon ? ` · ${e.salon}` : ""}
                          {e.tipoEvento ? ` · ${e.tipoEvento}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">{monto(total)}</p>
                        <p className="text-xs text-teal-700 tabular-nums">
                          Comisión: {monto((total * pct) / 100)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function VendedoresPage() {
  const { vendedores, eventos } = useStore()

  // Eventos asignados por vendedor (por nombre, como queda guardado en el contrato)
  const eventosPorVendedor = (nombre: string) =>
    (eventos || []).filter((e) => e.contrato?.vendedor === nombre)

  const totalEventosAsignados = (eventos || []).filter((e) => e.contrato?.vendedor).length

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/eventos/lista" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Volver a la lista de eventos</span>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-balance">Vendedores</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {totalEventosAsignados} evento{totalEventosAsignados !== 1 ? "s" : ""} con vendedor asignado ·
                el vendedor se asigna desde el generador de contratos
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/eventos/lista">Ir a Lista de Eventos</Link>
          </Button>
        </div>

        {/* Cards de vendedores */}
        <div className="grid gap-4 lg:grid-cols-2">
          {vendedores.map((v) => (
            <VendedorCard key={v.id} vendedor={v} eventosAsignados={eventosPorVendedor(v.nombre)} />
          ))}
        </div>

        {vendedores.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No hay vendedores cargados.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

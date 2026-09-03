"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import { useClock } from "@/lib/clock-context"
import { formatCurrency, salonLabel, PORCENTAJE_COMISION_VENDEDOR, type EventoGuardado, type Vendedor } from "@/lib/store"
import { useCajaJazmines, type GastoVariable } from "@/lib/hooks/use-caja-jazmines"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  ArrowLeft,
  ChevronDown,
  UserCheck,
  Eye,
  EyeOff,
  Folder,
  CheckCircle2,
  Archive,
  Info,
} from "lucide-react"

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

/** Texto usado para tapar montos cuando el ojito está activado */
const MONTO_TAPADO = "•••••••"

/** Fila individual de una comisión (viva, viene de Caja Jazmines en vivo). */
function FilaComisionViva({ gasto, oculto }: { gasto: GastoVariable; oculto: boolean }) {
  const esPagado = gasto.estado === "pagado"
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {gasto.comisionDetalle?.eventoNombre || gasto.nombre}
        </p>
        <p className="text-xs text-amber-800/80 mt-0.5">
          {gasto.salon ? `${salonLabel(gasto.salon)} · ` : ""}
          {gasto.fecha ? formatFecha(gasto.fecha) : ""}
        </p>
        {esPagado ? (
          <p className="text-xs text-teal-700 mt-0.5">Comisión pagada al vendedor.</p>
        ) : (
          gasto.listaParaPagar && (
            <p className="text-xs text-emerald-700 mt-0.5">
              {gasto.motivoLista === "la seña cobrada la cubre"
                ? "La seña cobrada ya cubre esta comisión."
                : `Ya se pagaron ${gasto.motivoLista}.`}
            </p>
          )
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-bold tabular-nums">{oculto ? MONTO_TAPADO : formatCurrency(gasto.monto)}</span>
        {gasto.listaParaPagar && !esPagado && (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Lista para pagar
          </Badge>
        )}
      </div>
    </div>
  )
}

/** Fila de una comisión ya archivada (histórico), sin datos en vivo del evento. */
function FilaComisionArchivada({
  concepto,
  monto,
  salon,
  fecha,
  oculto,
}: {
  concepto: string
  monto: number
  salon?: string | null
  fecha?: string
  oculto: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{concepto}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {salon ? `${salonLabel(salon)} · ` : ""}
          {fecha ? formatFecha(fecha) : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-bold tabular-nums">{oculto ? MONTO_TAPADO : formatCurrency(monto)}</span>
        <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
          <Archive className="h-3 w-3" />
          Archivada
        </Badge>
      </div>
    </div>
  )
}

/** Subcarpeta colapsable de un estado de comisión (Lista para pagar / Próximamente / Pagadas). */
function Subcarpeta({
  titulo,
  color,
  count,
  subtotal,
  oculto,
  children,
}: {
  titulo: string
  color: string
  count: number
  subtotal: number
  oculto: boolean
  children: React.ReactNode
}) {
  return (
    <details className="group rounded-lg border" style={{ borderColor: `color-mix(in srgb, ${color} 30%, white)` }}>
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-black/5 [&::-webkit-details-marker]:hidden"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 7%, white)` }}
      >
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" style={{ color }} />
        <span className="flex-1 text-sm font-semibold" style={{ color: `color-mix(in srgb, ${color} 80%, black)` }}>
          {titulo}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
          style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, white)` }}
        >
          {count}
        </span>
        <span className="text-sm font-bold tabular-nums" style={{ color: `color-mix(in srgb, ${color} 85%, black)` }}>
          {oculto ? MONTO_TAPADO : formatCurrency(subtotal)}
        </span>
      </summary>
      <div className="space-y-2 p-2">
        {count === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">Sin comisiones acá.</p>
        ) : (
          children
        )}
      </div>
    </details>
  )
}

function VendedorCard({
  vendedor,
  eventosAsignados,
  comisionesVivas,
  archivadas,
}: {
  vendedor: Vendedor
  eventosAsignados: EventoGuardado[]
  comisionesVivas: GastoVariable[]
  archivadas: { id: string; concepto: string; monto: number; salon?: string | null; fecha?: string }[]
}) {
  const { updateVendedor } = useStore()
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [oculto, setOculto] = useState(false)

  const listas = comisionesVivas.filter((g) => g.estado !== "pagado" && g.listaParaPagar)
  const proximas = comisionesVivas.filter((g) => g.estado !== "pagado" && !g.listaParaPagar)
  const pagadasVivas = comisionesVivas.filter((g) => g.estado === "pagado")

  const totalListas = listas.reduce((s, g) => s + g.monto, 0)
  const totalProximas = proximas.reduce((s, g) => s + g.monto, 0)
  const totalPagadas = pagadasVivas.reduce((s, g) => s + g.monto, 0) + archivadas.reduce((s, g) => s + g.monto, 0)

  const totalComisionesCount = listas.length + proximas.length + pagadasVivas.length + archivadas.length
  const totalComisionesMonto = totalListas + totalProximas + totalPagadas

  const monto = (v: number) => (oculto ? MONTO_TAPADO : formatCurrency(v))

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
              {eventosAsignados.length} evento{eventosAsignados.length !== 1 ? "s" : ""} vendido
              {eventosAsignados.length !== 1 ? "s" : ""}
            </p>
          </div>

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
      <CardContent>
        {/* Carpeta principal: Comisiones */}
        <details className="group rounded-lg border border-amber-200 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 bg-amber-50/70 hover:bg-amber-50 px-3 py-2.5 transition-colors [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-4 w-4 text-amber-700 transition-transform group-open:rotate-180 shrink-0" />
            <Folder className="h-4 w-4 text-amber-700 shrink-0" />
            <span className="text-sm font-semibold text-amber-900 flex-1">Comisiones</span>
            <Badge className="bg-amber-600 text-white border-transparent text-[11px]">
              {totalComisionesCount}
            </Badge>
            <span className="text-sm font-bold text-amber-900 tabular-nums">{monto(totalComisionesMonto)}</span>
          </summary>
          <div className="space-y-2 p-3 bg-amber-50/20">
            {totalComisionesCount === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                {vendedor.nombre} todavía no tiene comisiones registradas.
              </p>
            ) : (
              <>
                <Subcarpeta titulo="Lista para pagar" color="#059669" count={listas.length} subtotal={totalListas} oculto={oculto}>
                  {listas.map((g) => (
                    <FilaComisionViva key={g.id} gasto={g} oculto={oculto} />
                  ))}
                </Subcarpeta>
                <Subcarpeta titulo="Próximamente" color="#b45309" count={proximas.length} subtotal={totalProximas} oculto={oculto}>
                  {proximas.map((g) => (
                    <FilaComisionViva key={g.id} gasto={g} oculto={oculto} />
                  ))}
                </Subcarpeta>
                <Subcarpeta titulo="Pagadas" color="#0f766e" count={pagadasVivas.length + archivadas.length} subtotal={totalPagadas} oculto={oculto}>
                  {pagadasVivas.map((g) => (
                    <FilaComisionViva key={g.id} gasto={g} oculto={oculto} />
                  ))}
                  {archivadas.map((g) => (
                    <FilaComisionArchivada
                      key={`arch-${g.id}`}
                      concepto={g.concepto}
                      monto={g.monto}
                      salon={g.salon}
                      fecha={g.fecha}
                      oculto={oculto}
                    />
                  ))}
                </Subcarpeta>
              </>
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}

export default function VendedoresPage() {
  const { vendedores, eventos, state } = useStore()
  const { ahora } = useClock()
  const dataCaja = useCajaJazmines(state, "todos", ahora)

  // Eventos asignados por vendedor (por nombre, como queda guardado en el contrato)
  const eventosPorVendedor = (nombre: string) =>
    (eventos || []).filter((e) => e.contrato?.vendedor === nombre)

  const comisionesVivasPorVendedor = (nombre: string) =>
    dataCaja.gastosVariables.filter((g) => g.esComision && g.comisionDetalle?.vendedor === nombre)

  const archivadasPorVendedor = (nombre: string) =>
    (state.gastosArchivados || []).filter(
      (g) => g.origen === "caja_jazmines_comision" && g.concepto.includes(nombre),
    )

  const totalEventosAsignados = (eventos || []).filter((e) => e.contrato?.vendedor).length

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
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

        {/* Banner explicativo del flujo de comisiones */}
        <div className="rounded-lg border border-border bg-muted/40 p-4 flex gap-3">
          <Info className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Cómo se calculan las comisiones</p>
            <p className="leading-relaxed">
              El cálculo de la comisión para cada vendedor se basa en un {PORCENTAJE_COMISION_VENDEDOR}% fijo. Por
              cada evento vendido, primero se restan los costos de servicios del monto total del evento. El{" "}
              {PORCENTAJE_COMISION_VENDEDOR}% de comisión se aplica sobre la diferencia resultante (Monto de Evento −
              Servicios).
            </p>
          </div>
        </div>

        {/* Cards de vendedores */}
        <div className="grid gap-4 items-start md:grid-cols-2 lg:grid-cols-3">
          {vendedores.map((v) => (
            <VendedorCard
              key={v.id}
              vendedor={v}
              eventosAsignados={eventosPorVendedor(v.nombre)}
              comisionesVivas={comisionesVivasPorVendedor(v.nombre)}
              archivadas={archivadasPorVendedor(v.nombre)}
            />
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

"use client"

import type React from "react"
import { useMemo, useState } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import { useClock } from "@/lib/clock-context"
import { formatCurrency, salonLabel, PORCENTAJE_COMISION_VENDEDOR, type EventoGuardado, type Vendedor } from "@/lib/store"
import { useCajaJazmines, type GastoVariable } from "@/lib/hooks/use-caja-jazmines"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { MoneyInput } from "@/components/ui/money-input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmAction } from "@/components/confirm-action"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  ChevronDown,
  UserCheck,
  Eye,
  EyeOff,
  Folder,
  CheckCircle2,
  Circle,
  Archive,
  Info,
  Wallet,
  StickyNote,
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
function FilaComisionViva({
  gasto,
  oculto,
  seleccionable,
  seleccionada,
  onToggleSeleccion,
  onTogglePagada,
}: {
  gasto: GastoVariable
  oculto: boolean
  seleccionable?: boolean
  seleccionada?: boolean
  onToggleSeleccion?: (gasto: GastoVariable) => void
  onTogglePagada?: (gasto: GastoVariable, pagada: boolean) => void
}) {
  const esPagado = gasto.estado === "pagado"

  const contenido = (
    <>
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
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-sm font-bold tabular-nums">
          {oculto ? MONTO_TAPADO : formatCurrency(gasto.monto)}
        </span>
      </div>
    </>
  )

  // Fila seleccionable (Lista para pagar): toda la fila es un toggle de selección.
  if (seleccionable) {
    return (
      <button
        type="button"
        onClick={() => onToggleSeleccion?.(gasto)}
        aria-pressed={seleccionada}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
          seleccionada
            ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400"
            : "border-amber-200 bg-amber-50/60 hover:bg-amber-50",
        )}
      >
        {seleccionada ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" />
        )}
        {contenido}
      </button>
    )
  }

  // Fila pagada: permite volver a marcarla como pendiente.
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      {contenido}
      {gasto.comisionDetalle && esPagado && onTogglePagada && (
        <ConfirmAction
          title="¿Marcar comisión como pendiente?"
          description={`${gasto.comisionDetalle.eventoNombre || gasto.nombre} · ${formatCurrency(gasto.monto)}. Volverá a figurar como pendiente.`}
          confirmLabel="Sí, marcar pendiente"
          onConfirm={() => onTogglePagada(gasto, false)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-teal-600 hover:text-teal-700"
            title="Marcar comisión como pendiente"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span className="sr-only">Marcar comisión pendiente</span>
          </Button>
        </ConfirmAction>
      )}
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
  defaultOpen,
  children,
}: {
  titulo: string
  color: string
  count: number
  subtotal: number
  oculto: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border"
      style={{ borderColor: `color-mix(in srgb, ${color} 30%, white)` }}
    >
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
  const { updateVendedor, updateEvento } = useStore()
  const { toast } = useToast()
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [oculto, setOculto] = useState(false)

  // Selección de comisiones "listas para pagar"
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  // Diálogo de pago
  const [pagarOpen, setPagarOpen] = useState(false)
  const [modoMonto, setModoMonto] = useState<"exacto" | "otro">("exacto")
  const [montoOtro, setMontoOtro] = useState(0)

  // Anotación editable (guarda al salir del campo)
  const [nota, setNota] = useState(vendedor.anotacion ?? "")

  const listas = comisionesVivas.filter((g) => g.estado !== "pagado" && g.listaParaPagar)
  const proximas = comisionesVivas.filter((g) => g.estado !== "pagado" && !g.listaParaPagar)
  const pagadasVivas = comisionesVivas.filter((g) => g.estado === "pagado")

  const totalListas = listas.reduce((s, g) => s + g.monto, 0)
  const totalProximas = proximas.reduce((s, g) => s + g.monto, 0)
  const totalPagadas = pagadasVivas.reduce((s, g) => s + g.monto, 0) + archivadas.reduce((s, g) => s + g.monto, 0)

  const totalComisionesCount = listas.length + proximas.length + pagadasVivas.length + archivadas.length
  const totalComisionesMonto = totalListas + totalProximas + totalPagadas

  const seleccionadas = useMemo(() => listas.filter((g) => seleccion.has(g.id)), [listas, seleccion])
  const totalSeleccion = seleccionadas.reduce((s, g) => s + g.monto, 0)

  const monto = (v: number) => (oculto ? MONTO_TAPADO : formatCurrency(v))

  const elegirEmoji = (emoji: string) => {
    updateVendedor(vendedor.id, { emoji })
    setEmojiOpen(false)
  }

  const guardarNota = () => {
    const limpia = nota.trim()
    if (limpia === (vendedor.anotacion ?? "")) return
    updateVendedor(vendedor.id, { anotacion: limpia })
  }

  const toggleSeleccion = (gasto: GastoVariable) => {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(gasto.id)) next.delete(gasto.id)
      else next.add(gasto.id)
      return next
    })
  }

  const abrirPago = () => {
    if (seleccionadas.length === 0) return
    setModoMonto("exacto")
    setMontoOtro(totalSeleccion)
    setPagarOpen(true)
  }

  // Registra el pago: marca comisiones como pagadas (mismo flujo que Caja Eventos),
  // aplicando de la más antigua a la más nueva. Solo se marcan las que el monto
  // ingresado cubre por completo; el resto queda pendiente.
  const confirmarPago = () => {
    const montoAPagar = modoMonto === "exacto" ? totalSeleccion : montoOtro
    if (!(montoAPagar > 0)) {
      toast({ title: "Monto inválido", description: "Ingresá un monto mayor a cero.", variant: "destructive" })
      return
    }
    if (montoAPagar > totalSeleccion + 0.01) {
      toast({
        title: "Monto demasiado alto",
        description: `No podés pagar más que lo seleccionado (${formatCurrency(totalSeleccion)}).`,
        variant: "destructive",
      })
      return
    }

    const orden = [...seleccionadas].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))
    let restante = montoAPagar + 0.01
    const aPagar: GastoVariable[] = []
    for (const g of orden) {
      if (restante >= g.monto) {
        aPagar.push(g)
        restante -= g.monto
      } else break
    }

    if (aPagar.length === 0) {
      toast({
        title: "Monto insuficiente",
        description: `No alcanza para cubrir la comisión más antigua (${formatCurrency(orden[0]?.monto ?? 0)}).`,
        variant: "destructive",
      })
      return
    }

    const hoy = new Date()
    const fechaCorta = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`

    for (const g of aPagar) {
      const eventoId = g.comisionDetalle?.eventoId
      if (!eventoId) continue
      updateEvento(eventoId, {
        comisionPagada: true,
        comisionPagadaFecha: fechaCorta as EventoGuardado["comisionPagadaFecha"],
      })
      fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "caja",
          accion: "comisión pagada",
          nombre: g.nombre,
          detalle: `${formatCurrency(g.monto)} (${g.comisionDetalle?.porcentaje}% de ${formatCurrency(g.comisionDetalle?.totalEvento ?? 0)}) · evento ${g.comisionDetalle?.eventoNombre}`,
        }),
      }).catch(() => {})
    }

    const totalPagado = aPagar.reduce((s, g) => s + g.monto, 0)
    toast({
      title: `Pago registrado a ${vendedor.nombre}`,
      description:
        `${aPagar.length} comisión${aPagar.length !== 1 ? "es" : ""} · ${formatCurrency(totalPagado)} en Caja Jazmines` +
        (aPagar.length < seleccionadas.length ? ` · ${seleccionadas.length - aPagar.length} quedaron pendientes` : ""),
    })

    setSeleccion(new Set())
    setPagarOpen(false)
  }

  const marcarPendiente = (gasto: GastoVariable, pagada: boolean) => {
    const eventoId = gasto.comisionDetalle?.eventoId
    if (!eventoId) return
    updateEvento(eventoId, {
      comisionPagada: pagada,
      comisionPagadaFecha: (pagada ? null : null) as EventoGuardado["comisionPagadaFecha"],
    })
    fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "caja",
        accion: "comisión marcada pendiente",
        nombre: gasto.nombre,
        detalle: `${formatCurrency(gasto.monto)} · evento ${gasto.comisionDetalle?.eventoNombre}`,
      }),
    }).catch(() => {})
    toast({ title: "Comisión pendiente", description: `${gasto.nombre} · ${formatCurrency(gasto.monto)}` })
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
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md text-xl hover:bg-muted transition-colors",
                      vendedor.emoji === em ? "bg-teal-100 ring-2 ring-teal-500" : "",
                    )}
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
      <CardContent className="space-y-3">
        {/* Pendiente por pagar (debajo del nombre, arriba de Comisiones) */}
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
          <span className="text-xs font-medium text-emerald-800">Listo para pagar</span>
          <span className="text-base font-bold tabular-nums text-emerald-700">{monto(totalListas)}</span>
        </div>

        {/* Anotación libre */}
        <div>
          <label
            htmlFor={`nota-${vendedor.id}`}
            className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <StickyNote className="h-3.5 w-3.5" />
            Anotación
          </label>
          <Textarea
            id={`nota-${vendedor.id}`}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={guardarNota}
            placeholder="Escribí una nota rápida sobre este vendedor…"
            className="min-h-[60px] resize-y text-sm"
          />
        </div>

        {/* Carpeta principal: Comisiones */}
        <details className="group rounded-lg border border-amber-200 overflow-hidden" open>
          <summary className="flex cursor-pointer list-none items-center gap-2 bg-amber-50/70 hover:bg-amber-50 px-3 py-2.5 transition-colors [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-4 w-4 text-amber-700 transition-transform group-open:rotate-180 shrink-0" />
            <Folder className="h-4 w-4 text-amber-700 shrink-0" />
            <span className="text-sm font-semibold text-amber-900 flex-1">Comisiones</span>
            <Badge className="bg-amber-600 text-white border-transparent text-[11px]">{totalComisionesCount}</Badge>
            <span className="text-sm font-bold text-amber-900 tabular-nums">{monto(totalComisionesMonto)}</span>
          </summary>
          <div className="space-y-2 p-3 bg-amber-50/20">
            {totalComisionesCount === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                {vendedor.nombre} todavía no tiene comisiones registradas.
              </p>
            ) : (
              <>
                <Subcarpeta
                  titulo="Lista para pagar"
                  color="#059669"
                  count={listas.length}
                  subtotal={totalListas}
                  oculto={oculto}
                  defaultOpen
                >
                  {listas.length > 0 && (
                    <p className="px-1 pb-1 text-xs text-muted-foreground">
                      Tocá las comisiones que vas a pagar para ir sumando el total.
                    </p>
                  )}
                  {listas.map((g) => (
                    <FilaComisionViva
                      key={g.id}
                      gasto={g}
                      oculto={oculto}
                      seleccionable
                      seleccionada={seleccion.has(g.id)}
                      onToggleSeleccion={toggleSeleccion}
                    />
                  ))}
                </Subcarpeta>
                <Subcarpeta titulo="Próximamente" color="#b45309" count={proximas.length} subtotal={totalProximas} oculto={oculto}>
                  {proximas.map((g) => (
                    <FilaComisionViva key={g.id} gasto={g} oculto={oculto} />
                  ))}
                </Subcarpeta>
                <Subcarpeta titulo="Pagadas" color="#0f766e" count={pagadasVivas.length + archivadas.length} subtotal={totalPagadas} oculto={oculto}>
                  {pagadasVivas.map((g) => (
                    <FilaComisionViva key={g.id} gasto={g} oculto={oculto} onTogglePagada={marcarPendiente} />
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

        {/* Barra de pago: aparece al seleccionar comisiones */}
        {seleccionadas.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-emerald-800">
                {seleccionadas.length} comisión{seleccionadas.length !== 1 ? "es" : ""} seleccionada
                {seleccionadas.length !== 1 ? "s" : ""}
              </p>
              <p className="text-lg font-bold tabular-nums text-emerald-700">{monto(totalSeleccion)}</p>
            </div>
            <Button onClick={abrirPago} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Wallet className="h-4 w-4" />
              Pagar
            </Button>
          </div>
        )}
      </CardContent>

      {/* Diálogo de pago: monto exacto u otro */}
      <Dialog open={pagarOpen} onOpenChange={setPagarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar comisiones a {vendedor.nombre}</DialogTitle>
            <DialogDescription>
              Seleccionaste {seleccionadas.length} comisión{seleccionadas.length !== 1 ? "es" : ""} por un total de{" "}
              <span className="font-semibold text-foreground">{formatCurrency(totalSeleccion)}</span>. ¿Vas a pagar el
              monto exacto u otro monto?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setModoMonto("exacto")
                  setMontoOtro(totalSeleccion)
                }}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  modoMonto === "exacto" ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500" : "hover:bg-muted",
                )}
              >
                <p className="text-sm font-semibold">Monto exacto</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(totalSeleccion)}</p>
              </button>
              <button
                type="button"
                onClick={() => setModoMonto("otro")}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  modoMonto === "otro" ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500" : "hover:bg-muted",
                )}
              >
                <p className="text-sm font-semibold">Otro monto</p>
                <p className="text-xs text-muted-foreground">Pago parcial</p>
              </button>
            </div>

            {modoMonto === "otro" && (
              <div>
                <label htmlFor="monto-otro" className="mb-1 block text-xs font-medium text-muted-foreground">
                  ¿Cuánto le vas a pagar?
                </label>
                <MoneyInput
                  id="monto-otro"
                  value={montoOtro}
                  onValueChange={setMontoOtro}
                  placeholder="0"
                  autoFocus
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Se pagan primero las comisiones más antiguas que el monto cubra por completo. Las que no alcancen
                  quedan pendientes.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPagarOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={confirmarPago}>
              Confirmar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

"use client"

/**
 * Evolución de gastos fijos — ventana compacta de SOLO LECTURA.
 *
 * Se genera automáticamente a partir del historial de pagos de cada gasto
 * fijo (los registros se crean solos al archivar el pago del período o al
 * registrar un monto pagado). No requiere configuración: un click y se ve
 * el timeline mes a mes con cuánto subió.
 */

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils-financieros"
import type { CostoOperativo } from "@/lib/store"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowDown, ArrowUp, TrendingUp } from "lucide-react"

// ── Helpers de meses ────────────────────────────────────────────────────────

function mesActualISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/** "2026-06" → "junio 2026" */
function nombreMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number)
  if (!y || !m) return mes
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

/** "2026-06" → "jun 26" (para el eje del gráfico) */
function mesCorto(mes: string): string {
  const [y, m] = mes.split("-").map(Number)
  if (!y || !m) return mes
  return new Date(y, m - 1, 1)
    .toLocaleDateString("es-AR", { month: "short", year: "2-digit" })
    .replace(".", "")
}

type Punto = { mes: string; monto: number }

/** Serie mes → monto de un gasto: su historial + su monto vigente como mes actual. */
function serieDeCosto(c: CostoOperativo): Punto[] {
  const map = new Map<string, number>()
  for (const r of c.historialMontos || []) map.set(r.mes, r.monto)
  const mesAct = mesActualISO()
  if (!map.has(mesAct)) map.set(mesAct, c.monto)
  return [...map.entries()]
    .map(([mes, monto]) => ({ mes, monto }))
    .sort((a, b) => a.mes.localeCompare(b.mes))
}

/** Valor de una serie en un mes: último valor conocido hasta ese mes
 *  (o el primero conocido, si el mes es anterior a todo el historial). */
function valorEnMes(serie: Punto[], mes: string): number {
  let valor = serie.length > 0 ? serie[0].monto : 0
  for (const p of serie) {
    if (p.mes <= mes) valor = p.monto
    else break
  }
  return valor
}

// ── Tooltip del gráfico ─────────────────────────────────────────────────────

function TooltipGrafico({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-popover-foreground capitalize">{label}</p>
      <p className="font-bold text-popover-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────────────

export function EvolucionGastosFijosDialog({
  open,
  onOpenChange,
  costos,
  initialCostoId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Costos operativos fijos (activos, no variables). */
  costos: CostoOperativo[]
  /** Si se abre desde un gasto puntual, arranca mostrando ese servicio. */
  initialCostoId?: string | null
}) {
  const [seleccion, setSeleccion] = useState<string>("total")

  useEffect(() => {
    if (open) setSeleccion(initialCostoId ?? "total")
  }, [open, initialCostoId])

  const series = useMemo(() => {
    const porCosto = new Map<string, Punto[]>()
    for (const c of costos) porCosto.set(c.id, serieDeCosto(c))
    return porCosto
  }, [costos])

  // Serie visible: un servicio puntual o el total (suma con arrastre de valores).
  const serieVisible = useMemo<Punto[]>(() => {
    if (seleccion !== "total") {
      return series.get(seleccion) ?? []
    }
    const meses = new Set<string>()
    for (const s of series.values()) for (const p of s) meses.add(p.mes)
    return [...meses]
      .sort((a, b) => a.localeCompare(b))
      .map((mes) => {
        let total = 0
        for (const s of series.values()) total += valorEnMes(s, mes)
        return { mes, monto: total }
      })
  }, [seleccion, series])

  // Filas del timeline: más reciente arriba, con delta vs. mes anterior.
  const filas = useMemo(() => {
    return serieVisible
      .map((p, i) => {
        const anterior = i > 0 ? serieVisible[i - 1] : null
        const deltaPesos = anterior ? p.monto - anterior.monto : null
        const deltaPct =
          anterior && anterior.monto > 0
            ? ((p.monto - anterior.monto) / anterior.monto) * 100
            : null
        return { ...p, deltaPesos, deltaPct }
      })
      .reverse()
      .slice(0, 12)
  }, [serieVisible])

  const datosGrafico = useMemo(
    () => serieVisible.map((p) => ({ ...p, label: mesCorto(p.mes) })),
    [serieVisible],
  )

  const conHistorial = serieVisible.length > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="space-y-0.5 px-4 pt-4 pb-2 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            Evolución de gastos fijos
          </DialogTitle>
          <DialogDescription className="text-xs">
            Se arma sola con cada pago que archivás o registrás.
          </DialogDescription>
        </DialogHeader>

        {/* Selector por chips: Total + cada servicio, un solo tap */}
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setSeleccion("total")}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              seleccion === "total"
                ? "border-purple-600 bg-purple-600 text-white"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Total
          </button>
          {costos.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSeleccion(c.id)}
              className={`max-w-32 shrink-0 truncate rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                seleccion === c.id
                  ? "border-purple-600 bg-purple-600 text-white"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
              title={c.concepto}
            >
              {c.concepto}
            </button>
          ))}
        </div>

        {/* Mini gráfico */}
        {conHistorial && (
          <div className="h-32 px-2" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={datosGrafico} margin={{ top: 8, right: 12, bottom: 0, left: 12 }}>
                <defs>
                  <linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9333ea" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#9333ea" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Tooltip content={<TooltipGrafico />} />
                <Area
                  type="monotone"
                  dataKey="monto"
                  stroke="#9333ea"
                  strokeWidth={2}
                  fill="url(#evoFill)"
                  dot={{ r: 3, fill: "#9333ea", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Timeline mes a mes */}
        <div className="max-h-64 overflow-y-auto px-4 pb-4 pt-2">
          {!conHistorial ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground text-pretty">
                Todavía no hay historial suficiente. Se genera automáticamente cuando
                archivás el pago del mes o registrás un monto pagado.
              </p>
            </div>
          ) : (
            <ol className="relative ml-1.5 border-l border-border">
              {filas.map((f) => {
                const subio = (f.deltaPesos ?? 0) > 0
                return (
                  <li key={f.mes} className="relative pb-3 pl-4 last:pb-0">
                    <span
                      className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-purple-600 ring-2 ring-background"
                      aria-hidden="true"
                    />
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs capitalize text-muted-foreground">{nombreMes(f.mes)}</span>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(f.monto)}</span>
                    </div>
                    {f.deltaPesos !== null && f.deltaPesos !== 0 && (
                      <p
                        className={`mt-0.5 flex items-center justify-end gap-1 text-xs font-medium ${
                          subio ? "text-red-600" : "text-teal-600"
                        }`}
                      >
                        {subio ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {f.deltaPct !== null ? `${subio ? "+" : ""}${f.deltaPct.toFixed(1)}%` : ""}
                        <span className="font-normal text-muted-foreground">
                          ({subio ? "+" : "−"}
                          {formatCurrency(Math.abs(f.deltaPesos))})
                        </span>
                        <span className="sr-only">
                          {subio ? "subió" : "bajó"} respecto al mes anterior
                        </span>
                      </p>
                    )}
                    {f.deltaPesos === 0 && (
                      <p className="mt-0.5 text-right text-xs text-muted-foreground">sin cambios</p>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

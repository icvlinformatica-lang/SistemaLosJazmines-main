"use client"

/**
 * Evolución de gastos fijos — ventana compacta de SOLO LECTURA,
 * con un modo opcional de CARGA HISTÓRICA 2026.
 *
 * La vista se genera automáticamente a partir del historial de pagos de cada
 * gasto fijo. Además, al elegir un servicio se puede tocar "Carga histórica"
 * para completar de una sola vez los montos de enero 2026 hasta hoy.
 */

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/ui/money-input"
import { formatCurrency } from "@/lib/utils-financieros"
import { generateId, type CostoOperativo, type RegistroMonto } from "@/lib/store"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowDown, ArrowUp, CalendarClock, TrendingUp } from "lucide-react"

// ── Helpers de meses ────────────────────────────────────────────────────────

function mesActualISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/** Meses de 2026 desde enero hasta el mes actual inclusive (["2026-01", ...]). */
function meses2026HastaHoy(): string[] {
  const hasta = mesActualISO()
  const meses: string[] = []
  for (let m = 1; m <= 12; m++) {
    const mes = `2026-${String(m).padStart(2, "0")}`
    if (mes > hasta) break
    meses.push(mes)
  }
  return meses
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
  updateCostoOperativo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Costos operativos fijos (activos, no variables). */
  costos: CostoOperativo[]
  /** Si se abre desde un gasto puntual, arranca mostrando ese servicio. */
  initialCostoId?: string | null
  /** Para persistir la carga histórica de montos. */
  updateCostoOperativo: (id: string, cambios: Partial<CostoOperativo>) => void
}) {
  const [seleccion, setSeleccion] = useState<string>("total")

  // ── Modo carga histórica (solo con un servicio elegido) ──────────────────
  const [modoCarga, setModoCarga] = useState(false)
  const [borrador, setBorrador] = useState<Record<string, number>>({})

  const costoSeleccionado = seleccion !== "total" ? costos.find((c) => c.id === seleccion) : undefined
  const mesesCarga = useMemo(() => meses2026HastaHoy(), [])

  useEffect(() => {
    if (open) {
      setSeleccion(initialCostoId ?? "total")
      setModoCarga(false)
    }
  }, [open, initialCostoId])

  // Al cambiar de servicio se sale del modo carga para no mezclar borradores.
  useEffect(() => {
    setModoCarga(false)
  }, [seleccion])

  function iniciarCarga() {
    if (!costoSeleccionado) return
    const previo: Record<string, number> = {}
    for (const r of costoSeleccionado.historialMontos || []) {
      if (mesesCarga.includes(r.mes)) previo[r.mes] = r.monto
    }
    // El mes actual arranca con el monto vigente si no tiene registro propio.
    const mesAct = mesActualISO()
    if (previo[mesAct] === undefined && mesesCarga.includes(mesAct)) {
      previo[mesAct] = costoSeleccionado.monto
    }
    setBorrador(previo)
    setModoCarga(true)
  }

  function guardarCarga() {
    if (!costoSeleccionado) return
    const existentes = costoSeleccionado.historialMontos || []
    // Conserva registros fuera del rango de carga (otros años/meses futuros).
    const fueraDeRango = existentes.filter((r) => !mesesCarga.includes(r.mes))
    const idPorMes = new Map(existentes.map((r) => [r.mes, r.id]))

    const nuevos: RegistroMonto[] = []
    let anterior: number | null = null
    for (const mes of mesesCarga) {
      const monto = borrador[mes]
      if (monto === undefined || monto <= 0) continue
      nuevos.push({
        id: idPorMes.get(mes) ?? generateId(),
        mes,
        monto,
        montoAnterior: anterior ?? monto,
        fecha: new Date().toISOString(),
        nota: "Carga histórica",
      })
      anterior = monto
    }

    const historial = [...fueraDeRango, ...nuevos].sort((a, b) => a.mes.localeCompare(b.mes))
    const ultimo = historial.length > 0 ? historial[historial.length - 1] : null
    updateCostoOperativo(costoSeleccionado.id, {
      historialMontos: historial,
      // El último monto cargado pasa a ser la referencia vigente del gasto.
      ...(ultimo ? { monto: ultimo.monto } : {}),
    })
    setModoCarga(false)
  }

  const hayAlgoCargado = Object.values(borrador).some((v) => v > 0)

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
            {modoCarga && costoSeleccionado
              ? `Completá cuánto pagaste de ${costoSeleccionado.concepto} cada mes de 2026.`
              : "Se arma sola con cada pago que archivás o registrás."}
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

        {modoCarga && costoSeleccionado ? (
          <>
            {/* ── Formulario de carga histórica: enero 2026 → hoy ─────────── */}
            <div className="max-h-72 overflow-y-auto px-4 pt-1">
              <div className="flex flex-col gap-2">
                {mesesCarga.map((mes) => (
                  <div key={mes} className="flex items-center gap-3">
                    <label
                      htmlFor={`carga-${mes}`}
                      className="w-28 shrink-0 text-xs capitalize text-muted-foreground"
                    >
                      {nombreMes(mes)}
                    </label>
                    <MoneyInput
                      id={`carga-${mes}`}
                      className="h-8 text-sm"
                      placeholder="Sin dato"
                      value={borrador[mes] ?? 0}
                      onValueChange={(v) =>
                        setBorrador((prev) => ({ ...prev, [mes]: v }))
                      }
                      aria-label={`Monto pagado en ${nombreMes(mes)}`}
                    />
                  </div>
                ))}
              </div>
              <p className="pt-2 text-xs text-muted-foreground text-pretty">
                Los meses sin dato quedan fuera del historial. El último monto cargado pasa a
                ser la referencia vigente del gasto.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3">
              <Button variant="ghost" size="sm" onClick={() => setModoCarga(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-purple-600 text-white hover:bg-purple-700"
                disabled={!hayAlgoCargado}
                onClick={guardarCarga}
              >
                Guardar historial
              </Button>
            </div>
          </>
        ) : (
          <>
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
            <div className="max-h-64 overflow-y-auto px-4 pb-2 pt-2">
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

            {/* Acceso a la carga histórica: solo con un servicio elegido */}
            {costoSeleccionado && (
              <div className="border-t border-border px-4 py-2.5">
                <button
                  type="button"
                  onClick={iniciarCarga}
                  className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  Carga histórica 2026 (enero a hoy)
                </button>
              </div>
            )}
            {!costoSeleccionado && (
              <div className="border-t border-border px-4 py-2.5">
                <p className="text-center text-xs text-muted-foreground">
                  Elegí un servicio para hacer su carga histórica 2026.
                </p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

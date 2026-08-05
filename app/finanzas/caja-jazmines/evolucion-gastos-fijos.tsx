"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MoneyInput } from "@/components/ui/money-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils-financieros"
import { generateId, type CostoOperativo, type RegistroMonto } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Minus, TrendingUp } from "lucide-react"

// ---------------------------------------------------------------------------
// Helpers de meses
// ---------------------------------------------------------------------------

/** Mes actual en formato YYYY-MM. */
function mesActualISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/** Suma (o resta) meses a un YYYY-MM. */
function sumarMeses(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
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

/** Lista de N meses consecutivos terminando en `fin` (ascendente). */
function ventanaMeses(fin: string, cantidad: number): string[] {
  return Array.from({ length: cantidad }, (_, i) => sumarMeses(fin, i - (cantidad - 1)))
}

function variacionPct(anterior: number, actual: number): number | null {
  if (!anterior || anterior <= 0) return null
  return ((actual - anterior) / anterior) * 100
}

// ---------------------------------------------------------------------------
// Piezas de UI
// ---------------------------------------------------------------------------

function ChipDelta({ pct, monto }: { pct: number | null; monto?: number }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />
        primer registro
      </span>
    )
  }
  if (Math.abs(pct) < 0.05) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />
        igual
      </span>
    )
  }
  const subio = pct > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        subio ? "bg-red-100 text-red-700" : "bg-teal-100 text-teal-700"
      }`}
    >
      {subio ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      {subio ? "+" : "−"}
      {Math.abs(pct).toFixed(1)}%
      {monto !== undefined && Math.abs(monto) > 0 ? ` (${subio ? "+" : "−"}${formatCurrency(Math.abs(monto))})` : ""}
    </span>
  )
}

/** Tooltip del gráfico. */
function TooltipGrafico({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-popover-foreground capitalize">{label}</p>
      <p className="font-bold text-popover-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

function GraficoEvolucion({ datos }: { datos: { mes: string; label: string; monto: number }[] }) {
  if (datos.length < 2) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
        Cargá al menos 2 meses para ver la curva de evolución
      </div>
    )
  }
  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<TooltipGrafico />} />
          <Line
            type="monotone"
            dataKey="monto"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Diálogo principal
// ---------------------------------------------------------------------------

const MESES_VENTANA = 6

export function EvolucionGastosFijosDialog({
  open,
  onOpenChange,
  costos,
  updateCostoOperativo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Costos operativos fijos (activos, no variables), sin prorrateo. */
  costos: CostoOperativo[]
  updateCostoOperativo: (id: string, cambios: Partial<CostoOperativo>) => void
}) {
  const { toast } = useToast()
  const [vista, setVista] = useState<"servicio" | "total">("servicio")
  const [costoId, setCostoId] = useState<string>("")
  // Fin de la ventana de meses visible (por defecto: mes actual)
  const [finVentana, setFinVentana] = useState(mesActualISO)
  // Borradores de montos por mes para el servicio seleccionado: { "2026-06": "150000" }
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const costoSel = costos.find((c) => c.id === costoId) || null
  const meses = ventanaMeses(finVentana, MESES_VENTANA)

  // Valores ya guardados por mes del servicio seleccionado
  const guardados = useMemo(() => {
    const map = new Map<string, RegistroMonto>()
    for (const r of costoSel?.historialMontos || []) map.set(r.mes, r)
    return map
  }, [costoSel])

  /** Valor efectivo (borrador si existe, si no el guardado) de un mes. */
  function valorDe(mes: string): number | null {
    if (mes in drafts) {
      const n = Number(drafts[mes])
      return n > 0 ? n : null
    }
    const g = guardados.get(mes)
    return g ? g.monto : null
  }

  const hayCambios = Object.keys(drafts).some((mes) => {
    const guardado = guardados.get(mes)?.monto ?? null
    const draft = Number(drafts[mes]) > 0 ? Number(drafts[mes]) : null
    return draft !== guardado
  })

  // Serie completa para el gráfico (historial + borradores, orden cronológico)
  const serie = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of costoSel?.historialMontos || []) map.set(r.mes, r.monto)
    for (const [mes, v] of Object.entries(drafts)) {
      const n = Number(v)
      if (n > 0) map.set(mes, n)
      else map.delete(mes)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, monto]) => ({ mes, label: mesCorto(mes), monto }))
  }, [costoSel, drafts])

  // Resumen acumulado del servicio: primer vs último registro
  const resumen = useMemo(() => {
    if (serie.length < 2) return null
    const primero = serie[0]
    const ultimo = serie[serie.length - 1]
    const pct = variacionPct(primero.monto, ultimo.monto)
    return { primero, ultimo, pct, diff: ultimo.monto - primero.monto }
  }, [serie])

  // Totales mensuales de todos los gastos fijos (vista "total")
  const serieTotal = useMemo(() => {
    const map = new Map<string, { total: number; cuenta: number }>()
    for (const c of costos) {
      for (const r of c.historialMontos || []) {
        const e = map.get(r.mes) || { total: 0, cuenta: 0 }
        e.total += r.monto
        e.cuenta += 1
        map.set(r.mes, e)
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, { total, cuenta }]) => ({ mes, label: mesCorto(mes), monto: total, cuenta }))
  }, [costos])

  function seleccionarCosto(id: string) {
    setCostoId(id)
    setDrafts({})
  }

  function guardarCambios() {
    if (!costoSel || !hayCambios) return
    // 1. Partir del historial existente y aplicar upserts/bajas de los borradores
    const porMes = new Map<string, RegistroMonto>()
    for (const r of costoSel.historialMontos || []) porMes.set(r.mes, { ...r })
    for (const [mes, v] of Object.entries(drafts)) {
      const n = Number(v)
      if (n > 0) {
        const existente = porMes.get(mes)
        porMes.set(mes, {
          id: existente?.id ?? generateId(),
          mes,
          monto: n,
          montoAnterior: existente?.montoAnterior ?? 0, // se recalcula abajo
          fecha: new Date().toISOString(),
          nota: existente?.nota,
        })
      } else {
        porMes.delete(mes)
      }
    }
    // 2. Recalcular la cadena de montoAnterior en orden cronológico
    const ordenado = Array.from(porMes.values()).sort((a, b) => a.mes.localeCompare(b.mes))
    for (let i = 0; i < ordenado.length; i++) {
      ordenado[i] = { ...ordenado[i], montoAnterior: i === 0 ? 0 : ordenado[i - 1].monto }
    }
    // 3. El monto base pasa a ser el del último mes registrado
    const nuevaBase = ordenado.length > 0 ? ordenado[ordenado.length - 1].monto : costoSel.monto
    updateCostoOperativo(costoSel.id, { monto: nuevaBase, historialMontos: ordenado })
    setDrafts({})
    toast({
      title: "Historial actualizado",
      description: `${costoSel.concepto} · ${ordenado.length} ${ordenado.length === 1 ? "mes registrado" : "meses registrados"}. Monto de referencia: ${formatCurrency(nuevaBase)}.`,
    })
  }

  const mesActual = mesActualISO()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            Evolución de gastos fijos
          </DialogTitle>
          <DialogDescription>
            Cargá cuánto pagaste cada mes y mirá cómo fue subiendo. Podés completar meses
            pasados y corregir valores cuando quieras.
          </DialogDescription>
        </DialogHeader>

        {/* Selector de vista */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
          <button
            type="button"
            className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              vista === "servicio" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
            onClick={() => setVista("servicio")}
          >
            Por servicio
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              vista === "total" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
            onClick={() => setVista("total")}
          >
            Total mensual
          </button>
        </div>

        {vista === "servicio" && (
          <div className="space-y-4">
            {/* Selector de servicio */}
            <Select value={costoId} onValueChange={seleccionarCosto}>
              <SelectTrigger aria-label="Elegir gasto fijo">
                <SelectValue placeholder="Elegí un gasto fijo (ej. Luz, Alquiler…)" />
              </SelectTrigger>
              <SelectContent>
                {costos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.concepto} · {formatCurrency(c.monto)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!costoSel ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Elegí un servicio arriba para cargar sus montos mes a mes.
              </p>
            ) : (
              <>
                {/* Gráfico + resumen */}
                <GraficoEvolucion datos={serie} />
                {resumen && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      De <span className="capitalize">{nombreMes(resumen.primero.mes)}</span> a{" "}
                      <span className="capitalize">{nombreMes(resumen.ultimo.mes)}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      {formatCurrency(resumen.primero.monto)} → {formatCurrency(resumen.ultimo.monto)}
                      <ChipDelta pct={resumen.pct} />
                    </span>
                  </div>
                )}

                {/* Navegación de meses */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Montos por mes
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setFinVentana((f) => sumarMeses(f, -MESES_VENTANA))}
                      aria-label="Meses anteriores"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[110px] text-center text-xs font-medium capitalize">
                      {mesCorto(meses[0])} – {mesCorto(meses[meses.length - 1])}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setFinVentana((f) => sumarMeses(f, MESES_VENTANA))}
                      aria-label="Meses siguientes"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Timeline editable */}
                <div className="relative space-y-0">
                  {meses.map((mes, i) => {
                    const valor = valorDe(mes)
                    const idxSerie = serie.findIndex((s) => s.mes === mes)
                    const anterior = idxSerie > 0 ? serie[idxSerie - 1].monto : null
                    const pct = valor !== null && anterior !== null ? variacionPct(anterior, valor) : null
                    const esActual = mes === mesActual
                    const editado =
                      mes in drafts &&
                      (Number(drafts[mes]) > 0 ? Number(drafts[mes]) : null) !== (guardados.get(mes)?.monto ?? null)
                    return (
                      <div key={mes} className="relative flex gap-3 pb-3">
                        {/* línea vertical + punto */}
                        <div className="flex flex-col items-center pt-2.5">
                          <span
                            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                              valor !== null ? "bg-purple-500" : "border-2 border-muted-foreground/40 bg-transparent"
                            }`}
                            aria-hidden="true"
                          />
                          {i < meses.length - 1 && <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm capitalize ${esActual ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                              {nombreMes(mes)}
                              {esActual && (
                                <span className="ml-1.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                                  este mes
                                </span>
                              )}
                            </p>
                            {valor !== null && idxSerie > 0 && (
                              <ChipDelta pct={pct} monto={anterior !== null ? valor - anterior : undefined} />
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <MoneyInput
                              value={valor ?? 0}
                              onValueChange={(v) =>
                                setDrafts((p) => ({ ...p, [mes]: v ? String(v) : "" }))
                              }
                              placeholder="¿Cuánto pagaste?"
                              aria-label={`Monto pagado en ${nombreMes(mes)}`}
                              className={`h-9 ${editado ? "border-purple-400 ring-1 ring-purple-300" : ""}`}
                            />
                          </div>
                          {valor === null && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">Sin registro · completalo cuando llegue la boleta</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <Button
                  className="w-full bg-purple-600 text-white hover:bg-purple-700"
                  disabled={!hayCambios}
                  onClick={guardarCambios}
                >
                  {hayCambios ? "Guardar cambios" : "Sin cambios por guardar"}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center text-pretty">
                  Al guardar, el último mes cargado pasa a ser el monto de referencia del gasto.
                </p>
              </>
            )}
          </div>
        )}

        {vista === "total" && (
          <div className="space-y-4">
            <GraficoEvolucion datos={serieTotal} />
            {serieTotal.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Todavía no cargaste montos. Andá a &quot;Por servicio&quot; y anotá cuánto pagaste cada mes.
              </p>
            ) : (
              <div className="space-y-1.5">
                {[...serieTotal].reverse().map((fila, i, arr) => {
                  const anterior = arr[i + 1] // reverse: el siguiente en el array es el mes previo
                  const pct = anterior ? variacionPct(anterior.monto, fila.monto) : null
                  return (
                    <div
                      key={fila.mes}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize">{nombreMes(fila.mes)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {fila.cuenta} {fila.cuenta === 1 ? "gasto registrado" : "gastos registrados"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-bold">{formatCurrency(fila.monto)}</span>
                        {anterior && <ChipDelta pct={pct} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground text-center text-pretty">
              El total de cada mes suma solo los gastos que tienen monto cargado ese mes.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

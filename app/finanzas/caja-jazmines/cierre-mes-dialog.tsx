"use client"

/**
 * Cierre de mes en un paso.
 *
 * Reemplaza la carga de montos de a uno (⋯ → "Cargar nuevo monto") por una
 * revisión en lote: el panel arma la lista de gastos fijos que todavía no
 * tienen monto cargado para el mes elegido, precarga el monto vigente (la
 * proyección por tendencia está desactivada, ver SUGERIDO_ACTIVO) y deja
 * confirmar todo junto. Solo hay que tocar los que cambiaron.
 *
 * La solapa "Variables" ofrece los gastos variables que suelen repetirse
 * (mismo concepto en meses anteriores) para agendar el mes entero de una vez.
 */

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { formatCurrency } from "@/lib/utils-financieros"
import { generateId, salonLabel, type CostoOperativo, type RegistroMonto } from "@/lib/store"
import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Equal,
  TriangleAlert,
} from "lucide-react"

// ── Helpers de meses ────────────────────────────────────────────────────────

function mesActualISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/** Corre un mes YYYY-MM la cantidad de meses indicada (puede ser negativa). */
function correrMes(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number)
  if (!y || !m) return mes
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** "2026-08" → "agosto 2026" */
function nombreMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number)
  if (!y || !m) return mes
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

/** Último día de un mes YYYY-MM. */
function ultimoDiaDeMes(mes: string): number {
  const [y, m] = mes.split("-").map(Number)
  if (!y || !m) return 28
  return new Date(y, m, 0).getDate()
}

/**
 * Tendencia de un gasto: promedio de sus últimos 3 aumentos reales registrados
 * en el historial. Es la misma regla que usa la tarjeta de estimación mensual.
 */
function tendenciaDeCosto(c: CostoOperativo): number {
  const hist = (c.historialMontos || []).slice().sort((a, b) => a.mes.localeCompare(b.mes))
  const cambios: number[] = []
  for (let i = 1; i < hist.length; i++) {
    const prev = hist[i - 1].monto
    if (prev > 0 && hist[i].monto !== prev) cambios.push((hist[i].monto - prev) / prev)
  }
  const ultimos = cambios.slice(-3)
  if (ultimos.length === 0) return 0
  return ultimos.reduce((s, x) => s + x, 0) / ultimos.length
}

/**
 * Sugerido por tendencia: DESACTIVADO temporalmente a pedido del usuario
 * (misma decisión que en la tira de meses). Cambiar a true para volver a
 * precargar el cierre con la proyección en lugar del monto vigente.
 */
const SUGERIDO_ACTIVO = false

/** Monto sugerido para el mes: monto vigente proyectado por su tendencia. */
function montoSugerido(c: CostoOperativo): number {
  if (!SUGERIDO_ACTIVO) return c.monto
  const t = tendenciaDeCosto(c)
  return t === 0 ? c.monto : Math.round(c.monto * (1 + t))
}

/** Clave para agrupar gastos variables que se repiten mes a mes. */
function claveConcepto(concepto: string): string {
  return concepto.trim().toLowerCase()
}

type FilaVariable = {
  clave: string
  concepto: string
  salon: string | null | undefined
  distribucion?: CostoOperativo["distribucion"]
  monto: number
  dia: number
  /** Cantidad de meses distintos en los que apareció este concepto. */
  vecesAgendado: number
}

// ── Componente principal ────────────────────────────────────────────────────

export function CierreMesDialog({
  open,
  onOpenChange,
  costos,
  updateCostoOperativo,
  addCostoOperativo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Todos los costos operativos del store (fijos y variables). */
  costos: CostoOperativo[]
  updateCostoOperativo: (id: string, cambios: Partial<CostoOperativo>) => void
  addCostoOperativo: (costo: Omit<CostoOperativo, "id">) => void
}) {
  const [mes, setMes] = useState(mesActualISO)
  const [solapa, setSolapa] = useState<"fijos" | "variables">("fijos")

  // Monto a confirmar por gasto fijo y qué filas entran en el cierre.
  const [montos, setMontos] = useState<Record<string, number>>({})
  const [omitidos, setOmitidos] = useState<Record<string, boolean>>({})

  // Gastos variables recurrentes a agendar (monto y día editables).
  const [varsForm, setVarsForm] = useState<Record<string, { monto: number; dia: number }>>({})
  const [varsElegidos, setVarsElegidos] = useState<Record<string, boolean>>({})

  const fijos = useMemo(
    () => costos.filter((c) => c.activo && !c.esVariable),
    [costos],
  )

  /** Gastos fijos que corresponden al mes elegido (mensuales + anuales que vencen ahí). */
  const delMes = useMemo(() => {
    const mm = mes.slice(5, 7)
    return fijos.filter((c) => {
      if (c.frecuencia === "Mensual") return true
      if (c.frecuencia === "Anual") return c.fechaVencimiento?.slice(5, 7) === mm
      return false
    })
  }, [fijos, mes])

  const yaCargados = useMemo(
    () => delMes.filter((c) => (c.historialMontos || []).some((r) => r.mes === mes)),
    [delMes, mes],
  )
  const pendientes = useMemo(
    () => delMes.filter((c) => !(c.historialMontos || []).some((r) => r.mes === mes)),
    [delMes, mes],
  )

  // Al abrir (o cambiar de mes) se precargan los montos sugeridos y se
  // seleccionan todas las filas pendientes.
  useEffect(() => {
    if (!open) return
    const base: Record<string, number> = {}
    for (const c of pendientes) base[c.id] = montoSugerido(c)
    setMontos(base)
    setOmitidos({})
  }, [open, mes]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Conceptos variables que se repiten y todavía no están agendados en el mes. */
  const variablesRecurrentes = useMemo(() => {
    const porClave = new Map<string, { costos: CostoOperativo[]; meses: Set<string> }>()
    for (const c of costos) {
      if (!c.esVariable || !c.fechaVencimiento) continue
      const clave = claveConcepto(c.concepto)
      const entry = porClave.get(clave) || { costos: [], meses: new Set<string>() }
      entry.costos.push(c)
      entry.meses.add(c.fechaVencimiento.slice(0, 7))
      porClave.set(clave, entry)
    }
    const filas: FilaVariable[] = []
    for (const [clave, entry] of porClave) {
      // Ya agendado en el mes elegido → no hace falta ofrecerlo.
      if (entry.meses.has(mes)) continue
      // Solo tiene sentido ofrecer lo que se repite o lo del mes anterior.
      const previos = [...entry.meses].filter((m) => m < mes)
      if (previos.length === 0) continue
      if (entry.meses.size < 2 && !previos.includes(correrMes(mes, -1))) continue
      const ultimo = entry.costos
        .slice()
        .sort((a, b) => (a.fechaVencimiento || "").localeCompare(b.fechaVencimiento || ""))
        .pop()!
      filas.push({
        clave,
        concepto: ultimo.concepto,
        salon: ultimo.salon,
        distribucion: ultimo.distribucion,
        monto: ultimo.monto,
        dia: Number(ultimo.fechaVencimiento!.slice(8, 10)) || 1,
        vecesAgendado: entry.meses.size,
      })
    }
    return filas.sort((a, b) => b.vecesAgendado - a.vecesAgendado || b.monto - a.monto)
  }, [costos, mes])

  useEffect(() => {
    if (!open) return
    const form: Record<string, { monto: number; dia: number }> = {}
    for (const f of variablesRecurrentes) form[f.clave] = { monto: f.monto, dia: f.dia }
    setVarsForm(form)
    setVarsElegidos({})
  }, [open, mes]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Acciones ─────────────────────────────────────────────────────────────

  const aConfirmar = pendientes.filter((c) => !omitidos[c.id] && (montos[c.id] ?? 0) > 0)
  const totalConfirmar = aConfirmar.reduce((s, c) => s + (montos[c.id] ?? 0), 0)
  const totalYaCargado = yaCargados.reduce((s, c) => s + c.monto, 0)

  /**
   * Aplica un monto nuevo a un gasto fijo con la misma regla que la carga
   * individual: si el monto vigente no estaba pagado, el período anterior
   * queda marcado como deuda y el gasto arranca el mes nuevo como pendiente.
   */
  function aplicarMonto(c: CostoOperativo, monto: number) {
    let historial = [...(c.historialMontos || [])]
    if (!c.pagado) {
      if (historial.length > 0) {
        historial = historial.map((r, i) =>
          i === historial.length - 1 ? { ...r, pagado: false } : r,
        )
      } else {
        historial.push({
          id: generateId(),
          mes: correrMes(mes, -1),
          monto: c.monto,
          montoAnterior: c.monto,
          fecha: new Date().toISOString(),
          nota: "Quedó pendiente al cargar el monto siguiente",
          pagado: false,
        })
      }
    }
    const registro: RegistroMonto = {
      id: generateId(),
      mes,
      monto,
      montoAnterior: c.monto,
      fecha: new Date().toISOString(),
      nota: "Cierre de mes",
    }
    updateCostoOperativo(c.id, {
      monto,
      pagado: false,
      ...(c.distribucion && c.distribucion.length > 0
        ? { distribucion: c.distribucion.map((d) => ({ ...d, pagado: false })) }
        : {}),
      historialMontos: [...historial, registro],
    })
  }

  function confirmarCierre() {
    for (const c of aConfirmar) aplicarMonto(c, montos[c.id])
    if (aConfirmar.length === pendientes.length) onOpenChange(false)
  }

  function agendarVariables() {
    for (const f of variablesRecurrentes) {
      if (!varsElegidos[f.clave]) continue
      const form = varsForm[f.clave]
      if (!form || form.monto <= 0) continue
      const dia = Math.min(Math.max(1, form.dia), ultimoDiaDeMes(mes))
      const dist = (f.distribucion || []).filter((d) => d && d.salon && d.porcentaje > 0)
      addCostoOperativo({
        concepto: f.concepto,
        tipo: "Gastos Generales" as CostoOperativo["tipo"],
        monto: form.monto,
        frecuencia: "Por Evento",
        esPorPersona: false,
        salon: dist.length > 0 ? null : (f.salon ?? null),
        activo: true,
        fechaVencimiento: `${mes}-${String(dia).padStart(2, "0")}`,
        esVariable: true,
        pagado: false,
        distribucion: dist.length > 0 ? dist.map((d) => ({ ...d, pagado: false })) : undefined,
      })
    }
    setVarsElegidos({})
  }

  const elegidosVariables = variablesRecurrentes.filter((f) => varsElegidos[f.clave])
  const totalVariables = elegidosVariables.reduce(
    (s, f) => s + (varsForm[f.clave]?.monto ?? 0),
    0,
  )
  const progreso = delMes.length > 0 ? Math.round((yaCargados.length / delMes.length) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 capitalize">
            <CalendarCheck className="h-4 w-4 text-purple-600" />
            {`Cerrar ${nombreMes(mes)}`}
          </DialogTitle>
          <DialogDescription>
            Los montos vienen precargados con el valor vigente de cada servicio. Corregí solo los
            que llegaron distinto y confirmá todo junto.
          </DialogDescription>
        </DialogHeader>

        {/* Mes + progreso de carga */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setMes(correrMes(mes, -1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-32 text-center text-sm font-semibold capitalize">
              {nombreMes(mes)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setMes(correrMes(mes, 1))}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 min-w-40">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{`${yaCargados.length} de ${delMes.length} cargados`}</span>
              <span>{`${progreso}%`}</span>
            </div>
            <div
              className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuenow={progreso}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-purple-600" style={{ width: `${progreso}%` }} />
            </div>
          </div>
        </div>

        {/* Solapas */}
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setSolapa("fijos")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              solapa === "fijos"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {`Fijos (${pendientes.length})`}
          </button>
          <button
            type="button"
            onClick={() => setSolapa("variables")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              solapa === "variables"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {`Variables que se repiten (${variablesRecurrentes.length})`}
          </button>
        </div>

        {solapa === "fijos" ? (
          <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {pendientes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {`Todos los gastos fijos de ${nombreMes(mes)} ya tienen su monto cargado.`}
              </p>
            ) : (
              pendientes.map((c) => {
                const valor = montos[c.id] ?? 0
                const dif = c.monto > 0 ? ((valor - c.monto) / c.monto) * 100 : 0
                const omitido = !!omitidos[c.id]
                const sugerido = montoSugerido(c)
                return (
                  <div
                    key={c.id}
                    className={`flex flex-wrap items-center gap-2 rounded-lg border border-border px-2.5 py-2 ${
                      omitido ? "opacity-50" : ""
                    }`}
                  >
                    <Checkbox
                      checked={!omitido}
                      onCheckedChange={(v) =>
                        setOmitidos((prev) => ({ ...prev, [c.id]: v !== true }))
                      }
                      aria-label={`Incluir ${c.concepto} en el cierre`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.concepto}</p>
                      <p className="text-xs text-muted-foreground">
                        {`Vigente ${formatCurrency(c.monto)}`}
                        {c.salon ? ` · ${salonLabel(c.salon)}` : ""}
                        {c.frecuencia === "Anual" ? " · anual" : ""}
                      </p>
                      {!c.pagado && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-600">
                          <TriangleAlert className="h-3 w-3 shrink-0" />
                          El período anterior queda como deuda
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MoneyInput
                        value={valor}
                        onValueChange={(n) => setMontos((prev) => ({ ...prev, [c.id]: n }))}
                        className="h-8 w-28 text-right text-sm"
                        placeholder="0"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        title={`Usar el mismo monto (${formatCurrency(c.monto)})`}
                        onClick={() => setMontos((prev) => ({ ...prev, [c.id]: c.monto }))}
                      >
                        <Equal className="h-3.5 w-3.5" />
                        <span className="sr-only">Usar el mismo monto</span>
                      </Button>
                      <span
                        className={`w-16 text-right text-xs font-semibold tabular-nums ${
                          dif > 0 ? "text-red-600" : dif < 0 ? "text-emerald-600" : "text-muted-foreground"
                        }`}
                      >
                        {dif === 0 ? (
                          "sin cambio"
                        ) : (
                          <span className="flex items-center justify-end gap-0.5">
                            {dif > 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                            {`${Math.abs(Math.round(dif * 10) / 10)}%`}
                          </span>
                        )}
                      </span>
                    </div>
                    {valor !== sugerido && sugerido !== c.monto && (
                      <button
                        type="button"
                        className="text-xs text-purple-600 underline underline-offset-2"
                        onClick={() => setMontos((prev) => ({ ...prev, [c.id]: sugerido }))}
                      >
                        {`Sugerido ${formatCurrency(sugerido)}`}
                      </button>
                    )}
                  </div>
                )
              })
            )}
            {yaCargados.length > 0 && (
              <div className="mt-2 rounded-lg border border-emerald-600/40 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <p className="flex items-center gap-1 font-semibold">
                  <Check className="h-3.5 w-3.5" />
                  {`${yaCargados.length} ya cargados · ${formatCurrency(totalYaCargado)}`}
                </p>
                <p className="mt-0.5 line-clamp-2">
                  {yaCargados.map((c) => c.concepto).join(", ")}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {variablesRecurrentes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay gastos variables de meses anteriores para repetir en este mes.
              </p>
            ) : (
              variablesRecurrentes.map((f) => {
                const form = varsForm[f.clave] ?? { monto: f.monto, dia: f.dia }
                const elegido = !!varsElegidos[f.clave]
                return (
                  <div
                    key={f.clave}
                    className={`flex flex-wrap items-center gap-2 rounded-lg border border-border px-2.5 py-2 ${
                      elegido ? "border-purple-600 bg-purple-50/50" : ""
                    }`}
                  >
                    <Checkbox
                      checked={elegido}
                      onCheckedChange={(v) =>
                        setVarsElegidos((prev) => ({ ...prev, [f.clave]: v === true }))
                      }
                      aria-label={`Agendar ${f.concepto}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.concepto}</p>
                      <p className="text-xs text-muted-foreground">
                        {`Agendado en ${f.vecesAgendado} ${f.vecesAgendado === 1 ? "mes" : "meses"}`}
                        {f.salon ? ` · ${salonLabel(f.salon)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        Día
                        <Input
                          type="number"
                          min={1}
                          max={ultimoDiaDeMes(mes)}
                          value={form.dia}
                          onChange={(e) =>
                            setVarsForm((prev) => ({
                              ...prev,
                              [f.clave]: { ...form, dia: Number(e.target.value) || 1 },
                            }))
                          }
                          className="h-8 w-14 text-center text-sm"
                        />
                      </label>
                      <MoneyInput
                        value={form.monto}
                        onValueChange={(n) =>
                          setVarsForm((prev) => ({ ...prev, [f.clave]: { ...form, monto: n } }))
                        }
                        className="h-8 w-28 text-right text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {solapa === "fijos"
              ? `${aConfirmar.length} de ${pendientes.length} seleccionados · ${formatCurrency(totalConfirmar)}`
              : `${elegidosVariables.length} seleccionados · ${formatCurrency(totalVariables)}`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            {solapa === "fijos" ? (
              <Button
                onClick={confirmarCierre}
                disabled={aConfirmar.length === 0}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                {`Confirmar ${aConfirmar.length} monto${aConfirmar.length === 1 ? "" : "s"}`}
              </Button>
            ) : (
              <Button
                onClick={agendarVariables}
                disabled={elegidosVariables.length === 0}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                {`Agendar ${elegidosVariables.length}`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

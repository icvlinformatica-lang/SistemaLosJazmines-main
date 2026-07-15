"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { formatCurrency } from "@/lib/utils-financieros"
import { useStore } from "@/lib/store-context"
import { useClock } from "@/lib/clock-context"
import { useToast } from "@/hooks/use-toast"
import { construirCobroCuota } from "@/lib/cobrar-cuota"
import { SALONES, salonLabel, type EventoGuardado, type DistribucionSalon } from "@/lib/store"
import { useCajaJazmines } from "@/lib/hooks/use-caja-jazmines"
import type { EstadoAlerta, GastoFijoMes, CuotaPorCobrar } from "@/lib/hooks/use-caja-jazmines"
import {
  Building,
  TrendingDown,
  TrendingUp,
  Wallet,
  AlertCircle,
  Plus,
  Pencil,
  Calendar,
  CheckCircle2,
  Circle,
  Trash2,
  Archive,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  HandCoins,
  Folder,
  FolderOpen,
} from "lucide-react"
import Link from "next/link"

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function formatFecha(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
}

/** Avanza una fecha de vencimiento al próximo período según la frecuencia. */
function siguienteVencimiento(
  fechaStr: string | null | undefined,
  frecuencia: string,
): string | undefined {
  if (!fechaStr) return undefined
  const [y, m, d] = fechaStr.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  if (frecuencia === "Anual") date.setUTCFullYear(date.getUTCFullYear() + 1)
  else date.setUTCMonth(date.getUTCMonth() + 1)
  return date.toISOString().slice(0, 10)
}

/** Monto oculto mostrado cuando el usuario esconde una métrica. */
const MONTO_OCULTO = "$ ••••••"

function puntoPrioridad(estado: EstadoAlerta) {
  if (estado === "vencido" || estado === "urgente") {
    return <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0 mt-0.5" />
  }
  if (estado === "proximo") {
    return <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0 mt-0.5" />
  }
  return <span className="h-2.5 w-2.5 rounded-full bg-teal-500 shrink-0 mt-0.5" />
}

function descripcionAlerta(diasRestantes: number, estado: EstadoAlerta): string {
  if (estado === "vencido") return `venció hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) !== 1 ? "s" : ""}`
  if (diasRestantes === 0) return "vence hoy"
  if (diasRestantes === 1) return "vence mañana"
  return `vence en ${diasRestantes} días`
}

function badgeEstadoFijo(estado: EstadoAlerta | "pagado") {
  if (estado === "pagado") {
    return <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[11px]">pagado</Badge>
  }
  if (estado === "vencido" || estado === "urgente") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">
        {estado === "vencido" ? "vencido" : "urgente"}
      </Badge>
    )
  }
  if (estado === "proximo") {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]">próximo</Badge>
  }
  return <Badge className="bg-sky-100 text-sky-700 border-sky-200 text-[11px]">pendiente</Badge>
}

type EstadoGastoVar = "pendiente" | "pagado" | "vencido"

function badgeEstadoVar(estado: EstadoGastoVar) {
  if (estado === "pagado") {
    return <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[11px]">pagado</Badge>
  }
  if (estado === "vencido") {
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">vencido</Badge>
  }
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]">pendiente</Badge>
}

// ---------------------------------------------------------------------------
// REPARTO ENTRE SALONES
// ---------------------------------------------------------------------------

/** Suma de porcentajes del reparto. */
function totalReparto(dist: DistribucionSalon[]): number {
  return dist.reduce((s, d) => s + (Number(d.porcentaje) || 0), 0)
}

/** Un reparto es válido si tiene al menos un salón y los porcentajes suman 100. */
function repartoValido(dist: DistribucionSalon[]): boolean {
  const activos = dist.filter((d) => d.salon && (Number(d.porcentaje) || 0) > 0)
  return activos.length > 0 && totalReparto(activos) === 100
}

/**
 * Editor para repartir un gasto entre varios salones por porcentaje.
 * Cada salón tildado suma su porción; el total debe dar 100%.
 */
function RepartoSalonesEditor({
  value,
  onChange,
}: {
  value: DistribucionSalon[]
  onChange: (v: DistribucionSalon[]) => void
}) {
  const total = totalReparto(value)

  function toggleSalon(salon: string, checked: boolean) {
    if (checked) {
      if (value.some((d) => d.salon === salon)) return
      onChange([...value, { salon, porcentaje: 0 }])
    } else {
      onChange(value.filter((d) => d.salon !== salon))
    }
  }

  function setPorcentaje(salon: string, pct: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)))
    onChange(value.map((d) => (d.salon === salon ? { ...d, porcentaje: clamped } : d)))
  }

  function repartirIgual() {
    if (value.length === 0) return
    const base = Math.floor(100 / value.length)
    const resto = 100 - base * value.length
    onChange(value.map((d, i) => ({ ...d, porcentaje: base + (i < resto ? 1 : 0) })))
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Tildá los salones y asigná el porcentaje que le corresponde a cada uno.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-purple-600 hover:text-purple-800"
          onClick={repartirIgual}
          disabled={value.length === 0}
        >
          Repartir igual
        </Button>
      </div>
      <div className="space-y-1.5">
        {SALONES.map((s) => {
          const entry = value.find((d) => d.salon === s)
          const checked = !!entry
          return (
            <div key={s} className="flex items-center gap-2.5">
              <Checkbox
                id={`rep-${s}`}
                checked={checked}
                onCheckedChange={(v) => toggleSalon(s, v === true)}
              />
              <Label htmlFor={`rep-${s}`} className="flex-1 text-sm font-normal cursor-pointer">
                {salonLabel(s)}
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  disabled={!checked}
                  value={checked ? String(entry?.porcentaje ?? 0) : ""}
                  onChange={(e) => setPorcentaje(s, Number(e.target.value))}
                  className="h-8 w-20 text-right"
                  aria-label={`Porcentaje de ${salonLabel(s)}`}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="text-xs text-muted-foreground">Total asignado</span>
        <span className={`text-sm font-bold ${total === 100 ? "text-teal-600" : "text-red-600"}`}>
          {total}%
        </span>
      </div>
      {total !== 100 && (
        <p className="text-xs text-red-600">Los porcentajes deben sumar 100%.</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CARPETAS POR SALÓN
// ---------------------------------------------------------------------------

/** Paleta de colores por salón para las carpetas de gastos. */
const SALON_FOLDER_STYLES: Record<string, { header: string; dot: string; border: string; icon: string }> = {
  Quinta: { header: "bg-blue-50 text-blue-800 hover:bg-blue-100", dot: "bg-blue-500", border: "border-blue-200", icon: "text-blue-500" },
  Casona: { header: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100", dot: "bg-emerald-500", border: "border-emerald-200", icon: "text-emerald-500" },
  Salon: { header: "bg-amber-50 text-amber-800 hover:bg-amber-100", dot: "bg-amber-500", border: "border-amber-200", icon: "text-amber-500" },
  "Salon 4": { header: "bg-rose-50 text-rose-800 hover:bg-rose-100", dot: "bg-rose-500", border: "border-rose-200", icon: "text-rose-500" },
  "Salon 5": { header: "bg-cyan-50 text-cyan-800 hover:bg-cyan-100", dot: "bg-cyan-500", border: "border-cyan-200", icon: "text-cyan-500" },
  General: { header: "bg-slate-100 text-slate-700 hover:bg-slate-200", dot: "bg-slate-400", border: "border-slate-200", icon: "text-slate-400" },
}

function folderStyle(salon: string | null | undefined) {
  return SALON_FOLDER_STYLES[salon || "General"] || SALON_FOLDER_STYLES.General
}

/** Agrupa una lista de gastos por salón, respetando el orden de SALONES. */
function agruparPorSalon<T extends { salon?: string | null; monto: number }>(
  items: T[],
): { salon: string; items: T[]; subtotal: number }[] {
  const map = new Map<string, T[]>()
  for (const it of items) {
    const key = it.salon || "General"
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(it)
  }
  const orden = [...SALONES, "General"]
  return Array.from(map.entries())
    .sort((a, b) => orden.indexOf(a[0] as any) - orden.indexOf(b[0] as any))
    .map(([salon, items]) => ({
      salon,
      items,
      subtotal: items.reduce((s, g) => s + g.monto, 0),
    }))
}

/** Carpeta colapsable de color que agrupa los gastos de un salón. */
function CarpetaGastos({
  salon,
  count,
  subtotal,
  children,
}: {
  salon: string
  count: number
  subtotal: number
  children: React.ReactNode
}) {
  const [abierta, setAbierta] = useState(true)
  const st = folderStyle(salon)
  return (
    <div className={`rounded-lg border ${st.border} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className={`flex w-full items-center gap-2 px-3 py-2 transition-colors ${st.header}`}
        aria-expanded={abierta}
      >
        {abierta ? <FolderOpen className={`h-4 w-4 ${st.icon}`} /> : <Folder className={`h-4 w-4 ${st.icon}`} />}
        <span className={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden="true" />
        <span className="text-sm font-semibold flex-1 text-left">{salonLabel(salon)}</span>
        <span className="text-xs font-medium opacity-80">
          {count} {count === 1 ? "gasto" : "gastos"} · {formatCurrency(subtotal)}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${abierta ? "rotate-180" : ""}`} />
      </button>
      {abierta && <div className="space-y-2 bg-card p-2">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------

export default function CajaJazminePage() {
  const {
    state,
    updateCostoOperativo,
    addCostoOperativo,
    deleteCostoOperativo,
    archivarGasto,
    updateEvento,
    addMovimientosCaja,
  } = useStore()
  const { ahora } = useClock()
  const { toast } = useToast()
  const [salonFiltro, setSalonFiltro] = useState<string>("todos")
  const [cuotaSel, setCuotaSel] = useState<CuotaPorCobrar | null>(null)
  const [marcarCobrada, setMarcarCobrada] = useState(false)

  // Marca una cuota como ya cobrada (útil al cargar eventos viejos): genera el
  // ingreso 50/50 a Caja Eventos y Caja Jazmines, datado en el vencimiento.
  function confirmarCobroCuota(cuota: CuotaPorCobrar) {
    const evento = state.eventos?.find((e) => e.id === cuota.eventoId) as EventoGuardado | undefined
    if (!evento) return
    const { yaCobrada, planUpdate, movimientos } = construirCobroCuota(
      evento,
      cuota.numeroCuota,
      cuota.montoCuota,
      cuota.fechaVencimiento,
      state.movimientosCaja || [],
    )
    if (yaCobrada) {
      toast({ title: "Esta cuota ya figura como cobrada." })
      return
    }
    if (planUpdate) updateEvento(cuota.eventoId, planUpdate)
    if (movimientos.length > 0) addMovimientosCaja(movimientos)
    toast({
      title: "Cuota marcada como cobrada",
      description: `Cuota ${cuota.numeroCuota}/${cuota.totalCuotas} · ${cuota.eventoNombre}`,
    })
    setCuotaSel(null)
  }
  const data = useCajaJazmines(state, salonFiltro, ahora)

  const hoyStr = ahora.toISOString().slice(0, 10)

  // Colapsar tarjetas (alertas, fijos, proyección) y ocultar montos de métricas.
  const [colapsadas, setColapsadas] = useState<Record<string, boolean>>({ fijos: true, variables: true })
  const toggleColapsada = (key: string) =>
    setColapsadas((p) => ({ ...p, [key]: !p[key] }))
  const [montosOcultos, setMontosOcultos] = useState<Record<string, boolean>>({})
  const toggleMonto = (key: string) =>
    setMontosOcultos((p) => ({ ...p, [key]: !p[key] }))

  // Archivar un gasto FIJO: registra el pago del período en el archivo y avanza
  // el vencimiento al próximo mes/año. El gasto sale de la lista activa (queda el
  // tilde verde de "cubierto") y reaparece automáticamente en el próximo período.
  function archivarFijo(gasto: GastoFijoMes) {
    const costo = state.costosOperativos?.find((c) => c.id === gasto.id)
    archivarGasto({
      fecha: hoyStr,
      concepto: gasto.concepto,
      monto: gasto.monto,
      salon: gasto.salon ?? null,
      origen: "caja_jazmines_fijo",
      categoria: "Gasto fijo",
      frecuencia: gasto.frecuencia,
      refId: gasto.id,
    })
    updateCostoOperativo(gasto.id, {
      pagado: false,
      fechaVencimiento: siguienteVencimiento(costo?.fechaVencimiento, gasto.frecuencia),
    })
  }

  // Archivar un gasto VARIABLE (único): lo mueve al archivo y lo quita de la lista activa.
  function archivarVariable(gasto: { id: string; nombre: string; salon: string; fecha: string; monto: number }) {
    archivarGasto({
      fecha: gasto.fecha || hoyStr,
      concepto: gasto.nombre,
      monto: gasto.monto,
      salon: gasto.salon || null,
      origen: "caja_jazmines_variable",
      categoria: "Gasto variable",
      refId: gasto.id,
    })
    deleteCostoOperativo(gasto.id)
  }

  const {
    saldoActual,
    gastosPróximos30Dias,
    saldoProyectado30Dias,
    alertasVencimiento,
    gastosFijosMes,
    gastosFijosCubiertos,
    gastosVariables: gastosVariablesCombinados,
    ingresosProyectados30Dias,
    cuotasPorCobrar,
  } = data

  // ── Edición de gastos fijos ──────────────────────────────────────────────
  const [editandoFijo, setEditandoFijo] = useState<GastoFijoMes | null>(null)
  const [editFijo, setEditFijo] = useState({
    concepto: "",
    monto: "",
    fechaVencimiento: "",
    salon: "",
    pagado: false,
    repartir: false,
    distribucion: [] as DistribucionSalon[],
  })

  const editRepartoInvalido = editFijo.repartir && !repartoValido(editFijo.distribucion)

  function abrirEditFijo(gasto: GastoFijoMes) {
    // El gasto que llega puede venir prorrateado (concepto/monto ajustados). Usamos
    // el costo original de Supabase para editar los valores reales sin el reparto aplicado.
    const original = state.costosOperativos?.find((c) => c.id === gasto.id)
    const dist = original?.distribucion ?? []
    setEditandoFijo(gasto)
    setEditFijo({
      concepto: original?.concepto ?? gasto.concepto,
      monto: String(original?.monto ?? gasto.monto),
      fechaVencimiento: original?.fechaVencimiento ?? "",
      salon: original?.salon ?? "",
      pagado: gasto.estado === "pagado",
      repartir: dist.length > 0,
      distribucion: dist,
    })
  }

  function guardarEditFijo() {
    if (!editandoFijo) return
    if (editRepartoInvalido) return
    const dist = editFijo.repartir
      ? editFijo.distribucion.filter((d) => d.salon && d.porcentaje > 0)
      : []
    updateCostoOperativo(editandoFijo.id, {
      concepto: editFijo.concepto,
      monto: Number(editFijo.monto),
      fechaVencimiento: editFijo.fechaVencimiento || undefined,
      salon: dist.length > 0 ? null : editFijo.salon || null,
      pagado: editFijo.pagado,
      distribucion: dist.length > 0 ? dist : undefined,
    })
    setEditandoFijo(null)
  }

  // ── Agregar gasto fijo ───────────────────────────────────────────────────
  const [modalFijoAbierto, setModalFijoAbierto] = useState(false)
  const [nuevoFijo, setNuevoFijo] = useState({
    concepto: "",
    monto: "",
    fechaVencimiento: "",
    salon: "",
    frecuencia: "Mensual" as "Mensual" | "Anual",
    repartir: false,
    distribucion: [] as DistribucionSalon[],
  })

  const fijoRepartoInvalido = nuevoFijo.repartir && !repartoValido(nuevoFijo.distribucion)

  function handleAgregarFijo() {
    if (!nuevoFijo.concepto || !nuevoFijo.monto) return
    if (fijoRepartoInvalido) return
    const dist = nuevoFijo.repartir
      ? nuevoFijo.distribucion.filter((d) => d.salon && d.porcentaje > 0)
      : []
    addCostoOperativo({
      concepto: nuevoFijo.concepto,
      tipo: "Gastos Generales" as any,
      monto: Number(nuevoFijo.monto),
      frecuencia: nuevoFijo.frecuencia,
      esPorPersona: false,
      salon: dist.length > 0 ? null : nuevoFijo.salon || null,
      activo: true,
      fechaVencimiento: nuevoFijo.fechaVencimiento || undefined,
      esVariable: false,
      pagado: false,
      distribucion: dist.length > 0 ? dist : undefined,
    })
    setNuevoFijo({ concepto: "", monto: "", fechaVencimiento: "", salon: "", frecuencia: "Mensual", repartir: false, distribucion: [] })
    setModalFijoAbierto(false)
  }

  // ── Gastos variables ──────────────────────────���──────────────────────────
  const [modalVariableAbierto, setModalVariableAbierto] = useState(false)
  const [nuevoGasto, setNuevoGasto] = useState({
    nombre: "",
    monto: "",
    salon: "",
    fecha: "",
    repartir: false,
    distribucion: [] as DistribucionSalon[],
  })

  const variableRepartoInvalido = nuevoGasto.repartir && !repartoValido(nuevoGasto.distribucion)

  const totalGastosFijos = gastosFijosMes.reduce((s, g) => s + g.monto, 0)
  const barMax = Math.max(saldoActual, ingresosProyectados30Dias, gastosPróximos30Dias, 1)

  function handleAgregarGasto() {
    if (!nuevoGasto.nombre || !nuevoGasto.monto || !nuevoGasto.fecha) return
    if (nuevoGasto.repartir) {
      if (variableRepartoInvalido) return
    } else if (!nuevoGasto.salon) {
      return
    }
    const dist = nuevoGasto.repartir
      ? nuevoGasto.distribucion.filter((d) => d.salon && d.porcentaje > 0)
      : []
    addCostoOperativo({
      concepto: nuevoGasto.nombre,
      tipo: "Gastos Generales" as any,
      monto: Number(nuevoGasto.monto),
      frecuencia: "Por Evento",
      esPorPersona: false,
      salon: dist.length > 0 ? null : nuevoGasto.salon,
      activo: true,
      fechaVencimiento: nuevoGasto.fecha,
      esVariable: true,
      pagado: false,
      distribucion: dist.length > 0 ? dist : undefined,
    })
    setNuevoGasto({ nombre: "", monto: "", salon: "", fecha: "", repartir: false, distribucion: [] })
    setModalVariableAbierto(false)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
            <Building className="h-5 w-5 text-purple-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Caja Jazmines</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              50% de cada cobro de cuota. Fondos de la empresa: sueldos, gastos fijos y administración.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
            <Link href="/finanzas/archivo">
              <Archive className="h-4 w-4" />
              Archivo
            </Link>
          </Button>
          <Building className="h-4 w-4 text-muted-foreground" />
          <Select value={salonFiltro} onValueChange={setSalonFiltro}>
            <SelectTrigger className="w-[180px] h-9" aria-label="Filtrar por salón">
              <SelectValue placeholder="Todos los salones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los salones</SelectItem>
              {SALONES.map((s) => (
                <SelectItem key={s} value={s}>
                  {salonLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {salonFiltro !== "todos" && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Mostrando únicamente el saldo y los gastos del salón{" "}
          <span className="font-medium text-foreground">{salonLabel(salonFiltro)}</span>.
          Los gastos generales (sin salón) solo aparecen en la vista de todos los salones.
        </p>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">Saldo Actual</p>
              <div className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-purple-600" />
                <button
                  type="button"
                  onClick={() => toggleMonto("saldoActual")}
                  className="text-purple-600 hover:text-purple-800"
                  aria-label={montosOcultos.saldoActual ? "Mostrar saldo actual" : "Ocultar saldo actual"}
                  title={montosOcultos.saldoActual ? "Mostrar monto" : "Ocultar monto"}
                >
                  {montosOcultos.saldoActual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-3xl font-bold text-purple-800">
              {montosOcultos.saldoActual ? MONTO_OCULTO : formatCurrency(saldoActual)}
            </p>
            <p className="text-xs text-purple-600 mt-1">Cobros acumulados × 50% − gastos</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Gastos próximos 30 días
              </p>
              <div className="flex items-center gap-1.5">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <button
                  type="button"
                  onClick={() => toggleMonto("gastos30")}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={montosOcultos.gastos30 ? "Mostrar gastos próximos" : "Ocultar gastos próximos"}
                  title={montosOcultos.gastos30 ? "Mostrar monto" : "Ocultar monto"}
                >
                  {montosOcultos.gastos30 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-3xl font-bold text-red-600">
              {montosOcultos.gastos30 ? MONTO_OCULTO : formatCurrency(gastosPróximos30Dias)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Costos operativos pendientes del período</p>
          </CardContent>
        </Card>

        <Card className={saldoProyectado30Dias >= 0 ? "border-teal-200 bg-teal-50" : "border-red-200 bg-red-50"}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs font-medium uppercase tracking-wide ${saldoProyectado30Dias >= 0 ? "text-teal-700" : "text-red-700"}`}>
                Saldo proyectado a 30 días
              </p>
              <div className="flex items-center gap-1.5">
                <TrendingUp className={`h-4 w-4 ${saldoProyectado30Dias >= 0 ? "text-teal-600" : "text-red-600"}`} />
                <button
                  type="button"
                  onClick={() => toggleMonto("saldoProyectado")}
                  className={saldoProyectado30Dias >= 0 ? "text-teal-600 hover:text-teal-800" : "text-red-600 hover:text-red-800"}
                  aria-label={montosOcultos.saldoProyectado ? "Mostrar saldo proyectado" : "Ocultar saldo proyectado"}
                  title={montosOcultos.saldoProyectado ? "Mostrar monto" : "Ocultar monto"}
                >
                  {montosOcultos.saldoProyectado ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className={`text-3xl font-bold ${saldoProyectado30Dias >= 0 ? "text-teal-800" : "text-red-700"}`}>
              {montosOcultos.saldoProyectado ? MONTO_OCULTO : formatCurrency(saldoProyectado30Dias)}
            </p>
            <p className={`text-xs mt-1 ${saldoProyectado30Dias >= 0 ? "text-teal-600" : "text-red-600"}`}>
              Saldo + ingresos − gastos estimados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cuotas por cobrar (izquierda) + Vencimientos (derecha) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

      {/* Alertas de vencimiento (columna derecha) */}
      <Card className="order-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Alertas de vencimiento
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => toggleColapsada("alertas")}
              aria-label={colapsadas.alertas ? "Expandir alertas" : "Minimizar alertas"}
              title={colapsadas.alertas ? "Expandir" : "Minimizar"}
            >
              {colapsadas.alertas ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {!colapsadas.alertas && (
        <CardContent className="space-y-2">
          {alertasVencimiento.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay vencimientos en los próximos 30 días.
            </p>
          ) : (
            <>
              {alertasVencimiento.map((alerta) => (
                <div
                  key={alerta.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                >
                  {puntoPrioridad(alerta.estado)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{alerta.concepto}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="capitalize">{descripcionAlerta(alerta.diasRestantes, alerta.estado)}</span>
                      {alerta.salon ? ` · ${salonLabel(alerta.salon)}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-red-600 shrink-0">
                    {formatCurrency(alerta.monto)}
                  </span>
                </div>
              ))}
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                  Urgente / vencido
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                  Menos de 7 días
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-teal-500 inline-block" />
                  Más de 7 días
                </span>
              </div>
            </>
          )}
        </CardContent>
        )}
      </Card>

      {/* ── Cuotas por cobrar (columna izquierda) ─────────────────────── */}
      <Card className="order-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <HandCoins className="h-4 w-4 text-emerald-600" />
              Cuotas por cobrar
              {cuotasPorCobrar.length > 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[11px]">
                  {cuotasPorCobrar.length}
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => toggleColapsada("cuotas")}
              aria-label={colapsadas.cuotas ? "Expandir cuotas" : "Minimizar cuotas"}
              title={colapsadas.cuotas ? "Expandir" : "Minimizar"}
            >
              {colapsadas.cuotas ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {!colapsadas.cuotas && (
          <CardContent className="space-y-2">
            {cuotasPorCobrar.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No hay cuotas pendientes de cobro.
              </p>
            ) : (
              cuotasPorCobrar.map((cuota) => (
                <button
                  key={cuota.id}
                  onClick={() => {
                    setCuotaSel(cuota)
                    setMarcarCobrada(false)
                  }}
                  className="w-full flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{cuota.eventoNombre}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cuota {cuota.numeroCuota}/{cuota.totalCuotas} · vence {formatFecha(cuota.fechaVencimiento)}
                      {cuota.salon ? ` · ${salonLabel(cuota.salon)}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 shrink-0">
                    +{formatCurrency(cuota.montoJazmines)}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        )}
      </Card>

      </div>

      {/* Gastos fijos + Gastos variables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ���─ Gastos fijos del mes ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Gastos fijos del mes
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => setModalFijoAbierto(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => toggleColapsada("fijos")}
                  aria-label={colapsadas.fijos ? "Expandir gastos fijos" : "Minimizar gastos fijos"}
                  title={colapsadas.fijos ? "Expandir" : "Minimizar"}
                >
                  {colapsadas.fijos ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          {!colapsadas.fijos && (
          <CardContent className="space-y-2">
            {gastosFijosMes.length === 0 && gastosFijosCubiertos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No hay gastos fijos configurados.
              </p>
            ) : (
              <>
                {gastosFijosMes.length === 0 && gastosFijosCubiertos.length > 0 && (
                  <p className="text-sm text-muted-foreground py-2 text-center">
                    No hay gastos fijos pendientes este mes.
                  </p>
                )}
                {agruparPorSalon(gastosFijosMes).map((carpeta) => (
                  <CarpetaGastos
                    key={`fijo-${carpeta.salon}`}
                    salon={carpeta.salon}
                    count={carpeta.items.length}
                    subtotal={carpeta.subtotal}
                  >
                    {carpeta.items.map((gasto) => {
                  const esPagado = gasto.estado === "pagado"
                  return (
                    <div
                      key={gasto.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{gasto.concepto}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {gasto.frecuencia}
                          {gasto.fechaVencimiento ? ` · vence ${formatFecha(gasto.fechaVencimiento)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="flex flex-col items-end gap-1 mr-1">
                          <span className="text-sm font-bold text-foreground">
                            {formatCurrency(gasto.monto)}
                          </span>
                          {badgeEstadoFijo(gasto.estado)}
                        </div>
                        {/* Toggle pagado */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${esPagado ? "text-teal-600 hover:text-teal-700" : "text-muted-foreground hover:text-teal-600"}`}
                          title={esPagado ? "Marcar como pendiente" : "Marcar como pagado"}
                          onClick={() => updateCostoOperativo(gasto.id, { pagado: !esPagado })}
                        >
                          {esPagado
                            ? <CheckCircle2 className="h-4 w-4" />
                            : <Circle className="h-4 w-4" />
                          }
                          <span className="sr-only">{esPagado ? "Marcar pendiente" : "Marcar pagado"}</span>
                        </Button>
                        {/* Archivar */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-purple-600"
                          title="Archivar pago de este período"
                          onClick={() => archivarFijo(gasto)}
                        >
                          <Archive className="h-3.5 w-3.5" />
                          <span className="sr-only">Archivar gasto fijo</span>
                        </Button>
                        {/* Editar */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => abrirEditFijo(gasto)}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Editar gasto fijo</span>
                        </Button>
                        {/* Eliminar */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Eliminar"
                          onClick={() => deleteCostoOperativo(gasto.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Eliminar gasto fijo</span>
                        </Button>
                      </div>
                    </div>
                  )
                    })}
                  </CarpetaGastos>
                ))}

                {/* Cubiertos este mes: tilde verde */}
                {gastosFijosCubiertos.map((gasto) => (
                  <div
                    key={gasto.id}
                    className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3"
                  >
                    <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-teal-800 truncate">{gasto.concepto}</p>
                      <p className="text-xs text-teal-600 mt-0.5">
                        Ya cubriste este gasto fijo del mes · {salonLabel(gasto.salon)}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-teal-700 shrink-0">
                      {formatCurrency(gasto.monto)}
                    </span>
                  </div>
                ))}

                {gastosFijosMes.length > 0 && (
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total pendiente</span>
                    <span className="text-base font-bold text-foreground">
                      {formatCurrency(totalGastosFijos)}
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
          )}
        </Card>

        {/* ── Gastos variables ────────────────────────────────��───────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                Gastos variables
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                  onClick={() => setModalVariableAbierto(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agendar gasto
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => toggleColapsada("variables")}
                  aria-label={colapsadas.variables ? "Expandir gastos variables" : "Minimizar gastos variables"}
                  title={colapsadas.variables ? "Expandir" : "Minimizar"}
                >
                  {colapsadas.variables ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          {!colapsadas.variables && (
          <CardContent className="space-y-2">
            {gastosVariablesCombinados.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">
                Sin gastos variables registrados.
              </p>
            ) : (
              agruparPorSalon(gastosVariablesCombinados).map((carpeta) => (
                <CarpetaGastos
                  key={`var-${carpeta.salon}`}
                  salon={carpeta.salon}
                  count={carpeta.items.length}
                  subtotal={carpeta.subtotal}
                >
                  {carpeta.items.map((gasto) => {
                const esPagado = gasto.estado === "pagado"
                return (
                  <div
                    key={gasto.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{gasto.nombre}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatFecha(gasto.fecha)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="flex flex-col items-end gap-1 mr-1">
                        <span className="text-sm font-bold text-foreground">
                          {formatCurrency(gasto.monto)}
                        </span>
                        {badgeEstadoVar(gasto.estado)}
                      </div>
                      {/* Toggle pagado */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 ${esPagado ? "text-teal-600 hover:text-teal-700" : "text-muted-foreground hover:text-teal-600"}`}
                        title={esPagado ? "Marcar como pendiente" : "Marcar como pagado"}
                        onClick={() => updateCostoOperativo(gasto.id, { pagado: !esPagado })}
                      >
                        {esPagado
                          ? <CheckCircle2 className="h-4 w-4" />
                          : <Circle className="h-4 w-4" />
                        }
                        <span className="sr-only">{esPagado ? "Marcar pendiente" : "Marcar pagado"}</span>
                      </Button>
                      {/* Archivar */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-purple-600"
                        title="Archivar gasto"
                        onClick={() => archivarVariable(gasto)}
                      >
                        <Archive className="h-3.5 w-3.5" />
                        <span className="sr-only">Archivar gasto variable</span>
                      </Button>
                      {/* Eliminar */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Eliminar"
                        onClick={() => deleteCostoOperativo(gasto.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Eliminar gasto variable</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
                </CarpetaGastos>
              ))
            )}
          </CardContent>
          )}
        </Card>
      </div>

      {/* Proyección visual */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              Proyección del saldo a 30 días
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => toggleColapsada("proyeccion")}
              aria-label={colapsadas.proyeccion ? "Expandir proyección" : "Minimizar proyección"}
              title={colapsadas.proyeccion ? "Expandir" : "Minimizar"}
            >
              {colapsadas.proyeccion ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {!colapsadas.proyeccion && (
        <CardContent className="space-y-4">
          <div className="flex items-end justify-around gap-3 sm:gap-6 h-56 pt-2">
            {[
              { label: "Saldo actual", value: saldoActual, color: "bg-purple-500", textColor: "text-purple-700" },
              { label: "Gastos proyectados", value: gastosPróximos30Dias, color: "bg-red-400", textColor: "text-red-600", signo: "−" },
              { label: "Ingresos proyectados (50%)", value: ingresosProyectados30Dias, color: "bg-purple-300", textColor: "text-purple-600", signo: "+" },
            ].map(({ label, value, color, textColor, signo }) => {
              const pct = Math.round((value / barMax) * 100)
              return (
                <div key={label} className="flex h-full flex-1 flex-col items-center gap-2">
                  <span className={`text-xs font-semibold whitespace-nowrap ${textColor}`}>
                    {signo ? `${signo} ` : ""}{formatCurrency(value)}
                  </span>
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div className="relative flex h-full w-10 items-end overflow-hidden rounded-t-md bg-muted sm:w-16">
                      <div
                        className={`w-full rounded-t-md ${color} transition-all duration-500`}
                        style={{ height: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-center text-xs font-medium leading-tight text-foreground">
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Saldo proyectado resultante</span>
              <span className={`text-xl font-bold ${saldoProyectado30Dias >= 0 ? "text-teal-700" : "text-red-600"}`}>
                {formatCurrency(saldoProyectado30Dias)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Saldo actual + ingresos proyectados − gastos proyectados
            </p>
          </div>
        </CardContent>
        )}
      </Card>

      {/* ── Dialog: Agregar gasto fijo ────────────────────────────────────── */}
      <Dialog open={modalFijoAbierto} onOpenChange={setModalFijoAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar gasto fijo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nf-concepto">Nombre</Label>
              <Input
                id="nf-concepto"
                placeholder="Ej: Alquiler, Luz, Internet"
                value={nuevoFijo.concepto}
                onChange={(e) => setNuevoFijo((p) => ({ ...p, concepto: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nf-monto">Monto (ARS)</Label>
              <MoneyInput
                id="nf-monto"
                placeholder="0"
                value={Number(nuevoFijo.monto) || 0}
                onValueChange={(v) => setNuevoFijo((p) => ({ ...p, monto: v ? String(v) : "" }))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="nf-repartir">Repartir entre varios salones</Label>
                <Switch
                  id="nf-repartir"
                  checked={nuevoFijo.repartir}
                  onCheckedChange={(checked) => setNuevoFijo((p) => ({ ...p, repartir: checked }))}
                />
              </div>
              {nuevoFijo.repartir ? (
                <RepartoSalonesEditor
                  value={nuevoFijo.distribucion}
                  onChange={(v) => setNuevoFijo((p) => ({ ...p, distribucion: v }))}
                />
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="nf-salon">Salón</Label>
                  <Select
                    value={nuevoFijo.salon || "General"}
                    onValueChange={(v) => setNuevoFijo((p) => ({ ...p, salon: v === "General" ? "" : v }))}
                  >
                    <SelectTrigger id="nf-salon">
                      <SelectValue placeholder="Seleccionar salón" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">General (todos los salones)</SelectItem>
                      {SALONES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {salonLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Elegí un salón para atribuir el gasto, o &quot;General&quot; si es compartido.
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nf-fecha">Fecha de vencimiento</Label>
              <Input
                id="nf-fecha"
                type="date"
                value={nuevoFijo.fechaVencimiento}
                onChange={(e) => setNuevoFijo((p) => ({ ...p, fechaVencimiento: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nf-frecuencia">Frecuencia</Label>
              <select
                id="nf-frecuencia"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={nuevoFijo.frecuencia}
                onChange={(e) =>
                  setNuevoFijo((p) => ({ ...p, frecuencia: e.target.value as "Mensual" | "Anual" }))
                }
              >
                <option value="Mensual">Mensual</option>
                <option value="Anual">Anual</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalFijoAbierto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAgregarFijo}
              disabled={!nuevoFijo.concepto || !nuevoFijo.monto || fijoRepartoInvalido}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar gasto fijo ──────────────────────────────────────── */}
      <Dialog open={!!editandoFijo} onOpenChange={(open) => !open && setEditandoFijo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar gasto fijo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ef-concepto">Nombre</Label>
              <Input
                id="ef-concepto"
                value={editFijo.concepto}
                onChange={(e) => setEditFijo((p) => ({ ...p, concepto: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef-monto">Monto (ARS)</Label>
              <MoneyInput
                id="ef-monto"
                value={Number(editFijo.monto) || 0}
                onValueChange={(v) => setEditFijo((p) => ({ ...p, monto: v ? String(v) : "" }))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ef-repartir">Repartir entre varios salones</Label>
                <Switch
                  id="ef-repartir"
                  checked={editFijo.repartir}
                  onCheckedChange={(checked) => setEditFijo((p) => ({ ...p, repartir: checked }))}
                />
              </div>
              {editFijo.repartir ? (
                <RepartoSalonesEditor
                  value={editFijo.distribucion}
                  onChange={(v) => setEditFijo((p) => ({ ...p, distribucion: v }))}
                />
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="ef-salon">Salón</Label>
                  <Select
                    value={editFijo.salon || "General"}
                    onValueChange={(v) => setEditFijo((p) => ({ ...p, salon: v === "General" ? "" : v }))}
                  >
                    <SelectTrigger id="ef-salon">
                      <SelectValue placeholder="Seleccionar salón" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">General (todos los salones)</SelectItem>
                      {SALONES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {salonLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef-fecha">Fecha de vencimiento</Label>
              <Input
                id="ef-fecha"
                type="date"
                value={editFijo.fechaVencimiento}
                onChange={(e) => setEditFijo((p) => ({ ...p, fechaVencimiento: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Marcado como pagado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cambia el estado a pagado en este mes
                </p>
              </div>
              <Switch
                checked={editFijo.pagado}
                onCheckedChange={(checked) => setEditFijo((p) => ({ ...p, pagado: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoFijo(null)}>
              Cancelar
            </Button>
            <Button
              onClick={guardarEditFijo}
              disabled={!editFijo.concepto || !editFijo.monto || editRepartoInvalido}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Agendar gasto variable ────────────────────────────────── */}
      <Dialog open={modalVariableAbierto} onOpenChange={setModalVariableAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar gasto variable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="gv-concepto">Concepto</Label>
              <Input
                id="gv-concepto"
                placeholder="Ej: Reparación de heladera"
                value={nuevoGasto.nombre}
                onChange={(e) => setNuevoGasto((p) => ({ ...p, nombre: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gv-monto">Monto (ARS)</Label>
              <MoneyInput
                id="gv-monto"
                placeholder="Ej: 50.000"
                value={Number(nuevoGasto.monto) || 0}
                onValueChange={(v) => setNuevoGasto((p) => ({ ...p, monto: v ? String(v) : "" }))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="gv-repartir">Repartir entre varios salones</Label>
                <Switch
                  id="gv-repartir"
                  checked={nuevoGasto.repartir}
                  onCheckedChange={(checked) => setNuevoGasto((p) => ({ ...p, repartir: checked }))}
                />
              </div>
              {nuevoGasto.repartir ? (
                <RepartoSalonesEditor
                  value={nuevoGasto.distribucion}
                  onChange={(v) => setNuevoGasto((p) => ({ ...p, distribucion: v }))}
                />
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="gv-salon">Salón</Label>
                  <Select
                    value={nuevoGasto.salon}
                    onValueChange={(v) => setNuevoGasto((p) => ({ ...p, salon: v }))}
                  >
                    <SelectTrigger id="gv-salon">
                      <SelectValue placeholder="Seleccionar salón" />
                    </SelectTrigger>
                    <SelectContent>
                      {SALONES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {salonLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gv-fecha">Fecha del gasto</Label>
              <Input
                id="gv-fecha"
                type="date"
                value={nuevoGasto.fecha}
                onChange={(e) => setNuevoGasto((p) => ({ ...p, fecha: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Podés agendar gastos futuros; se ordenan automáticamente por fecha.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalVariableAbierto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAgregarGasto}
              disabled={
                !nuevoGasto.nombre ||
                !nuevoGasto.monto ||
                !nuevoGasto.fecha ||
                (nuevoGasto.repartir ? variableRepartoInvalido : !nuevoGasto.salon)
              }
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: marcar cuota como cobrada ─────────────────────────────── */}
      <Dialog
        open={!!cuotaSel}
        onOpenChange={(open) => {
          if (!open) setCuotaSel(null)
          setMarcarCobrada(false)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandCoins className="h-4 w-4 text-emerald-600" />
              {cuotaSel?.eventoNombre}
            </DialogTitle>
          </DialogHeader>
          {cuotaSel && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-emerald-700">
                    Cuota {cuotaSel.numeroCuota}/{cuotaSel.totalCuotas} · vence {formatFecha(cuotaSel.fechaVencimiento)}
                  </span>
                  <span className="text-lg font-bold text-emerald-800">
                    {formatCurrency(cuotaSel.montoCuota)}
                  </span>
                </div>
                <p className="text-xs text-emerald-700/80">
                  Se reparte 50% a Caja Eventos ({formatCurrency(cuotaSel.montoJazmines)}) y 50% a Caja Jazmines (
                  {formatCurrency(cuotaSel.montoJazmines)}).
                </p>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={marcarCobrada}
                  onCheckedChange={(v) => setMarcarCobrada(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-snug">
                  Marcar esta cuota como <span className="font-medium">ya cobrada</span>
                  <span className="block text-xs text-muted-foreground">
                    Registra el ingreso en ambas cajas con fecha {formatFecha(cuotaSel.fechaVencimiento)}.
                  </span>
                </span>
              </label>

              <Button
                className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!marcarCobrada}
                onClick={() => confirmarCobroCuota(cuotaSel)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar cobro
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

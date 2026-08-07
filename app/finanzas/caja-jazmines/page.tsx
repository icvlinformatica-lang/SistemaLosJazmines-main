"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Textarea } from "@/components/ui/textarea"
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
import { SALONES, salonLabel, salonColor, SALON_COLOR_GENERAL, generateId, type EventoGuardado, type DistribucionSalon, type RegistroMonto } from "@/lib/store"
import { SalonDot } from "@/components/salon-badge"
import { useCajaJazmines } from "@/lib/hooks/use-caja-jazmines"
import type { EstadoAlerta, GastoFijoMes, GastoVariable } from "@/lib/hooks/use-caja-jazmines"
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
  Receipt,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRight,
  MoreVertical,
  Search,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ConfirmAction } from "@/components/confirm-action"
import { EvolucionGastosFijosDialog } from "./evolucion-gastos-fijos"

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function formatFecha(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
}

/** Devuelve el mes actual en formato YYYY-MM. */
function mesActualISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/** Devuelve el mes próximo en formato YYYY-MM. */
function mesProximoISO(): string {
  const now = new Date()
  const prox = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}`
}

/** Nombre del mes próximo en español, ej. "septiembre". */
function nombreMesProximo(): string {
  const now = new Date()
  const prox = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return prox.toLocaleDateString("es-AR", { month: "long" })
}

/** Mes siguiente a un YYYY-MM dado, en formato YYYY-MM. */
function mesSiguienteA(mes: string): string {
  const [y, m] = mes.split("-").map(Number)
  if (!y || !m) return mesProximoISO()
  const sig = new Date(y, m, 1) // m es 1-based: Date(y, m) ya es el mes siguiente
  return `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, "0")}`
}

/** Nombre en español de un mes YYYY-MM, ej. "septiembre". */
function nombreDeMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number)
  if (!y || !m) return mes
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long" })
}

/**
 * Período al que corresponde el monto según su vencimiento: lo que vence en
 * agosto paga el consumo de JULIO, lo que vence en septiembre paga agosto.
 * Devuelve el nombre del mes ANTERIOR al del vencimiento, capitalizado.
 */
function periodoQueSePaga(fechaVencimiento: string): string {
  const [y, m] = fechaVencimiento.split("-").map(Number)
  if (!y || !m) return ""
  const anterior = new Date(y, m - 2, 1) // m es 1-based: m-2 es el mes previo
  const nombre = anterior.toLocaleDateString("es-AR", { month: "long" })
  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
}

/**
 * Mes que corresponde cargar para un gasto, atado al PERÍODO al que
 * corresponde el monto (no al vencimiento): si el gasto corresponde a julio,
 * se carga agosto; si corresponde a agosto, se carga septiembre.
 * Como el período es el mes anterior al del vencimiento vigente, el mes a
 * cargar es el mismo mes del vencimiento. Si el historial ya tiene ese mes
 * (o uno posterior) cargado, se ofrece el siguiente al último registrado.
 * Sin historial ni vencimiento, el mes próximo del calendario.
 */
function mesQueCorrespondeCargar(
  historial: RegistroMonto[] | undefined,
  fechaVencimiento?: string | null,
): string {
  const candidatos: string[] = []
  const ultimo = historial && historial.length > 0 ? historial[historial.length - 1] : null
  if (ultimo?.mes) candidatos.push(mesSiguienteA(ultimo.mes))
  if (fechaVencimiento && fechaVencimiento.length >= 7) {
    // Período del gasto = mes anterior al vencimiento → mes a cargar = período + 1
    // = mes del vencimiento vigente.
    candidatos.push(fechaVencimiento.slice(0, 7))
  }
  if (candidatos.length === 0) return mesProximoISO()
  // YYYY-MM ordena lexicográficamente: el mayor es el más avanzado.
  return candidatos.sort()[candidatos.length - 1]
}

/** Formatea un mes YYYY-MM a algo legible, ej. "jul 2026". */
function formatMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number)
  if (!y || !m) return mes
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "short", year: "numeric" })
}

/** Calcula la variación porcentual entre dos montos. */
function calcularVariacion(anterior: number, actual: number): number | null {
  if (!anterior || anterior <= 0) return null
  return ((actual - anterior) / anterior) * 100
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
  if (diasRestantes === 1) return "vence ma�����������ana"
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

/** Un reparto es v��lido si tiene al menos un salón y los porcentajes suman 100. */
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
              <Label htmlFor={`rep-${s}`} className="flex-1 text-sm font-normal cursor-pointer flex items-center gap-2">
                <SalonDot salon={s} size={8} />
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
  unidad = "gasto",
  resumen,
  children,
}: {
  salon: string
  count: number
  subtotal: number
  /** Sustantivo singular para el contador ("gasto", "cuota", "vencimiento") */
  unidad?: string
  /** Indicadores extra visibles con la carpeta cerrada (ej. puntos de prioridad) */
  resumen?: React.ReactNode
  children: React.ReactNode
}) {
  // Las carpetas arrancan SIEMPRE cerradas: se abren solo a pedido.
  const [abierta, setAbierta] = useState(false)
  const { configuracionCajas } = useStore()
  const color = salon && salon !== "General" ? salonColor(salon, configuracionCajas) : SALON_COLOR_GENERAL
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: `${color}40` }}>
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 transition-colors hover:brightness-95"
        style={{ backgroundColor: `${color}1f`, color }}
        aria-expanded={abierta}
      >
        {abierta ? <FolderOpen className="h-4 w-4" style={{ color }} /> : <Folder className="h-4 w-4" style={{ color }} />}
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        <span className="text-sm font-semibold flex-1 text-left">{salonLabel(salon)}</span>
        {resumen}
        <span className="text-xs font-medium opacity-80">
          {count} {count === 1 ? unidad : `${unidad}s`} · {formatCurrency(subtotal)}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${abierta ? "rotate-180" : ""}`} />
      </button>
      {abierta && <div className="space-y-2 bg-card p-2 reveal-stagger">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SEGUIMIENTO DE AUMENTOS (historial de montos por gasto fijo)
// ---------------------------------------------------------------------------

/** Chip que muestra la variación % del último registro respecto al anterior. */
function DeltaMonto({ variacion }: { variacion: number | null }) {
  if (variacion === null || Math.abs(variacion) < 0.5) return null
  const subio = variacion > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        subio ? "bg-red-100 text-red-700" : "bg-teal-100 text-teal-700"
      }`}
      title={`${subio ? "Aumentó" : "Bajó"} ${Math.abs(variacion).toFixed(1)}% respecto al registro anterior`}
    >
      {subio ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      {Math.abs(variacion).toFixed(1)}%
    </span>
  )
}

/** Timeline colapsable con el historial de montos pagados de un gasto fijo. */
function HistorialMontos({ historial }: { historial: RegistroMonto[] }) {
  const ordenado = [...historial].sort((a, b) => b.mes.localeCompare(a.mes))
  return (
    <div className="mt-2 rounded-md border border-border bg-muted/40 p-2 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
        Historial de pagos
      </p>
      {ordenado.map((r) => {
        const variacion = calcularVariacion(r.montoAnterior, r.monto)
        return (
          <div key={r.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs">
            <span className="w-16 shrink-0 text-muted-foreground">{formatMes(r.mes)}</span>
            <span className="font-medium text-foreground">{formatCurrency(r.monto)}</span>
            <DeltaMonto variacion={variacion} />
            {r.nota ? <span className="truncate text-muted-foreground italic">· {r.nota}</span> : null}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CALENDARIO DE GASTOS POR SALÓN
// ---------------------------------------------------------------------------

interface ItemCalendario {
  id: string
  concepto: string
  monto: number
  salon: string | null | undefined
  fecha: string // YYYY-MM-DD
  estado: string
  tipo: "fijo" | "variable"
}

/** Formato compacto de moneda para las celdas del calendario. */
function montoCompacto(monto: number): string {
  if (monto >= 1_000_000) return `$${(monto / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "")}M`
  if (monto >= 1_000) return `$${Math.round(monto / 1_000)}k`
  return `$${monto}`
}

/**
 * Calendario mensual con los gastos (fijos y variables) por fecha de
 * vencimiento, coloreados según el salón. Respeta el filtro de salón de la
 * página porque recibe las listas ya filtradas por el hook.
 */
function CalendarioGastosSalones({
  fijos,
  cubiertos,
  variables,
  ahora,
}: {
  fijos: GastoFijoMes[]
  cubiertos: GastoFijoMes[]
  variables: { id: string; nombre: string; salon: string; fecha: string; monto: number; estado: string }[]
  ahora: Date
}) {
  const { configuracionCajas } = useStore()
  const [mesVista, setMesVista] = useState(() => new Date(ahora.getFullYear(), ahora.getMonth(), 1))
  const [diaSel, setDiaSel] = useState<string | null>(null)

  // Unificar todos los gastos con fecha en una sola lista
  const items: ItemCalendario[] = [
    ...fijos
      .filter((g) => g.fechaVencimiento)
      .map((g) => ({
        id: `f-${g.id}`,
        concepto: g.concepto,
        monto: g.monto,
        salon: g.salon,
        fecha: g.fechaVencimiento!,
        estado: g.estado,
        tipo: "fijo" as const,
      })),
    ...cubiertos
      .filter((g) => g.fechaVencimiento)
      .map((g) => ({
        id: `fc-${g.id}`,
        concepto: g.concepto,
        monto: g.monto,
        salon: g.salon,
        fecha: g.fechaVencimiento!,
        estado: "pagado",
        tipo: "fijo" as const,
      })),
    ...variables
      .filter((g) => g.fecha)
      .map((g) => ({
        id: `v-${g.id}`,
        concepto: g.nombre,
        monto: g.monto,
        salon: g.salon || null,
        fecha: g.fecha,
        estado: g.estado,
        tipo: "variable" as const,
      })),
  ]

  const anio = mesVista.getFullYear()
  const mes = mesVista.getMonth()
  const mesISO = `${anio}-${String(mes + 1).padStart(2, "0")}`
  const itemsMes = items.filter((it) => it.fecha.startsWith(mesISO))

  // Agrupar por día del mes
  const porDia = new Map<string, ItemCalendario[]>()
  for (const it of itemsMes) {
    if (!porDia.has(it.fecha)) porDia.set(it.fecha, [])
    porDia.get(it.fecha)!.push(it)
  }

  const totalMes = itemsMes.reduce((s, it) => s + it.monto, 0)

  // Subtotales por salón del mes visible
  const porSalon = new Map<string, number>()
  for (const it of itemsMes) {
    const key = it.salon || "General"
    porSalon.set(key, (porSalon.get(key) || 0) + it.monto)
  }
  const ordenSalones = [...SALONES, "General"]
  const resumenSalones = Array.from(porSalon.entries()).sort(
    (a, b) => ordenSalones.indexOf(a[0] as any) - ordenSalones.indexOf(b[0] as any),
  )

  // Construcción de la grilla (semana empieza lunes)
  const primerDia = new Date(anio, mes, 1)
  const offset = (primerDia.getDay() + 6) % 7 // lunes=0
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const celdas: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ]
  while (celdas.length % 7 !== 0) celdas.push(null)

  const hoyISO = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`

  const tituloMes = mesVista.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
  const itemsDiaSel = diaSel ? porDia.get(diaSel) || [] : []

  function colorDe(salon: string | null | undefined): string {
    return salon && salon !== "General" ? salonColor(salon, configuracionCajas) : SALON_COLOR_GENERAL
  }

  function cambiarMes(delta: number) {
    setMesVista((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
    setDiaSel(null)
  }

  const esMesActual = anio === ahora.getFullYear() && mes === ahora.getMonth()

  function irAHoy() {
    setMesVista(new Date(ahora.getFullYear(), ahora.getMonth(), 1))
    setDiaSel(hoyISO)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-purple-600" />
            Calendario de gastos
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs mr-1 bg-transparent"
              onClick={irAHoy}
              disabled={esMesActual}
              aria-label="Ir al mes de hoy"
            >
              Hoy
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[130px] text-center text-sm font-semibold capitalize">{tituloMes}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {resumenSalones.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
            {resumenSalones.map(([salon, subtotal]) => (
              <span key={salon} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: colorDe(salon) }} />
                {salonLabel(salon)}: <span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span>
              </span>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              Total mes: <span className="font-bold text-red-600">{formatCurrency(totalMes)}</span>
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-7 gap-1">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <div key={d} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {d}
            </div>
          ))}
          {celdas.map((dia, idx) => {
            if (dia === null) return <div key={`x-${idx}`} className="min-h-[64px] rounded-md bg-muted/20" />
            const fechaISO = `${mesISO}-${String(dia).padStart(2, "0")}`
            const delDia = porDia.get(fechaISO) || []
            const esHoy = fechaISO === hoyISO
            const seleccionado = fechaISO === diaSel
            const totalDia = delDia.reduce((s, it) => s + it.monto, 0)
            return (
              <button
                key={fechaISO}
                type="button"
                onClick={() => setDiaSel(seleccionado ? null : fechaISO)}
                className={`flex min-h-[64px] flex-col items-stretch gap-0.5 rounded-md border p-1 text-left transition-colors ${
                  seleccionado
                    ? "border-purple-400 bg-purple-50"
                    : esHoy
                      ? "border-purple-300 bg-card"
                      : "border-border bg-card hover:bg-muted/40"
                }`}
                aria-label={`Día ${dia}${delDia.length > 0 ? `, ${delDia.length} gastos por ${formatCurrency(totalDia)}` : ""}`}
              >
                <span className={`text-[11px] font-semibold leading-none ${esHoy ? "text-purple-700" : "text-muted-foreground"}`}>
                  {dia}
                </span>
                {delDia.slice(0, 2).map((it) => (
                  <span
                    key={it.id}
                    className="flex items-center gap-1 truncate rounded px-1 py-px text-[10px] leading-tight"
                    style={{ backgroundColor: `${colorDe(it.salon)}1f`, color: colorDe(it.salon) }}
                    title={`${it.concepto} · ${salonLabel(it.salon || "General")} · ${formatCurrency(it.monto)}`}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: colorDe(it.salon) }} />
                    <span className={`truncate font-medium ${it.estado === "pagado" ? "line-through opacity-60" : ""}`}>
                      {montoCompacto(it.monto)}
                    </span>
                  </span>
                ))}
                {delDia.length > 2 && (
                  <span className="px-1 text-[10px] font-medium text-muted-foreground">+{delDia.length - 2} más</span>
                )}
              </button>
            )
          })}
        </div>

        {diaSel && (
          <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 space-y-2">
            <p className="text-xs font-semibold text-purple-800">
              {formatFecha(diaSel)} · {itemsDiaSel.length} {itemsDiaSel.length === 1 ? "gasto" : "gastos"}
            </p>
            {itemsDiaSel.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin gastos este día.</p>
            ) : (
              itemsDiaSel.map((it) => (
                <div key={it.id} className="flex items-center gap-2.5 rounded-md border border-border bg-card p-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorDe(it.salon) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{it.concepto}</p>
                    <p className="text-xs text-muted-foreground">
                      {salonLabel(it.salon || "General")} · {it.tipo === "fijo" ? "Gasto fijo" : "Gasto variable"}
                    </p>
                  </div>
                  {it.estado === "pagado" ? (
                    <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[11px] shrink-0">pagado</Badge>
                  ) : it.estado === "vencido" ? (
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px] shrink-0">vencido</Badge>
                  ) : null}
                  <span className="shrink-0 text-sm font-bold text-red-600">−{formatCurrency(it.monto)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {itemsMes.length === 0 && (
          <p className="py-2 text-center text-sm text-muted-foreground">
            No hay gastos con fecha en este mes para el filtro seleccionado.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------

// ============================================================
// BUSCADOR DE GASTOS (fijos y variables) con resumen flotante
// ============================================================

interface ResultadoGasto {
  id: string
  concepto: string
  tipo: "fijo" | "variable"
  salon: string | null | undefined
  monto: number
  estado: string
  fecha?: string
}

function BuscadorGastos({
  fijos,
  cubiertos,
  variables,
}: {
  fijos: GastoFijoMes[]
  cubiertos: GastoFijoMes[]
  variables: GastoVariable[]
}) {
  const [query, setQuery] = useState("")
  const abierto = query.trim().length >= 2

  const resultados = useMemo<ResultadoGasto[]>(() => {
    if (!abierto) return []
    const q = query.trim().toLowerCase()
    const deFijos: ResultadoGasto[] = [...fijos, ...cubiertos]
      .filter((g) => g.concepto.toLowerCase().includes(q))
      .map((g) => ({
        id: `f-${g.id}-${g.estado}`,
        concepto: g.concepto,
        tipo: "fijo" as const,
        salon: g.salon,
        monto: g.monto,
        estado: g.estado === "pagado" ? "pagado" : g.estado === "vencido" ? "vencido" : "pendiente",
        fecha: g.fechaVencimiento,
      }))
    const deVariables: ResultadoGasto[] = variables
      .filter((g) => g.nombre.toLowerCase().includes(q))
      .map((g) => ({
        id: `v-${g.id}`,
        concepto: g.nombre,
        tipo: "variable" as const,
        salon: g.salon,
        monto: g.monto,
        estado: g.estado,
        fecha: g.fecha,
      }))
    return [...deFijos, ...deVariables]
  }, [abierto, query, fijos, cubiertos, variables])

  const totalFijos = resultados.filter((r) => r.tipo === "fijo")
  const totalVariables = resultados.filter((r) => r.tipo === "variable")
  const sumaTotal = resultados.reduce((s, r) => s + r.monto, 0)
  const sumaPagado = resultados.filter((r) => r.estado === "pagado").reduce((s, r) => s + r.monto, 0)
  const sumaPendiente = sumaTotal - sumaPagado

  function badgeEstado(estado: string) {
    if (estado === "pagado")
      return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] px-1.5">Pagado</Badge>
    if (estado === "vencido")
      return <Badge className="bg-red-100 text-red-700 border-0 text-[10px] px-1.5">Vencido</Badge>
    return <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] px-1.5">Pendiente</Badge>
  }

  return (
    <div className="relative w-full sm:w-64">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("")
          }}
          placeholder="Buscar gasto fijo o variable..."
          className="h-9 pl-8 pr-8 bg-white text-black"
          aria-label="Buscar gastos fijos o variables"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar busqueda"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {abierto && (
        <div className="absolute left-0 right-0 sm:left-auto sm:right-0 sm:w-96 top-full mt-2 z-50 rounded-xl border border-border bg-white text-black shadow-xl overflow-hidden">
          {resultados.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {"No se encontraron gastos con "}
              <span className="font-medium text-black">{`"${query.trim()}"`}</span>
            </p>
          ) : (
            <>
              {/* Resumen */}
              <div className="px-4 py-3 border-b border-border bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {resultados.length} {resultados.length === 1 ? "resultado" : "resultados"}
                  </span>
                  <span className="text-sm font-bold">{formatCurrency(sumaTotal)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    Fijos: <span className="font-medium text-black">{totalFijos.length}</span> (
                    {formatCurrency(totalFijos.reduce((s, r) => s + r.monto, 0))})
                  </span>
                  <span>
                    Variables: <span className="font-medium text-black">{totalVariables.length}</span> (
                    {formatCurrency(totalVariables.reduce((s, r) => s + r.monto, 0))})
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs">
                  <span className="text-emerald-700">Pagado: {formatCurrency(sumaPagado)}</span>
                  <span className="text-amber-700">Pendiente: {formatCurrency(sumaPendiente)}</span>
                </div>
              </div>

              {/* Lista de coincidencias */}
              <ul className="max-h-64 overflow-y-auto divide-y divide-border">
                {resultados.map((r) => (
                  <li key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.concepto}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.tipo === "fijo" ? "Gasto fijo" : "Gasto variable"}
                        {" · "}
                        {salonLabel(r.salon || "General")}
                        {r.fecha ? ` · vence ${r.fecha.split("-").reverse().join("/")}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-semibold">{formatCurrency(r.monto)}</span>
                      {badgeEstado(r.estado)}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Tarjetas de métricas colapsables (se cierran al entrar)
// ============================================================

function CuerpoColapsable({ colapsado, children }: { colapsado: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`grid flex-1 transition-all duration-700 ease-in-out ${
        colapsado ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
      }`}
    >
      <div className="overflow-hidden flex min-h-0 flex-col">{children}</div>
    </div>
  )
}

function BotonDesplegar({
  colapsado,
  onToggle,
  color = "#000000",
}: {
  colapsado: boolean
  onToggle: () => void
  color?: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className="hover:opacity-70"
      style={{ color }}
      aria-label={colapsado ? "Desplegar tarjetas" : "Contraer tarjetas"}
      title={colapsado ? "Desplegar tarjetas" : "Contraer tarjetas"}
    >
      <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${colapsado ? "" : "rotate-180"}`} />
    </button>
  )
}

export default function CajaJazminePage() {
  // Tarjetas de métricas: se cierran solas al entrar; desplegar una las abre todas
  const [tarjetasColapsadas, setTarjetasColapsadas] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setTarjetasColapsadas(true), 1200)
    return () => clearTimeout(t)
  }, [])
  const {
    state,
    updateCostoOperativo,
    addCostoOperativo,
    deleteCostoOperativo,
    archivarGasto,
    updateEvento,
    addMovimientosCaja,
    updateVendedor,
    configuracionCajas,
  } = useStore()
  const { ahora } = useClock()
  const { toast } = useToast()
  const [salonFiltro, setSalonFiltro] = useState<string>("todos")

  // ── Extracción de dinero de Caja Jazmines (retiro con justificación) ─────
  const [extraerOpen, setExtraerOpen] = useState(false)
  const [extraerMonto, setExtraerMonto] = useState(0)
  const [extraerConcepto, setExtraerConcepto] = useState("")
  // Modo del diálogo: "extraer" (retiro clásico) o "fijar" (colocar el monto
  // real contado y que el sistema registre la diferencia como ajuste).
  const [extraerModo, setExtraerModo] = useState<"extraer" | "fijar">("extraer")

  // Registra una extracción de dinero de Caja Jazmines: genera el egreso en la
  // caja (baja el saldo), lo archiva en el Archivo Histórico y deja rastro en
  // Configuración > Actividad, siempre con el concepto que justifica el retiro.
  function confirmarExtraccion() {
    const monto = extraerMonto
    const concepto = extraerConcepto.trim()
    if (!monto || monto <= 0 || !concepto) return

    const hoyISO = new Date().toISOString()
    const fechaCorta = hoyISO.slice(0, 10)
    const conceptoMov = `Extracción - ${concepto}`

    const saldoPrev = (state.movimientosCaja ?? [])
      .filter((m) => m.cajaDestino === "caja_jazmines")
      .reduce((sum, m) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto), 0)

    addMovimientosCaja([
      {
        id: generateId(),
        fecha: hoyISO,
        tipo: "egreso",
        concepto: conceptoMov,
        monto,
        salon: "",
        cajaDestino: "caja_jazmines",
        saldoResultante: saldoPrev - monto,
      },
    ])

    // Archivo Histórico (extracción de Jazmines = gasto variable)
    archivarGasto({
      fecha: fechaCorta,
      concepto: conceptoMov,
      monto,
      salon: null,
      origen: "caja_jazmines_variable",
      categoria: "extracción",
      eventoId: null,
      eventoNombre: null,
      refId: null,
    })

    // Configuración > Actividad
    fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "caja",
        accion: "extracción",
        nombre: `Caja Jazmines · ${formatCurrency(monto)}`,
        detalle: `Extracci��n de ${formatCurrency(monto)} | Motivo: ${concepto}`,
      }),
    }).catch(() => {})

    toast({
      title: "Extracción registrada",
      description: `Se retiraron ${formatCurrency(monto)} de Caja Jazmines.`,
    })
    setExtraerMonto(0)
    setExtraerConcepto("")
    setExtraerOpen(false)
  }

  // "Colocar monto actual": el usuario indica cuánto dinero REAL hay en la
  // caja y el sistema registra la diferencia contra el saldo del sistema como
  // un ajuste (egreso si falta, ingreso si sobra). Requiere nota obligatoria
  // que queda en el Archivo Histórico y en Configuración > Actividad.
  function confirmarAjusteSaldo() {
    const montoReal = extraerMonto
    const concepto = extraerConcepto.trim()
    if (montoReal < 0 || !concepto) return

    const saldoPrev = (state.movimientosCaja ?? [])
      .filter((m) => m.cajaDestino === "caja_jazmines")
      .reduce((sum, m) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto), 0)

    const diferencia = montoReal - saldoPrev
    if (diferencia === 0) {
      toast({ title: "Sin diferencia", description: "El saldo del sistema ya coincide con el monto indicado." })
      setExtraerOpen(false)
      return
    }

    const hoyISO = new Date().toISOString()
    const fechaCorta = hoyISO.slice(0, 10)
    const esFaltante = diferencia < 0
    const montoAjuste = Math.abs(diferencia)
    const conceptoMov = `Ajuste de saldo - ${concepto}`
    const movId = generateId()

    addMovimientosCaja([
      {
        id: movId,
        fecha: hoyISO,
        tipo: esFaltante ? "egreso" : "ingreso",
        concepto: conceptoMov,
        monto: montoAjuste,
        salon: "",
        cajaDestino: "caja_jazmines",
        saldoResultante: montoReal,
      },
    ])

    // Archivo Histórico: solo los faltantes son un gasto real
    if (esFaltante) {
      archivarGasto({
        fecha: fechaCorta,
        concepto: conceptoMov,
        monto: montoAjuste,
        salon: null,
        origen: "caja_jazmines_variable",
        categoria: "extracción",
        eventoId: null,
        eventoNombre: null,
        refId: movId,
      })
    }

    // Configuración > Actividad
    fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "caja",
        accion: "ajuste de saldo",
        nombre: `Caja Jazmines · saldo fijado en ${formatCurrency(montoReal)}`,
        detalle: `Saldo del sistema: ${formatCurrency(saldoPrev)} → saldo real: ${formatCurrency(montoReal)} (${esFaltante ? "faltante" : "sobrante"} de ${formatCurrency(montoAjuste)}) | Nota: ${concepto}`,
      }),
    }).catch(() => {})

    toast({
      title: "Saldo actualizado",
      description: `Caja Jazmines quedó en ${formatCurrency(montoReal)} (${esFaltante ? "se descontó" : "se sumó"} ${formatCurrency(montoAjuste)}).`,
    })
    setExtraerMonto(0)
    setExtraerConcepto("")
    setExtraerOpen(false)
  }

  const data = useCajaJazmines(state, salonFiltro, ahora)

  const hoyStr = ahora.toISOString().slice(0, 10)

  // Colapsar tarjetas (alertas, fijos, proyección) y ocultar montos de métricas.
  // Al entrar, todas las tarjetas arrancan plegadas y se van abriendo solas,
  // de a una, con la animación escalonada de sus subtarjetas.
  const [colapsadas, setColapsadas] = useState<Record<string, boolean>>({
    alertas: true,
    cuotas: true,
    fijos: true,
    variables: true,
    proyeccion: true,
  })

  // Proyección: se muestran 3 meses y "Ver más" agrega de a 3 hasta los 12.
  // Siempre parte del mes corriente, así se va actualizando mes a mes solo.
  const [mesesProyeccionVisibles, setMesesProyeccionVisibles] = useState(3)

  // Próximos vencimientos: al abrir la tarjeta se muestran de a 5,
  // con "Ver más" para ir agregando de a 5.
  const [alertasVisibles, setAlertasVisibles] = useState(5)

  useEffect(() => {
    // "cuotas" y "alertas" (próximos vencimientos) quedan SIEMPRE colapsadas
    // al entrar; el resto se abre solo con la animación escalonada.
    const orden = ["fijos", "variables", "proyeccion"]
    const timers = orden.map((key, i) =>
      setTimeout(() => {
        setColapsadas((prev) => ({ ...prev, [key]: false }))
      }, 500 + i * 900),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleColapsada = (key: string) =>
    setColapsadas((p) => ({ ...p, [key]: !p[key] }))
  // Los montos del dashboard arrancan OCULTOS: se revelan con el ojito.
  const [montosOcultos, setMontosOcultos] = useState<Record<string, boolean>>({
    saldoActual: true,
    gastos30: true,
    saldoProyectado: true,
    cobroSemana: true,
    gastosSemana: true,
  })
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
    // El historial de evolución se genera solo: cada pago archivado deja
    // registrado cuánto se pagó ese mes (si el mes aún no tiene registro).
    const historial = costo?.historialMontos || []
    const mes = mesActualISO()
    const yaRegistrado = historial.some((r) => r.mes === mes)
    const ultimo = historial.length > 0 ? historial[historial.length - 1] : null
    updateCostoOperativo(gasto.id, {
      pagado: false,
      // Nuevo período: cada salón vuelve a deber su parte del reparto.
      ...(costo?.distribucion && costo.distribucion.length > 0
        ? { distribucion: costo.distribucion.map((d) => ({ ...d, pagado: false })) }
        : {}),
      fechaVencimiento: siguienteVencimiento(costo?.fechaVencimiento, gasto.frecuencia),
      ...(yaRegistrado
        ? {}
        : {
            historialMontos: [
              ...historial,
              {
                id: generateId(),
                mes,
                monto: gasto.monto,
                montoAnterior: ultimo?.monto ?? gasto.monto,
                fecha: new Date().toISOString(),
                nota: "Pago archivado",
              },
            ],
          }),
    })
  }

  // Archivar un gasto VARIABLE (único): lo mueve al archivo y lo quita de la lista activa.
  // La fecha del archivo es la fecha en que se HIZO el gasto (si se cargó); si no, el vencimiento.
  function archivarVariable(gasto: { id: string; nombre: string; salon: string; fecha: string; fechaGasto?: string; monto: number }) {
    archivarGasto({
      fecha: gasto.fechaGasto || gasto.fecha || hoyStr,
      concepto: gasto.nombre,
      monto: gasto.monto,
      salon: gasto.salon || null,
      origen: "caja_jazmines_variable",
      categoria: "Gasto variable",
      refId: gasto.id,
    })
    deleteCostoOperativo(gasto.id)
  }

  // Archivar una COMISIÓN: la registra en el archivo histórico y la oculta de
  // la lista (persiste comisionOculta en el contrato del evento).
  function archivarComision(gasto: GastoVariable) {
    const eventoId = gasto.comisionDetalle?.eventoId
    if (!eventoId) return
    const evento = state.eventos?.find((e) => e.id === eventoId) as EventoGuardado | undefined
    archivarGasto({
      fecha: gasto.fecha || hoyStr,
      concepto: gasto.nombre,
      monto: gasto.monto,
      salon: gasto.salon || null,
      origen: "caja_jazmines_comision",
      categoria: "Comisión vendedor",
      refId: gasto.id,
    })
    updateEvento(eventoId, {
      contrato: { ...(evento?.contrato || {}), comisionOculta: true },
    })
    toast({ title: "Comisión archivada", description: gasto.nombre })
  }

  // Eliminar una COMISIÓN de la lista: solo la oculta (no toca el archivo).
  function eliminarComision(gasto: GastoVariable) {
    const eventoId = gasto.comisionDetalle?.eventoId
    if (!eventoId) return
    const evento = state.eventos?.find((e) => e.id === eventoId) as EventoGuardado | undefined
    updateEvento(eventoId, {
      contrato: { ...(evento?.contrato || {}), comisionOculta: true },
    })
    toast({ title: "Comisión eliminada de la lista", description: gasto.nombre })
  }

  // ── Marcar comisión de vendedor como pagada / pendiente ─────────────────
  // Persiste en el evento (comisionPagada), por lo que también se ve en
  // Eventos → Vendedores. Queda registrado en Configuración → Actividad.
  function marcarComisionPagada(gasto: GastoVariable, pagada: boolean) {
    const eventoId = gasto.comisionDetalle?.eventoId
    if (!eventoId) return
    const hoyISO = new Date()
    const fechaCorta = `${hoyISO.getFullYear()}-${String(hoyISO.getMonth() + 1).padStart(2, "0")}-${String(hoyISO.getDate()).padStart(2, "0")}`
    updateEvento(eventoId, {
      comisionPagada: pagada,
      // null (no undefined) para que el PATCH borre la fecha al desmarcar
      comisionPagadaFecha: (pagada ? fechaCorta : null) as EventoGuardado["comisionPagadaFecha"],
    })
    fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "caja",
        accion: pagada ? "comisión pagada" : "comisión marcada pendiente",
        nombre: gasto.nombre,
        detalle: `${formatCurrency(gasto.monto)} (${gasto.comisionDetalle?.porcentaje}% de ${formatCurrency(gasto.comisionDetalle?.totalEvento ?? 0)}) · evento ${gasto.comisionDetalle?.eventoNombre}`,
      }),
    }).catch(() => {})
    toast({
      title: pagada ? "Comisión pagada" : "Comisión pendiente",
      description: `${gasto.nombre} · ${formatCurrency(gasto.monto)}`,
    })
  }

  // ── Pagar directo desde la tarjeta de alertas ──────────────────────────
  // Dispara la animación de desvanecido y, al terminar, archiva el gasto en
  // el Archivo Histórico (fijo: avanza vencimiento / variable: se elimina).
  const [alertasPagando, setAlertasPagando] = useState<Set<string>>(new Set())

  function pagarDesdeAlerta(alerta: { id: string; concepto: string; monto: number }) {
    const costo = state.costosOperativos?.find((c) => c.id === alerta.id)
    if (!costo) return
    setAlertasPagando((prev) => new Set(prev).add(alerta.id))
    setTimeout(() => {
      if (costo.esVariable) {
        archivarVariable({
          id: costo.id,
          nombre: costo.concepto,
          salon: costo.salon || "",
          fecha: costo.fechaVencimiento || hoyStr,
          monto: costo.monto,
        })
      } else {
        archivarFijo({
          id: costo.id,
          concepto: costo.concepto,
          monto: costo.monto,
          salon: costo.salon,
          frecuencia: costo.frecuencia,
        } as GastoFijoMes)
      }
      toast({
        title: "Pago registrado",
        description: `"${costo.concepto}" se movió al Archivo Histórico.`,
      })
      setAlertasPagando((prev) => {
        const next = new Set(prev)
        next.delete(alerta.id)
        return next
      })
    }, 650)
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
    proyeccionMensual,
    gastosFijosProximoMes,
    estimacionesProximoMes,
  } = data

  // ── Carrusel del dashboard: vista "A 30 días" / "Esta semana" ────────────
  const [vistaDashboard, setVistaDashboard] = useState(0) // 0 = 30 días, 1 = semana

  const { cobroSemanaJaz, cuotasSemanaJazCount, cuotasVencidasJazCount, cobroVencidasJaz, gastosSemanaJaz, gastosSemanaJazDetalle, saldoFinSemanaJaz, rangoSemanaJazLabel } = useMemo(() => {
    const diaSemana = ahora.getDay() // 0 = domingo
    const lunes = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - ((diaSemana + 6) % 7))
    const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6)
    const toISO = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const desde = toISO(lunes)
    const hasta = toISO(domingo)

    // "Cobro esta semana" = todo lo cobrable ya: la parte que REALMENTE entra a
    // Caja Jazmines (montoJazmines; el resto va a Caja Eventos) de las cuotas
    // que vencen entre lunes y domingo MÁS las vencidas de antes que siguen sin
    // cobrarse. data.cuotasPorCobrar ya viene filtrado por salón desde el hook.
    const cuotasSemana = data.cuotasPorCobrar.filter(
      (c) => c.fechaVencimiento >= desde && c.fechaVencimiento <= hasta,
    )
    const cuotasVencidas = data.cuotasPorCobrar.filter((c) => c.fechaVencimiento < desde)
    const cobroVencidas = cuotasVencidas.reduce((s, c) => s + c.montoJazmines, 0)
    // El número principal incluye lo de esta semana + lo vencido pendiente.
    const cobro = cuotasSemana.reduce((s, c) => s + c.montoJazmines, 0) + cobroVencidas

    // Gastos de la semana: fijos y variables pendientes que vencen entre lunes y domingo
    const fijosSemana = data.gastosFijosMes.filter(
      (g) => g.fechaVencimiento && g.fechaVencimiento >= desde && g.fechaVencimiento <= hasta && g.estado !== "pagado",
    )
    const variablesSemana = data.gastosVariables.filter(
      (g) => g.fecha && g.fecha >= desde && g.fecha <= hasta && g.estado !== "pagado",
    )
    const gastos = fijosSemana.reduce((s, g) => s + g.monto, 0) + variablesSemana.reduce((s, g) => s + g.monto, 0)

    const partes: string[] = []
    if (fijosSemana.length > 0) partes.push(`${fijosSemana.length} ${fijosSemana.length === 1 ? "fijo" : "fijos"}`)
    if (variablesSemana.length > 0)
      partes.push(`${variablesSemana.length} ${variablesSemana.length === 1 ? "variable" : "variables"}`)

    const fmt = (d: Date) => d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })
    return {
      cobroSemanaJaz: cobro,
      cuotasSemanaJazCount: cuotasSemana.length,
      cuotasVencidasJazCount: cuotasVencidas.length,
      cobroVencidasJaz: cobroVencidas,
      gastosSemanaJaz: gastos,
      gastosSemanaJazDetalle: partes.join(" · "),
      saldoFinSemanaJaz: data.saldoActual + cobro - gastos,
      rangoSemanaJazLabel: `${fmt(lunes)} — ${fmt(domingo)}`,
    }
  }, [data.cuotasPorCobrar, data.gastosFijosMes, data.gastosVariables, data.saldoActual, ahora])

  // ── Proyección: gastos fijos del 1 al 10 del mes siguiente ──────────────
  // Los gastos fijos agendados se repiten el mes que viene; acá se proyecta
  // cuáles caen entre el día 1 y el 10 del próximo mes para anticipar pagos.
  const [subcarpetaProximoMes, setSubcarpetaProximoMes] = useState(false)
  const proxMesDate = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1)
  const proxMesISO = `${proxMesDate.getFullYear()}-${String(proxMesDate.getMonth() + 1).padStart(2, "0")}`
  const tituloProxMes = proxMesDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" })

  // Tarjeta "Servicios a pagar": hasta el día 19 muestra el mes VIGENTE;
  // a partir del 20 pasa a estimar el mes siguiente (misma regla que el hook).
  const estimacionEsProxMes = ahora.getDate() >= 20
  const mesEstimacionDate = estimacionEsProxMes ? proxMesDate : new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const tituloMesEstimacion = mesEstimacionDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" })

  const gastosProximoMes1al10 = [...data.gastosFijosMes, ...data.gastosFijosCubiertos]
    .map((g) => {
      if (!g.fechaVencimiento) return null
      const [vy, vm, vd] = g.fechaVencimiento.split("-").map(Number)
      if (vd < 1 || vd > 10) return null
      if (g.frecuencia === "Anual") {
        // Solo si el aniversario cae exactamente en el mes próximo
        if (vm !== proxMesDate.getMonth() + 1) return null
        return { ...g, fechaProyectada: `${proxMesISO}-${String(vd).padStart(2, "0")}` }
      }
      // Mensual: se repite todos los meses el mismo día
      return { ...g, fechaProyectada: `${proxMesISO}-${String(vd).padStart(2, "0")}` }
    })
    .filter((g): g is GastoFijoMes & { fechaProyectada: string } => g !== null)
    .sort((a, b) => a.fechaProyectada.localeCompare(b.fechaProyectada))

  const totalProximoMes1al10 = gastosProximoMes1al10.reduce((s, g) => s + g.monto, 0)

  // ── Revelado progresivo de cuotas por cobrar (de 5 en 5 con la rueda) ────
  const CUOTAS_POR_PAGINA = 5
  const [cuotasVisibles, setCuotasVisibles] = useState(CUOTAS_POR_PAGINA)
  const cuotasListaRef = useRef<HTMLDivElement>(null)
  const ultimoWheelRef = useRef(0)
  const totalCuotas = cuotasPorCobrar.length

  useEffect(() => {
    const el = cuotasListaRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      const haciaAbajo = e.deltaY > 0
      const puedeRevelar = haciaAbajo && cuotasVisibles < totalCuotas
      const puedeOcultar = !haciaAbajo && cuotasVisibles > CUOTAS_POR_PAGINA
      if (!puedeRevelar && !puedeOcultar) return

      e.preventDefault()
      const ahora = Date.now()
      if (ahora - ultimoWheelRef.current < 250) return
      ultimoWheelRef.current = ahora

      setCuotasVisibles((v) =>
        haciaAbajo
          ? Math.min(v + CUOTAS_POR_PAGINA, totalCuotas)
          : Math.max(v - CUOTAS_POR_PAGINA, CUOTAS_POR_PAGINA),
      )
    }

    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [cuotasVisibles, totalCuotas])

  // ── Edición de fecha de pago de sueldos de vendedores ───────────────────
  // Solo se edita la fecha acá: los montos se manejan desde Eventos > Vendedores.
  const [editandoSueldoVendedor, setEditandoSueldoVendedor] = useState<GastoFijoMes | null>(null)
  const [fechaPagoSueldo, setFechaPagoSueldo] = useState("")

  function abrirEdicionSueldo(gasto: GastoFijoMes) {
    setFechaPagoSueldo(gasto.fechaVencimiento || "")
    setEditandoSueldoVendedor(gasto)
  }

  function guardarFechaSueldo() {
    if (!editandoSueldoVendedor) return
    const vendedorId = editandoSueldoVendedor.id.replace("sueldo-vendedor-", "")
    updateVendedor(vendedorId, { sueldoFechaPago: fechaPagoSueldo || undefined })
    toast({
      title: "Fecha de pago actualizada",
      description: fechaPagoSueldo
        ? `${editandoSueldoVendedor.concepto} · vence ${formatFecha(fechaPagoSueldo)}`
        : `${editandoSueldoVendedor.concepto} · sin fecha de pago`,
    })
    setEditandoSueldoVendedor(null)
  }

  // ── Edición de gastos fijos ──────────────────────────────────────────────
  const [editandoFijo, setEditandoFijo] = useState<GastoFijoMes | null>(null)
  const [editFijo, setEditFijo] = useState({
    concepto: "",
    monto: "",
    fechaVencimiento: "",
    salon: "",
    repartir: false,
    distribucion: [] as DistribucionSalon[],
    esServicio: false,
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
      repartir: dist.length > 0,
      distribucion: dist,
      esServicio: original?.esServicio ?? false,
    })
  }

  function guardarEditFijo() {
    if (!editandoFijo) return
    if (editRepartoInvalido) return
    const dist = editFijo.repartir
      ? editFijo.distribucion.filter((d) => d.salon && d.porcentaje > 0)
      : []
    // El estado de pago NO se toca desde acá: se maneja solo con el check de la fila.
    updateCostoOperativo(editandoFijo.id, {
      concepto: editFijo.concepto,
      monto: Number(editFijo.monto),
      fechaVencimiento: editFijo.fechaVencimiento || undefined,
      salon: dist.length > 0 ? null : editFijo.salon || null,
      distribucion: dist.length > 0 ? dist : undefined,
      esServicio: editFijo.esServicio,
    })
    setEditandoFijo(null)
  }

  // ── Detalle expandible de la tarjeta "servicios a pagar el mes que viene" ─
  const [detalleProxAbierto, setDetalleProxAbierto] = useState(false)

  // ── Registro de montos pagados (seguimiento de aumentos) ─────────────────
  const [registrandoMonto, setRegistrandoMonto] = useState<GastoFijoMes | null>(null)
  const [formRegistro, setFormRegistro] = useState({ monto: "", mes: "", nota: "" })

  function abrirRegistroMonto(gasto: GastoFijoMes) {
    const original = state.costosOperativos?.find((c) => c.id === gasto.id)
    setRegistrandoMonto(gasto)
    // Prefill con el último monto conocido y el mes que CORRESPONDE cargar:
    // el siguiente al último período registrado en el historial del gasto.
    setFormRegistro({
      monto: String(original?.monto ?? gasto.monto),
      mes: mesQueCorrespondeCargar(original?.historialMontos, original?.fechaVencimiento ?? gasto.fechaVencimiento),
      nota: "",
    })
  }

  function guardarRegistroMonto() {
    if (!registrandoMonto) return
    const montoNum = Number(formRegistro.monto)
    if (!montoNum || montoNum <= 0) return
    const original = state.costosOperativos?.find((c) => c.id === registrandoMonto.id)
    if (!original) return
    let historial = [...(original.historialMontos || [])]
    // Si el monto vigente NO estaba pagado, queda como DEUDA del período anterior:
    // se marca su registro con pagado=false para que muestre un check propio
    // en la fila hasta que se lo pague.
    if (!original.pagado) {
      const ultimo = historial.length > 0 ? historial[historial.length - 1] : null
      if (ultimo) {
        historial = historial.map((r, i) =>
          i === historial.length - 1 ? { ...r, pagado: false } : r,
        )
      } else {
        historial.push({
          id: generateId(),
          mes: mesActualISO(),
          monto: original.monto,
          montoAnterior: original.monto,
          fecha: new Date().toISOString(),
          nota: "Quedó pendiente al cargar el monto siguiente",
          pagado: false,
        })
      }
    }
    const nuevoRegistro: RegistroMonto = {
      id: generateId(),
      mes: formRegistro.mes || mesQueCorrespondeCargar(original.historialMontos, original.fechaVencimiento),
      monto: montoNum,
      montoAnterior: original.monto,
      fecha: new Date().toISOString(),
      nota: formRegistro.nota.trim() || undefined,
    }
    // El nuevo monto pasa a ser la referencia vigente y el gasto queda
    // PENDIENTE de pago al instante (flujo: cargar monto nuevo → pagarlo).
    // Si está repartido, cada salón vuelve a deber su parte del nuevo período.
    updateCostoOperativo(registrandoMonto.id, {
      monto: montoNum,
      pagado: false,
      ...(original.distribucion && original.distribucion.length > 0
        ? { distribucion: original.distribucion.map((d) => ({ ...d, pagado: false })) }
        : {}),
      historialMontos: [...historial, nuevoRegistro],
    })
    setRegistrandoMonto(null)
  }

  /**
   * Marca como pagada (o vuelve a adeudar) una deuda de un período anterior
   * (check ámbar de la fila). Con pagado=false se deshace un pago marcado
   * por error y la franja de deuda reaparece.
   */
  function pagarDeudaAnterior(gastoId: string, registroId: string, pagado = true) {
    const original = state.costosOperativos?.find((c) => c.id === gastoId)
    if (!original) return
    const historial = (original.historialMontos || []).map((r) =>
      r.id === registroId ? { ...r, pagado } : r,
    )
    updateCostoOperativo(gastoId, { historialMontos: historial })
  }

  // ── Evolución de gastos fijos (ventana automática de historial) ──────────
  const [evolucionAbierta, setEvolucionAbierta] = useState(false)
  const [evolucionCostoId, setEvolucionCostoId] = useState<string | null>(null)
  const costosFijosParaEvolucion = (state.costosOperativos || []).filter(
    (c) => c.activo && !c.esVariable,
  )
  // Gastos fijos que aún no tienen monto cargado para el mes corriente:
  // ningún registro del historial pertenece al mes actual.
  const fijosSinCargarMesActual = costosFijosParaEvolucion.filter(
    (c) => !(c.historialMontos || []).some((r) => r.mes === mesActualISO()),
  )

  // Cuota que le corresponde a cada salón de los gastos fijos repartidos.
  // El PAGO se hace desde cada salón: cada cuota tiene su propio check, y
  // cuando todos los salones pagaron su parte el gasto completo queda pagado.
  // La línea de la carpeta General es informativa (muestra el total y avance).
  const cuotasRepartoFijos = new Map<
    string,
    {
      id: string
      concepto: string
      monto: number
      porcentaje: number
      pagado: boolean
      estado: GastoFijoMes["estado"]
      fechaVencimiento?: string
    }[]
  >()
  if (salonFiltro === "todos") {
    for (const g of gastosFijosMes) {
      const orig = state.costosOperativos?.find((c) => c.id === g.id)
      const dist = (orig?.distribucion || []).filter((d) => d && d.salon && d.porcentaje > 0)
      for (const d of dist) {
        const arr = cuotasRepartoFijos.get(d.salon) || []
        arr.push({
          id: g.id,
          concepto: orig!.concepto,
          monto: Math.round((orig!.monto * d.porcentaje) / 100),
          porcentaje: d.porcentaje,
          pagado: d.pagado === true,
          estado: d.pagado === true ? "pagado" : g.estado,
          fechaVencimiento: g.fechaVencimiento ?? undefined,
        })
        cuotasRepartoFijos.set(d.salon, arr)
      }
    }
  }

  /**
   * Marca la parte de UN salón de un gasto repartido como pagada/pendiente.
   * Si con este cambio todos los salones quedan pagos, el gasto completo pasa
   * a pagado; si alguno queda pendiente, el gasto vuelve a pendiente.
   */
  function pagarCuotaSalon(gastoId: string, salon: string, pagado: boolean) {
    const original = state.costosOperativos?.find((c) => c.id === gastoId)
    if (!original) return
    const distActualizada = (original.distribucion || []).map((d) =>
      d.salon === salon ? { ...d, pagado } : d,
    )
    const todosPagados = distActualizada.every((d) => d.pagado === true)
    updateCostoOperativo(gastoId, {
      distribucion: distActualizada,
      pagado: todosPagados,
    })
  }
  function abrirEvolucion(costoId?: string) {
    setEvolucionCostoId(costoId ?? null)
    setEvolucionAbierta(true)
  }
  // Confirmación de eliminación lanzada desde el menú "⋯" de cada gasto fijo
  const [accionMenu, setAccionMenu] = useState<{ tipo: "eliminar"; gasto: GastoFijoMes } | null>(null)
  // Confirmación de archivar/eliminar lanzada desde el menú "⋯" de cada gasto variable
  const [accionVariable, setAccionVariable] = useState<{ tipo: "archivar" | "eliminar"; gasto: GastoVariable } | null>(null)

  // ── Agregar gasto fijo ────────────────��─────────────────────────��────────
  const [modalFijoAbierto, setModalFijoAbierto] = useState(false)
  const [nuevoFijo, setNuevoFijo] = useState({
    concepto: "",
    monto: "",
    // Mes al que corresponde el monto cargado: define desde qué período
    // el gasto figura como pendiente de pago.
    mesCorresponde: mesActualISO(),
    fechaVencimiento: "",
    salon: "",
    frecuencia: "Mensual" as "Mensual" | "Anual",
    repartir: false,
    distribucion: [] as DistribucionSalon[],
    esServicio: false,
  })

  const fijoRepartoInvalido = nuevoFijo.repartir && !repartoValido(nuevoFijo.distribucion)

  function handleAgregarFijo() {
    if (!nuevoFijo.concepto || !nuevoFijo.monto) return
    if (fijoRepartoInvalido) return
    const mesInicial = nuevoFijo.mesCorresponde || mesActualISO()
    if (
      !confirm(
        `¿Agendar el gasto fijo "${nuevoFijo.concepto}" por ${formatCurrency(Number(nuevoFijo.monto))}, correspondiente a ${formatMes(mesInicial)}?`,
      )
    )
      return
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
      esServicio: nuevoFijo.esServicio,
      pagado: false,
      distribucion: dist.length > 0 ? dist : undefined,
      // El mes indicado queda como primer período del historial: desde ahí
      // el gasto figura pendiente y "Cargar nuevo monto" ofrece el siguiente.
      historialMontos: [
        {
          id: generateId(),
          mes: mesInicial,
          monto: Number(nuevoFijo.monto),
          montoAnterior: Number(nuevoFijo.monto),
          fecha: new Date().toISOString(),
          nota: "Alta del gasto",
        },
      ],
    })
    setNuevoFijo({ concepto: "", monto: "", mesCorresponde: mesActualISO(), fechaVencimiento: "", salon: "", frecuencia: "Mensual", repartir: false, distribucion: [], esServicio: false })
    setModalFijoAbierto(false)
  }

  // ── Gastos variables ────────────���─────────────���──────────────────────────
  const [modalVariableAbierto, setModalVariableAbierto] = useState(false)
  const [nuevoGasto, setNuevoGasto] = useState({
    nombre: "",
    monto: "",
    salon: "",
    fecha: "",
    fechaGasto: "",
    repartir: false,
    distribucion: [] as DistribucionSalon[],
  })
  // Si tiene valor, el modal de gasto variable está editando ese costo operativo.
  const [editandoVariableId, setEditandoVariableId] = useState<string | null>(null)

  const variableRepartoInvalido = nuevoGasto.repartir && !repartoValido(nuevoGasto.distribucion)

  const totalGastosFijos = gastosFijosMes.reduce((s, g) => s + g.monto, 0)
  // Desglose del "Sale" a 30 días: fijos/sueldos pendientes vs. variables agendados.
  // Los fijos pendientes son gastosFijosMes; el resto del total son los variables.
  const gastosFijosPendientes30 = Math.min(totalGastosFijos, gastosPróximos30Dias)
  const gastosVariablesPendientes30 = Math.max(0, gastosPróximos30Dias - gastosFijosPendientes30)

  function handleAgregarGasto() {
    if (!nuevoGasto.nombre || !nuevoGasto.monto || !nuevoGasto.fecha) return
    if (nuevoGasto.repartir) {
      if (variableRepartoInvalido) return
    } else if (!nuevoGasto.salon) {
      return
    }
    const esEdicion = !!editandoVariableId
    if (!esEdicion && !confirm(`¿Agendar el gasto "${nuevoGasto.nombre}" por ${formatCurrency(Number(nuevoGasto.monto))} con vencimiento el ${nuevoGasto.fecha}?`)) return
    const dist = nuevoGasto.repartir
      ? nuevoGasto.distribucion.filter((d) => d.salon && d.porcentaje > 0)
      : []
    if (esEdicion) {
      updateCostoOperativo(editandoVariableId, {
        concepto: nuevoGasto.nombre,
        monto: Number(nuevoGasto.monto),
        salon: dist.length > 0 ? null : nuevoGasto.salon,
        fechaVencimiento: nuevoGasto.fecha,
        fechaGasto: nuevoGasto.fechaGasto || undefined,
        distribucion: dist.length > 0 ? dist : undefined,
      })
      toast({ title: "Gasto actualizado", description: nuevoGasto.nombre })
    } else {
      addCostoOperativo({
        concepto: nuevoGasto.nombre,
        tipo: "Gastos Generales" as any,
        monto: Number(nuevoGasto.monto),
        frecuencia: "Por Evento",
        esPorPersona: false,
        salon: dist.length > 0 ? null : nuevoGasto.salon,
        activo: true,
        fechaVencimiento: nuevoGasto.fecha,
        fechaGasto: nuevoGasto.fechaGasto || undefined,
        esVariable: true,
        pagado: false,
        distribucion: dist.length > 0 ? dist : undefined,
      })
    }
    setNuevoGasto({ nombre: "", monto: "", salon: "", fecha: "", fechaGasto: "", repartir: false, distribucion: [] })
    setEditandoVariableId(null)
    setModalVariableAbierto(false)
  }

  // Abre el modal de gasto variable en modo edición con los datos del gasto.
  function abrirEdicionVariable(gasto: GastoVariable) {
    const orig = state.costosOperativos?.find((c) => c.id === gasto.id)
    if (!orig) return
    const dist = (orig.distribucion || []).filter((d) => d && d.salon && d.porcentaje > 0)
    setNuevoGasto({
      nombre: orig.concepto,
      monto: String(orig.monto),
      salon: orig.salon || "",
      fecha: orig.fechaVencimiento || "",
      fechaGasto: orig.fechaGasto || "",
      repartir: dist.length > 0,
      distribucion: dist,
    })
    setEditandoVariableId(gasto.id)
    setModalVariableAbierto(true)
  }

  // Color del salón activo: tiñe el icono del header y el fondo del body.
  const colorSalonActivo =
    salonFiltro === "todos" ? SALON_COLOR_GENERAL : salonColor(salonFiltro, configuracionCajas)

  return (
    <div
      className="mx-auto w-full max-w-[1720px] px-4 lg:px-6 py-6 flex flex-col gap-4 transition-colors duration-500"
      style={{
        backgroundColor:
          salonFiltro === "todos"
            ? undefined
            : `color-mix(in srgb, ${colorSalonActivo} 7%, transparent)`,
      }}
    >
      {/* Header: nav fijo, siempre visible al scrollear, fondo siempre blanco */}
      <div
        className="sticky top-0 z-30 -mx-4 lg:-mx-6 -mt-6 px-4 lg:px-6 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3"
        style={{ backgroundColor: "#ffffff" }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-500"
            style={{ backgroundColor: `color-mix(in srgb, ${colorSalonActivo} 16%, white)` }}
          >
            <Building className="h-5 w-5 transition-colors duration-500" style={{ color: colorSalonActivo }} />
          </div>
          <h1 className="text-lg xl:text-2xl font-bold tracking-tight truncate" style={{ color: "#000000" }}>
            Caja Jazmines
            <span style={{ color: colorSalonActivo }}>
              {` · ${salonFiltro === "todos" ? "Todos los salones" : salonLabel(salonFiltro)}`}
            </span>
          </h1>
        </div>
        <BuscadorGastos
          fijos={gastosFijosMes}
          cubiertos={gastosFijosCubiertos}
          variables={gastosVariablesCombinados}
        />
        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-700">
            Cambiar salón
            <ArrowRight className="h-4 w-4 animate-pulse" aria-hidden="true" />
          </span>
          <Select value={salonFiltro} onValueChange={setSalonFiltro}>
            <SelectTrigger className="w-[180px] h-9" aria-label="Filtrar por salón">
              <SelectValue placeholder="Todos los salones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los salones</SelectItem>
              {SALONES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-2">
                    <SalonDot salon={s} size={8} />
                    {salonLabel(s)}
                  </span>
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

      {/* Métricas: 6 indicadores compactos (30 días + esta semana) en una sola fila */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* ── Slide 1: A 30 DÍAS ────────────────────────────────── */}
            <div className="contents">
              <Card
                style={{ backgroundColor: "rgba(255, 255, 255, 0.25)" }}
                className="cursor-pointer transition-colors hover:bg-white/40"
                onClick={() => {
                  setExtraerMonto(0)
                  setExtraerConcepto("")
                  setExtraerModo("extraer")
                  setExtraerOpen(true)
                }}
                role="button"
                tabIndex={0}
                aria-label="Extraer o ajustar dinero de Caja Jazmines"
              >
                <CardContent className="p-4 flex h-full flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium uppercase tracking-wide" style={{ color: "#0035db" }}>Saldo Actual</p>
                    <div className="flex items-center gap-1.5">
                      <Wallet className="h-4 w-4" style={{ color: "#0035db" }} />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleMonto("saldoActual")
                        }}
                        style={{ color: "#0035db" }}
                        className="hover:opacity-80"
                        aria-label={montosOcultos.saldoActual ? "Mostrar saldo actual" : "Ocultar saldo actual"}
                        title={montosOcultos.saldoActual ? "Mostrar monto" : "Ocultar monto"}
                      >
                        {montosOcultos.saldoActual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <BotonDesplegar
                        colapsado={tarjetasColapsadas}
                        onToggle={() => setTarjetasColapsadas((v) => !v)}
                        color="#0035db"
                      />
                    </div>
                  </div>
                  <CuerpoColapsable colapsado={tarjetasColapsadas}>
                    <p className="text-2xl font-bold" style={{ color: "#3c4ce8" }}>
                      {montosOcultos.saldoActual ? MONTO_OCULTO : formatCurrency(saldoActual)}
                    </p>
                    <p
                      className="text-xs mt-auto pt-1 flex items-center gap-1.5 font-semibold"
                      style={{ color: colorSalonActivo }}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: colorSalonActivo }}
                        aria-hidden="true"
                      />
                      {salonFiltro === "todos" ? "Todos los salones" : salonLabel(salonFiltro)}
                    </p>
                  </CuerpoColapsable>
                </CardContent>
              </Card>

              <Card className="border-border" style={{ backgroundColor: "#ffffff", color: "#000000" }}>
                <CardContent className="p-4 flex h-full flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#000000" }}>
                      Gastos A 30 días
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleMonto("gastos30")}
                        className="hover:opacity-70"
                        style={{ color: "#000000" }}
                        aria-label={montosOcultos.gastos30 ? "Mostrar gastos próximos" : "Ocultar gastos próximos"}
                        title={montosOcultos.gastos30 ? "Mostrar monto" : "Ocultar monto"}
                      >
                        {montosOcultos.gastos30 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <BotonDesplegar
                        colapsado={tarjetasColapsadas}
                        onToggle={() => setTarjetasColapsadas((v) => !v)}
                      />
                    </div>
                  </div>
                  <CuerpoColapsable colapsado={tarjetasColapsadas}>
                    <p className="text-2xl font-bold" style={{ color: "#000000" }}>
                      {montosOcultos.gastos30 ? MONTO_OCULTO : formatCurrency(gastosPróximos30Dias)}
                    </p>
                    <p className="text-xs mt-auto pt-1" style={{ color: "#000000" }}>Gastos pendientes</p>
                  </CuerpoColapsable>
                </CardContent>
              </Card>

              <Card className="border-border" style={{ backgroundColor: "#ffffff", color: "#000000" }}>
                <CardContent className="p-4 flex h-full flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#000000" }}>
                      Saldo a 30 días
                    </p>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4" style={{ color: "#000000" }} />
                      <button
                        type="button"
                        onClick={() => toggleMonto("saldoProyectado")}
                        className="hover:opacity-70"
                        style={{ color: "#000000" }}
                        aria-label={montosOcultos.saldoProyectado ? "Mostrar saldo proyectado" : "Ocultar saldo proyectado"}
                        title={montosOcultos.saldoProyectado ? "Mostrar monto" : "Ocultar monto"}
                      >
                        {montosOcultos.saldoProyectado ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <BotonDesplegar
                        colapsado={tarjetasColapsadas}
                        onToggle={() => setTarjetasColapsadas((v) => !v)}
                      />
                    </div>
                  </div>
                  <CuerpoColapsable colapsado={tarjetasColapsadas}>
                    <p className="text-2xl font-bold" style={{ color: "#000000" }}>
                      {montosOcultos.saldoProyectado ? MONTO_OCULTO : formatCurrency(saldoProyectado30Dias)}
                    </p>
                    {(() => {
                      const mesKeyActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`
                      const cuotasMes = cuotasPorCobrar.filter((c) => c.fechaVencimiento.slice(0, 7) === mesKeyActual)
                      return (
                        <p className="text-xs mt-auto pt-1" style={{ color: "#000000" }}>
                          {cuotasMes.length > 0
                            ? `${cuotasMes.length} ${cuotasMes.length === 1 ? "cuota" : "cuotas"}`
                            : "Sin cuotas este mes"}
                        </p>
                      )
                    })()}
                  </CuerpoColapsable>
                </CardContent>
              </Card>
            </div>

            {/* ── Slide 2: ESTA SEMANA ──────────────────────────────── */}
            <div className="contents">
              <Card className="border-border" style={{ backgroundColor: "#ffffff", color: "#000000" }}>
                <CardContent className="p-4 flex h-full flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#000000" }} title={rangoSemanaJazLabel}>
                      Cobro esta semana
                    </p>
                    <div className="flex items-center gap-1.5">
                      <ArrowDownToLine className="h-4 w-4" style={{ color: "#000000" }} />
                      <button
                        type="button"
                        onClick={() => toggleMonto("cobroSemana")}
                        className="hover:opacity-70"
                        style={{ color: "#000000" }}
                        aria-label={montosOcultos.cobroSemana ? "Mostrar cobro de esta semana" : "Ocultar cobro de esta semana"}
                        title={montosOcultos.cobroSemana ? "Mostrar monto" : "Ocultar monto"}
                      >
                        {montosOcultos.cobroSemana ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <BotonDesplegar
                        colapsado={tarjetasColapsadas}
                        onToggle={() => setTarjetasColapsadas((v) => !v)}
                      />
                    </div>
                  </div>
                  <CuerpoColapsable colapsado={tarjetasColapsadas}>
                    <p className="text-2xl font-bold" style={{ color: "#000000" }}>
                      {montosOcultos.cobroSemana ? MONTO_OCULTO : `+${formatCurrency(cobroSemanaJaz)}`}
                    </p>
                    <p className="text-xs mt-auto pt-1" style={{ color: "#000000" }}>
                      {(() => {
                        const total = cuotasSemanaJazCount + cuotasVencidasJazCount
                        return total > 0
                          ? `${total} ${total === 1 ? "cuota a cobrar" : "cuotas a cobrar"} (parte Jazmines)`
                          : "Nada por cobrar esta semana"
                      })()}
                      {cuotasVencidasJazCount > 0 && (
                        <span className="font-semibold" style={{ color: "#000000" }}>
                          {` · incluye ${cuotasVencidasJazCount} ${cuotasVencidasJazCount === 1 ? "vencida" : "vencidas"} (${montosOcultos.cobroSemana ? MONTO_OCULTO : formatCurrency(cobroVencidasJaz)})`}
                        </span>
                      )}
                    </p>
                  </CuerpoColapsable>
                </CardContent>
              </Card>

              <Card className="border-border" style={{ backgroundColor: "#ffffff", color: "#000000" }}>
                <CardContent className="p-4 flex h-full flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#000000" }}>Gastos esta semana</p>
                    <div className="flex items-center gap-1.5">
                      <ArrowUpFromLine className="h-4 w-4" style={{ color: "#000000" }} />
                      <button
                        type="button"
                        onClick={() => toggleMonto("gastosSemana")}
                        className="hover:opacity-70"
                        style={{ color: "#000000" }}
                        aria-label={montosOcultos.gastosSemana ? "Mostrar gastos de esta semana" : "Ocultar gastos de esta semana"}
                        title={montosOcultos.gastosSemana ? "Mostrar monto" : "Ocultar monto"}
                      >
                        {montosOcultos.gastosSemana ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <BotonDesplegar
                        colapsado={tarjetasColapsadas}
                        onToggle={() => setTarjetasColapsadas((v) => !v)}
                      />
                    </div>
                  </div>
                  <CuerpoColapsable colapsado={tarjetasColapsadas}>
                    <p className="text-2xl font-bold" style={{ color: "#000000" }}>
                      {montosOcultos.gastosSemana ? MONTO_OCULTO : `−${formatCurrency(gastosSemanaJaz)}`}
                    </p>
                    <p className="text-xs mt-auto pt-1" style={{ color: "#000000" }}>
                      {gastosSemanaJazDetalle || "Sin gastos esta semana"}
                    </p>
                  </CuerpoColapsable>
                </CardContent>
              </Card>

              <Card className="border-border" style={{ backgroundColor: "#ffffff", color: "#000000" }}>
                <CardContent className="p-4 flex h-full flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#000000" }}>
                      Tengo a fin de semana
                    </p>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4" style={{ color: "#000000" }} />
                      <BotonDesplegar
                        colapsado={tarjetasColapsadas}
                        onToggle={() => setTarjetasColapsadas((v) => !v)}
                      />
                    </div>
                  </div>
                  <CuerpoColapsable colapsado={tarjetasColapsadas}>
                    <p className="text-2xl font-bold" style={{ color: "#000000" }}>
                      {montosOcultos.saldoProyectado ? MONTO_OCULTO : formatCurrency(saldoFinSemanaJaz)}
                    </p>
                    <p className="text-xs mt-auto pt-1" style={{ color: "#000000" }}>
                      Saldo actual + cobros − gastos
                    </p>
                  </CuerpoColapsable>
                </CardContent>
              </Card>
            </div>
      </div>

      {/* Última fila: proyección a 12 meses + servicios a pagar al lado */}
      <div className="order-last grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
      <div className="space-y-4 md:col-span-5 2xl:col-span-4 md:order-2">
      {/* SERVICIOS A PAGAR EL MES QUE VIENE — estimado según historial de montos */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Receipt className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">
                  {estimacionEsProxMes ? "Servicios a pagar el mes que viene" : "Servicios a pagar este mes"}
                </p>
                <p className="text-xs text-amber-700/70 mt-0.5 text-pretty">
                  {estimacionEsProxMes
                    ? `Estimado para ${tituloMesEstimacion} según los últimos montos pagados y su tendencia.`
                    : `Servicios de ${tituloMesEstimacion} según los montos agendados. A partir del día 20 se estima el mes siguiente.`}
                </p>
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-800 shrink-0">
              {montosOcultos.gastos30 ? MONTO_OCULTO : `≈ ${formatCurrency(gastosFijosProximoMes)}`}
            </p>
          </div>
          {estimacionesProximoMes.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-900 transition-colors"
                onClick={() => setDetalleProxAbierto((v) => !v)}
                aria-expanded={detalleProxAbierto}
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${detalleProxAbierto ? "rotate-180" : ""}`} />
                {detalleProxAbierto ? "Ocultar detalle" : `Ver detalle (${estimacionesProximoMes.length})`}
              </button>
              {detalleProxAbierto && (() => {
                const renderEstimacion = (est: (typeof estimacionesProximoMes)[number]) => (
                  <div key={est.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{est.concepto}</p>
                      <p className="text-xs text-muted-foreground">
                        {est.tipo === "sueldos"
                          ? "Sueldos del equipo de ventas"
                          : est.tipo === "anual"
                            ? estimacionEsProxMes
                              ? "Vence el mes que viene"
                              : "Vence este mes"
                            : est.registros >= 2
                              ? `Último pagado: ${formatCurrency(est.montoActual)} · ${est.registros} pagos registrados`
                              : est.registros === 1
                                ? `Último pagado: ${formatCurrency(est.montoActual)} · 1 pago registrado`
                                : "Sin historial: se usa el monto agendado"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {montosOcultos.gastos30 ? MONTO_OCULTO : `≈ ${formatCurrency(est.estimado)}`}
                      </p>
                    </div>
                  </div>
                )
                // Vista "Todos los salones": carpetas por salón, como en Gastos fijos.
                if (salonFiltro === "todos") {
                  return (
                    <div className="mt-2 space-y-2">
                      {agruparPorSalon(
                        estimacionesProximoMes.map((est) => ({ ...est, monto: est.estimado })),
                      ).map((carpeta) => (
                        <CarpetaGastos
                          key={`serv-${carpeta.salon}`}
                          salon={carpeta.salon}
                          count={carpeta.items.length}
                          subtotal={carpeta.subtotal}
                          unidad="servicio"
                        >
                          <div className="divide-y divide-amber-200/70 rounded-lg border border-amber-200 bg-white/60">
                            {carpeta.items.map(renderEstimacion)}
                          </div>
                        </CarpetaGastos>
                      ))}
                    </div>
                  )
                }
                // Vista de un salón: lista plana como siempre.
                return (
                  <div className="mt-2 divide-y divide-amber-200/70 rounded-lg border border-amber-200 bg-white/60">
                    {estimacionesProximoMes.map(renderEstimacion)}
                  </div>
                )
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proyección visual del saldo a 30 d��as (columna lateral) — oculta temporalmente */}
      {false && (
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
        <CardContent className="space-y-1 reveal-stagger">
          {/* Resumen tipo cuenta: tengo + entra − sale = me queda */}
          <div className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-muted/50">
            <span className="text-sm text-muted-foreground">Tengo hoy</span>
            <span className="text-base font-semibold text-foreground">{formatCurrency(saldoActual)}</span>
          </div>

          <div className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-emerald-50">
            <span className="text-sm font-medium text-emerald-800">Entra (cuotas parte Jazmines)</span>
            <span className="text-base font-bold text-emerald-700">+ {formatCurrency(ingresosProyectados30Dias)}</span>
          </div>

          <div className="rounded-lg bg-red-50 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-red-800">Sale (gastos fijos + variables)</span>
              <span className="text-base font-bold text-red-700">− {formatCurrency(gastosPróximos30Dias)}</span>
            </div>
            <div className="mt-1.5 flex flex-col gap-0.5 border-t border-red-100 pt-1.5">
              <div className="flex items-center justify-between text-xs text-red-700/80">
                <span>Fijos y sueldos pendientes</span>
                <span>{formatCurrency(gastosFijosPendientes30)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-red-700/80">
                <span>Variables agendados</span>
                <span>{formatCurrency(gastosVariablesPendientes30)}</span>
              </div>
            </div>
          </div>

          <div
            className={`flex items-center justify-between rounded-lg px-3 py-3 border-2 ${
              saldoProyectado30Dias >= 0 ? "border-teal-200 bg-teal-50" : "border-red-300 bg-red-50"
            }`}
          >
            <span className={`text-sm font-bold ${saldoProyectado30Dias >= 0 ? "text-teal-800" : "text-red-800"}`}>
              Me queda
            </span>
            <span className={`text-2xl font-bold ${saldoProyectado30Dias >= 0 ? "text-teal-700" : "text-red-600"}`}>
              {formatCurrency(saldoProyectado30Dias)}
            </span>
          </div>
        </CardContent>
        )}
      </Card>
      )}
      </div>

      {/* PROYECCIÓN MENSUAL — tabla a 12 meses */}
      <Card className="md:col-span-7 2xl:col-span-8 md:order-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-600" />
            Proyección en 12 meses:
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1 text-pretty">
            A cobrar: parte Jazmines de cada cuota. A pagar: gastos fijos, sueldos y variables agendados.
            El saldo parte del saldo actual de la caja.
          </p>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6 font-bold">Mes</TableHead>
                <TableHead className="text-center font-bold">A cobrar</TableHead>
                <TableHead className="text-center font-bold">A pagar</TableHead>
                <TableHead className="text-center font-bold">Balance</TableHead>
                <TableHead className="text-right pr-6 font-bold">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proyeccionMensual.slice(0, mesesProyeccionVisibles).map((m) => (
                <TableRow key={m.key} className={m.esActual ? "bg-teal-50/60" : ""}>
                  <TableCell className="pl-6 capitalize font-medium">
                    {m.label}
                    {m.esActual && <Badge className="ml-2 bg-teal-100 text-teal-700 border-teal-200 text-[10px]">actual</Badge>}
                  </TableCell>
                  <TableCell className="text-center text-emerald-700 font-medium">
                    {m.aCobrar > 0 ? `+${formatCurrency(m.aCobrar)}` : "—"}
                  </TableCell>
                  <TableCell className="text-center text-[var(--accent)] font-medium">
                    {m.aPagar > 0 ? `−${formatCurrency(m.aPagar)}` : "—"}
                  </TableCell>
                  <TableCell className={`text-center font-bold ${m.balance >= 0 ? "text-foreground" : "text-red-600"}`}>
                    {m.balance >= 0 ? "+" : ""}{formatCurrency(m.balance)}
                  </TableCell>
                  <TableCell className={`text-right pr-6 font-bold ${m.saldoProyectado >= 0 ? "text-teal-700" : "text-red-600"}`}>
                    {montosOcultos.saldoProyectado ? MONTO_OCULTO : formatCurrency(m.saldoProyectado)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(mesesProyeccionVisibles < proyeccionMensual.length || mesesProyeccionVisibles > 3) && (
            <div className="flex items-center justify-center gap-2 px-6 pt-3">
              {mesesProyeccionVisibles < proyeccionMensual.length && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-teal-700 border-teal-200 hover:bg-teal-50 bg-transparent"
                  onClick={() =>
                    setMesesProyeccionVisibles((v) => Math.min(v + 3, proyeccionMensual.length))
                  }
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  {`Ver 3 meses más (${Math.min(3, proyeccionMensual.length - mesesProyeccionVisibles)} de ${proyeccionMensual.length - mesesProyeccionVisibles} restantes)`}
                </Button>
              )}
              {mesesProyeccionVisibles > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setMesesProyeccionVisibles(3)}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  Ver menos
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Cuotas + Fijos (columna izquierda) y Vencimientos + Variables (columna derecha).
          Columnas independientes ancladas ARRIBA: la fila 1 mide solo el alto de su
          tarjeta (grid-rows auto) y cada tarjeta se alinea a su tope (items-start),
          así al plegar una tarjeta la de abajo sube al instante y nada queda flotando. */}
      <div className="grid grid-cols-1 md:grid-cols-2 md:grid-rows-[auto_auto_1fr] gap-4 items-start">

      {/* Alertas de vencimiento (columna derecha, fila 2) */}
      <Card className={`md:col-start-2 md:row-start-2 ${colapsadas.alertas ? "py-3 gap-0" : ""}`} style={{ backgroundColor: "#f5ffbd", color: "#000000" }}>
        <CardHeader className={colapsadas.alertas ? "pb-0" : "pb-3"}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Proximos vencimientos
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
        <CardContent className="space-y-2 reveal-stagger">
          {alertasVencimiento.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay vencimientos en los próximos 30 días.
            </p>
          ) : (
            <>
              {(() => {
                const renderAlerta = (alerta: (typeof alertasVencimiento)[number]) => (
                  <div
                    key={alerta.id}
                    className={`flex items-start gap-3 rounded-lg border border-border bg-card p-3 ${
                      alertasPagando.has(alerta.id) ? "fade-out-paid" : ""
                    }`}
                  >
                    {puntoPrioridad(alerta.estado)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{alerta.concepto}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="capitalize">{descripcionAlerta(alerta.diasRestantes, alerta.estado)}</span>
                        {alerta.salon && (
                          <span className="inline-flex items-center gap-1 align-middle">
                            {" · "}
                            <SalonDot salon={alerta.salon} size={7} />
                            {salonLabel(alerta.salon)}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-red-600 shrink-0">
                      {formatCurrency(alerta.monto)}
                    </span>
                    <ConfirmAction
                      title="¿Marcar como pagado?"
                      description={`Se registra el pago de "${alerta.concepto}" (${formatCurrency(alerta.monto)}) y se mueve al Archivo Histórico.`}
                      confirmLabel="Sí, marcar pagado"
                      onConfirm={() => pagarDesdeAlerta(alerta)}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-teal-600"
                        title="Marcar como pagado"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="sr-only">Marcar {alerta.concepto} como pagado</span>
                      </Button>
                    </ConfirmAction>
                  </div>
                )
                // Vista "Todos los salones": carpetas por salón, como en Gastos fijos.
                if (salonFiltro === "todos") {
                  return agruparPorSalon(alertasVencimiento).map((carpeta) => {
                    // Contadores por prioridad, visibles con la carpeta cerrada,
                    // para saber a qué carpeta entrar primero.
                    const rojos = carpeta.items.filter((a) => a.estado === "vencido" || a.estado === "urgente").length
                    const ambar = carpeta.items.filter((a) => a.estado === "proximo").length
                    const verdes = carpeta.items.length - rojos - ambar
                    return (
                      <CarpetaGastos
                        key={`venc-${carpeta.salon}`}
                        salon={carpeta.salon}
                        count={carpeta.items.length}
                        subtotal={carpeta.subtotal}
                        unidad="vencimiento"
                        resumen={
                          <span className="flex items-center gap-2 shrink-0">
                            {rojos > 0 && (
                              <span
                                className="flex items-center gap-1 text-[11px] font-bold text-red-600"
                                title={`${rojos} urgente${rojos !== 1 ? "s" : ""} / vencido${rojos !== 1 ? "s" : ""}`}
                              >
                                <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
                                {rojos}
                                <span className="sr-only">urgentes o vencidos</span>
                              </span>
                            )}
                            {ambar > 0 && (
                              <span
                                className="flex items-center gap-1 text-[11px] font-bold text-amber-600"
                                title={`${ambar} con menos de 7 días`}
                              >
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />
                                {ambar}
                                <span className="sr-only">con menos de 7 días</span>
                              </span>
                            )}
                            {verdes > 0 && (
                              <span
                                className="flex items-center gap-1 text-[11px] font-bold text-teal-600"
                                title={`${verdes} con más de 7 días`}
                              >
                                <span className="h-2.5 w-2.5 rounded-full bg-teal-500" aria-hidden="true" />
                                {verdes}
                                <span className="sr-only">con más de 7 días</span>
                              </span>
                            )}
                          </span>
                        }
                      >
                        {carpeta.items.map(renderAlerta)}
                      </CarpetaGastos>
                    )
                  })
                }
                // Vista de un salón: lista plana con paginado de a 5.
                return (
                  <>
                    {alertasVencimiento.slice(0, alertasVisibles).map(renderAlerta)}
                    {(alertasVencimiento.length > alertasVisibles || alertasVisibles > 5) && (
                      <div className="flex items-center justify-center gap-2 pt-1">
                        {alertasVencimiento.length > alertasVisibles && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent text-amber-700 border-amber-300 hover:bg-amber-50"
                            onClick={() => setAlertasVisibles((v) => v + 5)}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                            {`Ver 5 más (${alertasVencimiento.length - alertasVisibles} restantes)`}
                          </Button>
                        )}
                        {alertasVisibles > 5 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => setAlertasVisibles(5)}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                            Ver menos
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}
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

          {/* ── Subcarpeta: proyección del 1 al 10 del mes siguiente ───��── */}
          <div className="mt-2 rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setSubcarpetaProximoMes((v) => !v)}
              className="w-full flex items-center gap-2 bg-muted/50 hover:bg-muted px-3 py-2 text-left transition-colors"
              aria-expanded={subcarpetaProximoMes}
            >
              {subcarpetaProximoMes
                ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="text-xs font-semibold text-foreground capitalize flex-1">
                Del 1 al 10 de {tituloProxMes}
              </span>
              {gastosProximoMes1al10.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]">
                  {gastosProximoMes1al10.length}
                </Badge>
              )}
              <span className="text-xs font-bold text-red-600 tabular-nums">
                {formatCurrency(totalProximoMes1al10)}
              </span>
            </button>
            {subcarpetaProximoMes && (
              <div className="space-y-2 bg-card p-2 reveal-stagger">
                {gastosProximoMes1al10.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center">
                    No hay gastos fijos agendados del 1 al 10 del mes próximo.
                  </p>
                ) : (
                  gastosProximoMes1al10.map((g) => (
                    <div
                      key={`prox-${g.id}`}
                      className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                    >
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{g.concepto}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Vence el {formatFecha(g.fechaProyectada)}
                          {g.salon && (
                            <span className="inline-flex items-center gap-1 align-middle">
                              {" · "}
                              <SalonDot salon={g.salon} size={7} />
                              {salonLabel(g.salon)}
                            </span>
                          )}
                          {" · "}
                          {g.frecuencia}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-red-600 shrink-0">
                        {formatCurrency(g.monto)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
        )}
      </Card>

      {/* Cuotas por cobrar: columna derecha, debajo de Próximos vencimientos */}
      <Card
        className={`md:col-start-2 md:row-start-3 ${colapsadas.cuotas ? "py-3 gap-0" : ""}`}
        style={{ backgroundColor: "#cdf7c6" }}
      >
        <CardHeader className={colapsadas.cuotas ? "pb-0" : "pb-3"}>
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
          <CardContent>
            {cuotasPorCobrar.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No hay cuotas pendientes de cobro.
              </p>
            ) : (
              <div ref={cuotasListaRef} className="space-y-2 reveal-stagger">
                {(() => {
                  const renderCuota = (cuota: (typeof cuotasPorCobrar)[number]) => (
                    <div
                      key={cuota.id}
                      className="w-full flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{cuota.eventoNombre}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cuota {cuota.numeroCuota}/{cuota.totalCuotas} · vence {formatFecha(cuota.fechaVencimiento)}
                          {cuota.salon && (
                            <span className="inline-flex items-center gap-1 align-middle">
                              {" · "}
                              <SalonDot salon={cuota.salon} size={7} />
                              {salonLabel(cuota.salon)}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-emerald-700 shrink-0">
                        +{formatCurrency(cuota.montoJazmines)}
                      </span>
                    </div>
                  )
                  // Vista "Todos los salones": carpetas por salón, como en Gastos fijos.
                  // El subtotal de cada carpeta es la parte Jazmines (lo que entra a esta caja).
                  if (salonFiltro === "todos") {
                    return agruparPorSalon(
                      cuotasPorCobrar.map((c) => ({ ...c, monto: c.montoJazmines })),
                    ).map((carpeta) => (
                      <CarpetaGastos
                        key={`cuota-${carpeta.salon}`}
                        salon={carpeta.salon}
                        count={carpeta.items.length}
                        subtotal={carpeta.subtotal}
                        unidad="cuota"
                      >
                        {carpeta.items.map(renderCuota)}
                      </CarpetaGastos>
                    ))
                  }
                  // Vista de un salón: lista plana con revelado por scroll.
                  return (
                    <>
                      {cuotasPorCobrar.slice(0, cuotasVisibles).map(renderCuota)}
                      {totalCuotas > CUOTAS_POR_PAGINA && (
                        <p className="text-[11px] text-emerald-700/70 text-center pt-1 select-none">
                          Mostrando {Math.min(cuotasVisibles, totalCuotas)} de {totalCuotas}
                          {cuotasVisibles < totalCuotas
                            ? " · usá la rueda del mouse para ver más"
                            : " · rueda hacia arriba para ocultar"}
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Columna izquierda: gastos fijos ── */}
      <div className="flex min-w-0 flex-col gap-4 md:col-start-1 md:row-start-1 md:row-span-3 md:order-first">
        {/* Gastos fijos del mes */}
        <Card style={{ backgroundColor: "rgba(239, 238, 232, 0.42)" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Gastos fijos
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  style={{ backgroundColor: "#ffffff" }}
                  className="h-7 w-7 text-purple-600 hover:text-purple-700"
                  onClick={() => abrirEvolucion()}
                  title="Ver evolución mes a mes"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span className="sr-only">Ver evolución mes a mes de los gastos fijos</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ color: "#000000", backgroundColor: "#ffffff" }}
                  className="h-7 gap-1.5 text-xs"
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
          <CardContent className="space-y-2 reveal-stagger">
            {fijosSinCargarMesActual.length > 0 && (
                <div className="rounded-lg border-l-4 border border-purple-600 bg-white px-3 py-2 text-xs text-purple-950">
                <span className="font-semibold">
                  {`Falta cargar ${fijosSinCargarMesActual.length} gasto${fijosSinCargarMesActual.length === 1 ? "" : "s"} fijo${fijosSinCargarMesActual.length === 1 ? "" : "s"} del mes de ${nombreDeMes(mesActualISO())}: `}
                </span>
                {fijosSinCargarMesActual
                  .slice(0, 4)
                  .map((c) => c.concepto)
                  .join(", ")}
                {fijosSinCargarMesActual.length > 4
                  ? ` y ${fijosSinCargarMesActual.length - 4} más`
                  : ""}
              </div>
            )}
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
                {(() => {
                  let carpetas = agruparPorSalon(gastosFijosMes)
                  // En la vista de todos los salones, TODOS los salones tienen
                  // su carpeta (incluso Salon 4 y 5 sin gastos propios), porque
                  // las cuotas de gastos repartidos se pagan desde cada salón.
                  if (salonFiltro === "todos") {
                    for (const salon of SALONES) {
                      if (!carpetas.some((c) => c.salon === salon)) {
                        carpetas.push({ salon, items: [], subtotal: 0 })
                      }
                    }
                    // Los gastos repartidos NO se muestran en General: cada
                    // salón ya tiene su cuota con monto y vencimiento propios.
                    // General solo queda para gastos sin salón y sin reparto,
                    // y se oculta por completo si no tiene ninguno.
                    carpetas = carpetas
                      .map((c) => {
                        if (c.salon !== "General") return c
                        const propios = c.items.filter((g) => {
                          const orig = state.costosOperativos?.find((co) => co.id === g.id)
                          const dist = (orig?.distribucion || []).filter((d) => d && d.salon && d.porcentaje > 0)
                          return dist.length === 0
                        })
                        return { ...c, items: propios, subtotal: propios.reduce((s, g) => s + g.monto, 0) }
                      })
                      .filter((c) => c.salon !== "General" || c.items.length > 0)
                  }
                  for (const salon of cuotasRepartoFijos.keys()) {
                    if (!carpetas.some((c) => c.salon === salon)) {
                      carpetas.push({ salon, items: [], subtotal: 0 })
                    }
                  }
                  const ordenCarpetas = [...SALONES, "General"]
                  carpetas.sort(
                    (a, b) => ordenCarpetas.indexOf(a.salon as any) - ordenCarpetas.indexOf(b.salon as any),
                  )
                  return carpetas.map((carpeta) => {
                    const cuotasReparto =
                      carpeta.salon === "General" ? [] : cuotasRepartoFijos.get(carpeta.salon) || []
                    return (
                  <CarpetaGastos
                    key={`fijo-${carpeta.salon}`}
                    salon={carpeta.salon}
                    count={carpeta.items.length + cuotasReparto.length}
                    subtotal={carpeta.subtotal + cuotasReparto.reduce((s, c) => s + c.monto, 0)}
                  >
                    {/* Cuotas de gastos repartidos: misma tarjeta y acciones que
                        un gasto normal; el check paga la parte de este salón. */}
                    {cuotasReparto.map((cuota) => {
                      const gastoRef = gastosFijosMes.find((g) => g.id === cuota.id)
                      const histRef = gastoRef?.historialMontos || []
                      return (
                      <div
                        key={`reparto-${cuota.id}`}
                        className="rounded-lg border border-border bg-card"
                      >
                        <div className="flex items-center gap-3 p-3">
                          <button
                            type="button"
                            className="flex-1 min-w-0 text-left"
                            onClick={() => abrirEvolucion(cuota.id)}
                            title="Ver evolución mes a mes"
                          >
                            <p className="text-sm font-medium truncate">{cuota.concepto}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {gastoRef?.frecuencia || "Mensual"}
                              {cuota.fechaVencimiento && (gastoRef?.frecuencia || "Mensual") === "Mensual" ? (
                                <span className="font-semibold text-purple-600">
                                  {` · ${periodoQueSePaga(cuota.fechaVencimiento)}`}
                                </span>
                              ) : null}
                              {cuota.fechaVencimiento ? ` · vence ${formatFecha(cuota.fechaVencimiento)}` : ""}
                              {` · ${cuota.porcentaje}%`}
                            </p>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            <div className="flex flex-col items-end gap-1 mr-1">
                              <span className="text-sm font-bold text-foreground">
                                {formatCurrency(cuota.monto)}
                              </span>
                              {badgeEstadoFijo(cuota.estado)}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-purple-600 hover:text-purple-700"
                              title={`Ver evolución mes a mes de ${cuota.concepto}`}
                              onClick={() => abrirEvolucion(cuota.id)}
                            >
                              <TrendingUp className="h-4 w-4" />
                              <span className="sr-only">{`Ver evolución mes a mes de ${cuota.concepto}`}</span>
                            </Button>
                            <ConfirmAction
                              title={cuota.pagado ? "¿Marcar como pendiente?" : "¿Marcar como pagado?"}
                              description={`${cuota.concepto} · ${carpeta.salon} · ${formatCurrency(cuota.monto)}`}
                              confirmLabel={cuota.pagado ? "Sí, marcar pendiente" : "Sí, marcar pagado"}
                              onConfirm={() => pagarCuotaSalon(cuota.id, carpeta.salon, !cuota.pagado)}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 ${cuota.pagado ? "text-teal-600 hover:text-teal-700" : "text-muted-foreground hover:text-teal-600"}`}
                                title={cuota.pagado ? `Marcar ${cuota.concepto} en ${carpeta.salon} como pendiente` : `Marcar ${cuota.concepto} en ${carpeta.salon} como pagado`}
                              >
                                {cuota.pagado ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                <span className="sr-only">{cuota.pagado ? "Marcar pendiente" : "Marcar pagado"}</span>
                              </Button>
                            </ConfirmAction>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  title="Más acciones"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                  <span className="sr-only">{`Más acciones para ${cuota.concepto} en ${carpeta.salon}`}</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                {gastoRef && (
                                  <>
                                    <DropdownMenuItem onSelect={() => abrirRegistroMonto(gastoRef)}>
                                      <Receipt className="h-3.5 w-3.5" />
                                      {`Cargar nuevo monto (${nombreDeMes(mesQueCorrespondeCargar(histRef, gastoRef.fechaVencimiento))})`}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => abrirEditFijo(gastoRef)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onSelect={() => setAccionMenu({ tipo: "eliminar", gasto: gastoRef })}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                      )
                    })}
                    {carpeta.items.map((gasto) => {
                  const esPagado = gasto.estado === "pagado"
                  const hist = gasto.historialMontos || []
                  const ultimoRegistro = hist.length > 0 ? hist[hist.length - 1] : null
                  // Gastos repartidos: el pago se hace desde la cuota de cada
                  // salón; la línea de General solo muestra el avance.
                  const distGasto = (
                    state.costosOperativos?.find((c) => c.id === gasto.id)?.distribucion || []
                  ).filter((d) => d.salon && d.porcentaje > 0)
                  const esRepartido = distGasto.length > 0
                  const partesPagadas = distGasto.filter((d) => d.pagado === true).length
                  // Vista de un salón específico: el check paga la parte que le
                  // corresponde a ESTE salón del gasto repartido.
                  const parteSalon =
                    esRepartido && salonFiltro !== "todos"
                      ? distGasto.find((d) => d.salon === salonFiltro)
                      : undefined
                  const parteSalonPagada = parteSalon?.pagado === true
                  // Períodos anteriores que quedaron adeudados al cargar un monto nuevo
                  // sin pagarlos: cada uno muestra su propio check hasta que se pague.
                  const deudasAnteriores = hist.filter(
                    (r, i) => r.pagado === false && i !== hist.length - 1,
                  )
                  // Deudas anteriores ya pagadas: se pueden destildar desde el
                  // menú "⋯" si se marcaron como pagadas por error.
                  const deudasPagadas = hist.filter(
                    (r, i) => r.pagado === true && i !== hist.length - 1,
                  )
                  return (
                    <div
                      key={gasto.id}
                      className="rounded-lg border border-border bg-card"
                    >
                    <div className="flex items-center gap-3 p-3">
                      {/* Un click sobre el gasto abre su historial automático */}
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left"
                        onClick={() => abrirEvolucion(gasto.id)}
                        title="Ver evolución mes a mes"
                      >
                        <p className="text-sm font-medium truncate">{gasto.concepto}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {gasto.frecuencia}
                          {gasto.fechaVencimiento && gasto.frecuencia === "Mensual" ? (
                            <span className="font-semibold text-purple-600">
                              {` · ${periodoQueSePaga(gasto.fechaVencimiento)}`}
                            </span>
                          ) : null}
                          {gasto.fechaVencimiento ? ` · vence ${formatFecha(gasto.fechaVencimiento)}` : ""}
                        </p>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="flex flex-col items-end gap-1 mr-1">
                          <span className="text-sm font-bold text-foreground">
                            {formatCurrency(gasto.monto)}
                          </span>
                          {badgeEstadoFijo(gasto.estado)}
                        </div>
                        {!gasto.esSueldoVendedor && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-purple-600 hover:text-purple-700"
                            title={`Ver evolución mes a mes de ${gasto.concepto}`}
                            onClick={() => abrirEvolucion(gasto.id)}
                          >
                            <TrendingUp className="h-4 w-4" />
                            <span className="sr-only">{`Ver evolución mes a mes de ${gasto.concepto}`}</span>
                          </Button>
                        )}
                        {!gasto.esSueldoVendedor && esRepartido && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${partesPagadas === distGasto.length ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-muted text-muted-foreground"}`}
                            title={salonFiltro === "todos" ? "Se paga desde la carpeta de cada salón" : "Avance de pago entre salones"}
                          >
                            {`${partesPagadas}/${distGasto.length} salones`}
                          </Badge>
                        )}
                        {/* Gasto repartido visto desde UN salón: check para pagar
                            la parte que le corresponde a este salón. */}
                        {!gasto.esSueldoVendedor && esRepartido && parteSalon && (
                          <ConfirmAction
                            title={parteSalonPagada ? "¿Marcar como pendiente?" : "¿Marcar como pagado?"}
                            description={`${gasto.concepto} · ${salonLabel(salonFiltro)} · ${formatCurrency(gasto.monto)}`}
                            confirmLabel={parteSalonPagada ? "Sí, marcar pendiente" : "Sí, marcar pagado"}
                            onConfirm={() => pagarCuotaSalon(gasto.id, salonFiltro, !parteSalonPagada)}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${parteSalonPagada ? "text-teal-600 hover:text-teal-700" : "text-muted-foreground hover:text-teal-600"}`}
                              title={parteSalonPagada ? `Marcar la parte de ${salonLabel(salonFiltro)} como pendiente` : `Marcar la parte de ${salonLabel(salonFiltro)} como pagada`}
                            >
                              {parteSalonPagada
                                ? <CheckCircle2 className="h-4 w-4" />
                                : <Circle className="h-4 w-4" />
                              }
                              <span className="sr-only">{parteSalonPagada ? "Marcar pendiente" : "Marcar pagado"}</span>
                            </Button>
                          </ConfirmAction>
                        )}
                        {!gasto.esSueldoVendedor && !esRepartido && (
                          <ConfirmAction
                            title={esPagado ? "¿Marcar como pendiente?" : "¿Marcar como pagado?"}
                            description={`${gasto.concepto} · ${formatCurrency(gasto.monto)}${ultimoRegistro ? ` · período ${formatMes(ultimoRegistro.mes)}` : ""}`}
                            confirmLabel={esPagado ? "Sí, marcar pendiente" : "Sí, marcar pagado"}
                            onConfirm={() => updateCostoOperativo(gasto.id, { pagado: !esPagado })}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${esPagado ? "text-teal-600 hover:text-teal-700" : "text-muted-foreground hover:text-teal-600"}`}
                              title={esPagado ? "Marcar como pendiente" : "Marcar como pagado"}
                            >
                              {esPagado
                                ? <CheckCircle2 className="h-4 w-4" />
                                : <Circle className="h-4 w-4" />
                              }
                              <span className="sr-only">{esPagado ? "Marcar pendiente" : "Marcar pagado"}</span>
                            </Button>
                          </ConfirmAction>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Más acciones"
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Más acciones para {gasto.concepto}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {gasto.esSueldoVendedor ? (
                              <DropdownMenuItem onSelect={() => abrirEdicionSueldo(gasto)}>
                                <Pencil className="h-3.5 w-3.5" />
                                Editar fecha de pago
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem onSelect={() => abrirRegistroMonto(gasto)}>
                                  <Receipt className="h-3.5 w-3.5" />
                                  {`Cargar nuevo monto (${nombreDeMes(mesQueCorrespondeCargar(hist, gasto.fechaVencimiento))})`}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => abrirEditFijo(gasto)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </DropdownMenuItem>
                                {deudasPagadas.length > 0 && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {deudasPagadas.map((deuda) => (
                                      <DropdownMenuItem
                                        key={deuda.id}
                                        onSelect={() => pagarDeudaAnterior(gasto.id, deuda.id, false)}
                                      >
                                        <Circle className="h-3.5 w-3.5" />
                                        {`Destildar pago de ${formatMes(deuda.mes)}`}
                                      </DropdownMenuItem>
                                    ))}
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => setAccionMenu({ tipo: "eliminar", gasto })}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {/* Deudas de períodos anteriores: check propio que desaparece al pagarse */}
                    {deudasAnteriores.length > 0 && (
                      <div className="border-t border-amber-200 bg-amber-50/60 rounded-b-lg">
                        {deudasAnteriores.map((deuda) => (
                          <div key={deuda.id} className="flex items-center gap-2 px-3 py-2">
                            <span className="flex-1 min-w-0 text-xs text-amber-800">
                              {`Debés ${formatMes(deuda.mes)}`}
                            </span>
                            <span className="text-xs font-bold text-amber-800 shrink-0">
                              {formatCurrency(deuda.monto)}
                            </span>
                            <ConfirmAction
                              title={`¿Pagar ${formatMes(deuda.mes)}?`}
                              description={`${gasto.concepto} · ${formatCurrency(deuda.monto)} adeudado de ${formatMes(deuda.mes)}.`}
                              confirmLabel="Sí, marcar pagado"
                              onConfirm={() => pagarDeudaAnterior(gasto.id, deuda.id)}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-amber-600 hover:text-teal-600"
                                title={`Marcar ${formatMes(deuda.mes)} como pagado`}
                              >
                                <Circle className="h-4 w-4" />
                                <span className="sr-only">{`Marcar ${formatMes(deuda.mes)} de ${gasto.concepto} como pagado`}</span>
                              </Button>
                            </ConfirmAction>
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                  )
                    })}
                  </CarpetaGastos>
                    )
                  })
                })()}

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
                            <span className="inline-flex items-center gap-1 align-middle">
                              Ya cubriste este gasto fijo del mes ·
                              <SalonDot salon={gasto.salon} size={7} />
                              {salonLabel(gasto.salon)}
                            </span>
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
      </div>

        {/* Gastos variables (columna derecha, fila 1) */}
        <Card className="md:col-start-2 md:row-start-1" style={{ backgroundColor: "rgba(236, 248, 208, 0.64)", color: "#000000" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Gastos variables
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  style={{ color: "#000000", backgroundColor: "#ffffff" }}
                  className="h-7 gap-1.5 text-xs"
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
          <CardContent className="space-y-2 reveal-stagger">
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
                    className={`flex items-center gap-3 rounded-lg border p-3 ${gasto.esComision ? "border-amber-300 bg-amber-50/60" : "border-border bg-card"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{gasto.nombre}</p>
                      {gasto.esComision && gasto.comisionDetalle ? (
                        <>
                          <p className="text-xs text-amber-800/80 mt-0.5">
                            {gasto.comisionDetalle.porcentaje}% de {formatCurrency(gasto.comisionDetalle.totalEvento)}
                            {gasto.fecha ? ` · evento ${formatFecha(gasto.fecha)}` : ""}
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
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {gasto.fechaGasto ? (
                            <span className="font-semibold text-purple-600">{`hecho el ${formatFecha(gasto.fechaGasto)}`}</span>
                          ) : null}
                          {gasto.fechaGasto && gasto.fecha ? " · " : ""}
                          {gasto.fecha ? `vence ${formatFecha(gasto.fecha)}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="flex flex-col items-end gap-1 mr-1">
                        <span className="text-sm font-bold text-foreground">
                          {formatCurrency(gasto.monto)}
                        </span>
                        {gasto.esComision && gasto.listaParaPagar && !esPagado ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Lista para pagar
                          </Badge>
                        ) : (
                          badgeEstadoVar(gasto.estado)
                        )}
                      </div>
                      {gasto.esComision && gasto.comisionDetalle && (<>
                        <ConfirmAction
                          title={esPagado ? "¿Marcar comisión como pendiente?" : "¿Marcar comisión como pagada?"}
                          description={`${gasto.nombre} · ${formatCurrency(gasto.monto)}. ${esPagado ? "Volverá a figurar como pendiente." : "Quedará registrada como pagada también en Vendedores."}`}
                          confirmLabel={esPagado ? "Sí, marcar pendiente" : "Sí, marcar pagada"}
                          onConfirm={() => marcarComisionPagada(gasto, !esPagado)}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${esPagado ? "text-teal-600 hover:text-teal-700" : "text-muted-foreground hover:text-teal-600"}`}
                            title={esPagado ? "Marcar comisión como pendiente" : "Marcar comisión como pagada"}
                          >
                            {esPagado ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                            <span className="sr-only">{esPagado ? "Marcar comisión pendiente" : "Marcar comisión pagada"}</span>
                          </Button>
                        </ConfirmAction>
                        {/* Menú de acciones de la comisión */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Más acciones"
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Más acciones para {gasto.nombre}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onSelect={() => setAccionVariable({ tipo: "archivar", gasto })}>
                              <Archive className="h-3.5 w-3.5" />
                              Archivar comisión
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setAccionVariable({ tipo: "eliminar", gasto })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>)}
                      {!gasto.esComision && (<>
                      {/* Toggle pagado */}
                      <ConfirmAction
                        title={esPagado ? "¿Marcar como pendiente?" : "¿Marcar como pagado?"}
                        description={`${gasto.nombre} · ${formatCurrency(gasto.monto)}`}
                        confirmLabel={esPagado ? "Sí, marcar pendiente" : "Sí, marcar pagado"}
                        onConfirm={() => updateCostoOperativo(gasto.id, { pagado: !esPagado })}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${esPagado ? "text-teal-600 hover:text-teal-700" : "text-muted-foreground hover:text-teal-600"}`}
                          title={esPagado ? "Marcar como pendiente" : "Marcar como pagado"}
                        >
                          {esPagado
                            ? <CheckCircle2 className="h-4 w-4" />
                            : <Circle className="h-4 w-4" />
                          }
                          <span className="sr-only">{esPagado ? "Marcar pendiente" : "Marcar pagado"}</span>
                        </Button>
                      </ConfirmAction>
                      {/* Menú de acciones (igual que gastos fijos) */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Más acciones"
                          >
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Más acciones para {gasto.nombre}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onSelect={() => abrirEdicionVariable(gasto)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setAccionVariable({ tipo: "archivar", gasto })}>
                            <Archive className="h-3.5 w-3.5" />
                            Archivar gasto
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setAccionVariable({ tipo: "eliminar", gasto })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </>)}
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

      {/* ── Calendario de gastos por salón — oculto temporalmente ─────────────── */}
      {false && (
      <CalendarioGastosSalones
        fijos={gastosFijosMes}
        cubiertos={gastosFijosCubiertos}
        variables={gastosVariablesCombinados}
        ahora={ahora}
      />
      )}

      {/* ── Dialog: Agregar gasto fijo ────────────────────────────────────── */}
      <Dialog open={modalFijoAbierto} onOpenChange={setModalFijoAbierto}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Agregar gasto fijo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
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
                          <span className="flex items-center gap-2">
                            <SalonDot salon={s} size={8} />
                            {salonLabel(s)}
                          </span>
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
              <Label htmlFor="nf-mes">¿A qué mes corresponde el monto?</Label>
              <Input
                id="nf-mes"
                type="month"
                value={nuevoFijo.mesCorresponde}
                onChange={(e) => setNuevoFijo((p) => ({ ...p, mesCorresponde: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Desde ese mes el gasto figura pendiente de pago y arranca su historial.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nf-fecha">Fecha de vencimiento</Label>
              <Input
                id="nf-fecha"
                type="date"
                value={nuevoFijo.fechaVencimiento}
                onChange={(e) => setNuevoFijo((p) => ({ ...p, fechaVencimiento: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                El día se repite cada período: si vence el 10, figura el 10 de cada mes.
              </p>
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
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="space-y-0.5 pr-3">
                <Label htmlFor="nf-servicio" className="text-amber-800">
                  Etiqueta &quot;Servicio&quot;
                </Label>
                <p className="text-xs text-amber-700/80">
                  Los gastos con esta etiqueta aparecen en la tarjeta &quot;Servicios a pagar&quot;.
                </p>
              </div>
              <Switch
                id="nf-servicio"
                checked={nuevoFijo.esServicio}
                onCheckedChange={(checked) => setNuevoFijo((p) => ({ ...p, esServicio: checked }))}
              />
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

      {/* ─��� Dialog: Editar gasto fijo ───────────────────────────────��──────���─ */}
      {/* ── Dialog: Editar fecha de pago de sueldo de vendedor ─────────��───── */}
      <Dialog
        open={!!editandoSueldoVendedor}
        onOpenChange={(open) => !open && setEditandoSueldoVendedor(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar fecha de pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium">{editandoSueldoVendedor?.concepto}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {editandoSueldoVendedor ? formatCurrency(editandoSueldoVendedor.monto) : ""} · el
                monto se maneja desde Eventos &gt; Vendedores
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sv-fecha">Fecha de pago</Label>
              <Input
                id="sv-fecha"
                type="date"
                value={fechaPagoSueldo}
                onChange={(e) => setFechaPagoSueldo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Esta fecha impacta en las alertas de vencimiento.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoSueldoVendedor(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarFechaSueldo}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      <SelectValue placeholder="Seleccionar sal��n" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">General (todos los salones)</SelectItem>
                      {SALONES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <span className="flex items-center gap-2">
                            <SalonDot salon={s} size={8} />
                            {salonLabel(s)}
                          </span>
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
              <p className="text-xs text-muted-foreground">
                El día se repite cada período: si vence el 10, figura el 10 de cada mes.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="space-y-0.5 pr-3">
                <Label htmlFor="ef-servicio" className="text-amber-800">
                  Etiqueta &quot;Servicio&quot;
                </Label>
                <p className="text-xs text-amber-700/80">
                  Los gastos con esta etiqueta aparecen en la tarjeta &quot;Servicios a pagar&quot;.
                </p>
              </div>
              <Switch
                id="ef-servicio"
                checked={editFijo.esServicio}
                onCheckedChange={(checked) => setEditFijo((p) => ({ ...p, esServicio: checked }))}
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

      {/* ── Dialog: Agendar gasto variable ─────����──���──��──���──────────��──────── */}
      <Dialog
        open={modalVariableAbierto}
        onOpenChange={(open) => {
          setModalVariableAbierto(open)
          if (!open) {
            setEditandoVariableId(null)
            setNuevoGasto({ nombre: "", monto: "", salon: "", fecha: "", fechaGasto: "", repartir: false, distribucion: [] })
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editandoVariableId ? "Editar gasto variable" : "Agendar gasto variable"}</DialogTitle>
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
                          <span className="flex items-center gap-2">
                            <SalonDot salon={s} size={8} />
                            {salonLabel(s)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gv-fecha-gasto">Fecha del gasto</Label>
                <Input
                  id="gv-fecha-gasto"
                  type="date"
                  value={nuevoGasto.fechaGasto}
                  onChange={(e) => setNuevoGasto((p) => ({ ...p, fechaGasto: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gv-fecha">Vencimiento</Label>
                <Input
                  id="gv-fecha"
                  type="date"
                  value={nuevoGasto.fecha}
                  onChange={(e) => setNuevoGasto((p) => ({ ...p, fecha: e.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground col-span-2">
                La fecha del gasto es opcional (cuándo se hizo). El vencimiento ordena la lista y dispara las alertas.
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
              {editandoVariableId ? "Guardar cambios" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Evolución de gastos fijos: ventana automática de historial ──��── */}
      <EvolucionGastosFijosDialog
        open={evolucionAbierta}
        onOpenChange={setEvolucionAbierta}
        costos={costosFijosParaEvolucion}
        initialCostoId={evolucionCostoId}
        updateCostoOperativo={updateCostoOperativo}
      />

      {/* ── Confirmación de eliminación del menú "⋯" de gastos fijos ─────── */}
      <AlertDialog open={!!accionMenu} onOpenChange={(open) => !open && setAccionMenu(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar gasto fijo?</AlertDialogTitle>
            <AlertDialogDescription>
              {accionMenu
                ? `Se elimina "${accionMenu.gasto.concepto}" de forma permanente. Esta acción no se puede deshacer.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!accionMenu) return
                deleteCostoOperativo(accionMenu.gasto.id)
                setAccionMenu(null)
              }}
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmación archivar/eliminar del menú "⋯" de gastos variables ���─ */}
      <AlertDialog open={!!accionVariable} onOpenChange={(open) => !open && setAccionVariable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {accionVariable?.gasto.esComision
                ? accionVariable?.tipo === "archivar"
                  ? "¿Archivar comisión?"
                  : "¿Eliminar comisión?"
                : accionVariable?.tipo === "archivar"
                  ? "¿Archivar gasto?"
                  : "¿Eliminar gasto?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {accionVariable
                ? accionVariable.gasto.esComision
                  ? accionVariable.tipo === "archivar"
                    ? `Se registra "${accionVariable.gasto.nombre}" (${formatCurrency(accionVariable.gasto.monto)}) en el archivo y se quita de esta lista.`
                    : `Se quita "${accionVariable.gasto.nombre}" de esta lista. No afecta al evento ni al vendedor.`
                  : accionVariable.tipo === "archivar"
                    ? `Se registra el pago de "${accionVariable.gasto.nombre}" (${formatCurrency(accionVariable.gasto.monto)}) en el archivo.`
                    : `Se elimina "${accionVariable.gasto.nombre}" de forma permanente. Esta acción no se puede deshacer.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={
                accionVariable?.tipo === "eliminar"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-purple-600 text-white hover:bg-purple-700"
              }
              onClick={() => {
                if (!accionVariable) return
                if (accionVariable.gasto.esComision) {
                  if (accionVariable.tipo === "archivar") archivarComision(accionVariable.gasto)
                  else eliminarComision(accionVariable.gasto)
                } else if (accionVariable.tipo === "archivar") {
                  archivarVariable(accionVariable.gasto)
                } else {
                  deleteCostoOperativo(accionVariable.gasto.id)
                }
                setAccionVariable(null)
              }}
            >
              {accionVariable?.tipo === "archivar" ? "Sí, archivar" : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Cargar nuevo monto (actualiza el gasto y genera la evolución) ── */}
      <Dialog open={!!registrandoMonto} onOpenChange={(open) => !open && setRegistrandoMonto(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{`Cargar nuevo monto (${formRegistro.mes ? nombreDeMes(formRegistro.mes) : nombreMesProximo()})`}</DialogTitle>
          </DialogHeader>
          {registrandoMonto && (() => {
            const original = state.costosOperativos?.find((c) => c.id === registrandoMonto.id)
            const montoAnterior = original?.monto ?? registrandoMonto.monto
            const montoNuevo = Number(formRegistro.monto) || 0
            const variacion = calcularVariacion(montoAnterior, montoNuevo)
            const historialPrevio = original?.historialMontos || []
            return (
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  {`${registrandoMonto.concepto}. Cargá el monto que corresponde pagar en ${formRegistro.mes ? nombreDeMes(formRegistro.mes) : nombreMesProximo()}: el gasto se actualiza con ese valor y queda como pendiente de pago.`}
                </p>
                {!original?.pagado && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                    {`Ojo: todavía no pagaste el monto vigente (${formatCurrency(montoAnterior)}). Al guardar, quedará como deuda con su propio check en la fila del gasto hasta que lo marques pagado.`}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="rm-mes">Período</Label>
                  <Input
                    id="rm-mes"
                    type="month"
                    value={formRegistro.mes}
                    onChange={(e) => setFormRegistro((p) => ({ ...p, mes: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rm-monto">Monto pagado (ARS)</Label>
                  <MoneyInput
                    id="rm-monto"
                    value={montoNuevo}
                    onValueChange={(v) => setFormRegistro((p) => ({ ...p, monto: v ? String(v) : "" }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rm-nota">Nota (opcional)</Label>
                  <Input
                    id="rm-nota"
                    placeholder="Ej. aumento de tarifa, consumo alto"
                    value={formRegistro.nota}
                    onChange={(e) => setFormRegistro((p) => ({ ...p, nota: e.target.value }))}
                  />
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Monto anterior</span>
                    <span className="font-medium">{formatCurrency(montoAnterior)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">Monto nuevo</span>
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      {formatCurrency(montoNuevo)}
                      <DeltaMonto variacion={variacion} />
                    </span>
                  </div>
                  {historialPrevio.length > 0 && (
                    <HistorialMontos historial={historialPrevio} />
                  )}
                </div>
              </div>
            )
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegistrandoMonto(null)}>
              Cancelar
            </Button>
            <Button
              onClick={guardarRegistroMonto}
              disabled={!formRegistro.monto || Number(formRegistro.monto) <= 0}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Guardar monto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: extracción / ajuste de saldo de Caja Jazmines */}
      <Dialog open={extraerOpen} onOpenChange={setExtraerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpFromLine className="h-4 w-4 text-red-600" />
              {extraerModo === "extraer" ? "Extraer dinero — Caja Jazmines" : "Colocar monto actual — Caja Jazmines"}
            </DialogTitle>
            <DialogDescription>
              {extraerModo === "extraer"
                ? "Registra un retiro de efectivo. Queda en el Archivo Histórico y en Configuración → Actividad."
                : "Contá el dinero real y colocá el monto: el sistema registra la diferencia automáticamente. Queda en Configuración → Actividad."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Selector de modo */}
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  extraerModo === "extraer" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setExtraerModo("extraer")}
              >
                Extraer monto
              </button>
              <button
                type="button"
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  extraerModo === "fijar" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setExtraerModo("fijar")}
              >
                Colocar monto actual
              </button>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Saldo actual (sistema)</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(saldoActual)}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extraer-monto-jaz">
                {extraerModo === "extraer" ? "Monto a extraer" : "¿Cuánto dinero hay realmente?"}
              </Label>
              <MoneyInput
                id="extraer-monto-jaz"
                value={extraerMonto}
                onValueChange={setExtraerMonto}
                placeholder="0"
              />
              {extraerModo === "extraer" && extraerMonto > saldoActual && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> El monto supera el saldo disponible. La caja quedará en negativo.
                </p>
              )}
              {extraerModo === "fijar" && extraerMonto !== saldoActual && (
                <p className={`text-xs flex items-center gap-1 ${extraerMonto < saldoActual ? "text-red-600" : "text-emerald-700"}`}>
                  {extraerMonto < saldoActual
                    ? `Se registrará un egreso de ${formatCurrency(saldoActual - extraerMonto)} (faltante).`
                    : `Se registrará un ingreso de ${formatCurrency(extraerMonto - saldoActual)} (sobrante).`}
                </p>
              )}
              {extraerModo === "fijar" && extraerMonto === saldoActual && (
                <p className="text-xs text-muted-foreground">El saldo del sistema ya coincide con ese monto.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extraer-concepto-jaz">Nota / justificación</Label>
              <Textarea
                id="extraer-concepto-jaz"
                value={extraerConcepto}
                onChange={(e) => setExtraerConcepto(e.target.value)}
                placeholder={
                  extraerModo === "extraer"
                    ? "Ej: Retiro de socios / pago en efectivo"
                    : "Ej: Conteo de caja del cierre del día"
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtraerOpen(false)}>
              Cancelar
            </Button>
            {extraerModo === "extraer" ? (
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={extraerMonto <= 0 || !extraerConcepto.trim()}
                onClick={confirmarExtraccion}
              >
                <ArrowUpFromLine className="h-4 w-4 mr-1" /> Confirmar extracción
              </Button>
            ) : (
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={extraerMonto < 0 || extraerMonto === saldoActual || !extraerConcepto.trim()}
                onClick={confirmarAjusteSaldo}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> Fijar saldo real
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

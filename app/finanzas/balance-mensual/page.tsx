"use client"

import { useState, useMemo, useEffect } from "react"
import { useStore } from "@/lib/store-context"
import { formatCurrency } from "@/lib/utils-financieros"
import type {
  EventoGuardado,
  CostoOperativo,
  ServicioEvento,
  Servicio,
} from "@/lib/store"
import { calcularSeñaSaldoServicio } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Receipt,
  Briefcase,
  Users,
  Banknote,
  ArrowLeftRight,
  AlertCircle,
} from "lucide-react"

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function mesAnioLabel(mes: number, anio: number): string {
  return `${MESES[mes]} ${anio}`
}

function parseLocalDate(str: string): Date {
  return new Date(str + "T12:00:00")
}

function perteneceAlMes(fechaStr: string, mes: number, anio: number): boolean {
  try {
    const d = parseLocalDate(fechaStr)
    return d.getMonth() === mes && d.getFullYear() === anio
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────
// Tipos internos del balance
// ─────────────────────────────────────────────

interface FilaIngreso {
  eventoId: string
  nombre: string
  fecha: string
  precioVenta: number
  totalPagado: number
  totalCuotasMes: number   // cuotas con vencimiento en este mes
  saldoPendiente: number
  estado: "cobrado" | "parcial" | "pendiente" | "vencido"
}

interface FilaSeñaProveedor {
  eventoId: string
  eventoNombre: string
  eventoFecha: string
  servicioNombre: string
  proveedor?: string
  montoSeña: number
  estadoPago: ServicioEvento["estadoPago"]
  fechaSeña?: string
  saldoPendiente?: number
  fechaLimitePago?: string
}

interface FilaCostoOperativo {
  id: string
  concepto: string
  tipo: CostoOperativo["tipo"]
  monto: number
  salon?: string | null
  frecuencia: CostoOperativo["frecuencia"]
  fechaVencimiento?: string
  vencidoEsteMes: boolean
}

interface ResumenBalance {
  ingresosTotales: number
  ingresosCobrados: number
  ingresosPendientes: number
  egresosOperativos: number
  egresosCostosFijos: number
  señasProveedores: number
  saldosProveedores: number
  resultadoBruto: number
  resultadoNeto: number
}

// ─────────────────────────────────────────────
// Hooks de cálculo
// ─────────────────────────────────────────────

function useDatosBalance(mes: number, anio: number, eventos: EventoGuardado[], costosOperativos: CostoOperativo[], servicios: Servicio[] = []) {

  // ── INGRESOS ──────────────────────────────
  const filasIngresos = useMemo<FilaIngreso[]>(() => {
    return eventos
      .filter((e) => e.estado !== "cancelado")
      .filter((e) => perteneceAlMes(e.fecha, mes, anio))
      .map((e) => {
        const precioVenta = e.precioVenta ?? 0
        const totalPagado = (e.pagos ?? []).reduce((s, p) => s + p.monto, 0)
        const saldoPendiente = Math.max(0, precioVenta - totalPagado)

        // Cuotas con vencimiento en este mes (planDeCuotas.cuotas nuevo campo)
        let totalCuotasMes = 0
        if (e.planDeCuotas?.cuotas?.length) {
          totalCuotasMes = e.planDeCuotas.cuotas
            .filter((c) => c.fechaVencimiento && perteneceAlMes(c.fechaVencimiento, mes, anio))
            .reduce((s, c) => s + c.montoCuota, 0)
        } else if (e.planDeCuotas && e.planDeCuotas.numeroCuotas > 0) {
          // Distribución simple si no hay cuotas detalladas
          totalCuotasMes = e.planDeCuotas.montoCuota ?? 0
        }

        const estado: FilaIngreso["estado"] =
          saldoPendiente === 0
            ? "cobrado"
            : totalPagado > 0
            ? "parcial"
            : parseLocalDate(e.fecha) < new Date()
            ? "vencido"
            : "pendiente"

        return {
          eventoId: e.id,
          nombre: e.nombrePareja || e.nombre || e.tipoEvento || "Evento",
          fecha: e.fecha,
          precioVenta,
          totalPagado,
          totalCuotasMes,
          saldoPendiente,
          estado,
        }
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [eventos, mes, anio])

  // ── SEÑAS A PROVEEDORES ───────────────────
  const filasSeñas = useMemo<FilaSeñaProveedor[]>(() => {
    const filas: FilaSeñaProveedor[] = []

    eventos
      .filter((e) => e.estado !== "cancelado")
      .filter((e) => perteneceAlMes(e.fecha, mes, anio))
      .forEach((e) => {
        const eventoNombre = e.nombrePareja || e.nombre || e.tipoEvento || "Evento"
        ;(e.servicios ?? []).forEach((srv) => {
          const estadoPago = srv.estadoPago ?? (srv.pagado ? "pagado_total" : "sin_seña")
          if (estadoPago === "sin_seña") return // sin movimiento financiero

          // Montos EN VIVO desde el catálogo (Finanzas → Servicios)
          const { montoSeña, saldoPendiente } = calcularSeñaSaldoServicio(srv, { servicios })
          if (montoSeña === 0 && estadoPago !== "pagado_total") return

          filas.push({
            eventoId: e.id,
            eventoNombre,
            eventoFecha: e.fecha,
            servicioNombre: srv.nombre,
            proveedor: srv.proveedor,
            montoSeña,
            estadoPago,
            fechaSeña: srv.fechaSeña,
            saldoPendiente,
            fechaLimitePago: srv.fechaLimitePago,
          })
        })
      })

    return filas.sort((a, b) => a.eventoFecha.localeCompare(b.eventoFecha))
  }, [eventos, mes, anio, servicios])

  // ── COSTOS OPERATIVOS ─────────────────────
  const filasCostos = useMemo<FilaCostoOperativo[]>(() => {
    return costosOperativos
      .filter((c) => c.activo)
      .filter((c) => {
        if (c.frecuencia === "Mensual") return true
        if (c.frecuencia === "Anual" && c.fechaVencimiento) {
          return perteneceAlMes(c.fechaVencimiento, mes, anio)
        }
        if (c.frecuencia === "Por Evento") return false
        return false
      })
      .map((c) => ({
        id: c.id,
        concepto: c.concepto,
        tipo: c.tipo,
        monto: c.monto,
        salon: c.salon,
        frecuencia: c.frecuencia,
        fechaVencimiento: c.fechaVencimiento,
        vencidoEsteMes: c.fechaVencimiento
          ? perteneceAlMes(c.fechaVencimiento, mes, anio)
          : c.frecuencia === "Mensual",
      }))
      .sort((a, b) => a.concepto.localeCompare(b.concepto))
  }, [costosOperativos, mes, anio])

  // ── RESUMEN ───────────────────────────────
  const resumen = useMemo<ResumenBalance>(() => {
    const ingresosTotales = filasIngresos.reduce((s, f) => s + f.precioVenta, 0)
    const ingresosCobrados = filasIngresos.reduce((s, f) => s + f.totalPagado, 0)
    const ingresosPendientes = filasIngresos.reduce((s, f) => s + f.saldoPendiente, 0)
    const egresosCostosFijos = filasCostos.reduce((s, f) => s + f.monto, 0)
    const señasProveedores = filasSeñas.reduce((s, f) => s + (f.montoSeña ?? 0), 0)
    const saldosProveedores = filasSeñas.reduce((s, f) => s + (f.saldoPendiente ?? 0), 0)
    const egresosOperativos = egresosCostosFijos + señasProveedores + saldosProveedores
    const resultadoBruto = ingresosCobrados - egresosCostosFijos
    const resultadoNeto = ingresosCobrados - egresosOperativos

    return {
      ingresosTotales,
      ingresosCobrados,
      ingresosPendientes,
      egresosCostosFijos,
      egresosOperativos,
      señasProveedores,
      saldosProveedores,
      resultadoBruto,
      resultadoNeto,
    }
  }, [filasIngresos, filasCostos, filasSeñas])

  return { filasIngresos, filasSeñas, filasCostos, resumen }
}

// ─────────────────────────────────────────────
// Sub-componentes de sección colapsable
// ─────────────────────────────────────────────

function SeccionColapsable({
  titulo,
  icono,
  badge,
  children,
  defaultOpen = true,
}: {
  titulo: string
  icono: React.ReactNode
  badge?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [abierto, setAbierto] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-muted-foreground">{icono}</span>
          <span className="font-semibold text-sm">{titulo}</span>
          {badge}
        </div>
        {abierto
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>
      {abierto && (
        <div className="border-t border-border">
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Badge de estado
// ─────────────────────────────────────────────

const ESTADO_INGRESO: Record<FilaIngreso["estado"], { label: string; className: string }> = {
  cobrado:   { label: "Cobrado",   className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  parcial:   { label: "Parcial",   className: "bg-amber-100 text-amber-700 border-amber-200" },
  pendiente: { label: "Pendiente", className: "bg-sky-100 text-sky-700 border-sky-200" },
  vencido:   { label: "Vencido",   className: "bg-red-100 text-red-700 border-red-200" },
}

const ESTADO_SEÑA: Record<NonNullable<ServicioEvento["estadoPago"]>, { label: string; className: string }> = {
  sin_seña:        { label: "Sin seña",       className: "bg-muted text-muted-foreground border-border" },
  señado:          { label: "Señado",         className: "bg-amber-100 text-amber-700 border-amber-200" },
  saldo_pendiente: { label: "Saldo pdte.",    className: "bg-orange-100 text-orange-700 border-orange-200" },
  pagado_total:    { label: "Pagado total",   className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
}

// ─────────────────────────────────────────────
// Tarjeta KPI
// ─────────────────────────────────────────────

function KpiCard({
  titulo,
  valor,
  subtitulo,
  icono,
  variante,
}: {
  titulo: string
  valor: number
  subtitulo?: string
  icono: React.ReactNode
  variante: "ingreso" | "egreso" | "neutro" | "resultado"
}) {
  const colores: Record<string, string> = {
    ingreso:   "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30",
    egreso:    "border-red-200 bg-red-50 dark:bg-red-950/30",
    neutro:    "border-border bg-card",
    resultado: valor >= 0
      ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30"
      : "border-red-200 bg-red-50 dark:bg-red-950/30",
  }
  const textColor: Record<string, string> = {
    ingreso:   "text-emerald-700 dark:text-emerald-400",
    egreso:    "text-red-700 dark:text-red-400",
    neutro:    "text-foreground",
    resultado: valor >= 0
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-red-700 dark:text-red-400",
  }

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${colores[variante]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{titulo}</span>
        <span className="text-muted-foreground">{icono}</span>
      </div>
      <p className={`text-xl font-bold leading-none ${textColor[variante]}`}>
        {formatCurrency(valor)}
      </p>
      {subtitulo && (
        <p className="text-xs text-muted-foreground leading-snug">{subtitulo}</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Tabla ingresos
// ─────────────────────────────────────────────

function TablaIngresos({ filas }: { filas: FilaIngreso[] }) {
  if (filas.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-muted-foreground">
        No hay eventos en este mes.
      </div>
    )
  }
  return (
    <div className="divide-y divide-border">
      {filas.map((f) => {
        const cfg = ESTADO_INGRESO[f.estado]
        return (
          <div key={f.eventoId} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{f.nombre}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {parseLocalDate(f.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0 flex-wrap">
              {f.totalCuotasMes > 0 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Cuota del mes</p>
                  <p className="text-sm font-semibold">{formatCurrency(f.totalCuotasMes)}</p>
                </div>
              )}
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Pagado</p>
                <p className="text-sm font-semibold text-emerald-600">{formatCurrency(f.totalPagado)}</p>
              </div>
              {f.saldoPendiente > 0 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Pendiente</p>
                  <p className="text-sm font-semibold text-amber-600">{formatCurrency(f.saldoPendiente)}</p>
                </div>
              )}
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
                {cfg.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// Tabla señas a proveedores
// ─────────────────────────────────────────────

function TablaSeñas({ filas }: { filas: FilaSeñaProveedor[] }) {
  if (filas.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-muted-foreground">
        No hay señas a proveedores registradas para eventos de este mes.
      </div>
    )
  }
  return (
    <div className="divide-y divide-border">
      {filas.map((f, i) => {
        const cfg = ESTADO_SEÑA[f.estadoPago ?? "sin_seña"]
        return (
          <div key={`${f.eventoId}-${i}`} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{f.servicioNombre}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-muted-foreground">{f.eventoNombre}</span>
                {f.proveedor && (
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{f.proveedor}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0 flex-wrap">
              {f.montoSeña > 0 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Seña</p>
                  <p className="text-sm font-semibold">{formatCurrency(f.montoSeña)}</p>
                  {f.fechaSeña && (
                    <p className="text-xs text-muted-foreground">
                      {parseLocalDate(f.fechaSeña).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                    </p>
                  )}
                </div>
              )}
              {f.saldoPendiente != null && f.saldoPendiente > 0 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p className="text-sm font-semibold text-orange-600">{formatCurrency(f.saldoPendiente)}</p>
                  {f.fechaLimitePago && (
                    <p className="text-xs text-muted-foreground">
                      vence {parseLocalDate(f.fechaLimitePago).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                    </p>
                  )}
                </div>
              )}
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
                {cfg.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// Tabla costos operativos
// ─────────────────────────────────────────────

function TablaCostos({ filas }: { filas: FilaCostoOperativo[] }) {
  if (filas.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-muted-foreground">
        No hay costos operativos activos configurados.
      </div>
    )
  }
  return (
    <div className="divide-y divide-border">
      {filas.map((f) => (
        <div key={f.id} className="px-5 py-3.5 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{f.concepto}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">{f.tipo}</span>
              {f.salon && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{f.salon}</span>
                </>
              )}
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{f.frecuencia}</span>
              {f.fechaVencimiento && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    vence {parseLocalDate(f.fechaVencimiento).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                  </span>
                </>
              )}
            </div>
          </div>
          <p className="text-sm font-semibold text-red-600 shrink-0">{formatCurrency(f.monto)}</p>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Resultado neto visual
// ─────────────────────────────────────────────

function ResultadoVisual({ resumen }: { resumen: ResumenBalance }) {
  const { resultadoNeto, resultadoBruto, ingresosCobrados, egresosOperativos } = resumen
  const positivo = resultadoNeto >= 0

  return (
    <div className={`rounded-xl border-2 p-5 flex flex-col gap-4 ${positivo ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20" : "border-red-300 bg-red-50 dark:bg-red-950/20"}`}>
      <div className="flex items-center gap-3">
        {positivo
          ? <TrendingUp className="h-6 w-6 text-emerald-600" />
          : <TrendingDown className="h-6 w-6 text-red-600" />
        }
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resultado neto del mes</p>
          <p className={`text-3xl font-bold leading-none mt-1 ${positivo ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
            {formatCurrency(resultadoNeto)}
          </p>
        </div>
      </div>

      {/* Desglose rápido */}
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Cobrado</p>
          <p className="text-sm font-bold text-emerald-600">{formatCurrency(ingresosCobrados)}</p>
        </div>
        <div className="text-center flex flex-col items-center">
          <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
          <p className="text-sm font-bold text-foreground">{formatCurrency(resultadoBruto)}</p>
          <p className="text-xs text-muted-foreground">Bruto</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Egresos</p>
          <p className="text-sm font-bold text-red-600">{formatCurrency(egresosOperativos)}</p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function BalanceMensualPage() {
  const { eventos, costosOperativos, servicios } = useStore()

  // Inicializar en null para evitar mismatch de hidratación servidor/cliente
  const [mesSeleccionado, setMesSeleccionado] = useState<number | null>(null)
  const [anioSeleccionado, setAnioSeleccionado] = useState<number | null>(null)

  useEffect(() => {
    const hoy = new Date()
    setMesSeleccionado(hoy.getMonth())
    setAnioSeleccionado(hoy.getFullYear())
  }, [])

  const mes = mesSeleccionado ?? 0
  const anio = anioSeleccionado ?? new Date().getFullYear()

  const { filasIngresos, filasSeñas, filasCostos, resumen } = useDatosBalance(
    mes,
    anio,
    eventos,
    costosOperativos,
    servicios,
  )

  // Opciones de año: desde el año más antiguo de eventos hasta +1
  const anios = useMemo(() => {
    const hoy = new Date()
    const years = new Set<number>()
    years.add(hoy.getFullYear())
    years.add(hoy.getFullYear() + 1)
    eventos.forEach((e) => {
      try { years.add(parseLocalDate(e.fecha).getFullYear()) } catch { /* skip */ }
    })
    return Array.from(years).sort()
  }, [eventos])

  const hayEventosSinPrecio = filasIngresos.some((f) => f.precioVenta === 0)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Balance Mensual</h1>
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
              Ingresos por eventos, señas a proveedores y costos operativos
            </p>
          </div>

          {/* Selector mes / año */}
          <div className="flex items-center gap-2 shrink-0">
            <Select
              value={String(mes)}
              onValueChange={(v) => setMesSeleccionado(Number(v))}
            >
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(anio)}
              onValueChange={(v) => setAnioSeleccionado(Number(v))}
            >
              <SelectTrigger className="w-24 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anios.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Alerta sin precio de venta */}
        {hayEventosSinPrecio && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-amber-700 dark:text-amber-400 leading-relaxed">
              Algunos eventos no tienen precio de venta cargado. Los totales pueden ser inexactos.
            </p>
          </div>
        )}

        {/* Resultado neto destacado */}
        <ResultadoVisual resumen={resumen} />

        {/* KPIs grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            titulo="Ingresos totales"
            valor={resumen.ingresosTotales}
            subtitulo={`${filasIngresos.length} evento${filasIngresos.length !== 1 ? "s" : ""}`}
            icono={<TrendingUp className="h-4 w-4" />}
            variante="ingreso"
          />
          <KpiCard
            titulo="Ya cobrado"
            valor={resumen.ingresosCobrados}
            subtitulo={`${formatCurrency(resumen.ingresosPendientes)} pendiente`}
            icono={<Banknote className="h-4 w-4" />}
            variante="ingreso"
          />
          <KpiCard
            titulo="Costos fijos"
            valor={resumen.egresosCostosFijos}
            subtitulo={`${filasCostos.length} concepto${filasCostos.length !== 1 ? "s" : ""}`}
            icono={<Receipt className="h-4 w-4" />}
            variante="egreso"
          />
          <KpiCard
            titulo="Señas + saldos"
            valor={resumen.señasProveedores + resumen.saldosProveedores}
            subtitulo={`${filasSeñas.length} proveedor${filasSeñas.length !== 1 ? "es" : ""}`}
            icono={<Briefcase className="h-4 w-4" />}
            variante="egreso"
          />
        </div>

        {/* Sección: Ingresos por eventos */}
        <SeccionColapsable
          titulo={`Ingresos por eventos — ${mesAnioLabel(mes, anio)}`}
          icono={<CalendarDays className="h-4 w-4" />}
          badge={
            filasIngresos.length > 0
              ? <span className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-medium">
                  {formatCurrency(resumen.ingresosTotales)}
                </span>
              : undefined
          }
          defaultOpen
        >
          <TablaIngresos filas={filasIngresos} />
        </SeccionColapsable>

        {/* Sección: Señas a proveedores */}
        <SeccionColapsable
          titulo="Señas y pagos a proveedores"
          icono={<Briefcase className="h-4 w-4" />}
          badge={
            filasSeñas.length > 0
              ? <span className="rounded-full bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 text-xs font-medium">
                  {formatCurrency(resumen.señasProveedores + resumen.saldosProveedores)}
                </span>
              : undefined
          }
          defaultOpen={filasSeñas.length > 0}
        >
          <TablaSeñas filas={filasSeñas} />
        </SeccionColapsable>

        {/* Sección: Costos operativos */}
        <SeccionColapsable
          titulo="Costos operativos del mes"
          icono={<Receipt className="h-4 w-4" />}
          badge={
            filasCostos.length > 0
              ? <span className="rounded-full bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 text-xs font-medium">
                  {formatCurrency(resumen.egresosCostosFijos)}
                </span>
              : undefined
          }
          defaultOpen={filasCostos.length > 0}
        >
          <TablaCostos filas={filasCostos} />
        </SeccionColapsable>

        {/* Resumen final tabla */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Resumen del balance</h3>
            </div>
          </div>
          <div className="divide-y divide-border">
            {[
              { label: "Ingresos totales del mes",    valor: resumen.ingresosTotales,    color: "text-foreground" },
              { label: "— Cobrado",                   valor: resumen.ingresosCobrados,   color: "text-emerald-600" },
              { label: "— Pendiente de cobro",        valor: resumen.ingresosPendientes, color: "text-amber-600" },
              null,
              { label: "Costos fijos del mes",        valor: -resumen.egresosCostosFijos, color: "text-red-600" },
              { label: "Señas a proveedores",         valor: -resumen.señasProveedores,  color: "text-red-600" },
              { label: "Saldos a pagar proveedores",  valor: -resumen.saldosProveedores, color: "text-red-600" },
              null,
              { label: "Resultado bruto (cobrado − costos fijos)", valor: resumen.resultadoBruto, color: resumen.resultadoBruto >= 0 ? "text-emerald-700 font-bold" : "text-red-700 font-bold" },
              { label: "Resultado neto (cobrado − todos los egresos)", valor: resumen.resultadoNeto, color: resumen.resultadoNeto >= 0 ? "text-emerald-700 font-bold text-base" : "text-red-700 font-bold text-base" },
            ].map((fila, idx) => {
              if (fila === null) return <div key={idx} className="h-px bg-muted" />
              return (
                <div key={idx} className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-sm text-muted-foreground">{fila.label}</span>
                  <span className={`text-sm ${fila.color}`}>{formatCurrency(fila.valor)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Nota al pie */}
        <p className="text-xs text-muted-foreground text-center pb-4 leading-relaxed">
          Los ingresos se toman de los eventos cuya fecha cae en el mes seleccionado.
          Los costos operativos mensuales se incluyen siempre; los anuales solo si su vencimiento cae en el mes.
        </p>
      </div>
    </div>
  )
}

"use client"

import { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils-financieros"
import { useStore } from "@/lib/store-context"
import { useClock } from "@/lib/clock-context"
import { useToast } from "@/hooks/use-toast"
import { construirCobroCuota } from "@/lib/cobrar-cuota"
import { calcularCostoInsumosEvento, calcularSeñaSaldoServicio, generateId, SALONES, salonLabel, salonColor, SALON_COLOR_GENERAL, type EventoGuardado, type MovimientoCaja } from "@/lib/store"
import {
  BarraFiltrosEgresos,
  FILTRO_EGRESOS_INICIAL,
  filtrarEgresos,
  esFiltroEgresosActivo,
  type FiltroEgresos,
} from "@/components/filtros-egresos"
import { SalonDot } from "@/components/salon-badge"
import { SaldoHerramientasEventos } from "./saldo-herramientas"
import { SalonSelectorOverlay } from "@/components/salon-selector-overlay"
import { useCajaEventos } from "@/lib/hooks/use-caja-eventos"
import { useSyncTiempoReal } from "@/lib/hooks/use-sync-tiempo-real"
import type {
  EgresoPendienteServicio,
  IngresoPendiente,
  PagoRealizado,
} from "@/lib/hooks/use-caja-eventos"
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Phone,
  Mail,
  MapPin,
  User,
  CreditCard,
  CheckCircle2,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  RotateCcw,
  Building,
  Archive,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Pencil,
  ArrowRight,
  Folder,
  FolderOpen,
  RefreshCw,
} from "lucide-react"

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function formatFecha(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  })
}

// Fecha de carga de un evento (created_at, viene como timestamp ISO completo
// desde la base — a diferencia de formatFecha, que espera "YYYY-MM-DD").
function formatFechaCarga(dateStr?: string): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  })
}

// Categoría visual de cada fila unificada de "Por pagar": define el color
// del badge y la etiqueta que se muestra junto al nombre del servicio.
const CATEGORIA_PAGO: Record<
  "servicio" | "menu" | "barra" | "sueldo",
  { label: string; className: string }
> = {
  servicio: { label: "Servicio", className: "bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px]" },
  menu: { label: "Menú", className: "bg-sky-50 text-sky-700 border-sky-200 text-[11px]" },
  barra: { label: "Barra", className: "bg-violet-50 text-violet-700 border-violet-200 text-[11px]" },
  sueldo: { label: "Sueldo", className: "bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]" },
}

interface FilaPagoUnificada {
  key: string
  categoria: "servicio" | "menu" | "barra" | "sueldo"
  servicioNombre: string
  eventoId: string
  eventoNombre: string
  eventoFecha?: string
  eventoFechaCarga?: string
  salon: string
  seña?: { monto: number; pagado: boolean; fecha?: string; egreso?: EgresoPendienteServicio }
  saldo?: { monto: number; pagado: boolean; fecha?: string; egreso?: EgresoPendienteServicio }
}

// Agrupa la lista plana de egresos pendientes (una fila por seña/saldo/menú/
// barra/sueldo) en una fila por servicio: la seña y el saldo restante de un
// mismo servicio quedan juntos en la misma fila, cada uno en su columna.
function agruparFilasPago(
  items: EgresoPendienteServicio[],
  eventos: EventoGuardado[],
): FilaPagoUnificada[] {
  const map = new Map<string, FilaPagoUnificada>()

  for (const eg of items) {
    const categoria: FilaPagoUnificada["categoria"] =
      eg.tipo === "seña" || eg.tipo === "saldo" ? "servicio" : (eg.tipo as "menu" | "barra" | "sueldo")
    const key =
      categoria === "servicio"
        ? `${eg.eventoId}__srv__${eg.servicioId}`
        : categoria === "sueldo"
          ? `${eg.eventoId}__sueldo__${eg.servicioId ?? eg.id}`
          : `${eg.eventoId}__${categoria}`

    let fila = map.get(key)
    if (!fila) {
      fila = {
        key,
        categoria,
        servicioNombre: eg.servicioNombre,
        eventoId: eg.eventoId,
        eventoNombre: eg.eventoNombre,
        eventoFecha: eg.eventoFecha,
        eventoFechaCarga: eg.eventoFechaCarga,
        salon: eg.salon,
      }
      map.set(key, fila)
    }

    if (eg.tipo === "seña") {
      fila.seña = { monto: eg.monto, pagado: false, egreso: eg }
    } else {
      // saldo, menú, barra y sueldo son pagos únicos: van en la columna "Saldo restante".
      fila.saldo = { monto: eg.monto, pagado: false, egreso: eg }
      // Si el saldo de un servicio sigue pendiente pero su seña ya se pagó,
      // esa seña ya no aparece en egresosPendientes (se saca de la lista al
      // pagarla) — la recuperamos desde el propio servicio del evento para
      // poder mostrarla en verde en la misma fila.
      if (eg.tipo === "saldo" && eg.estadoPago && eg.estadoPago !== "sin_seña" && !fila.seña) {
        const evento = eventos.find((e) => e.id === eg.eventoId)
        const srv = evento?.servicios?.find((s) => s.servicioId === eg.servicioId)
        if (srv?.montoSeña) {
          fila.seña = { monto: srv.montoSeña, pagado: true, fecha: srv.fechaPagoSeña }
        }
      }
    }
  }

  return [...map.values()]
}

function vencBadge(dias: number) {
  if (dias < 0)
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">vencido</Badge>
  if (dias <= 3)
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">{dias}d</Badge>
  if (dias <= 7)
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]">{dias}d</Badge>
  return <Badge variant="outline" className="text-[11px]">{dias}d</Badge>
}

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

// Cuerpo colapsable de tarjeta (misma animación que Caja Jazmines)
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

// ---------------------------------------------------------------------------
// Carpeta por salón (ordena "Por cobrar" / "Por pagar" en Todos los salones)
// ---------------------------------------------------------------------------
function CarpetaSalon({
  nombre,
  color,
  cantidad,
  total,
  totalColor,
  abierta,
  onToggle,
  children,
}: {
  nombre: string
  color: string
  cantidad: number
  total: number
  totalColor: string
  abierta: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierta}
        className="w-full flex items-center gap-2.5 px-6 py-3 hover:bg-muted/50 transition-colors text-left"
      >
        {abierta ? (
          <FolderOpen className="h-4 w-4 shrink-0" style={{ color }} />
        ) : (
          <Folder className="h-4 w-4 shrink-0" style={{ color }} />
        )}
        <span className="font-semibold text-sm" style={{ color }}>
          {nombre}
        </span>
        <Badge variant="outline" className="text-[10px]">
          {cantidad}
        </Badge>
        <span className={`ml-auto text-sm font-bold ${totalColor}`}>{formatCurrency(total)}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${abierta ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-500 ease-in-out ${
          abierta ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden min-h-0">{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcarpeta por año / mes dentro de cada salón (sección "Por pagar")
// ---------------------------------------------------------------------------
const MESES_NOMBRES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

// Agrupa los egresos de un salón por año y luego por mes (según la fecha del
// evento). Los años y meses quedan en orden cronológico ascendente: el año
// corriente primero y luego los siguientes; dentro de cada año, del mes
// corriente en adelante. Los egresos sin fecha de evento van al final.
function agruparEgresosPorAñoMes(items: EgresoPendienteServicio[]) {
  const sinFecha: EgresoPendienteServicio[] = []
  const años = new Map<number, Map<number, EgresoPendienteServicio[]>>()
  for (const eg of items) {
    const f = eg.eventoFecha
    if (!f || !/^\d{4}-\d{2}-\d{2}/.test(f)) {
      sinFecha.push(eg)
      continue
    }
    const [y, m] = f.split("-").map(Number)
    if (!años.has(y)) años.set(y, new Map())
    const meses = años.get(y)!
    if (!meses.has(m)) meses.set(m, [])
    meses.get(m)!.push(eg)
  }
  const resultado = [...años.keys()]
    .sort((a, b) => a - b)
    .map((y) => {
      const mesesMap = años.get(y)!
      const meses = [...mesesMap.keys()]
        .sort((a, b) => a - b)
        .map((m) => {
          const its = mesesMap.get(m)!
          return { mes: m, nombre: MESES_NOMBRES[m - 1], items: its, total: its.reduce((s, e) => s + e.monto, 0) }
        })
      const its = meses.flatMap((mm) => mm.items)
      return { año: y, meses, items: its, total: its.reduce((s, e) => s + e.monto, 0) }
    })
  if (sinFecha.length) {
    resultado.push({
      año: 0,
      meses: [{ mes: 0, nombre: "Sin fecha", items: sinFecha, total: sinFecha.reduce((s, e) => s + e.monto, 0) }],
      items: sinFecha,
      total: sinFecha.reduce((s, e) => s + e.monto, 0),
    })
  }
  return resultado
}

function CarpetaTiempo({
  nombre,
  cantidad,
  total,
  nivel,
  abierta,
  onToggle,
  children,
}: {
  nombre: string
  cantidad: number
  total: number
  nivel: 1 | 2
  abierta: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierta}
        className="w-full flex items-center gap-2 py-2.5 pr-6 hover:bg-muted/40 transition-colors text-left"
        style={{ paddingLeft: nivel === 1 ? "2.5rem" : "4rem" }}
      >
        {abierta ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className={`text-sm ${nivel === 1 ? "font-semibold" : "font-medium"}`}>{nombre}</span>
        <Badge variant="outline" className="text-[10px]">
          {cantidad}
        </Badge>
        <span className="ml-auto text-sm font-bold text-red-600">{formatCurrency(total)}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 ${abierta ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          abierta ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden min-h-0">{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
export default function CajaEventosPage() {
  const { state, updateEvento, addMovimientosCaja, deleteMovimientoCaja, gastosArchivados, archivarGasto, updatePagoPersonal, configuracionCajas } =
useStore()

  // Tarjetas de métricas: siempre plegadas por defecto, con los montos
  // siempre visibles. Al pasar el cursor por encima del grupo se despliegan
  // todas juntas y al quitarlo se vuelven a plegar.
  const [tarjetasAbiertas, setTarjetasAbiertas] = useState(false)
  const colapsadoMes = !tarjetasAbiertas
  const colapsadoSemana = !tarjetasAbiertas

  // Carpetas por salón dentro de "Por cobrar" y "Por pagar" (vista Todos los salones)
  const [carpetasCobrar, setCarpetasCobrar] = useState<Record<string, boolean>>({})
  const [carpetasPagar, setCarpetasPagar] = useState<Record<string, boolean>>({})

  // Sincronización constante: refresca eventos (fechas), servicios y precios
  // cada 15s y al volver a la pestaña, para que "Por pagar" siempre refleje
  // las fechas actuales de los eventos (si se reprograma uno, los vencimientos
  // se corren solos).
  useSyncTiempoReal()

  // Ids de pagos ya archivados (para ocultarlos del historial activo sin tocar el saldo)
  const pagosArchivadosIds = new Set(
    (gastosArchivados || []).filter((g) => g.origen === "caja_eventos" && g.refId).map((g) => g.refId as string),
  )

  function archivarPagoEvento(pago: PagoRealizado) {
    archivarGasto({
      fecha: pago.fecha.slice(0, 10),
      concepto: pago.servicioNombre || pago.concepto,
      monto: pago.monto,
      salon: pago.salon || null,
      origen: "caja_eventos",
      categoria: pago.tipoPago,
      eventoId: pago.eventoId ?? null,
      eventoNombre: pago.eventoNombre || null,
      refId: pago.id,
    })
  }
  const { ahora } = useClock()
  const insumos = state.insumos ?? []
  const insumosBarra = state.insumosBarra ?? []
  const [salonFiltro, setSalonFiltro] = useState<string>("todos")
  // Selector de salón estilo perfiles al entrar a la página
  const [selectorAbierto, setSelectorAbierto] = useState(true)
  const data = useCajaEventos(state, salonFiltro, ahora)
  const [clienteSel, setClienteSel] = useState<IngresoPendiente | null>(null)
  const [desgloseOpen, setDesgloseOpen] = useState(false)

  // ── Extracción de dinero de la caja (retiro con justificación) ──────────
  const [extraerOpen, setExtraerOpen] = useState(false)
  const [extraerMonto, setExtraerMonto] = useState(0)
  const [extraerConcepto, setExtraerConcepto] = useState("")
  // Modo del diálogo: "extraer" (retiro clásico) o "fijar" (colocar el monto
  // real contado y que el sistema registre la diferencia como ajuste).
  const [extraerModo, setExtraerModo] = useState<"extraer" | "fijar">("extraer")

  // ── Carrusel del dashboard: vista "Este mes" / "Esta semana" ────────────

  const router = useRouter()

  // Desplegable de "Cuotas por cobrar" (cerrado por defecto)

  // Límite de filas por tab. Cada lista muestra hasta 7 filas y un botón
  // "Ver más" para expandir el resto (o "Ver menos" para volver a colapsar).
  const LIMITE_FILAS = 7
  const [expandido, setExpandido] = useState<Record<string, boolean>>({})
  const toggleExpandido = (tab: string) => setExpandido((prev) => ({ ...prev, [tab]: !prev[tab] }))
  // Expansión progresiva en "Por pagar" y "Por cobrar": 7 iniciales → +10 → +15 → todo.
  const siguientePasoFilas = (actual: number, total: number) => {
    if (actual <= LIMITE_FILAS) return Math.min(actual + 10, total)
    if (actual <= LIMITE_FILAS + 10) return Math.min(actual + 15, total)
    return total
  }
  const etiquetaVerMas = (actual: number, total: number) => {
    const restantes = total - actual
    if (actual <= LIMITE_FILAS) return `Ver más (${Math.min(10, restantes)} más de ${restantes} pendientes)`
    if (actual <= LIMITE_FILAS + 10) return `Ver más (${Math.min(15, restantes)} más de ${restantes} pendientes)`
    return `Ver todo (${restantes} más)`
  }
  const [filasPagar, setFilasPagar] = useState(LIMITE_FILAS)
  const siguientePasoPagar = (total: number) => siguientePasoFilas(filasPagar, total)
  const [filasCobrar, setFilasCobrar] = useState(LIMITE_FILAS)

  // ── Edición de fechas de vencimiento (cuotas por cobrar y gastos por pagar) ──
  const [editVenc, setEditVenc] = useState<
    | { kind: "cuota"; ingreso: IngresoPendiente }
    | { kind: "egreso"; egreso: EgresoPendienteServicio }
    | null
  >(null)
  const [nuevaFechaVenc, setNuevaFechaVenc] = useState("")
  const [justificacionVenc, setJustificacionVenc] = useState("")

  // Todo cambio de vencimiento deja rastro en Configuración > Actividad.
  function logVencimiento(nombre: string, detalle: string) {
    fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "vencimiento", accion: "modificado", nombre, detalle }),
    }).catch(() => {})
  }

  // Registra una extracción de dinero de Caja Eventos: genera el egreso en la
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
      .filter((m) => m.cajaDestino === "caja_eventos")
      .reduce((sum, m) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto), 0)

    const movimiento: MovimientoCaja = {
      id: generateId(),
      fecha: hoyISO,
      tipo: "egreso",
      concepto: conceptoMov,
      monto,
      salon: "",
      cajaDestino: "caja_eventos",
      saldoResultante: saldoPrev - monto,
    }
    addMovimientosCaja([movimiento])

    // Archivo Histórico
    archivarGasto({
      fecha: fechaCorta,
      concepto: conceptoMov,
      monto,
      salon: null,
      origen: "caja_eventos",
      categoria: "extracción",
      eventoId: null,
      eventoNombre: null,
      refId: movimiento.id,
    })

    // Configuración > Actividad
    fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "caja",
        accion: "extracción",
        nombre: `Caja Eventos · ${formatCurrency(monto)}`,
        detalle: `Extracción de ${formatCurrency(monto)} | Motivo: ${concepto}`,
      }),
    }).catch(() => {})

    toast({
      title: "Extracción registrada",
      description: `Se retiraron ${formatCurrency(monto)} de Caja Eventos.`,
    })
    setExtraerMonto(0)
    setExtraerConcepto("")
    setExtraerOpen(false)
    setDesgloseOpen(false)
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
      .filter((m) => m.cajaDestino === "caja_eventos")
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

    const movimiento: MovimientoCaja = {
      id: generateId(),
      fecha: hoyISO,
      tipo: esFaltante ? "egreso" : "ingreso",
      concepto: conceptoMov,
      monto: montoAjuste,
      salon: "",
      cajaDestino: "caja_eventos",
      saldoResultante: montoReal,
    }
    addMovimientosCaja([movimiento])

    // Archivo Histórico: solo los faltantes son un gasto real
    if (esFaltante) {
      archivarGasto({
        fecha: fechaCorta,
        concepto: conceptoMov,
        monto: montoAjuste,
        salon: null,
        origen: "caja_eventos",
        categoria: "extracción",
        eventoId: null,
        eventoNombre: null,
        refId: movimiento.id,
      })
    }

    // Configuración > Actividad
    fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "caja",
        accion: "ajuste de saldo",
        nombre: `Caja Eventos · saldo fijado en ${formatCurrency(montoReal)}`,
        detalle: `Saldo del sistema: ${formatCurrency(saldoPrev)} → saldo real: ${formatCurrency(montoReal)} (${esFaltante ? "faltante" : "sobrante"} de ${formatCurrency(montoAjuste)}) | Nota: ${concepto}`,
      }),
    }).catch(() => {})

    toast({
      title: "Saldo actualizado",
      description: `Caja Eventos quedó en ${formatCurrency(montoReal)} (${esFaltante ? "se descontó" : "se sumó"} ${formatCurrency(montoAjuste)}).`,
    })
    setExtraerMonto(0)
    setExtraerConcepto("")
    setExtraerOpen(false)
    setDesgloseOpen(false)
  }

  function abrirEdicionCuota(ingreso: IngresoPendiente) {
    setNuevaFechaVenc(ingreso.fechaVencimiento)
    setJustificacionVenc("")
    setEditVenc({ kind: "cuota", ingreso })
  }

  function abrirEdicionEgreso(egreso: EgresoPendienteServicio) {
    setNuevaFechaVenc(egreso.fechaVencimiento)
    setJustificacionVenc("")
    setEditVenc({ kind: "egreso", egreso })
  }

  function guardarNuevaFechaVenc() {
    if (!editVenc || !nuevaFechaVenc) return

    if (editVenc.kind === "cuota") {
      // Cuota por cobrar: se edita la fecha dentro del plan de cuotas del evento.
      const ing = editVenc.ingreso
      const evento = (state.eventos || []).find((e) => e.id === ing.eventoId)
      const plan = evento?.planDeCuotas
      if (!evento || !plan?.cuotas) {
        setEditVenc(null)
        return
      }
      const cuotas = plan.cuotas.map((c) =>
        c.numero === ing.numeroCuota ? { ...c, fechaVencimiento: nuevaFechaVenc } : c,
      )
      updateEvento(evento.id, { planDeCuotas: { ...plan, cuotas } })
      logVencimiento(
        `Cuota ${ing.numeroCuota}/${ing.totalCuotas} · ${ing.eventoNombre}`,
        `Vencimiento: ${ing.fechaVencimiento} → ${nuevaFechaVenc}${
          justificacionVenc.trim() ? ` | Motivo: ${justificacionVenc.trim()}` : " | Sin justificación"
        }`,
      )
      toast({
        title: "Vencimiento actualizado",
        description: `Cuota ${ing.numeroCuota}/${ing.totalCuotas} de ${ing.eventoNombre} ahora vence el ${formatFecha(nuevaFechaVenc)}.`,
      })
    } else {
      // Gasto por pagar: la fuente depende del tipo de egreso.
      const eg = editVenc.egreso
      const evento = (state.eventos || []).find((e) => e.id === eg.eventoId)
      if (!evento) {
        setEditVenc(null)
        return
      }
      if (eg.id.endsWith("-menu")) {
        updateEvento(evento.id, { fechaPagoMenu: nuevaFechaVenc })
      } else if (eg.id.endsWith("-barra")) {
        updateEvento(evento.id, { fechaPagoBarra: nuevaFechaVenc })
      } else if (eg.id.includes("-compromiso-") && eg.servicioId) {
        updatePagoPersonal(eg.servicioId, { fechaLimitePago: nuevaFechaVenc })
      } else if (eg.id.includes("-sueldo-") && eg.servicioId) {
        const personalEvento = (evento.personalEvento || []).map((pe) =>
          pe.id === eg.servicioId ? { ...pe, fechaPago: nuevaFechaVenc } : pe,
        )
        updateEvento(evento.id, { personalEvento })
      } else if (eg.tipo === "seña" && eg.servicioId) {
        // Override manual: tiene prioridad sobre el cálculo automático en vivo
        // (que corre la fecha si el evento se reprograma).
        const servicios = (evento.servicios || []).map((s) =>
          s.servicioId === eg.servicioId ? { ...s, fechaSeñaManual: nuevaFechaVenc, fechaSeña: nuevaFechaVenc } : s,
        )
        updateEvento(evento.id, { servicios })
      } else if (eg.servicioId) {
        const servicios = (evento.servicios || []).map((s) =>
          s.servicioId === eg.servicioId
            ? { ...s, fechaSaldoManual: nuevaFechaVenc, fechaLimitePago: nuevaFechaVenc }
            : s,
        )
        updateEvento(evento.id, { servicios })
      } else {
        setEditVenc(null)
        return
      }
      logVencimiento(
        `${eg.servicioNombre} · ${eg.eventoNombre}`,
        `Vencimiento: ${eg.fechaVencimiento} → ${nuevaFechaVenc}${
          justificacionVenc.trim() ? ` | Motivo: ${justificacionVenc.trim()}` : ""
        }`,
      )
      toast({
        title: "Vencimiento actualizado",
        description: `${eg.servicioNombre} ahora vence el ${formatFecha(nuevaFechaVenc)}.`,
      })
    }
    setEditVenc(null)
  }

  // Resume la composición de egresos por tipo: "3 menú · 2 señas · 1 saldo"
  const componerEgresos = (egresos: EgresoPendienteServicio[]): string => {
    const counts: Record<string, number> = {}
    for (const e of egresos) counts[e.tipo] = (counts[e.tipo] || 0) + 1
    const partes: string[] = []
    if (counts["menu"]) partes.push(`${counts["menu"]} menú`)
    if (counts["seña"]) partes.push(`${counts["seña"]} ${counts["seña"] === 1 ? "seña" : "señas"}`)
    if (counts["saldo"]) partes.push(`${counts["saldo"]} ${counts["saldo"] === 1 ? "saldo" : "saldos"}`)
    if (counts["barra"]) partes.push(`${counts["barra"]} barra`)
    if (counts["sueldo"]) partes.push(`${counts["sueldo"]} ${counts["sueldo"] === 1 ? "sueldo" : "sueldos"}`)
    return partes.join(" · ")
  }

  // Semana actual: lunes a domingo
  const { cobroSemana, cuotasSemanaCount, pagoSemana, pagoSemanaDetalle, saldoFinSemana, rangoSemanaLabel } = useMemo(() => {
    const diaSemana = ahora.getDay() // 0 = domingo
    const lunes = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - ((diaSemana + 6) % 7))
    const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6)
    const toISO = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const desde = toISO(lunes)
    const hasta = toISO(domingo)

    const cuotasSemana = data.ingresosPendientes.filter(
      (i) => i.fechaVencimiento >= desde && i.fechaVencimiento <= hasta,
    )
    const egresosSemana = data.egresosPendientes.filter(
      (e) => e.fechaVencimiento >= desde && e.fechaVencimiento <= hasta,
    )
    const cobro = cuotasSemana.reduce((s, i) => s + i.monto, 0)
    const pago = egresosSemana.reduce((s, e) => s + e.monto, 0)
    const fmt = (d: Date) => d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })
    return {
      cobroSemana: cobro,
      cuotasSemanaCount: cuotasSemana.length,
      pagoSemana: pago,
      pagoSemanaDetalle: componerEgresos(egresosSemana),
      saldoFinSemana: data.saldoActual + cobro - pago,
      rangoSemanaLabel: `${fmt(lunes)} — ${fmt(domingo)}`,
    }
  }, [data.ingresosPendientes, data.egresosPendientes, data.saldoActual, ahora])

  // Composición de los pagos del mes en curso (mismo criterio que porPagarEsteMes)
  const pagoMesDetalle = useMemo(() => {
    const mesKey = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`
    const egresosMes = data.egresosPendientes.filter((e) => e.fechaVencimiento.slice(0, 7) === mesKey)
    return componerEgresos(egresosMes)
  }, [data.egresosPendientes, ahora])
  const [marcarCobrada, setMarcarCobrada] = useState(false)
  const [pagoConfirmar, setPagoConfirmar] = useState<EgresoPendienteServicio | null>(null)
  const [pagoExito, setPagoExito] = useState(false)
  const { toast } = useToast()

  // Marca una cuota como ya cobrada (útil al cargar eventos viejos): la saca de
  // "por cobrar" y genera el ingreso repartido entre Caja Eventos y Caja Jazmines
  // según la regla proporcional única (costo + 5% a Eventos, resto a Jazmines),
  // datado en la fecha de vencimiento de la cuota.
  function confirmarCobroCuota(ing: IngresoPendiente) {
    const evento = state.eventos?.find((e) => e.id === ing.eventoId) as EventoGuardado | undefined
    if (!evento) return
    const { yaCobrada, planUpdate, movimientos } = construirCobroCuota(
      evento,
      ing.numeroCuota,
      ing.montoTotal,
      ing.fechaVencimiento,
      state.movimientosCaja || [],
      {
        insumos: state.insumos || [],
        insumosBarra: state.insumosBarra || [],
        recetas: state.recetas || [],
        cocteles: state.cocteles || [],
        servicios: state.servicios || [],
      },
    )
    if (yaCobrada) {
      toast({ title: "Esta cuota ya figura como cobrada." })
      return
    }
    if (planUpdate) updateEvento(ing.eventoId, planUpdate)
    if (movimientos.length > 0) addMovimientosCaja(movimientos)
    toast({
      title: "Cuota marcada como cobrada",
      description: `Cuota ${ing.numeroCuota}/${ing.totalCuotas} · ${ing.eventoNombre}`,
    })
    setClienteSel(null)
  }

  const valorStockCocina = useMemo(
    () => insumos.reduce((sum, ins) => sum + (ins.stockActual ?? 0) * (ins.precioUnitario ?? 0), 0),
    [insumos]
  )
  const valorStockBarra = useMemo(
    () => insumosBarra.reduce((sum, ins) => sum + (ins.stockActual ?? 0) * (ins.precioUnitario ?? 0), 0),
    [insumosBarra]
  )
  const [mesCalendario, setMesCalendario] = useState(() => {
    return new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  })

  // Día del calendario seleccionado para ver el detalle de cobros/pagos (fecha YYYY-MM-DD)
  const [diaDetalle, setDiaDetalle] = useState<string | null>(null)

  const {
    saldoActual,
    porCobrarEsteMes,
    porPagarEsteMes,
    saldoFinMes,
    proyeccionMensual,
    ingresosPendientes,
    egresosPendientes,
    pagosRealizados,
    vienenEstaSemana,
    totalPorCobrar,
    mesActualLabel,
  } = data

  const totalPatrimonio = saldoActual + valorStockCocina + valorStockBarra

  // Cantidad de cuotas ya vencidas (que deberían haberse cobrado) para el aviso
  const vencidasCount = vienenEstaSemana.filter((i) => i.esVencida).length

  // "Por pagar" unificado: muestra TODOS los vencimientos pendientes sin
  // límite de fecha (antes se apartaban en "Gastos futuros" los de +30 días).
  // El total del pie se calcula a 60 días para reflejar lo que viene pronto.
  const DIAS_TOTAL_PAGO = 60
  const egresosProximos = egresosPendientes
  // Filtros combinables en "Por pagar": salón (madre) + tipo de pasivo +
  // sub-filtro (tipo de servicio o evento) + búsqueda (lupa).
  const [filtroPagar, setFiltroPagar] = useState<FiltroEgresos>(FILTRO_EGRESOS_INICIAL)
  const egresosProximosFiltrados = useMemo(
    () => filtrarEgresos(egresosProximos, filtroPagar),
    [egresosProximos, filtroPagar],
  )
  // Catálogo completo de servicios activos (Finanzas → Servicios), para que
  // el sub-filtro "Servicios" de la barra de filtros muestre todo lo que
  // ofrecemos y no solo lo que tiene un pago pendiente en este momento.
  const catalogoServiciosActivos = useMemo(
    () => state.servicios.filter((s) => s.activo).map((s) => s.nombre),
    [state.servicios],
  )
  const filtroPagarActivo = esFiltroEgresosActivo(filtroPagar)
  const totalPorPagar60 = useMemo(
    () => egresosPendientes.filter((e) => e.diasRestantes <= DIAS_TOTAL_PAGO).reduce((s, e) => s + e.monto, 0),
    [egresosPendientes],
  )
  const totalPorPagarFiltrado = egresosProximosFiltrados.reduce((s, e) => s + e.monto, 0)

  // Marcar egreso de proveedor como pagado: registra la fecha de pago, actualiza
  // el estado del servicio y crea el movimiento de egreso real en Caja Eventos
  // (así el dashboard "por pagar" del mes se actualiza al instante).
  const handleMarcarPagado = (egreso: EgresoPendienteServicio) => {
    const evento = state.eventos.find((e) => e.id === egreso.eventoId)
    if (!evento) return
    const hoyISO = new Date().toISOString()
    const fechaPago = hoyISO.split("T")[0]

    if (egreso.tipo === "menu") {
      // El costo de cocina (menú) queda marcado como pagado en el evento,
      // lo que actualiza el indicador de /eventos/lista.
      updateEvento(egreso.eventoId, { cocinaPagada: true })
    } else if (egreso.tipo === "barra") {
      updateEvento(egreso.eventoId, { barraPagada: true })
    } else if (egreso.tipo === "sueldo") {
      if (egreso.id.includes("-compromiso-")) {
        // Compromiso asignado manualmente desde Finanzas → Personal
        updatePagoPersonal(egreso.servicioId!, {
          estado: "pagado",
          fechaPago: new Date().toISOString().split("T")[0],
        })
      } else {
        // Sueldo del personal del evento (generador de contrato): marcar la
        // entrada como pagada y FIJAR el monto realmente pagado (histórico),
        // igual que hace Costos del evento, para que ambas pantallas coincidan.
        const nuevoPersonal = (evento.personalEvento ?? []).map((pe) =>
          pe.id === egreso.servicioId ? { ...pe, pagado: true, monto: egreso.monto } : pe
        )
        updateEvento(egreso.eventoId, { personalEvento: nuevoPersonal })
      }
    } else {
      // Servicio: matchear por servicioId exacto y marcar pagado + estadoPago,
      // así el indicador de servicios en /eventos/lista (que lee srv.pagado) se sincroniza.
      const nuevosServicios = (evento.servicios ?? []).map((srv) => {
        if (srv.servicioId !== egreso.servicioId) return srv
        if (egreso.tipo === "seña") {
          // Fijar el monto de seña realmente pagado como histórico: el saldo
          // pendiente en Costos se calcula como costo actual − esta seña.
          return { ...srv, estadoPago: "señado" as const, fechaPagoSeña: fechaPago, montoSeña: egreso.monto }
        }
        return {
          ...srv,
          pagado: true,
          estadoPago: "pagado_total" as const,
          saldoPendiente: 0,
          fechaPagoSaldo: fechaPago,
        }
      })
      updateEvento(egreso.eventoId, { servicios: nuevosServicios })
    }

    // Registrar el egreso real que sale de Caja Eventos
    const saldoPrev = (state.movimientosCaja ?? [])
      .filter((m) => m.cajaDestino === "caja_eventos")
      .reduce((sum, m) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto), 0)

    const conceptoEgreso =
      egreso.tipo === "menu"
        ? `Pago menú - ${egreso.eventoNombre}`
        : egreso.tipo === "barra"
          ? `Pago barra - ${egreso.eventoNombre}`
          : egreso.tipo === "sueldo"
            ? `Pago sueldo ${egreso.servicioNombre} - ${egreso.eventoNombre}`
            : `Pago ${egreso.tipo === "seña" ? "seña" : "saldo"} ${egreso.servicioNombre} - ${egreso.eventoNombre}`

    const movimiento: MovimientoCaja = {
      id: generateId(),
      fecha: hoyISO,
      tipo: "egreso",
      concepto: conceptoEgreso,
      monto: egreso.monto,
      salon: evento.salon || "",
      eventoId: egreso.eventoId,
      cajaDestino: "caja_eventos",
      saldoResultante: saldoPrev - egreso.monto,
    }
    addMovimientosCaja([movimiento])
  }

  // Confirma el pago desde el diálogo: ejecuta el marcado y muestra la animación de check.
  const confirmarMarcarPagado = () => {
    if (!pagoConfirmar) return
    handleMarcarPagado(pagoConfirmar)
    setPagoConfirmar(null)
    setPagoExito(true)
    setTimeout(() => setPagoExito(false), 1400)
  }

  // Revertir un pago realizado: vuelve "no realizado", actualizando los
  // indicadores de costos cubiertos en /eventos/lista y eliminando el egreso.
  const handleRevertirPago = (pago: PagoRealizado) => {
    if (pago.eventoId) {
      const evento = state.eventos.find((e) => e.id === pago.eventoId)
      if (evento) {
        if (pago.tipoPago === "menu") {
          updateEvento(pago.eventoId, { cocinaPagada: false })
        } else if (pago.tipoPago === "barra") {
          updateEvento(pago.eventoId, { barraPagada: false })
        } else if (pago.tipoPago === "sueldo") {
          // Revertir sueldo: puede ser un compromiso manual (pagosPersonal) o
          // una entrada de personal del generador de contrato
          const compromisoPagado = (state.pagosPersonal || []).find(
            (pp) =>
              pp.eventoId === pago.eventoId &&
              pp.estado === "pagado" &&
              `${pp.nombrePersonal} (${pp.servicioNombre})` === pago.servicioNombre
          )
          if (compromisoPagado) {
            updatePagoPersonal(compromisoPagado.id, { estado: "pendiente", fechaPago: undefined })
          } else {
            const nuevoPersonal = (evento.personalEvento ?? []).map((pe) =>
              `${pe.nombre} (${pe.funcion})` === pago.servicioNombre ? { ...pe, pagado: false } : pe
            )
            updateEvento(pago.eventoId, { personalEvento: nuevoPersonal })
          }
        } else if (pago.tipoPago === "seña" || pago.tipoPago === "saldo") {
          const nuevosServicios = (evento.servicios ?? []).map((srv) => {
            if (srv.nombre !== pago.servicioNombre) return srv
            if (pago.tipoPago === "seña") {
              return { ...srv, estadoPago: "sin_seña" as const, fechaPagoSeña: undefined }
            }
            // Revertir saldo: vuelve a pendiente y restaura el saldo adeudado
            return {
              ...srv,
              pagado: false,
              estadoPago: "saldo_pendiente" as const,
              saldoPendiente: pago.monto,
              fechaPagoSaldo: undefined,
            }
          })
          updateEvento(pago.eventoId, { servicios: nuevosServicios })
        }
      }
    }
    // Eliminar el movimiento de egreso para que el saldo y el historial se actualicen
    deleteMovimientoCaja(pago.id)
  }

  // Datos del calendario del mes seleccionado
  const calendario = useMemo(() => {
    const year = mesCalendario.getFullYear()
    const month = mesCalendario.getMonth()
    const primerDia = new Date(year, month, 1)
    const diaInicio = primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1 // lunes=0
    const diasEnMes = new Date(year, month + 1, 0).getDate()

    // Mapear eventos financieros por día
    const porDia: Record<number, { cobrar: number; pagar: number }> = {}
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`
    for (const ing of ingresosPendientes) {
      if (ing.fechaVencimiento.slice(0, 7) !== monthKey) continue
      const dia = Number(ing.fechaVencimiento.slice(8, 10))
      porDia[dia] = porDia[dia] || { cobrar: 0, pagar: 0 }
      porDia[dia].cobrar += ing.monto
    }
    for (const eg of egresosPendientes) {
      if (eg.fechaVencimiento.slice(0, 7) !== monthKey) continue
      const dia = Number(eg.fechaVencimiento.slice(8, 10))
      porDia[dia] = porDia[dia] || { cobrar: 0, pagar: 0 }
      porDia[dia].pagar += eg.monto
    }

    const celdas: Array<{ dia: number | null; cobrar: number; pagar: number }> = []
    for (let i = 0; i < diaInicio; i++) celdas.push({ dia: null, cobrar: 0, pagar: 0 })
    for (let d = 1; d <= diasEnMes; d++) {
      celdas.push({ dia: d, cobrar: porDia[d]?.cobrar || 0, pagar: porDia[d]?.pagar || 0 })
    }
    return { celdas, label: mesCalendario.toLocaleDateString("es-AR", { month: "long", year: "numeric" }) }
  }, [mesCalendario, ingresosPendientes, egresosPendientes])

  const cambiarMes = (delta: number) =>
    setMesCalendario((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))

  // Eventos del mes visible en el calendario, con su costo total (insumos
  // recalculados a precios de hoy + servicios + operativo). Alimenta el panel
  // lateral "Gastos del mes" pegado al calendario.
  const eventosDelMes = useMemo(() => {
    const monthKey = `${mesCalendario.getFullYear()}-${String(mesCalendario.getMonth() + 1).padStart(2, "0")}`
    const eventos = (state.eventos ?? []).filter(
      (ev) =>
        ev.fecha?.slice(0, 7) === monthKey &&
        ev.estado !== "cancelado" &&
        (salonFiltro === "todos" || ev.salon === salonFiltro),
    )
    const lista = eventos
      .map((ev) => {
        const costoInsumos = calcularCostoInsumosEvento(
          ev,
          state.recetas ?? [],
          insumos,
          state.cocteles ?? [],
          insumosBarra,
        )
        // Costo de servicios EN VIVO desde el catálogo (Finanzas → Servicios):
        // si cambia un precio, los gastos del evento se actualizan solos.
        const costoServiciosLive = (ev.servicios ?? []).reduce(
          (s, srv) => s + calcularSeñaSaldoServicio(srv, state).costoTotal,
          0,
        )
        return {
          id: ev.id,
          nombre: ev.nombrePareja || ev.nombre || "Sin nombre",
          fecha: ev.fecha,
          salon: ev.salon,
          costoTotal: costoInsumos + costoServiciosLive + (ev.costoOperativo ?? 0),
        }
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    return { lista, total: lista.reduce((s, e) => s + e.costoTotal, 0) }
  }, [mesCalendario, state.eventos, state.recetas, state.cocteles, state.servicios, insumos, insumosBarra, salonFiltro])

  // Movimientos del día seleccionado en el calendario
  const detalleDia = useMemo(() => {
    if (!diaDetalle) return null
    const cobros = ingresosPendientes.filter((i) => i.fechaVencimiento === diaDetalle)
    const pagos = egresosPendientes.filter((e) => e.fechaVencimiento === diaDetalle)
    return { cobros, pagos }
  }, [diaDetalle, ingresosPendientes, egresosPendientes])

  const hoyNum = ahora.getDate()
  const esMesActualCal =
    mesCalendario.getMonth() === ahora.getMonth() &&
    mesCalendario.getFullYear() === ahora.getFullYear()

  // Color del salón activo: tiñe el icono del header y el fondo del body.
  const colorSalonActivo =
    salonFiltro === "todos" ? SALON_COLOR_GENERAL : salonColor(salonFiltro, configuracionCajas)

  // Agrupar por salón para las carpetas de "Por cobrar" y "Por pagar"
  // (solo se usan en la vista de Todos los salones)
  const ordenSalones = useMemo(() => [...SALONES, "General"], [])
  const gruposCobrar = useMemo(() => {
    const map = new Map<string, IngresoPendiente[]>()
    for (const ing of ingresosPendientes) {
      const key = ing.salon && ing.salon !== "" ? ing.salon : "General"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ing)
    }
    const claves = [...ordenSalones.filter((s) => map.has(s)), ...[...map.keys()].filter((k) => !ordenSalones.includes(k))]
    return claves.map((s) => {
      const items = map.get(s)!
      return { salon: s, items, total: items.reduce((sum, i) => sum + i.monto, 0) }
    })
  }, [ingresosPendientes, ordenSalones])

  const gruposPagar = useMemo(() => {
    const map = new Map<string, EgresoPendienteServicio[]>()
    for (const eg of egresosProximosFiltrados) {
      const key = eg.salon && eg.salon !== "" ? eg.salon : "General"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(eg)
    }
    const claves = [...ordenSalones.filter((s) => map.has(s)), ...[...map.keys()].filter((k) => !ordenSalones.includes(k))]
    return claves.map((s) => {
      const items = map.get(s)!
      return { salon: s, items, total: items.reduce((sum, e) => sum + e.monto, 0) }
    })
  }, [egresosProximosFiltrados, ordenSalones])

  // Filas de las tablas (compartidas entre la vista plana y las carpetas)
  const renderFilasCobrar = (items: IngresoPendiente[]) =>
    items.map((ing) => (
      <TableRow key={ing.id} className="cursor-pointer" onClick={() => setClienteSel(ing)}>
        <TableCell className="pl-6">
          <p className="font-medium text-sm">{ing.contacto.nombre}</p>
          <p className="text-xs text-muted-foreground">{ing.eventoNombre} · {ing.salon}</p>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {ing.numeroCuota}/{ing.totalCuotas}
        </TableCell>
        <TableCell>
          <button
            type="button"
            className="group flex items-center gap-2 rounded-md px-1.5 py-0.5 -ml-1.5 hover:bg-muted transition-colors"
            title="Cambiar fecha de vencimiento"
            onClick={(e) => {
              e.stopPropagation()
              abrirEdicionCuota(ing)
            }}
          >
            <span className="text-sm underline decoration-dotted underline-offset-4 decoration-muted-foreground/50">
              {formatFecha(ing.fechaVencimiento)}
            </span>
            {vencBadge(ing.diasRestantes)}
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </TableCell>
        <TableCell className="text-right pr-6 font-bold text-emerald-700">
          +{formatCurrency(ing.monto)}
        </TableCell>
      </TableRow>
    ))

  // Celda clicable de Seña / Saldo restante: pendiente (roja, click para
  // pagar) o pagada (verde, muestra cuánto y cuándo se pagó).
  const renderCeldaPago = (dato?: FilaPagoUnificada["seña"]) => {
    if (!dato) return <span className="text-xs text-muted-foreground">—</span>
    if (dato.pagado) {
      return (
        <div className="inline-flex flex-col items-end gap-0.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1">
          <span className="text-xs font-bold text-emerald-700">{formatCurrency(dato.monto)}</span>
          {dato.fecha && <span className="text-[10px] text-emerald-600">{formatFecha(dato.fecha)}</span>}
        </div>
      )
    }
    return (
      <button
        type="button"
        title="Marcar como pagado"
        onClick={() => dato.egreso && setPagoConfirmar(dato.egreso)}
        className="inline-flex flex-col items-end gap-0.5 rounded-md border border-yellow-300 bg-yellow-50 px-2.5 py-1 text-right transition-colors hover:bg-yellow-100"
      >
        <span className="text-xs font-bold text-red-600">−{formatCurrency(dato.monto)}</span>
      </button>
    )
  }

  const renderFilasPagar = (items: EgresoPendienteServicio[]) =>
    agruparFilasPago(items, state.eventos ?? []).map((fila) => (
      <TableRow key={fila.key}>
        <TableCell className="pl-6">
          <Badge variant="outline" className={CATEGORIA_PAGO[fila.categoria].className}>
            {CATEGORIA_PAGO[fila.categoria].label}
          </Badge>
          <p className="font-medium text-sm mt-1">{fila.servicioNombre}</p>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{formatFechaCarga(fila.eventoFechaCarga)}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {fila.eventoFecha ? formatFecha(fila.eventoFecha) : "—"}
        </TableCell>
        <TableCell>
          <p className="text-sm">{fila.eventoNombre}</p>
          {fila.salon && (
            <p className="inline-flex items-center gap-1 align-middle text-xs text-muted-foreground">
              <SalonDot salon={fila.salon} size={7} />
              {salonLabel(fila.salon)}
            </p>
          )}
        </TableCell>
        <TableCell className="text-right">{renderCeldaPago(fila.seña)}</TableCell>
        <TableCell className="text-right pr-6">{renderCeldaPago(fila.saldo)}</TableCell>
      </TableRow>
    ))

  // Selector de salón estilo perfiles al entrar
  if (selectorAbierto) {
    return (
      <SalonSelectorOverlay
        titulo="Caja Eventos"
        onSelect={(salon) => {
          setSalonFiltro(salon)
          setSelectorAbierto(false)
        }}
      />
    )
  }

  return (
    <div
      className="mx-auto w-full max-w-[1720px] px-4 lg:px-6 py-4 space-y-4 transition-colors duration-500"
      style={{
        backgroundColor:
          salonFiltro === "todos"
            ? undefined
            : `color-mix(in srgb, ${colorSalonActivo} 7%, transparent)`,
      }}
    >
      {/* Header: barra blanca fija arriba mientras se scrollea (fuera del
          wrapper con overflow-hidden para que el sticky funcione) */}
      <div
        className="sticky top-0 z-30 w-full rounded-xl border border-border shadow-sm px-4 py-2 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0"
        style={{ backgroundColor: "#ffffff" }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-500"
            style={{ backgroundColor: `color-mix(in srgb, ${colorSalonActivo} 16%, white)` }}
          >
            <Wallet className="h-5 w-5 transition-colors duration-500" style={{ color: colorSalonActivo }} />
          </div>
          <h1 className="text-lg xl:text-2xl font-bold tracking-tight truncate" style={{ color: "#000000" }}>
            Caja Eventos
            <span style={{ color: colorSalonActivo }}>
              {` · ${salonFiltro === "todos" ? "Todos los salones" : salonLabel(salonFiltro)}`}
            </span>
          </h1>
        </div>
        <SaldoHerramientasEventos salonFiltro={salonFiltro} />
        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-700">
            Cambiar salón
            <ArrowRight className="h-4 w-4 animate-pulse" aria-hidden="true" />
          </span>
          <button
            type="button"
            onClick={() => setSelectorAbierto(true)}
            className="group flex h-9 items-center gap-2 rounded-full border border-input bg-background pl-3 pr-4 text-sm font-medium shadow-sm transition-colors hover:border-purple-400 hover:bg-purple-50"
            aria-label="Cambiar salón: volver al selector de salones"
          >
            <RefreshCw
              className="h-4 w-4 text-purple-700 transition-transform duration-500 group-hover:rotate-180"
              aria-hidden="true"
            />
            {salonFiltro === "todos" ? (
              <span>Todos los salones</span>
            ) : (
              <span className="flex items-center gap-2">
                <SalonDot salon={salonFiltro} size={8} />
                {salonLabel(salonFiltro)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* VISTA ÚNICA: KPIs + calendario/panel entran en el alto restante de la
          ventana (100dvh menos padding, header fijo y separación) sin scroll */}
      <div className="flex min-h-0 flex-col gap-3 lg:h-[calc(100dvh-6.5rem)] lg:overflow-hidden">
      {/* DASHBOARD: tarjetas en una fila, estilo Caja Jazmines.
          Siempre plegadas; el hover sobre el grupo las despliega todas juntas
          y al retirar el cursor se vuelven a plegar. Montos siempre visibles. */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 items-start shrink-0"
        onMouseEnter={() => setTarjetasAbiertas(true)}
        onMouseLeave={() => setTarjetasAbiertas(false)}
      >
        {/* Saldo Actual (destacada, igual que en Jazmines) */}
        <Card
          style={{ backgroundColor: "#ffffff" }}
          className="cursor-pointer rounded-xl border-blue-100 shadow-sm transition-shadow hover:shadow-md"
          onClick={() => {
            if (colapsadoMes) {
              setTarjetasAbiertas(true)
              return
            }
            setDesgloseOpen(true)
          }}
          role="button"
          tabIndex={0}
          aria-label="Ver desglose del saldo actual"
        >
          <CardContent className="relative p-3 flex h-full flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#0035db" }}>
                Saldo Actual
              </p>
              <div className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4" style={{ color: "#0035db" }} />
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${colapsadoMes ? "" : "rotate-180"}`}
                  style={{ color: "#0035db" }}
                  aria-hidden="true"
                />
              </div>
            </div>
            <CuerpoColapsable colapsado={colapsadoMes}>
              <p className="text-lg font-bold whitespace-nowrap" style={{ color: "#3c4ce8" }}>
                {formatCurrency(saldoActual)}
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

        {/* Cobro este mes */}
        <Card
          className="rounded-xl border-border shadow-sm transition-shadow hover:shadow-md"
          style={{ backgroundColor: "#ffffff" }}
        >
          <CardContent className="relative p-3 flex h-full flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ingreso mensual
              </p>
              <div className="flex items-center gap-1.5">
                <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${colapsadoMes ? "" : "rotate-180"}`}
                  aria-hidden="true"
                />
              </div>
            </div>
            <CuerpoColapsable colapsado={colapsadoMes}>
              <p className="text-lg font-bold whitespace-nowrap text-emerald-600">
                {`+${formatCurrency(porCobrarEsteMes)}`}
              </p>
              <p className="text-xs mt-auto pt-1 text-muted-foreground">
                {(() => {
                  const mesKey = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`
                  const cuotasMes = ingresosPendientes.filter((i) => i.fechaVencimiento.slice(0, 7) === mesKey)
                  return cuotasMes.length > 0
                    ? `${cuotasMes.length} ${cuotasMes.length === 1 ? "cuota" : "cuotas"}`
                    : "Sin cuotas este mes"
                })()}
              </p>
            </CuerpoColapsable>
          </CardContent>
        </Card>

        {/* Pago este mes */}
        <Card
          className="rounded-xl border-border shadow-sm transition-shadow hover:shadow-md"
          style={{ backgroundColor: "#ffffff" }}
        >
          <CardContent className="relative p-3 flex h-full flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Egreso mensual
              </p>
              <div className="flex items-center gap-1.5">
                <ArrowUpFromLine className="h-4 w-4 text-red-500" />
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${colapsadoMes ? "" : "rotate-180"}`}
                  aria-hidden="true"
                />
              </div>
            </div>
            <CuerpoColapsable colapsado={colapsadoMes}>
              <p className="text-lg font-bold whitespace-nowrap text-red-600">
                {`−${formatCurrency(porPagarEsteMes)}`}
              </p>
              <p className="text-xs mt-auto pt-1 text-muted-foreground">
                {pagoMesDetalle || "Sin pagos este mes"}
              </p>
            </CuerpoColapsable>
          </CardContent>
        </Card>

        {/* Tengo a fin de mes */}
        <Card
          className="rounded-xl border-border shadow-sm transition-shadow hover:shadow-md"
          style={{ backgroundColor: "#ffffff" }}
        >
          <CardContent className="relative p-3 flex h-full flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Balance mensual
              </p>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" style={{ color: "#0035db" }} />
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${colapsadoMes ? "" : "rotate-180"}`}
                  aria-hidden="true"
                />
              </div>
            </div>
            <CuerpoColapsable colapsado={colapsadoMes}>
              <p className="text-lg font-bold whitespace-nowrap text-foreground">
                {formatCurrency(saldoFinMes)}
              </p>
              <p className="text-xs mt-auto pt-1 capitalize text-muted-foreground">
                {mesActualLabel}
              </p>
            </CuerpoColapsable>
          </CardContent>
        </Card>

        {/* Cobro esta semana */}
        <Card
          className="rounded-xl border-border shadow-sm transition-shadow hover:shadow-md"
          style={{ backgroundColor: "#ffffff" }}
        >
          <CardContent className="relative p-3 flex h-full flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" title={rangoSemanaLabel}>
                Ingreso semanal
              </p>
              <div className="flex items-center gap-1.5">
                <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${colapsadoSemana ? "" : "rotate-180"}`}
                  aria-hidden="true"
                />
              </div>
            </div>
            <CuerpoColapsable colapsado={colapsadoSemana}>
              <p className="text-lg font-bold whitespace-nowrap text-emerald-600">
                {`+${formatCurrency(cobroSemana)}`}
              </p>
              <p className="text-xs mt-auto pt-1 text-muted-foreground">
                {cuotasSemanaCount > 0
                  ? `${cuotasSemanaCount} ${cuotasSemanaCount === 1 ? "cuota a cobrar" : "cuotas a cobrar"}`
                  : "Nada por cobrar esta semana"}
              </p>
            </CuerpoColapsable>
          </CardContent>
        </Card>

        {/* Egreso semanal */}
        <Card
          className="rounded-xl border-border shadow-sm transition-shadow hover:shadow-md"
          style={{ backgroundColor: "#ffffff" }}
        >
          <CardContent className="relative p-3 flex h-full flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Egreso semanal
              </p>
              <div className="flex items-center gap-1.5">
                <ArrowUpFromLine className="h-4 w-4 text-red-500" />
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${colapsadoSemana ? "" : "rotate-180"}`}
                  aria-hidden="true"
                />
              </div>
            </div>
            <CuerpoColapsable colapsado={colapsadoSemana}>
              <p className="text-lg font-bold whitespace-nowrap text-red-600">
                {`−${formatCurrency(pagoSemana)}`}
              </p>
              <p className="text-xs mt-auto pt-1 text-muted-foreground">
                {pagoSemanaDetalle || "Sin gastos esta semana"}
              </p>
            </CuerpoColapsable>
          </CardContent>
        </Card>

        {/* Tengo a fin de semana */}
        <Card
          className="rounded-xl border-border shadow-sm transition-shadow hover:shadow-md"
          style={{ backgroundColor: "#ffffff" }}
        >
          <CardContent className="relative p-3 flex h-full flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Balance semanal
              </p>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" style={{ color: "#0035db" }} />
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${colapsadoSemana ? "" : "rotate-180"}`}
                  aria-hidden="true"
                />
              </div>
            </div>
            <CuerpoColapsable colapsado={colapsadoSemana}>
              <p className="text-lg font-bold whitespace-nowrap text-foreground">
                {formatCurrency(saldoFinSemana)}
              </p>
              <p className="text-xs mt-auto pt-1 text-muted-foreground">
                Saldo actual + cobros − gastos
              </p>
            </CuerpoColapsable>
          </CardContent>
        </Card>
      </div>

      {/* CALENDARIO mensual + panel lateral de gastos por evento:
          ocupan todo el alto restante de la vista única */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3 items-stretch">
      <Card className="rounded-xl bg-white shadow-sm flex min-h-0 flex-col py-3 gap-2">
        <CardHeader className="pb-0 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2 capitalize">
              <CalendarDays className="h-4 w-4 text-teal-600" />
              Calendario Caja Eventos {calendario.label}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-6 px-2" onClick={() => cambiarMes(-1)}>‹</Button>
              <Button variant="outline" size="sm" className="h-6 px-2" onClick={() => cambiarMes(1)}>›</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <div className="grid grid-cols-7 gap-1 mb-1 shrink-0">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-0.5">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 flex-1 min-h-0 auto-rows-fr">
            {calendario.celdas.map((celda, i) => {
              const esHoy = esMesActualCal && celda.dia === hoyNum
              const tieneMov = celda.cobrar > 0 || celda.pagar > 0
              const fechaCelda =
                celda.dia !== null
                  ? `${mesCalendario.getFullYear()}-${String(mesCalendario.getMonth() + 1).padStart(2, "0")}-${String(celda.dia).padStart(2, "0")}`
                  : null
              const contenido = celda.dia !== null && (
                <>
                  <div className={`font-medium ${esHoy ? "text-teal-700" : "text-foreground"}`}>{celda.dia}</div>
                  {celda.cobrar > 0 && (
                    <div className="text-emerald-700 font-medium truncate">+{formatCurrency(celda.cobrar)}</div>
                  )}
                  {celda.pagar > 0 && (
                    <div className="text-red-600 font-medium truncate">−{formatCurrency(celda.pagar)}</div>
                  )}
                </>
              )
              if (tieneMov && fechaCelda) {
                return (
                  <button
                    key={i}
                    type="button"
                    title="Ver detalle del día"
                    onClick={() => setDiaDetalle(fechaCelda)}
                    className={`min-h-[42px] lg:min-h-0 h-full overflow-hidden rounded-md border p-1 text-[10px] leading-tight text-left cursor-pointer transition-colors hover:border-teal-400 hover:bg-teal-50/60 ${
                      esHoy ? "border-teal-400 bg-teal-50" : "border-border bg-muted/30"
                    }`}
                  >
                    {contenido}
                  </button>
                )
              }
              return (
                <div
                  key={i}
                  className={`min-h-[42px] lg:min-h-0 h-full overflow-hidden rounded-md border p-1 text-[10px] leading-tight ${
                    celda.dia === null
                      ? "border-transparent"
                      : esHoy
                      ? "border-teal-400 bg-teal-50"
                      : "border-border"
                  }`}
                >
                  {contenido}
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground shrink-0">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> A cobrar</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> A pagar</span>
          </div>
        </CardContent>
      </Card>

      {/* Panel lateral: eventos del mes con su costo total.
          Su altura acompaña al calendario; si la lista es larga, solo este
          panel scrollea internamente. */}
      <Card className="lg:h-full rounded-xl bg-white shadow-sm flex min-h-0 flex-col py-3 gap-2">
        <CardHeader className="pb-0 shrink-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building className="h-4 w-4 text-teal-600" />
            Gastos del mes por evento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 flex-1 min-h-0 overflow-y-auto">
          {eventosDelMes.lista.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin eventos este mes.</p>
          ) : (
            <>
              {eventosDelMes.lista.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => router.push(`/eventos/costos?id=${ev.id}`)}
                  title="Ver el detalle de costos de este evento"
                  className="w-full text-left rounded-md border border-border bg-muted/30 p-2.5 transition-colors hover:bg-muted hover:border-teal-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <SalonDot salon={ev.salon} />
                    <span className="text-xs font-semibold truncate">{ev.nombre}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-muted-foreground">{formatFecha(ev.fecha)}</span>
                    <span className="text-xs font-bold text-red-600">−{formatCurrency(ev.costoTotal)}</span>
                  </div>
                </button>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2 mt-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Total ({eventosDelMes.lista.length} {eventosDelMes.lista.length === 1 ? "evento" : "eventos"})
                </span>
                <span className="text-sm font-bold text-red-600">���{formatCurrency(eventosDelMes.total)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
      </div>

      {/* TABS: Por pagar abierto al centro (60%), Por cobrar e Historial plegados a los lados (20% c/u) */}
      <Tabs defaultValue="pagar" className="w-full">
        <TabsList className="grid w-full grid-cols-[1fr_3fr_1fr]">
          <TabsTrigger value="cobrar" className="gap-1.5 bg-emerald-100/40">
            <ArrowDownToLine className="h-4 w-4" /> Por cobrar
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] ml-1">
              {ingresosPendientes.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pagar" className="gap-1.5 bg-yellow-100/40">
            <ArrowUpFromLine className="h-4 w-4" /> Por pagar
            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] ml-1">
              {egresosProximos.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-1.5 bg-slate-200/50">
            <History className="h-4 w-4" /> Historial
            <Badge className="bg-muted text-muted-foreground border-border text-[10px] ml-1">
              {pagosRealizados.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* POR COBRAR */}
        <TabsContent value="cobrar" className="mt-4">
          <Card>
            <CardContent className="px-0 py-2">
              {ingresosPendientes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No hay cuotas pendientes de cobro.</p>
              ) : salonFiltro === "todos" ? (
                <div>
                  <p className="text-xs text-muted-foreground px-6 pb-2">
                    Cuotas ordenadas en carpetas por salón. Tocá una carpeta para ver su detalle.
                  </p>
                  {gruposCobrar.map((g) => (
                    <CarpetaSalon
                      key={g.salon}
                      nombre={g.salon === "General" ? "General" : salonLabel(g.salon)}
                      color={g.salon === "General" ? SALON_COLOR_GENERAL : salonColor(g.salon, configuracionCajas)}
                      cantidad={g.items.length}
                      total={g.total}
                      totalColor="text-emerald-700"
                      abierta={!!carpetasCobrar[g.salon]}
                      onToggle={() => setCarpetasCobrar((prev) => ({ ...prev, [g.salon]: !prev[g.salon] }))}
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-6">Cliente / Evento</TableHead>
                            <TableHead>Cuota</TableHead>
                            <TableHead>Vence</TableHead>
                            <TableHead className="text-right pr-6">A cobrar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>{renderFilasCobrar(g.items)}</TableBody>
                      </Table>
                    </CarpetaSalon>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Cliente / Evento</TableHead>
                      <TableHead>Cuota</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead className="text-right pr-6">A cobrar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{renderFilasCobrar(ingresosPendientes.slice(0, filasCobrar))}</TableBody>
                </Table>
              )}
              {salonFiltro !== "todos" && ingresosPendientes.length > LIMITE_FILAS && (
                <div className="px-6 pt-2">
                  {filasCobrar < ingresosPendientes.length ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilasCobrar(siguientePasoFilas(filasCobrar, ingresosPendientes.length))}
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className="h-3.5 w-3.5 mr-1" />
                      {etiquetaVerMas(filasCobrar, ingresosPendientes.length)}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilasCobrar(LIMITE_FILAS)}
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ChevronUp className="h-3.5 w-3.5 mr-1" /> Ver menos
                    </Button>
                  )}
                </div>
              )}
              {ingresosPendientes.length > 0 && (
                <div className="flex items-center justify-between px-6 pt-3 mt-1 border-t border-border">
                  <span className="text-sm font-medium text-muted-foreground">Total por cobrar</span>
                  <span className="text-base font-bold text-emerald-700">+{formatCurrency(totalPorCobrar)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* POR PAGAR (todos los vencimientos pendientes, ordenados por fecha) */}
        <TabsContent value="pagar" className="mt-4">
          <Card>
            <CardContent className="px-0 py-2">
              <p className="text-xs text-muted-foreground px-6 pb-2">
                Todos los pagos pendientes a proveedores, ordenados por fecha de vencimiento.
              </p>
              {/* Filtros combinables: salón + tipo + sub-filtro + búsqueda */}
              {egresosProximos.length > 0 && (
                <BarraFiltrosEgresos
                  egresos={egresosProximos}
                  filtro={filtroPagar}
                  catalogoServicios={catalogoServiciosActivos}
                  onChange={(f) => {
                    setFiltroPagar(f)
                    setFilasPagar(LIMITE_FILAS)
                  }}
                />
              )}
              {egresosProximos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No hay pagos a proveedores pendientes.
                </p>
              ) : egresosProximosFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No hay pagos pendientes que coincidan con el filtro.
                </p>
              ) : salonFiltro === "todos" ? (
                <div>
                  {gruposPagar.map((g) => (
                    <CarpetaSalon
                      key={g.salon}
                      nombre={g.salon === "General" ? "General" : salonLabel(g.salon)}
                      color={g.salon === "General" ? SALON_COLOR_GENERAL : salonColor(g.salon, configuracionCajas)}
                      cantidad={g.items.length}
                      total={g.total}
                      totalColor="text-red-600"
                      abierta={!!carpetasPagar[g.salon]}
                      onToggle={() => setCarpetasPagar((prev) => ({ ...prev, [g.salon]: !prev[g.salon] }))}
                    >
                      {agruparEgresosPorAñoMes(g.items).map((año) => {
                        const claveAño = `${g.salon}::${año.año}`
                        return (
                          <CarpetaTiempo
                            key={claveAño}
                            nombre={año.año === 0 ? "Sin fecha" : String(año.año)}
                            nivel={1}
                            cantidad={año.items.length}
                            total={año.total}
                            abierta={!!carpetasPagar[claveAño]}
                            onToggle={() => setCarpetasPagar((prev) => ({ ...prev, [claveAño]: !prev[claveAño] }))}
                          >
                            {año.meses.map((mes) => {
                              const claveMes = `${claveAño}::${mes.mes}`
                              return (
                                <CarpetaTiempo
                                  key={claveMes}
                                  nombre={mes.nombre}
                                  nivel={2}
                                  cantidad={mes.items.length}
                                  total={mes.total}
                                  abierta={!!carpetasPagar[claveMes]}
                                  onToggle={() =>
                                    setCarpetasPagar((prev) => ({ ...prev, [claveMes]: !prev[claveMes] }))
                                  }
                                >
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="pl-6">Tipo de servicio</TableHead>
                                        <TableHead>Fecha de carga</TableHead>
                                        <TableHead>Fecha del evento</TableHead>
                                        <TableHead>Nombre del evento</TableHead>
                                        <TableHead className="text-right">Seña</TableHead>
                                        <TableHead className="text-right pr-6">Saldo restante</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>{renderFilasPagar(mes.items)}</TableBody>
                                  </Table>
                                </CarpetaTiempo>
                              )
                            })}
                          </CarpetaTiempo>
                        )
                      })}
                    </CarpetaSalon>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Tipo de servicio</TableHead>
                      <TableHead>Fecha de carga</TableHead>
                      <TableHead>Fecha del evento</TableHead>
                      <TableHead>Nombre del evento</TableHead>
                      <TableHead className="text-right">Seña</TableHead>
                      <TableHead className="text-right pr-6">Saldo restante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{renderFilasPagar(egresosProximosFiltrados.slice(0, filasPagar))}</TableBody>
                </Table>
              )}
              {salonFiltro !== "todos" && egresosProximosFiltrados.length > LIMITE_FILAS && (
                <div className="px-6 pt-2">
                  {filasPagar < egresosProximosFiltrados.length ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilasPagar(siguientePasoPagar(egresosProximosFiltrados.length))}
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className="h-3.5 w-3.5 mr-1" />
                      {etiquetaVerMas(filasPagar, egresosProximosFiltrados.length)}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilasPagar(LIMITE_FILAS)}
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ChevronUp className="h-3.5 w-3.5 mr-1" /> Ver menos
                    </Button>
                  )}
                </div>
              )}
              {egresosProximosFiltrados.length > 0 && (
                <div className="flex items-center justify-between px-6 pt-3 mt-1 border-t border-border">
                  <span className="text-sm font-medium text-muted-foreground">
                    {!filtroPagarActivo ? `Total por pagar (${DIAS_TOTAL_PAGO} días)` : "Total del filtro"}
                  </span>
                  <span className="text-base font-bold text-red-600">
                    −{formatCurrency(!filtroPagarActivo ? totalPorPagar60 : totalPorPagarFiltrado)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORIAL DE PAGOS REALIZADOS */}
        <TabsContent value="historial" className="mt-4">
          <Card>
            <CardContent className="px-0 py-2">
              {pagosRealizados.filter((p) => !pagosArchivadosIds.has(p.id)).length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No hay pagos en el historial activo. Los pagos archivados se ven en el Archivo.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Concepto</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Fecha de pago</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right pr-6">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const activos = pagosRealizados.filter((p) => !pagosArchivadosIds.has(p.id))
                      return expandido.historial ? activos : activos.slice(0, LIMITE_FILAS)
                    })().map((pago) => (
                      <TableRow key={pago.id}>
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="font-medium text-sm">{pago.concepto}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {pago.eventoNombre || "—"}
                          {pago.salon ? ` · ${pago.salon}` : ""}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(pago.fecha).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          −{formatCurrency(pago.monto)}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs bg-transparent"
                              onClick={() => archivarPagoEvento(pago)}
                            >
                              <Archive className="h-3.5 w-3.5" />
                              Archivar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs bg-transparent"
                              onClick={() => handleRevertirPago(pago)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Revertir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {pagosRealizados.filter((p) => !pagosArchivadosIds.has(p.id)).length > LIMITE_FILAS && (
                <div className="px-6 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpandido("historial")}
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                  >
                    {expandido.historial ? (
                      <><ChevronUp className="h-3.5 w-3.5 mr-1" /> Ver menos</>
                    ) : (
                      <><ChevronDown className="h-3.5 w-3.5 mr-1" /> Ver más ({pagosRealizados.filter((p) => !pagosArchivadosIds.has(p.id)).length - LIMITE_FILAS} más)</>
                    )}
                  </Button>
                </div>
              )}
              {pagosRealizados.filter((p) => !pagosArchivadosIds.has(p.id)).length > 0 && (
                <div className="flex items-center justify-between px-6 pt-3 mt-1 border-t border-border">
                  <span className="text-sm font-medium text-muted-foreground">Total pagado</span>
                  <span className="text-base font-bold text-red-600">
                    −
                    {formatCurrency(
                      pagosRealizados
                        .filter((p) => !pagosArchivadosIds.has(p.id))
                        .reduce((s, p) => s + p.monto, 0),
                    )}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PROYECCIÓN MENSUAL — tabla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-600" />
            Proyección en 12 meses:
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1 text-pretty">
            A cobrar: solo la parte de cada cuota destinada a cubrir el costo del evento + 5% (insumos, servicios y
            personal). A pagar: los pagos a proveedores y personal de cada evento. El saldo parte del saldo actual de
            la caja, por lo que cualquier extracción o ingreso de hoy actualiza toda la proyección.
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
              {proyeccionMensual.map((m) => (
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
                    {formatCurrency(m.saldoProyectado)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DIALOG: datos de contacto del cliente */}
      <Dialog
        open={!!clienteSel}
        onOpenChange={(open) => {
          if (!open) setClienteSel(null)
          setMarcarCobrada(false)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-4 w-4 text-teal-600" />
              {clienteSel?.contacto.nombre}
            </DialogTitle>
            <DialogDescription>
              {clienteSel?.eventoNombre} · Cuota {clienteSel?.numeroCuota}/{clienteSel?.totalCuotas}
            </DialogDescription>
          </DialogHeader>
          {clienteSel && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center justify-between">
                <span className="text-sm text-emerald-700">A cobrar (vence {formatFecha(clienteSel.fechaVencimiento)})</span>
                <span className="text-lg font-bold text-emerald-800">+{formatCurrency(clienteSel.monto)}</span>
              </div>
              <div className="space-y-2.5 text-sm">
                {clienteSel.contacto.telefono ? (
                  <a
                    href={`tel:${clienteSel.contacto.telefono}`}
                    className="flex items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/50"
                  >
                    <Phone className="h-4 w-4 text-teal-600 shrink-0" />
                    <span className="font-medium">{clienteSel.contacto.telefono}</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" /> Sin teléfono cargado
                  </div>
                )}
                {clienteSel.contacto.email && (
                  <a
                    href={`mailto:${clienteSel.contacto.email}`}
                    className="flex items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/50"
                  >
                    <Mail className="h-4 w-4 text-teal-600 shrink-0" />
                    <span className="truncate">{clienteSel.contacto.email}</span>
                  </a>
                )}
                {clienteSel.contacto.direccion && (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                    <MapPin className="h-4 w-4 text-teal-600 shrink-0" />
                    <span>{clienteSel.contacto.direccion}</span>
                  </div>
                )}
                {clienteSel.contacto.dni && (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                    <CreditCard className="h-4 w-4 text-teal-600 shrink-0" />
                    <span>DNI {clienteSel.contacto.dni}</span>
                  </div>
                )}
              </div>

              {/* Marcar como ya cobrada (para eventos viejos) */}
              <div className="border-t border-border pt-3 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={marcarCobrada}
                    onCheckedChange={(v) => setMarcarCobrada(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-snug">
                    Marcar esta cuota como <span className="font-medium">ya cobrada</span>
                    <span className="block text-xs text-muted-foreground">
                      Registra el ingreso con fecha {formatFecha(clienteSel.fechaVencimiento)}.
                    </span>
                  </span>
                </label>
                <Button
                  className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!marcarCobrada}
                  onClick={() => confirmarCobroCuota(clienteSel)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar cobro
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG: desglose "Tengo ahora" */}
      <Dialog open={desgloseOpen} onOpenChange={setDesgloseOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-teal-600" />
              Desglose — Tengo ahora
            </DialogTitle>
            <DialogDescription>
              Composición del patrimonio actual del negocio.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-1 space-y-1">
            <div className="flex items-center justify-between py-2.5 border-b border-border">
              <span className="text-sm text-muted-foreground">Efectivo en caja</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(saldoActual)}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-border">
              <span className="text-sm text-muted-foreground">Valor stock cocina</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(valorStockCocina)}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-border">
              <span className="text-sm text-muted-foreground">Valor stock barra</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(valorStockBarra)}</span>
            </div>
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-base font-bold text-teal-700 tabular-nums">{formatCurrency(totalPatrimonio)}</span>
            </div>
          </div>
          <Button
            variant="outline"
            className="mt-2 w-full gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            onClick={() => {
              setExtraerMonto(0)
              setExtraerConcepto("")
              setExtraerModo("extraer")
              setExtraerOpen(true)
            }}
          >
            <ArrowUpFromLine className="h-4 w-4" />
            Extraer / ajustar dinero
          </Button>
        </DialogContent>
      </Dialog>

      {/* DIALOG: extracción / ajuste de saldo de Caja Eventos */}
      <Dialog open={extraerOpen} onOpenChange={setExtraerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpFromLine className="h-4 w-4 text-red-600" />
              {extraerModo === "extraer" ? "Extraer dinero — Caja Eventos" : "Colocar monto actual — Caja Eventos"}
            </DialogTitle>
            <DialogDescription>
              {extraerModo === "extraer"
                ? "Registra un retiro de efectivo. Queda en el Archivo Histórico y en Configuraci��n → Actividad."
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
              <span className="text-xs text-muted-foreground">Efectivo en caja (sistema)</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(saldoActual)}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extraer-monto">
                {extraerModo === "extraer" ? "Monto a extraer" : "¿Cuánto dinero hay realmente?"}
              </Label>
              <MoneyInput
                id="extraer-monto"
                value={extraerMonto}
                onValueChange={setExtraerMonto}
                placeholder="0"
              />
              {extraerModo === "extraer" && extraerMonto > saldoActual && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> El monto supera el efectivo disponible. La caja quedará en negativo.
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
              <Label htmlFor="extraer-concepto">Nota / justificación</Label>
              <Textarea
                id="extraer-concepto"
                value={extraerConcepto}
                onChange={(e) => setExtraerConcepto(e.target.value)}
                placeholder={
                  extraerModo === "extraer"
                    ? "Ej: Retiro para pago de proveedor en efectivo"
                    : "Ej: Conteo de caja del cierre del día"
                }
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmación de pago */}
      <Dialog open={!!pagoConfirmar} onOpenChange={(open) => !open && setPagoConfirmar(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar pago
            </DialogTitle>
            <DialogDescription>
              {pagoConfirmar
                ? `¿Estás seguro que querés marcar como pagado "${pagoConfirmar.servicioNombre}" por ${formatCurrency(pagoConfirmar.monto)}? Esta acción registra el egreso en Caja Eventos.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPagoConfirmar(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={confirmarMarcarPagado}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Sí, marcar pagado
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detalle del día del calendario: qué se cobra y qué se paga */}
      <Dialog open={!!diaDetalle} onOpenChange={(open) => !open && setDiaDetalle(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 capitalize">
              <CalendarDays className="h-4 w-4 text-teal-600" />
              {diaDetalle ? formatFecha(diaDetalle) : ""}
            </DialogTitle>
            <DialogDescription>Movimientos pendientes de este día.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {detalleDia && detalleDia.cobros.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                  <ArrowDownToLine className="h-3.5 w-3.5" /> A cobrar
                </p>
                {detalleDia.cobros.map((ing) => (
                  <div
                    key={ing.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ing.eventoNombre}</p>
                      <p className="text-xs text-muted-foreground">
                        Cuota {ing.numeroCuota}/{ing.totalCuotas} ·{" "}
                        <span className="font-bold text-emerald-700">+{formatCurrency(ing.monto)}</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                      onClick={() => {
                        confirmarCobroCuota(ing)
                        setDiaDetalle(null)
                      }}
                    >
                      Marcar cobrada
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {detalleDia && detalleDia.pagos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
                  <ArrowUpFromLine className="h-3.5 w-3.5" /> A pagar
                </p>
                {detalleDia.pagos.map((eg) => (
                  <div
                    key={eg.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{eg.servicioNombre}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {eg.eventoNombre} ·{" "}
                        <span className="font-bold text-red-600">−{formatCurrency(eg.monto)}</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 shrink-0 bg-transparent"
                      onClick={() => {
                        setDiaDetalle(null)
                        setPagoConfirmar(eg)
                      }}
                    >
                      Marcar pagado
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {detalleDia && detalleDia.cobros.length === 0 && detalleDia.pagos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No quedan movimientos pendientes para este día.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Editar fecha de vencimiento (cuotas por cobrar y gastos por pagar) */}
      <Dialog open={!!editVenc} onOpenChange={(open) => !open && setEditVenc(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-muted-foreground" />
              Cambiar fecha de vencimiento
            </DialogTitle>
            <DialogDescription>
              {editVenc?.kind === "cuota"
                ? `Cuota ${editVenc.ingreso.numeroCuota}/${editVenc.ingreso.totalCuotas} · ${editVenc.ingreso.eventoNombre} · ${formatCurrency(editVenc.ingreso.monto)}`
                : editVenc
                  ? `${editVenc.egreso.servicioNombre} · ${editVenc.egreso.eventoNombre} · ${formatCurrency(editVenc.egreso.monto)}`
                  : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="venc-fecha">Nueva fecha de vencimiento</Label>
              <Input
                id="venc-fecha"
                type="date"
                value={nuevaFechaVenc}
                onChange={(e) => setNuevaFechaVenc(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Impacta en alertas, calendario y balances generales.
              </p>
            </div>
            {editVenc?.kind === "cuota" && (
              <div className="space-y-1.5">
                <Label htmlFor="venc-justif">Justificación del cambio (opcional)</Label>
                <Textarea
                  id="venc-justif"
                  placeholder="Ej: el cliente pidió postergar el pago..."
                  value={justificacionVenc}
                  onChange={(e) => setJustificacionVenc(e.target.value)}
                  rows={3}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              El cambio queda registrado en Configuración &gt; Registro de actividad.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setEditVenc(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarNuevaFechaVenc} disabled={!nuevaFechaVenc}>
              Guardar fecha
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Animación de check verde al confirmar */}
      {pagoExito && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 pointer-events-none">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-background px-10 py-8 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 animate-in zoom-in-50 duration-300">
              <CheckCircle2
                className="h-14 w-14 text-emerald-600 animate-in zoom-in-75 duration-500"
                strokeWidth={2.5}
              />
            </span>
            <p className="text-sm font-semibold text-emerald-700">¡Pago registrado!</p>
          </div>
        </div>
      )}
    </div>
  )
}

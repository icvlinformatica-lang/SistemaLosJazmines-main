"use client"

import { useState, useMemo, useEffect, useRef, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useStore } from "@/lib/store-context"
import {
  formatCurrency,
  calcularTotalesPaquete,
  SALONES,
  type EventoGuardado,
  type Receta,
  type Servicio,
  type VersionContrato,
  type ImpactoContrato,
  type BarraTemplate,
  type Coctel,
} from "@/lib/store"
import { generateContractHTML } from "@/lib/contract-html"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


import {
  ArrowLeft,
  FileText,
  Printer,
  Calendar as CalendarIcon,
  Users,
  Eye,
  X,
  User,
  ChevronLeft,
  ChevronRight,
  Pencil,
  DollarSign,
  Clock,
  MapPin,
  ListChecks,
  Phone,
  Mail,
  History,
  Save,
  Check,
  ChevronDown,
  Utensils,
  Wine,
} from "lucide-react"

// =====================================================================
// SALON ADDRESS MAP
// =====================================================================
const SALON_DIRECCIONES: Record<string, string> = {
  Casona: "Casona Florida 6040 - Del Viso - Bs. As.",
  Quinta: "Quinta Los Jazmines - Del Viso - Bs. As.",
  Salon: "Salon Los Jazmines - Del Viso - Bs. As.",
}

// =====================================================================
// SALON COLOR MAP (one distinct color per salon)
// =====================================================================
type SalonColor = { dot: string; chip: string; chipActive: string; pill: string }
const SALON_COLORES: Record<string, SalonColor> = {
  Quinta: {
    dot: "bg-emerald-500",
    chip: "border-emerald-200 text-emerald-700",
    chipActive: "border-emerald-400 bg-emerald-50 text-emerald-800",
    pill: "border-l-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
  },
  Casona: {
    dot: "bg-rose-500",
    chip: "border-rose-200 text-rose-700",
    chipActive: "border-rose-400 bg-rose-50 text-rose-800",
    pill: "border-l-rose-500 bg-rose-50 text-rose-900 hover:bg-rose-100",
  },
  Salon: {
    dot: "bg-sky-500",
    chip: "border-sky-200 text-sky-700",
    chipActive: "border-sky-400 bg-sky-50 text-sky-800",
    pill: "border-l-sky-500 bg-sky-50 text-sky-900 hover:bg-sky-100",
  },
  "Salon 4": {
    dot: "bg-amber-500",
    chip: "border-amber-200 text-amber-700",
    chipActive: "border-amber-400 bg-amber-50 text-amber-800",
    pill: "border-l-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100",
  },
  "Salon 5": {
    dot: "bg-teal-500",
    chip: "border-teal-200 text-teal-700",
    chipActive: "border-teal-400 bg-teal-50 text-teal-800",
    pill: "border-l-teal-500 bg-teal-50 text-teal-900 hover:bg-teal-100",
  },
}
const FALLBACK_COLOR: SalonColor = {
  dot: "bg-muted-foreground",
  chip: "border-border text-muted-foreground",
  chipActive: "border-border bg-muted text-foreground",
  pill: "border-l-muted-foreground bg-muted text-foreground hover:bg-muted/70",
}
const getSalonColor = (salon?: string): SalonColor =>
  (salon && SALON_COLORES[salon]) || FALLBACK_COLOR

// =====================================================================
// CONTRACT PREVIEW MODAL
// =====================================================================
function ContractPreview({
  open, evento, recetas, serviciosIncluidos, paquetePrecio, personalAsignado, barrasTemplates, cocteles, onClose,
}: {
  open: boolean; evento: EventoGuardado; recetas: Receta[]; serviciosIncluidos: string[]; paquetePrecio: number; personalAsignado: { nombre: string; funcion: string }[]; barrasTemplates?: BarraTemplate[]; cocteles?: Coctel[]; onClose: () => void
}) {
  const html = generateContractHTML(evento, recetas, serviciosIncluidos, paquetePrecio, personalAsignado, barrasTemplates || [], cocteles || [])
  if (!open) return null
  return (
    // Este div vive DENTRO del SheetContent en el JSX, por lo que Radix
    // no lo detecta como "fuera" del Sheet al medir foco/pointer.
    // El position:fixed cubre toda la pantalla visualmente.
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      // Evitar que clicks en el backdrop cierren el Sheet
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-background shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <span className="font-semibold">Vista Previa del Contrato</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onClose() }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <iframe
          srcDoc={html}
          className="flex-1 w-full"
          title="Vista previa del contrato"
        />
      </div>
    </div>
  )
}

// =====================================================================
// HELPERS: contract services + package price for an event
// =====================================================================
function getServiciosIncluidos(
  evento: EventoGuardado,
  catalogoServicios: { id: string; nombre: string; activo?: boolean }[]
): string[] {
  const savedIds = evento.serviciosContrato
  const savedLibres = evento.serviciosLibresContrato || []
  const ids = savedIds && savedIds.length > 0
    ? savedIds
    : (evento.servicios || []).map((se) => se.servicioId).filter((id): id is string => Boolean(id))
  const fromCatalog = catalogoServicios
    .filter((s) => ids.includes(s.id) && s.activo !== false)
    .map((s) => s.nombre)
  return [...fromCatalog, ...savedLibres]
}

// =====================================================================
// CALENDAR HELPERS
// =====================================================================
const DIAS_SEMANA = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
const getFirstDayOfMonth = (year: number, month: number) => {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday = 0
}
const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
const parseEventDate = (fecha: string): Date => {
  const [y, m, d] = fecha.split("-").map(Number)
  return new Date(y, m - 1, d)
}

// =====================================================================
// DETAIL ROW
// =====================================================================
function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground break-words">{value || "—"}</p>
      </div>
    </div>
  )
}

// =====================================================================
// HISTORIAL DE MODIFICACIONES (TIMELINE)
// =====================================================================
const IMPACTO_META: Record<ImpactoContrato, { label: string; className: string }> = {
  financiero: { label: "Pago / Cuotas", className: "border-amber-300 bg-amber-100 text-amber-800" },
  servicios: { label: "Servicios", className: "border-blue-300 bg-blue-100 text-blue-800" },
  datos_cliente: { label: "Datos cliente", className: "border-slate-300 bg-slate-100 text-slate-700" },
  menu: { label: "Menú", className: "border-emerald-300 bg-emerald-100 text-emerald-800" },
  barra: { label: "Barra", className: "border-rose-300 bg-rose-100 text-rose-800" },
  invitados: { label: "Invitados", className: "border-cyan-300 bg-cyan-100 text-cyan-800" },
  sin_cambios: { label: "Versión inicial", className: "border-border bg-muted text-muted-foreground" },
}

function HistorialContratoTimeline({
  versiones,
  recetas,
  catalogoServicios,
}: {
  versiones: VersionContrato[]
  recetas: Receta[]
  catalogoServicios: Servicio[]
}) {
  const [expandidas, setExpandidas] = useState<Set<number>>(() => new Set())

  const ordenadas = useMemo(
    () => [...versiones].sort((a, b) => b.version - a.version),
    [versiones],
  )

  if (ordenadas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin modificaciones registradas todavía.</p>
  }

  const nombreReceta = (id: string) => recetas.find((r) => r.id === id)?.nombre || id
  const nombreServicio = (id: string) => catalogoServicios.find((s) => s.id === id)?.nombre || id

  const toggle = (v: number) =>
    setExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })

  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  return (
    <ol className="relative space-y-4 pl-6">
      {/* línea vertical del timeline */}
      <span className="absolute left-2 top-1 bottom-1 w-px bg-border" aria-hidden="true" />
      {ordenadas.map((v) => {
        const abierta = expandidas.has(v.version)
        const menu = v.snapshotMenu
        const totalRecetas =
          (menu?.recetasAdultos?.length || 0) +
          (menu?.recetasAdolescentes?.length || 0) +
          (menu?.recetasNinos?.length || 0) +
          (menu?.recetasDietasEspeciales?.length || 0)
        const cocteles = (v.snapshotBarras || []).flatMap((b) => b.coctelesIncluidos || [])
        const plan = v.snapshotPlanCuotas
        return (
          <li key={v.version} className="relative">
            {/* marcador */}
            <span className="absolute -left-[18px] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" aria-hidden="true" />
            <div className="rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => toggle(v.version)}
                className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
                aria-expanded={abierta}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Versión {v.version}</span>
                    <span className="text-xs text-muted-foreground">{fmtFecha(v.fechaGuardado)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {v.impactos.map((imp) => (
                      <span
                        key={imp}
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${IMPACTO_META[imp].className}`}
                      >
                        {IMPACTO_META[imp].label}
                      </span>
                    ))}
                  </div>
                  {v.motivo && <p className="text-xs text-muted-foreground break-words">{v.motivo}</p>}
                </div>
                <ChevronDown
                  className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierta ? "rotate-180" : ""}`}
                />
              </button>

              {abierta && (
                <div className="space-y-3 border-t border-border px-3 py-3 text-xs">
                  {/* Invitados */}
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Invitados</p>
                      {v.snapshotInvitados ? (
                        <p className="text-muted-foreground">
                          {v.snapshotInvitados.adultos} adultos, {v.snapshotInvitados.adolescentes} adol.,{" "}
                          {v.snapshotInvitados.ninos} niños
                          {v.snapshotInvitados.dietasEspeciales > 0
                            ? `, ${v.snapshotInvitados.dietasEspeciales} dietas esp.`
                            : ""}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>

                  {/* Menú */}
                  <div className="flex items-start gap-2">
                    <Utensils className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">Menú ({totalRecetas} platos)</p>
                      {menu ? (
                        <p className="text-muted-foreground break-words">
                          {[
                            ...(menu.recetasAdultos || []),
                            ...(menu.recetasAdolescentes || []),
                            ...(menu.recetasNinos || []),
                            ...(menu.recetasDietasEspeciales || []),
                          ]
                            .map(nombreReceta)
                            .join(", ") || "Sin platos cargados"}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>

                  {/* Barra */}
                  <div className="flex items-start gap-2">
                    <Wine className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">
                        Barra ({(v.snapshotBarras || []).length} barra{(v.snapshotBarras || []).length === 1 ? "" : "s"})
                      </p>
                      <p className="text-muted-foreground">
                        {cocteles.length > 0 ? `${cocteles.length} cócteles incluidos` : "Sin barra contratada"}
                      </p>
                    </div>
                  </div>

                  {/* Servicios */}
                  <div className="flex items-start gap-2">
                    <ListChecks className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        Servicios ({v.snapshotServicios.length + (v.snapshotServiciosLibres?.length || 0)})
                      </p>
                      <p className="text-muted-foreground break-words">
                        {[...v.snapshotServicios.map(nombreServicio), ...(v.snapshotServiciosLibres || [])].join(", ") ||
                          "Sin servicios"}
                      </p>
                    </div>
                  </div>

                  {/* Financiación */}
                  <div className="flex items-start gap-2">
                    <DollarSign className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Modalidad de pago</p>
                      {plan && plan.montoTotal > 0 ? (
                        <p className="text-muted-foreground">
                          Total {formatCurrency(plan.montoTotal)}
                          {plan.montoSena && plan.montoSena > 0 ? ` · Seña ${formatCurrency(plan.montoSena)}` : ""}
                          {plan.numeroCuotas ? ` · ${plan.numeroCuotas} cuotas` : ""}
                          {plan.ajustaPorIPC === false ? " · fijas" : " · ajustables IPC"}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// =====================================================================
// MAIN PAGE
// =====================================================================
function ContratosPageContent() {
  const searchParams = useSearchParams()
  const { state, updateEvento } = useStore()
  const { eventos, paquetesSalones, recetas } = state
  const catalogoServicios = state.servicios || []

  const today = new Date()
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [salonesActivos, setSalonesActivos] = useState<string[]>([...SALONES])
  const [selectedEventoId, setSelectedEventoId] = useState<string>("")
  // panelOpen controla la visibilidad del Sheet de forma independiente
  // de selectedEventoId, para que el Sheet no se cierre cuando Radix
  // detecta "focus outside" al abrir la vista previa
  const [panelOpen, setPanelOpen] = useState(false)
  const showPreviewRef = useRef(false)
  const [showPreview, setShowPreview] = useState(false)
  // Wrapper que mantiene el ref sincronizado en el mismo tick del render,
  // sin depender del useEffect (que llega un tick tarde para los handlers de Radix)
  const setShowPreviewSync = (v: boolean) => {
    showPreviewRef.current = v
    setShowPreview(v)
  }
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    nombreCompleto: "",
    dni: "",
    telefono: "",
    direccion: "",
    email: "",
    condicionIVA: "Consumidor Final",
  })

  // Valid events (exclude cancelled + require name & date)
  const eventosValidos = useMemo(
    () => (eventos || []).filter((e) => e.estado !== "cancelado" && (e.nombre || e.nombrePareja) && e.fecha),
    [eventos]
  )

  // Auto-select event when coming back from planificador (?eventoId=X)
  useEffect(() => {
    const eventoId = searchParams?.get("eventoId")
    if (eventoId) {
      setSelectedEventoId(eventoId)
      setPanelOpen(true)
      const ev = eventosValidos.find((e) => e.id === eventoId)
      if (ev?.fecha) {
        const d = parseEventDate(ev.fecha)
        setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1))
      }
    }
  }, [searchParams, eventosValidos])

  const countsPorSalon = useMemo(() => {
    const map: Record<string, number> = {}
    for (const salon of SALONES) map[salon] = 0
    for (const ev of eventosValidos) {
      if (ev.salon && map[ev.salon] !== undefined) map[ev.salon] += 1
    }
    return map
  }, [eventosValidos])

  const selectedEvento = useMemo(
    () => eventosValidos.find((e) => e.id === selectedEventoId) || null,
    [eventosValidos, selectedEventoId]
  )

  // When switching events, exit edit mode and reload the form with fresh data
  useEffect(() => {
    setIsEditing(false)
    if (selectedEvento) {
      const c = selectedEvento.contrato || {}
      setEditForm({
        nombreCompleto: c.nombreCompleto || "",
        dni: c.dni || "",
        telefono: c.telefono || "",
        direccion: c.direccion || "",
        email: c.email || "",
        condicionIVA: selectedEvento.condicionIVA || "Consumidor Final",
      })
    }
  }, [selectedEvento])

  const serviciosIncluidos = useMemo(
    () => (selectedEvento ? getServiciosIncluidos(selectedEvento, catalogoServicios) : []),
    [selectedEvento, catalogoServicios]
  )

  const paquetePrecio = useMemo(() => {
    if (!selectedEvento) return 0
    return (selectedEvento.paquetesSeleccionados || []).reduce((total, pid) => {
      const paq = (paquetesSalones || []).find((p) => p.id === pid)
      if (!paq) return total
      return total + calcularTotalesPaquete(paq, catalogoServicios || []).precioOficial
    }, 0)
  }, [selectedEvento, paquetesSalones, catalogoServicios])

  // Personal asignado al evento: combina el personal del generador de contrato
  // (personalEvento) con los compromisos asignados despues desde Finanzas → Personal
  const personalAsignado = useMemo(() => {
    if (!selectedEvento) return []
    const resultado: { nombre: string; funcion: string }[] = []
    const vistos = new Set<string>()
    for (const pe of selectedEvento.personalEvento || []) {
      const clave = pe.personalId || pe.nombre.toLowerCase()
      if (vistos.has(clave)) continue
      vistos.add(clave)
      resultado.push({ nombre: pe.nombre, funcion: pe.funcion })
    }
    for (const pp of state.pagosPersonal || []) {
      if (pp.eventoId !== selectedEvento.id) continue
      const clave = pp.personalId || pp.nombrePersonal.toLowerCase()
      if (vistos.has(clave) || vistos.has(pp.nombrePersonal.toLowerCase())) continue
      vistos.add(clave)
      resultado.push({ nombre: pp.nombrePersonal, funcion: pp.servicioNombre })
    }
    return resultado
  }, [selectedEvento, state.pagosPersonal])

  const toggleSalon = (salon: string) =>
    setSalonesActivos((prev) => (prev.includes(salon) ? prev.filter((s) => s !== salon) : [...prev, salon]))

  const eventsForDate = (date: Date) =>
    eventosValidos.filter(
      (e) => salonesActivos.includes(e.salon || "") && isSameDay(parseEventDate(e.fecha), date)
    )

  const navigateMonth = (dir: number) =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1))
  const goToToday = () => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))

  const handlePrint = () => {
    if (!selectedEvento) return
    const html = generateContractHTML(selectedEvento, recetas, serviciosIncluidos, paquetePrecio, personalAsignado, state.barrasTemplates || [], state.cocteles || [])
    const printWindow = window.open("", "_blank", "width=900,height=700")
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 300)

    // Registrar la generacion en el historial del contrato
    const versionActual = selectedEvento.versionesContrato?.length
      ? Math.max(...selectedEvento.versionesContrato.map((v) => v.version))
      : undefined
    const nuevaGeneracion = {
      id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fecha: new Date().toISOString(),
      origen: "contratos" as const,
      version: versionActual,
      cantidadPersonal: personalAsignado.length,
      cantidadServicios: serviciosIncluidos.length,
      montoTotal: selectedEvento.planDeCuotas?.montoTotal || undefined,
    }
    updateEvento(selectedEvento.id, {
      generacionesContrato: [...(selectedEvento.generacionesContrato || []), nuevaGeneracion],
      fechaImpresion: new Date().toISOString(),
    })
  }

  const handleSaveEdit = async () => {
    if (!selectedEvento) return
    setSaving(true)
    try {
      await updateEvento(selectedEvento.id, {
        contrato: {
          ...(selectedEvento.contrato || {}),
          nombreCompleto: editForm.nombreCompleto.trim(),
          dni: editForm.dni.trim(),
          telefono: editForm.telefono.trim(),
          direccion: editForm.direccion.trim(),
          email: editForm.email.trim(),
        },
        condicionIVA: editForm.condicionIVA as EventoGuardado["condicionIVA"],
      })
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    if (selectedEvento) {
      const c = selectedEvento.contrato || {}
      setEditForm({
        nombreCompleto: c.nombreCompleto || "",
        dni: c.dni || "",
        telefono: c.telefono || "",
        direccion: c.direccion || "",
        email: c.email || "",
        condicionIVA: selectedEvento.condicionIVA || "Consumidor Final",
      })
    }
    setIsEditing(false)
  }

  // --- Month grid ---
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const cells: React.ReactNode[] = []
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="min-h-24 rounded-sm border border-border/50 bg-muted/20" />)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dayEvents = eventsForDate(date)
    const isToday = isSameDay(date, today)
    cells.push(
      <div
        key={day}
        className={`min-h-24 rounded-sm border border-border/50 p-1 ${isToday ? "border-primary/30 bg-primary/5" : "bg-card"}`}
      >
        <div className="mb-0.5 flex items-center justify-between">
          <span
            className={`text-xs font-medium leading-none ${
              isToday
                ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                : "text-foreground"
            }`}
          >
            {day}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          {dayEvents.slice(0, 3).map((ev) => {
            const color = getSalonColor(ev.salon)
            return (
              <button
                key={ev.id}
                onClick={() => { setSelectedEventoId(ev.id); setPanelOpen(true) }}
                className={`w-full truncate rounded-sm border-l-4 px-1.5 py-0.5 text-left text-xs transition-colors ${color.pill}`}
                title={`${ev.nombrePareja || ev.nombre || "Evento"} · ${ev.salon || "Sin salon"}`}
              >
                <span className="block truncate font-medium">
                  {ev.horario && <span className="opacity-70">{ev.horario} </span>}
                  {ev.nombrePareja || ev.nombre || "Evento"}
                </span>
              </button>
            )
          })}
          {dayEvents.length > 3 && (
            <span className="text-center text-[10px] text-muted-foreground">+{dayEvents.length - 3} mas</span>
          )}
        </div>
      </div>
    )
  }

  const contrato = selectedEvento?.contrato || {}
  const totalInvitados = selectedEvento
    ? selectedEvento.adultos + selectedEvento.adolescentes + selectedEvento.ninos + (selectedEvento.personasDietasEspeciales || 0)
    : 0
  const ultimaVersion = selectedEvento?.versionesContrato?.length
    ? Math.max(...selectedEvento.versionesContrato.map((v) => v.version))
    : 0

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/eventos/lista" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Contratos de Eventos</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-6 py-6">
        {/* Salon filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-medium text-muted-foreground">Salones:</span>
          {SALONES.map((salon) => {
            const active = salonesActivos.includes(salon)
            const color = getSalonColor(salon)
            return (
              <button
                key={salon}
                onClick={() => toggleSalon(salon)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? color.chipActive : `bg-background ${color.chip} opacity-60 hover:opacity-100`
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />
                {salon}
                <span className="tabular-nums opacity-70">{countsPorSalon[salon] ?? 0}</span>
              </button>
            )
          })}
        </div>

        {/* Calendar */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold capitalize">
                  {MESES[month]} {year}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={goToToday} className="mr-1 h-8 bg-transparent">
                  Hoy
                </Button>
                <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)} className="h-8 w-8 bg-transparent">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => navigateMonth(1)} className="h-8 w-8 bg-transparent">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mb-px grid grid-cols-7 gap-px">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="py-1.5 text-center text-xs font-semibold text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">{cells}</div>

            {eventosValidos.length === 0 && (
              <div className="mt-6 rounded-xl border border-dashed border-border px-5 py-10 text-center">
                <CalendarIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No hay eventos guardados todavia.</p>
                <Link href="/evento">
                  <Button className="mt-4">Crear Evento</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* SIDE PANEL — panel custom sin Radix para evitar cierre involuntario */}
      {panelOpen && (
        <>
          {/* backdrop — solo cierra si no hay preview activa */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => {
              if (showPreviewRef.current) return
              setPanelOpen(false)
              setSelectedEventoId("")
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col gap-0 border-l border-border bg-background shadow-xl overflow-hidden"
          >
          {selectedEvento && (
            <>
              <div className="border-b border-border px-6 py-4 text-left shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${getSalonColor(selectedEvento.salon).dot}`} />
                    <h2 className="text-base font-semibold">
                      {selectedEvento.nombrePareja || selectedEvento.nombre || "Evento"}
                    </h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => { setPanelOpen(false); setSelectedEventoId("") }}
                    aria-label="Cerrar panel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">{selectedEvento.salon || "Sin salon"}</Badge>
                  {ultimaVersion > 0 ? (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <History className="h-3 w-3" />
                      Contrato v{ultimaVersion}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Sin modificaciones</Badge>
                  )}
                  {(selectedEvento.generacionesContrato?.length || 0) > 0 ? (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Printer className="h-3 w-3" />
                      Generado {selectedEvento.generacionesContrato!.length}{selectedEvento.generacionesContrato!.length === 1 ? " vez" : " veces"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Sin generar</Badge>
                  )}
                </div>

                {/* Toolbar: vista previa + imprimir + editar en el planificador */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onPointerDown={(e) => {
                      // Actualizar ref síncronamente y parar la propagación
                      // para que el listener de Radix en el documento no
                      // interprete este pointer-down como "fuera del Sheet"
                      showPreviewRef.current = true
                      e.stopPropagation()
                    }}
                    onClick={() => setShowPreviewSync(true)}
                    className="gap-2 bg-transparent"
                  >
                    <Eye className="h-4 w-4" />
                    Vista Previa
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                    className="gap-2 bg-transparent"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </Button>
                  <Link href={`/evento?id=${selectedEvento.id}&from=contratos`}>
                    <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                      <Pencil className="h-4 w-4" />
                      Editar en el planificador
                    </Button>
                  </Link>
                </div>
                </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-6 px-6 py-5">
                  {/* Evento */}
                  <section className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Datos del evento</p>
                    <DetailRow
                      icon={<CalendarIcon className="h-4 w-4" />}
                      label="Fecha"
                      value={new Date(selectedEvento.fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                    />
                    <DetailRow
                      icon={<Clock className="h-4 w-4" />}
                      label="Horario"
                      value={selectedEvento.horario ? `${selectedEvento.horario}${selectedEvento.horarioFin ? ` a ${selectedEvento.horarioFin}` : ""} hs.` : "—"}
                    />
                    <DetailRow
                      icon={<MapPin className="h-4 w-4" />}
                      label="Salon"
                      value={selectedEvento.salon ? SALON_DIRECCIONES[selectedEvento.salon] || selectedEvento.salon : "—"}
                    />
                    <DetailRow
                      icon={<Users className="h-4 w-4" />}
                      label="Invitados"
                      value={`${totalInvitados} personas (${selectedEvento.adultos} adultos, ${selectedEvento.adolescentes} adol., ${selectedEvento.ninos} ninos)`}
                    />
                  </section>

                  <Separator />

                  {/* Cliente */}
                  <section className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Datos del cliente</p>
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor="edit-nombre" className="text-xs text-muted-foreground">Nombre completo</Label>
                          <Input
                            id="edit-nombre"
                            value={editForm.nombreCompleto}
                            onChange={(e) => setEditForm((f) => ({ ...f, nombreCompleto: e.target.value }))}
                            placeholder="Nombre y apellido"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="edit-dni" className="text-xs text-muted-foreground">DNI</Label>
                            <Input
                              id="edit-dni"
                              value={editForm.dni}
                              onChange={(e) => setEditForm((f) => ({ ...f, dni: e.target.value }))}
                              placeholder="DNI"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="edit-telefono" className="text-xs text-muted-foreground">Telefono</Label>
                            <Input
                              id="edit-telefono"
                              value={editForm.telefono}
                              onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
                              placeholder="Telefono"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-direccion" className="text-xs text-muted-foreground">Direccion</Label>
                          <Input
                            id="edit-direccion"
                            value={editForm.direccion}
                            onChange={(e) => setEditForm((f) => ({ ...f, direccion: e.target.value }))}
                            placeholder="Direccion"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="edit-email" className="text-xs text-muted-foreground">Email</Label>
                          <Input
                            id="edit-email"
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                            placeholder="Email"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Condicion IVA</Label>
                          <Select
                            value={editForm.condicionIVA}
                            onValueChange={(v) => setEditForm((f) => ({ ...f, condicionIVA: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Condicion IVA" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
                              <SelectItem value="Responsable Inscripto">Responsable Inscripto</SelectItem>
                              <SelectItem value="Monotributista">Monotributista</SelectItem>
                              <SelectItem value="Exento">Exento</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : (
                      <>
                        <DetailRow icon={<User className="h-4 w-4" />} label="Nombre completo" value={contrato.nombreCompleto} />
                        <DetailRow icon={<FileText className="h-4 w-4" />} label="DNI" value={contrato.dni} />
                        <DetailRow icon={<Phone className="h-4 w-4" />} label="Telefono" value={contrato.telefono} />
                        <DetailRow icon={<MapPin className="h-4 w-4" />} label="Direccion" value={contrato.direccion} />
                        <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={contrato.email} />
                        <DetailRow icon={<FileText className="h-4 w-4" />} label="Condicion IVA" value={selectedEvento.condicionIVA || "Consumidor Final"} />
                      </>
                    )}
                  </section>

                  <Separator />

                  {/* Servicios */}
                  <section className="space-y-3">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      <ListChecks className="h-3.5 w-3.5" />
                      Servicios del contrato
                    </p>
                    {serviciosIncluidos.length > 0 ? (
                      <ul className="space-y-1">
                        {serviciosIncluidos.map((s, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin servicios cargados.</p>
                    )}
                  </section>

                  {/* Plan de cuotas */}
                  {selectedEvento.planDeCuotas && selectedEvento.planDeCuotas.montoTotal > 0 && (
                    <>
                      <Separator />
                      <section className="space-y-3">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                          <DollarSign className="h-3.5 w-3.5" />
                          Financiacion
                        </p>
                        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Total</p>
                            <p className="font-semibold">{formatCurrency(selectedEvento.planDeCuotas.montoTotal)}</p>
                          </div>
                          {selectedEvento.planDeCuotas.montoSena && selectedEvento.planDeCuotas.montoSena > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground">Sena</p>
                              <p className="font-semibold">{formatCurrency(selectedEvento.planDeCuotas.montoSena)}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-muted-foreground">Cuotas</p>
                            <p className="font-semibold">{selectedEvento.planDeCuotas.numeroCuotas}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Por cuota</p>
                            <p className="font-semibold">{formatCurrency(selectedEvento.planDeCuotas.montoCuota)}</p>
                          </div>
                        </div>
                      </section>
                    </>
                  )}

                  {/* Personal asignado al evento */}
                  {personalAsignado.length > 0 && (
                    <>
                      <Separator />
                      <section className="space-y-3">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                          <Users className="h-3.5 w-3.5" />
                          Personal asignado ({personalAsignado.length})
                        </p>
                        <div className="space-y-1.5">
                          {personalAsignado.map((p, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate">{p.nombre}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">{p.funcion}</Badge>
                            </div>
                          ))}
                        </div>
                      </section>
                    </>
                  )}

                  {/* Historial de modificaciones */}
                  <Separator />
                  <section className="space-y-3">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      <History className="h-3.5 w-3.5" />
                      Historial de modificaciones
                    </p>
                    <HistorialContratoTimeline
                      versiones={selectedEvento.versionesContrato || []}
                      recetas={recetas}
                      catalogoServicios={catalogoServicios}
                    />
                  </section>

                  {/* Historial de generaciones del contrato */}
                  <Separator />
                  <section className="space-y-3">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      <Printer className="h-3.5 w-3.5" />
                      Historial de generaciones
                    </p>
                    {(selectedEvento.generacionesContrato || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Este contrato todavia no fue generado.</p>
                    ) : (
                      <ol className="space-y-2">
                        {[...(selectedEvento.generacionesContrato || [])]
                          .sort((a, b) => b.fecha.localeCompare(a.fecha))
                          .map((gen, idx, arr) => (
                            <li key={gen.id} className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2">
                              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">
                                  Generacion #{arr.length - idx}
                                  {gen.version ? ` · sobre version ${gen.version}` : ""}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(gen.fecha).toLocaleDateString("es-AR", {
                                    day: "2-digit", month: "short", year: "numeric",
                                    hour: "2-digit", minute: "2-digit",
                                  })}
                                  {typeof gen.cantidadServicios === "number" ? ` · ${gen.cantidadServicios} servicios` : ""}
                                  {typeof gen.cantidadPersonal === "number" && gen.cantidadPersonal > 0 ? ` · ${gen.cantidadPersonal} personal` : ""}
                                  {gen.montoTotal ? ` · ${formatCurrency(gen.montoTotal)}` : ""}
                                </p>
                              </div>
                            </li>
                          ))}
                      </ol>
                    )}
                  </section>
                </div>
              </ScrollArea>

              {/* Actions (solo en modo edicion) */}
              {isEditing && (
                <div className="border-t border-border p-4">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCancelEdit} disabled={saving} className="flex-1 gap-2 bg-transparent">
                      <X className="h-4 w-4" />
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveEdit} disabled={saving} className="flex-1 gap-2">
                      {saving ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Preview rendered as a Dialog INSIDE the Sheet: Radix's layer
              stack keeps the Sheet open while the Dialog is the top layer */}
          {selectedEvento && (
            <ContractPreview
              open={showPreview}
              evento={selectedEvento}
              recetas={recetas}
          serviciosIncluidos={serviciosIncluidos}
          paquetePrecio={paquetePrecio}
          personalAsignado={personalAsignado}
          barrasTemplates={state.barrasTemplates || []}
          cocteles={state.cocteles || []}
          onClose={() => setShowPreviewSync(false)}
            />
          )}
          </div>
        </>
      )}
    </div>
  )
}

export default function ContratosPage() {
  return (
    <Suspense>
      <ContratosPageContent />
    </Suspense>
  )
}

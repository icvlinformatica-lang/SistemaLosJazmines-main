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
} from "@/lib/store"
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
// HELPER: Build menu details from event recipes
// =====================================================================
function buildMenuDetails(evento: EventoGuardado, recetas: Receta[]) {
  const recetasAdultos = (evento.recetasAdultos || []).map((id) => recetas.find((r) => r.id === id)).filter(Boolean) as Receta[]
  const recetasAdolescentes = (evento.recetasAdolescentes || []).map((id) => recetas.find((r) => r.id === id)).filter(Boolean) as Receta[]
  const recetasNinos = (evento.recetasNinos || []).map((id) => recetas.find((r) => r.id === id)).filter(Boolean) as Receta[]
  return {
    recepcion: recetasAdultos.filter((r) => r.categoria === "Recepcion" || r.categoria === "Recepción").map((r) => r.nombre),
    entradaAdultos: recetasAdultos.filter((r) => r.categoria === "Entrada").map((r) => r.nombre),
    entradaAdolescentes: recetasAdolescentes.filter((r) => r.categoria === "Entrada").map((r) => r.nombre),
    menuInfantil: recetasNinos.map((r) => r.nombre),
    platoPrincipalAdultos: recetasAdultos.filter((r) => r.categoria === "Plato Principal").map((r) => r.nombre),
    platoPrincipalAdolescentes: recetasAdolescentes.filter((r) => r.categoria === "Plato Principal").map((r) => r.nombre),
    guarniciones: [
      ...recetasAdultos.filter((r) => r.categoria === "Guarnicion" || r.categoria === "Guarnición").map((r) => r.nombre),
      ...recetasAdolescentes.filter((r) => r.categoria === "Guarnicion" || r.categoria === "Guarnición").map((r) => r.nombre),
    ],
    postre: [
      ...recetasAdultos.filter((r) => r.categoria === "Postre").map((r) => r.nombre),
      ...recetasNinos.filter((r) => r.categoria === "Postre").map((r) => r.nombre),
    ],
  }
}

// =====================================================================
// CONTRACT HTML GENERATOR
// =====================================================================
function generateContractHTML(
  evento: EventoGuardado,
  recetas: Receta[],
  serviciosIncluidos: string[],
  paquetePrecio: number
) {
  const totalPersonas = evento.adultos + evento.adolescentes + evento.ninos + (evento.personasDietasEspeciales || 0)
  const contrato = evento.contrato || {}
  const planCuotas = evento.planDeCuotas
  const menu = buildMenuDetails(evento, recetas)
  const fechaEvento = evento.fecha ? new Date(evento.fecha + "T12:00:00").toLocaleDateString("es-AR") : "___/___/______"
  const fechaContrato = new Date().toLocaleDateString("es-AR")
  const salon = evento.salon || "___________"
  const direccion = SALON_DIRECCIONES[salon] || `${salon} - Del Viso - Bs. As.`
  const nombreEvento = evento.nombrePareja || evento.nombre || "Evento"
  const horarioInicio = evento.horario || "___:___"
  const horarioFin = evento.horarioFin || "___:___"
  const condicionIVA = evento.condicionIVA || "Consumidor Final"
  const modalidadPago = planCuotas?.modalidadPago || "cuotas"
  const montoSena = planCuotas?.montoSena || 0
  const porcentajeRecargo = planCuotas?.porcentajeRecargo || 0
  const montoFinanciado = modalidadPago === "sena" ? Math.max(0, (planCuotas?.montoTotal || 0) - montoSena) : (planCuotas?.montoTotal || 0)
  const importeRecargo = montoFinanciado * (porcentajeRecargo / 100)
  const montoConRecargo = montoFinanciado + importeRecargo
  const montoCuotaCalc = planCuotas && planCuotas.numeroCuotas > 0 ? montoConRecargo / planCuotas.numeroCuotas : 0
  const totalFinalContrato = (modalidadPago === "sena" ? montoSena : 0) + montoConRecargo

  let cuotasInfo = ""
  if (planCuotas && planCuotas.montoTotal > 0) {
    if (modalidadPago === "completo") {
      cuotasInfo = `Se abona el monto total de (PESOS ${formatCurrency(planCuotas.montoTotal)}) en un unico pago al momento de la firma del presente contrato.`
    } else if (modalidadPago === "sena" && montoSena > 0) {
      cuotasInfo = `En este acto se abona la suma de (PESOS ${formatCurrency(montoSena)}) en concepto de sena y el saldo de PESOS ${formatCurrency(montoFinanciado)} a cancelar en ${planCuotas.numeroCuotas} cuotas.`
    } else if (planCuotas.numeroCuotas > 0) {
      cuotasInfo = `El monto total de (PESOS ${formatCurrency(planCuotas.montoTotal)}) se abonara en ${planCuotas.numeroCuotas} cuotas${porcentajeRecargo > 0 ? ` con un recargo del ${porcentajeRecargo}%` : ""}.`
    }
  }

  const menuRows = [
    menu.recepcion.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Recepcion</td><td style="padding:4px 8px;">${menu.recepcion.join(", ")}</td></tr>` : "",
    menu.entradaAdultos.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Entrada (adultos)</td><td style="padding:4px 8px;">${menu.entradaAdultos.join(", ")}</td></tr>` : "",
    menu.entradaAdolescentes.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Entrada (adolescentes)</td><td style="padding:4px 8px;">${menu.entradaAdolescentes.join(", ")}</td></tr>` : "",
    menu.platoPrincipalAdultos.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Plato Principal (adultos)</td><td style="padding:4px 8px;">${menu.platoPrincipalAdultos.join(", ")}</td></tr>` : "",
    menu.platoPrincipalAdolescentes.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Plato Principal (adolescentes)</td><td style="padding:4px 8px;">${menu.platoPrincipalAdolescentes.join(", ")}</td></tr>` : "",
    menu.guarniciones.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Guarniciones</td><td style="padding:4px 8px;">${menu.guarniciones.join(", ")}</td></tr>` : "",
    menu.menuInfantil.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Menu Infantil</td><td style="padding:4px 8px;">${menu.menuInfantil.join(", ")}</td></tr>` : "",
    menu.postre.length > 0 ? `<tr><td style="font-weight:bold;padding:4px 8px;">Postre</td><td style="padding:4px 8px;">${menu.postre.join(", ")}</td></tr>` : "",
  ].filter(Boolean).join("")

  const serviciosRows = serviciosIncluidos.map((s) => `<li style="margin-bottom:4px;">${s}</li>`).join("")

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Contrato - ${nombreEvento}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 0; }
  .page { max-width: 780px; margin: 0 auto; padding: 40px 48px; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px; margin-bottom: 8px; }
  table.data td { padding: 3px 8px; vertical-align: top; }
  table.data td:first-child { font-weight: bold; width: 180px; }
  .firma { display: flex; gap: 60px; margin-top: 60px; }
  .firma-box { flex: 1; text-align: center; }
  .firma-line { border-top: 1px solid #111; margin-top: 48px; padding-top: 6px; font-size: 11px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <h1>LOS JAZMINES</h1>
  <p style="text-align:center;font-size:11px;color:#555;">${direccion}</p>
  <h1 style="font-size:16px;margin-top:16px;">CONTRATO DE SERVICIOS</h1>
  <p style="text-align:center;color:#555;font-size:11px;">Fecha: ${fechaContrato}</p>

  <h2>DATOS DEL CLIENTE</h2>
  <table class="data">
    <tr><td>Nombre completo</td><td>${contrato.nombreCompleto || "___________________________"}</td></tr>
    <tr><td>DNI</td><td>${contrato.dni || "___________________________"}</td></tr>
    <tr><td>Telefono</td><td>${contrato.telefono || "___________________________"}</td></tr>
    <tr><td>Direccion</td><td>${contrato.direccion || "___________________________"}</td></tr>
    <tr><td>Email</td><td>${contrato.email || "___________________________"}</td></tr>
    <tr><td>Condicion IVA</td><td>${condicionIVA}</td></tr>
  </table>

  <h2>DATOS DEL EVENTO</h2>
  <table class="data">
    <tr><td>Evento</td><td>${nombreEvento}</td></tr>
    <tr><td>Fecha</td><td>${fechaEvento}</td></tr>
    <tr><td>Horario</td><td>${horarioInicio} a ${horarioFin} hs.</td></tr>
    <tr><td>Salon</td><td>${salon} — ${direccion}</td></tr>
    <tr><td>Invitados</td><td>${totalPersonas} personas (${evento.adultos} adultos, ${evento.adolescentes} adolescentes, ${evento.ninos} ninos)</td></tr>
  </table>

  ${serviciosIncluidos.length > 0 ? `
  <h2>SERVICIOS CONTRATADOS</h2>
  <ul style="margin:0;padding-left:20px;">${serviciosRows}</ul>
  ` : ""}

  ${menuRows ? `
  <h2>MENU</h2>
  <table style="width:100%;border-collapse:collapse;">${menuRows}</table>
  ` : ""}

  ${planCuotas && planCuotas.montoTotal > 0 ? `
  <h2>CONDICIONES ECONOMICAS</h2>
  <table class="data">
    <tr><td>Precio total</td><td>${formatCurrency(planCuotas.montoTotal)}</td></tr>
    ${modalidadPago === "sena" ? `<tr><td>Sena abonada</td><td>${formatCurrency(montoSena)}</td></tr>` : ""}
    ${planCuotas.numeroCuotas > 1 ? `
      <tr><td>Cuotas</td><td>${planCuotas.numeroCuotas} cuotas de ${formatCurrency(montoCuotaCalc)}${porcentajeRecargo > 0 ? ` (con ${porcentajeRecargo}% de recargo)` : ""}</td></tr>
      <tr><td>Total con recargo</td><td>${formatCurrency(totalFinalContrato)}</td></tr>
    ` : ""}
  </table>
  <p style="margin-top:8px;font-size:11px;">${cuotasInfo}</p>
  ` : ""}

  <h2>CLAUSULAS</h2>
  <p style="line-height:1.6;">El presente contrato regula la prestacion de servicios de catering y salon para el evento indicado. El incumplimiento en los plazos de pago podra dar lugar a la rescision del contrato con perdida de la sena abonada. Los servicios seran prestados en el salon indicado en las condiciones y horarios especificados. Cualquier modificacion debera ser acordada por escrito entre ambas partes.</p>

  <div class="firma">
    <div class="firma-box">
      <div class="firma-line">Firma del Cliente<br/>${contrato.nombreCompleto || ""}</div>
    </div>
    <div class="firma-box">
      <div class="firma-line">Firma Los Jazmines<br/>Representante Autorizado</div>
    </div>
  </div>
</div>
</body>
</html>`
}

// =====================================================================
// CONTRACT PREVIEW MODAL
// =====================================================================
function ContractPreview({
  open, evento, recetas, serviciosIncluidos, paquetePrecio, onOpenChange,
}: {
  open: boolean; evento: EventoGuardado; recetas: Receta[]; serviciosIncluidos: string[]; paquetePrecio: number; onOpenChange: (open: boolean) => void
}) {
  const html = generateContractHTML(evento, recetas, serviciosIncluidos, paquetePrecio)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Vista Previa del Contrato
          </DialogTitle>
        </DialogHeader>
        <iframe
          srcDoc={html}
          className="flex-1 w-full rounded-b-xl"
          title="Vista previa del contrato"
        />
      </DialogContent>
    </Dialog>
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
  const [showPreview, setShowPreview] = useState(false)
  // Ref siempre actual para leer showPreview dentro de los handlers del Sheet
  // (evita el closure obsoleto que dejaba pasar el cierre)
  const showPreviewRef = useRef(false)
  useEffect(() => { showPreviewRef.current = showPreview }, [showPreview])
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
    const html = generateContractHTML(selectedEvento, recetas, serviciosIncluidos, paquetePrecio)
    const printWindow = window.open("", "_blank", "width=900,height=700")
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 300)
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
                onClick={() => setSelectedEventoId(ev.id)}
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

      {/* SIDE PANEL — read-only contract details */}
      <Sheet open={!!selectedEvento} onOpenChange={(o) => { if (!o) setSelectedEventoId("") }}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
          onInteractOutside={(e) => { if (showPreviewRef.current) e.preventDefault() }}
          onFocusOutside={(e) => { if (showPreviewRef.current) e.preventDefault() }}
          onPointerDownOutside={(e) => { if (showPreviewRef.current) e.preventDefault() }}
          onEscapeKeyDown={(e) => { if (showPreviewRef.current) { e.preventDefault(); setShowPreview(false) } }}
        >
          {selectedEvento && (
            <>
              <SheetHeader className="border-b border-border px-6 py-4 text-left">
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${getSalonColor(selectedEvento.salon).dot}`} />
                  <SheetTitle className="text-base">
                    {selectedEvento.nombrePareja || selectedEvento.nombre || "Evento"}
                  </SheetTitle>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">{selectedEvento.salon || "Sin salon"}</Badge>
                  {ultimaVersion > 0 ? (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <History className="h-3 w-3" />
                      Contrato v{ultimaVersion}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Sin contrato generado</Badge>
                  )}
                </div>

                {/* Toolbar: editar (lapiz) + imprimir */}
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant={isEditing ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => (isEditing ? handleCancelEdit() : setIsEditing(true))}
                    className="gap-2 bg-transparent"
                    aria-pressed={isEditing}
                  >
                    <Pencil className="h-4 w-4" />
                    {isEditing ? "Cancelar edicion" : "Editar"}
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
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1">
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
                </div>
              </ScrollArea>

              {/* Actions */}
              <div className="border-t border-border p-4">
                {isEditing ? (
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
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowPreview(true)} className="flex-1 gap-2 bg-transparent">
                        <Eye className="h-4 w-4" />
                        Vista Previa
                      </Button>
                      <Button variant="outline" onClick={handlePrint} className="flex-1 gap-2 bg-transparent">
                        <Printer className="h-4 w-4" />
                        Imprimir
                      </Button>
                    </div>
                    <Link href={`/evento?id=${selectedEvento.id}&from=contratos`} className="mt-2 block">
                      <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
                        <Pencil className="h-4 w-4" />
                        Editar en el planificador
                      </Button>
                    </Link>
                  </>
                )}
              </div>
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
              onOpenChange={setShowPreview}
            />
          )}
        </SheetContent>
      </Sheet>
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

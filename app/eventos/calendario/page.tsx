"use client"

// Calendario de Eventos
import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import {
  generateId,
  formatCurrency,
  type EventoGuardado,
  type EstadoEvento,
  type PagoEvento,
} from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Users,
  Clock,
  Building2,
  Pencil,
  Trash2,
  ArrowLeft,
  Sparkles,
  Search,
  CreditCard,
  Printer,
  Eye,
  EyeOff,
} from "lucide-react"

// --- Helpers ---
const DIAS_SEMANA = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
const DIAS_SEMANA_LARGO = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const ESTADO_CONFIG: Record<EstadoEvento, { label: string; className: string; dotColor: string }> = {
  pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-800 border-amber-300", dotColor: "bg-amber-500" },
  confirmado: { label: "Confirmado", className: "bg-emerald-100 text-emerald-800 border-emerald-300", dotColor: "bg-emerald-500" },
  completado: { label: "Completado", className: "bg-sky-100 text-sky-800 border-sky-300", dotColor: "bg-sky-500" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-800 border-red-300", dotColor: "bg-red-400" },
}

const TIPO_COLORES: Record<string, string> = {
  "Casamiento": "border-l-pink-500 bg-pink-50",
  "Cumpleanos de 15": "border-l-violet-500 bg-violet-50",
  "Empresarial": "border-l-sky-500 bg-sky-50",
  "Cumpleanos": "border-l-orange-500 bg-orange-50",
  "Bautismo": "border-l-teal-500 bg-teal-50",
  "Otro": "border-l-gray-500 bg-gray-50",
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday = 0
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

function parseEventDate(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number)
  return new Date(y, m - 1, d)
}

type ViewMode = "anual" | "trimestre" | "mes" | "semana" | "dia"

const TRIMESTRE_NOMBRES = ["Ene - Mar", "Abr - Jun", "Jul - Sep", "Oct - Dic"]

// --- Sub-components ---

function EventBadge({ evento }: { evento: EventoGuardado }) {
  const total = evento.adultos + evento.adolescentes + evento.ninos + (evento.personasDietasEspeciales || 0)
  const tipoColor = TIPO_COLORES[evento.tipoEvento || "Otro"] || TIPO_COLORES["Otro"]

  return (
    <div
      className={`border-l-4 rounded-sm px-1.5 py-0.5 text-xs truncate cursor-pointer transition-opacity hover:opacity-80 ${tipoColor}`}
      title={`${evento.nombre || evento.tipoEvento || "Evento"} - ${total} personas`}
    >
      <span className="font-medium truncate block">
        {evento.horario && <span className="text-muted-foreground">{evento.horario} </span>}
        {evento.nombre || evento.tipoEvento || "Evento"}
      </span>
    </div>
  )
}

// --- Payment Receipt Component ---
function PaymentReceipt({ evento, pago }: { evento: EventoGuardado; pago: PagoEvento }) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    if (!receiptRef.current) return
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>Comprobante de Pago - Los Jazmines</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2d5a3d; padding-bottom: 15px; }
            .header h1 { color: #2d5a3d; font-size: 24px; margin: 0 0 5px 0; }
            .header p { color: #666; margin: 0; font-size: 12px; }
            .section { margin-bottom: 20px; }
            .section h3 { font-size: 14px; color: #2d5a3d; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
            .row .label { color: #666; }
            .row .value { font-weight: bold; }
            .amount { text-align: center; margin: 25px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
            .amount .value { font-size: 28px; font-weight: bold; color: #2d5a3d; }
            .amount .label { font-size: 12px; color: #666; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
            .signature-line { text-align: center; width: 45%; }
            .signature-line .line { border-top: 1px solid #333; margin-bottom: 5px; }
            .signature-line .name { font-size: 12px; color: #666; }
            .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #999; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Los Jazmines</h1>
            <p>Comprobante de Pago</p>
          </div>
          <div class="section">
            <h3>Datos del Evento</h3>
            <div class="row"><span class="label">Evento:</span><span class="value">${evento.nombre || evento.tipoEvento || "Evento"}</span></div>
            <div class="row"><span class="label">Festejados:</span><span class="value">${evento.nombrePareja || "-"}</span></div>
            <div class="row"><span class="label">Fecha del evento:</span><span class="value">${evento.fecha}</span></div>
            <div class="row"><span class="label">Salon:</span><span class="value">${evento.salon || "-"}</span></div>
            ${evento.dniNovio1 ? `<div class="row"><span class="label">DNI 1:</span><span class="value">${evento.dniNovio1}</span></div>` : ""}
            ${evento.dniNovio2 ? `<div class="row"><span class="label">DNI 2:</span><span class="value">${evento.dniNovio2}</span></div>` : ""}
          </div>
          <div class="amount">
            <div class="label">Monto del Pago</div>
            <div class="value">${formatCurrency(pago.monto)}</div>
          </div>
          <div class="section">
            <h3>Datos del Pago</h3>
            <div class="row"><span class="label">Fecha de pago:</span><span class="value">${pago.fecha}</span></div>
            <div class="row"><span class="label">Pagado por:</span><span class="value">${pago.pagadoPor}</span></div>
            <div class="row"><span class="label">IPC aplicado:</span><span class="value">${pago.porcentajeIPC}%</span></div>
            ${pago.notas ? `<div class="row"><span class="label">Notas:</span><span class="value">${pago.notas}</span></div>` : ""}
          </div>
          <div class="signatures">
            <div class="signature-line">
              <div class="line"></div>
              <div class="name">Firma del Cliente</div>
            </div>
            <div class="signature-line">
              <div class="line"></div>
              <div class="name">Firma Los Jazmines</div>
            </div>
          </div>
          <div class="footer">
            <p>Este comprobante es valido como constancia de pago.</p>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handlePrint}>
      <Printer className="h-3.5 w-3.5" />
    </Button>
  )
}

// --- Main Component ---

export default function CalendarioPage() {
  const router = useRouter()
  const { state, eventos, updateEvento, deleteEvento, setEventoActual } = useStore()

  const today = new Date()
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [viewMode, setViewMode] = useState<ViewMode>("mes")
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  // Search
  const [searchTerm, setSearchTerm] = useState("")
  const [showDashboard, setShowDashboard] = useState(true)

  // Dialog states
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedEvento, setSelectedEvento] = useState<EventoGuardado | null>(null)
  const [editMode, setEditMode] = useState(false)

  // Payment dialog
  const [showPagoDialog, setShowPagoDialog] = useState(false)
  const [pagoForm, setPagoForm] = useState({
    monto: 0,
    fecha: new Date().toISOString().split("T")[0],
    pagadoPor: "",
    porcentajeIPC: 0,
    notas: "",
  })

  // Form for edit event (detail dialog only)
  const emptyForm: Omit<EventoGuardado, "id"> = {
    nombre: "",
    fecha: "",
    horario: "",
    salon: "",
    tipoEvento: undefined,
    nombrePareja: "",
    adultos: 0,
    adolescentes: 0,
    ninos: 0,
    personasDietasEspeciales: 0,
    recetasAdultos: [],
    recetasAdolescentes: [],
    recetasNinos: [],
    recetasDietasEspeciales: [],
    multipliersAdultos: {},
    multipliersAdolescentes: {},
    multipliersNinos: {},
    multipliersDietasEspeciales: {},
    descripcionPersonalizada: "",
    barras: [],
    estado: "pendiente",
    precioVenta: 0,
    costoPersonal: 0,
    costoInsumos: 0,
    notasInternas: "",
  }
  const [form, setForm] = useState(emptyForm)

  // --- Navigation ---
  const navigateYear = (dir: number) => {
    const newYear = currentDate.getFullYear() + dir
    if (newYear >= 2020 && newYear <= 2030) {
      setCurrentDate(new Date(newYear, currentDate.getMonth(), 1))
    }
  }

  const navigateQuarter = (dir: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir * 3, 1))
  }

  const navigateMonth = (dir: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1))
  }

  const navigateWeek = (dir: number) => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + dir * 7)
    setCurrentDate(d)
  }

  const navigateDay = (dir: number) => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + dir)
    setCurrentDate(d)
  }

  const goToToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  }

  // --- Events for current view ---
  const eventsForDate = (date: Date) => {
    return eventos.filter((e) => {
      const eDate = parseEventDate(e.fecha)
      return isSameDay(eDate, date)
    })
  }

  // --- Week helpers ---
  const getWeekStart = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day // Monday
    d.setDate(d.getDate() + diff)
    return d
  }

  const getWeekDays = (date: Date) => {
    const start = getWeekStart(date)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }

  // --- Upcoming 5 weeks events ---
  const upcomingEvents = useMemo(() => {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const fiveWeeksLater = new Date(todayStart)
    fiveWeeksLater.setDate(fiveWeeksLater.getDate() + 35)

    return eventos
      .filter((e) => {
        const d = parseEventDate(e.fecha)
        return d >= todayStart && d <= fiveWeeksLater
      })
      .sort((a, b) => parseEventDate(a.fecha).getTime() - parseEventDate(b.fecha).getTime())
  }, [eventos, today])

  // --- Search results ---
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase().trim()
    return eventos.filter((e) => {
      const nameMatch = (e.nombre || "").toLowerCase().includes(term)
      const parejaMatch = (e.nombrePareja || "").toLowerCase().includes(term)
      const dniMatch = (e.dniNovio1 || "").includes(term) || (e.dniNovio2 || "").includes(term)
      return nameMatch || parejaMatch || dniMatch
    })
  }, [eventos, searchTerm])

  // --- Redirect to planner ---
  const handleGoToPlanner = () => {
    setEventoActual({
      id: generateId(),
      nombre: "",
      fecha: new Date().toISOString().split("T")[0],
      horario: "",
      salon: undefined,
      tipoEvento: undefined,
      nombrePareja: "",
      adultos: 0,
      adolescentes: 0,
      ninos: 0,
      personasDietasEspeciales: 0,
      recetasAdultos: [],
      recetasAdolescentes: [],
      recetasNinos: [],
      recetasDietasEspeciales: [],
      multipliersAdultos: {},
      multipliersAdolescentes: {},
      multipliersNinos: {},
      multipliersDietasEspeciales: {},
      descripcionPersonalizada: "",
      barras: [],
    })
    router.push("/evento")
  }

  // --- CRUD handlers ---
  const handleUpdate = () => {
    if (!selectedEvento) return
    updateEvento(selectedEvento.id, form)
    setSelectedEvento({ ...selectedEvento, ...form })
    setEditMode(false)
  }

  const handleDelete = () => {
    if (!selectedEvento) return
    deleteEvento(selectedEvento.id)
    setShowDeleteDialog(false)
    setShowDetailDialog(false)
    setSelectedEvento(null)
  }

  const openDetail = (evento: EventoGuardado) => {
    setSelectedEvento(evento)
    setForm({
      nombre: evento.nombre,
      fecha: evento.fecha,
      horario: evento.horario || "",
      salon: evento.salon || "",
      tipoEvento: evento.tipoEvento,
      nombrePareja: evento.nombrePareja || "",
      adultos: evento.adultos,
      adolescentes: evento.adolescentes,
      ninos: evento.ninos,
      personasDietasEspeciales: evento.personasDietasEspeciales,
      recetasAdultos: evento.recetasAdultos,
      recetasAdolescentes: evento.recetasAdolescentes,
      recetasNinos: evento.recetasNinos,
      recetasDietasEspeciales: evento.recetasDietasEspeciales,
      multipliersAdultos: evento.multipliersAdultos,
      multipliersAdolescentes: evento.multipliersAdolescentes,
      multipliersNinos: evento.multipliersNinos,
      multipliersDietasEspeciales: evento.multipliersDietasEspeciales,
      descripcionPersonalizada: evento.descripcionPersonalizada,
      barras: evento.barras,
      estado: evento.estado,
      precioVenta: evento.precioVenta || 0,
      costoPersonal: evento.costoPersonal || 0,
      notasInternas: evento.notasInternas || "",
    })
    setEditMode(false)
    setShowDetailDialog(true)
  }

  const handleGoToPlannerForDate = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    setEventoActual({
      id: generateId(),
      nombre: "",
      fecha: `${y}-${m}-${d}`,
      horario: "",
      salon: undefined,
      tipoEvento: undefined,
      nombrePareja: "",
      adultos: 0,
      adolescentes: 0,
      ninos: 0,
      personasDietasEspeciales: 0,
      recetasAdultos: [],
      recetasAdolescentes: [],
      recetasNinos: [],
      recetasDietasEspeciales: [],
      multipliersAdultos: {},
      multipliersAdolescentes: {},
      multipliersNinos: {},
      multipliersDietasEspeciales: {},
      descripcionPersonalizada: "",
      barras: [],
    })
    router.push("/evento")
  }

  // --- Payment handlers ---
  const handleAddPago = () => {
    if (!selectedEvento || pagoForm.monto <= 0 || !pagoForm.pagadoPor) return
    const newPago: PagoEvento = {
      id: generateId(),
      monto: pagoForm.monto,
      fecha: pagoForm.fecha,
      pagadoPor: pagoForm.pagadoPor,
      porcentajeIPC: pagoForm.porcentajeIPC,
      notas: pagoForm.notas || undefined,
    }
    const currentPagos = selectedEvento.pagos || []
    const updatedPagos = [...currentPagos, newPago]
    updateEvento(selectedEvento.id, { pagos: updatedPagos })
    setSelectedEvento({ ...selectedEvento, pagos: updatedPagos })
    setPagoForm({
      monto: 0,
      fecha: new Date().toISOString().split("T")[0],
      pagadoPor: "",
      porcentajeIPC: 0,
      notas: "",
    })
    setShowPagoDialog(false)
  }

  const handleDeletePago = (pagoId: string) => {
    if (!selectedEvento) return
    const updatedPagos = (selectedEvento.pagos || []).filter((p) => p.id !== pagoId)
    updateEvento(selectedEvento.id, { pagos: updatedPagos })
    setSelectedEvento({ ...selectedEvento, pagos: updatedPagos })
  }

  // --- Calendar Grid (Month) ---
  const renderMonthView = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)

    const cells: React.ReactNode[] = []

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="min-h-24 border border-border/50 bg-muted/20 rounded-sm" />)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dayEvents = eventsForDate(date)
      const isToday = isSameDay(date, today)

      cells.push(
        <div
          key={day}
          className={`min-h-24 border border-border/50 rounded-sm p-1 transition-colors cursor-pointer hover:bg-accent/30 ${
            isToday ? "bg-primary/5 border-primary/30" : "bg-card"
          }`}
          onClick={() => {
            setSelectedDay(date)
            setCurrentDate(date)
            setViewMode("dia")
          }}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span
              className={`text-xs font-medium leading-none ${
                isToday
                  ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  : "text-foreground"
              }`}
            >
              {day}
            </span>
            {dayEvents.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleGoToPlannerForDate(date)
                }}
                className="h-5 w-5 flex items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                aria-label="Agregar evento"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            {dayEvents.slice(0, 3).map((ev) => (
              <div
                key={ev.id}
                onClick={(e) => {
                  e.stopPropagation()
                  openDetail(ev)
                }}
              >
                <EventBadge evento={ev} />
              </div>
            ))}
            {dayEvents.length > 3 && (
              <span className="text-[10px] text-muted-foreground text-center">
                +{dayEvents.length - 3} mas
              </span>
            )}
          </div>
        </div>,
      )
    }

    return (
      <div>
        <div className="grid grid-cols-7 gap-px mb-px">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px">{cells}</div>
      </div>
    )
  }

  // --- Week View ---
  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate)

    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((date, i) => {
          const dayEvents = eventsForDate(date)
          const isToday = isSameDay(date, today)
          return (
            <div
              key={i}
              className={`min-h-64 rounded-lg border p-2 ${
                isToday ? "border-primary/40 bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{DIAS_SEMANA[i]}</p>
                  <p
                    className={`text-lg font-bold ${
                      isToday
                        ? "flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground mx-auto"
                        : ""
                    }`}
                  >
                    {date.getDate()}
                  </p>
                </div>
                <button
                  onClick={() => handleGoToPlannerForDate(date)}
                  className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  aria-label="Agregar evento"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {dayEvents.map((ev) => (
                  <div key={ev.id} onClick={() => openDetail(ev)} className="cursor-pointer">
                    <EventBadge evento={ev} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // --- Day View ---
  const renderDayView = () => {
    const dayEvents = eventsForDate(currentDate)

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">
              {currentDate.getDate()} de {MESES[currentDate.getMonth()]}
            </p>
            <p className="text-sm text-muted-foreground">
              {DIAS_SEMANA[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1]},{" "}
              {currentDate.getFullYear()}
            </p>
          </div>
          <Button onClick={() => handleGoToPlannerForDate(currentDate)} size="sm">
            <Sparkles className="h-4 w-4 mr-1" />
            Planificar Evento
          </Button>
        </div>

        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border border-dashed border-border">
            <CalendarIcon className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No hay eventos este dia</p>
            <p className="text-sm text-muted-foreground mt-1">Crea eventos desde el Planificador</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayEvents.map((ev) => {
              const total = ev.adultos + ev.adolescentes + ev.ninos + (ev.personasDietasEspeciales || 0)
              const estadoCfg = ESTADO_CONFIG[ev.estado]
              const tipoColor = TIPO_COLORES[ev.tipoEvento || "Otro"] || TIPO_COLORES["Otro"]

              return (
                <Card
                  key={ev.id}
                  className={`border-l-4 cursor-pointer transition-shadow hover:shadow-md ${tipoColor}`}
                  onClick={() => openDetail(ev)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base truncate">
                            {ev.nombre || ev.tipoEvento || "Evento"}
                          </h3>
                          <Badge variant="outline" className={`text-xs shrink-0 ${estadoCfg.className}`}>
                            {estadoCfg.label}
                          </Badge>
                        </div>
                        {ev.nombrePareja && (
                          <p className="text-sm text-muted-foreground mb-2">{ev.nombrePareja}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {ev.horario && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" /> {ev.horario}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" /> {total} personas
                          </span>
                          {ev.salon && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5" /> {ev.salon}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // --- Year View ---
  const renderYearView = () => {
    const year = currentDate.getFullYear()

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, monthIdx) => {
          const daysInMonth = getDaysInMonth(year, monthIdx)
          const firstDay = getFirstDayOfMonth(year, monthIdx)
          const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIdx

          const monthEventos = eventos.filter((e) => {
            const d = parseEventDate(e.fecha)
            return d.getMonth() === monthIdx && d.getFullYear() === year
          })

          return (
            <Card
              key={monthIdx}
              className={`cursor-pointer transition-shadow hover:shadow-md ${
                isCurrentMonth ? "ring-2 ring-primary/30" : ""
              }`}
              onClick={() => {
                setCurrentDate(new Date(year, monthIdx, 1))
                setViewMode("mes")
              }}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-sm font-semibold ${isCurrentMonth ? "text-primary" : ""}`}>
                    {MESES[monthIdx]}
                  </h3>
                  {monthEventos.length > 0 && (
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                      {monthEventos.length}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-7 gap-px text-center">
                  {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                    <span key={d} className="text-[9px] text-muted-foreground font-medium leading-4">{d}</span>
                  ))}
                  {Array.from({ length: firstDay }, (_, i) => (
                    <span key={`e-${i}`} className="text-[9px] leading-4" />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1
                    const date = new Date(year, monthIdx, day)
                    const hasEvents = monthEventos.some((e) => {
                      const ed = parseEventDate(e.fecha)
                      return ed.getDate() === day
                    })
                    const isToday2 = isSameDay(date, today)

                    return (
                      <span
                        key={day}
                        className={`text-[9px] leading-4 rounded-sm ${
                          isToday2
                            ? "bg-primary text-primary-foreground font-bold"
                            : hasEvents
                              ? "bg-primary/20 text-primary font-semibold"
                              : "text-muted-foreground"
                        }`}
                      >
                        {day}
                      </span>
                    )
                  })}
                </div>

                {monthEventos.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border">
                    {monthEventos.slice(0, 5).map((ev) => {
                      const tipoColor = TIPO_COLORES[ev.tipoEvento || "Otro"] || TIPO_COLORES["Otro"]
                      return (
                        <div
                          key={ev.id}
                          className={`border-l-2 rounded-sm px-1 py-0.5 text-[9px] truncate max-w-full ${tipoColor}`}
                          title={ev.nombre || ev.tipoEvento || "Evento"}
                        >
                          {parseEventDate(ev.fecha).getDate()} {ev.nombre || ev.tipoEvento || "Evento"}
                        </div>
                      )
                    })}
                    {monthEventos.length > 5 && (
                      <span className="text-[9px] text-muted-foreground">+{monthEventos.length - 5} mas</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  // --- Quarter View ---
  const renderQuarterView = () => {
    const year = currentDate.getFullYear()
    const quarterStart = Math.floor(currentDate.getMonth() / 3) * 3

    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }, (_, qIdx) => {
          const monthIdx = quarterStart + qIdx
          if (monthIdx > 11) return null
          const daysInMonth = getDaysInMonth(year, monthIdx)
          const firstDay = getFirstDayOfMonth(year, monthIdx)
          const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIdx

          const monthEventos = eventos.filter((e) => {
            const d = parseEventDate(e.fecha)
            return d.getMonth() === monthIdx && d.getFullYear() === year
          })

          const totalPax = monthEventos.reduce(
            (s, e) => s + e.adultos + e.adolescentes + e.ninos + (e.personasDietasEspeciales || 0), 0
          )

          const cells: React.ReactNode[] = []
          for (let i = 0; i < firstDay; i++) {
            cells.push(<div key={`empty-${i}`} className="min-h-16 border border-border/50 bg-muted/20 rounded-sm" />)
          }
          for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, monthIdx, day)
            const dayEvents = eventsForDate(date)
            const isToday2 = isSameDay(date, today)

            cells.push(
              <div
                key={day}
                className={`min-h-16 border border-border/50 rounded-sm p-1 transition-colors cursor-pointer hover:bg-accent/30 ${
                  isToday2 ? "bg-primary/5 border-primary/30" : "bg-card"
                }`}
                onClick={() => {
                  setCurrentDate(date)
                  setViewMode("dia")
                }}
              >
                <span
                  className={`text-xs font-medium ${
                    isToday2
                      ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      : "text-foreground"
                  }`}
                >
                  {day}
                </span>
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <div
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); openDetail(ev) }}
                    >
                      <EventBadge evento={ev} />
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="text-[9px] text-muted-foreground text-center">+{dayEvents.length - 2}</span>
                  )}
                </div>
              </div>
            )
          }

          return (
            <div key={monthIdx}>
              <div className="flex items-center justify-between mb-2">
                <h3
                  className={`text-lg font-semibold cursor-pointer hover:text-primary transition-colors ${
                    isCurrentMonth ? "text-primary" : ""
                  }`}
                  onClick={() => {
                    setCurrentDate(new Date(year, monthIdx, 1))
                    setViewMode("mes")
                  }}
                >
                  {MESES[monthIdx]}
                </h3>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{monthEventos.length} eventos</span>
                  <span>{totalPax} personas</span>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-px mb-px">
                {DIAS_SEMANA.map((d) => (
                  <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px">{cells}</div>
            </div>
          )
        })}
      </div>
    )
  }

  // --- View Title ---
  const viewTitle = () => {
    if (viewMode === "anual") {
      return `${currentDate.getFullYear()}`
    }
    if (viewMode === "trimestre") {
      const q = Math.floor(currentDate.getMonth() / 3)
      return `${TRIMESTRE_NOMBRES[q]} ${currentDate.getFullYear()}`
    }
    if (viewMode === "mes") {
      return `${MESES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    }
    if (viewMode === "semana") {
      const weekDays = getWeekDays(currentDate)
      const start = weekDays[0]
      const end = weekDays[6]
      const fmt = (d: Date) => `${d.getDate()} ${MESES[d.getMonth()].substring(0, 3)}`
      return `${fmt(start)} - ${fmt(end)} ${end.getFullYear()}`
    }
    return `${currentDate.getDate()} de ${MESES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  }

  const navigate = (dir: number) => {
    if (viewMode === "anual") navigateYear(dir)
    else if (viewMode === "trimestre") navigateQuarter(dir)
    else if (viewMode === "mes") navigateMonth(dir)
    else if (viewMode === "semana") navigateWeek(dir)
    else navigateDay(dir)
  }

  const detailTotal = selectedEvento
    ? selectedEvento.adultos + selectedEvento.adolescentes + selectedEvento.ninos + (selectedEvento.personasDietasEspeciales || 0)
    : 0

  const totalPagos = selectedEvento ? (selectedEvento.pagos || []).reduce((s, p) => s + p.monto, 0) : 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <CalendarIcon className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Calendario de Eventos</h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Dashboard toggle */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDashboard(!showDashboard)}
            className="gap-2"
          >
            {showDashboard ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showDashboard ? "Ocultar panel" : "Mostrar panel"}
          </Button>
        </div>

        {/* Search + Today + Upcoming Events */}
        {showDashboard && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Search */}
          <div className="lg:col-span-1 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchTerm.trim() && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center">Sin resultados</p>
                ) : (
                  searchResults.map((ev) => {
                    const estadoCfg = ESTADO_CONFIG[ev.estado]
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-accent/30 cursor-pointer transition-colors"
                        onClick={() => openDetail(ev)}
                      >
                        <div className={`h-2 w-2 rounded-full shrink-0 ${estadoCfg.dotColor}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{ev.nombre || ev.tipoEvento || "Evento"}</p>
                          <p className="text-xs text-muted-foreground">{ev.fecha} {ev.nombrePareja && `- ${ev.nombrePareja}`}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
            {/* Today */}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Hoy</p>
                <p className="text-lg font-bold">
                  {DIAS_SEMANA_LARGO[today.getDay() === 0 ? 6 : today.getDay() - 1]} {today.getDate()} de {MESES[today.getMonth()]} {today.getFullYear()}
                </p>
                {eventsForDate(today).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {eventsForDate(today).map((ev) => (
                      <div
                        key={ev.id}
                        className="text-sm cursor-pointer hover:underline"
                        onClick={() => openDetail(ev)}
                      >
                        {ev.horario && <span className="text-muted-foreground">{ev.horario} - </span>}
                        {ev.nombre || ev.tipoEvento || "Evento"}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Upcoming 5 weeks */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Proximos Eventos (5 semanas)</h3>
            {upcomingEvents.length === 0 ? (
              <div className="flex items-center justify-center py-8 rounded-lg border border-dashed border-border">
                <p className="text-sm text-muted-foreground">No hay eventos en las proximas 5 semanas</p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {upcomingEvents.slice(0, 8).map((ev) => {
                  const estadoCfg = ESTADO_CONFIG[ev.estado]
                  const tipoColor = TIPO_COLORES[ev.tipoEvento || "Otro"] || TIPO_COLORES["Otro"]
                  const total = ev.adultos + ev.adolescentes + ev.ninos + (ev.personasDietasEspeciales || 0)
                  const evDate = parseEventDate(ev.fecha)

                  return (
                    <div
                      key={ev.id}
                      className={`border-l-4 rounded-lg border p-3 cursor-pointer hover:shadow-sm transition-shadow ${tipoColor}`}
                      onClick={() => openDetail(ev)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{ev.nombre || ev.tipoEvento || "Evento"}</p>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${estadoCfg.className}`}>
                          {estadoCfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{evDate.getDate()} {MESES[evDate.getMonth()].substring(0, 3)}</span>
                        {ev.horario && <span>{ev.horario}</span>}
                        <span>{total} pax</span>
                        {ev.salon && <span>{ev.salon}</span>}
                      </div>
                    </div>
                  )
                })}
                {upcomingEvents.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center col-span-2">
                    +{upcomingEvents.length - 8} eventos mas
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Hoy
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold ml-2">{viewTitle()}</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              {([
                { key: "anual", label: "Anual" },
                { key: "trimestre", label: "Trim." },
                { key: "mes", label: "Mes" },
                { key: "semana", label: "Semana" },
                { key: "dia", label: "Dia" },
              ] as { key: ViewMode; label: string }[]).map((v, i, arr) => (
                <button
                  key={v.key}
                  onClick={() => setViewMode(v.key)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    i < arr.length - 1 ? "border-r border-border" : ""
                  } ${viewMode === v.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <Button onClick={handleGoToPlanner}>
              <Sparkles className="h-4 w-4 mr-1" />
              Planificar
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-muted-foreground font-medium">Tipo:</span>
          {Object.entries(TIPO_COLORES).map(([tipo, cls]) => (
            <span key={tipo} className={`border-l-4 rounded-sm px-2 py-0.5 ${cls}`}>
              {tipo === "Cumpleanos de 15" ? "15 anos" : tipo}
            </span>
          ))}
          <span className="text-muted-foreground font-medium ml-2">Estado:</span>
          {Object.entries(ESTADO_CONFIG).map(([, cfg]) => (
            <span key={cfg.label} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${cfg.dotColor}`} />
              {cfg.label}
            </span>
          ))}
        </div>

        {/* Calendar View */}
        {viewMode === "anual" && renderYearView()}
        {viewMode === "trimestre" && renderQuarterView()}
        {viewMode === "mes" && renderMonthView()}
        {viewMode === "semana" && renderWeekView()}
        {viewMode === "dia" && renderDayView()}
      </main>

      {/* --- Detail / Edit Dialog --- */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedEvento && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {editMode ? "Editar Evento" : (selectedEvento.nombre || selectedEvento.tipoEvento || "Evento")}
                  {!editMode && (
                    <Badge variant="outline" className={ESTADO_CONFIG[selectedEvento.estado].className}>
                      {ESTADO_CONFIG[selectedEvento.estado].label}
                    </Badge>
                  )}
                </DialogTitle>
                {!editMode && selectedEvento.nombrePareja && (
                  <DialogDescription>{selectedEvento.nombrePareja}</DialogDescription>
                )}
              </DialogHeader>

              {editMode ? (
                /* --- Edit mode form --- */
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label>Nombre</Label>
                    <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-2">
                      <Label>Fecha</Label>
                      <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} min="2020-01-01" max="2030-12-31" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Horario</Label>
                      <Input type="time" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Estado</Label>
                      <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v as EstadoEvento })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendiente">Pendiente</SelectItem>
                          <SelectItem value="confirmado">Confirmado</SelectItem>
                          <SelectItem value="completado">Completado</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Tipo de Evento</Label>
                      <Select value={form.tipoEvento || ""} onValueChange={(v) => setForm({ ...form, tipoEvento: v as EventoGuardado["tipoEvento"] })}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Casamiento">Casamiento</SelectItem>
                          <SelectItem value="Cumpleaños de 15">15 anos</SelectItem>
                          <SelectItem value="Empresarial">Empresarial</SelectItem>
                          <SelectItem value="Cumpleaños">Cumpleanos</SelectItem>
                          <SelectItem value="Bautismo">Bautismo</SelectItem>
                          <SelectItem value="Otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Salon</Label>
                      <Input value={form.salon} onChange={(e) => setForm({ ...form, salon: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Pareja / Agasajado</Label>
                    <Input value={form.nombrePareja} onChange={(e) => setForm({ ...form, nombrePareja: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="grid gap-2">
                      <Label>Adultos</Label>
                      <Input type="number" min={0} value={form.adultos || ""} onChange={(e) => setForm({ ...form, adultos: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Adolesc.</Label>
                      <Input type="number" min={0} value={form.adolescentes || ""} onChange={(e) => setForm({ ...form, adolescentes: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Ninos</Label>
                      <Input type="number" min={0} value={form.ninos || ""} onChange={(e) => setForm({ ...form, ninos: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Dietas</Label>
                      <Input type="number" min={0} value={form.personasDietasEspeciales || ""} onChange={(e) => setForm({ ...form, personasDietasEspeciales: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Notas Internas</Label>
                    <Textarea value={form.notasInternas} onChange={(e) => setForm({ ...form, notasInternas: e.target.value })} rows={2} />
                  </div>
                </div>
              ) : (
                /* --- Read mode --- */
                <div className="space-y-4 py-2">
                  {/* Basic info */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Fecha:</span>{" "}
                      <span className="font-medium">{selectedEvento.fecha}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Horario:</span>{" "}
                      <span className="font-medium">{selectedEvento.horario || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>{" "}
                      <span className="font-medium">{selectedEvento.tipoEvento || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Salon:</span>{" "}
                      <span className="font-medium">{selectedEvento.salon || "-"}</span>
                    </div>
                    {selectedEvento.dniNovio1 && (
                      <div>
                        <span className="text-muted-foreground">DNI 1:</span>{" "}
                        <span className="font-medium">{selectedEvento.dniNovio1}</span>
                      </div>
                    )}
                    {selectedEvento.dniNovio2 && (
                      <div>
                        <span className="text-muted-foreground">DNI 2:</span>{" "}
                        <span className="font-medium">{selectedEvento.dniNovio2}</span>
                      </div>
                    )}
                  </div>

                  {/* People */}
                  <div className="rounded-lg border border-border p-3">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4" /> Asistentes ({detailTotal})
                    </h4>
                    <div className="grid grid-cols-4 gap-3 text-center text-sm">
                      <div>
                        <p className="text-lg font-bold">{selectedEvento.adultos}</p>
                        <p className="text-xs text-muted-foreground">Adultos</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{selectedEvento.adolescentes}</p>
                        <p className="text-xs text-muted-foreground">Adolescentes</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{selectedEvento.ninos}</p>
                        <p className="text-xs text-muted-foreground">Ninos</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{selectedEvento.personasDietasEspeciales || 0}</p>
                        <p className="text-xs text-muted-foreground">Dietas Esp.</p>
                      </div>
                    </div>
                  </div>

                  {/* Payments Section */}
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> Pagos Registrados
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setShowDetailDialog(false)
                          router.push(`/eventos/pagos?evento=${encodeURIComponent(selectedEvento?.id || "")}`)
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Registrar Pago
                      </Button>
                    </div>

                    {(selectedEvento.pagos || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">No hay pagos registrados</p>
                    ) : (
                      <div className="space-y-2">
                        {(selectedEvento.pagos || []).map((pago) => (
                          <div key={pago.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{formatCurrency(pago.monto)}</span>
                                {pago.porcentajeIPC > 0 && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    IPC +{pago.porcentajeIPC}%
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {pago.fecha} - {pago.pagadoPor}
                                {pago.notas && ` - ${pago.notas}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <PaymentReceipt evento={selectedEvento} pago={pago} />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive hover:text-destructive"
                                onClick={() => handleDeletePago(pago.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 border-t border-border text-sm">
                          <span className="font-medium">Total pagado:</span>
                          <span className="font-bold">{formatCurrency(totalPagos)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recipes summary */}
                  {(selectedEvento.recetasAdultos.length > 0 ||
                    selectedEvento.recetasAdolescentes.length > 0 ||
                    selectedEvento.recetasNinos.length > 0 ||
                    selectedEvento.recetasDietasEspeciales.length > 0) && (
                    <div className="rounded-lg border border-border p-3">
                      <h4 className="text-sm font-semibold mb-2">Menu Configurado</h4>
                      <div className="text-sm space-y-1">
                        {selectedEvento.recetasAdultos.length > 0 && (
                          <p>
                            <span className="text-muted-foreground">Adultos:</span>{" "}
                            {selectedEvento.recetasAdultos
                              .map((id) => state.recetas.find((r) => r.id === id)?.nombre)
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                        {selectedEvento.recetasNinos.length > 0 && (
                          <p>
                            <span className="text-muted-foreground">Ninos:</span>{" "}
                            {selectedEvento.recetasNinos
                              .map((id) => state.recetas.find((r) => r.id === id)?.nombre)
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedEvento.notasInternas && (
                    <div className="rounded-lg border border-border p-3">
                      <h4 className="text-sm font-semibold mb-1">Notas</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedEvento.notasInternas}</p>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                {editMode ? (
                  <>
                    <Button variant="outline" onClick={() => setEditMode(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleUpdate}>Guardar Cambios</Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    <div className="flex-1" />
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --- Payment Registration Dialog --- */}
      <Dialog open={showPagoDialog} onOpenChange={setShowPagoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Registrar un nuevo pago para este evento
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Monto ($)</Label>
              <Input
                type="number"
                min={0}
                value={pagoForm.monto || ""}
                onChange={(e) => setPagoForm({ ...pagoForm, monto: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Fecha de Pago</Label>
                <Input
                  type="date"
                  value={pagoForm.fecha}
                  onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>% IPC Aplicado</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={pagoForm.porcentajeIPC || ""}
                  onChange={(e) => setPagoForm({ ...pagoForm, porcentajeIPC: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Pagado por</Label>
              <Input
                value={pagoForm.pagadoPor}
                onChange={(e) => setPagoForm({ ...pagoForm, pagadoPor: e.target.value })}
                placeholder="Nombre de quien realiza el pago"
              />
            </div>
            <div className="grid gap-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={pagoForm.notas}
                onChange={(e) => setPagoForm({ ...pagoForm, notas: e.target.value })}
                placeholder="Observaciones..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPagoDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddPago} disabled={pagoForm.monto <= 0 || !pagoForm.pagadoPor}>
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Delete Confirmation --- */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Evento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara permanentemente el evento
              {selectedEvento && ` "${selectedEvento.nombre || selectedEvento.tipoEvento || ""}"`}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

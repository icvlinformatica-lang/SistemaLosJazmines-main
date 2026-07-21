"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store-context"
import { useToast } from "@/hooks/use-toast"
import { generarMovimientoEgreso, FUNCIONES_PERSONAL } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Plus,
  Pencil,
  Trash2,
  User,
  Phone,
  Mail,
  CreditCard,
  DollarSign,
  Briefcase,
  Building2,
  Calendar,
  AlertCircle,
  History,
  Banknote,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  CalendarPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SalonDot } from "@/components/salon-badge"
import { salonLabel } from "@/lib/store"
import type { PersonalEvento, PagoPersonal } from "@/lib/store"

// Colores de badge por función (estilo Servicios)
const FUNCION_COLORS: Record<string, string> = {
  "Coordinador": "bg-blue-50 text-blue-700 border-blue-200",
  "Metre": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Mozo": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Barman": "bg-violet-50 text-violet-700 border-violet-200",
  "Maestranza": "bg-slate-50 text-slate-700 border-slate-200",
  "Puerta": "bg-stone-50 text-stone-700 border-stone-200",
  "DJ": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  "Técnica": "bg-purple-50 text-purple-700 border-purple-200",
  "Parrillero": "bg-orange-50 text-orange-700 border-orange-200",
  "Cocinero": "bg-amber-50 text-amber-700 border-amber-200",
  "Ayudante de cocina": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Bachero": "bg-teal-50 text-teal-700 border-teal-200",
}

function funcionColor(funcion: string): string {
  return FUNCION_COLORS[funcion] || "bg-gray-50 text-gray-700 border-gray-200"
}

type Tarifa = { id: string; descripcion: string; monto: number }

export default function PersonalPage() {
  const {
    personal,
    servicios,
    pagosPersonal,
    eventos,
    addPersonal,
    updatePersonal,
    deletePersonal,
    addPagoPersonal,
    updatePagoPersonal,
    deletePagoPersonal,
    configuracionCajas,
    movimientosCaja,
    addMovimientoCaja,
  } = useStore()
  const { toast } = useToast()

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [personalEditando, setPersonalEditando] = useState<PersonalEvento | null>(null)
  const [filtroFuncion, setFiltroFuncion] = useState<string>("todas")
  const [busqueda, setBusqueda] = useState("")

  // Dialogo de asignar compromiso (evento + tarifa)
  const [dialogoCompromisoAbierto, setDialogoCompromisoAbierto] = useState(false)
  const [personaCompromisoId, setPersonaCompromisoId] = useState<string | null>(null)

  // Dialogo de gestion de compromisos activos (lista por persona)
  const [dialogoListaCompromisosAbierto, setDialogoListaCompromisosAbierto] = useState(false)
  const [personaListaCompromisosId, setPersonaListaCompromisosId] = useState<string | null>(null)
  const [compromisoForm, setCompromisoForm] = useState({
    eventoId: "",
    tarifaId: "base", // "base" | id de tarifa | "manual"
    monto: 0,
    descripcion: "",
  })

  // Sheet de historial
  const [sheetHistorialAbierto, setSheetHistorialAbierto] = useState(false)
  const [personaHistorialId, setPersonaHistorialId] = useState<string | null>(null)

  // Dialog de registrar pago
  const [dialogoPagoAbierto, setDialogoPagoAbierto] = useState(false)
  const [pagoSeleccionado, setPagoSeleccionado] = useState<PagoPersonal | null>(null)
  const [pagoForm, setPagoForm] = useState({ tipoPago: "transferencia" as "transferencia" | "efectivo" | "otro", notas: "" })

  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    telefono: "",
    email: "",
    funcion: "",
    servicioVinculadoId: "",
    tarifaBase: 0,
    tarifas: [] as Tarifa[],
    cuentaBancaria: {
      banco: "",
      cbu: "",
      alias: "",
    },
    activo: true,
    notas: "",
  })

  const funciones = Array.from(new Set(personal.map(p => p.funcion))).filter(Boolean)
  const personalActivo = personal.filter(p => p.activo)
  const personalFiltrado = personalActivo.filter(p => {
    if (filtroFuncion !== "todas" && p.funcion !== filtroFuncion) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return (
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) ||
        p.funcion.toLowerCase().includes(q) ||
        (p.telefono || "").includes(q)
      )
    }
    return true
  })

  // Eventos activos a la fecha del dia (hoy o futuros), ordenados por cercania
  const eventosParaCompromiso = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    return [...eventos]
      .filter(e => e.fecha && new Date(e.fecha + "T23:59:59").getTime() >= hoy.getTime())
      .sort((a, b) => new Date(a.fecha + "T12:00:00").getTime() - new Date(b.fecha + "T12:00:00").getTime())
  }, [eventos])

  // === CONFLICTOS DE HORARIO ===
  // Convierte "HH:MM" a minutos desde medianoche; null si no hay dato
  const horaAMinutos = (hora?: string): number | null => {
    if (!hora) return null
    const m = hora.match(/(\d{1,2}):(\d{2})/)
    if (!m) return null
    return Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10)
  }

  /**
   * Verifica si asignar a una persona el evento dado genera conflicto con
   * sus compromisos existentes: mismo dia y horario superpuesto.
   * Si algun evento no tiene horario cargado, se considera que ocupa todo el dia.
   */
  const getConflictoAsignacion = (personaId: string, eventoId: string): { evento: typeof eventos[number]; motivo: string } | null => {
    const eventoNuevo = eventos.find(e => e.id === eventoId)
    if (!eventoNuevo?.fecha) return null

    // Compromisos no pagados de la persona (activos)
    const compromisosPersona = pagosPersonal.filter(p => p.personalId === personaId && p.estado !== "pagado")

    for (const comp of compromisosPersona) {
      // Ya asignado a este mismo evento
      if (comp.eventoId === eventoId) {
        return { evento: eventoNuevo, motivo: "Ya tiene un compromiso asignado en este evento" }
      }
      const eventoExistente = eventos.find(e => e.id === comp.eventoId)
      if (!eventoExistente?.fecha) continue
      if (eventoExistente.fecha !== eventoNuevo.fecha) continue

      // Mismo dia: comparar horarios
      const iniNuevo = horaAMinutos(eventoNuevo.horario)
      const finNuevoRaw = horaAMinutos(eventoNuevo.horarioFin)
      const iniExist = horaAMinutos(eventoExistente.horario)
      const finExistRaw = horaAMinutos(eventoExistente.horarioFin)

      // Sin horario en alguno de los dos → se considera todo el dia (conflicto)
      if (iniNuevo === null || iniExist === null) {
        return { evento: eventoExistente, motivo: "Mismo dia y sin horario definido (se considera todo el dia)" }
      }

      // Fin por defecto: inicio + 6hs; si cruza medianoche, sumar 24hs
      let finNuevo = finNuevoRaw ?? iniNuevo + 360
      if (finNuevo <= iniNuevo) finNuevo += 1440
      let finExist = finExistRaw ?? iniExist + 360
      if (finExist <= iniExist) finExist += 1440

      const seSuperponen = iniNuevo < finExist && iniExist < finNuevo
      if (seSuperponen) {
        return { evento: eventoExistente, motivo: `Horario superpuesto (${eventoExistente.horario}${eventoExistente.horarioFin ? ` a ${eventoExistente.horarioFin}` : ""})` }
      }
    }
    return null
  }

  const handleAbrirDialogo = (p?: PersonalEvento) => {
    if (p) {
      setPersonalEditando(p)
      setFormData({
        nombre: p.nombre,
        apellido: p.apellido,
        dni: p.dni,
        telefono: p.telefono,
        email: p.email || "",
        funcion: p.funcion,
        servicioVinculadoId: p.servicioVinculadoId,
        tarifaBase: p.tarifaBase,
        tarifas: p.tarifas || [],
        cuentaBancaria: p.cuentaBancaria || { banco: "", cbu: "", alias: "" },
        activo: p.activo,
        notas: p.notas || "",
      })
    } else {
      setPersonalEditando(null)
      setFormData({
        nombre: "",
        apellido: "",
        dni: "",
        telefono: "",
        email: "",
        funcion: "",
        servicioVinculadoId: "",
        tarifaBase: 0,
        tarifas: [],
        cuentaBancaria: {
          banco: "",
          cbu: "",
          alias: "",
        },
        activo: true,
        notas: "",
      })
    }
    setDialogoAbierto(true)
  }

  const handleGuardar = () => {
    if (!formData.nombre || !formData.apellido || !formData.funcion) {
      toast({ title: "Error", description: "Por favor completa nombre, apellido y funcion", variant: "destructive" })
      return
    }

    if (personalEditando) {
      updatePersonal(personalEditando.id, formData)
      toast({ title: "Personal actualizado" })
    } else {
      addPersonal(formData)
      toast({ title: "Personal creado" })
    }

    setDialogoAbierto(false)
  }

  const handleEliminar = (id: string) => {
    if (confirm("¿Estas seguro de que deseas eliminar este personal?")) {
      deletePersonal(id)
      toast({ title: "Personal eliminado", variant: "destructive" })
    }
  }

  // === ASIGNAR COMPROMISO MANUAL (evento + tarifa) ===
  const handleAbrirDialogoCompromiso = (personaId: string) => {
    const persona = personal.find(p => p.id === personaId)
    setPersonaCompromisoId(personaId)
    setCompromisoForm({
      eventoId: "",
      tarifaId: "base",
      monto: persona?.tarifaBase || 0,
      descripcion: "",
    })
    setDialogoCompromisoAbierto(true)
  }

  const handleSeleccionTarifaCompromiso = (tarifaId: string) => {
    const persona = personal.find(p => p.id === personaCompromisoId)
    if (!persona) return
    let monto = compromisoForm.monto
    if (tarifaId === "base") {
      monto = persona.tarifaBase || 0
    }
    setCompromisoForm(prev => ({ ...prev, tarifaId, monto }))
  }

  const handleGuardarCompromiso = () => {
    const persona = personal.find(p => p.id === personaCompromisoId)
    const evento = eventos.find(e => e.id === compromisoForm.eventoId)
    if (!persona || !evento) {
      toast({ title: "Error", description: "Selecciona un evento", variant: "destructive" })
      return
    }
    if (!compromisoForm.monto || compromisoForm.monto <= 0) {
      toast({ title: "Error", description: "Ingresa un monto valido", variant: "destructive" })
      return
    }

    // Bloquear doble asignacion: mismo dia y mismo horario
    const conflicto = getConflictoAsignacion(persona.id, evento.id)
    if (conflicto) {
      toast({
        title: "Conflicto de agenda",
        description: `${persona.nombre} ${persona.apellido} ya esta asignado a "${conflicto.evento.nombre || conflicto.evento.nombrePareja || "otro evento"}" el ${formatearFecha(conflicto.evento.fecha)}. ${conflicto.motivo}.`,
        variant: "destructive",
      })
      return
    }

    addPagoPersonal({
      personalId: persona.id,
      eventoId: evento.id,
      nombrePersonal: `${persona.nombre} ${persona.apellido}`.trim(),
      servicioNombre: compromisoForm.descripcion || persona.funcion,
      montoTotal: compromisoForm.monto,
      fechaEvento: evento.fecha,
      // Vence el mismo dia del evento
      fechaLimitePago: evento.fecha,
      estado: "pendiente",
    })

    toast({
      title: "Compromiso asignado",
      description: `${persona.nombre} ${persona.apellido} - ${formatearPrecio(compromisoForm.monto)} para "${evento.nombre || evento.nombrePareja || "evento"}"`,
    })
    setDialogoCompromisoAbierto(false)
  }

  // === GESTION DE COMPROMISOS ACTIVOS (lista por persona) ===
  const handleAbrirListaCompromisos = (personaId: string) => {
    setPersonaListaCompromisosId(personaId)
    setDialogoListaCompromisosAbierto(true)
  }

  const handleEliminarCompromiso = (compromisoId: string) => {
    if (confirm("¿Eliminar este compromiso? Dejara de aparecer en Caja Eventos.")) {
      deletePagoPersonal(compromisoId)
      toast({ title: "Compromiso eliminado", variant: "destructive" })
    }
  }

  // Compromisos activos (no pagados) de la persona seleccionada, con datos del evento
  const compromisosActivosPersona = useMemo(() => {
    if (!personaListaCompromisosId) return []
    return pagosPersonal
      .filter(p => p.personalId === personaListaCompromisosId && p.estado !== "pagado")
      .map(p => ({ ...p, evento: eventos.find(e => e.id === p.eventoId) }))
      .sort((a, b) => (a.fechaEvento || "").localeCompare(b.fechaEvento || ""))
  }, [personaListaCompromisosId, pagosPersonal, eventos])

  // === COMPROMISOS FINANCIEROS ===
  const getCompromisosPersona = (personaId: string) => {
    const pagos = pagosPersonal.filter(p => p.personalId === personaId && p.estado !== "pagado")
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const totalComprometido = pagos.reduce((sum, p) => sum + p.montoTotal, 0)
    const totalSeñado = pagos.reduce((sum, p) => sum + (p.montoSeña || 0), 0)
    const totalPendiente = pagos.reduce((sum, p) => sum + (p.montoTotal - (p.montoSeña || 0)), 0)
    const vencidos = pagos.filter(p => {
      const fechaLimite = new Date(p.fechaLimitePago)
      return fechaLimite < hoy
    }).length

    return { totalComprometido, totalSeñado, totalPendiente, vencidos, cantidad: pagos.length }
  }

  // === HISTORIAL ===
  const handleAbrirHistorial = (personaId: string) => {
    setPersonaHistorialId(personaId)
    setSheetHistorialAbierto(true)
  }

  const getHistorialPersona = (personaId: string) => {
    return pagosPersonal
      .filter(p => p.personalId === personaId)
      .sort((a, b) => new Date(b.fechaEvento).getTime() - new Date(a.fechaEvento).getTime())
  }

  const getEventoNombre = (eventoId: string) => {
    const evento = eventos.find(e => e.id === eventoId)
    return evento?.nombre || evento?.nombrePareja || "Evento desconocido"
  }

  // === REGISTRAR PAGO ===
  const handleAbrirDialogoPago = (pago: PagoPersonal) => {
    setPagoSeleccionado(pago)
    setPagoForm({ tipoPago: "transferencia", notas: "" })
    setDialogoPagoAbierto(true)
  }

  const handleRegistrarPago = () => {
    if (!pagoSeleccionado) return

    // Actualizar el pago como pagado
    updatePagoPersonal(pagoSeleccionado.id, {
      estado: "pagado",
      tipoPago: pagoForm.tipoPago,
      fechaPago: new Date().toISOString().split("T")[0],
      notasPago: pagoForm.notas,
    })

    // Generar movimiento de egreso en la caja
    const evento = eventos.find(e => e.id === pagoSeleccionado.eventoId)
    const salon = evento?.salon || "admin"
    const montoAPagar = pagoSeleccionado.montoTotal - (pagoSeleccionado.montoSeña || 0)

    const movEgreso = generarMovimientoEgreso(
      salon,
      montoAPagar,
      `Pago personal: ${pagoSeleccionado.nombrePersonal} - ${pagoSeleccionado.servicioNombre}`,
      configuracionCajas,
      movimientosCaja
    )
    addMovimientoCaja(movEgreso)

    toast({ title: "Pago registrado", description: `Se registro el pago de ${formatearPrecio(montoAPagar)}` })
    setDialogoPagoAbierto(false)
  }

  const getServicioNombre = (servicioId: string) => {
    const servicio = servicios.find(s => s.id === servicioId)
    return servicio ? servicio.nombre : "Sin servicio"
  }

  const formatearPrecio = (precio: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(precio)
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "pagado":
        return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Pagado</Badge>
      case "vencido":
        return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Vencido</Badge>
      default:
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>
    }
  }

  // Persona para historial
  const personaHistorial = personaHistorialId ? personal.find(p => p.id === personaHistorialId) : null
  const historialPagos = personaHistorialId ? getHistorialPersona(personaHistorialId) : []

  return (
    <div className="container mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion de Personal</h1>
          <p className="text-sm text-muted-foreground">
            Administra el personal, su tarifa y compromisos por evento
          </p>
        </div>
        <Button onClick={() => handleAbrirDialogo()}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Personal
        </Button>
      </div>

      {/* Toolbar (estilo Servicios) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, funcion o telefono..."
            className="pl-8 h-9"
          />
        </div>
        <Select value={filtroFuncion} onValueChange={setFiltroFuncion}>
          <SelectTrigger className="w-52 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las funciones</SelectItem>
            {funciones.map(funcion => (
              <SelectItem key={funcion} value={funcion}>
                <Badge variant="outline" className={cn("text-[11px] font-medium", funcionColor(funcion))}>
                  {funcion}
                </Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="ml-auto h-9 px-3 flex items-center">
          {personalFiltrado.length} persona{personalFiltrado.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Tabla de Personal (estilo Servicios) */}
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className="border-b border-border bg-muted/60">
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-[44px] text-xs uppercase tracking-wide">#</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">Nombre</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide w-[160px]">Funcion</th>
              <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide w-[130px]">
                <span className="flex items-center justify-end gap-1 text-emerald-700">
                  <DollarSign className="h-3.5 w-3.5" />
                  Tarifa
                </span>
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide w-[240px]">
                <span className="flex items-center gap-1 text-amber-700">
                  <Banknote className="h-3.5 w-3.5" />
                  Compromisos activos
                </span>
              </th>
              <th className="px-2 py-2.5 w-[160px]" />
            </tr>
          </thead>
          <tbody>
            {personalFiltrado.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-16 text-muted-foreground">
                  {busqueda || filtroFuncion !== "todas" ? (
                    "No se encontro personal con esos filtros."
                  ) : (
                    <span className="flex flex-col items-center gap-3">
                      <User className="h-10 w-10 text-muted-foreground/50" />
                      No hay personal registrado
                      <Button size="sm" onClick={() => handleAbrirDialogo()}>
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar Primer Personal
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            )}

            {personalFiltrado.map((persona, idx) => {
              const compromisos = getCompromisosPersona(persona.id)
              return (
                <tr
                  key={persona.id}
                  className={cn(
                    "border-b border-border/60 hover:bg-muted/30 transition-colors group",
                    idx % 2 === 0 ? "bg-card" : "bg-muted/10"
                  )}
                >
                  {/* Nro fila */}
                  <td className="px-3 py-2 text-muted-foreground/50 text-xs tabular-nums select-none">
                    {idx + 1}
                  </td>

                  {/* Nombre + telefono */}
                  <td className="px-3 py-2 min-w-[180px]">
                    <p className="font-medium leading-tight">{persona.nombre} {persona.apellido}</p>
                    {persona.telefono && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        {persona.telefono}
                      </p>
                    )}
                  </td>

                  {/* Funcion */}
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={cn("text-[11px] font-medium px-1.5 py-0 border", funcionColor(persona.funcion))}>
                      {persona.funcion}
                    </Badge>
                  </td>

                  {/* Tarifa */}
                  <td className="px-3 py-2 text-right tabular-nums">
                    {persona.tarifaBase > 0 ? (
                      <span className="font-semibold text-emerald-700">{formatearPrecio(persona.tarifaBase)}</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* Compromisos activos (click para gestionar) */}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleAbrirListaCompromisos(persona.id)}
                      className="flex items-center gap-2 rounded px-1.5 py-1 -mx-1.5 hover:bg-amber-50 transition-colors text-left w-full"
                      title="Ver y gestionar compromisos de esta persona"
                    >
                      {compromisos.cantidad === 0 ? (
                        <span className="text-xs text-muted-foreground/60 italic flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          Sin compromisos
                        </span>
                      ) : (
                        <>
                          <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">
                            {compromisos.cantidad} evento{compromisos.cantidad !== 1 ? "s" : ""}
                          </Badge>
                          <span className="text-xs font-semibold text-amber-700 tabular-nums">
                            {formatearPrecio(compromisos.totalPendiente)}
                          </span>
                          {compromisos.vencidos > 0 && (
                            <Badge variant="destructive" className="text-[10px]">{compromisos.vencidos} venc.</Badge>
                          )}
                        </>
                      )}
                    </button>
                  </td>

                  {/* Acciones */}
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-sky-600 hover:text-sky-700"
                        onClick={() => handleAbrirDialogoCompromiso(persona.id)}
                        title="Asignar compromiso a un evento"
                      >
                        <CalendarPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleAbrirHistorial(persona.id)}
                        title="Ver historial de eventos"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleAbrirDialogo(persona)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEliminar(persona.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Dialogo de Gestion de Compromisos Activos */}
      <Dialog open={dialogoListaCompromisosAbierto} onOpenChange={setDialogoListaCompromisosAbierto}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-amber-600" />
              Compromisos Activos
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const p = personal.find(x => x.id === personaListaCompromisosId)
                return p ? `Eventos asignados a ${p.nombre} ${p.apellido} (${p.funcion})` : ""
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {compromisosActivosPersona.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                Sin compromisos activos
              </div>
            ) : (
              compromisosActivosPersona.map(comp => (
                <div
                  key={comp.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5">
                      {comp.evento?.salon && <SalonDot salon={comp.evento.salon} size={8} />}
                      {comp.evento?.nombre || comp.evento?.nombrePareja || "Evento eliminado"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatearFecha(comp.fechaEvento)}
                      {comp.evento?.horario ? ` · ${comp.evento.horario}${comp.evento.horarioFin ? ` a ${comp.evento.horarioFin}` : "hs"}` : ""}
                      {" · "}{comp.servicioNombre}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-amber-700 tabular-nums shrink-0">
                    {formatearPrecio(comp.montoTotal - (comp.montoSeña || 0))}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleEliminarCompromiso(comp.id)}
                    title="Eliminar compromiso"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setDialogoListaCompromisosAbierto(false)
                if (personaListaCompromisosId) handleAbrirDialogoCompromiso(personaListaCompromisosId)
              }}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Asignar a otro evento
            </Button>
            <Button variant="secondary" onClick={() => setDialogoListaCompromisosAbierto(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo de Asignar Compromiso a Evento */}
      <Dialog open={dialogoCompromisoAbierto} onOpenChange={setDialogoCompromisoAbierto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-sky-600" />
              Asignar Compromiso
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const p = personal.find(x => x.id === personaCompromisoId)
                return p
                  ? `Asigna a ${p.nombre} ${p.apellido} (${p.funcion}) a un evento con su tarifa.`
                  : "Selecciona el evento y la tarifa."
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Evento */}
            <div className="space-y-2">
              <Label>Evento</Label>
              <Select
                value={compromisoForm.eventoId}
                onValueChange={(v) => setCompromisoForm(prev => ({ ...prev, eventoId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un evento..." />
                </SelectTrigger>
                <SelectContent>
                  {eventosParaCompromiso.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No hay eventos activos desde hoy</div>
                  )}
                  {eventosParaCompromiso.map(ev => {
                    const conflicto = personaCompromisoId ? getConflictoAsignacion(personaCompromisoId, ev.id) : null
                    return (
                      <SelectItem key={ev.id} value={ev.id} disabled={!!conflicto}>
                        <span className="flex items-center gap-2">
                          {ev.salon && <SalonDot salon={ev.salon} size={8} />}
                          <span className="font-medium">{ev.nombre || ev.nombrePareja || "Evento"}</span>
                          <span className="text-muted-foreground text-xs">
                            {formatearFecha(ev.fecha)}
                            {ev.horario ? ` · ${ev.horario}${ev.horarioFin ? `-${ev.horarioFin}` : "hs"}` : ""}
                            {ev.salon ? ` · ${salonLabel(ev.salon)}` : ""}
                          </span>
                          {conflicto && (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">
                              Ocupado
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Tarifa */}
            <div className="space-y-2">
              <Label>Tarifa</Label>
              <Select
                value={compromisoForm.tarifaId}
                onValueChange={handleSeleccionTarifaCompromiso}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const p = personal.find(x => x.id === personaCompromisoId)
                    return (
                      <>
                        <SelectItem value="base">
                          Tarifa {p && p.tarifaBase > 0 ? `(${formatearPrecio(p.tarifaBase)})` : ""}
                        </SelectItem>
                        <SelectItem value="manual">Monto manual</SelectItem>
                      </>
                    )
                  })()}
                </SelectContent>
              </Select>
            </div>

            {/* Monto */}
            <div className="space-y-2">
              <Label>Monto a pagar</Label>
              <MoneyInput
                value={compromisoForm.monto}
                onValueChange={(v) => setCompromisoForm(prev => ({ ...prev, monto: v, tarifaId: "manual" }))}
              />
            </div>

            {/* Descripcion opcional */}
            <div className="space-y-2">
              <Label>Descripcion (opcional)</Label>
              <Input
                value={compromisoForm.descripcion}
                onChange={(e) => setCompromisoForm(prev => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Ej: Servicio de coordinacion, horas extra..."
              />
            </div>

            <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2.5 text-xs text-sky-800 leading-relaxed">
              El compromiso vence el dia del evento y aparece en Caja Eventos como sueldo a pagar para esa fecha.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoCompromisoAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarCompromiso}>
              Asignar Compromiso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo de Crear/Editar Persona */}
      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {personalEditando ? "Editar Personal" : "Agregar Nuevo Personal"}
            </DialogTitle>
            <DialogDescription>
              {personalEditando ? "Modifica los datos del miembro del personal." : "Completa los datos para registrar un nuevo miembro del equipo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Datos Personales */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Datos Personales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre *</Label>
                    <Input
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Juan"
                    />
                  </div>
                  <div>
                    <Label>Apellido *</Label>
                    <Input
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      placeholder="Perez"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>DNI</Label>
                    <Input
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                      placeholder="12345678"
                    />
                  </div>
                  <div>
                    <Label>Telefono</Label>
                    <Input
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="+54 9 11 1234-5678"
                    />
                  </div>
                </div>

                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@ejemplo.com"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Datos Laborales */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Datos Laborales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Funcion *</Label>
                  <Input
                    value={formData.funcion}
                    onChange={(e) => setFormData({ ...formData, funcion: e.target.value })}
                    placeholder="Ej: Coordinador, Metre, Mozo, Barman"
                    list="funciones-list"
                  />
                  <datalist id="funciones-list">
                    {Array.from(new Set([...FUNCIONES_PERSONAL, ...funciones])).map(f => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <Label>Tarifa</Label>
                  <MoneyInput
                    value={formData.tarifaBase}
                    onValueChange={(v) => setFormData({ ...formData, tarifaBase: v })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Tarifa unica de esta persona por evento</p>
                </div>
              </CardContent>
            </Card>

            {/* Datos Bancarios */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Datos Bancarios (Opcional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Banco</Label>
                  <Input
                    value={formData.cuentaBancaria.banco}
                    onChange={(e) => setFormData({
                      ...formData,
                      cuentaBancaria: { ...formData.cuentaBancaria, banco: e.target.value }
                    })}
                    placeholder="Banco Galicia"
                  />
                </div>

                <div>
                  <Label>CBU</Label>
                  <Input
                    value={formData.cuentaBancaria.cbu}
                    onChange={(e) => setFormData({
                      ...formData,
                      cuentaBancaria: { ...formData.cuentaBancaria, cbu: e.target.value }
                    })}
                    placeholder="0000003100012345678901"
                  />
                </div>

                <div>
                  <Label>Alias</Label>
                  <Input
                    value={formData.cuentaBancaria.alias}
                    onChange={(e) => setFormData({
                      ...formData,
                      cuentaBancaria: { ...formData.cuentaBancaria, alias: e.target.value }
                    })}
                    placeholder="JUAN.PEREZ.FOTO"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notas */}
            <div>
              <Label>Notas</Label>
              <Textarea
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Informacion adicional..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar}>
              {personalEditando ? "Guardar Cambios" : "Crear Personal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet de Historial */}
      <Sheet open={sheetHistorialAbierto} onOpenChange={setSheetHistorialAbierto}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de Eventos
            </SheetTitle>
            <SheetDescription>
              {personaHistorial ? `${personaHistorial.nombre} ${personaHistorial.apellido}` : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {historialPagos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No hay eventos registrados para esta persona</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Sena</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historialPagos.map((pago) => {
                    const saldo = pago.montoTotal - (pago.montoSeña || 0)
                    return (
                      <TableRow key={pago.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{getEventoNombre(pago.eventoId)}</p>
                            <p className="text-xs text-muted-foreground">{formatearFecha(pago.fechaEvento)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{pago.servicioNombre}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatearPrecio(pago.montoTotal)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-green-600">{formatearPrecio(pago.montoSeña || 0)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-amber-600">{formatearPrecio(saldo)}</TableCell>
                        <TableCell>{getEstadoBadge(pago.estado)}</TableCell>
                        <TableCell>
                          {pago.estado !== "pagado" && (
                            <Button variant="outline" size="sm" onClick={() => handleAbrirDialogoPago(pago)}>
                              <Banknote className="h-3 w-3 mr-1" />
                              Pagar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialogo de Registrar Pago */}
      <Dialog open={dialogoPagoAbierto} onOpenChange={setDialogoPagoAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {pagoSeleccionado && (
                <>Pagar {formatearPrecio(pagoSeleccionado.montoTotal - (pagoSeleccionado.montoSeña || 0))} a {pagoSeleccionado.nombrePersonal}</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Tipo de Pago</Label>
              <Select
                value={pagoForm.tipoPago}
                onValueChange={(v: "transferencia" | "efectivo" | "otro") => setPagoForm({ ...pagoForm, tipoPago: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={pagoForm.notas}
                onChange={(e) => setPagoForm({ ...pagoForm, notas: e.target.value })}
                placeholder="Comprobante, referencia..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoPagoAbierto(false)}>Cancelar</Button>
            <Button onClick={handleRegistrarPago}>Registrar Pago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

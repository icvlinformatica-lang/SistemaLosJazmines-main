"use client"

import { useState } from "react"
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
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
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

function parseARS(raw: string): number {
  // Los puntos son separadores de miles (formato es-AR): solo cuentan los dígitos.
  const digits = raw.replace(/\D/g, "")
  const n = parseInt(digits, 10)
  return isNaN(n) ? 0 : n
}

/** Formatea un número con puntos de miles (es-AR), sin símbolo de moneda. */
function formatMiles(n: number): string {
  if (!n) return ""
  return n.toLocaleString("es-AR")
}

// ─── Celda editable numérica (mismo diseño que Finanzas → Servicios) ─────────
function EditableCellMonto({
  value,
  onCommit,
}: {
  value: number
  onCommit: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  const startEdit = () => {
    setDraft(formatMiles(value))
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    onCommit(parseARS(draft))
  }

  if (editing) {
    return (
      <div className="relative w-full">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[15px] pointer-events-none select-none">
          $
        </span>
        <input
          value={draft}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "")
            setDraft(digits ? Number(digits).toLocaleString("es-AR") : "")
          }}
          onBlur={commit}
          inputMode="numeric"
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") setEditing(false)
          }}
          className="w-full h-8 pl-6 pr-2.5 text-[15px] border border-primary/60 rounded outline-none bg-primary/5 focus:bg-white text-right tabular-nums"
          autoFocus
        />
      </div>
    )
  }

  return (
    <div
      onClick={startEdit}
      className={cn(
        "group/cell relative h-8 flex items-center justify-end px-2.5 rounded cursor-pointer hover:bg-muted/70 transition-colors text-[15px] tabular-nums",
        !value && "text-muted-foreground/50 italic",
      )}
      title="Clic para editar"
    >
      {value ? (
        <span className="font-semibold text-emerald-700">{`$ ${formatMiles(value)}`}</span>
      ) : (
        "0"
      )}
      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-40 transition-opacity text-[10px] text-muted-foreground">
        ✎
      </span>
    </div>
  )
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
    updatePagoPersonal,
    configuracionCajas,
    movimientosCaja,
    addMovimientoCaja,
  } = useStore()
  const { toast } = useToast()

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [personalEditando, setPersonalEditando] = useState<PersonalEvento | null>(null)
  const [filtroFuncion, setFiltroFuncion] = useState<string>("todas")
  const [busqueda, setBusqueda] = useState("")

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

  // ── Personal ordenado (orden manual tipo Excel, igual que Servicios) ──────
  const personalOrdenado = personal
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.orden ?? a.i) - (b.p.orden ?? b.i) || a.i - b.i)
    .map((x) => x.p)

  const personalActivo = personalOrdenado.filter(p => p.activo)
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

  // ── Mover fila arriba/abajo (persiste el orden en la base) ────────────────
  const moverPersona = (id: string, dir: -1 | 1) => {
    const idx = personalFiltrado.findIndex((p) => p.id === id)
    const vecino = personalFiltrado[idx + dir]
    if (idx === -1 || !vecino) return
    // Normalizar: asignar orden secuencial según la lista completa actual
    const ordenes = new Map(personalOrdenado.map((p, i) => [p.id, i]))
    // Intercambiar las posiciones de la fila y su vecina
    const a = ordenes.get(id)!
    const b = ordenes.get(vecino.id)!
    ordenes.set(id, b)
    ordenes.set(vecino.id, a)
    // Persistir solo las personas cuyo orden cambió
    for (const p of personalOrdenado) {
      const nuevo = ordenes.get(p.id)!
      if (p.orden !== nuevo) updatePersonal(p.id, { orden: nuevo })
    }
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
            Administra el personal y anota cuánto sale cada uno
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
        <table className="w-full text-[15px] border-collapse min-w-[980px]">
          <thead>
            <tr className="bg-muted/80 border-b border-border sticky top-0 z-10">
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground w-[58px] text-[13px] uppercase tracking-wide">#</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground text-[13px] uppercase tracking-wide">Nombre</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground text-[13px] uppercase tracking-wide w-[165px]">Funcion</th>
              <th className="px-3 py-1.5 text-right font-semibold text-[13px] uppercase tracking-wide w-[170px]">
                <span className="flex items-center justify-end gap-1 text-emerald-700">
                  <DollarSign className="h-4 w-4" />
                  Tarifa
                </span>
              </th>
              <th className="px-2 py-1.5 w-[160px]" />
            </tr>
          </thead>
          <tbody>
            {personalFiltrado.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-16 text-muted-foreground">
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
              return (
                <tr
                  key={persona.id}
                  className={cn(
                    "border-b border-border/60 hover:bg-muted/30 transition-colors group",
                    idx % 2 === 0 ? "bg-card" : "bg-muted/10"
                  )}
                >
                  {/* Nro fila + mover */}
                  <td className="px-1.5 py-0 select-none">
                    <div className="flex items-center gap-1">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moverPersona(persona.id, -1)}
                          disabled={idx === 0}
                          className="min-h-0 p-0.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:pointer-events-none transition-colors"
                          title="Subir fila"
                          aria-label={`Subir ${persona.nombre} ${persona.apellido}`}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moverPersona(persona.id, 1)}
                          disabled={idx === personalFiltrado.length - 1}
                          className="min-h-0 p-0.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:pointer-events-none transition-colors"
                          title="Bajar fila"
                          aria-label={`Bajar ${persona.nombre} ${persona.apellido}`}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-muted-foreground/50 text-[13px] tabular-nums">{idx + 1}</span>
                    </div>
                  </td>

                  {/* Nombre + telefono */}
                  <td className="px-3 py-0 min-w-[180px]">
                    <p className="font-medium leading-tight text-[15px]">{persona.nombre} {persona.apellido}</p>
                    {persona.telefono && (
                      <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {persona.telefono}
                      </p>
                    )}
                  </td>

                  {/* Funcion */}
                  <td className="px-3 py-0">
                    <Badge variant="outline" className={cn("text-[13px] font-medium px-2 py-0.5 border", funcionColor(persona.funcion))}>
                      {persona.funcion}
                    </Badge>
                  </td>

                  {/* Tarifa (editable con $ y puntos de miles) */}
                  <td className="px-1.5 py-0">
                    <EditableCellMonto
                      value={persona.tarifaBase}
                      onCommit={(nuevo) => {
                        if (nuevo === persona.tarifaBase) return
                        if (!confirm(`¿Establecer la tarifa de ${persona.nombre} ${persona.apellido} en ${formatearPrecio(nuevo)}?`)) return
                        updatePersonal(persona.id, { tarifaBase: nuevo })
                      }}
                    />
                  </td>

                  {/* Acciones */}
                  <td className="px-2 py-0">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 min-h-0"
                        onClick={() => handleAbrirHistorial(persona.id)}
                        title="Ver historial de eventos"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 min-h-0"
                        onClick={() => handleAbrirDialogo(persona)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 min-h-0"
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

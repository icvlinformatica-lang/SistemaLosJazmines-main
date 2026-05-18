"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store-context"
import { useToast } from "@/hooks/use-toast"
import { generateId, generarMovimientoEgreso } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
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
} from "lucide-react"
import type { PersonalEvento, PagoPersonal } from "@/lib/store"

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

  // Dialogo de tarifas
  const [dialogoTarifaAbierto, setDialogoTarifaAbierto] = useState(false)
  const [personaTarifaId, setPersonaTarifaId] = useState<string | null>(null)
  const [tarifaEditando, setTarifaEditando] = useState<Tarifa | null>(null)
  const [tarifaForm, setTarifaForm] = useState({ descripcion: "", monto: 0 })

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
  const personalFiltrado = filtroFuncion === "todas" 
    ? personalActivo 
    : personalActivo.filter(p => p.funcion === filtroFuncion)

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

  // === TARIFAS ===
  const handleAbrirDialogoTarifa = (personaId: string, tarifa?: Tarifa) => {
    setPersonaTarifaId(personaId)
    if (tarifa) {
      setTarifaEditando(tarifa)
      setTarifaForm({ descripcion: tarifa.descripcion, monto: tarifa.monto })
    } else {
      setTarifaEditando(null)
      setTarifaForm({ descripcion: "", monto: 0 })
    }
    setDialogoTarifaAbierto(true)
  }

  const handleGuardarTarifa = () => {
    if (!personaTarifaId || !tarifaForm.descripcion) return
    const persona = personal.find(p => p.id === personaTarifaId)
    if (!persona) return

    const tarifasActuales = persona.tarifas || []
    let nuevasTarifas: Tarifa[]

    if (tarifaEditando) {
      nuevasTarifas = tarifasActuales.map(t => 
        t.id === tarifaEditando.id 
          ? { ...t, descripcion: tarifaForm.descripcion, monto: tarifaForm.monto }
          : t
      )
    } else {
      nuevasTarifas = [...tarifasActuales, { id: generateId(), descripcion: tarifaForm.descripcion, monto: tarifaForm.monto }]
    }

    updatePersonal(personaTarifaId, { tarifas: nuevasTarifas })
    toast({ title: tarifaEditando ? "Tarifa actualizada" : "Tarifa agregada" })
    setDialogoTarifaAbierto(false)
  }

  const handleEliminarTarifa = (personaId: string, tarifaId: string) => {
    const persona = personal.find(p => p.id === personaId)
    if (!persona) return

    const nuevasTarifas = (persona.tarifas || []).filter(t => t.id !== tarifaId)
    updatePersonal(personaId, { tarifas: nuevasTarifas })
    toast({ title: "Tarifa eliminada", variant: "destructive" })
  }

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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestion de Personal</h1>
          <p className="text-muted-foreground">
            Administra el personal, tarifas y compromisos financieros
          </p>
        </div>
        <Button onClick={() => handleAbrirDialogo()}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Personal
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <Label>Filtrar por funcion:</Label>
            <Select value={filtroFuncion} onValueChange={setFiltroFuncion}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las funciones</SelectItem>
                {funciones.map(funcion => (
                  <SelectItem key={funcion} value={funcion}>
                    {funcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="ml-auto">
              {personalFiltrado.length} personas
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Personal */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {personalFiltrado.map((persona) => {
          const compromisos = getCompromisosPersona(persona.id)
          const tarifas = persona.tarifas || []
          const servicioVinculado = servicios.find(s => s.id === persona.servicioVinculadoId)

          return (
            <Card key={persona.id} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {persona.nombre} {persona.apellido}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Briefcase className="h-3 w-3" />
                        {persona.funcion}
                        {servicioVinculado && (
                          <Badge variant="outline" className="text-[10px] ml-1">
                            {servicioVinculado.nombre}
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleAbrirDialogo(persona)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEliminar(persona.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Info basica */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{persona.telefono}</span>
                  </div>
                  {persona.cuentaBancaria?.alias && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="h-3.5 w-3.5" />
                      <span className="truncate">{persona.cuentaBancaria.alias}</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Tarifas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Tarifas
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleAbrirDialogoTarifa(persona.id)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar
                    </Button>
                  </div>

                  {tarifas.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sin tarifas configuradas</p>
                  ) : (
                    <div className="space-y-1">
                      {tarifas.map(tarifa => (
                        <div key={tarifa.id} className="flex items-center justify-between bg-muted/50 rounded px-2 py-1.5">
                          <span className="text-sm truncate flex-1">{tarifa.descripcion}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-green-600">{formatearPrecio(tarifa.monto)}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleAbrirDialogoTarifa(persona.id, tarifa)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEliminarTarifa(persona.id, tarifa.id)}>
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Compromisos activos */}
                <div className="space-y-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-amber-600" />
                    Compromisos Activos
                    {compromisos.vencidos > 0 && (
                      <Badge variant="destructive" className="ml-auto">{compromisos.vencidos} vencidos</Badge>
                    )}
                  </span>

                  {compromisos.cantidad === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sin compromisos pendientes</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <p className="text-xs text-muted-foreground">Comprometido</p>
                        <p className="text-sm font-semibold text-blue-700">{formatearPrecio(compromisos.totalComprometido)}</p>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded">
                        <p className="text-xs text-muted-foreground">Senado</p>
                        <p className="text-sm font-semibold text-green-700">{formatearPrecio(compromisos.totalSeñado)}</p>
                      </div>
                      <div className="text-center p-2 bg-amber-50 rounded">
                        <p className="text-xs text-muted-foreground">Pendiente</p>
                        <p className="text-sm font-semibold text-amber-700">{formatearPrecio(compromisos.totalPendiente)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Boton historial */}
                <Button variant="outline" className="w-full" size="sm" onClick={() => handleAbrirHistorial(persona.id)}>
                  <History className="h-4 w-4 mr-2" />
                  Ver Historial de Eventos
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {personalFiltrado.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No hay personal registrado</p>
            <Button onClick={() => handleAbrirDialogo()}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Primer Personal
            </Button>
          </CardContent>
        </Card>
      )}

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
                    placeholder="Ej: Fotografo, DJ, Decorador, Mozo"
                    list="funciones-list"
                  />
                  <datalist id="funciones-list">
                    {funciones.map(f => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <Label>Servicio Vinculado</Label>
                  <Select
                    value={formData.servicioVinculadoId || "ninguno"}
                    onValueChange={(v) => setFormData({ ...formData, servicioVinculadoId: v === "ninguno" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ninguno">Sin servicio vinculado</SelectItem>
                      {servicios.filter(s => s.activo).map((servicio) => (
                        <SelectItem key={servicio.id} value={servicio.id}>
                          {servicio.nombre} ({servicio.categoria})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vincula esta persona a un servicio del catalogo para asignarla a eventos
                  </p>
                </div>

                <div>
                  <Label>Tarifa Base (referencia)</Label>
                  <Input
                    type="number"
                    value={formData.tarifaBase}
                    onChange={(e) => setFormData({ ...formData, tarifaBase: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Puedes agregar tarifas especificas desde la ficha de persona</p>
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

      {/* Dialogo de Tarifa */}
      <Dialog open={dialogoTarifaAbierto} onOpenChange={setDialogoTarifaAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tarifaEditando ? "Editar Tarifa" : "Agregar Tarifa"}</DialogTitle>
            <DialogDescription>
              {tarifaEditando ? "Modifica los datos de la tarifa." : "Crea una nueva tarifa para esta persona."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Descripcion *</Label>
              <Input
                value={tarifaForm.descripcion}
                onChange={(e) => setTarifaForm({ ...tarifaForm, descripcion: e.target.value })}
                placeholder="Ej: Evento chico, Con video incluido"
              />
            </div>
            <div>
              <Label>Monto *</Label>
              <Input
                type="number"
                value={tarifaForm.monto}
                onChange={(e) => setTarifaForm({ ...tarifaForm, monto: parseFloat(e.target.value) || 0 })}
                placeholder="500000"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoTarifaAbierto(false)}>Cancelar</Button>
            <Button onClick={handleGuardarTarifa} disabled={!tarifaForm.descripcion || !tarifaForm.monto}>
              {tarifaEditando ? "Guardar" : "Agregar"}
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

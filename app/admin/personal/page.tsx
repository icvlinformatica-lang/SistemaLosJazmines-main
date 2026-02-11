"use client"

import { useState } from "react"
import { useStore } from "@/lib/store-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
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
  Building2
} from "lucide-react"
import type { PersonalEvento } from "@/lib/store"

export default function PersonalPage() {
  const {
    personal,
    servicios,
    addPersonal,
    updatePersonal,
    deletePersonal,
  } = useStore()

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [personalEditando, setPersonalEditando] = useState<PersonalEvento | null>(null)
  const [filtroFuncion, setFiltroFuncion] = useState<string>("todas")

  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    telefono: "",
    email: "",
    funcion: "",
    servicioVinculadoId: "",
    tarifaBase: 0,
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
    if (!formData.nombre || !formData.apellido || !formData.dni || !formData.servicioVinculadoId) {
      alert("Por favor completa todos los campos obligatorios")
      return
    }

    if (personalEditando) {
      updatePersonal(personalEditando.id, formData)
    } else {
      addPersonal(formData)
    }

    setDialogoAbierto(false)
  }

  const handleEliminar = (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este personal?")) {
      deletePersonal(id)
    }
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Personal</h1>
          <p className="text-muted-foreground">
            Administra el personal vinculado a servicios de eventos
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
            <Label>Filtrar por función:</Label>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {personalFiltrado.map((persona) => (
          <Card key={persona.id} className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {persona.nombre} {persona.apellido}
                    </CardTitle>
                    <CardDescription>DNI: {persona.dni}</CardDescription>
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
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{persona.funcion}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{getServicioNombre(persona.servicioVinculadoId)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{persona.telefono}</span>
              </div>

              {persona.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{persona.email}</span>
                </div>
              )}

              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tarifa base:</span>
                  <span className="font-bold text-green-600">
                    {formatearPrecio(persona.tarifaBase)}
                  </span>
                </div>
              </div>

              {persona.cuentaBancaria && persona.cuentaBancaria.cbu && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-3 w-3" />
                    <span className="font-semibold">Datos bancarios</span>
                  </div>
                  <div>Banco: {persona.cuentaBancaria.banco}</div>
                  <div>Alias: {persona.cuentaBancaria.alias}</div>
                </div>
              )}

              {persona.notas && (
                <div className="text-xs text-muted-foreground italic border-t pt-2">
                  {persona.notas}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
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

      {/* Diálogo de Crear/Editar */}
      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {personalEditando ? "Editar Personal" : "Agregar Nuevo Personal"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Datos Personales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Datos Personales</CardTitle>
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
                      placeholder="Pérez"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>DNI *</Label>
                    <Input
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                      placeholder="12345678"
                    />
                  </div>
                  <div>
                    <Label>Teléfono *</Label>
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
              <CardHeader>
                <CardTitle className="text-lg">Datos Laborales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Función *</Label>
                  <Input
                    value={formData.funcion}
                    onChange={(e) => setFormData({ ...formData, funcion: e.target.value })}
                    placeholder="Ej: Fotógrafo, DJ, Decorador, Mozo"
                    list="funciones-list"
                  />
                  <datalist id="funciones-list">
                    {funciones.map(f => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <Label>Servicio Vinculado *</Label>
                  <Select
                    value={formData.servicioVinculadoId}
                    onValueChange={(value) => setFormData({ ...formData, servicioVinculadoId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      {servicios.filter(s => s.activo).map((servicio) => (
                        <SelectItem key={servicio.id} value={servicio.id}>
                          {servicio.nombre} ({servicio.categoria})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tarifa Base *</Label>
                  <Input
                    type="number"
                    value={formData.tarifaBase}
                    onChange={(e) => setFormData({ ...formData, tarifaBase: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Datos Bancarios */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Datos Bancarios (Opcional)</CardTitle>
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
                placeholder="Información adicional..."
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
    </div>
  )
}

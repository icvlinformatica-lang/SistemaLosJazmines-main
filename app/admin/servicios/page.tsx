"use client"

import { useState } from "react" 
import { useStore } from "@/lib/store-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Users,
  DollarSign,
  TrendingUp,
  Package
} from "lucide-react"
import { calcularTotalesPaquete } from "@/lib/store"
import { useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"


export default function ServiciosPage() {
  const {
    state,
    paquetesSalones,
    servicios,
    addPaqueteSalon,
    updatePaqueteSalon,
    deletePaqueteSalon,
    addServicio,
    updateServicio,
    deleteServicio
  } = useStore()

  const [tabActual, setTabActual] = useState<"quinta" | "casona" | "salon" | "catalogo">("quinta")
  const [dialogoPaqueteAbierto, setDialogoPaqueteAbierto] = useState(false)
  const [dialogoCatalogoAbierto, setDialogoCatalogoAbierto] = useState(false)
  const [paqueteEditando, setPaqueteEditando] = useState<any>(null)
  const [servicioEditando, setServicioEditando] = useState<any>(null)

  // Filtrar paquetes por salón
  const paquetesQuinta = paquetesSalones.filter(p => p.salon === "Quinta" && p.activo)
  const paquetesCasona = paquetesSalones.filter(p => p.salon === "Casona" && p.activo)
  const paquetesSalon = paquetesSalones.filter(p => p.salon === "Salon" && p.activo)

  // Función para obtener color del border según salón
  const getBorderColor = (salon: string) => {
    switch (salon) {
      case "Quinta": return "border-l-emerald-500"
      case "Casona": return "border-l-sky-500"
      case "Salon": return "border-l-amber-500"
      default: return "border-l-gray-500"
    }
  }

  // Función para obtener color del badge según margen
  const getMargenColor = (margen: number) => {
    if (margen >= 15) return "bg-green-500"
    if (margen >= 10) return "bg-yellow-500"
    return "bg-red-500"
  }

  const formatearPrecio = (precio: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(precio)
  }

  const handleGuardarServicio = (data: any) => {
    if (servicioEditando?.id) {
      updateServicio(servicioEditando.id, data)
    } else {
      addServicio(data)
    }
  }

  const handleGuardarPaquete = (data: any) => {
    if (paqueteEditando?.id) {
      updatePaqueteSalon(paqueteEditando.id, data)
    } else {
      addPaqueteSalon(data)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Servicios</h1>
          <p className="text-muted-foreground">
            Administra paquetes por salón y catálogo de servicios
          </p>
        </div>
      </div>

      <Tabs value={tabActual} onValueChange={(v: any) => setTabActual(v)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="quinta" className="gap-2">
            <Package className="h-4 w-4" />
            Quinta ({paquetesQuinta.length})
          </TabsTrigger>
          <TabsTrigger value="casona" className="gap-2">
            <Package className="h-4 w-4" />
            Casona ({paquetesCasona.length})
          </TabsTrigger>
          <TabsTrigger value="salon" className="gap-2">
            <Package className="h-4 w-4" />
            Salón ({paquetesSalon.length})
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="gap-2">
            <Package className="h-4 w-4" />
            Catálogo ({servicios.filter(s => s.activo).length})
          </TabsTrigger>
        </TabsList>

        {/* Tab Quinta */}
        <TabsContent value="quinta" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Paquetes - Quinta</h2>
            <Button onClick={() => {
              setPaqueteEditando({ salon: "Quinta" })
              setDialogoPaqueteAbierto(true)
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Paquete
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paquetesQuinta.map((paquete) => {
              const totales = calcularTotalesPaquete(paquete, servicios)
              return (
                <PaqueteCard
                  key={paquete.id}
                  paquete={paquete}
                  totales={totales}
                  onEditar={() => {
                    setPaqueteEditando(paquete)
                    setDialogoPaqueteAbierto(true)
                  }}
                  onDuplicar={() => {
                    const duplicado = { ...paquete, nombre: `${paquete.nombre} (Copia)` }
                    delete duplicado.id
                    addPaqueteSalon(duplicado)
                  }}
                  onEliminar={() => deletePaqueteSalon(paquete.id)}
                  getBorderColor={getBorderColor}
                  getMargenColor={getMargenColor}
                  formatearPrecio={formatearPrecio}
                  servicios={servicios}
                />
              )
            })}
          </div>

          {paquetesQuinta.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No hay paquetes creados para Quinta</p>
                <Button onClick={() => {
                  setPaqueteEditando({ salon: "Quinta" })
                  setDialogoPaqueteAbierto(true)
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primer Paquete
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Casona */}
        <TabsContent value="casona" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Paquetes - Casona</h2>
            <Button onClick={() => {
              setPaqueteEditando({ salon: "Casona" })
              setDialogoPaqueteAbierto(true)
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Paquete
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paquetesCasona.map((paquete) => {
              const totales = calcularTotalesPaquete(paquete, servicios)
              return (
                <PaqueteCard
                  key={paquete.id}
                  paquete={paquete}
                  totales={totales}
                  onEditar={() => {
                    setPaqueteEditando(paquete)
                    setDialogoPaqueteAbierto(true)
                  }}
                  onDuplicar={() => {
                    const duplicado = { ...paquete, nombre: `${paquete.nombre} (Copia)` }
                    delete duplicado.id
                    addPaqueteSalon(duplicado)
                  }}
                  onEliminar={() => deletePaqueteSalon(paquete.id)}
                  getBorderColor={getBorderColor}
                  getMargenColor={getMargenColor}
                  formatearPrecio={formatearPrecio}
                  servicios={servicios}
                />
              )
            })}
          </div>

          {paquetesCasona.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No hay paquetes creados para Casona</p>
                <Button onClick={() => {
                  setPaqueteEditando({ salon: "Casona" })
                  setDialogoPaqueteAbierto(true)
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primer Paquete
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Salón */}
        <TabsContent value="salon" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Paquetes - Salón</h2>
            <Button onClick={() => {
              setPaqueteEditando({ salon: "Salon" })
              setDialogoPaqueteAbierto(true)
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Paquete
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paquetesSalon.map((paquete) => {
              const totales = calcularTotalesPaquete(paquete, servicios)
              return (
                <PaqueteCard
                  key={paquete.id}
                  paquete={paquete}
                  totales={totales}
                  onEditar={() => {
                    setPaqueteEditando(paquete)
                    setDialogoPaqueteAbierto(true)
                  }}
                  onDuplicar={() => {
                    const duplicado = { ...paquete, nombre: `${paquete.nombre} (Copia)` }
                    delete duplicado.id
                    addPaqueteSalon(duplicado)
                  }}
                  onEliminar={() => deletePaqueteSalon(paquete.id)}
                  getBorderColor={getBorderColor}
                  getMargenColor={getMargenColor}
                  formatearPrecio={formatearPrecio}
                  servicios={servicios}
                />
              )
            })}
          </div>

          {paquetesSalon.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No hay paquetes creados para Salón</p>
                <Button onClick={() => {
                  setPaqueteEditando({ salon: "Salon" })
                  setDialogoPaqueteAbierto(true)
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primer Paquete
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Catálogo */}
        <TabsContent value="catalogo" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Catálogo de Servicios</h2>
            <Button onClick={() => {
              setServicioEditando(null)
              setDialogoCatalogoAbierto(true)
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Servicio
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Código</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Nombre</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Categoría</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Precio Interno</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Precio Oficial</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Ganancia</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {servicios.filter(s => s.activo).map((servicio) => {
                      const ganancia = servicio.precioOficial - servicio.precioInterno
                      const margen = servicio.precioInterno > 0
                        ? ((ganancia / servicio.precioInterno) * 100)
                        : 0

                      return (
                        <tr key={servicio.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 text-sm font-mono">{servicio.codigo}</td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium">{servicio.nombre}</p>
                              <p className="text-xs text-muted-foreground">{servicio.descripcion}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{servicio.categoria}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-red-600 font-semibold">
                            {formatearPrecio(servicio.precioInterno)}
                            <span className="text-xs text-muted-foreground ml-1">
                              /{servicio.unidad === "Fijo" ? "fijo" : servicio.unidad === "Por Persona" ? "pers" : "hora"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-green-600 font-semibold">
                            {formatearPrecio(servicio.precioOficial)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-semibold text-blue-600">
                                {formatearPrecio(ganancia)}
                              </span>
                              <Badge className={getMargenColor(margen)}>
                                {margen.toFixed(1)}%
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setServicioEditando(servicio)
                                  setDialogoCatalogoAbierto(true)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteServicio(servicio.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {servicios.filter(s => s.activo).length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No hay servicios en el catálogo</p>
                  <Button onClick={() => {
                    setServicioEditando(null)
                    setDialogoCatalogoAbierto(true)
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Primer Servicio
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Diálogos */}
      <DialogoServicio
        abierto={dialogoCatalogoAbierto}
        onCerrar={() => {
          setDialogoCatalogoAbierto(false)
          setServicioEditando(null)
        }}
        servicio={servicioEditando}
        onGuardar={handleGuardarServicio}
      />

      <DialogoPaquete
        abierto={dialogoPaqueteAbierto}
        onCerrar={() => {
          setDialogoPaqueteAbierto(false)
          setPaqueteEditando(null)
        }}
        paquete={paqueteEditando}
        servicios={servicios}
        onGuardar={handleGuardarPaquete}
      />
    </div>
  )
}

// COMPONENTE PAQUETE CARD
function PaqueteCard({
  paquete,
  totales,
  onEditar,
  onDuplicar,
  onEliminar,
  getBorderColor,
  getMargenColor,
  formatearPrecio,
  servicios
}: any) {
  return (
    <Card className={`border-l-4 ${getBorderColor(paquete.salon)}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">{paquete.nombre}</CardTitle>
            <CardDescription className="mt-1">{paquete.descripcion}</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEditar}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDuplicar}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onEliminar}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {paquete.capacidadMinima} - {paquete.capacidadMaxima} personas
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Lista de servicios incluidos */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Servicios incluidos:</p>
          <div className="space-y-1">
            {paquete.serviciosIncluidos.map((si: any) => {
              const servicio = servicios.find((s: any) => s.id === si.servicioId)
              if (!servicio) return null

              return (
                <div key={si.servicioId} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {servicio.nombre} {si.cantidad > 1 ? `x${si.cantidad}` : ''}
                  </span>
                  <div className="flex gap-2">
                    <span className="text-red-600">
                      {formatearPrecio(si.precioInterno * si.cantidad)}
                    </span>
                    <span className="text-green-600">
                      {formatearPrecio(si.precioOficial * si.cantidad)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Totales */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Costo Total:</span>
            <span className="font-semibold text-red-600">
              {formatearPrecio(totales.costoTotal)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Precio Oficial:</span>
            <span className="font-semibold text-green-600">
              {formatearPrecio(totales.precioOficial)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm border-t pt-2">
            <span className="font-semibold">Ganancia:</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-600">
                {formatearPrecio(totales.ganancia)}
              </span>
              <Badge className={getMargenColor(totales.margenPorcentaje)}>
                {totales.margenPorcentaje.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Diálogo para Servicios del Catálogo
function DialogoServicio({
    abierto,
    onCerrar,
    servicio,
    onGuardar
  }: {
    abierto: boolean
    onCerrar: () => void
    servicio: any
    onGuardar: (data: any) => void
  }) {
    const [formData, setFormData] = useState({
      codigo: servicio?.codigo || "",
      nombre: servicio?.nombre || "",
      descripcion: servicio?.descripcion || "",
      categoria: servicio?.categoria || "Salon y Espacio",
      precioInterno: servicio?.precioInterno || 0,
      precioOficial: servicio?.precioOficial || 0,
      unidad: servicio?.unidad || "Fijo",
      proveedor: servicio?.proveedor || "",
      notas: servicio?.notas || "",
      activo: servicio?.activo ?? true
    })

    useEffect(() => {
      if (servicio) {
        setFormData({
          codigo: servicio.codigo || "",
          nombre: servicio.nombre || "",
          descripcion: servicio.descripcion || "",
          categoria: servicio.categoria || "Salon y Espacio",
          precioInterno: servicio.precioInterno || 0,
          precioOficial: servicio.precioOficial || 0,
          unidad: servicio.unidad || "Fijo",
          proveedor: servicio.proveedor || "",
          notas: servicio.notas || "",
          activo: servicio.activo ?? true
        })
      } else {
        setFormData({
          codigo: "",
          nombre: "",
          descripcion: "",
          categoria: "Salon y Espacio",
          precioInterno: 0,
          precioOficial: 0,
          unidad: "Fijo",
          proveedor: "",
          notas: "",
          activo: true
        })
      }
    }, [servicio, abierto])

    const handleGuardar = () => {
      onGuardar(formData)
      onCerrar()
    }

    const ganancia = formData.precioOficial - formData.precioInterno
    const margen = formData.precioInterno > 0
      ? ((ganancia / formData.precioInterno) * 100)
      : 0

    return (
      <Dialog open={abierto} onOpenChange={onCerrar}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {servicio ? "Editar Servicio" : "Agregar Servicio"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Código y Nombre */}
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <Label>Código</Label>
                <Input
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="SRV001"
                />
              </div>
              <div className="col-span-3">
                <Label>Nombre</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre del servicio"
                />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción detallada del servicio"
                rows={3}
              />
            </div>

            {/* Categoría y Unidad */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoría</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Salon y Espacio">Salón y Espacio</SelectItem>
                    <SelectItem value="Fotografia y Video">Fotografía y Video</SelectItem>
                    <SelectItem value="Decoracion">Decoración</SelectItem>
                    <SelectItem value="Entretenimiento">Entretenimiento</SelectItem>
                    <SelectItem value="Pasteleria">Pastelería</SelectItem>
                    <SelectItem value="Transporte">Transporte</SelectItem>
                    <SelectItem value="Papeleria">Papelería</SelectItem>
                    <SelectItem value="Otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidad</Label>
                <Select
                  value={formData.unidad}
                  onValueChange={(value) => setFormData({ ...formData, unidad: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fijo">Fijo</SelectItem>
                    <SelectItem value="Por Persona">Por Persona</SelectItem>
                    <SelectItem value="Por Hora">Por Hora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Precios */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-red-600">Precio Interno (Costo)</Label>
                <Input
                  type="number"
                  value={formData.precioInterno}
                  onChange={(e) => setFormData({ ...formData, precioInterno: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lo que te cuesta realmente
                </p>
              </div>
              <div>
                <Label className="text-green-600">Precio Oficial (Venta)</Label>
                <Input
                  type="number"
                  value={formData.precioOficial}
                  onChange={(e) => setFormData({ ...formData, precioOficial: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lo que cobras al cliente
                </p>
              </div>
            </div>

            {/* Cálculo de Ganancia */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Ganancia</p>
                    <p className="text-lg font-bold text-blue-600">
                      {new Intl.NumberFormat('es-AR', {
                        style: 'currency',
                        currency: 'ARS',
                        minimumFractionDigits: 0
                      }).format(ganancia)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Margen</p>
                    <p className="text-lg font-bold">
                      <Badge className={
                        margen >= 15 ? "bg-green-500" :
                          margen >= 10 ? "bg-yellow-500" :
                            "bg-red-500"
                      }>
                        {margen.toFixed(1)}%
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Factor</p>
                    <p className="text-lg font-bold">
                      {formData.precioInterno > 0
                        ? (formData.precioOficial / formData.precioInterno).toFixed(2)
                        : "0.00"}x
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Proveedor y Notas */}
            <div>
              <Label>Proveedor (Opcional)</Label>
              <Input
                value={formData.proveedor}
                onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                placeholder="Nombre del proveedor"
              />
            </div>

            <div>
              <Label>Notas (Opcional)</Label>
              <Textarea
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Notas adicionales"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar}>
              {servicio ? "Guardar Cambios" : "Agregar Servicio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
}

// Diálogo para Paquetes de Salones
function DialogoPaquete({
    abierto,
    onCerrar,
    paquete,
    servicios,
    onGuardar
  }: {
    abierto: boolean
    onCerrar: () => void
    paquete: any
    servicios: any[]
    onGuardar: (data: any) => void
  }) {
    const [formData, setFormData] = useState({
      salon: paquete?.salon || "Quinta",
      nombre: paquete?.nombre || "",
      descripcion: paquete?.descripcion || "",
      capacidadMinima: paquete?.capacidadMinima || 50,
      capacidadMaxima: paquete?.capacidadMaxima || 100,
      serviciosIncluidos: paquete?.serviciosIncluidos || [],
      activo: paquete?.activo ?? true
    })

    useEffect(() => {
      if (paquete) {
        setFormData({
          salon: paquete.salon || "Quinta",
          nombre: paquete.nombre || "",
          descripcion: paquete.descripcion || "",
          capacidadMinima: paquete.capacidadMinima || 50,
          capacidadMaxima: paquete.capacidadMaxima || 100,
          serviciosIncluidos: paquete.serviciosIncluidos || [],
          activo: paquete.activo ?? true
        })
      } else {
        setFormData({
          salon: paquete?.salon || "Quinta",
          nombre: "",
          descripcion: "",
          capacidadMinima: 50,
          capacidadMaxima: 100,
          serviciosIncluidos: [],
          activo: true
        })
      }
    }, [paquete, abierto])

    const toggleServicio = (servicioId: string) => {
      const existe = formData.serviciosIncluidos.find((s: any) => s.servicioId === servicioId)

      if (existe) {
        // Remover
        setFormData({
          ...formData,
          serviciosIncluidos: formData.serviciosIncluidos.filter((s: any) => s.servicioId !== servicioId)
        })
      } else {
        // Agregar
        const servicio = servicios.find(s => s.id === servicioId)
        if (servicio) {
          setFormData({
            ...formData,
            serviciosIncluidos: [
              ...formData.serviciosIncluidos,
              {
                servicioId: servicio.id,
                nombre: servicio.nombre,
                categoria: servicio.categoria,
                unidad: servicio.unidad,
                cantidad: 1,
                precioInterno: servicio.precioInterno,
                precioOficial: servicio.precioOficial
              }
            ]
          })
        }
      }
    }

    const updateServicioIncluido = (servicioId: string, campo: string, valor: any) => {
      setFormData({
        ...formData,
        serviciosIncluidos: formData.serviciosIncluidos.map((s: any) =>
          s.servicioId === servicioId ? { ...s, [campo]: valor } : s
        )
      })
    }

    const handleGuardar = () => {
      // Calcular totales
      const costoTotal = formData.serviciosIncluidos.reduce(
        (sum: number, si: any) => sum + (si.precioInterno * si.cantidad),
        0
      )
      const precioOficial = formData.serviciosIncluidos.reduce(
        (sum: number, si: any) => sum + (si.precioOficial * si.cantidad),
        0
      )
      const ganancia = precioOficial - costoTotal

      const paqueteCompleto = {
        ...formData,
        costoTotal,
        precioOficial,
        ganancia
      }

      onGuardar(paqueteCompleto)
      onCerrar()
    }

    // Calcular totales en tiempo real
    const totales = calcularTotalesPaquete(formData.serviciosIncluidos)

    const formatearPrecio = (precio: number) => {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
      }).format(precio)
    }

    const serviciosPorCategoria = servicios
      .filter(s => s.activo)
      .reduce((acc: any, servicio: any) => {
        if (!acc[servicio.categoria]) {
          acc[servicio.categoria] = []
        }
        acc[servicio.categoria].push(servicio)
        return acc
      }, {})

    return (
      <Dialog open={abierto} onOpenChange={onCerrar}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {paquete?.id ? "Editar Paquete" : "Crear Paquete"} - {formData.salon}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Información Básica */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Información Básica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nombre del Paquete</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Paquete Premium 100 personas"
                  />
                </div>

                <div>
                  <Label>Descripción</Label>
                  <Textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Descripción del paquete"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Capacidad Mínima</Label>
                    <Input
                      type="number"
                      value={formData.capacidadMinima}
                      onChange={(e) => setFormData({ ...formData, capacidadMinima: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Capacidad Máxima</Label>
                    <Input
                      type="number"
                      value={formData.capacidadMaxima}
                      onChange={(e) => setFormData({ ...formData, capacidadMaxima: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Selector de Servicios */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Servicios Incluidos</CardTitle>
                <CardDescription>
                  Selecciona los servicios y ajusta cantidades y precios
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(serviciosPorCategoria).map(([categoria, serviciosCategoria]: [string, any]) => (
                  <div key={categoria} className="space-y-2">
                    <h4 className="font-semibold text-sm border-b pb-1">{categoria}</h4>
                    <div className="space-y-2">
                      {serviciosCategoria.map((servicio: any) => {
                        const servicioIncluido = formData.serviciosIncluidos.find(
                          (s: any) => s.servicioId === servicio.id
                        )
                        const estaSeleccionado = !!servicioIncluido

                        return (
                          <div key={servicio.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={estaSeleccionado}
                                onCheckedChange={() => toggleServicio(servicio.id)}
                              />
                              <div className="flex-1">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-sm">{servicio.nombre}</p>
                                    <p className="text-xs text-muted-foreground">{servicio.descripcion}</p>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {servicio.codigo}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            {estaSeleccionado && (
                              <div className="ml-7 grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-xs">Cantidad</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={servicioIncluido.cantidad}
                                    onChange={(e) => updateServicioIncluido(
                                      servicio.id,
                                      'cantidad',
                                      parseInt(e.target.value) || 1
                                    )}
                                    className="h-8"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-red-600">P. Interno</Label>
                                  <Input
                                    type="number"
                                    value={servicioIncluido.precioInterno}
                                    onChange={(e) => updateServicioIncluido(
                                      servicio.id,
                                      'precioInterno',
                                      parseFloat(e.target.value) || 0
                                    )}
                                    className="h-8"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-green-600">P. Oficial</Label>
                                  <Input
                                    type="number"
                                    value={servicioIncluido.precioOficial}
                                    onChange={(e) => updateServicioIncluido(
                                      servicio.id,
                                      'precioOficial',
                                      parseFloat(e.target.value) || 0
                                    )}
                                    className="h-8"
                                  />
                                </div>
                              </div>
                            )}

                            {estaSeleccionado && (
                              <div className="ml-7 flex justify-between text-xs">
                                <span className="text-muted-foreground">Subtotal:</span>
                                <div className="flex gap-3">
                                  <span className="text-red-600">
                                    {formatearPrecio(servicioIncluido.precioInterno * servicioIncluido.cantidad)}
                                  </span>
                                  <span className="text-green-600">
                                    {formatearPrecio(servicioIncluido.precioOficial * servicioIncluido.cantidad)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {servicios.filter(s => s.activo).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No hay servicios disponibles en el catálogo</p>
                    <p className="text-xs">Crea servicios primero en la pestaña Catálogo</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Totales */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
              <CardHeader>
                <CardTitle className="text-lg">Resumen Financiero</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Costo Total:</span>
                  <span className="text-lg font-bold text-red-600">
                    {formatearPrecio(totales.costoTotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Precio Oficial:</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatearPrecio(totales.precioOficial)}
                  </span>
                </div>
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="font-semibold">Ganancia Estimada:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-blue-600">
                      {formatearPrecio(totales.ganancia)}
                    </span>
                    <Badge className={
                      totales.margenPorcentaje >= 15 ? "bg-green-500" :
                        totales.margenPorcentaje >= 10 ? "bg-yellow-500" :
                          "bg-red-500"
                    }>
                      {totales.margenPorcentaje.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              onClick={handleGuardar}
              disabled={!formData.nombre || formData.serviciosIncluidos.length === 0}
            >
              {paquete?.id ? "Guardar Cambios" : "Crear Paquete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
}


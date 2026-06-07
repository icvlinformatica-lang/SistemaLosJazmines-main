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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
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
    deleteServicio,
  } = useStore()

  const [tabActual, setTabActual] = useState<"quinta" | "casona" | "salon" | "salon4" | "salon5" | "catalogo">("quinta")
  const [dialogoPaqueteAbierto, setDialogoPaqueteAbierto] = useState(false)
  const [dialogoCatalogoAbierto, setDialogoCatalogoAbierto] = useState(false)
  const [paqueteEditando, setPaqueteEditando] = useState<any>(null)
  const [servicioEditando, setServicioEditando] = useState<any>(null)

  // Filtrar paquetes por salón
  const paquetesQuinta = paquetesSalones.filter(p => p.salon === "Quinta" && p.activo)
  const paquetesCasona = paquetesSalones.filter(p => p.salon === "Casona" && p.activo)
  const paquetesSalon = paquetesSalones.filter(p => p.salon === "Salon" && p.activo)
  const paquetesSalon4 = paquetesSalones.filter(p => p.salon === "Salon 4" && p.activo)
  const paquetesSalon5 = paquetesSalones.filter(p => p.salon === "Salon 5" && p.activo)

  // Función para obtener color del border según salón
  const getBorderColor = (salon: string) => {
    switch (salon) {
      case "Quinta": return "border-l-emerald-500"
      case "Casona": return "border-l-sky-500"
      case "Salon": return "border-l-amber-500"
      case "Salon 4": return "border-l-violet-500"
      case "Salon 5": return "border-l-rose-500"
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
        <TabsList className="grid w-full grid-cols-6">
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
          <TabsTrigger value="salon4" className="gap-2">
            <Package className="h-4 w-4" />
            Salón 4 ({paquetesSalon4.length})
          </TabsTrigger>
          <TabsTrigger value="salon5" className="gap-2">
            <Package className="h-4 w-4" />
            Salón 5 ({paquetesSalon5.length})
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

        {/* Tab Salón 4 */}
        <TabsContent value="salon4" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Paquetes - Salón 4</h2>
            <Button onClick={() => {
              setPaqueteEditando({ salon: "Salon 4" })
              setDialogoPaqueteAbierto(true)
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Paquete
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paquetesSalon4.map((paquete) => {
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

          {paquetesSalon4.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No hay paquetes creados para Salón 4</p>
                <Button onClick={() => {
                  setPaqueteEditando({ salon: "Salon 4" })
                  setDialogoPaqueteAbierto(true)
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primer Paquete
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Salón 5 */}
        <TabsContent value="salon5" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Paquetes - Salón 5</h2>
            <Button onClick={() => {
              setPaqueteEditando({ salon: "Salon 5" })
              setDialogoPaqueteAbierto(true)
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Paquete
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paquetesSalon5.map((paquete) => {
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

          {paquetesSalon5.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No hay paquetes creados para Salón 5</p>
                <Button onClick={() => {
                  setPaqueteEditando({ salon: "Salon 5" })
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
                      <th className="px-4 py-3 text-right text-sm font-semibold text-rose-600">Costo</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-emerald-600">Precio</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">% Seña</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Seña $</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Días seña</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {servicios.filter(s => s.activo).map((servicio) => {
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
                          <td className="px-4 py-3 text-right text-rose-600 font-semibold">
                            {formatearPrecio(servicio.costoParaCajaEventos ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                            {formatearPrecio(servicio.precioVenta ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              {servicio.porcentajeSeña ?? 30}%
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-amber-700">
                            {formatearPrecio((servicio.precioVenta ?? 0) * (servicio.porcentajeSeña ?? 30) / 100)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                            {servicio.diasAnticipacionSeña ?? 30}d
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
      margenGanancia: servicio?.margenGanancia ?? 0,
      costoParaCajaEventos: servicio?.costoParaCajaEventos ?? 0,
      precioVenta: servicio?.precioVenta ?? 0,
      porcentajeSeña: servicio?.porcentajeSeña ?? 30,
      diasAnticipacionSeña: servicio?.diasAnticipacionSeña ?? 30,
      diasAnticipacionSaldo: servicio?.diasAnticipacionSaldo ?? 7,
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
          margenGanancia: servicio.margenGanancia ?? 0,
          costoParaCajaEventos: servicio.costoParaCajaEventos ?? 0,
          precioVenta: servicio.precioVenta ?? 0,
          porcentajeSeña: servicio.porcentajeSeña ?? 30,
          diasAnticipacionSeña: servicio.diasAnticipacionSeña ?? 30,
          diasAnticipacionSaldo: servicio.diasAnticipacionSaldo ?? 7,
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
          margenGanancia: 0,
          costoParaCajaEventos: 0,
          precioVenta: 0,
          porcentajeSeña: 30,
          diasAnticipacionSeña: 30,
          diasAnticipacionSaldo: 7,
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

    // Cálculos derivados
    const montoSeña = formData.precioVenta * formData.porcentajeSeña / 100
    const montoSaldo = formData.precioVenta - montoSeña

    return (
      <Dialog open={abierto} onOpenChange={onCerrar}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {servicio ? "Editar Servicio" : "Agregar Servicio"}
            </DialogTitle>
            <DialogDescription>
              {servicio ? "Modifica los datos del servicio existente." : "Completa los datos para registrar un nuevo servicio."}
            </DialogDescription>
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

            {/* Costo y Precio */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Costo para el salón ($)</Label>
                <Input
                  type="number"
                  value={formData.costoParaCajaEventos || ""}
                  onChange={(e) => setFormData({ ...formData, costoParaCajaEventos: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">Impacta como egreso en Caja Eventos</p>
              </div>
              <div>
                <Label>Precio al cliente ($)</Label>
                <Input
                  type="number"
                  value={formData.precioVenta || ""}
                  onChange={(e) => setFormData({ ...formData, precioVenta: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">Figura en el contrato del evento</p>
              </div>
            </div>

            {/* % Seña con preview */}
            <div>
              <Label>% de seña al proveedor</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                value={formData.porcentajeSeña}
                onChange={(e) => setFormData({ ...formData, porcentajeSeña: parseFloat(e.target.value) || 0 })}
                placeholder="30"
              />
              {formData.precioVenta > 0 && (
                <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
                  <span>
                    Seña:{" "}
                    <span className="font-semibold text-amber-600">
                      {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(montoSeña)}
                    </span>
                  </span>
                  <span>
                    Saldo:{" "}
                    <span className="font-semibold text-orange-600">
                      {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(montoSaldo)}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Días anticipación */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Días para pagar la seña (antes del evento)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.diasAnticipacionSeña}
                  onChange={(e) => setFormData({ ...formData, diasAnticipacionSeña: parseInt(e.target.value) || 0 })}
                  placeholder="30"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ej: 30 → la seña vence 30 días antes del evento
                </p>
              </div>
              <div>
                <Label>Días para pagar el saldo (antes del evento)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.diasAnticipacionSaldo}
                  onChange={(e) => setFormData({ ...formData, diasAnticipacionSaldo: parseInt(e.target.value) || 0 })}
                  placeholder="7"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ej: 7 → el saldo vence 7 días antes del evento
                </p>
              </div>
            </div>

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
    const { state } = useStore()
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
        const servicio = servicios.find((s: any) => s.id === servicioId)
        if (servicio) {
          const { precioInterno, precioOficial } = obtenerPreciosServicio(servicio, state)
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
                precioInterno,
                precioOficial
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
      // Guardar usando los totales calculados dinamicamente
      const paqueteCompleto = {
        ...formData,
        costoTotal: totales.costoTotal,
        precioOficial: totales.ventaTotal,
        ganancia: totales.ganancia,
      }

      onGuardar(paqueteCompleto)
      onCerrar()
    }

    // Calcular totales en tiempo real usando precios dinamicos
    const totales = (() => {
      let costoTotal = 0
      let ventaTotal = 0
      formData.serviciosIncluidos.forEach((si: any) => {
        const srv = servicios.find((s: any) => s.id === si.servicioId)
        if (srv) {
          const { precioInterno, precioOficial } = obtenerPreciosServicio(srv, state)
          costoTotal += precioInterno * si.cantidad
          ventaTotal += precioOficial * si.cantidad
        }
      })
      const ganancia = ventaTotal - costoTotal
      const margenPorcentaje = costoTotal > 0 ? (ganancia / costoTotal) * 100 : 0
      return { costoTotal, ventaTotal, ganancia, margenPorcentaje }
    })()

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
            <DialogDescription>
              {paquete?.id ? "Modifica los datos del paquete existente." : "Configura los servicios y precios del nuevo paquete."}
            </DialogDescription>
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

                        const personalVinculado = state.personal.filter(
                          (p: any) => p.activo && p.servicioVinculadoId === servicio.id
                        )
                        const { precioInterno: piDynamic, precioOficial: poDynamic } = obtenerPreciosServicio(servicio, state)

                        return (
                          <div key={servicio.id} className={`border rounded-lg p-3 space-y-2 ${estaSeleccionado ? "border-primary/50 bg-primary/5" : ""}`}>
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
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {servicio.codigo}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Personal vinculado - siempre visible */}
                                {personalVinculado.length > 0 ? (
                                  <div className="mt-2 space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">Personal vinculado:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {personalVinculado.map((p: any) => (
                                        <span
                                          key={p.id}
                                          className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full"
                                        >
                                          <span className="font-medium">{p.nombre} {p.apellido}</span>
                                          <span className="text-muted-foreground">({p.funcion})</span>
                                          <span className="text-primary font-semibold">{formatearPrecio(p.tarifaBase)}</span>
                                        </span>
                                      ))}
                                    </div>
                                    <div className="flex gap-4 text-xs mt-1">
                                      <span className="text-red-600">
                                        Costo: <span className="font-semibold">{formatearPrecio(piDynamic)}</span>
                                      </span>
                                      <span className="text-green-600">
                                        Venta: <span className="font-semibold">{formatearPrecio(poDynamic)}</span>
                                      </span>
                                      <span className="text-muted-foreground">
                                        Margen: {servicio.margenGanancia}%
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-amber-600 mt-1">
                                    Sin personal vinculado - asigna personal desde la seccion Personal
                                  </p>
                                )}
                              </div>
                            </div>

                            {estaSeleccionado && (
                              <div className="ml-7 flex items-end gap-3">
                                <div className="w-20">
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
                                <div className="flex-1 flex justify-between items-center text-sm">
                                  <span className="text-muted-foreground">Venta:</span>
                                  <span className="font-semibold text-green-600">
                                    {formatearPrecio(poDynamic * servicioIncluido.cantidad)}
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
                <CardTitle className="text-lg">Resumen del Paquete</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Costo (personal):</span>
                  <span className="text-lg font-bold text-red-600">
                    {formatearPrecio(totales.costoTotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Venta (con margen):</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatearPrecio(totales.ventaTotal)}
                  </span>
                </div>
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="font-semibold">Ganancia:</span>
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


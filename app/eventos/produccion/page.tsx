"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import { useEventos } from "@/lib/use-eventos"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
} from "@/components/ui/dialog"
import {
  Calendar as CalendarIcon,
  Users,
  Building2,
  Search,
  ClipboardList,
  ChefHat,
  Eye,
  Utensils,
  Printer,
} from "lucide-react"
import { calcularComprasSegmentadas, type EventoGuardado } from "@/lib/store"

const estadoConfig: Record<string, { label: string; className: string }> = {
  borrador: {
    label: "Borrador",
    className: "bg-slate-100 text-slate-600 border-slate-300",
  },
  confirmado: {
    label: "Confirmado",
    className: "bg-emerald-100 text-emerald-700 border-emerald-300",
  },
  en_preparacion: {
    label: "En Preparacion",
    className: "bg-amber-100 text-amber-700 border-amber-300",
  },
  finalizado: {
    label: "Finalizado",
    className: "bg-sky-100 text-sky-700 border-sky-300",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-red-100 text-red-600 border-red-300",
  },
}

export default function ProduccionPage() {
  const { state } = useStore()
  const { eventos, loading } = useEventos()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEvento, setSelectedEvento] = useState<EventoGuardado | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Filtrar eventos que tienen recetas (tienen guía de producción)
  const eventosConRecetas = useMemo(() => {
    return eventos.filter((e) => {
      const tieneRecetas =
        (e.recetasAdultos?.length || 0) > 0 ||
        (e.recetasAdolescentes?.length || 0) > 0 ||
        (e.recetasNinos?.length || 0) > 0 ||
        (e.recetasDietasEspeciales?.length || 0) > 0
      return tieneRecetas
    })
  }, [eventos])

  // Filtrar por búsqueda
  const eventosFiltrados = useMemo(() => {
    if (!searchQuery.trim()) return eventosConRecetas
    const q = searchQuery.toLowerCase()
    return eventosConRecetas.filter(
      (e) =>
        (e.nombrePareja || e.nombre || "").toLowerCase().includes(q) ||
        (e.tipoEvento || "").toLowerCase().includes(q)
    )
  }, [eventosConRecetas, searchQuery])

  const formatFecha = (fecha: string) => {
    if (!fecha) return "-"
    const d = new Date(fecha + "T12:00:00")
    return d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const getTotalInvitados = (e: EventoGuardado) =>
    (e.adultos || 0) + (e.adolescentes || 0) + (e.ninos || 0) + (e.personasDietasEspeciales || 0)

  const handleVerGuia = (evento: EventoGuardado) => {
    setSelectedEvento(evento)
    setDialogOpen(true)
  }

  // Obtener recetas del evento seleccionado
  const getRecetasEvento = () => {
    if (!selectedEvento) return []
    const recetasIds = [
      ...(selectedEvento.recetasAdultos || []),
      ...(selectedEvento.recetasAdolescentes || []),
      ...(selectedEvento.recetasNinos || []),
      ...(selectedEvento.recetasDietasEspeciales || []),
    ]
    const uniqueIds = [...new Set(recetasIds)]
    return uniqueIds
      .map((id) => state.recetas.find((r) => r.id === id))
      .filter(Boolean)
  }

  // Calcular compras para el evento seleccionado
  const getComprasEvento = () => {
    if (!selectedEvento) return null
    return calcularComprasSegmentadas(selectedEvento, state.recetas, state.insumos, state.cocteles, state.insumosBarra)
  }

  const handleImprimir = () => {
    if (!selectedEvento) return
    window.print()
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Cargando eventos...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-orange-500" />
            Guias de Produccion
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vista de solo lectura de las guias de preparacion de cada evento
          </p>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar evento..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista de eventos */}
      {eventosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-medium text-foreground">
              {searchQuery ? "No se encontraron eventos" : "No hay eventos con recetas"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? "Intenta con otro termino de busqueda."
                : "Los eventos apareceran aqui cuando tengan recetas asignadas."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Evento</TableHead>
                  <TableHead className="min-w-[100px]">Fecha</TableHead>
                  <TableHead className="min-w-[90px]">Salon</TableHead>
                  <TableHead className="min-w-[80px] text-center">Invitados</TableHead>
                  <TableHead className="min-w-[110px]">Estado</TableHead>
                  <TableHead className="min-w-[80px] text-right">Guia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventosFiltrados.map((evento) => {
                  const config = estadoConfig[evento.estado] || estadoConfig.borrador
                  const totalInvitados = getTotalInvitados(evento)
                  const displayName = evento.nombrePareja || evento.nombre || "Sin nombre"
                  return (
                    <TableRow key={evento.id} className="group">
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground truncate max-w-[200px]">
                            {displayName}
                          </p>
                          {evento.tipoEvento && (
                            <p className="text-xs text-muted-foreground">{evento.tipoEvento}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatFecha(evento.fecha)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{evento.salon || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{totalInvitados}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleVerGuia(evento)}
                        >
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Dialog de guía de producción */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-orange-500" />
              Guia de Produccion - {selectedEvento?.nombrePareja || selectedEvento?.nombre}
            </DialogTitle>
          </DialogHeader>

          {selectedEvento && (
            <div className="space-y-6 print:space-y-4">
              {/* Info del evento */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-medium">{formatFecha(selectedEvento.fecha)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Salon</p>
                  <p className="font-medium">{selectedEvento.salon || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Invitados</p>
                  <p className="font-medium">{getTotalInvitados(selectedEvento)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="font-medium">{selectedEvento.tipoEvento || "-"}</p>
                </div>
              </div>

              {/* Recetas a preparar */}
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-muted-foreground" />
                  Recetas a Preparar
                </h3>
                <div className="space-y-3">
                  {getRecetasEvento().map((receta: any) => (
                    <Card key={receta.id} className="overflow-hidden">
                      <CardHeader className="py-3 px-4 bg-muted/30">
                        <CardTitle className="text-base font-medium">{receta.nombre}</CardTitle>
                      </CardHeader>
                      <CardContent className="py-3 px-4">
                        <p className="text-sm text-muted-foreground mb-2">
                          Porciones base: {receta.porcionesBase}
                        </p>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Ingredientes:
                          </p>
                          <ul className="text-sm space-y-0.5">
                            {receta.insumos?.map((ing: any, idx: number) => {
                              const insumo = state.insumos.find((i) => i.id === ing.insumoId)
                              return (
                                <li key={idx} className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                  {insumo?.descripcion || "Insumo"} - {ing.cantidad} {insumo?.unidad || ""}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                        {receta.instrucciones && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                              Instrucciones:
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{receta.instrucciones}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Lista de compras cocina */}
              {(() => {
                const compras = getComprasEvento()
                if (!compras || compras.compras.length === 0) return null
                return (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-muted-foreground" />
                      Insumos Necesarios (Cocina)
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Insumo</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compras.compras.map((item) => (
                          <TableRow key={item.insumoId}>
                            <TableCell>{item.insumo?.descripcion}</TableCell>
                            <TableCell className="text-right font-mono">
                              {item.cantidadNecesaria.toFixed(2)} {item.insumo?.unidad}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              })()}

              {/* Botón imprimir */}
              <div className="flex justify-end pt-4 border-t print:hidden">
                <Button variant="outline" className="gap-2" onClick={handleImprimir}>
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

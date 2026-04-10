"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store-context"
import { useEventos } from "@/lib/use-eventos"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
  Users,
  Building2,
  Search,
  ClipboardList,
  ChefHat,
  Eye,
  Printer,
} from "lucide-react"
import { type EventoGuardado } from "@/lib/store"

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

  // Construir allDishes igual que print-utils para el mise en place
  const getAllDishes = (evento: EventoGuardado) => {
    const recetasAdultosSeleccionadas = state.recetas.filter((r) => (evento.recetasAdultos || []).includes(r.id))
    const recetasAdolescentesSeleccionadas = state.recetas.filter((r) => (evento.recetasAdolescentes || []).includes(r.id))
    const recetasNinosSeleccionadas = state.recetas.filter((r) => (evento.recetasNinos || []).includes(r.id))
    const recetasDietasEspecialesSeleccionadas = state.recetas.filter((r) => (evento.recetasDietasEspeciales || []).includes(r.id))
    return [
      ...recetasAdultosSeleccionadas.map((r) => ({
        receta: r,
        multiplier: (evento.multipliersAdultos || {})[r.id] || 1,
        pax: evento.adultos || 0,
        segment: "Adultos",
      })),
      ...recetasAdolescentesSeleccionadas.map((r) => ({
        receta: r,
        multiplier: (evento.multipliersAdolescentes || {})[r.id] || 1,
        pax: evento.adolescentes || 0,
        segment: "Adolescentes",
      })),
      ...recetasNinosSeleccionadas.map((r) => ({
        receta: r,
        multiplier: (evento.multipliersNinos || {})[r.id] || 1,
        pax: evento.ninos || 0,
        segment: "Ninos",
      })),
      ...recetasDietasEspecialesSeleccionadas.map((r) => ({
        receta: r,
        multiplier: (evento.multipliersDietasEspeciales || {})[r.id] || 1,
        pax: evento.personasDietasEspeciales || 0,
        segment: "Dietas Especiales",
      })),
    ]
  }

  const smartUnits = (amount: number, unit: string) => {
    const u = unit.toUpperCase()
    if ((u === "GR" || u === "GRS") && amount >= 1000) return `${(amount / 1000).toFixed(2)} KG`
    if (u === "GR" || u === "GRS") return `${Math.round(amount)} GRS`
    if ((u === "CC" || u === "ML") && amount >= 1000) return `${(amount / 1000).toFixed(2)} L`
    if (u === "CC" || u === "ML") return `${Math.round(amount)} CC`
    if (u === "KG" && amount < 1) return `${Math.round(amount * 1000)} GRS`
    if (u === "KG") return `${amount.toFixed(2)} KG`
    if (u === "L" && amount < 1) return `${Math.round(amount * 1000)} CC`
    if (u === "L") return `${amount.toFixed(2)} L`
    return `${amount.toFixed(1)} ${unit}`
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

      {/* Dialog guia de produccion - mise en place */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ChefHat className="h-5 w-5" />
              Guia de Produccion - Mise en Place
            </DialogTitle>
          </DialogHeader>

          {selectedEvento && (() => {
            const dishes = getAllDishes(selectedEvento)
            const totalPersonas = getTotalInvitados(selectedEvento)
            return (
              <div className="space-y-0 font-sans text-black">
                {/* Encabezado estilo imprimible */}
                <div className="text-right text-xs text-gray-500 mb-2">
                  Total: {totalPersonas} personas
                </div>
                <div className="border-2 border-black text-center py-2 mb-3">
                  <p className="font-bold text-sm tracking-wide">GUIA DE PRODUCCION - MISE EN PLACE</p>
                  <p className="text-xs mt-0.5">
                    {selectedEvento.nombrePareja || selectedEvento.nombre}
                    {selectedEvento.fecha ? ` | ${new Date(selectedEvento.fecha + "T12:00:00").toLocaleDateString("es-AR")}` : ""}
                    {" | "}{totalPersonas} personas
                  </p>
                </div>

                {dishes.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 py-10">
                    Este evento no tiene recetas asignadas.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dishes.map((dish, di) => (
                      <div key={di} className="border border-gray-300">
                        {/* Header de la receta - fondo oscuro */}
                        <div className="bg-[#3a3a3a] text-white px-3 py-2 flex justify-between items-center">
                          <span className="font-bold text-sm">
                            {dish.receta.nombre}
                            {dish.multiplier !== 1 && (
                              <span className="ml-2 font-normal text-xs opacity-80">
                                (x{dish.multiplier % 1 === 0 ? dish.multiplier : dish.multiplier.toFixed(1)} un/persona)
                              </span>
                            )}
                          </span>
                          <span className="text-xs opacity-80">{dish.segment} - {dish.pax} pax</span>
                        </div>

                        {/* Tabla de ingredientes */}
                        {(!dish.receta.insumos || dish.receta.insumos.length === 0) ? (
                          <div className="px-3 py-2 text-xs text-gray-500 italic">Sin ingredientes cargados</div>
                        ) : (
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="text-left px-2 py-1.5 border border-gray-300 font-semibold uppercase text-[10px]">Ingrediente</th>
                                <th className="text-right px-2 py-1.5 border border-gray-300 font-semibold uppercase text-[10px] w-24">Por Plato</th>
                                <th className="text-right px-2 py-1.5 border border-gray-300 font-semibold uppercase text-[10px] w-28">Cantidad Total</th>
                                <th className="text-left px-2 py-1.5 border border-gray-300 font-semibold uppercase text-[10px]">Mise en Place</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dish.receta.insumos.map((ing: any, idx: number) => {
                                const insumo = state.insumos.find((i) => i.id === ing.insumoId)
                                if (!insumo) return null
                                const inputUnit = ing.unidadReceta || insumo.unidad
                                const cantidadPorPlato = ing.cantidadBasePorPersona
                                const cantidadTotal = cantidadPorPlato * dish.pax * dish.multiplier
                                return (
                                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                    <td className="px-2 py-1.5 border border-gray-200 font-medium">{insumo.descripcion}</td>
                                    <td className="px-2 py-1.5 border border-gray-200 text-right font-mono">{cantidadPorPlato} {inputUnit}</td>
                                    <td className="px-2 py-1.5 border border-gray-200 text-right font-mono font-bold">{smartUnits(cantidadTotal, inputUnit)}</td>
                                    <td className="px-2 py-1.5 border border-gray-200 text-gray-700">{ing.detalleCorte || "-"}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Botón imprimir */}
                <div className="flex justify-end pt-4 border-t mt-4">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

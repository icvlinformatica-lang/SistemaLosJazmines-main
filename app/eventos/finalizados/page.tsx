"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEventos } from "@/lib/use-eventos"
import { SALONES } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import {
  Eye,
  Trash2,
  MoreVertical,
  CheckCircle,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Calculator,
  FileText,
  User,
} from "lucide-react"

export default function EventosFinalizadosPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { eventos, actualizarEvento, eliminarEvento } = useEventos()

  const [searchQuery, setSearchQuery] = useState("")
  const [filtroSalon, setFiltroSalon] = useState<string>("todos")
  const [ordenFecha, setOrdenFecha] = useState<"asc" | "desc">("desc")

  // Filtrar solo eventos finalizados
  const eventosFiltrados = (eventos || [])
    .filter((e) => e.estado === "completado")
    .filter((e) => {
      const matchesSearch =
        !searchQuery ||
        (e.nombre || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.nombrePareja || "").toLowerCase().includes(searchQuery.toLowerCase())
      const matchesSalon = filtroSalon === "todos" || e.salon === filtroSalon
      return matchesSearch && matchesSalon
    })
    .sort((a, b) => {
      if (!a.fecha) return 1
      if (!b.fecha) return -1
      const cmp = a.fecha.localeCompare(b.fecha)
      return ordenFecha === "asc" ? cmp : -cmp
    })

  const handleReactivar = async (eventoId: string) => {
    try {
      await actualizarEvento(eventoId, { estado: "en_preparacion" })
      toast({ 
        title: "Evento sacado del archivo", 
        description: "El evento volvió a En Preparación: sus costos y datos vuelven a actualizarse en vivo." 
      })
      router.push("/eventos/lista")
    } catch (error) {
      toast({ 
        title: "Error al reactivar", 
        description: "No se pudo reactivar el evento. Intenta nuevamente.",
        variant: "destructive" 
      })
    }
  }

  const handleEliminar = async (eventoId: string) => {
    if (confirm("¿Eliminar este evento? Esta acción no se puede deshacer.")) {
      await eliminarEvento(eventoId)
      toast({ title: "Evento eliminado", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Archivo</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {eventosFiltrados.length} evento{eventosFiltrados.length !== 1 ? "s" : ""} archivado{eventosFiltrados.length !== 1 ? "s" : ""} — los datos quedan congelados hasta sacarlos del archivo
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/eventos/lista")}>
            Volver a Lista
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por nombre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={filtroSalon} onValueChange={setFiltroSalon}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Salón" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los salones</SelectItem>
                  {SALONES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card>
          <CardHeader>
            <CardTitle>Eventos archivados</CardTitle>
          </CardHeader>
          <CardContent>
            {eventosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No hay eventos en el archivo</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead className="min-w-[100px]">
                        <button
                          type="button"
                          onClick={() => setOrdenFecha((o) => o === "asc" ? "desc" : "asc")}
                          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Fecha
                          {ordenFecha === "asc"
                            ? <ArrowUp className="h-3 w-3" />
                            : <ArrowDown className="h-3 w-3" />
                          }
                        </button>
                      </TableHead>
                      <TableHead>Salón</TableHead>
                      <TableHead>Acciones</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventosFiltrados.map((evento) => {
                      return (
                        <TableRow key={evento.id} className="opacity-75">
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-sm">{evento.nombre}</span>
                              {evento.nombrePareja && (
                                <span className="text-xs text-muted-foreground">{evento.nombrePareja}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{evento.fecha || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {evento.salon || "Sin salón"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 bg-transparent px-2 text-xs"
                              >
                                <Link href={`/eventos/costos?id=${evento.id}`}>
                                  <Calculator className="h-3.5 w-3.5" />
                                  Costos del evento
                                </Link>
                              </Button>
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 bg-transparent px-2 text-xs"
                              >
                                <Link href={`/eventos/contratos?eventoId=${evento.id}`}>
                                  <FileText className="h-3.5 w-3.5" />
                                  Contrato
                                </Link>
                              </Button>
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 bg-transparent px-2 text-xs"
                              >
                                <Link href={`/eventos/pagos?evento=${evento.id}`}>
                                  <User className="h-3.5 w-3.5" />
                                  Perfil del evento
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/evento?id=${evento.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver Detalles
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleReactivar(evento.id)}
                                  className="text-sky-600 focus:text-sky-600"
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Sacar del archivo
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleEliminar(evento.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

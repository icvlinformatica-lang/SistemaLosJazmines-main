"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEventos } from "@/lib/use-eventos"
import { salonLabel } from "@/lib/store"
import { fechaEventoCorta } from "@/lib/fecha-evento"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { useToast } from "@/hooks/use-toast"
import {
  Eye,
  Trash2,
  MoreVertical,
  CheckCircle,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Calculator,
  FileText,
  User,
  RefreshCw,
  Archive,
} from "lucide-react"
import { SalonSelectorOverlay } from "@/components/salon-selector-overlay"
import { SalonDot } from "@/components/salon-badge"
import { EventosEliminados } from "@/components/eventos-eliminados"

// Eventos → Finalizados (antes "Archivo"). Desde el 27/10/2026 junta en una
// sola pantalla los finalizados y los eliminados (la vieja Papelera), pedido
// del dueño: "no quiero dos sectores de eventos". Cada pestaña tiene su
// propio camino: los finalizados salen del store; los eliminados, de
// /api/eventos/papelera (solo Administración y Soporte, como siempre).
type Pestana = "finalizados" | "eliminados"

export default function EventosFinalizadosPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { eventos, actualizarEvento, eliminarEvento } = useEventos()

  const [searchQuery, setSearchQuery] = useState("")
  const [filtroSalon, setFiltroSalon] = useState<string>("todos")
  const [ordenFecha, setOrdenFecha] = useState<"asc" | "desc">("desc")
  // Selector de salón estilo perfiles al entrar a la página
  const [selectorAbierto, setSelectorAbierto] = useState(true)
  // Evento que se está por sacar del archivo (pide confirmación: sus costos
  // dejan de estar congelados).
  const [eventoASacarId, setEventoASacarId] = useState<string | null>(null)
  const [pestana, setPestana] = useState<Pestana>("finalizados")
  const [cantidadEliminados, setCantidadEliminados] = useState<number | null>(null)
  const alContarEliminados = useCallback((n: number) => setCantidadEliminados(n), [])
  // /eventos/papelera redirige con ?ver=eliminados. Se lee de la dirección
  // (sin useSearchParams, que en esta página obligaría a un Suspense).
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("ver") === "eliminados") setPestana("eliminados")
    } catch {
      // Sin dirección legible: queda en Finalizados.
    }
  }, [])

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
        title: "Evento sacado de Finalizados", 
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
    if (confirm("¿Eliminar este evento? Pasa a la pestaña Eliminados de esta misma pantalla, de donde se puede restaurar.")) {
      await eliminarEvento(eventoId)
      toast({ title: "Evento eliminado", variant: "destructive" })
    }
  }

  // Selector de salón estilo perfiles al entrar
  if (selectorAbierto) {
    return (
      <SalonSelectorOverlay
        titulo="Finalizados"
        onSelect={(salon) => {
          setFiltroSalon(salon)
          setSelectorAbierto(false)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Finalizados</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Los eventos que ya se hicieron y los que se eliminaron, en un solo lugar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-700">
              Cambiar salón
              <ArrowRight className="h-4 w-4 animate-pulse" aria-hidden="true" />
            </span>
            <button
              type="button"
              onClick={() => setSelectorAbierto(true)}
              className="group flex h-9 items-center gap-2 rounded-full border border-input bg-background pl-3 pr-4 text-sm font-medium shadow-sm transition-colors hover:border-purple-400 hover:bg-purple-50"
              aria-label="Cambiar salón: volver al selector de salones"
            >
              <RefreshCw
                className="h-4 w-4 text-purple-700 transition-transform duration-500 group-hover:rotate-180"
                aria-hidden="true"
              />
              {filtroSalon === "todos" ? (
                <span>Todos los salones</span>
              ) : (
                <span className="flex items-center gap-2">
                  <SalonDot salon={filtroSalon} size={8} />
                  {salonLabel(filtroSalon)}
                </span>
              )}
            </button>
            <Button variant="outline" onClick={() => router.push("/eventos/lista")}>
              Volver a Lista
            </Button>
          </div>
        </div>

        {/* Pestañas: finalizados y eliminados */}
        <div role="tablist" aria-label="Qué eventos ver" className="flex gap-2">
          {([
            { valor: "finalizados", label: "Finalizados", icono: Archive, cantidad: eventosFiltrados.length },
            { valor: "eliminados", label: "Eliminados", icono: Trash2, cantidad: cantidadEliminados },
          ] as const).map(({ valor, label, icono: Icono, cantidad }) => {
            const activa = pestana === valor
            return (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => setPestana(valor)}
                className={`flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
                  activa ? "border-foreground bg-foreground text-background" : "border-input bg-background hover:bg-muted"
                }`}
              >
                <Icono className="h-4 w-4" aria-hidden="true" />
                {label}
                {cantidad !== null && <span className="tabular-nums opacity-80">{cantidad}</span>}
              </button>
            )
          })}
        </div>

        {/* Filtros (valen para las dos pestañas) */}
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOrdenFecha((o) => (o === "asc" ? "desc" : "asc"))}
                className="gap-1.5"
              >
                {ordenFecha === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {ordenFecha === "asc" ? "Más viejos primero" : "Más recientes primero"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* La pestaña Eliminados se monta siempre, para tener su número */}
        <div hidden={pestana !== "eliminados"}>
          <EventosEliminados busqueda={searchQuery} salon={filtroSalon} orden={ordenFecha} onCantidad={alContarEliminados} />
        </div>

        {/* Tabla de finalizados */}
        <div hidden={pestana !== "finalizados"}>
        <Card>
          <CardHeader>
            <CardTitle>Eventos finalizados</CardTitle>
            <p className="text-sm text-muted-foreground">
              {eventosFiltrados.length} evento{eventosFiltrados.length !== 1 ? "s" : ""}: los datos quedan congelados hasta sacarlos de Finalizados
            </p>
          </CardHeader>
          <CardContent>
            {eventosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No hay eventos finalizados</p>
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
                          <TableCell className="text-sm">{fechaEventoCorta(evento.fecha)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {evento.salon ? salonLabel(evento.salon) : "Sin salón"}
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
                                  onClick={() => setEventoASacarId(evento.id)}
                                  className="text-sky-600 focus:text-sky-600"
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Sacar de Finalizados
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

      <AlertDialog open={!!eventoASacarId} onOpenChange={(open) => { if (!open) setEventoASacarId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Sacar este evento de Finalizados?</AlertDialogTitle>
            <AlertDialogDescription>
              Vuelve a la lista como &quot;En preparación&quot; y sus costos dejan de estar congelados: se vuelven a
              calcular en vivo con los precios de hoy de insumos, servicios y personal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = eventoASacarId
                setEventoASacarId(null)
                if (id) handleReactivar(id)
              }}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              Sí, sacar de Finalizados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

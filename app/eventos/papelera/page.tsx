"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  ArrowLeft,
  Trash2,
  RotateCcw,
  Calendar,
  Users,
  Building2,
  RefreshCw,
} from "lucide-react"

interface EventoEliminado {
  id: string
  nombre: string
  fecha: string | null
  estado: string
  eliminado_at: string
  motivo: string | null
  data: {
    adultos?: number
    adolescentes?: number
    ninos?: number
    personasDietasEspeciales?: number
    salon?: string
    tipoEvento?: string
    nombrePareja?: string
  }
}

const estadoConfig: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-800 border-amber-300" },
  en_preparacion: { label: "En Preparacion", className: "bg-sky-100 text-sky-800 border-sky-300" },
  confirmado: { label: "Confirmado", className: "bg-sky-100 text-sky-800 border-sky-300" },
  completado: { label: "Completado", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-800 border-red-300" },
}

function formatFecha(fecha: string | null) {
  if (!fecha) return "-"
  try {
    const [year, month, day] = fecha.split("-")
    return `${day}/${month}/${year}`
  } catch {
    return fecha
  }
}

function formatFechaHora(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export default function PapeleraPage() {
  const { toast } = useToast()
  const [eventos, setEventos] = useState<EventoEliminado[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurarId, setRestaurarId] = useState<string | null>(null)
  const [eliminarId, setEliminarId] = useState<string | null>(null)
  const [vaciarDialogOpen, setVaciarDialogOpen] = useState(false)

  const fetchPapelera = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/eventos/papelera")
      if (res.ok) {
        const data = await res.json()
        setEventos(Array.isArray(data) ? data : [])
      }
    } catch {
      setEventos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPapelera()
  }, [fetchPapelera])

  const handleRestaurar = async () => {
    if (!restaurarId) return
    try {
      const res = await fetch(`/api/eventos/papelera/${restaurarId}/restaurar`, { method: "POST" })
      if (res.ok) {
        setEventos((prev) => prev.filter((e) => e.id !== restaurarId))
        toast({ title: "Evento restaurado", description: "El evento volvio a la lista activa." })
      }
    } catch {
      toast({ title: "Error", description: "No se pudo restaurar el evento." })
    }
    setRestaurarId(null)
  }

  const handleEliminarDefinitivo = async () => {
    if (!eliminarId) return
    try {
      await fetch(`/api/eventos/papelera?id=${eliminarId}`, { method: "DELETE" })
      setEventos((prev) => prev.filter((e) => e.id !== eliminarId))
      toast({ title: "Evento eliminado", description: "El evento fue eliminado permanentemente." })
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar el evento." })
    }
    setEliminarId(null)
  }

  const handleVaciar = async () => {
    try {
      await fetch("/api/eventos/papelera", { method: "DELETE" })
      setEventos([])
      toast({ title: "Papelera vaciada", description: "Todos los eventos eliminados fueron borrados permanentemente." })
    } catch {
      toast({ title: "Error", description: "No se pudo vaciar la papelera." })
    }
    setVaciarDialogOpen(false)
  }

  const eventoRestaurar = restaurarId ? eventos.find((e) => e.id === restaurarId) : null
  const eventoEliminar = eliminarId ? eventos.find((e) => e.id === eliminarId) : null

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/eventos/lista">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Trash2 className="h-6 w-6 text-muted-foreground" />
                Papelera de Eventos
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {eventos.length} evento{eventos.length !== 1 ? "s" : ""} eliminado{eventos.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchPapelera} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            {eventos.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setVaciarDialogOpen(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Vaciar papelera
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <CardContent className="py-16 text-center text-muted-foreground">
              Cargando...
            </CardContent>
          ) : eventos.length === 0 ? (
            <CardContent className="py-16 text-center">
              <Trash2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">La papelera esta vacia</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Evento</TableHead>
                    <TableHead className="min-w-[90px]">Fecha</TableHead>
                    <TableHead className="min-w-[90px]">Salon</TableHead>
                    <TableHead className="min-w-[80px] text-center">Invitados</TableHead>
                    <TableHead className="min-w-[110px]">Estado</TableHead>
                    <TableHead className="min-w-[130px]">Eliminado</TableHead>
                    <TableHead className="min-w-[100px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventos.map((evento) => {
                    const config = estadoConfig[evento.estado] ?? estadoConfig.pendiente
                    const d = evento.data || {}
                    const totalInvitados = (d.adultos || 0) + (d.adolescentes || 0) + (d.ninos || 0) + (d.personasDietasEspeciales || 0)
                    const displayName = d.nombrePareja || evento.nombre || "Sin nombre"
                    return (
                      <TableRow key={evento.id} className="group">
                        <TableCell>
                          <div className="font-medium text-sm">{displayName}</div>
                          {d.tipoEvento && (
                            <div className="text-xs text-muted-foreground">{d.tipoEvento}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {formatFecha(evento.fecha)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {d.salon ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              {d.salon}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {totalInvitados > 0 ? (
                            <div className="flex items-center justify-center gap-1 text-sm">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              {totalInvitados}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${config.className}`}>
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            {formatFechaHora(evento.eliminado_at)}
                          </div>
                          {evento.motivo && (
                            <div className="text-xs text-muted-foreground/70 mt-0.5 italic">
                              {evento.motivo}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                              onClick={() => setRestaurarId(evento.id)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restaurar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setEliminarId(evento.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Restaurar Dialog */}
      <AlertDialog open={!!restaurarId} onOpenChange={(o) => !o && setRestaurarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar Evento</AlertDialogTitle>
            <AlertDialogDescription>
              El evento <strong>{eventoRestaurar?.data?.nombrePareja || eventoRestaurar?.nombre}</strong> volvera a aparecer en la lista activa de eventos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestaurar} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Si, Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Eliminar definitivo Dialog */}
      <AlertDialog open={!!eliminarId} onOpenChange={(o) => !o && setEliminarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. El evento <strong>{eventoEliminar?.data?.nombrePareja || eventoEliminar?.nombre}</strong> sera eliminado para siempre de la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEliminarDefinitivo} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Si, Eliminar Para Siempre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Vaciar papelera Dialog */}
      <AlertDialog open={vaciarDialogOpen} onOpenChange={setVaciarDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vaciar Papelera</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara permanentemente todos los {eventos.length} eventos de la papelera. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleVaciar} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Vaciar Todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

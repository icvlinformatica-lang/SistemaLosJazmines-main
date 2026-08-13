"use client"

import { useEffect, useState } from "react"
import { useStore } from "@/lib/store-context"
import { formatCurrency } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { ArchiveRestore, Loader2, RefreshCw, Trash2, Undo2 } from "lucide-react"
import {
  fetchServiciosEliminados,
  restaurarServicio,
  deleteServicioDefinitivo,
  type ServicioEliminado,
} from "@/lib/supabase/data-service"

export function ServiciosEliminadosCard() {
  const { state, setServicios } = useStore()
  const { toast } = useToast()

  const [items, setItems] = useState<ServicioEliminado[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)

  const loadItems = async () => {
    setIsLoading(true)
    try {
      const data = await fetchServiciosEliminados()
      setItems(data)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  const handleRestaurar = async (item: ServicioEliminado) => {
    setWorkingId(item.id)
    try {
      const restored = await restaurarServicio(item.id)
      if (!restored) {
        toast({
          title: "Error al restaurar",
          description: "No se pudo restaurar el servicio. Revisá tu conexión e intentá de nuevo.",
          variant: "destructive",
        })
        return
      }
      // Actualizar el catálogo en memoria sin duplicados
      const restantes = (state.servicios || []).filter((s) => s.id !== restored.id)
      setServicios([...restantes, restored])
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      // Registrar en el historial de actividad
      fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "servicio",
          accion: "creado",
          nombre: restored.nombre,
          detalle: "Restaurado desde la papelera de servicios",
        }),
      }).catch(() => {})
      toast({
        title: "Servicio restaurado",
        description: `"${restored.nombre}" volvió al catálogo de servicios.`,
      })
    } finally {
      setWorkingId(null)
    }
  }

  const handleEliminarDefinitivo = async (item: ServicioEliminado) => {
    setWorkingId(item.id)
    try {
      const ok = await deleteServicioDefinitivo(item.id)
      if (!ok) {
        toast({ title: "Error al eliminar", variant: "destructive" })
        return
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast({ title: "Eliminado definitivamente", description: `"${item.nombre}" ya no se puede recuperar.` })
    } finally {
      setWorkingId(null)
    }
  }

  const formatFecha = (iso: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ArchiveRestore className="h-6 w-6" />
              Papelera de Servicios
            </CardTitle>
            <CardDescription className="text-base">
              Servicios eliminados del catálogo. Podés restaurarlos para deshacer el borrado.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={loadItems}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Cargando papelera...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ArchiveRestore className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-base">La papelera está vacía</p>
            <p className="text-sm mt-1">Los servicios que elimines apareceran aqui para poder restaurarlos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{item.nombre}</span>
                    <Badge variant="outline" className="text-xs">
                      {item.categoria}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Precio: {formatCurrency(item.precioVenta)} · Costo: {formatCurrency(item.costoParaCajaEventos)} ·
                    Seña: {item.porcentajeSeña}%
                  </p>
                  <p className="text-xs text-muted-foreground">Eliminado: {formatFecha(item.eliminadoAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleRestaurar(item)}
                    disabled={workingId === item.id}
                  >
                    {workingId === item.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Undo2 className="h-4 w-4 mr-1" />
                    )}
                    Restaurar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={workingId === item.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Eliminar definitivamente</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar definitivamente</AlertDialogTitle>
                        <AlertDialogDescription>
                          {`Esto eliminara "${item.nombre}" de forma permanente y no se podra recuperar.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive hover:bg-destructive/90"
                          onClick={() => handleEliminarDefinitivo(item)}
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store-context"
import { useToast } from "@/hooks/use-toast"
import {
  type EventoGuardado,
  loadState,
  asignarPersonalAEvento,
  desasignarPersonalDeEvento,
  calcularCostosEvento,
} from "@/lib/store"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CalendarDays,
  Clock,
  ArrowLeft,
  ClipboardList,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ResumenCostos } from "./resumen-costos"
import { ServicioAsignacionCard } from "./servicio-asignacion-card"

export function AsignacionesContent({ evento }: { evento: EventoGuardado }) {
  const { servicios, personal, eventos, state } = useStore()
  const { toast } = useToast()
  const [, setRefresh] = useState(0)

  // Calculate days remaining
  const diasRestantes = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fechaEvento = new Date(evento.fecha)
    fechaEvento.setHours(0, 0, 0, 0)
    const diff = fechaEvento.getTime() - hoy.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }, [evento.fecha])

  // Get asignaciones from evento
  const asignaciones = evento.asignaciones || []

  // Group asignaciones by servicioEventoId
  const serviciosConAsignaciones = useMemo(() => {
    const serviciosEvento = evento.servicios || []
    return serviciosEvento.map((se) => {
      const servicioCatalogo = servicios.find((s) => s.id === se.servicioId)
      const asignacionesServicio = asignaciones.filter(
        (a) => a.servicioEventoId === se.servicioId
      )
      return {
        servicioEvento: se,
        servicioCatalogo,
        asignaciones: asignacionesServicio,
      }
    })
  }, [evento.servicios, servicios, asignaciones])

  // Group by category
  const categorias = useMemo(() => {
    const map = new Map<
      string,
      typeof serviciosConAsignaciones
    >()
    for (const item of serviciosConAsignaciones) {
      const cat = item.servicioCatalogo?.categoria || "Otros"
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    }
    return map
  }, [serviciosConAsignaciones])

  // Costs summary
  const costos = useMemo(() => calcularCostosEvento(evento), [evento])
  const totalAsignadas = asignaciones.filter(
    (a) => a.personalAsignadoId !== null
  ).length
  const totalSlots = asignaciones.length
  const porcentajeCompletitud =
    totalSlots > 0 ? Math.round((totalAsignadas / totalSlots) * 100) : 0

  // Check if a person is already assigned somewhere in this event
  const personalYaAsignado = useMemo(() => {
    const ids = new Set<string>()
    for (const a of asignaciones) {
      if (a.personalAsignadoId) ids.add(a.personalAsignadoId)
    }
    return ids
  }, [asignaciones])

  const handleAsignar = (asignacionId: string, personalId: string) => {
    // Obtener el evento actual del contexto (que viene de la DB)
    if (!evento) {
      toast({
        title: "Error",
        description: "No se cargó el evento correctamente.",
        variant: "destructive",
      })
      return
    }

    const ok = asignarPersonalAEvento(
      { ...state, eventoActual: evento },
      evento.id,
      asignacionId,
      personalId
    )

    if (ok) {
      toast({
        title: "Personal asignado",
        description: "Se asigno correctamente al personal.",
      })
      // Force re-render by reading from the updated state
      setRefresh((r) => r + 1)
      // Reload the page state
      window.location.reload()
    } else {
      toast({
        title: "Error",
        description: "No se pudo asignar al personal.",
        variant: "destructive",
      })
    }
  }

  const handleDesasignar = (asignacionId: string) => {
    // Obtener el evento actual del contexto (que viene de la DB)
    if (!evento) {
      toast({
        title: "Error",
        description: "No se cargó el evento correctamente.",
        variant: "destructive",
      })
      return
    }

    const ok = desasignarPersonalDeEvento(
      { ...state, eventoActual: evento },
      evento.id,
      asignacionId
    )

    if (ok) {
      toast({
        title: "Personal removido",
        description: "Se removio la asignacion correctamente.",
      })
      window.location.reload()
    } else {
      toast({
        title: "Error",
        description: "No se pudo remover la asignacion.",
        variant: "destructive",
      })
    }
  }

  // Format event date
  const fechaFormateada = new Date(evento.fecha).toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const tieneServicios =
    serviciosConAsignaciones.length > 0 &&
    serviciosConAsignaciones.some((s) => s.asignaciones.length > 0)

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/eventos/lista">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Volver a lista de eventos</span>
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight text-balance">
              {"Asignacion de Personal"}
            </h1>
            <p className="text-lg text-muted-foreground mt-1 truncate">
              {evento.nombre}
            </p>
          </div>
        </div>

        {/* Date & countdown */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span className="capitalize">{fechaFormateada}</span>
          </div>
          {evento.horario && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{evento.horario}</span>
            </div>
          )}
          <Badge
            variant={
              diasRestantes < 0
                ? "destructive"
                : diasRestantes <= 7
                  ? "secondary"
                  : "outline"
            }
            className={
              diasRestantes < 0
                ? ""
                : diasRestantes <= 7
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                  : "border-primary/30 bg-primary/10 text-primary"
            }
          >
            {diasRestantes < 0
              ? `Hace ${Math.abs(diasRestantes)} dias`
              : diasRestantes === 0
                ? "Hoy"
                : `Faltan ${diasRestantes} dias`}
          </Badge>
          {evento.salon && (
            <Badge variant="outline">{evento.salon}</Badge>
          )}
        </div>
      </div>

      {/* Cost Summary */}
      <ResumenCostos
        costoPlaneado={costos.costoPlaneado}
        costoReal={costos.costoReal}
        diferencia={costos.diferencia}
        totalSlots={totalSlots}
        totalAsignadas={totalAsignadas}
        porcentajeCompletitud={porcentajeCompletitud}
      />

      {/* Services with assignments */}
      {!tieneServicios ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Sin asignaciones pendientes
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {
                "Este evento no tiene servicios con recursos de personal definidos. Agrega servicios con recursos necesarios desde el catalogo para generar asignaciones automaticas."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(categorias.entries()).map(([categoria, items]) => {
            // Only show categories that have asignaciones
            const itemsConAsignaciones = items.filter(
              (i) => i.asignaciones.length > 0
            )
            if (itemsConAsignaciones.length === 0) return null

            return (
              <div key={categoria} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    {categoria}
                  </h2>
                  <Badge variant="secondary" className="text-xs">
                    {itemsConAsignaciones.reduce(
                      (sum, i) => sum + i.asignaciones.length,
                      0
                    )}{" "}
                    {"asignaciones"}
                  </Badge>
                </div>
                <div className="grid gap-4">
                  {itemsConAsignaciones.map((item) => (
                    <ServicioAsignacionCard
                      key={item.servicioEvento.servicioId}
                      servicioEvento={item.servicioEvento}
                      servicioCatalogo={item.servicioCatalogo}
                      asignaciones={item.asignaciones}
                      personal={personal}
                      personalYaAsignado={personalYaAsignado}
                      onAsignar={handleAsignar}
                      onDesasignar={handleDesasignar}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

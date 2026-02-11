"use client"

import { useMemo } from "react"
import { useStore } from "@/lib/store-context"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Users,
  AlertTriangle,
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils-financieros"

/**
 * Dashboard card que muestra resumen de asignaciones de personal
 * para el centro de control financiero:
 * - Eventos proximos (7 dias) con asignaciones incompletas
 * - Personal mas solicitado (top 5)
 * - Promedio de ahorro/sobrecosto por evento
 * - Alertas de asignaciones
 */
export default function AsignacionesDashboardCard() {
  const { eventos, personal, pagosPersonal } = useStore()

  const hoy = new Date()
  const en7Dias = new Date(hoy)
  en7Dias.setDate(en7Dias.getDate() + 7)
  const en2Dias = new Date(hoy)
  en2Dias.setDate(en2Dias.getDate() + 2)

  // --- Eventos proximos con asignaciones incompletas ---
  const eventosProximosIncompletos = useMemo(() => {
    return eventos
      .filter((e) => {
        const fecha = new Date(e.fecha)
        if (fecha < hoy || fecha > en7Dias) return false
        if (e.estado === "cancelado" || e.estado === "completado") return false
        if (!e.asignaciones || e.asignaciones.length === 0) return false
        // Tiene al menos una asignacion sin personal
        return e.asignaciones.some((a) => !a.personalAsignadoId)
      })
      .map((e) => {
        const total = e.asignaciones!.length
        const cubiertos = e.asignaciones!.filter(
          (a) => a.personalAsignadoId !== null
        ).length
        return {
          id: e.id,
          nombre: e.nombre || e.nombrePareja || "Evento",
          fecha: e.fecha,
          total,
          cubiertos,
          porcentaje: Math.round((cubiertos / total) * 100),
        }
      })
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
  }, [eventos]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Personal mas solicitado (top 5) ---
  const personalMasSolicitado = useMemo(() => {
    const conteo = new Map<string, { nombre: string; count: number }>()

    eventos.forEach((e) => {
      if (e.estado === "cancelado") return
      e.asignaciones?.forEach((a) => {
        if (!a.personalAsignadoId) return
        const existing = conteo.get(a.personalAsignadoId)
        if (existing) {
          existing.count++
        } else {
          conteo.set(a.personalAsignadoId, {
            nombre: a.personalNombre || "Desconocido",
            count: 1,
          })
        }
      })
    })

    return Array.from(conteo.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [eventos])

  // --- Promedio de ahorro/sobrecosto por evento ---
  const promedioAhorroSobrecosto = useMemo(() => {
    const eventosConCostos = eventos.filter(
      (e) =>
        e.costosCalculados &&
        e.asignaciones &&
        e.asignaciones.length > 0 &&
        e.estado !== "cancelado"
    )

    if (eventosConCostos.length === 0) return { promedio: 0, count: 0 }

    const totalDiferencia = eventosConCostos.reduce(
      (sum, e) => sum + (e.costosCalculados?.diferencia || 0),
      0
    )

    return {
      promedio: totalDiferencia / eventosConCostos.length,
      count: eventosConCostos.length,
    }
  }, [eventos])

  // --- Alertas ---
  const alertas = useMemo(() => {
    const items: { tipo: "error" | "warning" | "info"; mensaje: string }[] = []

    // Eventos sin personal asignado (en proximos 7 dias)
    const eventosSinPersonal = eventos.filter((e) => {
      const fecha = new Date(e.fecha)
      if (fecha < hoy || fecha > en7Dias) return false
      if (e.estado === "cancelado" || e.estado === "completado") return false
      if (!e.asignaciones || e.asignaciones.length === 0) return false
      return e.asignaciones.every((a) => !a.personalAsignadoId)
    })

    eventosSinPersonal.forEach((e) => {
      items.push({
        tipo: "error",
        mensaje: `"${e.nombre || e.nombrePareja || "Evento"}" no tiene personal asignado`,
      })
    })

    // Personal sin confirmar 2 dias antes del evento
    eventos.forEach((e) => {
      const fecha = new Date(e.fecha)
      if (fecha < hoy || fecha > en2Dias) return
      if (e.estado === "cancelado" || e.estado === "completado") return

      const sinConfirmar =
        e.asignaciones?.filter(
          (a) => a.personalAsignadoId && !a.confirmado
        ) || []

      if (sinConfirmar.length > 0) {
        items.push({
          tipo: "warning",
          mensaje: `${sinConfirmar.length} asignacion(es) sin confirmar en "${e.nombre || e.nombrePareja}" (${formatearFechaCorta(e.fecha)})`,
        })
      }
    })

    // Pagos pendientes vinculados a asignaciones
    const pagosPendientesConAsignacion = pagosPersonal.filter(
      (p) => p.asignacionId && (p.estado === "pendiente" || p.estado === "vencido")
    )

    if (pagosPendientesConAsignacion.length > 0) {
      items.push({
        tipo: "info",
        mensaje: `${pagosPendientesConAsignacion.length} pago(s) pendiente(s) vinculados a asignaciones`,
      })
    }

    return items
  }, [eventos, pagosPersonal]) // eslint-disable-line react-hooks/exhaustive-deps

  const formatearFechaCorta = (fecha: string) => {
    return new Date(fecha).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
    })
  }

  const tieneData =
    eventosProximosIncompletos.length > 0 ||
    personalMasSolicitado.length > 0 ||
    promedioAhorroSobrecosto.count > 0 ||
    alertas.length > 0

  if (!tieneData) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Asignaciones de Personal
        </CardTitle>
        <CardDescription>
          Resumen de asignaciones, disponibilidad y costos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alertas */}
        {alertas.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Alertas
            </p>
            <div className="space-y-1.5">
              {alertas.map((alerta, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-sm rounded-md px-3 py-2 ${
                    alerta.tipo === "error"
                      ? "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                      : alerta.tipo === "warning"
                        ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400"
                        : "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                  }`}
                >
                  {alerta.tipo === "error" ? (
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : alerta.tipo === "warning" ? (
                    <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <DollarSign className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <span>{alerta.mensaje}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Eventos proximos incompletos */}
        {eventosProximosIncompletos.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Eventos proximos - Personal incompleto
            </p>
            {eventosProximosIncompletos.map((e) => (
              <div key={e.id} className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">
                      {e.nombre}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">
                      {e.cubiertos}/{e.total}
                    </span>
                  </div>
                  <Progress
                    value={e.porcentaje}
                    className="h-1.5"
                  />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatearFechaCorta(e.fecha)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Promedio ahorro/sobrecosto */}
        {promedioAhorroSobrecosto.count > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Promedio ahorro/sobrecosto
            </p>
            <div className="flex items-center gap-3 rounded-md border p-3">
              {promedioAhorroSobrecosto.promedio >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p
                  className={`text-lg font-bold ${
                    promedioAhorroSobrecosto.promedio >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {promedioAhorroSobrecosto.promedio >= 0 ? "+" : ""}
                  {formatCurrency(promedioAhorroSobrecosto.promedio)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Promedio sobre {promedioAhorroSobrecosto.count} evento
                  {promedioAhorroSobrecosto.count !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Personal mas solicitado */}
        {personalMasSolicitado.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Personal mas solicitado
            </p>
            <div className="space-y-2">
              {personalMasSolicitado.map((p, i) => {
                const persona = personal.find((per) => per.id === p.id)
                const initials = p.nombre
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()

                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3"
                  >
                    <span className="text-xs text-muted-foreground w-4 text-right">
                      {i + 1}.
                    </span>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {p.nombre}
                      </span>
                      {persona && (
                        <span className="text-xs text-muted-foreground">
                          {persona.funcion}
                        </span>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {p.count} evento{p.count !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

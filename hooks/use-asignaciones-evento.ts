"use client"

import { useMemo } from "react"
import { useStore } from "@/lib/store-context"
import type { AsignacionPersonal, PersonalEvento, ServicioEvento } from "@/lib/store"

/** Agrupación de asignaciones por servicio dentro de un evento */
export interface AsignacionesPorServicio {
  /** ID del servicio (servicioEventoId en la asignación) */
  servicioId: string
  /** Nombre del servicio para display */
  servicioNombre: string
  /** Asignaciones asociadas a este servicio */
  asignaciones: AsignacionPersonal[]
  /** Cantidad total de puestos */
  totalPuestos: number
  /** Cantidad de puestos cubiertos (con personal asignado) */
  puestosCubiertos: number
  /** Suma de costos planeados */
  costoPlaneado: number
  /** Suma de costos reales */
  costoReal: number
}

/** Estadísticas generales de asignaciones de un evento */
export interface AsignacionesStats {
  /** Total de asignaciones */
  total: number
  /** Asignaciones con personal confirmado */
  asignadas: number
  /** Asignaciones sin personal */
  sinAsignar: number
  /** Asignaciones donde costoReal > costoPlaneado */
  conSobrecosto: number
  /** Porcentaje de completitud (0-100) */
  porcentajeCompleto: number
  /** Costo planeado total */
  costoPlaneadoTotal: number
  /** Costo real total */
  costoRealTotal: number
  /** Diferencia (planeado - real). Positivo = ahorro, negativo = sobrecosto */
  diferencia: number
}

/** Personal disponible filtrado para asignaciones */
export interface PersonalDisponible extends PersonalEvento {
  /** Si ya está asignado en este evento */
  yaAsignadoEnEvento: boolean
  /** Cantidad de eventos donde está asignado en la misma fecha */
  conflictosHorario: number
}

/**
 * Hook para gestionar asignaciones de personal a un evento específico.
 * Provee datos agrupados, estadísticas y personal disponible.
 *
 * @param eventoId - ID del evento
 * @returns Datos del evento, asignaciones agrupadas, stats y personal disponible
 */
export function useAsignacionesEvento(eventoId: string) {
  const { state, eventos, personal } = useStore()

  const evento = useMemo(
    () => eventos.find((e) => e.id === eventoId) || null,
    [eventos, eventoId]
  )

  const asignaciones = useMemo(
    () => evento?.asignaciones || [],
    [evento]
  )

  /** Asignaciones agrupadas por servicio */
  const asignacionesPorServicio = useMemo<AsignacionesPorServicio[]>(() => {
    if (!evento) return []

    const grouped = new Map<string, AsignacionPersonal[]>()

    asignaciones.forEach((a) => {
      const existing = grouped.get(a.servicioEventoId) || []
      existing.push(a)
      grouped.set(a.servicioEventoId, existing)
    })

    return Array.from(grouped.entries()).map(([servicioId, asigs]) => {
      // Buscar nombre del servicio
      const servicioEvento = evento.servicios?.find(
        (s: ServicioEvento) => s.servicioId === servicioId
      )
      const servicioNombre = servicioEvento?.nombre || servicioId

      return {
        servicioId,
        servicioNombre,
        asignaciones: asigs,
        totalPuestos: asigs.length,
        puestosCubiertos: asigs.filter((a) => a.personalAsignadoId !== null).length,
        costoPlaneado: asigs.reduce((sum, a) => sum + a.costoPlaneado, 0),
        costoReal: asigs.reduce((sum, a) => sum + a.costoReal, 0),
      }
    })
  }, [evento, asignaciones])

  /** Estadísticas generales */
  const stats = useMemo<AsignacionesStats>(() => {
    const total = asignaciones.length
    const asignadas = asignaciones.filter((a) => a.confirmado).length
    const sinAsignar = asignaciones.filter(
      (a) => a.personalAsignadoId === null
    ).length
    const conSobrecosto = asignaciones.filter(
      (a) => a.costoReal > a.costoPlaneado && a.personalAsignadoId !== null
    ).length
    const costoPlaneadoTotal = asignaciones.reduce(
      (sum, a) => sum + a.costoPlaneado,
      0
    )
    const costoRealTotal = asignaciones.reduce(
      (sum, a) => sum + a.costoReal,
      0
    )

    return {
      total,
      asignadas,
      sinAsignar,
      conSobrecosto,
      porcentajeCompleto: total > 0 ? Math.round((asignadas / total) * 100) : 0,
      costoPlaneadoTotal,
      costoRealTotal,
      diferencia: costoPlaneadoTotal - costoRealTotal,
    }
  }, [asignaciones])

  /** Personal disponible con info de conflictos */
  const personalDisponible = useMemo<PersonalDisponible[]>(() => {
    if (!evento) return []

    const personalIdsEnEvento = new Set(
      asignaciones
        .filter((a) => a.personalAsignadoId !== null)
        .map((a) => a.personalAsignadoId)
    )

    return personal
      .filter((p) => p.activo)
      .map((p) => {
        // Contar conflictos: eventos en la misma fecha donde este personal está asignado
        const conflictosHorario = eventos.filter((e) => {
          if (e.id === eventoId) return false
          if (e.fecha !== evento.fecha) return false
          return e.asignaciones?.some(
            (a) =>
              a.personalAsignadoId === p.id && a.confirmado
          )
        }).length

        return {
          ...p,
          yaAsignadoEnEvento: personalIdsEnEvento.has(p.id),
          conflictosHorario,
        }
      })
  }, [personal, asignaciones, evento, eventos, eventoId])

  return {
    evento,
    asignaciones,
    asignacionesPorServicio,
    stats,
    personalDisponible,
    state,
  }
}

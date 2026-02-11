"use client"

import { useState } from "react"
import {
  formatCurrency,
  type ServicioEvento,
  type Servicio,
  type AsignacionPersonal,
  type PersonalEvento,
} from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AsignacionRow } from "./asignacion-row"

interface ServicioAsignacionCardProps {
  servicioEvento: ServicioEvento
  servicioCatalogo: Servicio | undefined
  asignaciones: AsignacionPersonal[]
  personal: PersonalEvento[]
  personalYaAsignado: Set<string>
  onAsignar: (asignacionId: string, personalId: string) => void
  onDesasignar: (asignacionId: string) => void
}

export function ServicioAsignacionCard({
  servicioEvento,
  servicioCatalogo,
  asignaciones,
  personal,
  personalYaAsignado,
  onAsignar,
  onDesasignar,
}: ServicioAsignacionCardProps) {
  const asignadas = asignaciones.filter((a) => a.personalAsignadoId !== null).length
  const total = asignaciones.length
  const todasAsignadas = asignadas === total && total > 0

  return (
    <Card
      className={
        todasAsignadas
          ? "border-primary/30 bg-primary/[0.02]"
          : ""
      }
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-base truncate">
              {servicioEvento.nombre}
            </CardTitle>
            {servicioCatalogo && (
              <Badge variant="outline" className="shrink-0 text-xs">
                {servicioCatalogo.categoria}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={todasAsignadas ? "default" : "secondary"}
              className={
                todasAsignadas
                  ? "bg-primary/15 text-primary border-primary/30"
                  : ""
              }
            >
              {asignadas}/{total} asignados
            </Badge>
            {servicioEvento.proveedor && (
              <span className="text-xs text-muted-foreground">
                Prov: {servicioEvento.proveedor}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {asignaciones.map((asignacion) => (
          <AsignacionRow
            key={asignacion.id}
            asignacion={asignacion}
            personal={personal}
            personalYaAsignado={personalYaAsignado}
            onAsignar={onAsignar}
            onDesasignar={onDesasignar}
          />
        ))}
      </CardContent>
    </Card>
  )
}

"use client"

import { formatCurrency } from "@/lib/store"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Minus,
} from "lucide-react"

interface ResumenCostosProps {
  costoPlaneado: number
  costoReal: number
  diferencia: number
  totalSlots: number
  totalAsignadas: number
  porcentajeCompletitud: number
}

export function ResumenCostos({
  costoPlaneado,
  costoReal,
  diferencia,
  totalSlots,
  totalAsignadas,
  porcentajeCompletitud,
}: ResumenCostosProps) {
  const hayCostos = costoPlaneado > 0 || costoReal > 0

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Costo Planeado */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Costo Planeado
              </p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(costoPlaneado)}
              </p>
            </div>
            <div className="rounded-full bg-primary/10 p-3">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Costo Real */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Costo Real
              </p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(costoReal)}
              </p>
            </div>
            <div className="rounded-full bg-secondary p-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diferencia */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Diferencia
              </p>
              <div className="flex items-center gap-2">
                <p
                  className={`text-2xl font-bold ${
                    diferencia > 0
                      ? "text-primary"
                      : diferencia < 0
                        ? "text-destructive"
                        : "text-foreground"
                  }`}
                >
                  {diferencia > 0 ? "+" : ""}
                  {formatCurrency(diferencia)}
                </p>
                {hayCostos && diferencia !== 0 && (
                  <Badge
                    variant={diferencia > 0 ? "default" : "destructive"}
                    className={
                      diferencia > 0
                        ? "bg-primary/15 text-primary border-primary/30"
                        : ""
                    }
                  >
                    {diferencia > 0 ? "Ahorro" : "Exceso"}
                  </Badge>
                )}
              </div>
            </div>
            <div
              className={`rounded-full p-3 ${
                diferencia > 0
                  ? "bg-primary/10"
                  : diferencia < 0
                    ? "bg-destructive/10"
                    : "bg-secondary"
              }`}
            >
              {diferencia > 0 ? (
                <TrendingDown className="h-5 w-5 text-primary" />
              ) : diferencia < 0 ? (
                <TrendingUp className="h-5 w-5 text-destructive" />
              ) : (
                <Minus className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completitud */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Completitud
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {totalAsignadas}/{totalSlots}
                </p>
              </div>
              <div className="rounded-full bg-secondary p-3">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1">
              <Progress value={porcentajeCompletitud} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {porcentajeCompletitud}% asignado
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

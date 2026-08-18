"use client"

import { useMemo } from "react"
import { useStore } from "@/lib/store-context"
import { SALONES, calcularSaldoCaja, salonLabel, MovimientoCaja } from "@/lib/store"
import { formatCurrency } from "@/lib/utils-financieros"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Building2,
  Building,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRightCircle,
  Wallet,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react"

function MovimientoIcon({ tipo }: { tipo: MovimientoCaja["tipo"] }) {
  switch (tipo) {
    case "ingreso":
      return <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
    case "egreso":
      return <ArrowDownCircle className="h-4 w-4 text-red-500" />
    case "aporte_admin":
      return <ArrowRightCircle className="h-4 w-4 text-blue-500" />
  }
}

function MovimientoBadge({ tipo }: { tipo: MovimientoCaja["tipo"] }) {
  const configs: Record<MovimientoCaja["tipo"], { label: string; className: string }> = {
    ingreso: { label: "Ingreso", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    egreso: { label: "Egreso", className: "bg-red-100 text-red-700 border-red-200" },
    aporte_admin: { label: "Aporte Admin", className: "bg-blue-100 text-blue-700 border-blue-200" },
  }
  const config = configs[tipo]
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  )
}

interface CajaCardProps {
  salon: string
  isAdmin?: boolean
}

function CajaCard({ salon, isAdmin }: CajaCardProps) {
  const { configuracionCajas, movimientosCaja } = useStore()

  const { saldoInicial, ingresos, egresos, aportesAdmin, saldoActual } = useMemo(
    () => calcularSaldoCaja(salon, configuracionCajas, movimientosCaja),
    [salon, configuracionCajas, movimientosCaja]
  )

  const movimientos = useMemo(
    () =>
      movimientosCaja
        .filter((m) => m.salon === salon)
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [movimientosCaja, salon]
  )

  const saldoPositivo = saldoActual >= 0

  return (
    <Card className={isAdmin ? "border-primary/30 bg-primary/5 col-span-full" : "border-border"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {isAdmin ? (
              <Building className="h-5 w-5 text-primary" />
            ) : (
              <Building2 className="h-5 w-5 text-primary" />
            )}
            {isAdmin ? "Administracion General" : salonLabel(salon)}
          </CardTitle>
          <div
            className={`text-2xl font-bold ${saldoPositivo ? "text-emerald-600" : "text-red-600"}`}
          >
            {formatCurrency(saldoActual)}
          </div>
        </div>
        <CardDescription>
          {isAdmin ? "Caja central que recibe aportes de todos los salones" : `Caja del salon ${salonLabel(salon)}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Wallet className="h-3.5 w-3.5" />
              Saldo Inicial
            </div>
            <p className="text-sm font-semibold">{formatCurrency(saldoInicial)}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-2 text-xs text-emerald-700 mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Ingresos
            </div>
            <p className="text-sm font-semibold text-emerald-700">{formatCurrency(ingresos)}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-xs text-red-700 mb-1">
              <TrendingDown className="h-3.5 w-3.5" />
              Egresos
            </div>
            <p className="text-sm font-semibold text-red-700">{formatCurrency(egresos)}</p>
          </div>
          {!isAdmin && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center gap-2 text-xs text-blue-700 mb-1">
                <ArrowRightCircle className="h-3.5 w-3.5" />
                Aportes Admin
              </div>
              <p className="text-sm font-semibold text-blue-700">{formatCurrency(aportesAdmin)}</p>
            </div>
          )}
          {isAdmin && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Minus className="h-3.5 w-3.5" />
                Balance
              </div>
              <p className={`text-sm font-semibold ${saldoPositivo ? "text-emerald-600" : "text-red-600"}`}>
                {saldoPositivo ? "+" : ""}{formatCurrency(saldoActual - saldoInicial)}
              </p>
            </div>
          )}
        </div>

        {/* Movimientos History */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Historial de Movimientos</h4>
          {movimientos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay movimientos registrados
            </p>
          ) : (
            <ScrollArea className="h-[200px] pr-3">
              <div className="space-y-2">
                {movimientos.map((mov) => (
                  <div
                    key={mov.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <MovimientoIcon tipo={mov.tipo} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{mov.concepto}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(mov.fecha).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-semibold ${
                          mov.tipo === "egreso" || (mov.tipo === "aporte_admin" && mov.salon !== "admin")
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {mov.tipo === "egreso" || (mov.tipo === "aporte_admin" && mov.salon !== "admin")
                          ? "-"
                          : "+"}
                        {formatCurrency(mov.monto)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saldo: {formatCurrency(mov.saldoResultante)}
                      </p>
                    </div>
                    <MovimientoBadge tipo={mov.tipo} />
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function CajasPage() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel de Cajas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualiza el estado financiero de cada salon y la caja de administracion general
        </p>
      </div>

      {/* Admin Card First */}
      <CajaCard salon="admin" isAdmin />

      {/* Salones Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SALONES.map((salon) => (
          <CajaCard key={salon} salon={salon} />
        ))}
      </div>
    </div>
  )
}

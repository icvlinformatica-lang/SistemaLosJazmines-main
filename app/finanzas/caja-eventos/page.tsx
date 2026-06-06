"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils-financieros"
import { useStore } from "@/lib/store-context"
import { useCajaEventos } from "@/lib/hooks/use-caja-eventos"
import {
  Wallet,
  TrendingUp,
  Clock,
  ArrowUpCircle,
  CalendarClock,
  Building2,
} from "lucide-react"

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function formatFecha(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
}

function diasRestantesBadge(dias: number) {
  if (dias <= 3) {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">
        en {dias} día{dias !== 1 ? "s" : ""}
      </Badge>
    )
  }
  if (dias <= 7) {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]">
        en {dias} días
      </Badge>
    )
  }
  return (
    <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[11px]">
      en {dias} días
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------

export default function CajaEventosPage() {
  const { state } = useStore()
  const data = useCajaEventos(state)

  const {
    saldoActual,
    proyeccion,
    ultimosIngresos,
    proximosACobrar,
    ingresosPorSalon,
    totalIngresosSalonMes,
    mesActual,
  } = data

  const maxProyeccion = Math.max(
    proyeccion.estaSemana,
    proyeccion.esteMes,
    proyeccion.proximos90Dias,
    1 // evitar división por cero
  )

  const salonesConIngreso = Object.entries(ingresosPorSalon).filter(
    ([, monto]) => monto > 0
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
          <Wallet className="h-5 w-5 text-teal-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Caja Eventos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            50% de cada cobro de cuota. Fondos destinados a operar los eventos.
          </p>
        </div>
      </div>

      {/* Sección 1 — Tres métricas destacadas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-teal-200 bg-teal-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-teal-700 uppercase tracking-wide">
                Saldo Actual
              </p>
              <Wallet className="h-4 w-4 text-teal-600" />
            </div>
            <p className="text-3xl font-bold text-teal-800">
              {formatCurrency(saldoActual)}
            </p>
            <p className="text-xs text-teal-600 mt-1">
              Cobros acumulados × 50%
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Proyección 30 días
              </p>
              <TrendingUp className="h-4 w-4 text-teal-600" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {formatCurrency(proyeccion.esteMes)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cuotas pendientes × 50%
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Próximos 90 días
              </p>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {formatCurrency(proyeccion.proximos90Dias)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cuotas pendientes a cobrar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sección 2 — Proyección de ingresos por horizonte */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-600" />
            Proyección de Ingresos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Esta semana", value: proyeccion.estaSemana },
            { label: "Este mes (30 días)", value: proyeccion.esteMes },
            { label: "Próximos 90 días", value: proyeccion.proximos90Dias },
          ].map(({ label, value }) => {
            const pct = Math.round((value / maxProyeccion) * 100)
            return (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{label}</span>
                  <span className="font-semibold text-teal-700">
                    {formatCurrency(value)}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Sección 3 — Dos columnas: Últimos ingresos / Próximos a cobrar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Columna izquierda: Últimos ingresos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-teal-600" />
              Últimos ingresos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ultimosIngresos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aún no hay ingresos registrados en esta caja.
              </p>
            ) : (
              ultimosIngresos.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.concepto}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.salon} · {formatFecha(item.fecha)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-bold text-teal-700">
                      +{formatCurrency(item.monto)}
                    </span>
                    <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[11px]">
                      cobrado
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Columna derecha: Próximos a cobrar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-500" />
              Próximos a cobrar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {proximosACobrar.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No hay cuotas pendientes en los próximos 30 días.
              </p>
            ) : (
              proximosACobrar.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.eventoNombre}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cuota {item.numeroCuota}/{item.totalCuotas} · {item.salon} ·{" "}
                      {formatFecha(item.fechaVencimiento)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-bold text-amber-600">
                      {formatCurrency(item.monto)}
                    </span>
                    {diasRestantesBadge(item.diasRestantes)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sección 4 — Ingresos por salón del mes actual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-teal-600" />
            <span className="capitalize">Ingresos por salón — {mesActual}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {salonesConIngreso.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aún no hay ingresos registrados este mes.
            </p>
          ) : (
            <div className="space-y-3">
              {salonesConIngreso.map(([salon, monto]) => {
                const pct =
                  totalIngresosSalonMes > 0
                    ? Math.round((monto / totalIngresosSalonMes) * 100)
                    : 0
                return (
                  <div key={salon}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-foreground">{salon}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">{pct}%</span>
                        <span className="font-semibold text-teal-700">
                          {formatCurrency(monto)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total del mes
                </span>
                <span className="text-base font-bold text-foreground">
                  {formatCurrency(totalIngresosSalonMes)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

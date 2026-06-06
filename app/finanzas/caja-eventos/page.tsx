"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils-financieros"
import { useStore } from "@/lib/store-context"
import { useCajaEventos } from "@/lib/hooks/use-caja-eventos"
import type { EgresoPendienteServicio } from "@/lib/hooks/use-caja-eventos"
import {
  Wallet,
  TrendingUp,
  Clock,
  ArrowUpCircle,
  CalendarClock,
  Building2,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
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
  if (dias < 0) {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">
        vencido
      </Badge>
    )
  }
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
  const { state, updateEvento } = useStore()
  const data = useCajaEventos(state)

  const {
    saldoActual,
    proyeccion,
    ultimosIngresos,
    proximosACobrar,
    ingresosPorSalon,
    totalIngresosSalonMes,
    mesActual,
    egresosPendientesServicios,
    totalEgresosPendientes,
    balanceProyectado,
  } = data

  const maxProyeccion = Math.max(
    proyeccion.estaSemana,
    proyeccion.esteMes,
    proyeccion.proximos90Dias,
    1
  )

  const salonesConIngreso = Object.entries(ingresosPorSalon).filter(
    ([, monto]) => monto > 0
  )

  // Marcar un egreso de servicio como pagado
  const handleMarcarPagado = (egreso: EgresoPendienteServicio) => {
    const evento = state.eventos.find((e) => e.id === egreso.eventoId)
    if (!evento) return

    const nuevosServicios = (evento.servicios ?? []).map((srv) => {
      if (srv.servicioId !== egreso.id.split("-")[1] && !egreso.id.includes(srv.servicioId)) {
        return srv
      }
      if (egreso.tipo === "seña") {
        return { ...srv, estadoPago: "señado" as const }
      }
      return { ...srv, estadoPago: "pagado_total" as const }
    })

    updateEvento(egreso.eventoId, { servicios: nuevosServicios })
  }

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

      {/* Tres métricas destacadas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-teal-200 bg-teal-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-teal-700 uppercase tracking-wide">Saldo Actual</p>
              <Wallet className="h-4 w-4 text-teal-600" />
            </div>
            <p className="text-3xl font-bold text-teal-800">{formatCurrency(saldoActual)}</p>
            <p className="text-xs text-teal-600 mt-1">Cobros acumulados × 50%</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Proyección 30 días</p>
              <TrendingUp className="h-4 w-4 text-teal-600" />
            </div>
            <p className="text-3xl font-bold text-foreground">{formatCurrency(proyeccion.esteMes)}</p>
            <p className="text-xs text-muted-foreground mt-1">Cuotas pendientes × 50%</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Próximos 90 días</p>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-foreground">{formatCurrency(proyeccion.proximos90Dias)}</p>
            <p className="text-xs text-muted-foreground mt-1">Cuotas pendientes a cobrar</p>
          </CardContent>
        </Card>
      </div>

      {/* Balance Proyectado */}
      <Card className={balanceProyectado >= 0 ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {balanceProyectado >= 0
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              : <AlertTriangle className="h-4 w-4 text-red-500" />}
            Balance Proyectado (90 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Saldo actual en caja</span>
              <span className="font-semibold text-teal-700">+{formatCurrency(saldoActual)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Lo que entra (90 días)</span>
              <span className="font-semibold text-teal-700">+{formatCurrency(proyeccion.proximos90Dias)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Lo que hay que pagar</span>
              <span className="font-semibold text-red-600">−{formatCurrency(totalEgresosPendientes)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border font-bold text-base">
              <span>Balance proyectado</span>
              <span className={balanceProyectado >= 0 ? "text-emerald-700" : "text-red-600"}>
                {balanceProyectado >= 0 ? "+" : ""}{formatCurrency(balanceProyectado)}
              </span>
            </div>
          </div>
          <p className={`text-xs mt-3 font-medium ${balanceProyectado >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {balanceProyectado >= 0
              ? "La caja cubre los pagos a proveedores."
              : "Déficit proyectado — revisar plan de cuotas o postergar pagos."}
          </p>
        </CardContent>
      </Card>

      {/* Proyección de ingresos */}
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
                  <span className="font-semibold text-teal-700">{formatCurrency(value)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-teal-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Últimos ingresos / Próximos a cobrar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-teal-600" />
              Últimos ingresos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ultimosIngresos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aún no hay ingresos registrados en esta caja.</p>
            ) : (
              ultimosIngresos.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.concepto}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.salon} · {formatFecha(item.fecha)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-bold text-teal-700">+{formatCurrency(item.monto)}</span>
                    <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[11px]">cobrado</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-500" />
              Próximos a cobrar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {proximosACobrar.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No hay cuotas pendientes en los próximos 30 días.</p>
            ) : (
              proximosACobrar.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.eventoNombre}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cuota {item.numeroCuota}/{item.totalCuotas} · {item.salon} · {formatFecha(item.fechaVencimiento)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-bold text-amber-600">{formatCurrency(item.monto)}</span>
                    {diasRestantesBadge(item.diasRestantes)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pagos a proveedores pendientes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            Pagos a proveedores pendientes
            {egresosPendientesServicios.length > 0 && (
              <Badge className="bg-red-100 text-red-700 border-red-200 ml-1">
                {egresosPendientesServicios.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {egresosPendientesServicios.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay pagos a proveedores pendientes en los próximos 90 días.
            </p>
          ) : (
            egresosPendientesServicios.map((egreso) => (
              <div key={egreso.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium truncate">{egreso.eventoNombre}</p>
                    <span className="text-muted-foreground text-xs">·</span>
                    <p className="text-xs text-muted-foreground truncate">{egreso.servicioNombre}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={egreso.tipo === "seña"
                        ? "bg-amber-50 text-amber-700 border-amber-200 text-[11px]"
                        : "bg-orange-50 text-orange-700 border-orange-200 text-[11px]"}
                    >
                      {egreso.tipo === "seña" ? "Seña" : "Saldo"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatFecha(egreso.fechaVencimiento)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-sm font-bold text-red-600">−{formatCurrency(egreso.monto)}</span>
                  {diasRestantesBadge(egreso.diasRestantes)}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => handleMarcarPagado(egreso)}
                  >
                    Marcar pagado
                  </Button>
                </div>
              </div>
            ))
          )}
          {egresosPendientesServicios.length > 0 && (
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total pendiente</span>
              <span className="text-base font-bold text-red-600">−{formatCurrency(totalEgresosPendientes)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ingresos por salón */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-teal-600" />
            <span className="capitalize">Ingresos por salón — {mesActual}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {salonesConIngreso.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aún no hay ingresos registrados este mes.</p>
          ) : (
            <div className="space-y-3">
              {salonesConIngreso.map(([salon, monto]) => {
                const pct = totalIngresosSalonMes > 0 ? Math.round((monto / totalIngresosSalonMes) * 100) : 0
                return (
                  <div key={salon}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-foreground">{salon}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">{pct}%</span>
                        <span className="font-semibold text-teal-700">{formatCurrency(monto)}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total del mes</span>
                <span className="text-base font-bold text-foreground">{formatCurrency(totalIngresosSalonMes)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store-context"
import { SALONES, calcularSaldoCaja, calcularSeñaSaldoServicio, salonLabel, type EventoGuardado, type CostoOperativo, type PagoPersonal, type Servicio } from "@/lib/store"
import { formatCurrency } from "@/lib/utils-financieros"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Building2,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Users,
} from "lucide-react"

type Horizonte = 30 | 60 | 90

function parseLocalDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function formatFecha(dateStr: string | undefined): string {
  if (!dateStr) return "-"
  const date = parseLocalDate(dateStr)
  if (!date) return dateStr
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
}

interface CuotaPendiente {
  eventoId: string
  eventoNombre: string
  numeroCuota: number
  monto: number
  fechaVencimiento: string
}

interface EgresoPendiente {
  id: string
  concepto: string
  tipo: "costo_operativo" | "seña_proveedor" | "pago_personal"
  monto: number
  fecha: string
}

interface EventoResumen {
  id: string
  nombre: string
  fecha: string
  precioVenta: number
  totalCobrado: number
  saldoPendiente: number
}

function useCashflowData(salon: string, horizonte: Horizonte) {
  const { eventos, costosOperativos, pagosPersonal, configuracionCajas, movimientosCaja, servicios } = useStore()

  return useMemo(() => {
    const hoy = new Date()
    const fechaLimite = new Date(hoy)
    fechaLimite.setDate(fechaLimite.getDate() + horizonte)

    const { saldoActual } = calcularSaldoCaja(salon, configuracionCajas, movimientosCaja)

    // Filtrar eventos del salón
    const eventosSalon = (eventos || []).filter(
      (e) => e.salon === salon && e.estado !== "cancelado" && e.estado !== "completado"
    )

    // Cuotas pendientes
    const cuotasPendientes: CuotaPendiente[] = []
    for (const evento of eventosSalon) {
      const eventoNombre = evento.nombre || evento.nombrePareja || "Evento"
      const cuotasPagadas = evento.planDeCuotas?.cuotasPagadas || []

      // Caso 1: Tiene array de cuotas detallado
      if (evento.planDeCuotas?.cuotas && evento.planDeCuotas.cuotas.length > 0) {
        for (const cuota of evento.planDeCuotas.cuotas) {
          if (cuota.pagada || cuotasPagadas.includes(cuota.numero)) continue
          const fechaCuota = parseLocalDate(cuota.fechaVencimiento)
          if (!fechaCuota || fechaCuota < hoy || fechaCuota > fechaLimite) continue

          cuotasPendientes.push({
            eventoId: evento.id,
            eventoNombre,
            numeroCuota: cuota.numero,
            monto: cuota.montoCuota,
            fechaVencimiento: cuota.fechaVencimiento || "",
          })
        }
      }
      // Caso 2: Tiene planDeCuotas con numeroCuotas y montoCuota pero sin array detallado
      else if (evento.planDeCuotas?.numeroCuotas && evento.planDeCuotas?.montoCuota) {
        const { numeroCuotas, montoCuota, fechaInicioPlan, diaVencimiento } = evento.planDeCuotas
        const fechaInicio = parseLocalDate(fechaInicioPlan) || hoy

        for (let i = 1; i <= numeroCuotas; i++) {
          if (cuotasPagadas.includes(i)) continue

          // Calcular fecha de vencimiento: avanzar i-1 meses desde fechaInicio
          const fechaVenc = new Date(fechaInicio)
          fechaVenc.setMonth(fechaVenc.getMonth() + (i - 1))
          if (diaVencimiento) fechaVenc.setDate(diaVencimiento)

          if (fechaVenc < hoy || fechaVenc > fechaLimite) continue

          cuotasPendientes.push({
            eventoId: evento.id,
            eventoNombre,
            numeroCuota: i,
            monto: montoCuota,
            fechaVencimiento: `${fechaVenc.getFullYear()}-${String(fechaVenc.getMonth() + 1).padStart(2, "0")}-${String(fechaVenc.getDate()).padStart(2, "0")}`,
          })
        }
      }
      // Caso 3: Sin plan de cuotas pero con precioVenta - mostrar saldo como cuota única
      else if (evento.precioFinal || evento.precioVenta) {
        const precioTotal = evento.precioFinal || evento.precioVenta || 0
        const pagos = evento.pagos || []
        const totalPagado = pagos.reduce((sum: number, p: any) => sum + (p.monto || 0), 0) + (evento.planDeCuotas?.montoSena || 0)
        const saldoPendiente = precioTotal - totalPagado

        if (saldoPendiente <= 0) continue

        const fechaEvento = parseLocalDate(evento.fecha)
        if (!fechaEvento || fechaEvento < hoy || fechaEvento > fechaLimite) continue

        cuotasPendientes.push({
          eventoId: evento.id,
          eventoNombre,
          numeroCuota: 1,
          monto: saldoPendiente,
          fechaVencimiento: evento.fecha,
        })
      }
    }

    const totalEntra = cuotasPendientes.reduce((sum, c) => sum + c.monto, 0)

    // Egresos pendientes
    const egresosPendientes: EgresoPendiente[] = []

    // 1. Costos operativos del salón
    const costosDelSalon = (costosOperativos || []).filter(
      (c) => c.activo && (c.salon === salon || (!c.salon && salon !== "admin"))
    )
    for (const costo of costosDelSalon) {
      if (!costo.fechaVencimiento) continue
      const fechaCosto = parseLocalDate(costo.fechaVencimiento)
      if (!fechaCosto || fechaCosto < hoy || fechaCosto > fechaLimite) continue

      egresosPendientes.push({
        id: costo.id,
        concepto: costo.nombre,
        tipo: "costo_operativo",
        monto: costo.monto,
        fecha: costo.fechaVencimiento,
      })
    }

    // 2. Señas a proveedores de eventos del salón
    for (const evento of eventosSalon) {
      if (!evento.servicios) continue
      for (const srv of evento.servicios) {
        if (srv.estadoPago === "pagado_total") continue
        const fechaLimitePago = parseLocalDate(srv.fechaLimitePago)
        if (!fechaLimitePago || fechaLimitePago < hoy || fechaLimitePago > fechaLimite) continue

        // Monto EN VIVO desde el catálogo de servicios
        const { montoSeña: señaLive, saldoPendiente: saldoLive } = calcularSeñaSaldoServicio(srv, { servicios })
        const monto = saldoLive > 0 ? saldoLive : señaLive
        if (monto <= 0) continue

        egresosPendientes.push({
          id: `${evento.id}-${srv.servicioId}`,
          concepto: `${srv.nombre} (${evento.nombre || evento.nombrePareja || "Evento"})`,
          tipo: "seña_proveedor",
          monto,
          fecha: srv.fechaLimitePago || "",
        })
      }
    }

    // 3. Pagos de personal pendientes de eventos del salón
    const eventoIds = new Set(eventosSalon.map((e) => e.id))
    const pagosPendientes = (pagosPersonal || []).filter(
      (p) => p.eventoId && eventoIds.has(p.eventoId) && (p.estado === "pendiente" || p.estado === "vencido")
    )
    for (const pago of pagosPendientes) {
      const fechaPago = parseLocalDate(pago.fechaPago)
      if (!fechaPago || fechaPago < hoy || fechaPago > fechaLimite) continue

      egresosPendientes.push({
        id: pago.id,
        concepto: `${pago.rol || "Personal"} - ${pago.nombre}`,
        tipo: "pago_personal",
        monto: pago.monto,
        fecha: pago.fechaPago,
      })
    }

    const totalSale = egresosPendientes.reduce((sum, e) => sum + e.monto, 0)
    const proyectado = saldoActual + totalEntra - totalSale

    // Eventos del período
    const eventosResumen: EventoResumen[] = eventosSalon
      .filter((e) => {
        const fechaEvento = parseLocalDate(e.fecha)
        return fechaEvento && fechaEvento >= hoy && fechaEvento <= fechaLimite
      })
      .map((e) => {
        const precioVenta = e.precioFinal || e.precioVenta || 0
        const cuotasPagadas = e.planDeCuotas?.cuotasPagadas || []
        const montoCuota = e.planDeCuotas?.montoCuota || 0
        const totalCobrado = cuotasPagadas.length * montoCuota + (e.planDeCuotas?.montoSena || 0)
        return {
          id: e.id,
          nombre: e.nombre || e.nombrePareja || "Evento",
          fecha: e.fecha,
          precioVenta,
          totalCobrado,
          saldoPendiente: precioVenta - totalCobrado,
        }
      })

    return {
      saldoActual,
      totalEntra,
      totalSale,
      proyectado,
      cuotasPendientes: cuotasPendientes.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento)),
      egresosPendientes: egresosPendientes.sort((a, b) => a.fecha.localeCompare(b.fecha)),
      eventosResumen: eventosResumen.sort((a, b) => a.fecha.localeCompare(b.fecha)),
    }
  }, [salon, horizonte, eventos, costosOperativos, pagosPersonal, configuracionCajas, movimientosCaja, servicios])
}

function SalonCashflowCard({ salon, horizonte }: { salon: string; horizonte: Horizonte }) {
  const data = useCashflowData(salon, horizonte)
  const [openIngresos, setOpenIngresos] = useState(false)
  const [openEgresos, setOpenEgresos] = useState(false)
  const [openEventos, setOpenEventos] = useState(false)

  const isAdmin = salon === "admin"

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {isAdmin ? "Administracion General" : salonLabel(salon)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen en fila */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Saldo Hoy</p>
            <p className={`text-lg font-bold ${data.saldoActual >= 0 ? "text-foreground" : "text-red-600"}`}>
              {formatCurrency(data.saldoActual)}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3 text-center">
            <p className="text-xs text-emerald-700 mb-1">Entra</p>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(data.totalEntra)}</p>
          </div>
          <div className="rounded-lg bg-red-50 p-3 text-center">
            <p className="text-xs text-red-700 mb-1">Sale</p>
            <p className="text-lg font-bold text-red-700">{formatCurrency(data.totalSale)}</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${data.proyectado >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
            <p className={`text-xs mb-1 ${data.proyectado >= 0 ? "text-emerald-700" : "text-red-700"}`}>Proyectado</p>
            <p className={`text-lg font-bold ${data.proyectado >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {formatCurrency(data.proyectado)}
            </p>
          </div>
        </div>

        {/* Desglose colapsable */}
        <div className="space-y-2">
          {/* Ingresos esperados */}
          <Collapsible open={openIngresos} onOpenChange={setOpenIngresos}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between h-9 px-3 text-sm">
                <span className="flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                  Ingresos esperados ({data.cuotasPendientes.length})
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${openIngresos ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {data.cuotasPendientes.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2">Sin ingresos esperados</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {data.cuotasPendientes.map((c) => (
                    <div key={`${c.eventoId}-${c.numeroCuota}`} className="flex items-center justify-between px-3 py-1.5 rounded bg-muted/30 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.eventoNombre}</p>
                        <p className="text-xs text-muted-foreground">Cuota {c.numeroCuota} - {formatFecha(c.fechaVencimiento)}</p>
                      </div>
                      <span className="font-semibold text-emerald-700 shrink-0 ml-2">{formatCurrency(c.monto)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Egresos pendientes */}
          <Collapsible open={openEgresos} onOpenChange={setOpenEgresos}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between h-9 px-3 text-sm">
                <span className="flex items-center gap-2">
                  <ArrowDownCircle className="h-4 w-4 text-red-500" />
                  Egresos pendientes ({data.egresosPendientes.length})
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${openEgresos ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {data.egresosPendientes.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2">Sin egresos pendientes</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {data.egresosPendientes.map((e) => (
                    <div key={e.id} className="flex items-center justify-between px-3 py-1.5 rounded bg-muted/30 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{e.concepto}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.tipo === "costo_operativo" && "Gasto fijo"}
                          {e.tipo === "seña_proveedor" && "Seña proveedor"}
                          {e.tipo === "pago_personal" && "Personal"}
                          {" - "}{formatFecha(e.fecha)}
                        </p>
                      </div>
                      <span className="font-semibold text-red-600 shrink-0 ml-2">{formatCurrency(e.monto)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Eventos del período */}
          {!isAdmin && (
            <Collapsible open={openEventos} onOpenChange={setOpenEventos}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between h-9 px-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    Eventos del periodo ({data.eventosResumen.length})
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openEventos ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                {data.eventosResumen.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">Sin eventos en el periodo</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {data.eventosResumen.map((ev) => (
                      <div key={ev.id} className="rounded-lg border bg-card p-3 text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold truncate">{ev.nombre}</p>
                          <Badge variant="outline" className="text-xs shrink-0">{formatFecha(ev.fecha)}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Precio</p>
                            <p className="font-medium">{formatCurrency(ev.precioVenta)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cobrado</p>
                            <p className="font-medium text-emerald-700">{formatCurrency(ev.totalCobrado)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Pendiente</p>
                            <p className={`font-medium ${ev.saldoPendiente > 0 ? "text-amber-600" : "text-emerald-700"}`}>
                              {formatCurrency(ev.saldoPendiente)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function CashflowPage() {
  const [horizonte, setHorizonte] = useState<Horizonte>(30)

  // Calcular resumen global
  const { configuracionCajas, movimientosCaja, eventos, costosOperativos, pagosPersonal, servicios } = useStore()

  const resumenGlobal = useMemo(() => {
    let saldoTotal = 0
    let totalEntra = 0
    let totalSale = 0

    for (const salon of SALONES) {
      const data = useCashflowDataPure(
        salon,
        horizonte,
        eventos || [],
        costosOperativos || [],
        pagosPersonal || [],
        configuracionCajas,
        movimientosCaja || [],
        servicios || []
      )
      saldoTotal += data.saldoActual
      totalEntra += data.totalEntra
      totalSale += data.totalSale
    }

    // Admin
    const adminData = useCashflowDataPure(
      "admin",
      horizonte,
      eventos || [],
      costosOperativos || [],
      pagosPersonal || [],
      configuracionCajas,
      movimientosCaja || [],
      servicios || []
    )
    saldoTotal += adminData.saldoActual
    totalEntra += adminData.totalEntra
    totalSale += adminData.totalSale

    return {
      saldoTotal,
      totalEntra,
      totalSale,
      proyectado: saldoTotal + totalEntra - totalSale,
    }
  }, [horizonte, configuracionCajas, movimientosCaja, eventos, costosOperativos, pagosPersonal, servicios])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel de Cashflow</h1>
          <p className="text-sm text-muted-foreground">Proyeccion financiera por salon</p>
        </div>
        <Select value={String(horizonte)} onValueChange={(v) => setHorizonte(Number(v) as Horizonte)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="60">60 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards por salón */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SALONES.map((salon) => (
          <SalonCashflowCard key={salon} salon={salon} horizonte={horizonte} />
        ))}
        <SalonCashflowCard salon="admin" horizonte={horizonte} />
      </div>

      {/* Resumen global */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            Resumen Global
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg bg-background p-4 text-center border">
              <p className="text-sm text-muted-foreground mb-1">Saldo Total Hoy</p>
              <p className={`text-2xl font-bold ${resumenGlobal.saldoTotal >= 0 ? "text-foreground" : "text-red-600"}`}>
                {formatCurrency(resumenGlobal.saldoTotal)}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-4 text-center border border-emerald-200">
              <p className="text-sm text-emerald-700 mb-1">Total Entra</p>
              <p className="text-2xl font-bold text-emerald-700">{formatCurrency(resumenGlobal.totalEntra)}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center border border-red-200">
              <p className="text-sm text-red-700 mb-1">Total Sale</p>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(resumenGlobal.totalSale)}</p>
            </div>
            <div className={`rounded-lg p-4 text-center border ${resumenGlobal.proyectado >= 0 ? "bg-emerald-100 border-emerald-300" : "bg-red-100 border-red-300"}`}>
              <p className={`text-sm mb-1 ${resumenGlobal.proyectado >= 0 ? "text-emerald-700" : "text-red-700"}`}>Proyectado Global</p>
              <p className={`text-2xl font-bold ${resumenGlobal.proyectado >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {formatCurrency(resumenGlobal.proyectado)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Versión pura del cálculo para usar en useMemo del resumen global
function useCashflowDataPure(
  salon: string,
  horizonte: Horizonte,
  eventos: EventoGuardado[],
  costosOperativos: CostoOperativo[],
  pagosPersonal: PagoPersonal[],
  configuracionCajas: ReturnType<typeof useStore>["configuracionCajas"],
  movimientosCaja: ReturnType<typeof useStore>["movimientosCaja"],
  servicios: Servicio[] = []
) {
  const hoy = new Date()
  const fechaLimite = new Date(hoy)
  fechaLimite.setDate(fechaLimite.getDate() + horizonte)

  const { saldoActual } = calcularSaldoCaja(salon, configuracionCajas, movimientosCaja)

  const eventosSalon = eventos.filter(
    (e) => e.salon === salon && e.estado !== "cancelado" && e.estado !== "completado"
  )

  // Cuotas pendientes
  let totalEntra = 0
  for (const evento of eventosSalon) {
    if (!evento.planDeCuotas?.cuotas) continue
    const cuotasPagadas = evento.planDeCuotas.cuotasPagadas || []

    for (const cuota of evento.planDeCuotas.cuotas) {
      if (cuota.pagada || cuotasPagadas.includes(cuota.numero)) continue
      const fechaCuota = parseLocalDate(cuota.fechaVencimiento)
      if (!fechaCuota || fechaCuota < hoy || fechaCuota > fechaLimite) continue
      totalEntra += cuota.montoCuota
    }
  }

  // Egresos
  let totalSale = 0

  // Costos operativos
  const costosDelSalon = costosOperativos.filter(
    (c) => c.activo && (c.salon === salon || (!c.salon && salon !== "admin"))
  )
  for (const costo of costosDelSalon) {
    if (!costo.fechaVencimiento) continue
    const fechaCosto = parseLocalDate(costo.fechaVencimiento)
    if (!fechaCosto || fechaCosto < hoy || fechaCosto > fechaLimite) continue
    totalSale += costo.monto
  }

  // Señas proveedores
  for (const evento of eventosSalon) {
    if (!evento.servicios) continue
    for (const srv of evento.servicios) {
      if (srv.estadoPago === "pagado_total") continue
      const fechaLimitePago = parseLocalDate(srv.fechaLimitePago)
      if (!fechaLimitePago || fechaLimitePago < hoy || fechaLimitePago > fechaLimite) continue
      // Monto EN VIVO desde el catálogo de servicios
      const { montoSeña: señaLive, saldoPendiente: saldoLive } = calcularSeñaSaldoServicio(srv, { servicios })
      const monto = saldoLive > 0 ? saldoLive : señaLive
      if (monto > 0) totalSale += monto
    }
  }

  // Pagos personal
  const eventoIds = new Set(eventosSalon.map((e) => e.id))
  const pagosPendientes = pagosPersonal.filter(
    (p) => p.eventoId && eventoIds.has(p.eventoId) && (p.estado === "pendiente" || p.estado === "vencido")
  )
  for (const pago of pagosPendientes) {
    const fechaPago = parseLocalDate(pago.fechaPago)
    if (!fechaPago || fechaPago < hoy || fechaPago > fechaLimite) continue
    totalSale += pago.monto
  }

  return { saldoActual, totalEntra, totalSale }
}

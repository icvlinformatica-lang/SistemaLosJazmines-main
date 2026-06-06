"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/utils-financieros"
import { useStore } from "@/lib/store-context"
import { useCajaEventos } from "@/lib/hooks/use-caja-eventos"
import type {
  EgresoPendienteServicio,
  IngresoPendiente,
} from "@/lib/hooks/use-caja-eventos"
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Phone,
  Mail,
  MapPin,
  User,
  CreditCard,
  CheckCircle2,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react"

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function formatFecha(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  })
}

function vencBadge(dias: number) {
  if (dias < 0)
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">vencido</Badge>
  if (dias <= 3)
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">{dias}d</Badge>
  if (dias <= 7)
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]">{dias}d</Badge>
  return <Badge variant="outline" className="text-[11px]">{dias}d</Badge>
}

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------
export default function CajaEventosPage() {
  const { state, updateEvento } = useStore()
  const data = useCajaEventos(state)
  const [clienteSel, setClienteSel] = useState<IngresoPendiente | null>(null)
  const [mesCalendario, setMesCalendario] = useState(() => {
    const h = new Date()
    return new Date(h.getFullYear(), h.getMonth(), 1)
  })

  const {
    saldoActual,
    porCobrarEsteMes,
    porPagarEsteMes,
    saldoFinMes,
    proyeccionMensual,
    ingresosPendientes,
    egresosPendientes,
    vienenEstaSemana,
    totalPorCobrar,
    totalPorPagar,
    mesActualLabel,
  } = data

  // Marcar egreso de proveedor como pagado
  const handleMarcarPagado = (egreso: EgresoPendienteServicio) => {
    const evento = state.eventos.find((e) => e.id === egreso.eventoId)
    if (!evento) return
    const nuevosServicios = (evento.servicios ?? []).map((srv) => {
      if (!egreso.id.includes(srv.servicioId)) return srv
      if (egreso.tipo === "seña") return { ...srv, estadoPago: "señado" as const }
      return { ...srv, estadoPago: "pagado_total" as const }
    })
    updateEvento(egreso.eventoId, { servicios: nuevosServicios })
  }

  // Datos del calendario del mes seleccionado
  const calendario = useMemo(() => {
    const year = mesCalendario.getFullYear()
    const month = mesCalendario.getMonth()
    const primerDia = new Date(year, month, 1)
    const diaInicio = primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1 // lunes=0
    const diasEnMes = new Date(year, month + 1, 0).getDate()

    // Mapear eventos financieros por día
    const porDia: Record<number, { cobrar: number; pagar: number }> = {}
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`
    for (const ing of ingresosPendientes) {
      if (ing.fechaVencimiento.slice(0, 7) !== monthKey) continue
      const dia = Number(ing.fechaVencimiento.slice(8, 10))
      porDia[dia] = porDia[dia] || { cobrar: 0, pagar: 0 }
      porDia[dia].cobrar += ing.monto
    }
    for (const eg of egresosPendientes) {
      if (eg.fechaVencimiento.slice(0, 7) !== monthKey) continue
      const dia = Number(eg.fechaVencimiento.slice(8, 10))
      porDia[dia] = porDia[dia] || { cobrar: 0, pagar: 0 }
      porDia[dia].pagar += eg.monto
    }

    const celdas: Array<{ dia: number | null; cobrar: number; pagar: number }> = []
    for (let i = 0; i < diaInicio; i++) celdas.push({ dia: null, cobrar: 0, pagar: 0 })
    for (let d = 1; d <= diasEnMes; d++) {
      celdas.push({ dia: d, cobrar: porDia[d]?.cobrar || 0, pagar: porDia[d]?.pagar || 0 })
    }
    return { celdas, label: mesCalendario.toLocaleDateString("es-AR", { month: "long", year: "numeric" }) }
  }, [mesCalendario, ingresosPendientes, egresosPendientes])

  const cambiarMes = (delta: number) =>
    setMesCalendario((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))

  const hoyNum = new Date().getDate()
  const esMesActualCal =
    mesCalendario.getMonth() === new Date().getMonth() &&
    mesCalendario.getFullYear() === new Date().getFullYear()

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
          <Wallet className="h-5 w-5 text-teal-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Caja Eventos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Qué debo cobrar y pagar, mes a mes. <span className="capitalize">{mesActualLabel}</span>.
          </p>
        </div>
      </div>

      {/* DASHBOARD: 4 métricas clave */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-teal-200 bg-teal-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-medium text-teal-700 uppercase tracking-wide">Tengo ahora</p>
              <Wallet className="h-4 w-4 text-teal-600" />
            </div>
            <p className="text-2xl font-bold text-teal-800">{formatCurrency(saldoActual)}</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-medium text-emerald-700 uppercase tracking-wide">Cobro este mes</p>
              <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-800">+{formatCurrency(porCobrarEsteMes)}</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-medium text-red-700 uppercase tracking-wide">Pago este mes</p>
              <ArrowUpFromLine className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-700">−{formatCurrency(porPagarEsteMes)}</p>
          </CardContent>
        </Card>

        <Card className={saldoFinMes >= 0 ? "border-teal-200" : "border-red-300"}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Al fin de mes</p>
              <TrendingUp className={`h-4 w-4 ${saldoFinMes >= 0 ? "text-teal-600" : "text-red-600"}`} />
            </div>
            <p className={`text-2xl font-bold ${saldoFinMes >= 0 ? "text-foreground" : "text-red-700"}`}>
              {formatCurrency(saldoFinMes)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vienen esta semana a pagar (L-V 09-20hs) */}
      <Card className="border-amber-200 bg-amber-50/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-amber-600" />
            Vienen esta semana a pagar
            <span className="text-xs font-normal text-muted-foreground">(Lun a Vie · 09 a 20hs)</span>
            {vienenEstaSemana.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 ml-1">
                {vienenEstaSemana.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vienenEstaSemana.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nadie tiene cuotas que venzan esta semana.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {vienenEstaSemana.map((ing) => (
                <button
                  key={ing.id}
                  onClick={() => setClienteSel(ing)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-card p-3 text-left hover:bg-amber-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{ing.contacto.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {ing.eventoNombre} · Cuota {ing.numeroCuota}/{ing.totalCuotas} · vence {formatFecha(ing.fechaVencimiento)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-emerald-700">+{formatCurrency(ing.monto)}</span>
                    {ing.contacto.telefono && <Phone className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PROYECCIÓN MENSUAL — tabla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-600" />
            Proyección mensual (6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Mes</TableHead>
                <TableHead className="text-right">A cobrar</TableHead>
                <TableHead className="text-right">A pagar</TableHead>
                <TableHead className="text-right pr-6">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proyeccionMensual.map((m) => (
                <TableRow key={m.key} className={m.esActual ? "bg-teal-50/60" : ""}>
                  <TableCell className="pl-6 capitalize font-medium">
                    {m.label}
                    {m.esActual && <Badge className="ml-2 bg-teal-100 text-teal-700 border-teal-200 text-[10px]">actual</Badge>}
                  </TableCell>
                  <TableCell className="text-right text-emerald-700 font-medium">
                    {m.aCobrar > 0 ? `+${formatCurrency(m.aCobrar)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-red-600 font-medium">
                    {m.aPagar > 0 ? `−${formatCurrency(m.aPagar)}` : "—"}
                  </TableCell>
                  <TableCell className={`text-right pr-6 font-bold ${m.balance >= 0 ? "text-foreground" : "text-red-600"}`}>
                    {m.balance >= 0 ? "+" : ""}{formatCurrency(m.balance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CALENDARIO mensual */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 capitalize">
              <CalendarDays className="h-4 w-4 text-teal-600" />
              {calendario.label}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => cambiarMes(-1)}>‹</Button>
              <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => cambiarMes(1)}>›</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendario.celdas.map((celda, i) => {
              const esHoy = esMesActualCal && celda.dia === hoyNum
              const tieneMov = celda.cobrar > 0 || celda.pagar > 0
              return (
                <div
                  key={i}
                  className={`min-h-[58px] rounded-md border p-1 text-[10px] ${
                    celda.dia === null
                      ? "border-transparent"
                      : esHoy
                      ? "border-teal-400 bg-teal-50"
                      : tieneMov
                      ? "border-border bg-muted/30"
                      : "border-border"
                  }`}
                >
                  {celda.dia !== null && (
                    <>
                      <div className={`font-medium ${esHoy ? "text-teal-700" : "text-foreground"}`}>{celda.dia}</div>
                      {celda.cobrar > 0 && (
                        <div className="text-emerald-700 font-medium truncate">+{formatCurrency(celda.cobrar)}</div>
                      )}
                      {celda.pagar > 0 && (
                        <div className="text-red-600 font-medium truncate">−{formatCurrency(celda.pagar)}</div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> A cobrar</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> A pagar</span>
          </div>
        </CardContent>
      </Card>

      {/* TABS: Cobros / Pagos */}
      <Tabs defaultValue="cobrar" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cobrar" className="gap-1.5">
            <ArrowDownToLine className="h-4 w-4" /> Por cobrar
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] ml-1">
              {ingresosPendientes.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pagar" className="gap-1.5">
            <ArrowUpFromLine className="h-4 w-4" /> Por pagar
            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] ml-1">
              {egresosPendientes.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* POR COBRAR */}
        <TabsContent value="cobrar" className="mt-4">
          <Card>
            <CardContent className="px-0 py-2">
              {ingresosPendientes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No hay cuotas pendientes de cobro.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Cliente / Evento</TableHead>
                      <TableHead>Cuota</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead className="text-right pr-6">A cobrar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingresosPendientes.map((ing) => (
                      <TableRow
                        key={ing.id}
                        className="cursor-pointer"
                        onClick={() => setClienteSel(ing)}
                      >
                        <TableCell className="pl-6">
                          <p className="font-medium text-sm">{ing.contacto.nombre}</p>
                          <p className="text-xs text-muted-foreground">{ing.eventoNombre} · {ing.salon}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ing.numeroCuota}/{ing.totalCuotas}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{formatFecha(ing.fechaVencimiento)}</span>
                            {vencBadge(ing.diasRestantes)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6 font-bold text-emerald-700">
                          +{formatCurrency(ing.monto)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {ingresosPendientes.length > 0 && (
                <div className="flex items-center justify-between px-6 pt-3 mt-1 border-t border-border">
                  <span className="text-sm font-medium text-muted-foreground">Total por cobrar</span>
                  <span className="text-base font-bold text-emerald-700">+{formatCurrency(totalPorCobrar)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* POR PAGAR */}
        <TabsContent value="pagar" className="mt-4">
          <Card>
            <CardContent className="px-0 py-2">
              {egresosPendientes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No hay pagos a proveedores pendientes.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Evento / Servicio</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead className="text-right">A pagar</TableHead>
                      <TableHead className="text-right pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {egresosPendientes.map((eg) => (
                      <TableRow key={eg.id}>
                        <TableCell className="pl-6">
                          <p className="font-medium text-sm">{eg.servicioNombre}</p>
                          <p className="text-xs text-muted-foreground">{eg.eventoNombre}</p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={eg.tipo === "seña"
                              ? "bg-amber-50 text-amber-700 border-amber-200 text-[11px]"
                              : "bg-orange-50 text-orange-700 border-orange-200 text-[11px]"}
                          >
                            {eg.tipo === "seña" ? "Seña" : "Saldo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{formatFecha(eg.fechaVencimiento)}</span>
                            {vencBadge(eg.diasRestantes)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          −{formatCurrency(eg.monto)}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleMarcarPagado(eg)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Pagado
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {egresosPendientes.length > 0 && (
                <div className="flex items-center justify-between px-6 pt-3 mt-1 border-t border-border">
                  <span className="text-sm font-medium text-muted-foreground">Total por pagar</span>
                  <span className="text-base font-bold text-red-600">−{formatCurrency(totalPorPagar)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG: datos de contacto del cliente */}
      <Dialog open={!!clienteSel} onOpenChange={(open) => !open && setClienteSel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-4 w-4 text-teal-600" />
              {clienteSel?.contacto.nombre}
            </DialogTitle>
            <DialogDescription>
              {clienteSel?.eventoNombre} · Cuota {clienteSel?.numeroCuota}/{clienteSel?.totalCuotas}
            </DialogDescription>
          </DialogHeader>
          {clienteSel && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center justify-between">
                <span className="text-sm text-emerald-700">A cobrar (vence {formatFecha(clienteSel.fechaVencimiento)})</span>
                <span className="text-lg font-bold text-emerald-800">+{formatCurrency(clienteSel.monto)}</span>
              </div>
              <div className="space-y-2.5 text-sm">
                {clienteSel.contacto.telefono ? (
                  <a
                    href={`tel:${clienteSel.contacto.telefono}`}
                    className="flex items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/50"
                  >
                    <Phone className="h-4 w-4 text-teal-600 shrink-0" />
                    <span className="font-medium">{clienteSel.contacto.telefono}</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" /> Sin teléfono cargado
                  </div>
                )}
                {clienteSel.contacto.email && (
                  <a
                    href={`mailto:${clienteSel.contacto.email}`}
                    className="flex items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/50"
                  >
                    <Mail className="h-4 w-4 text-teal-600 shrink-0" />
                    <span className="truncate">{clienteSel.contacto.email}</span>
                  </a>
                )}
                {clienteSel.contacto.direccion && (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                    <MapPin className="h-4 w-4 text-teal-600 shrink-0" />
                    <span>{clienteSel.contacto.direccion}</span>
                  </div>
                )}
                {clienteSel.contacto.dni && (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                    <CreditCard className="h-4 w-4 text-teal-600 shrink-0" />
                    <span>DNI {clienteSel.contacto.dni}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

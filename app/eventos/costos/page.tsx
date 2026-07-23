"use client"

import { Suspense, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useStore } from "@/lib/store-context"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils-financieros"
import {
  generateId,
  generarCalendarioCuotas,
  calcularComprasSegmentadas,
  calcularComprasBarras,
  salonLabel,
  type MovimientoCaja,
} from "@/lib/store"
import {
  ArrowLeft,
  ChefHat,
  Wine,
  ConciergeBell,
  Users,
  CreditCard,
  StickyNote,
  CheckCircle2,
  CalendarDays,
} from "lucide-react"

function formatFecha(dateStr?: string): string {
  if (!dateStr) return "—"
  const [y, m, d] = dateStr.split("-").map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function CostosEventoContent() {
  const searchParams = useSearchParams()
  const eventoId = searchParams.get("id") || ""
  const { state, updateEvento, addMovimientosCaja, deleteMovimientoCaja } = useStore()
  const { toast } = useToast()

  const evento = state.eventos.find((e) => e.id === eventoId)

  // Observación guardada dentro de costosCalculados (JSON ya persistido del evento)
  const observacionGuardada =
    ((evento?.costosCalculados as Record<string, unknown> | null)?.observacionCostos as string) || ""
  const [observacion, setObservacion] = useState(observacionGuardada)
  const [guardandoObs, setGuardandoObs] = useState(false)

  // --- Costos calculados en vivo ---
  const comprasCocina = useMemo(
    () => (evento ? calcularComprasSegmentadas(evento, state.recetas || [], state.insumos || []) : []),
    [evento, state.recetas, state.insumos],
  )
  const comprasBarra = useMemo(
    () => (evento ? calcularComprasBarras(evento, state.cocteles || [], state.insumosBarra || []) : []),
    [evento, state.cocteles, state.insumosBarra],
  )
  const cuotas = useMemo(() => (evento ? generarCalendarioCuotas(evento) : []), [evento])

  if (!evento) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-10">
        <p className="text-muted-foreground">Evento no encontrado.</p>
        <Button asChild variant="outline" className="mt-4 bg-transparent">
          <Link href="/eventos/lista">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver a la lista
          </Link>
        </Button>
      </main>
    )
  }

  const nombreEvento = evento.nombre || evento.nombrePareja || "Evento sin nombre"
  const costoCocina = comprasCocina.reduce((s, c) => s + c.costoMateriaPrima, 0)
  const costoBarra = comprasBarra.reduce((s, c) => s + c.costoMateriaPrima, 0)
  const servicios = evento.servicios || []
  const personal = (evento.personalEvento || []).filter((pe) => (pe.monto || 0) > 0)

  // --- Progreso de cuotas del cliente ---
  const cuotasPagadas = cuotas.filter((c) => c.pagada)
  const montoTotalCuotas = cuotas.reduce((s, c) => s + c.monto, 0)
  const montoCobrado = cuotasPagadas.reduce((s, c) => s + c.monto, 0)
  const progresoCuotas = montoTotalCuotas > 0 ? Math.round((montoCobrado / montoTotalCuotas) * 100) : 0

  // ------------------------------------------------------------------
  // Registro/eliminación de egresos reales en Caja Eventos
  // (mismos formatos de concepto que Finanzas → Caja Eventos)
  // ------------------------------------------------------------------
  const registrarEgreso = (concepto: string, monto: number) => {
    const saldoPrev = (state.movimientosCaja ?? [])
      .filter((m) => m.cajaDestino === "caja_eventos")
      .reduce((sum, m) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto), 0)
    const movimiento: MovimientoCaja = {
      id: generateId(),
      fecha: new Date().toISOString(),
      tipo: "egreso",
      concepto,
      monto,
      salon: evento.salon || "",
      eventoId: evento.id,
      cajaDestino: "caja_eventos",
      saldoResultante: saldoPrev - monto,
    }
    addMovimientosCaja([movimiento])
  }

  // Busca y elimina el último egreso que coincide (para revertir un pago)
  const quitarEgreso = (concepto: string): MovimientoCaja | undefined => {
    const mov = [...(state.movimientosCaja ?? [])]
      .reverse()
      .find(
        (m) =>
          m.tipo === "egreso" &&
          m.cajaDestino === "caja_eventos" &&
          m.eventoId === evento.id &&
          m.concepto === concepto,
      )
    if (mov) deleteMovimientoCaja(mov.id)
    return mov
  }

  const hoyStr = new Date().toISOString().split("T")[0]

  // --- Cocina ---
  const toggleCocina = (checked: boolean) => {
    updateEvento(evento.id, { cocinaPagada: checked })
    const concepto = `Pago menú - ${nombreEvento}`
    if (checked) {
      registrarEgreso(concepto, costoCocina)
      toast({ title: "Cocina marcada como pagada", description: formatCurrency(costoCocina) })
    } else {
      quitarEgreso(concepto)
      toast({ title: "Pago de cocina revertido" })
    }
  }

  // --- Barra ---
  const toggleBarra = (checked: boolean) => {
    updateEvento(evento.id, { barraPagada: checked })
    const concepto = `Pago barra - ${nombreEvento}`
    if (checked) {
      registrarEgreso(concepto, costoBarra)
      toast({ title: "Barra marcada como pagada", description: formatCurrency(costoBarra) })
    } else {
      quitarEgreso(concepto)
      toast({ title: "Pago de barra revertido" })
    }
  }

  // --- Servicios: seña ---
  const toggleSena = (servicioId: string, checked: boolean) => {
    const srv = servicios.find((s) => s.servicioId === servicioId)
    if (!srv) return
    const concepto = `Pago seña ${srv.nombre} - ${nombreEvento}`
    const nuevosServicios = servicios.map((s) => {
      if (s.servicioId !== servicioId) return s
      if (checked) return { ...s, estadoPago: "señado" as const, fechaPagoSeña: hoyStr }
      return { ...s, estadoPago: "sin_seña" as const, fechaPagoSeña: undefined }
    })
    updateEvento(evento.id, { servicios: nuevosServicios })
    if (checked) {
      registrarEgreso(concepto, srv.montoSeña || 0)
      toast({ title: `Seña de ${srv.nombre} pagada`, description: formatCurrency(srv.montoSeña || 0) })
    } else {
      quitarEgreso(concepto)
      toast({ title: `Seña de ${srv.nombre} revertida` })
    }
  }

  // --- Servicios: saldo ---
  const toggleSaldo = (servicioId: string, checked: boolean) => {
    const srv = servicios.find((s) => s.servicioId === servicioId)
    if (!srv) return
    const concepto = `Pago saldo ${srv.nombre} - ${nombreEvento}`
    if (checked) {
      const monto = srv.saldoPendiente || 0
      const nuevosServicios = servicios.map((s) =>
        s.servicioId === servicioId
          ? { ...s, pagado: true, estadoPago: "pagado_total" as const, saldoPendiente: 0, fechaPagoSaldo: hoyStr }
          : s,
      )
      updateEvento(evento.id, { servicios: nuevosServicios })
      registrarEgreso(concepto, monto)
      toast({ title: `Saldo de ${srv.nombre} pagado`, description: formatCurrency(monto) })
    } else {
      const mov = quitarEgreso(concepto)
      const montoRestaurado = mov?.monto || 0
      const nuevosServicios = servicios.map((s) =>
        s.servicioId === servicioId
          ? {
              ...s,
              pagado: false,
              estadoPago: "saldo_pendiente" as const,
              saldoPendiente: montoRestaurado,
              fechaPagoSaldo: undefined,
            }
          : s,
      )
      updateEvento(evento.id, { servicios: nuevosServicios })
      toast({ title: `Saldo de ${srv.nombre} revertido` })
    }
  }

  // --- Personal ---
  const togglePersonal = (peId: string, checked: boolean) => {
    const pe = (evento.personalEvento || []).find((p) => p.id === peId)
    if (!pe) return
    const concepto = `Pago sueldo ${pe.nombre} (${pe.funcion}) - ${nombreEvento}`
    const nuevoPersonal = (evento.personalEvento || []).map((p) =>
      p.id === peId ? { ...p, pagado: checked } : p,
    )
    updateEvento(evento.id, { personalEvento: nuevoPersonal })
    if (checked) {
      registrarEgreso(concepto, pe.monto)
      toast({ title: `Sueldo de ${pe.nombre} pagado`, description: formatCurrency(pe.monto) })
    } else {
      quitarEgreso(concepto)
      toast({ title: `Sueldo de ${pe.nombre} revertido` })
    }
  }

  // --- Observación ---
  const guardarObservacion = async () => {
    setGuardandoObs(true)
    const costosCalculados = {
      ...((evento.costosCalculados as Record<string, unknown> | null) || {}),
      observacionCostos: observacion,
    }
    updateEvento(evento.id, { costosCalculados } as Partial<typeof evento>)
    setTimeout(() => setGuardandoObs(false), 600)
    toast({ title: "Observación guardada" })
  }

  // Estado de seña de un servicio
  const senaEstaPagada = (estadoPago?: string) =>
    estadoPago === "señado" || estadoPago === "saldo_pendiente" || estadoPago === "pagado_total"

  return (
    <main className="container mx-auto max-w-6xl px-4 py-6 space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link href="/eventos/lista" aria-label="Volver a la lista de eventos">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-balance">Costos del evento</h1>
            <p className="text-sm text-muted-foreground">
              {nombreEvento} · {salonLabel(evento.salon)} · {formatFecha(evento.fecha)}
            </p>
          </div>
        </div>
      </div>

      {/* Grilla 2x2 de costos para escritorio */}
      <div className="grid gap-5 lg:grid-cols-2 items-start">
      {/* Cocina */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ChefHat className="h-4 w-4 text-teal-600" />
              Cocina (menú e insumos)
            </CardTitle>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={!!evento.cocinaPagada}
                onCheckedChange={(v) => toggleCocina(v === true)}
                disabled={costoCocina <= 0}
                aria-label="Marcar cocina como pagada"
              />
              {evento.cocinaPagada ? (
                <span className="text-emerald-700">Pagado</span>
              ) : (
                <span className="text-muted-foreground">Marcar pagado</span>
              )}
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {comprasCocina.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin menú/insumos calculados para este evento.</p>
          ) : (
            <>
              <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                {comprasCocina.map((c) => (
                  <div key={c.insumoId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-muted-foreground">{c.insumo?.descripcion || c.insumoId}</span>
                    <span className="shrink-0 font-medium">{formatCurrency(c.costoMateriaPrima)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>Total cocina</span>
                <span className={evento.cocinaPagada ? "text-emerald-700" : "text-red-600"}>
                  {formatCurrency(costoCocina)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Barra */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wine className="h-4 w-4 text-teal-600" />
              Barra (insumos de bebidas)
            </CardTitle>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={!!evento.barraPagada}
                onCheckedChange={(v) => toggleBarra(v === true)}
                disabled={costoBarra <= 0}
                aria-label="Marcar barra como pagada"
              />
              {evento.barraPagada ? (
                <span className="text-emerald-700">Pagado</span>
              ) : (
                <span className="text-muted-foreground">Marcar pagado</span>
              )}
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {comprasBarra.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin barra configurada para este evento.</p>
          ) : (
            <>
              <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                {comprasBarra.map((c) => (
                  <div key={c.insumoBarraId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-muted-foreground">
                      {c.insumoBarra?.descripcion || c.insumoBarraId}
                    </span>
                    <span className="shrink-0 font-medium">{formatCurrency(c.costoMateriaPrima)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>Total barra</span>
                <span className={evento.barraPagada ? "text-emerald-700" : "text-red-600"}>
                  {formatCurrency(costoBarra)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Servicios */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ConciergeBell className="h-4 w-4 text-teal-600" />
            Servicios contratados (señas y saldos)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {servicios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin servicios contratados.</p>
          ) : (
            servicios.map((srv) => {
              const senaPagada = senaEstaPagada(srv.estadoPago)
              const saldoPagado = srv.estadoPago === "pagado_total" || srv.pagado === true
              return (
                <div key={srv.servicioId} className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-semibold">{srv.nombre}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(srv.montoSeña || 0) > 0 && (
                      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                        <span className="flex items-center gap-2">
                          <Checkbox
                            checked={senaPagada}
                            onCheckedChange={(v) => toggleSena(srv.servicioId, v === true)}
                            disabled={saldoPagado}
                            aria-label={`Marcar seña de ${srv.nombre} como pagada`}
                          />
                          Seña
                          {srv.fechaSeña && !senaPagada && (
                            <span className="text-xs text-muted-foreground">vence {formatFecha(srv.fechaSeña)}</span>
                          )}
                        </span>
                        <span className={`font-medium ${senaPagada ? "text-emerald-700" : "text-red-600"}`}>
                          {formatCurrency(srv.montoSeña || 0)}
                        </span>
                      </label>
                    )}
                    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <Checkbox
                          checked={saldoPagado}
                          onCheckedChange={(v) => toggleSaldo(srv.servicioId, v === true)}
                          aria-label={`Marcar saldo de ${srv.nombre} como pagado`}
                        />
                        Saldo
                        {srv.fechaLimitePago && !saldoPagado && (
                          <span className="text-xs text-muted-foreground">
                            vence {formatFecha(srv.fechaLimitePago)}
                          </span>
                        )}
                      </span>
                      <span className={`font-medium ${saldoPagado ? "text-emerald-700" : "text-red-600"}`}>
                        {saldoPagado ? "Pagado" : formatCurrency(srv.saldoPendiente || 0)}
                      </span>
                    </label>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Personal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-teal-600" />
            Personal del evento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {personal.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin personal asignado con costo.</p>
          ) : (
            personal.map((pe) => (
              <label
                key={pe.id}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Checkbox
                    checked={!!pe.pagado}
                    onCheckedChange={(v) => togglePersonal(pe.id, v === true)}
                    aria-label={`Marcar sueldo de ${pe.nombre} como pagado`}
                  />
                  <span className="font-medium">{pe.nombre}</span>
                  <Badge variant="outline" className="text-[11px]">
                    {pe.funcion}
                  </Badge>
                  {pe.fechaPago && !pe.pagado && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3" /> {formatFecha(pe.fechaPago)}
                    </span>
                  )}
                </span>
                <span className={`font-medium ${pe.pagado ? "text-emerald-700" : "text-red-600"}`}>
                  {formatCurrency(pe.monto)}
                </span>
              </label>
            ))
          )}
        </CardContent>
      </Card>
      </div>

      {/* Progreso de cuotas del cliente: ancho completo, barra verde */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            Cuotas cobradas al cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cuotas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este evento no tiene plan de cuotas.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">
                  {cuotasPagadas.length}/{cuotas.length} cuotas pagadas
                </span>
                <span className="text-muted-foreground">
                  <span className="font-semibold text-emerald-700">{formatCurrency(montoCobrado)}</span>
                  {" de "}
                  {formatCurrency(montoTotalCuotas)}
                </span>
              </div>
              <Progress
                value={progresoCuotas}
                className="h-4 bg-emerald-100 [&>div]:bg-emerald-600"
                aria-label={`${progresoCuotas}% de las cuotas cobradas`}
              />
              <div className="flex flex-wrap gap-1.5">
                {cuotas.map((c) => (
                  <span
                    key={c.numeroCuota}
                    title={`Cuota ${c.numeroCuota} · vence ${c.fechaVencimiento} · ${formatCurrency(c.monto)}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-semibold ${
                      c.pagada
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-border bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {c.numeroCuota}
                  </span>
                ))}
              </div>
              {progresoCuotas === 100 && (
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> El cliente pagó todas las cuotas.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Observaciones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <StickyNote className="h-4 w-4 text-teal-600" />
            Observaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Dejá una nota sobre los costos de este evento (proveedores, acuerdos, pendientes...)"
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={guardarObservacion}
              disabled={guardandoObs || observacion === observacionGuardada}
              className="bg-teal-600 text-white hover:bg-teal-700"
            >
              {guardandoObs ? "Guardando..." : "Guardar observación"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

export default function CostosEventoPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Cargando...</div>}>
      <CostosEventoContent />
    </Suspense>
  )
}

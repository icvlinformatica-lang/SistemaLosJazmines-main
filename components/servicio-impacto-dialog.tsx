"use client"

/**
 * Diálogo de impacto al cambiar un monto del catálogo de servicios
 * (Finanzas → Servicios).
 *
 * Los eventos NO guardan una foto del precio: los montos de seña y saldo se
 * recalculan en vivo desde el catálogo (ver `calcularSeñaSaldoServicio` en
 * lib/store.ts y el hook use-caja-eventos). Por eso, tocar una celda de precio
 * mueve plata en TODOS los eventos que tienen contratado ese servicio.
 *
 * Este diálogo muestra, antes de confirmar, exactamente cuánto cambia en el
 * sistema: total, por evento, y qué montos quedan congelados porque ya se
 * pagaron.
 */

import { useMemo } from "react"
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Lock,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  calcularSeñaSaldoServicio,
  salonLabel,
  type EventoGuardado,
  type Servicio,
  type ServicioEvento,
} from "@/lib/store"

export type CampoImpacto = "precioVenta" | "costoParaCajaEventos" | "porcentajeSeña"

interface ServicioImpactoDialogProps {
  /** Servicio del catálogo que se está editando (null = diálogo cerrado). */
  servicio: Servicio | null
  /** Campo del catálogo que cambia. */
  campo: CampoImpacto
  /** Valor nuevo para ese campo. */
  valorNuevo: number
  /** Todos los eventos del sistema. */
  eventos: EventoGuardado[]
  onConfirmar: () => void
  onCancelar: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)

/** Formatea una diferencia con signo explícito (+/−). */
const fmtDelta = (n: number) => (n === 0 ? "—" : `${n > 0 ? "+" : "−"}${fmt(Math.abs(n))}`)

const fmtFecha = (fecha?: string) => {
  if (!fecha) return "sin fecha"
  const [y, m, d] = fecha.split("-")
  if (!y || !m || !d) return fecha
  return `${d}/${m}/${y}`
}

const deltaColor = (n: number) =>
  n > 0 ? "text-rose-600" : n < 0 ? "text-emerald-600" : "text-muted-foreground"

const CAMPO_LABEL: Record<CampoImpacto, string> = {
  precioVenta: "precio de venta (contrato)",
  costoParaCajaEventos: "costo que impacta en Caja Eventos",
  porcentajeSeña: "seña que se le paga al proveedor",
}

/** Multiplicador de cantidad para el contrato: solo aplica Por Hora / Por Cantidad. */
const multContrato = (servicio: Servicio, srv: ServicioEvento) =>
  servicio.unidad === "Por Hora" || servicio.unidad === "Por Cantidad" ? srv.cantidad || 1 : 1

interface FilaImpacto {
  eventoId: string
  nombre: string
  salon: string
  fecha?: string
  cantidad: number
  estadoPago: string
  /** El evento ya no proyecta en Caja Eventos (cancelado / completado). */
  fueraDeCaja: boolean
  /** La seña ya fue pagada: ese monto queda congelado. */
  señaCongelada: boolean
  contratoAntes: number
  contratoDespues: number
  costoAntes: number
  costoDespues: number
  señaAntes: number
  señaDespues: number
  saldoAntes: number
  saldoDespues: number
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function ServicioImpactoDialog({
  servicio,
  campo,
  valorNuevo,
  eventos,
  onConfirmar,
  onCancelar,
}: ServicioImpactoDialogProps) {
  const datos = useMemo(() => {
    if (!servicio) return null

    const servicioNuevo: Servicio = { ...servicio, [campo]: valorNuevo }
    const ctxAntes = { servicios: [servicio] }
    const ctxDespues = { servicios: [servicioNuevo] }

    const filas: FilaImpacto[] = []

    for (const ev of eventos || []) {
      const srv = (ev.servicios || []).find((s) => s.servicioId === servicio.id)
      if (!srv) continue

      const antes = calcularSeñaSaldoServicio(srv, ctxAntes)
      const despues = calcularSeñaSaldoServicio(srv, ctxDespues)
      const mult = multContrato(servicio, srv)
      const estadoPago = srv.estadoPago ?? (srv.pagado ? "pagado_total" : "sin_seña")

      filas.push({
        eventoId: ev.id,
        nombre: ev.nombrePareja || ev.nombre || ev.tipoEvento || "Evento sin nombre",
        salon: ev.salon || "",
        fecha: ev.fecha || undefined,
        cantidad: srv.cantidad || 1,
        estadoPago,
        fueraDeCaja: ev.estado === "cancelado" || ev.estado === "completado",
        señaCongelada: estadoPago !== "sin_seña",
        contratoAntes: (servicio.precioVenta ?? 0) * mult,
        contratoDespues: (servicioNuevo.precioVenta ?? 0) * mult,
        costoAntes: antes.costoTotal,
        costoDespues: despues.costoTotal,
        señaAntes: antes.montoSeña,
        señaDespues: despues.montoSeña,
        saldoAntes: antes.saldoPendiente,
        saldoDespues: despues.saldoPendiente,
      })
    }

    // Los eventos más próximos primero: son los que se cobran/pagan antes.
    filas.sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"))

    const activas = filas.filter((f) => !f.fueraDeCaja)
    const sum = (arr: FilaImpacto[], key: keyof FilaImpacto) =>
      arr.reduce((s, f) => s + (f[key] as number), 0)

    return {
      filas,
      totales: {
        contratoAntes: sum(filas, "contratoAntes"),
        contratoDespues: sum(filas, "contratoDespues"),
        // Caja Eventos solo proyecta eventos vigentes.
        señaAntes: sum(activas, "señaAntes"),
        señaDespues: sum(activas, "señaDespues"),
        saldoAntes: sum(activas, "saldoAntes"),
        saldoDespues: sum(activas, "saldoDespues"),
        costoAntes: sum(activas, "costoAntes"),
        costoDespues: sum(activas, "costoDespues"),
      },
      cantidadFueraDeCaja: filas.length - activas.length,
      cantidadCongeladas: filas.filter((f) => f.señaCongelada).length,
    }
  }, [servicio, campo, valorNuevo, eventos])

  if (!servicio || !datos) return null

  const esContrato = campo === "precioVenta"
  const valorAnterior = (servicio[campo] as number) ?? 0
  const unidadValor = campo === "porcentajeSeña" ? "%" : ""
  const { filas, totales } = datos

  // Métrica principal: lo que realmente se mueve en el sistema.
  const totalAntes = esContrato ? totales.contratoAntes : totales.señaAntes + totales.saldoAntes
  const totalDespues = esContrato
    ? totales.contratoDespues
    : totales.señaDespues + totales.saldoDespues
  const totalDelta = totalDespues - totalAntes

  return (
    <Dialog open onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-balance">
            Cambiar el {CAMPO_LABEL[campo]} de &ldquo;{servicio.nombre}&rdquo;
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {filas.length === 0
              ? "Este servicio todavía no está contratado en ningún evento, así que el cambio no mueve montos ya cargados."
              : `Este servicio está contratado en ${filas.length} ${
                  filas.length === 1 ? "evento" : "eventos"
                }. Los montos se calculan en vivo desde el catálogo, así que al guardar se actualizan solos.`}
          </DialogDescription>
        </DialogHeader>

        {/* Valor del catálogo: antes → después */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor actual</p>
            <p className="text-lg font-semibold tabular-nums text-muted-foreground line-through">
              {campo === "porcentajeSeña" ? `${valorAnterior}${unidadValor}` : fmt(valorAnterior)}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor nuevo</p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {campo === "porcentajeSeña" ? `${valorNuevo}${unidadValor}` : fmt(valorNuevo)}
            </p>
          </div>
          {filas.length > 0 && (
            <div className="ml-auto text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {esContrato ? "Total en contratos" : "Total a pagar en Caja Eventos"}
              </p>
              <p className={cn("text-xl font-bold tabular-nums", deltaColor(totalDelta))}>
                {fmtDelta(totalDelta)}
                {totalDelta !== 0 && (
                  totalDelta > 0 ? (
                    <TrendingUp className="ml-1 inline h-4 w-4" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="ml-1 inline h-4 w-4" aria-hidden="true" />
                  )
                )}
              </p>
              <p className="text-[12px] tabular-nums text-muted-foreground">
                {fmt(totalAntes)} → <span className="font-semibold text-foreground">{fmt(totalDespues)}</span>
              </p>
            </div>
          )}
        </div>

        {filas.length > 0 && (
          <>
            {/* Impacto agregado en el sistema */}
            <div className="grid gap-2 sm:grid-cols-3">
              {esContrato ? (
                <ResumenImpacto
                  titulo="Importe en los contratos"
                  antes={totales.contratoAntes}
                  despues={totales.contratoDespues}
                  detalle={`${filas.length} ${filas.length === 1 ? "contrato" : "contratos"}`}
                />
              ) : (
                <>
                  <ResumenImpacto
                    titulo="Señas a proveedores"
                    antes={totales.señaAntes}
                    despues={totales.señaDespues}
                    detalle="Egresos por seña en Caja Eventos"
                  />
                  <ResumenImpacto
                    titulo="Saldos pendientes"
                    antes={totales.saldoAntes}
                    despues={totales.saldoDespues}
                    detalle="Egresos por saldo en Caja Eventos"
                  />
                  <ResumenImpacto
                    titulo="Costo total del servicio"
                    antes={totales.costoAntes}
                    despues={totales.costoDespues}
                    detalle="Suma de seña + saldo"
                  />
                </>
              )}
              {esContrato && (
                <div className="rounded-lg border border-border bg-card p-3 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    No cambia
                  </p>
                  <p className="mt-1 text-[13px] text-pretty text-muted-foreground">
                    El precio de venta es lo que figura en el contrato del cliente. Los egresos de
                    Caja Eventos (seña y saldo al proveedor) salen del costo, así que no se tocan.
                  </p>
                </div>
              )}
            </div>

            {/* Avisos de montos congelados */}
            {(datos.cantidadCongeladas > 0 || datos.cantidadFueraDeCaja > 0) && !esContrato && (
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="space-y-1">
                  {datos.cantidadCongeladas > 0 && (
                    <p className="text-pretty">
                      En {datos.cantidadCongeladas}{" "}
                      {datos.cantidadCongeladas === 1 ? "evento" : "eventos"} la seña ya se pagó: ese
                      monto queda congelado y solo se recalcula el saldo.
                    </p>
                  )}
                  {datos.cantidadFueraDeCaja > 0 && (
                    <p className="text-pretty">
                      {datos.cantidadFueraDeCaja}{" "}
                      {datos.cantidadFueraDeCaja === 1 ? "evento" : "eventos"} ya
                      {datos.cantidadFueraDeCaja === 1 ? " está" : " están"} cancelado/completado, así
                      que no {datos.cantidadFueraDeCaja === 1 ? "suma" : "suman"} a la proyección de
                      Caja Eventos.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Detalle evento por evento */}
            <div className="rounded-lg border border-border">
              <div className="border-b border-border bg-muted/50 px-3 py-2">
                <p className="text-[13px] font-semibold">Detalle por evento</p>
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-3 py-1.5 text-left font-medium">Evento</th>
                      <th className="px-2 py-1.5 text-left font-medium">Fecha</th>
                      <th className="px-2 py-1.5 text-right font-medium">Antes</th>
                      <th className="px-2 py-1.5 text-right font-medium">Después</th>
                      <th className="px-3 py-1.5 text-right font-medium">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, idx) => {
                      const antes = esContrato ? f.contratoAntes : f.señaAntes + f.saldoAntes
                      const despues = esContrato ? f.contratoDespues : f.señaDespues + f.saldoDespues
                      const delta = despues - antes
                      return (
                        <tr
                          key={f.eventoId}
                          className={cn(
                            "border-b border-border/60 last:border-0",
                            idx % 2 === 1 && "bg-muted/20",
                            f.fueraDeCaja && !esContrato && "opacity-50",
                          )}
                        >
                          <td className="px-3 py-1.5">
                            <span className="font-medium">{f.nombre}</span>
                            <span className="ml-1.5 text-muted-foreground">
                              {salonLabel(f.salon)}
                            </span>
                            {f.cantidad > 1 && (
                              <span className="ml-1.5 text-muted-foreground">× {f.cantidad}</span>
                            )}
                            {f.señaCongelada && !esContrato && (
                              <Badge
                                variant="outline"
                                className="ml-1.5 gap-1 border-amber-300 bg-amber-50 px-1.5 py-0 text-[11px] font-medium text-amber-800"
                              >
                                <Lock className="h-3 w-3" aria-hidden="true" />
                                seña paga
                              </Badge>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                            <CalendarDays
                              className="mr-1 inline h-3.5 w-3.5 align-[-2px]"
                              aria-hidden="true"
                            />
                            {fmtFecha(f.fecha)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                            {fmt(antes)}
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                            {fmt(despues)}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-1.5 text-right font-semibold tabular-nums",
                              deltaColor(delta),
                            )}
                          >
                            {fmtDelta(delta)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/60 font-semibold">
                      <td colSpan={2} className="px-3 py-2">
                        Total ({filas.length} {filas.length === 1 ? "evento" : "eventos"})
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {fmt(totalAntes)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(totalDespues)}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", deltaColor(totalDelta))}>
                        {fmtDelta(totalDelta)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirmar}>
            {filas.length === 0
              ? "Guardar cambio"
              : `Aplicar en ${filas.length} ${filas.length === 1 ? "evento" : "eventos"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tarjeta de resumen antes/después ────────────────────────────────────────

function ResumenImpacto({
  titulo,
  antes,
  despues,
  detalle,
}: {
  titulo: string
  antes: number
  despues: number
  detalle: string
}) {
  const delta = despues - antes
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-0.5 text-[15px] tabular-nums text-muted-foreground">
        {fmt(antes)} <ArrowRight className="inline h-3 w-3" aria-hidden="true" />{" "}
        <span className="font-bold text-foreground">{fmt(despues)}</span>
      </p>
      <p className={cn("text-[13px] font-semibold tabular-nums", deltaColor(delta))}>
        {fmtDelta(delta)}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{detalle}</p>
    </div>
  )
}

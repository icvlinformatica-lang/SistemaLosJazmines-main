"use client"

// Confirmación antes de finalizar un evento. La usan la Lista y el
// Calendario (y el Aviso de la semana): un toque accidental archivaría el
// evento (y congelaría sus costos) sin aviso. Si la fecha todavía no llegó,
// además lo advierte.
//
// Antes de finalizar avisa qué falta cobrar y qué falta marcar como pagado
// (pedido de Rodrigo, 3/11/2026, para hacer bien los cierres de eventos y
// que la caja quede con lo que corresponde). Es solo un aviso: se puede
// finalizar igual. La cuenta es la de Caja Eventos (`calcularCajaEventos`).
//
// Desde el 10/11/2026 (pedido del dueño) también ofrece cubrir los costos
// antes de finalizar: "Pagar los costos y finalizar" paga de Caja Eventos todo
// lo de "Falta marcar como pagado", con la misma cuenta y los mismos conceptos
// de "Marcar como pagado" (lib/cubrir-costos-al-finalizar.ts). Los cambios de
// pago viajan junto con el estado "completado" en el mismo guardado, así la
// foto de costos del finalizado queda con todo pagado; después se anotan los
// egresos, como en Caja Eventos.
import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowUpRight, CheckCircle2, HandCoins, Wallet } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { fechaNegocio } from "@/lib/ipc-cuotas"
import { avisoEventoTodaviaNoPaso } from "@/lib/lista-eventos"
import { useStore } from "@/lib/store-context"
import { useToast } from "@/hooks/use-toast"
import { planCubrirCostos } from "@/lib/cubrir-costos-al-finalizar"
import type { EventoGuardado } from "@/lib/store"
import { calcularCajaEventos } from "@/lib/hooks/use-caja-eventos"
import { pendientesAlFinalizar } from "@/lib/pendientes-al-finalizar"
import { formatCurrency } from "@/lib/utils-financieros"
import { buttonVariants } from "@/components/ui/button"

export function ConfirmarFinalizarEventoDialog({
  open,
  onOpenChange,
  fechaEvento,
  eventoId,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fechaEvento?: string
  /** Con el id, el diálogo dice qué falta cobrar o pagar de ese evento. */
  eventoId?: string
  /**
   * Finaliza el evento. Con `cambiosPago` (al elegir "Pagar los costos y
   * finalizar") hay que guardarlos junto con el estado "completado" y devolver
   * si se guardó: recién ahí se anotan los egresos en Caja Eventos.
   */
  onConfirm: (cambiosPago?: Partial<EventoGuardado>) => Promise<boolean | void> | boolean | void
}) {
  const aviso = avisoEventoTodaviaNoPaso(fechaEvento, fechaNegocio())
  const { state, syncGuard, addMovimientosCaja, updatePagoPersonal } = useStore()
  const { toast } = useToast()
  const [pagando, setPagando] = useState(false)
  // Solo se calcula con el diálogo abierto: recorre todos los eventos.
  const caja = useMemo(() => (open && eventoId ? calcularCajaEventos(state) : null), [open, eventoId, state])
  const pendientes = useMemo(
    () => (caja && eventoId ? pendientesAlFinalizar(caja, eventoId) : null),
    [caja, eventoId],
  )
  const plan = useMemo(() => {
    const evento = eventoId ? state.eventos.find((e) => e.id === eventoId) : undefined
    if (!caja || !evento || !pendientes || pendientes.porPagar.length === 0) return null
    return planCubrirCostos({
      evento,
      costos: caja.egresosPendientes.filter((e) => e.eventoId === eventoId),
      movimientosCaja: state.movimientosCaja ?? [],
      hoy: fechaNegocio(),
      ahoraISO: new Date().toISOString(),
    })
  }, [caja, eventoId, pendientes, state.eventos, state.movimientosCaja])

  // Paga los costos y finaliza: primero el evento (pagos + "completado", en un
  // solo guardado) y después los egresos, igual que "Marcar como pagado".
  const pagarYFinalizar = async () => {
    if (!plan || pagando) return
    setPagando(true)
    try {
      const ok = await onConfirm(plan.cambiosEvento)
      if (ok === false) return
      await syncGuard.run(async () => {
        if (plan.movimientos.length > 0 && !(await addMovimientosCaja(plan.movimientos))) {
          toast({
            title: "Operación incompleta: revisar caja",
            description: "El evento se finalizó con los costos marcados como pagados, pero no se pudieron anotar los pagos en Caja Eventos. Revisá el historial antes de volver a pagar.",
            variant: "destructive",
          })
          return
        }
        for (const id of plan.compromisosPersonal) await updatePagoPersonal(id, { estado: "pagado", fechaPago: fechaNegocio() })
        toast({ title: "Costos pagados", description: `Salieron ${formatCurrency(plan.totalPagado)} de Caja Eventos.` })
      })
    } finally {
      setPagando(false)
    }
  }
  const fechaCorta = (f: string) => (f ? f.split("-").reverse().slice(0, 2).join("/") : "")
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Seguro que querés finalizar este evento?</AlertDialogTitle>
          <AlertDialogDescription>
            Va a desaparecer de la lista e irá al archivo de eventos completados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {aviso && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{aviso}</span>
          </div>
        )}
        {pendientes && pendientes.alDia && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>No falta cobrar ninguna cuota ni marcar ningún pago: la caja queda al día.</span>
          </div>
        )}
        {pendientes && !pendientes.alDia && eventoId && (
          <div className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto text-sm">
            <p className="font-medium text-amber-900">Antes de finalizar, revisá esto para que la caja quede bien:</p>
            {pendientes.porPagar.length > 0 && (
              <section className="rounded-md border border-border px-3 py-2">
                <h4 className="flex items-center gap-1.5 font-semibold">
                  <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Falta marcar como pagado ({formatCurrency(pendientes.totalPorPagar)})
                </h4>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs tabular-nums">
                  {pendientes.porPagar.map((p, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{p.detalle}</span>
                      <span className="shrink-0">{formatCurrency(p.monto)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-muted-foreground">
                  Con "Pagar los costos y finalizar" se pagan ahora desde Caja Eventos, con la fecha de hoy. Si ya se
                  pagaron por otro lado o el monto es otro, marcalo en Costos del evento.
                </p>
                {plan && plan.omitidos.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs text-amber-900">
                    {plan.omitidos.map((o) => (
                      <li key={o.costo.id}>
                        No se paga desde acá: {o.costo.tipo === "seña" ? "seña" : "saldo"} de {o.costo.servicioNombre}{" "}
                        ({o.motivo === "seña_con_candado" ? "la seña todavía tiene candado: se paga con PIN en Costos del evento" : "primero hay que pagar la seña"}).
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href={`/eventos/costos?id=${encodeURIComponent(eventoId)}`}
                  prefetch={false}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Ir a Costos del evento
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </section>
            )}
            {pendientes.porCobrar.length > 0 && (
              <section className="rounded-md border border-border px-3 py-2">
                <h4 className="flex items-center gap-1.5 font-semibold">
                  <HandCoins className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Falta cobrar ({formatCurrency(pendientes.totalPorCobrar)})
                </h4>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs tabular-nums">
                  {pendientes.porCobrar.map((c) => (
                    <li key={c.numeroCuota} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">
                        Cuota {c.numeroCuota} de {c.totalCuotas}
                        {c.fechaVencimiento && ` (vence ${fechaCorta(c.fechaVencimiento)})`}
                        {c.vencida && <span className="ml-1 font-medium text-red-700">vencida</span>}
                      </span>
                      <span className="shrink-0">{formatCurrency(c.monto)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-muted-foreground">
                  Si el cliente ya pagó, registralo en Cobrar cuota antes de finalizar.
                </p>
                <Link
                  href={`/eventos/pagos?evento=${encodeURIComponent(eventoId)}`}
                  prefetch={false}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Ir a Cobrar cuota
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </section>
            )}
          </div>
        )}
        <AlertDialogFooter className="sm:flex-wrap">
          <AlertDialogCancel disabled={pagando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void onConfirm()}
            disabled={pagando}
            className={
              plan && plan.movimientos.length > 0
                ? `${buttonVariants({ variant: "outline" })} text-foreground`
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }
          >
            {plan && plan.movimientos.length > 0 ? "Finalizar sin pagar" : pendientes && !pendientes.alDia ? "Finalizar igual" : "Sí, finalizar"}
          </AlertDialogAction>
          {plan && plan.movimientos.length > 0 && (
            <AlertDialogAction
              onClick={() => void pagarYFinalizar()}
              disabled={pagando}
              className="h-auto whitespace-normal bg-emerald-600 py-2 text-white hover:bg-emerald-700"
            >
              Pagar los costos y finalizar ({formatCurrency(plan.totalPagado)})
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

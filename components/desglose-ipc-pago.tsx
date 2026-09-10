import { Info, TrendingUp } from "lucide-react"
import { formatCurrency } from "@/lib/store"
import type { ResultadoIPC } from "@/lib/ipc-cuotas"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function DesgloseIPCPago({ resultado, montoCuota, diasAtraso, recargoPorDia, recargoOmitido }: {
  resultado: ResultadoIPC
  montoCuota: number
  diasAtraso: number
  recargoPorDia: number
  recargoOmitido: boolean
}) {
  const calculo = resultado.estado === "listo" ? resultado.calculo : null
  const recargo = recargoOmitido ? 0 : diasAtraso * recargoPorDia
  const mes = calculo ? new Date(`${calculo.periodo}-01T12:00:00Z`).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }) : ""
  const cuota = calculo?.monto ?? montoCuota
  return (
    <section aria-label="Desglose del próximo pago" className="mt-4 rounded-lg border border-border bg-background p-4 text-sm leading-relaxed text-foreground">
      <div className="flex min-w-0 flex-col gap-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <TrendingUp className="size-5 shrink-0" aria-hidden="true" />
          IPC antes de registrar el pago
        </h3>
        {resultado.estado === "pendiente" ? (
          <Alert variant="destructive">
            <Info aria-hidden="true" />
            <AlertTitle>Cálculo pendiente — cobro bloqueado</AlertTitle>
            <AlertDescription>{resultado.motivo}</AlertDescription>
          </Alert>
        ) : (
          <dl className="flex flex-col gap-3">
            {calculo && <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt>{calculo.origen === "pago" ? "Última cuota pagada (sin mora)" : "Base original del plan"}</dt>
                <dd className="font-mono font-semibold">{formatCurrency(calculo.base)}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt>IPC de {mes}: {calculo.porcentaje.toLocaleString("es-AR")}%</dt>
                <dd className="font-mono font-semibold">{formatCurrency(calculo.monto - calculo.base)}</dd>
              </div>
            </>}
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="font-semibold">Cuota resultante (sin mora)</dt>
              <dd className="font-mono text-lg font-bold">{formatCurrency(cuota)}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Mora separada: {diasAtraso} días × {formatCurrency(recargoPorDia)}{recargoOmitido ? " (quitada)" : ""}</dt>
              <dd className="font-mono font-semibold">{formatCurrency(recargo)}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3 font-bold">
              <dt>Total a pagar</dt>
              <dd className="font-mono text-lg">{formatCurrency(cuota + recargo)}</dd>
            </div>
          </dl>
        )}
        {calculo?.aplicadoEsteMes && <p className="font-semibold text-primary">Ya se aplicó IPC este mes. Se mantiene la misma base mensual, sin volver a aumentarla.</p>}
        <p className="text-muted-foreground">
          {resultado.estado === "no_aplica"
            ? "Este plan no se ajusta por IPC. Se conserva el importe pactado."
            : "Se usa la última cuota efectivamente pagada más únicamente el IPC del mes vigente. Los meses sin pagos no se acumulan. Mora, extras y vuelto nunca forman parte de la base. Las cuotas futuras se muestran al valor vigente, sin anticipar índices."}
        </p>
      </div>
    </section>
  )
}

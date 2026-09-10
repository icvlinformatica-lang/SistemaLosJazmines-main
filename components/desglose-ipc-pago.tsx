import { Info, TrendingUp } from "lucide-react"
import { formatCurrency } from "@/lib/store"
import type { CalculoIPC, ResultadoIPC } from "@/lib/ipc-cuotas"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function DesgloseIPCPago({ resultado, montoCuota, diasAtraso, recargoPorDia, recargoOmitido, manual = null, aplicarIPC = true }: {
  resultado: ResultadoIPC
  montoCuota: number
  diasAtraso: number
  recargoPorDia: number
  recargoOmitido: boolean
  /** Cálculo elegido a mano cuando el automático quedó pendiente. */
  manual?: CalculoIPC | null
  /** false cuando quien cobra destildó el IPC del mes. */
  aplicarIPC?: boolean
}) {
  const calculo = resultado.estado === "listo" ? resultado.calculo : resultado.estado === "pendiente" ? manual : null
  const esManual = resultado.estado === "pendiente" && manual != null
  const bloqueado = resultado.estado === "pendiente" && manual == null
  const recargo = recargoOmitido ? 0 : diasAtraso * recargoPorDia
  const mes = calculo ? new Date(`${calculo.periodo}-01T12:00:00Z`).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }) : ""
  const cuota = calculo ? (aplicarIPC ? Math.round(calculo.base * (1 + calculo.porcentaje / 100)) : calculo.base) : montoCuota
  const incremento = calculo && aplicarIPC ? cuota - calculo.base : 0
  const etiquetaBase = esManual
    ? calculo?.origen === "plan" ? "Base tomada del plan (revisar)" : "Base tomada del último pago (revisar)"
    : calculo?.origen === "pago" ? "Última cuota pagada (sin mora)" : "Base original del plan"
  return (
    <section aria-label="Desglose del próximo pago" className="mt-4 rounded-lg border border-border bg-background p-4 text-sm leading-relaxed text-foreground">
      <div className="flex min-w-0 flex-col gap-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <TrendingUp className="size-5 shrink-0" aria-hidden="true" />
          IPC antes de registrar el pago
        </h3>
        {bloqueado && (
          <Alert variant="destructive">
            <Info aria-hidden="true" />
            <AlertTitle>Cálculo pendiente — cobro bloqueado</AlertTitle>
            <AlertDescription>{resultado.estado === "pendiente" ? resultado.motivo : null}</AlertDescription>
          </Alert>
        )}
        {esManual && (
          <Alert>
            <Info aria-hidden="true" />
            <AlertTitle>Cálculo manual</AlertTitle>
            <AlertDescription>
              {resultado.estado === "pendiente" ? resultado.motivo : null} Se propone una base para que puedas cobrar igual; revisala y elegí si aplicás el IPC y la mora.
            </AlertDescription>
          </Alert>
        )}
        {!bloqueado && (
          <dl className="flex flex-col gap-3">
            {calculo && <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt>{etiquetaBase}</dt>
                <dd className="font-mono font-semibold">{formatCurrency(calculo.base)}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className={aplicarIPC ? undefined : "text-muted-foreground"}>
                  IPC de {mes}: {calculo.porcentaje.toLocaleString("es-AR")}%{aplicarIPC ? "" : " (sin aplicar)"}
                </dt>
                <dd className="font-mono font-semibold">{formatCurrency(incremento)}</dd>
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

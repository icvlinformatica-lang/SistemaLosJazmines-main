import { Info, TrendingUp } from "lucide-react"
import { formatCurrency, type HistorialIPCEntry } from "@/lib/store"
import { reconstruirDesgloseIPC } from "@/lib/desglose-ipc"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const porcentaje = (valor: number) => valor.toLocaleString("es-AR", { maximumFractionDigits: 2 })

export function DesgloseIPCPago({
  montoBase,
  montoCuota,
  ajustaPorIPC,
  historialIPC,
  diasAtraso,
  recargoPorDia,
  recargoOmitido,
}: {
  montoBase: number
  montoCuota: number
  ajustaPorIPC: boolean
  historialIPC: HistorialIPCEntry[]
  diasAtraso: number
  recargoPorDia: number
  recargoOmitido: boolean
}) {
  const baseDisponible = Number.isFinite(montoBase) && montoBase > 0
  const incremento = baseDisponible ? montoCuota - montoBase : 0
  const ipcAcumulado = baseDisponible ? incremento / montoBase * 100 : 0
  const pasos = ajustaPorIPC ? reconstruirDesgloseIPC(montoBase, montoCuota, historialIPC) : []
  const recargo = recargoOmitido ? 0 : diasAtraso * recargoPorDia

  return (
    <section aria-label="Desglose del próximo pago" className="mt-4 flex min-w-0 flex-col gap-4 rounded-lg border border-primary/40 bg-background p-4 text-sm leading-relaxed text-foreground">
      <h3 className="flex items-center gap-2 font-semibold text-primary">
        <TrendingUp className="size-5 shrink-0" aria-hidden="true" />
        IPC antes de registrar el pago
      </h3>

      <dl className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Cuota base guardada en el plan</dt>
          <dd className="font-mono font-semibold">{baseDisponible ? formatCurrency(montoBase) : "No disponible"}</dd>
        </div>
        {ajustaPorIPC && baseDisponible && incremento >= 0 && (
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-primary/10 p-3 text-primary">
            <dt className="font-semibold">IPC acumulado sobre la base: +{porcentaje(ipcAcumulado)}%</dt>
            <dd className="font-mono text-lg font-bold">+ {formatCurrency(incremento)}</dd>
          </div>
        )}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="font-semibold">Cuota vigente guardada (sin atraso)</dt>
          <dd className="font-mono text-lg font-bold">{formatCurrency(montoCuota)}</dd>
        </div>
      </dl>

      {!ajustaPorIPC ? (
        <p className="text-muted-foreground">Este plan no está marcado como ajustable por IPC. No se agrega IPC al importe guardado.</p>
      ) : pasos.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-3">
          <h4 className="font-semibold">Evolución mensual compatible con la cuota guardada</h4>
          <Table aria-label="Reconstrucción de aumentos mensuales por IPC">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Mes / IPC</TableHead>
                <TableHead scope="col" className="text-right">Base del mes</TableHead>
                <TableHead scope="col" className="text-right">Aumento</TableHead>
                <TableHead scope="col" className="text-right">Cuota resultante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pasos.map((paso) => (
                <TableRow key={`${paso.anio}-${paso.mes}`}>
                  <TableCell>
                    <span className="block font-semibold">{meses[paso.mes]} {paso.anio}</span>
                    <span className="text-primary">+{porcentaje(paso.porcentaje)}%</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(paso.montoAnterior)}</TableCell>
                  <TableCell className="text-right font-mono">+ {formatCurrency(paso.incremento)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatCurrency(paso.montoAjustado)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Alert>
            <Info aria-hidden="true" />
            <AlertTitle>Detalle reconstruido, no historial confirmado</AlertTitle>
            <AlertDescription>
              Los porcentajes de estos meses reproducen el importe guardado, redondeando cada aumento a pesos.
              No existe un registro mensual por cuota que confirme su aplicación. Los ajustes anteriores que pudieran
              estar incluidos en la base no pueden identificarse. Este desglose no vuelve a sumar IPC.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <Alert>
          <Info aria-hidden="true" />
          <AlertTitle>Desglose mensual no disponible</AlertTitle>
          <AlertDescription>
            {baseDisponible && incremento === 0
              ? "La cuota vigente coincide con la base guardada: no hay un aumento separado identificable. Esto no confirma si hubo IPC anterior incluido en esa base."
              : "No se puede reconstruir con certeza la evolución mensual con la base y el historial disponibles. Se mantiene el importe guardado, sin inventar meses ni sumar ajustes adicionales."}
          </AlertDescription>
        </Alert>
      )}

      <dl className="flex flex-col gap-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">
            Recargo por atraso — separado del IPC
            <span className="block">{diasAtraso} {diasAtraso === 1 ? "día" : "días"} × {formatCurrency(recargoPorDia)}{recargoOmitido ? " (quitado)" : ""}</span>
          </dt>
          <dd className="font-mono font-semibold">+ {formatCurrency(recargo)}</dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3 font-bold">
          <dt>Total simulado a hoy</dt>
          <dd className="font-mono text-lg">{formatCurrency(montoCuota + recargo)}</dd>
        </div>
      </dl>
      <p className="text-muted-foreground">
        El IPC de cada mes aumenta el valor de las cuotas pendientes de forma acumulativa (el de agosto se calcula
        sobre la cuota ya ajustada en julio). El recargo por atraso de {formatCurrency(recargoPorDia)} por día es un
        pago extraordinario que va por separado: no se acumula mes a mes, solo se suma al total.
      </p>
    </section>
  )
}

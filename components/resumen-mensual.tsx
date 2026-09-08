"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays } from "lucide-react"
import { useStore } from "@/lib/store-context"
import { useClock } from "@/lib/clock-context"
import { useSyncTiempoReal } from "@/lib/hooks/use-sync-tiempo-real"
import { calcularResumenMensual, cambiarMes, mesDeFecha, CAJAS_RESUMEN, GENERAL, type ImportesResumen } from "@/lib/resumen-mensual"
import { formatCurrency, salonLabel } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table"

const nombreCaja = { caja_eventos: "Caja Eventos", caja_jazmines: "Caja Jazmines" }

function ImportesCelda({ valores }: { valores: ImportesResumen }) {
  return (
    <dl className="flex min-w-60 flex-col gap-2 text-sm leading-6">
      <div className="flex items-baseline justify-between gap-4"><dt>Cuotas previstas</dt><dd className="font-semibold tabular-nums">{formatCurrency(valores.cuotasPrevistas)}</dd></div>
      <div className="flex items-baseline justify-between gap-4 text-muted-foreground"><dt>Cobradas</dt><dd className="tabular-nums">{formatCurrency(valores.cuotasCobradas)}</dd></div>
      <div className="flex items-baseline justify-between gap-4 text-muted-foreground"><dt>Por cobrar del período</dt><dd className="tabular-nums">{formatCurrency(valores.cuotasPendientes)}</dd></div>
      <div className="flex items-baseline justify-between gap-4 border-t pt-2"><dt>Egresos previstos</dt><dd className="font-semibold tabular-nums">{formatCurrency(valores.egresosPrevistos)}</dd></div>
      <div className="flex items-baseline justify-between gap-4 text-muted-foreground"><dt>Pagos registrados</dt><dd className="tabular-nums">{formatCurrency(valores.pagosRegistrados)}</dd></div>
      <div className="flex items-baseline justify-between gap-4 text-muted-foreground"><dt>Por pagar del período</dt><dd className="tabular-nums">{formatCurrency(valores.egresosPendientes)}</dd></div>
      {valores.egresosSinConfirmar > 0 && <div className="flex items-baseline justify-between gap-4"><dt>Estado sin confirmar</dt><dd className="tabular-nums">{formatCurrency(valores.egresosSinConfirmar)}</dd></div>}
      <div className="flex items-baseline justify-between gap-4 border-t pt-2"><dt className="font-medium">Balance previsto</dt><dd className="font-bold tabular-nums">{formatCurrency(valores.cuotasPrevistas - valores.egresosPrevistos)}</dd></div>
    </dl>
  )
}

export function ResumenMensual() {
  const { state } = useStore()
  const { ahora, soloLectura } = useClock()
  const actual = mesDeFecha(ahora)
  const [mes, setMes] = useState(actual)
  const { ultimaSync, errorSync, sincronizando, refrescar } = useSyncTiempoReal(15000, true, true)
  const resumen = useMemo(() => calcularResumenMensual(state, mes, ahora), [state, mes, actual])
  const labelMes = new Date(`${mes}-01T12:00:00`).toLocaleDateString("es-AR", { month: "long", year: "numeric" })
  const listo = soloLectura || !!ultimaSync

  return (
    <section className="flex min-w-0 flex-col gap-5 bg-background p-4 text-foreground sm:p-5" aria-label="Resumen mensual por salón">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="mes-resumen">Mes del resumen</Label>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setMes(cambiarMes(mes, -1))} aria-label="Mes anterior"><ChevronLeft /></Button>
            <Input id="mes-resumen" className="w-44" type="month" value={mes} onChange={(e) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) setMes(e.target.value) }} />
            <Button variant="outline" size="icon" onClick={() => setMes(cambiarMes(mes, 1))} aria-label="Mes siguiente"><ChevronRight /></Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMes(actual)} disabled={mes === actual}><CalendarDays />Mes actual</Button>
          {!soloLectura && <Button variant="outline" size="sm" onClick={() => void refrescar()} disabled={sincronizando}><RefreshCw className={sincronizando ? "animate-spin" : ""} />Actualizar</Button>}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold capitalize text-balance">{labelMes} · por salón</h3>
        <p className="text-sm leading-6 text-muted-foreground">Cuotas y obligaciones del mes, distribuidas entre ambas cajas. Deslizá la tabla para ver todos los salones.</p>
      </div>
      {errorSync && <Alert variant="destructive"><AlertTitle>No se pudo actualizar</AlertTitle><AlertDescription>{listo ? "Se conserva la última información disponible. Podés reintentar con Actualizar." : "No se muestran totales incompletos. Reintentá con Actualizar."}</AlertDescription></Alert>}
      {!listo ? (
        <div role="status" className="flex flex-col gap-3"><span className="text-sm">{errorSync ? "Esperando conexión…" : "Cargando cajas, cuotas y gastos…"}</span><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" /></div>
      ) : (
        <>
          {!resumen.lineas.length && <Alert><AlertTitle>Sin importes para este mes</AlertTitle><AlertDescription>No hay cuotas, gastos ni pagos con respaldo para el período seleccionado.</AlertDescription></Alert>}
          <div className="min-w-0 rounded-lg border">
            <Table>
              <TableCaption>Previsto por vencimiento · Cobrado y pagado por fecha registrada</TableCaption>
              <TableHeader><TableRow>
                <TableHead scope="col" className="sticky left-0 z-10 min-w-32 bg-background">Caja</TableHead>
                {resumen.salones.map((salon) => <TableHead key={salon} scope="col" className="px-4 py-3">{salon === GENERAL ? "General / Sin asignar" : salonLabel(salon)}</TableHead>)}
                <TableHead scope="col" className="px-4 py-3">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>{CAJAS_RESUMEN.map((caja) => <TableRow key={caja}>
                <TableHead scope="row" className="sticky left-0 z-10 bg-background align-top py-4 font-semibold">{nombreCaja[caja]}</TableHead>
                {resumen.salones.map((salon) => <TableCell key={salon} className="border-l p-4 align-top"><ImportesCelda valores={resumen.cajas[caja][salon]} /></TableCell>)}
                <TableCell className="border-l bg-muted p-4 align-top text-foreground"><ImportesCelda valores={resumen.totales[caja]} /></TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
            <p>El balance previsto no es el saldo real de caja. Las cuotas cobradas no incluyen señas, aportes ni transferencias. Las comisiones se cuentan una sola vez, en Caja Jazmines.</p>
            <p>Los pendientes corresponden a obligaciones que vencen en el mes y siguen abiertas. Un cobro o pago puede registrarse en otro mes; por eso no se resta automáticamente del previsto. Los importes futuros usan valores vigentes.</p>
          </div>
          {resumen.advertencias.length > 0 && <details className="rounded-lg border p-3 text-sm leading-6">
            <summary className="cursor-pointer font-medium">Aclaraciones sobre el historial ({resumen.advertencias.length})</summary>
            <ul className="flex list-disc flex-col gap-2 pl-5 pt-3">{resumen.advertencias.map((aviso) => <li key={aviso}>{aviso}</li>)}</ul>
          </details>}
          <p role="status" className="text-sm text-muted-foreground">{soloLectura ? "Modo consulta: se usa la fecha del sistema." : `Última actualización: ${ultimaSync?.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) ?? "pendiente"}. Se actualiza automáticamente.`}</p>
        </>
      )}
    </section>
  )
}

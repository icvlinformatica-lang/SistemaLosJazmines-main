"use client"

import { useState } from "react"
import { useStore } from "@/lib/store-context"
import { eventoAjustaPorIPC, type HistorialIPCEntry } from "@/lib/store"
import { formatCurrency } from "@/lib/utils-financieros"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Calendar, AlertTriangle, Layers, Undo2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export default function FinanzasIPCPage() {
  const { eventos, historialIPC, ultimoMesIPC, abrirDialogIPC, eliminarIPC } = useStore()

  const [entryAEliminar, setEntryAEliminar] = useState<HistorialIPCEntry | null>(null)

  const hoy = new Date()

  // Próximo mes a cargar de forma secuencial: mes siguiente al último aplicado.
  // Si no hay historial, arranca en el mes/año actual.
  const proximoMes = (() => {
    if (!historialIPC || historialIPC.length === 0) {
      return { mes: hoy.getMonth(), anio: hoy.getFullYear() }
    }
    const ultimoOrden = historialIPC.reduce(
      (max, h) => Math.max(max, h.anio * 12 + h.mes),
      -Infinity,
    )
    const siguiente = ultimoOrden + 1
    return { mes: ((siguiente % 12) + 12) % 12, anio: Math.floor(siguiente / 12) }
  })()

  // Eventos con cuotas ajustables por IPC
  const eventosAjustables = (eventos || []).filter(eventoAjustaPorIPC)

  // Contar cuotas pendientes (no pagadas) y su monto total vigente
  let cuotasPendientes = 0
  let totalPendiente = 0
  let eventosConPendientes = 0

  for (const evento of eventosAjustables) {
    const plan = evento.planDeCuotas
    if (!plan) continue
    const pagadas = plan.cuotasPagadas ?? []
    const cuotas = plan.cuotas ?? []
    const pendientesEvento = cuotas.filter(
      (c) => !(c.pagada === true || pagadas.includes(c.numero)),
    )
    if (pendientesEvento.length > 0) eventosConPendientes++
    cuotasPendientes += pendientesEvento.length
    totalPendiente += pendientesEvento.reduce((s, c) => s + (c.montoCuota || 0), 0)
  }

  const hayPendientes = eventosConPendientes > 0

  return (
    <div className="flex flex-col h-full min-h-0 p-6 gap-4">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ajuste por IPC</h1>
          <p className="text-sm text-muted-foreground">
            Cargá el IPC mes a mes, en orden. Cada carga actualiza las cuotas restantes de los eventos ajustables.
          </p>
        </div>
        <Button onClick={abrirDialogIPC} className="gap-2 self-start sm:self-auto" disabled={!hayPendientes}>
          <TrendingUp className="h-4 w-4" />
          Cargar IPC de un mes
        </Button>
      </div>

      {/* Próximo mes a cargar (secuencial) */}
      {hayPendientes ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">
                Próximo IPC a cargar: {MESES[proximoMes.mes]} {proximoMes.anio}
              </p>
              <p className="text-sm text-amber-700">
                Los meses se cargan en orden, uno por mes. Hay {cuotasPendientes} cuota(s) pendiente(s) en {eventosConPendientes} evento(s) que se ajustarán al aplicar el porcentaje.
              </p>
            </div>
            <Button onClick={abrirDialogIPC} variant="outline" className="gap-2 shrink-0">
              <TrendingUp className="h-4 w-4" />
              Cargar {MESES[proximoMes.mes]}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 py-4 text-muted-foreground">
            <Layers className="h-6 w-6 shrink-0 opacity-60" />
            <p className="text-sm">
              No hay eventos con cuotas ajustables por IPC y cuotas pendientes en este momento.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Resumen de impacto */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription>Eventos ajustables</CardDescription>
            <CardTitle className="text-3xl">{eventosConPendientes}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Con cuotas pendientes por ajustar
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription>Cuotas pendientes</CardDescription>
            <CardTitle className="text-3xl">{cuotasPendientes}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Se aumentan con cada carga de IPC
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription>Total pendiente (actual)</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(totalPendiente)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Suma de las cuotas restantes ya ajustadas
          </CardContent>
        </Card>
      </div>

      {/* Historial IPC */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Historial de Ajustes IPC
          </CardTitle>
          <CardDescription>
            Cada ajuste se aplica de forma compuesta: parte del valor ya aumentado el mes anterior. Por eso solo se puede deshacer el ajuste más reciente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historialIPC.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Todavía no cargaste ningún IPC</p>
              <p className="text-xs mt-1">
                Al cargar el porcentaje del mes, las cuotas restantes suben y queda registrado acá.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes / Año</TableHead>
                    <TableHead className="text-right">Porcentaje</TableHead>
                    <TableHead className="text-right">Eventos actualizados</TableHead>
                    <TableHead>Fecha de aplicación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...historialIPC].reverse().map((entry, idx) => (
                    <TableRow key={entry.id ?? idx}>
                      <TableCell className="font-medium">
                        {MESES[entry.mes]} {entry.anio}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <Badge variant="secondary" className="font-mono">
                          +{entry.porcentaje.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{entry.eventosActualizados}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(entry.fechaAplicacion).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {idx === 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-destructive hover:text-destructive"
                            onClick={() => setEntryAEliminar(entry)}
                          >
                            <Undo2 className="h-4 w-4" />
                            Deshacer
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={entryAEliminar != null} onOpenChange={(open) => !open && setEntryAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deshacer este ajuste de IPC?</AlertDialogTitle>
            <AlertDialogDescription>
              {entryAEliminar && (
                <>
                  Se revertirá el aumento del{" "}
                  <span className="font-semibold">+{entryAEliminar.porcentaje.toFixed(1)}%</span> de{" "}
                  <span className="font-semibold">
                    {MESES[entryAEliminar.mes]} {entryAEliminar.anio}
                  </span>
                  . Las cuotas restantes (no pagadas) volverán a su valor anterior y la entrada se eliminará del historial. Las cuotas ya cobradas no se modifican.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (entryAEliminar) eliminarIPC(entryAEliminar)
                setEntryAEliminar(null)
              }}
            >
              Sí, deshacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

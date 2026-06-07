"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { formatCurrency } from "@/lib/utils-financieros"
import { useStore } from "@/lib/store-context"
import { useCajaJazmines } from "@/lib/hooks/use-caja-jazmines"
import type { EstadoAlerta, GastoFijoMes } from "@/lib/hooks/use-caja-jazmines"
import {
  Building,
  TrendingDown,
  TrendingUp,
  Wallet,
  AlertCircle,
  Plus,
  Pencil,
  Calendar,
} from "lucide-react"

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function formatFecha(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
}

function puntoPrioridad(estado: EstadoAlerta) {
  if (estado === "vencido" || estado === "urgente") {
    return <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0 mt-0.5" />
  }
  if (estado === "proximo") {
    return <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0 mt-0.5" />
  }
  return <span className="h-2.5 w-2.5 rounded-full bg-teal-500 shrink-0 mt-0.5" />
}

function descripcionAlerta(diasRestantes: number, estado: EstadoAlerta): string {
  if (estado === "vencido") return `venció hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) !== 1 ? "s" : ""}`
  if (diasRestantes === 0) return "vence hoy"
  if (diasRestantes === 1) return "vence mañana"
  return `vence en ${diasRestantes} días`
}

function badgeEstadoFijo(estado: EstadoAlerta | "pagado") {
  if (estado === "pagado") {
    return <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[11px]">pagado</Badge>
  }
  if (estado === "vencido" || estado === "urgente") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">
        {estado === "vencido" ? "vencido" : "urgente"}
      </Badge>
    )
  }
  if (estado === "proximo") {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]">próximo</Badge>
  }
  return <Badge className="bg-sky-100 text-sky-700 border-sky-200 text-[11px]">pendiente</Badge>
}

type EstadoGastoVar = "pendiente" | "pagado" | "vencido"

function badgeEstadoVar(estado: EstadoGastoVar) {
  if (estado === "pagado") {
    return <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[11px]">pagado</Badge>
  }
  if (estado === "vencido") {
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">vencido</Badge>
  }
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]">pendiente</Badge>
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------

export default function CajaJazminePage() {
  const { state, updateCostoOperativo, addCostoOperativo } = useStore()
  const data = useCajaJazmines(state)

  const {
    saldoActual,
    gastosPróximos30Dias,
    saldoProyectado30Dias,
    alertasVencimiento,
    gastosFijosMes,
    gastosVariables: gastosVariablesCombinados,
    ingresosProyectados30Dias,
  } = data

  // ── Edición de gastos fijos ──────────────────────────────────────────────
  const [editandoFijo, setEditandoFijo] = useState<GastoFijoMes | null>(null)
  const [editFijo, setEditFijo] = useState({
    concepto: "",
    monto: "",
    fechaVencimiento: "",
    pagado: false,
  })

  function abrirEditFijo(gasto: GastoFijoMes) {
    setEditandoFijo(gasto)
    setEditFijo({
      concepto: gasto.concepto,
      monto: String(gasto.monto),
      fechaVencimiento:
        state.costosOperativos?.find((c) => c.id === gasto.id)?.fechaVencimiento ?? "",
      pagado: gasto.estado === "pagado",
    })
  }

  function guardarEditFijo() {
    if (!editandoFijo) return
    updateCostoOperativo(editandoFijo.id, {
      concepto: editFijo.concepto,
      monto: Number(editFijo.monto),
      fechaVencimiento: editFijo.fechaVencimiento || undefined,
      pagado: editFijo.pagado,
    })
    setEditandoFijo(null)
  }

  // ── Gastos variables ─────────────────────────────────────────────────────
  const [modalVariableAbierto, setModalVariableAbierto] = useState(false)
  const [nuevoGasto, setNuevoGasto] = useState({
    nombre: "",
    monto: "",
    salon: "",
    fecha: "",
  })

  const totalGastosFijos = gastosFijosMes.reduce((s, g) => s + g.monto, 0)
  const barMax = Math.max(saldoActual, ingresosProyectados30Dias, gastosPróximos30Dias, 1)

  function handleAgregarGasto() {
    if (!nuevoGasto.nombre || !nuevoGasto.monto || !nuevoGasto.salon || !nuevoGasto.fecha) return
    addCostoOperativo({
      concepto: nuevoGasto.nombre,
      tipo: "Gastos Generales" as any,
      monto: Number(nuevoGasto.monto),
      frecuencia: "Por Evento",
      esPorPersona: false,
      salon: nuevoGasto.salon,
      activo: true,
      fechaVencimiento: nuevoGasto.fecha,
      esVariable: true,
      pagado: false,
    })
    setNuevoGasto({ nombre: "", monto: "", salon: "", fecha: "" })
    setModalVariableAbierto(false)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
          <Building className="h-5 w-5 text-purple-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Caja Jazmines</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            50% de cada cobro de cuota. Fondos de la empresa: sueldos, gastos fijos y administración.
          </p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">Saldo Actual</p>
              <Wallet className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-800">{formatCurrency(saldoActual)}</p>
            <p className="text-xs text-purple-600 mt-1">Cobros acumulados × 50% − gastos</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Gastos próximos 30 días
              </p>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-red-600">{formatCurrency(gastosPróximos30Dias)}</p>
            <p className="text-xs text-muted-foreground mt-1">Costos operativos pendientes del período</p>
          </CardContent>
        </Card>

        <Card className={saldoProyectado30Dias >= 0 ? "border-teal-200 bg-teal-50" : "border-red-200 bg-red-50"}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs font-medium uppercase tracking-wide ${saldoProyectado30Dias >= 0 ? "text-teal-700" : "text-red-700"}`}>
                Saldo proyectado a 30 días
              </p>
              <TrendingUp className={`h-4 w-4 ${saldoProyectado30Dias >= 0 ? "text-teal-600" : "text-red-600"}`} />
            </div>
            <p className={`text-3xl font-bold ${saldoProyectado30Dias >= 0 ? "text-teal-800" : "text-red-700"}`}>
              {formatCurrency(saldoProyectado30Dias)}
            </p>
            <p className={`text-xs mt-1 ${saldoProyectado30Dias >= 0 ? "text-teal-600" : "text-red-600"}`}>
              Saldo + ingresos − gastos estimados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Alertas de vencimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {alertasVencimiento.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay vencimientos en los próximos 30 días.
            </p>
          ) : (
            <>
              {alertasVencimiento.map((alerta) => (
                <div
                  key={alerta.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                >
                  {puntoPrioridad(alerta.estado)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{alerta.concepto}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {descripcionAlerta(alerta.diasRestantes, alerta.estado)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-red-600 shrink-0">
                    {formatCurrency(alerta.monto)}
                  </span>
                </div>
              ))}
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                  Urgente / vencido
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                  Menos de 7 días
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-teal-500 inline-block" />
                  Más de 7 días
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Gastos fijos + Gastos variables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Gastos fijos del mes ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Gastos fijos del mes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {gastosFijosMes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No hay gastos fijos configurados.
              </p>
            ) : (
              <>
                {gastosFijosMes.map((gasto) => (
                  <div
                    key={gasto.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{gasto.concepto}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {gasto.frecuencia}
                        {gasto.salon ? ` · ${gasto.salon}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-bold text-foreground">
                          {formatCurrency(gasto.monto)}
                        </span>
                        {badgeEstadoFijo(gasto.estado)}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => abrirEditFijo(gasto)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar gasto fijo</span>
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-base font-bold text-foreground">
                    {formatCurrency(totalGastosFijos)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Gastos variables ────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                Gastos variables
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={() => setModalVariableAbierto(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Agendar gasto
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {gastosVariablesCombinados.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">
                Sin gastos variables registrados.
              </p>
            ) : (
              gastosVariablesCombinados.map((gasto) => (
                <div
                  key={gasto.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{gasto.nombre}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {gasto.salon} · {formatFecha(gasto.fecha)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-bold text-foreground">
                      {formatCurrency(gasto.monto)}
                    </span>
                    {badgeEstadoVar(gasto.estado)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Proyección visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            Proyección del saldo a 30 días
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Saldo actual", value: saldoActual, color: "bg-purple-500", textColor: "text-purple-700" },
            { label: "Gastos proyectados", value: gastosPróximos30Dias, color: "bg-red-400", textColor: "text-red-600", signo: "−" },
            { label: "Ingresos proyectados (50%)", value: ingresosProyectados30Dias, color: "bg-purple-300", textColor: "text-purple-600", signo: "+" },
          ].map(({ label, value, color, textColor, signo }) => {
            const pct = Math.round((value / barMax) * 100)
            return (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{label}</span>
                  <span className={`font-semibold ${textColor}`}>
                    {signo ? `${signo} ` : ""}{formatCurrency(value)}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Saldo proyectado resultante</span>
              <span className={`text-xl font-bold ${saldoProyectado30Dias >= 0 ? "text-teal-700" : "text-red-600"}`}>
                {formatCurrency(saldoProyectado30Dias)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Saldo actual + ingresos proyectados − gastos proyectados
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Dialog: Editar gasto fijo ──────────────────────────────────────── */}
      <Dialog open={!!editandoFijo} onOpenChange={(open) => !open && setEditandoFijo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar gasto fijo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ef-concepto">Nombre</Label>
              <Input
                id="ef-concepto"
                value={editFijo.concepto}
                onChange={(e) => setEditFijo((p) => ({ ...p, concepto: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef-monto">Monto (ARS)</Label>
              <Input
                id="ef-monto"
                type="number"
                value={editFijo.monto}
                onChange={(e) => setEditFijo((p) => ({ ...p, monto: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef-fecha">Fecha de vencimiento</Label>
              <Input
                id="ef-fecha"
                type="date"
                value={editFijo.fechaVencimiento}
                onChange={(e) => setEditFijo((p) => ({ ...p, fechaVencimiento: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Marcado como pagado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cambia el estado a pagado en este mes
                </p>
              </div>
              <Switch
                checked={editFijo.pagado}
                onCheckedChange={(checked) => setEditFijo((p) => ({ ...p, pagado: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoFijo(null)}>
              Cancelar
            </Button>
            <Button
              onClick={guardarEditFijo}
              disabled={!editFijo.concepto || !editFijo.monto}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Agendar gasto variable ────────────────────────────────── */}
      <Dialog open={modalVariableAbierto} onOpenChange={setModalVariableAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar gasto variable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="gv-concepto">Concepto</Label>
              <Input
                id="gv-concepto"
                placeholder="Ej: Reparación de heladera"
                value={nuevoGasto.nombre}
                onChange={(e) => setNuevoGasto((p) => ({ ...p, nombre: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gv-monto">Monto (ARS)</Label>
              <Input
                id="gv-monto"
                type="number"
                placeholder="Ej: 50000"
                value={nuevoGasto.monto}
                onChange={(e) => setNuevoGasto((p) => ({ ...p, monto: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gv-salon">Salón</Label>
              <Select
                value={nuevoGasto.salon}
                onValueChange={(v) => setNuevoGasto((p) => ({ ...p, salon: v }))}
              >
                <SelectTrigger id="gv-salon">
                  <SelectValue placeholder="Seleccionar salón" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Quinta">Quinta</SelectItem>
                  <SelectItem value="Casona">Casona</SelectItem>
                  <SelectItem value="Salon">Salón</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gv-fecha">Fecha del gasto</Label>
              <Input
                id="gv-fecha"
                type="date"
                value={nuevoGasto.fecha}
                onChange={(e) => setNuevoGasto((p) => ({ ...p, fecha: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Podés agendar gastos futuros; se ordenan automáticamente por fecha.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalVariableAbierto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAgregarGasto}
              disabled={!nuevoGasto.nombre || !nuevoGasto.monto || !nuevoGasto.salon || !nuevoGasto.fecha}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

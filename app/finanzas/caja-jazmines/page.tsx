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
import { formatCurrency } from "@/lib/utils-financieros"
import {
  Building,
  TrendingDown,
  TrendingUp,
  Wallet,
  AlertCircle,
  Plus,
} from "lucide-react"

// ---------------------------------------------------------------------------
// DATOS HARDCODEADOS – Fase 1 (solo diseño)
// ---------------------------------------------------------------------------

const SALDO_ACTUAL = 975_000
const GASTOS_PROXIMOS_30 = 648_000
const SALDO_PROYECTADO_30 = 975_000 + 1_225_000 - 648_000

const ALERTAS_VENCIMIENTO = [
  {
    id: "a1",
    nombre: "Alquiler del predio",
    descripcion: "vence mañana",
    diasRestantes: 1,
    monto: 185_000,
  },
  {
    id: "a2",
    nombre: "Seguro del local",
    descripcion: "vence en 3 días",
    diasRestantes: 3,
    monto: 42_500,
  },
  {
    id: "a3",
    nombre: "Servicio de electricidad",
    descripcion: "vence en 5 días",
    diasRestantes: 5,
    monto: 28_300,
  },
  {
    id: "a4",
    nombre: "Internet y telefonía",
    descripcion: "vence en 12 días",
    diasRestantes: 12,
    monto: 8_900,
  },
  {
    id: "a5",
    nombre: "Servicio de agua",
    descripcion: "vence en 18 días",
    diasRestantes: 18,
    monto: 6_200,
  },
]

const GASTOS_FIJOS = [
  {
    id: "gf1",
    nombre: "Alquiler del predio",
    categoria: "Mensual",
    monto: 185_000,
    estado: "vence mañana" as const,
  },
  {
    id: "gf2",
    nombre: "Seguro del local",
    categoria: "Mensual",
    monto: 42_500,
    estado: "pendiente" as const,
  },
  {
    id: "gf3",
    nombre: "Electricidad",
    categoria: "Mensual",
    monto: 28_300,
    estado: "pendiente" as const,
  },
  {
    id: "gf4",
    nombre: "Internet y telefonía",
    categoria: "Mensual",
    monto: 8_900,
    estado: "pendiente" as const,
  },
  {
    id: "gf5",
    nombre: "Agua",
    categoria: "Mensual",
    monto: 6_200,
    estado: "pendiente" as const,
  },
  {
    id: "gf6",
    nombre: "Honorarios contador",
    categoria: "Mensual",
    monto: 55_000,
    estado: "pagado" as const,
  },
  {
    id: "gf7",
    nombre: "Sueldo administrativo",
    categoria: "Mensual",
    monto: 180_000,
    estado: "pagado" as const,
  },
  {
    id: "gf8",
    nombre: "Mantenimiento jardín",
    categoria: "Quincenal",
    monto: 24_000,
    estado: "pagado" as const,
  },
]

type EstadoGastoVar = "pendiente" | "pagado" | "vencido"

interface GastoVariable {
  id: string
  nombre: string
  salon: string
  fecha: string
  monto: number
  estado: EstadoGastoVar
}

const GASTOS_VARIABLES_INICIALES: GastoVariable[] = [
  {
    id: "gv1",
    nombre: "Reparación cocina industrial",
    salon: "Quinta",
    fecha: "2025-06-05",
    monto: 95_000,
    estado: "pagado",
  },
  {
    id: "gv2",
    nombre: "Compra vajilla nueva",
    salon: "Casona",
    fecha: "2025-06-10",
    monto: 67_000,
    estado: "pendiente",
  },
  {
    id: "gv3",
    nombre: "Pintura sala principal",
    salon: "Salón",
    fecha: "2025-06-15",
    monto: 48_000,
    estado: "pendiente",
  },
  {
    id: "gv4",
    nombre: "Sistema de sonido",
    salon: "Quinta",
    fecha: "2025-05-20",
    monto: 120_000,
    estado: "vencido",
  },
]

// Proyección saldo a 30 días
const PROYECCION_BARRAS = {
  saldoActual: 975_000,
  gastosProyectados: 648_000,
  ingresosProyectados: 1_225_000,
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function formatFecha(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
}

function puntoPrioridad(diasRestantes: number) {
  if (diasRestantes <= 1) {
    return <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0 mt-0.5" />
  }
  if (diasRestantes <= 7) {
    return <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0 mt-0.5" />
  }
  return <span className="h-2.5 w-2.5 rounded-full bg-teal-500 shrink-0 mt-0.5" />
}

function badgeEstadoFijo(estado: "pagado" | "pendiente" | "vence mañana") {
  if (estado === "pagado") {
    return (
      <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[11px]">
        pagado
      </Badge>
    )
  }
  if (estado === "vence mañana") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">
        vence mañana
      </Badge>
    )
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]">
      pendiente
    </Badge>
  )
}

function badgeEstadoVar(estado: EstadoGastoVar) {
  if (estado === "pagado") {
    return (
      <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[11px]">
        pagado
      </Badge>
    )
  }
  if (estado === "vencido") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">
        vencido
      </Badge>
    )
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]">
      pendiente
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------------

export default function CajaJazminePage() {
  const [gastosVariables, setGastosVariables] = useState<GastoVariable[]>(
    GASTOS_VARIABLES_INICIALES
  )
  const [modalAbierto, setModalAbierto] = useState(false)
  const [nuevoGasto, setNuevoGasto] = useState({
    nombre: "",
    monto: "",
    salon: "",
    fecha: "",
  })

  const saldoProyectado =
    PROYECCION_BARRAS.saldoActual +
    PROYECCION_BARRAS.ingresosProyectados -
    PROYECCION_BARRAS.gastosProyectados

  const barMax = Math.max(
    PROYECCION_BARRAS.saldoActual,
    PROYECCION_BARRAS.ingresosProyectados,
    PROYECCION_BARRAS.gastosProyectados
  )

  const handleAgregarGasto = () => {
    if (!nuevoGasto.nombre || !nuevoGasto.monto || !nuevoGasto.salon) return
    const nuevo: GastoVariable = {
      id: `gv-${Date.now()}`,
      nombre: nuevoGasto.nombre,
      salon: nuevoGasto.salon,
      fecha: nuevoGasto.fecha || new Date().toISOString().split("T")[0],
      monto: Number(nuevoGasto.monto),
      estado: "pendiente",
    }
    setGastosVariables((prev) => [nuevo, ...prev])
    setNuevoGasto({ nombre: "", monto: "", salon: "", fecha: "" })
    setModalAbierto(false)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
          <Building className="h-5 w-5 text-purple-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Caja Jazmines
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            50% de cada cobro de cuota. Fondos de la empresa: sueldos, gastos fijos y administración.
          </p>
        </div>
      </div>

      {/* Sección 1 — Tres métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">
                Saldo Actual
              </p>
              <Wallet className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-800">
              {formatCurrency(SALDO_ACTUAL)}
            </p>
            <p className="text-xs text-purple-600 mt-1">
              Cobros acumulados × 50% − gastos
            </p>
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
            <p className="text-3xl font-bold text-red-600">
              {formatCurrency(GASTOS_PROXIMOS_30)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Gastos fijos pendientes del período
            </p>
          </CardContent>
        </Card>

        <Card
          className={
            SALDO_PROYECTADO_30 >= 0
              ? "border-teal-200 bg-teal-50"
              : "border-red-200 bg-red-50"
          }
        >
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <p
                className={`text-xs font-medium uppercase tracking-wide ${
                  SALDO_PROYECTADO_30 >= 0 ? "text-teal-700" : "text-red-700"
                }`}
              >
                Saldo proyectado a 30 días
              </p>
              <TrendingUp
                className={`h-4 w-4 ${
                  SALDO_PROYECTADO_30 >= 0 ? "text-teal-600" : "text-red-600"
                }`}
              />
            </div>
            <p
              className={`text-3xl font-bold ${
                SALDO_PROYECTADO_30 >= 0 ? "text-teal-800" : "text-red-700"
              }`}
            >
              {formatCurrency(SALDO_PROYECTADO_30)}
            </p>
            <p
              className={`text-xs mt-1 ${
                SALDO_PROYECTADO_30 >= 0 ? "text-teal-600" : "text-red-600"
              }`}
            >
              Saldo + ingresos − gastos estimados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sección 2 — Alertas de vencimiento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Alertas de vencimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ALERTAS_VENCIMIENTO.map((alerta) => (
            <div
              key={alerta.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
            >
              {puntoPrioridad(alerta.diasRestantes)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {alerta.nombre}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                  {alerta.descripcion}
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
        </CardContent>
      </Card>

      {/* Sección 3 — Dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gastos fijos del mes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Gastos fijos del mes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {GASTOS_FIJOS.map((gasto) => (
              <div
                key={gasto.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{gasto.nombre}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {gasto.categoria}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-bold text-foreground">
                    {formatCurrency(gasto.monto)}
                  </span>
                  {badgeEstadoFijo(gasto.estado)}
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-base font-bold text-foreground">
                {formatCurrency(
                  GASTOS_FIJOS.reduce((s, g) => s + g.monto, 0)
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Gastos variables */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-purple-600" />
                Gastos variables
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {gastosVariables.map((gasto) => (
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
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 border-dashed border-purple-300 text-purple-700 hover:bg-purple-50"
              onClick={() => setModalAbierto(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Agregar gasto
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sección 4 — Proyección visual del saldo a 30 días */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            Proyección del saldo a 30 días
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              label: "Saldo actual",
              value: PROYECCION_BARRAS.saldoActual,
              color: "bg-purple-500",
              textColor: "text-purple-700",
            },
            {
              label: "Gastos proyectados",
              value: PROYECCION_BARRAS.gastosProyectados,
              color: "bg-red-400",
              textColor: "text-red-600",
              signo: "−",
            },
            {
              label: "Ingresos proyectados (50%)",
              value: PROYECCION_BARRAS.ingresosProyectados,
              color: "bg-purple-300",
              textColor: "text-purple-600",
              signo: "+",
            },
          ].map(({ label, value, color, textColor, signo }) => {
            const pct = Math.round((value / barMax) * 100)
            return (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{label}</span>
                  <span className={`font-semibold ${textColor}`}>
                    {signo ? `${signo} ` : ""}
                    {formatCurrency(value)}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}

          {/* Línea resultado */}
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                Saldo proyectado resultante
              </span>
              <span
                className={`text-xl font-bold ${
                  saldoProyectado >= 0 ? "text-teal-700" : "text-red-600"
                }`}
              >
                {formatCurrency(saldoProyectado)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Saldo actual + ingresos proyectados − gastos proyectados
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modal — Agregar gasto variable */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar gasto variable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="concepto">Concepto</Label>
              <Input
                id="concepto"
                placeholder="Ej: Reparación de heladera"
                value={nuevoGasto.nombre}
                onChange={(e) =>
                  setNuevoGasto((p) => ({ ...p, nombre: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monto">Monto (ARS)</Label>
              <Input
                id="monto"
                type="number"
                placeholder="Ej: 50000"
                value={nuevoGasto.monto}
                onChange={(e) =>
                  setNuevoGasto((p) => ({ ...p, monto: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salon">Salón</Label>
              <Select
                value={nuevoGasto.salon}
                onValueChange={(v) =>
                  setNuevoGasto((p) => ({ ...p, salon: v }))
                }
              >
                <SelectTrigger id="salon">
                  <SelectValue placeholder="Seleccionar salón" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Quinta">Quinta</SelectItem>
                  <SelectItem value="Casona">Casona</SelectItem>
                  <SelectItem value="Salón">Salón</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha">Fecha de vencimiento</Label>
              <Input
                id="fecha"
                type="date"
                value={nuevoGasto.fecha}
                onChange={(e) =>
                  setNuevoGasto((p) => ({ ...p, fecha: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalAbierto(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAgregarGasto}
              disabled={
                !nuevoGasto.nombre || !nuevoGasto.monto || !nuevoGasto.salon
              }
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

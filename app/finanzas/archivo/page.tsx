"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import { formatCurrency } from "@/lib/utils-financieros"
import { salonLabel, type GastoArchivado } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Wallet,
  Receipt,
  RotateCcw,
  PartyPopper,
  RefreshCw,
} from "lucide-react"
import { SalonSelectorOverlay } from "@/components/salon-selector-overlay"
import { SalonDot } from "@/components/salon-badge"
import { BarrasPorPeriodo, CircularDistribucion, type SerieItem } from "./archivo-charts"

const ORIGEN_LABEL: Record<GastoArchivado["origen"], string> = {
  caja_jazmines_fijo: "Jazmines · Fijo",
  caja_jazmines_variable: "Jazmines · Variable",
  caja_jazmines_comision: "Jazmines · Comisión",
  caja_eventos: "Eventos",
}

function formatFechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number)
  if (!y || !m || !d) return fecha
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function mesLabel(key: string): string {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "short", year: "numeric" })
}

export default function ArchivoPage() {
  const { gastosArchivados, desarchivarGasto } = useStore()
  const [salonFiltro, setSalonFiltro] = useState<string>("todos")
  const [origenFiltro, setOrigenFiltro] = useState<string>("todos")
  // Selector de salón estilo perfiles al entrar a la página
  const [selectorAbierto, setSelectorAbierto] = useState(true)

  const gastos = useMemo(() => {
    return (gastosArchivados || [])
      .filter((g) => (salonFiltro === "todos" ? true : (g.salon || "General") === salonFiltro))
      .filter((g) => (origenFiltro === "todos" ? true : g.origen === origenFiltro))
      .slice()
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  }, [gastosArchivados, salonFiltro, origenFiltro])

  const totalGastado = gastos.reduce((s, g) => s + g.monto, 0)

  // Desglose por día
  const porDia = useMemo(() => {
    const map = new Map<string, GastoArchivado[]>()
    for (const g of gastos) {
      const arr = map.get(g.fecha) || []
      arr.push(g)
      map.set(g.fecha, arr)
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([fecha, items]) => ({
        fecha,
        items,
        total: items.reduce((s, x) => s + x.monto, 0),
      }))
  }, [gastos])

  // Desglose por evento (solo los que tienen evento asociado)
  const porEvento = useMemo(() => {
    const map = new Map<string, { nombre: string; items: GastoArchivado[] }>()
    for (const g of gastos) {
      if (!g.eventoId) continue
      const entry = map.get(g.eventoId) || { nombre: g.eventoNombre || "Evento", items: [] }
      entry.items.push(g)
      map.set(g.eventoId, entry)
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, total: e.items.reduce((s, x) => s + x.monto, 0) }))
      .sort((a, b) => b.total - a.total)
  }, [gastos])

  // Serie para barras: por mes
  const serieMes: SerieItem[] = useMemo(() => {
    const map = new Map<string, number>()
    for (const g of gastos) {
      const key = g.fecha.slice(0, 7)
      map.set(key, (map.get(key) || 0) + g.monto)
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-12)
      .map(([key, total]) => ({ nombre: mesLabel(key), total }))
  }, [gastos])

  // Circular por categoría
  const serieCategoria: SerieItem[] = useMemo(() => {
    const map = new Map<string, number>()
    for (const g of gastos) {
      const key = g.categoria || ORIGEN_LABEL[g.origen]
      map.set(key, (map.get(key) || 0) + g.monto)
    }
    return Array.from(map.entries())
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
  }, [gastos])

  // Circular por salón
  const serieSalon: SerieItem[] = useMemo(() => {
    const map = new Map<string, number>()
    for (const g of gastos) {
      const key = salonLabel(g.salon)
      map.set(key, (map.get(key) || 0) + g.monto)
    }
    return Array.from(map.entries())
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
  }, [gastos])

  // Selector de salón estilo perfiles al entrar
  if (selectorAbierto) {
    return (
      <SalonSelectorOverlay
        titulo="Archivo de gastos"
        onSelect={(salon) => {
          setSalonFiltro(salon)
          setSelectorAbierto(false)
        }}
      />
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Archive className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Archivo de gastos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Historial consolidado de a dónde se fue el dinero, por día y por evento.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
            <Link href="/finanzas/caja-jazmines">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
          <Select value={origenFiltro} onValueChange={setOrigenFiltro}>
            <SelectTrigger className="w-[160px] h-9" aria-label="Filtrar por caja">
              <SelectValue placeholder="Todas las cajas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las cajas</SelectItem>
              <SelectItem value="caja_jazmines_fijo">Jazmines · Fijo</SelectItem>
                <SelectItem value="caja_jazmines_variable">Jazmines · Variable</SelectItem>
                <SelectItem value="caja_jazmines_comision">Jazmines · Comisión</SelectItem>
              <SelectItem value="caja_eventos">Eventos</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-700">
              Cambiar salón
              <ArrowRight className="h-4 w-4 animate-pulse" aria-hidden="true" />
            </span>
            <button
              type="button"
              onClick={() => setSelectorAbierto(true)}
              className="group flex h-9 items-center gap-2 rounded-full border border-input bg-background pl-3 pr-4 text-sm font-medium shadow-sm transition-colors hover:border-purple-400 hover:bg-purple-50"
              aria-label="Cambiar salón: volver al selector de salones"
            >
              <RefreshCw
                className="h-4 w-4 text-purple-700 transition-transform duration-500 group-hover:rotate-180"
                aria-hidden="true"
              />
              {salonFiltro === "todos" ? (
                <span>Todos los salones</span>
              ) : salonFiltro === "General" ? (
                <span>General</span>
              ) : (
                <span className="flex items-center gap-2">
                  <SalonDot salon={salonFiltro} size={8} />
                  {salonLabel(salonFiltro)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total archivado</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(totalGastado)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
              <Receipt className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Movimientos</p>
              <p className="text-lg font-bold text-foreground">{gastos.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Días con gasto</p>
              <p className="text-lg font-bold text-foreground">{porDia.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarrasPorPeriodo
          data={serieMes}
          titulo="Gasto por mes"
          descripcion="Últimos 12 meses con gastos archivados."
        />
        <CircularDistribucion
          data={serieSalon}
          titulo="Distribución por salón"
          descripcion="A qué salón se atribuyó cada gasto."
        />
      </div>
      <CircularDistribucion
        data={serieCategoria}
        titulo="Distribución por categoría"
        descripcion="Tipo de gasto (fijo, variable, menú, barra, seña, saldo...)."
      />

      {/* Desgloses */}
      <Tabs defaultValue="dia">
        <TabsList>
          <TabsTrigger value="dia" className="gap-1.5">
            <CalendarDays className="h-4 w-4" /> Por día
          </TabsTrigger>
          <TabsTrigger value="evento" className="gap-1.5">
            <PartyPopper className="h-4 w-4" /> Por evento
          </TabsTrigger>
        </TabsList>

        {/* Por día */}
        <TabsContent value="dia" className="mt-4 space-y-3">
          {porDia.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Todavía no archivaste ningún gasto. Usá el botón{" "}
                <Archive className="inline h-3.5 w-3.5 mx-0.5" /> en Caja Jazmines o Caja Eventos.
              </CardContent>
            </Card>
          ) : (
            porDia.map((dia) => (
              <Card key={dia.fecha}>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold capitalize">
                    {formatFechaLarga(dia.fecha)}
                  </CardTitle>
                  <span className="text-sm font-bold text-red-600">
                    −{formatCurrency(dia.total)}
                  </span>
                </CardHeader>
                <CardContent className="pt-0 divide-y divide-border">
                  {dia.items.map((g) => (
                    <GastoRow key={g.id} gasto={g} onDesarchivar={desarchivarGasto} />
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Por evento */}
        <TabsContent value="evento" className="mt-4 space-y-3">
          {porEvento.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No hay gastos archivados asociados a un evento.
              </CardContent>
            </Card>
          ) : (
            porEvento.map((ev) => (
              <Card key={ev.nombre}>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold">{ev.nombre}</CardTitle>
                  <span className="text-sm font-bold text-red-600">
                    −{formatCurrency(ev.total)}
                  </span>
                </CardHeader>
                <CardContent className="pt-0 divide-y divide-border">
                  {ev.items.map((g) => (
                    <GastoRow key={g.id} gasto={g} onDesarchivar={desarchivarGasto} showFecha />
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function GastoRow({
  gasto,
  onDesarchivar,
  showFecha,
}: {
  gasto: GastoArchivado
  onDesarchivar: (id: string) => void
  showFecha?: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{gasto.concepto}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <Badge variant="secondary" className="text-[10px] font-normal">
            {ORIGEN_LABEL[gasto.origen]}
          </Badge>
          <span className="text-[11px] text-muted-foreground">{salonLabel(gasto.salon)}</span>
          {showFecha ? (
            <span className="text-[11px] text-muted-foreground capitalize">
              · {formatFechaLarga(gasto.fecha)}
            </span>
          ) : null}
        </div>
      </div>
      <span className="text-sm font-semibold text-red-600 shrink-0">
        −{formatCurrency(gasto.monto)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
        title="Quitar del archivo"
        onClick={() => onDesarchivar(gasto.id)}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        <span className="sr-only">Quitar del archivo</span>
      </Button>
    </div>
  )
}

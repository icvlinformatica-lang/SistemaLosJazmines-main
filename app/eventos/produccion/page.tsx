"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { useStore } from "@/lib/store-context"
import { useEventos } from "@/lib/use-eventos"
import { useRecetas } from "@/lib/use-recetas"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Users,
  Building2,
  Search,
  ClipboardList,
  ChefHat,
  Eye,
  Printer,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  ArrowRight,
  RefreshCw,
} from "lucide-react"
import { salonLabel, type EventoGuardado } from "@/lib/store"
import { SalonSelectorOverlay } from "@/components/salon-selector-overlay"
import { SalonDot } from "@/components/salon-badge"
import { cn } from "@/lib/utils"
import { useSyncTiempoReal } from "@/lib/hooks/use-sync-tiempo-real"

const estadoConfig: Record<string, { label: string; className: string }> = {
  borrador: {
    label: "Borrador",
    className: "bg-slate-100 text-slate-600 border-slate-300",
  },
  confirmado: {
    label: "Confirmado",
    className: "bg-emerald-100 text-emerald-700 border-emerald-300",
  },
  en_preparacion: {
    label: "En Preparacion",
    className: "bg-amber-100 text-amber-700 border-amber-300",
  },
  finalizado: {
    label: "Finalizado",
    className: "bg-sky-100 text-sky-700 border-sky-300",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-red-100 text-red-600 border-red-300",
  },
}

export default function ProduccionPage() {
  const { state } = useStore()
  const { eventos, loading } = useEventos()
  const { recetas } = useRecetas()

  // Sincronización en tiempo real: refresca eventos (recetas asignadas,
  // invitados, rinde) cada 15s y al volver a la pestaña, para que la pantalla
  // de cocina refleje los cambios sin recargar. Las recetas se refrescan solas
  // vía SWR (useRecetas, 30s).
  useSyncTiempoReal()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEvento, setSelectedEvento] = useState<EventoGuardado | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Selector de salón estilo perfiles al entrar a la página
  const [selectorAbierto, setSelectorAbierto] = useState(true)
  const [filtroSalon, setFiltroSalon] = useState<string>("todos")

  // Vista calendario (por defecto) o lista
  const [vista, setVista] = useState<"calendario" | "lista">("calendario")
  const hoy = new Date()
  // Calendario anual: año visible + día seleccionado (para elegir entre varios eventos)
  const [anioActual, setAnioActual] = useState(hoy.getFullYear())
  const [diaDialog, setDiaDialog] = useState<{ fecha: string; eventos: EventoGuardado[] } | null>(null)

  // Al entrar desde el selector de salón, llevar la vista directo al mes actual
  const mesActualRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (selectorAbierto || vista !== "calendario" || anioActual !== hoy.getFullYear()) return
    // Esperar al render de los 12 meses antes de hacer scroll
    const t = setTimeout(() => {
      mesActualRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectorAbierto, vista, anioActual])

  // Filtrar eventos que tienen recetas (tienen guía de producción),
  // ordenados por fecha más cercana a hoy (los sin fecha van al final)
  const eventosConRecetas = useMemo(() => {
    const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
    return eventos
      .filter((e) => {
        const tieneRecetas =
          (e.recetasAdultos?.length || 0) > 0 ||
          (e.recetasAdolescentes?.length || 0) > 0 ||
          (e.recetasNinos?.length || 0) > 0 ||
          (e.recetasDietasEspeciales?.length || 0) > 0
        return tieneRecetas
      })
      .sort((a, b) => {
        if (!a.fecha && !b.fecha) return 0
        if (!a.fecha) return 1
        if (!b.fecha) return -1
        const aFuturo = a.fecha >= hoyISO
        const bFuturo = b.fecha >= hoyISO
        // Primero los próximos (ascendente: el más cercano arriba), luego los pasados (el más reciente arriba)
        if (aFuturo && bFuturo) return a.fecha.localeCompare(b.fecha)
        if (aFuturo) return -1
        if (bFuturo) return 1
        return b.fecha.localeCompare(a.fecha)
      })
  }, [eventos])

  // Filtrar por salón + búsqueda
  const eventosFiltrados = useMemo(() => {
    let base = eventosConRecetas
    if (filtroSalon !== "todos") base = base.filter((e) => e.salon === filtroSalon)
    if (!searchQuery.trim()) return base
    const q = searchQuery.toLowerCase()
    return base.filter(
      (e) =>
        (e.nombrePareja || e.nombre || "").toLowerCase().includes(q) ||
        (e.tipoEvento || "").toLowerCase().includes(q)
    )
  }, [eventosConRecetas, searchQuery, filtroSalon])

  const formatFecha = (fecha: string) => {
    if (!fecha) return "-"
    const d = new Date(fecha + "T12:00:00")
    return d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  // ── Calendario ANUAL: 12 mini-meses del año visible ──────────────────────
  type CeldaDia = { dia: number; eventos: EventoGuardado[] } | null
  const { meses, eventosSinFecha } = useMemo(() => {
    // Mapa "mes-dia" → eventos de ese día
    const porFecha = new Map<string, EventoGuardado[]>()
    const sinFecha: EventoGuardado[] = []
    for (const e of eventosFiltrados) {
      if (!e.fecha) {
        sinFecha.push(e)
        continue
      }
      const [y, m, d] = e.fecha.split("-").map((n) => Number.parseInt(n, 10))
      if (y !== anioActual) continue
      const key = `${m}-${d}`
      if (!porFecha.has(key)) porFecha.set(key, [])
      porFecha.get(key)!.push(e)
    }

    const meses: { mes: number; label: string; celdas: CeldaDia[] }[] = []
    for (let mes = 0; mes < 12; mes++) {
      const primerDia = new Date(anioActual, mes, 1)
      const diasEnMes = new Date(anioActual, mes + 1, 0).getDate()
      const offsetLunes = (primerDia.getDay() + 6) % 7 // 0 = lunes
      const celdas: CeldaDia[] = []
      for (let i = 0; i < offsetLunes; i++) celdas.push(null)
      for (let d = 1; d <= diasEnMes; d++) celdas.push({ dia: d, eventos: porFecha.get(`${mes + 1}-${d}`) || [] })
      while (celdas.length % 7 !== 0) celdas.push(null)
      const label = new Date(anioActual, mes, 1).toLocaleDateString("es-AR", { month: "long" })
      meses.push({ mes, label: label.charAt(0).toUpperCase() + label.slice(1), celdas })
    }
    return { meses, eventosSinFecha: sinFecha }
  }, [eventosFiltrados, anioActual])

  const esHoy = (mes: number, dia: number) =>
    hoy.getFullYear() === anioActual && hoy.getMonth() === mes && hoy.getDate() === dia

  const handleDiaClick = (mes: number, celda: CeldaDia) => {
    if (!celda || celda.eventos.length === 0) return
    if (celda.eventos.length === 1) {
      handleVerGuia(celda.eventos[0])
      return
    }
    const fecha = `${anioActual}-${String(mes + 1).padStart(2, "0")}-${String(celda.dia).padStart(2, "0")}`
    setDiaDialog({ fecha, eventos: celda.eventos })
  }

  const getTotalInvitados = (e: EventoGuardado) =>
    (e.adultos || 0) + (e.adolescentes || 0) + (e.ninos || 0) + (e.personasDietasEspeciales || 0)

  const handleVerGuia = (evento: EventoGuardado) => {
    setSelectedEvento(evento)
    setDialogOpen(true)
  }

  // Construir allDishes usando recetas frescas del hook (tiempo real)
  const getAllDishes = (evento: EventoGuardado) => {
    const recetasAdultosSeleccionadas = recetas.filter((r: any) => (evento.recetasAdultos || []).includes(r.id))
    const recetasAdolescentesSeleccionadas = recetas.filter((r: any) => (evento.recetasAdolescentes || []).includes(r.id))
    const recetasNinosSeleccionadas = recetas.filter((r: any) => (evento.recetasNinos || []).includes(r.id))
    const recetasDietasEspecialesSeleccionadas = recetas.filter((r: any) => (evento.recetasDietasEspeciales || []).includes(r.id))
    return [
      ...recetasAdultosSeleccionadas.map((r) => ({
        receta: r,
        multiplier: (evento.multipliersAdultos || {})[r.id] || 1,
        pax: evento.adultos || 0,
        segment: "Adultos",
      })),
      ...recetasAdolescentesSeleccionadas.map((r) => ({
        receta: r,
        multiplier: (evento.multipliersAdolescentes || {})[r.id] || 1,
        pax: evento.adolescentes || 0,
        segment: "Adolescentes",
      })),
      ...recetasNinosSeleccionadas.map((r) => ({
        receta: r,
        multiplier: (evento.multipliersNinos || {})[r.id] || 1,
        pax: evento.ninos || 0,
        segment: "Ninos",
      })),
      ...recetasDietasEspecialesSeleccionadas.map((r) => ({
        receta: r,
        multiplier: (evento.multipliersDietasEspeciales || {})[r.id] || 1,
        pax: evento.personasDietasEspeciales || 0,
        segment: "Dietas Especiales",
      })),
    ]
  }

  const smartUnits = (amount: number, unit: string) => {
    const u = unit.toUpperCase()
    if ((u === "GR" || u === "GRS") && amount >= 1000) return `${(amount / 1000).toFixed(2)} KG`
    if (u === "GR" || u === "GRS") return `${Math.round(amount)} GRS`
    if ((u === "CC" || u === "ML") && amount >= 1000) return `${(amount / 1000).toFixed(2)} L`
    if (u === "CC" || u === "ML") return `${Math.round(amount)} CC`
    if (u === "KG" && amount < 1) return `${Math.round(amount * 1000)} GRS`
    if (u === "KG") return `${amount.toFixed(2)} KG`
    if (u === "L" && amount < 1) return `${Math.round(amount * 1000)} CC`
    if (u === "L") return `${amount.toFixed(2)} L`
    return `${amount.toFixed(1)} ${unit}`
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Cargando eventos...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Selector de salón estilo perfiles al entrar
  if (selectorAbierto) {
    return (
      <SalonSelectorOverlay
        titulo="Proximos eventos"
        onSelect={(salon) => {
          setFiltroSalon(salon)
          setSelectorAbierto(false)
        }}
      />
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-orange-500" />
            Proximos eventos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Calendario anual de los eventos con guia de produccion
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
            {filtroSalon === "todos" ? (
              <span>Todos los salones</span>
            ) : (
              <span className="flex items-center gap-2">
                <SalonDot salon={filtroSalon} size={8} />
                {salonLabel(filtroSalon)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Buscador + selector de vista */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar evento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1 self-start">
          <Button
            variant={vista === "calendario" ? "default" : "ghost"}
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setVista("calendario")}
          >
            <CalendarDays className="h-4 w-4" />
            Calendario
          </Button>
          <Button
            variant={vista === "lista" ? "default" : "ghost"}
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setVista("lista")}
          >
            <List className="h-4 w-4" />
            Lista
          </Button>
        </div>
      </div>

      {/* ── VISTA CALENDARIO ─────────────────────────────────────────── */}
      {vista === "calendario" && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Navegación de año */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" onClick={() => setAnioActual((a) => a - 1)} aria-label="Año anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">{anioActual}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setAnioActual(hoy.getFullYear())}
                >
                  Este año
                </Button>
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" onClick={() => setAnioActual((a) => a + 1)} aria-label="Año siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* 12 mini-meses */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {meses.map((m) => {
                const esMesActual = anioActual === hoy.getFullYear() && m.mes === hoy.getMonth()
                return (
                <div
                  key={m.mes}
                  ref={esMesActual ? mesActualRef : undefined}
                  className={cn(
                    "rounded-lg border bg-card p-2 scroll-mt-4",
                    esMesActual && "border-orange-400 ring-1 ring-orange-400",
                  )}
                >
                  <h3
                    className={cn(
                      "mb-2 text-center text-sm font-semibold",
                      esMesActual ? "text-orange-600" : "text-foreground",
                    )}
                  >
                    {m.label}
                  </h3>
                  <div className="grid grid-cols-7 gap-0.5">
                    {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                      <div key={i} className="text-center text-[10px] font-medium text-muted-foreground">
                        {d}
                      </div>
                    ))}
                    {m.celdas.map((celda, i) => {
                      if (celda === null) return <div key={`v-${i}`} className="h-8" />
                      const tiene = celda.eventos.length > 0
                      const hoyFlag = esHoy(m.mes, celda.dia)
                      return (
                        <button
                          key={`d-${celda.dia}`}
                          type="button"
                          disabled={!tiene}
                          onClick={() => handleDiaClick(m.mes, celda)}
                          className={cn(
                            "relative flex h-8 items-center justify-center rounded text-[11px] transition-colors",
                            tiene
                              ? "cursor-pointer bg-orange-100 font-semibold text-orange-900 hover:bg-orange-200"
                              : "text-muted-foreground/60",
                            hoyFlag && "ring-2 ring-orange-500",
                          )}
                          title={
                            tiene
                              ? celda.eventos.map((e) => e.nombrePareja || e.nombre || "Sin nombre").join(", ")
                              : undefined
                          }
                        >
                          {celda.dia}
                          {celda.eventos.length > 1 && (
                            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-orange-500 px-1 text-[8px] font-bold text-white">
                              {celda.eventos.length}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
                )
              })}
            </div>

            {/* Eventos sin fecha */}
            {eventosSinFecha.length > 0 && (
              <div className="rounded-lg border border-dashed p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Sin fecha asignada</p>
                <div className="flex flex-wrap gap-2">
                  {eventosSinFecha.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => handleVerGuia(ev)}
                      className="rounded-full border border-orange-300 bg-orange-50 hover:bg-orange-100 px-3 py-1 text-xs font-medium text-orange-900 transition-colors"
                    >
                      {ev.nombrePareja || ev.nombre || "Sin nombre"} · {getTotalInvitados(ev)} pax
                    </button>
                  ))}
                </div>
              </div>
            )}

            {eventosFiltrados.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                {searchQuery ? "No se encontraron eventos." : "No hay eventos con recetas."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── VISTA LISTA ──────────────────────────────────────────────── */}
      {vista === "lista" && (eventosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-medium text-foreground">
              {searchQuery ? "No se encontraron eventos" : "No hay eventos con recetas"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? "Intenta con otro termino de busqueda."
                : "Los eventos apareceran aqui cuando tengan recetas asignadas."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Evento</TableHead>
                  <TableHead className="min-w-[100px]">Fecha</TableHead>
                  <TableHead className="min-w-[90px]">Salon</TableHead>
                  <TableHead className="min-w-[80px] text-center">Invitados</TableHead>
                  <TableHead className="min-w-[110px]">Estado</TableHead>
                  <TableHead className="min-w-[80px] text-right">Guia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventosFiltrados.map((evento) => {
                  const config = estadoConfig[evento.estado] || estadoConfig.borrador
                  const totalInvitados = getTotalInvitados(evento)
                  const displayName = evento.nombrePareja || evento.nombre || "Sin nombre"
                  return (
                    <TableRow key={evento.id} className="group">
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground truncate max-w-[200px]">
                            {displayName}
                          </p>
                          {evento.tipoEvento && (
                            <p className="text-xs text-muted-foreground">{evento.tipoEvento}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatFecha(evento.fecha)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{evento.salon || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{totalInvitados}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleVerGuia(evento)}
                        >
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ))}

      {/* Dialog: elegir entre varios eventos del mismo día */}
      <Dialog open={!!diaDialog} onOpenChange={(open) => !open && setDiaDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-5 w-5" />
              Eventos del {diaDialog ? formatFecha(diaDialog.fecha) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {diaDialog?.eventos.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => {
                  setDiaDialog(null)
                  handleVerGuia(ev)
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-left transition-colors hover:bg-orange-100"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-orange-900">
                    {ev.nombrePareja || ev.nombre || "Sin nombre"}
                  </span>
                  <span className="block text-xs text-orange-700/80">
                    {getTotalInvitados(ev)} pax{ev.salon ? ` · ${salonLabel(ev.salon)}` : ""}
                  </span>
                </span>
                <Eye className="h-4 w-4 shrink-0 text-orange-700" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog guia de produccion - mise en place */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ChefHat className="h-5 w-5" />
              Guia de Produccion - Mise en Place
            </DialogTitle>
          </DialogHeader>

          {selectedEvento && (() => {
            const dishes = getAllDishes(selectedEvento)
            const totalPersonas = getTotalInvitados(selectedEvento)
            return (
              <div className="space-y-0 font-sans text-black">
                {/* Contenido imprimible con ID para captura */}
                <div id="mise-en-place-print-content">
                  <p className="total-line" style={{ textAlign: "right", fontSize: "9pt", color: "#555", marginBottom: "6px" }}>
                    Total: {totalPersonas} personas
                  </p>
                  <div className="header-box" style={{ border: "2px solid #000", textAlign: "center", padding: "6px", marginBottom: "10px" }}>
                    <p style={{ fontWeight: "bold", fontSize: "11pt", letterSpacing: "1px" }}>GUIA DE PRODUCCION - MISE EN PLACE</p>
                    <p style={{ fontSize: "9pt", marginTop: "2px" }}>
                      {selectedEvento.nombrePareja || selectedEvento.nombre}
                      {selectedEvento.fecha ? ` | ${new Date(selectedEvento.fecha + "T12:00:00").toLocaleDateString("es-AR")}` : ""}
                      {" | "}{totalPersonas} personas
                    </p>
                  </div>

                  {dishes.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 py-10">
                      Este evento no tiene recetas asignadas.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {dishes.map((dish, di) => (
                        <div key={di} className="receta-block" style={{ border: "1px solid #ccc", marginBottom: "12px" }}>
                          <div className="receta-header" style={{ background: "#3a3a3a", color: "#fff", padding: "6px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: "bold", fontSize: "10pt" }}>
                              {dish.receta.nombre}
                              {dish.multiplier !== 1 && (
                                <span style={{ marginLeft: "8px", fontWeight: "normal", fontSize: "8pt", opacity: 0.85 }}>
                                  (x{dish.multiplier % 1 === 0 ? dish.multiplier : dish.multiplier.toFixed(1)} un/persona)
                                </span>
                              )}
                            </span>
                            <span style={{ fontSize: "8pt", opacity: 0.85 }}>{dish.segment} - {dish.pax} pax</span>
                          </div>

                          {(!dish.receta.insumos || dish.receta.insumos.length === 0) ? (
                            <div style={{ padding: "6px 8px", fontSize: "9pt", color: "#888", fontStyle: "italic" }}>Sin ingredientes cargados</div>
                          ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
                              <thead>
                                <tr style={{ background: "#f0f0f0" }}>
                                  <th style={{ textAlign: "left", padding: "4px 6px", border: "1px solid #ccc", fontSize: "8pt", textTransform: "uppercase" }}>Ingrediente</th>
                                  <th style={{ textAlign: "right", padding: "4px 6px", border: "1px solid #ccc", fontSize: "8pt", textTransform: "uppercase", width: "90px" }}>Por Plato</th>
                                  <th style={{ textAlign: "right", padding: "4px 6px", border: "1px solid #ccc", fontSize: "8pt", textTransform: "uppercase", width: "110px" }}>Cantidad Total</th>
                                  <th style={{ textAlign: "left", padding: "4px 6px", border: "1px solid #ccc", fontSize: "8pt", textTransform: "uppercase" }}>Mise en Place</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dish.receta.insumos.map((ing: any, idx: number) => {
                                  const insumo = state.insumos.find((i) => i.id === ing.insumoId)
                                  if (!insumo) return null
                                  const inputUnit = ing.unidadReceta || insumo.unidad
                                  const cantidadPorPlato = ing.cantidadBasePorPersona
                                  const cantidadTotal = cantidadPorPlato * dish.pax * dish.multiplier
                                  return (
                                    <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#f9f9f9" }}>
                                      <td style={{ padding: "4px 6px", border: "1px solid #ddd", fontWeight: "500" }}>{insumo.descripcion}</td>
                                      <td style={{ padding: "4px 6px", border: "1px solid #ddd", textAlign: "right", fontFamily: "monospace" }}>{cantidadPorPlato} {inputUnit}</td>
                                      <td style={{ padding: "4px 6px", border: "1px solid #ddd", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>{smartUnits(cantidadTotal, inputUnit)}</td>
                                      <td style={{ padding: "4px 6px", border: "1px solid #ddd", color: "#333" }}>{ing.detalleCorte || "-"}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botón imprimir */}
                <div className="flex justify-end pt-4 border-t mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const printWindow = window.open("", "_blank", "width=900,height=700")
                      if (!printWindow) return
                      const content = document.getElementById("mise-en-place-print-content")?.innerHTML || ""
                      printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Guia de Produccion - ${selectedEvento?.nombrePareja || selectedEvento?.nombre || ""}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; background: #fff; padding: 20px; }
    .header-box { border: 2px solid #000; text-align: center; padding: 6px; margin-bottom: 10px; }
    .header-box p:first-child { font-weight: bold; font-size: 11pt; letter-spacing: 1px; }
    .header-box p:last-child { font-size: 9pt; margin-top: 2px; }
    .total-line { text-align: right; font-size: 9pt; color: #555; margin-bottom: 6px; }
    .receta-block { border: 1px solid #ccc; margin-bottom: 12px; page-break-inside: avoid; }
    .receta-header { background: #3a3a3a; color: #fff; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center; }
    .receta-header .nombre { font-weight: bold; font-size: 10pt; }
    .receta-header .pax { font-size: 8pt; opacity: 0.85; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th { background: #f0f0f0; text-align: left; padding: 4px 6px; border: 1px solid #ccc; font-size: 8pt; text-transform: uppercase; }
    th.right { text-align: right; }
    td { padding: 4px 6px; border: 1px solid #ddd; vertical-align: top; }
    td.right { text-align: right; font-family: monospace; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .no-data { padding: 6px 8px; font-size: 9pt; color: #888; font-style: italic; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  ${content}
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`)
                      printWindow.document.close()
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

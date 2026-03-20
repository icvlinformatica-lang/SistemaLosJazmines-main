"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import {
  formatCurrency,
  type EventoGuardado,
  type EstadoEvento,
  SALONES,
  loadState,
  deleteEvento as deleteEventoFromStore,
  calcularComprasSegmentadas,
  type CalculoCompraSegmentado,
} from "@/lib/store"
import { imprimirDocumentoEvento, type DocumentSections } from "@/lib/print-utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Eye,
  Printer,
  Trash2,
  Calendar as CalendarIcon,
  Users,
  Building2,
  Search,
  MoreHorizontal,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  CheckCircle,
  RotateCcw,
  Sparkles,
  ShoppingCart,
  X,
} from "lucide-react"
import { generateId } from "@/lib/store"

// cache-bust: v2 - estadoConfig includes en_preparacion, confirmado removed
const estadoConfig: Record<string, { label: string; className: string }> = {
  pendiente: {
    label: "Pendiente",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  en_preparacion: {
    label: "En Preparacion",
    className: "bg-sky-100 text-sky-800 border-sky-300",
  },
  confirmado: {
    label: "Confirmado",
    className: "bg-sky-100 text-sky-800 border-sky-300",
  },
  completado: {
    label: "Completado",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-red-100 text-red-800 border-red-300",
  },
}

function formatFecha(fecha: string) {
  if (!fecha) return "-"
  try {
    const [year, month, day] = fecha.split("-")
    return `${day}/${month}/${year}`
  } catch {
    return fecha
  }
}

export default function EventosListaPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { state, eventos, recetas, insumos, insumosBarra, cocteles, barrasTemplates, updateEvento, updateInsumo, updateInsumoBarra, deleteEvento, setEventoActual } = useStore()

  const [searchQuery, setSearchQuery] = useState("")
  const [filtroEstado, setFiltroEstado] = useState<string>("todos")
  const [filtroSalon, setFiltroSalon] = useState<string>("todos")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [recuperarStockAlEliminar, setRecuperarStockAlEliminar] = useState(false)
  const [recuperarStockDialogOpen, setRecuperarStockDialogOpen] = useState(false)
  const [selectedEventoId, setSelectedEventoId] = useState<string | null>(null)
  const [showDashboard, setShowDashboard] = useState(true)
  const [imprimirDialogOpen, setImprimirDialogOpen] = useState(false)
  const [imprimirEventoId, setImprimirEventoId] = useState<string | null>(null)
  const [seccionesSeleccionadas, setSeccionesSeleccionadas] = useState<DocumentSections>({
    listaCompras: true,
    barraCocteles: true,
    guiaProduccion: true,
    hojaGastos: true,
  })

  // Consolidar compras
  const [modoConsolidar, setModoConsolidar] = useState(false)
  const [eventosSeleccionados, setEventosSeleccionados] = useState<Set<string>>(new Set())
  const [compraConsolidada, setCompraConsolidada] = useState<CalculoCompraSegmentado[] | null>(null)
  const [consolidadaDialogOpen, setConsolidadaDialogOpen] = useState(false)

  // Filter events
  const eventosFiltrados = (eventos || [])
    .filter((e) => {
      const matchesSearch =
        !searchQuery ||
        (e.nombre || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.nombrePareja || "").toLowerCase().includes(searchQuery.toLowerCase())
      const matchesEstado = filtroEstado === "todos" || e.estado === filtroEstado
      const matchesSalon = filtroSalon === "todos" || e.salon === filtroSalon
      return matchesSearch && matchesEstado && matchesSalon
    })
    .sort((a, b) => {
      // Sort by date, most recent first
      if (!a.fecha) return 1
      if (!b.fecha) return -1
      return a.fecha.localeCompare(b.fecha)
    })

  const toggleEventoSeleccionado = (id: string) => {
    setEventosSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const generarCompraConsolidada = () => {
    const seleccionados = (eventos || []).filter((e) => eventosSeleccionados.has(e.id))
    const mapa: Record<string, CalculoCompraSegmentado> = {}
    const sinRecetas: string[] = []

    for (const evento of seleccionados) {
      const tieneRecetas =
        (evento.recetasAdultos?.length || 0) +
        (evento.recetasAdolescentes?.length || 0) +
        (evento.recetasNinos?.length || 0) +
        (evento.recetasDietasEspeciales?.length || 0) > 0

      if (!tieneRecetas) {
        sinRecetas.push(evento.nombrePareja || evento.nombre || "Sin nombre")
        continue
      }

      const compras = calcularComprasSegmentadas(evento, recetas, insumos)
      for (const compra of compras) {
        if (mapa[compra.insumoId]) {
          mapa[compra.insumoId].cantidadNecesaria += compra.cantidadNecesaria
          mapa[compra.insumoId].cantidadAComprar += compra.cantidadAComprar
          mapa[compra.insumoId].costoEstimado += compra.costoEstimado
          mapa[compra.insumoId].costoMateriaPrima += compra.costoMateriaPrima
        } else {
          mapa[compra.insumoId] = { ...compra }
        }
      }
    }

    if (sinRecetas.length > 0) {
      toast({
        title: "Aviso",
        description: `${sinRecetas.join(", ")} no ${sinRecetas.length === 1 ? "tiene" : "tienen"} recetas asignadas y ${sinRecetas.length === 1 ? "fue ignorado" : "fueron ignorados"}.`,
      })
    }

    const resultado = Object.values(mapa).sort((a, b) =>
      a.insumo.descripcion.localeCompare(b.insumo.descripcion)
    )
    setCompraConsolidada(resultado)
    setConsolidadaDialogOpen(true)
  }

  const imprimirConsolidado = () => {
    if (!compraConsolidada) return
    const seleccionados = (eventos || []).filter((e) => eventosSeleccionados.has(e.id))
    const totalPersonas = seleccionados.reduce((sum, e) =>
      sum + (e.adultos || 0) + (e.adolescentes || 0) + (e.ninos || 0) + (e.personasDietasEspeciales || 0), 0)
    const costoTotal = compraConsolidada.reduce((sum, c) => sum + c.costoMateriaPrima, 0)

    const filas = compraConsolidada
      .map((c, i) => `
        <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"}">
          <td style="padding:6px 10px;font-size:9pt;">${c.insumo.descripcion}</td>
          <td style="padding:6px 10px;font-size:9pt;text-align:right;font-family:monospace;">${c.cantidadNecesaria.toFixed(2)} ${c.insumo.unidad}</td>
          <td style="padding:6px 10px;font-size:9pt;text-align:right;font-family:monospace;">${formatCurrency(c.costoMateriaPrima)}</td>
        </tr>`)
      .join("")

    const fechas = seleccionados.map((e) => formatFecha(e.fecha)).join(", ")
    const nombres = seleccionados.map((e) => e.nombrePareja || e.nombre || "Sin nombre").join(" / ")

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Compra Consolidada</title>
      <style>body{font-family:Arial,sans-serif;margin:20px;color:#111;}
      table{border-collapse:collapse;width:100%;}
      th{background:#111;color:#fff;padding:7px 10px;font-size:9pt;text-align:left;}
      tfoot td{background:#111;color:#fff;padding:7px 10px;font-size:10pt;font-weight:bold;}
      @media print{body{margin:10mm;}}</style></head>
      <body>
      <h2 style="margin:0 0 4px;font-size:16pt;">LISTA DE COMPRAS CONSOLIDADA</h2>
      <p style="margin:0 0 2px;font-size:9pt;color:#555;">${nombres}</p>
      <p style="margin:0 0 12px;font-size:9pt;color:#555;">${fechas} · ${seleccionados.length} eventos · ${totalPersonas} personas · ${formatCurrency(costoTotal)} costo estimado</p>
      <table><thead><tr>
        <th>INSUMO</th><th style="text-align:right;width:130px;">CANTIDAD</th><th style="text-align:right;width:110px;">COSTO</th>
      </tr></thead><tbody>${filas}</tbody>
      <tfoot><tr>
        <td colspan="2" style="text-align:right;">TOTAL:</td>
        <td style="text-align:right;">${formatCurrency(costoTotal)}</td>
      </tr></tfoot></table>
      </body></html>`

    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 300)
  }

  const handleVerEditar = (evento: EventoGuardado) => {
    setEventoActual(evento)
    router.push(`/evento?id=${evento.id}`)
  }

  const handleNuevoEvento = () => {
    setEventoActual(null)
    setTimeout(() => {
      setEventoActual({
        id: generateId(),
        nombre: "",
        fecha: new Date().toISOString().split("T")[0],
        horario: "",
        salon: undefined,
        tipoEvento: undefined,
        nombrePareja: "",
        adultos: 0,
        adolescentes: 0,
        ninos: 0,
        personasDietasEspeciales: 0,
        recetasAdultos: [],
        recetasAdolescentes: [],
        recetasNinos: [],
        recetasDietasEspeciales: [],
        multipliersAdultos: {},
        multipliersAdolescentes: {},
        multipliersNinos: {},
        multipliersDietasEspeciales: {},
        descripcionPersonalizada: "",
        barras: [],
      })
      router.push("/evento")
    }, 50)
  }

  const handleEliminar = (eventoId: string) => {
    setSelectedEventoId(eventoId)
    setRecuperarStockAlEliminar(false)
    setDeleteDialogOpen(true)
  }

  const confirmConfirmar = () => {
    if (!selectedEventoId) return
    updateEvento(selectedEventoId, { estado: "en_preparacion" })
    toast({ title: "Evento actualizado", description: "El estado cambio a En Preparacion" })
    setSelectedEventoId(null)
  }

  const handleRecuperarStock = (eventoId: string) => {
    setSelectedEventoId(eventoId)
    setRecuperarStockDialogOpen(true)
  }

  const confirmRecuperarStock = () => {
    if (!selectedEventoId) return
    const evento = eventos.find((e) => e.id === selectedEventoId)
    if (!evento) return

    // Recalcular el delta igual que al descontar
    const cantidadPorReceta: Record<string, number> = {}
    ;(evento.recetasAdultos || []).forEach((id) => { cantidadPorReceta[id] = (cantidadPorReceta[id] || 0) + (evento.adultos || 0) })
    ;(evento.recetasAdolescentes || []).forEach((id) => { cantidadPorReceta[id] = (cantidadPorReceta[id] || 0) + (evento.adolescentes || 0) })
    ;(evento.recetasNinos || []).forEach((id) => { cantidadPorReceta[id] = (cantidadPorReceta[id] || 0) + (evento.ninos || 0) })
    ;(evento.recetasDietasEspeciales || []).forEach((id) => { cantidadPorReceta[id] = (cantidadPorReceta[id] || 0) + (evento.personasDietasEspeciales || 0) })

    const stockDelta: Record<string, number> = {}
    Object.entries(cantidadPorReceta).forEach(([recetaId, personas]) => {
      const receta = recetas.find((r) => r.id === recetaId)
      if (!receta) return
      receta.insumos.forEach((ri) => {
        const cantidad = ri.cantidadBasePorPersona * personas * (receta.factorRendimiento || 1)
        stockDelta[ri.insumoId] = (stockDelta[ri.insumoId] || 0) + cantidad
      })
    })

    // Devolver el stock (sumar lo que se habia descontado)
    Object.entries(stockDelta).forEach(([insumoId, cantidad]) => {
      const insumo = insumos.find((i) => i.id === insumoId)
      if (!insumo) return
      updateInsumo(insumoId, { stockActual: (insumo.stockActual || 0) + cantidad })
    })

    // Volver a pendiente
    updateEvento(selectedEventoId, { estado: "pendiente" })

    // Registrar en historial
    const nombreEvento = evento.nombrePareja || evento.nombre || "Evento sin nombre"
    fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "evento",
        accion: "modificado",
        nombre: nombreEvento,
        detalle: `Stock recuperado — evento vuelto a Pendiente (${Object.keys(stockDelta).length} insumos restituidos)`,
      }),
    }).catch(() => {})

    toast({ title: "Stock recuperado", description: "Los insumos fueron restituidos y el evento volvio a Pendiente." })
    setRecuperarStockDialogOpen(false)
    setSelectedEventoId(null)
  }

  const confirmEliminar = () => {
    if (!selectedEventoId) return
    const evento = eventos.find((e) => e.id === selectedEventoId)

    // Si el evento esta en preparacion y el usuario quiere recuperar el stock
    if (recuperarStockAlEliminar && evento && evento.estado === "en_preparacion") {
      const cantidadPorReceta: Record<string, number> = {}
      ;(evento.recetasAdultos || []).forEach((id) => { cantidadPorReceta[id] = (cantidadPorReceta[id] || 0) + (evento.adultos || 0) })
      ;(evento.recetasAdolescentes || []).forEach((id) => { cantidadPorReceta[id] = (cantidadPorReceta[id] || 0) + (evento.adolescentes || 0) })
      ;(evento.recetasNinos || []).forEach((id) => { cantidadPorReceta[id] = (cantidadPorReceta[id] || 0) + (evento.ninos || 0) })
      ;(evento.recetasDietasEspeciales || []).forEach((id) => { cantidadPorReceta[id] = (cantidadPorReceta[id] || 0) + (evento.personasDietasEspeciales || 0) })
      const stockDelta: Record<string, number> = {}
      Object.entries(cantidadPorReceta).forEach(([recetaId, personas]) => {
        const receta = recetas.find((r) => r.id === recetaId)
        if (!receta) return
        receta.insumos.forEach((ri) => {
          const cantidad = ri.cantidadBasePorPersona * personas * (receta.factorRendimiento || 1)
          stockDelta[ri.insumoId] = (stockDelta[ri.insumoId] || 0) + cantidad
        })
      })
      Object.entries(stockDelta).forEach(([insumoId, cantidad]) => {
        const insumo = insumos.find((i) => i.id === insumoId)
        if (!insumo) return
        updateInsumo(insumoId, { stockActual: (insumo.stockActual || 0) + cantidad })
      })
    }

    const fullState = loadState()
    deleteEventoFromStore(fullState, selectedEventoId)
    deleteEvento(selectedEventoId)
    toast({
      title: "Evento eliminado",
      description: recuperarStockAlEliminar ? "El evento fue eliminado y el stock fue recuperado." : "El evento fue eliminado correctamente.",
    })
    setDeleteDialogOpen(false)
    setSelectedEventoId(null)
    setRecuperarStockAlEliminar(false)
  }

  const getTotalInvitados = (e: EventoGuardado) => {
    return e.adultos + e.adolescentes + e.ninos + (e.personasDietasEspeciales || 0)
  }

  const handleImprimirDocumento = (eventoId: string) => {
    setImprimirEventoId(eventoId)
    setSeccionesSeleccionadas({ listaCompras: true, barraCocteles: true, guiaProduccion: true, hojaGastos: true })
    setImprimirDialogOpen(true)
  }

  const handleConfirmarImpresion = () => {
    if (!imprimirEventoId) return
    const evento = eventos.find((e) => e.id === imprimirEventoId)
    if (!evento) return

    // Imprimir el documento
    imprimirDocumentoEvento(
      { evento, recetas, insumos, insumosBarra, cocteles, barrasTemplates },
      seccionesSeleccionadas
    )

    // Solo descontar stock si el evento aun esta pendiente (no se desconto antes)
    if (evento.estado === "pendiente") {
      const cantidadPorReceta: Record<string, number> = {}
      ;(evento.recetasAdultos || []).forEach((id) => { cantidadPorReceta[id] = (cantidadPorReceta[id] || 0) + (evento.adultos || 0) })
      ;(evento.recetasAdolescentes || []).forEach((id) => { cantidadPorReceta[id] = (cantidadPorReceta[id] || 0) + (evento.adolescentes || 0) })
      ;(evento.recetasNinos || []).forEach((id) => { cantidadPorReceta[id] = (cantidadPorReceta[id] || 0) + (evento.ninos || 0) })
      ;(evento.recetasDietasEspeciales || []).forEach((id) => { cantidadPorReceta[id] = (cantidadPorReceta[id] || 0) + (evento.personasDietasEspeciales || 0) })

      const stockDelta: Record<string, number> = {}
      Object.entries(cantidadPorReceta).forEach(([recetaId, personas]) => {
        const receta = recetas.find((r) => r.id === recetaId)
        if (!receta) return
        receta.insumos.forEach((ri) => {
          const cantidad = ri.cantidadBasePorPersona * personas * (receta.factorRendimiento || 1)
          stockDelta[ri.insumoId] = (stockDelta[ri.insumoId] || 0) + cantidad
        })
      })
      Object.entries(stockDelta).forEach(([insumoId, cantidad]) => {
        const insumo = insumos.find((i) => i.id === insumoId)
        if (!insumo) return
        const nuevoStock = Math.max(0, (insumo.stockActual || 0) - cantidad)
        updateInsumo(insumoId, { stockActual: nuevoStock })
      })

      // Registrar en historial de actividad
      const nombreEvento = evento.nombrePareja || evento.nombre || "Evento sin nombre"
      fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "evento",
          accion: "modificado",
          nombre: nombreEvento,
          detalle: `Stock descontado al imprimir documento (${Object.keys(stockDelta).length} insumos afectados)`,
        }),
      }).catch(() => {})

      // Cambiar estado a En Preparacion
      updateEvento(imprimirEventoId, { estado: "en_preparacion" })
      toast({ title: "Documento generado", description: "El evento paso a En Preparacion y se desconto el stock." })
    } else {
      toast({ title: "Documento reimpreso", description: "El stock no fue modificado (ya se desconto anteriormente)." })
    }

    setImprimirDialogOpen(false)
    setImprimirEventoId(null)
  }

  const ningunaSeccionSeleccionada = !seccionesSeleccionadas.listaCompras && !seccionesSeleccionadas.barraCocteles && !seccionesSeleccionadas.guiaProduccion && !seccionesSeleccionadas.hojaGastos

  // Summary stats
  const totalEventos = eventos?.length || 0
  const eventosPendientes = (eventos || []).filter((e) => e.estado === "pendiente").length
  const eventosEnPreparacion = (eventos || []).filter((e) => e.estado === "en_preparacion").length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 sticky top-0 z-30">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Lista de Eventos</h1>
              <p className="text-sm text-muted-foreground">
                {totalEventos} evento{totalEventos !== 1 ? "s" : ""} en total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={modoConsolidar ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setModoConsolidar(!modoConsolidar)
                setEventosSeleccionados(new Set())
              }}
              className="gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">{modoConsolidar ? "Cancelar" : "Consolidar compras"}</span>
            </Button>
            <Button onClick={handleNuevoEvento} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo Evento</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Dashboard Toggle + Summary Cards */}
        <div className="mb-6">
          <button
            onClick={() => setShowDashboard(!showDashboard)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="font-medium">Dashboard</span>
            {showDashboard ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showDashboard && (
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-200">
                      <CalendarIcon className="h-5 w-5 text-amber-800" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-900">{eventosPendientes}</p>
                      <p className="text-xs text-amber-700 font-medium">Pendientes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-sky-200 bg-sky-50">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-200">
                      <CheckCircle className="h-5 w-5 text-sky-800" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-sky-900">{eventosEnPreparacion}</p>
                      <p className="text-xs text-sky-700 font-medium">En Preparacion</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{totalEventos}</p>
                      <p className="text-xs text-muted-foreground font-medium">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-full sm:w-[160px] h-10">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_preparacion">En Preparacion</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroSalon} onValueChange={setFiltroSalon}>
            <SelectTrigger className="w-full sm:w-[160px] h-10">
              <SelectValue placeholder="Salon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {SALONES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Events Table */}
        {eventosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <CalendarIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No hay eventos</h3>
                <p className="text-muted-foreground mb-6 max-w-sm">
                  {searchQuery || filtroEstado !== "todos" || filtroSalon !== "todos"
                    ? "No se encontraron eventos con los filtros aplicados."
                    : "Crea tu primer evento desde el planificador de fiestas."}
                </p>
                {!searchQuery && filtroEstado === "todos" && filtroSalon === "todos" && (
                  <Button onClick={handleNuevoEvento} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Planificar Fiesta
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            {/* Banner de consolidacion */}
            {modoConsolidar && (
              <div className="flex items-center justify-between gap-4 border-b bg-sky-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-sky-800">
                  <ShoppingCart className="h-4 w-4 shrink-0" />
                  {eventosSeleccionados.size === 0
                    ? "Selecciona al menos 2 eventos para consolidar"
                    : `${eventosSeleccionados.size} evento${eventosSeleccionados.size !== 1 ? "s" : ""} seleccionado${eventosSeleccionados.size !== 1 ? "s" : ""}`}
                </div>
                {eventosSeleccionados.size >= 2 && (
                  <Button size="sm" onClick={generarCompraConsolidada} className="gap-2 shrink-0">
                    <ShoppingCart className="h-4 w-4" />
                    Generar compra consolidada
                  </Button>
                )}
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {modoConsolidar && <TableHead className="w-10" />}
                    <TableHead className="min-w-[180px]">Nombre</TableHead>
                    <TableHead className="min-w-[100px]">Fecha</TableHead>
                    <TableHead className="min-w-[90px]">Salon</TableHead>
                    <TableHead className="min-w-[80px] text-center">Invitados</TableHead>
                    <TableHead className="min-w-[110px]">Estado</TableHead>
                    <TableHead className="min-w-[80px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventosFiltrados.map((evento) => {
                    const config = estadoConfig[evento.estado]
                    const totalInvitados = getTotalInvitados(evento)
                    const displayName = evento.nombrePareja || evento.nombre || "Sin nombre"
                    return (
                      <TableRow
                        key={evento.id}
                        className={`group ${modoConsolidar && eventosSeleccionados.has(evento.id) ? "bg-sky-50" : ""}`}
                      >
                        {modoConsolidar && (
                          <TableCell className="w-10">
                            <Checkbox
                              checked={eventosSeleccionados.has(evento.id)}
                              onCheckedChange={() => toggleEventoSeleccionado(evento.id)}
                            />
                          </TableCell>
                        )}
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
                        <TableCell className="text-sm">
                          {formatFecha(evento.fecha)}
                        </TableCell>
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
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium ${config.className}`}
                          >
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Imprimir hoja de gastos"
                              onClick={() => handleImprimirDocumento(evento.id)}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Acciones</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => handleVerEditar(evento)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver / Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleImprimirDocumento(evento.id)}>
                                <Printer className="h-4 w-4 mr-2" />
                                Imprimir Documento
                              </DropdownMenuItem>
                              {evento.estado === "en_preparacion" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleRecuperarStock(evento.id)}
                                    className="text-amber-600 focus:text-amber-600"
                                  >
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Recuperar Stock
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleEliminar(evento.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </main>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Evento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion eliminara el evento permanentemente.
              No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmEliminar}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Si, Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Sections Dialog */}
      <Dialog open={imprimirDialogOpen} onOpenChange={setImprimirDialogOpen}>
        <DialogContent className="sm:max-w-md">
          {(() => {
            const eventoImprimir = imprimirEventoId ? eventos.find((e) => e.id === imprimirEventoId) : null
            const yaDescontado = eventoImprimir?.estado !== "pendiente"
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Imprimir Documento</DialogTitle>
                  <DialogDescription>
                    {eventoImprimir?.nombrePareja || eventoImprimir?.nombre || "Evento"}
                  </DialogDescription>
                </DialogHeader>
                {yaDescontado && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 flex items-start gap-2">
                    <Printer className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>El stock de este evento ya fue descontado. Reimprimir <strong>no modificara</strong> el inventario.</span>
                  </div>
                )}
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="sec-listaCompras"
                checked={seccionesSeleccionadas.listaCompras}
                onCheckedChange={(checked) =>
                  setSeccionesSeleccionadas((prev) => ({ ...prev, listaCompras: !!checked }))
                }
              />
              <Label htmlFor="sec-listaCompras" className="cursor-pointer text-sm font-medium leading-none">
                Lista de Compras - Cocina
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="sec-barraCocteles"
                checked={seccionesSeleccionadas.barraCocteles}
                onCheckedChange={(checked) =>
                  setSeccionesSeleccionadas((prev) => ({ ...prev, barraCocteles: !!checked }))
                }
              />
              <Label htmlFor="sec-barraCocteles" className="cursor-pointer text-sm font-medium leading-none">
                Lista de Compras - Barra
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="sec-guiaProduccion"
                checked={seccionesSeleccionadas.guiaProduccion}
                onCheckedChange={(checked) =>
                  setSeccionesSeleccionadas((prev) => ({ ...prev, guiaProduccion: !!checked }))
                }
              />
              <Label htmlFor="sec-guiaProduccion" className="cursor-pointer text-sm font-medium leading-none">
                Guia de Produccion (Mise en Place)
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="sec-hojaGastos"
                checked={seccionesSeleccionadas.hojaGastos}
                onCheckedChange={(checked) =>
                  setSeccionesSeleccionadas((prev) => ({ ...prev, hojaGastos: !!checked }))
                }
              />
              <Label htmlFor="sec-hojaGastos" className="cursor-pointer text-sm font-medium leading-none">
                Hoja de Gastos (Resumen Financiero)
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setImprimirDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarImpresion}
              disabled={ningunaSeccionSeleccionada}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Compra Consolidada Dialog */}
      <Dialog open={consolidadaDialogOpen} onOpenChange={setConsolidadaDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Compra Consolidada</DialogTitle>
            <DialogDescription>
              {(() => {
                const seleccionados = (eventos || []).filter((e) => eventosSeleccionados.has(e.id))
                const totalPersonas = seleccionados.reduce((sum, e) =>
                  sum + (e.adultos || 0) + (e.adolescentes || 0) + (e.ninos || 0) + (e.personasDietasEspeciales || 0), 0)
                const costoTotal = (compraConsolidada || []).reduce((sum, c) => sum + c.costoMateriaPrima, 0)
                return `${seleccionados.length} eventos · ${totalPersonas} personas · ${formatCurrency(costoTotal)} costo estimado`
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right w-36">Cantidad</TableHead>
                  <TableHead className="text-right w-28">Costo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(compraConsolidada || []).map((c) => (
                  <TableRow key={c.insumoId}>
                    <TableCell className="font-medium text-sm">{c.insumo.descripcion}</TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {c.cantidadNecesaria.toFixed(2)} {c.insumo.unidad}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {formatCurrency(c.costoMateriaPrima)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="border-t pt-4 gap-2">
            <Button variant="outline" onClick={() => setConsolidadaDialogOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={imprimirConsolidado} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Evento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. El evento sera eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(() => {
            const evento = selectedEventoId ? eventos.find((e) => e.id === selectedEventoId) : null
            const tieneStockDescontado = evento?.estado === "en_preparacion"
            return tieneStockDescontado ? (
              <div
                className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 cursor-pointer"
                onClick={() => setRecuperarStockAlEliminar((v) => !v)}
              >
                <Checkbox
                  id="recuperar-stock-eliminar"
                  checked={recuperarStockAlEliminar}
                  onCheckedChange={(v) => setRecuperarStockAlEliminar(!!v)}
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <label htmlFor="recuperar-stock-eliminar" className="text-sm font-medium text-amber-900 cursor-pointer">
                    Recuperar el stock
                  </label>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Los insumos descontados al imprimir este evento seran restituidos al inventario.
                  </p>
                </div>
              </div>
            ) : null
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmEliminar}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Si, Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recuperar Stock Dialog */}
      <AlertDialog open={recuperarStockDialogOpen} onOpenChange={setRecuperarStockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recuperar Stock</AlertDialogTitle>
            <AlertDialogDescription>
              Esto restituira al inventario todos los insumos que fueron descontados al imprimir este evento,
              y el evento volvera al estado <strong>Pendiente</strong>.
              Usa esta opcion solo si el evento fue cancelado o necesita ser replaneado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRecuperarStock}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Si, Recuperar Stock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

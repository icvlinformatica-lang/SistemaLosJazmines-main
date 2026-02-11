"use client"

import { useState, useMemo, useEffect } from "react"
import { useStore } from "@/lib/store-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Archive,
  Calendar,
  Search,
  Filter,
  Download,
  Receipt,
  Briefcase,
  User,
  CalendarClock,
  Settings,
} from "lucide-react"

// Importar tipos y utilidades (ajustar paths según tu estructura)
import type { EgresoUnificado, IngresoEsperado, FiltrosEgresos } from "@/lib/tipos-financieros"
import {
  generarEgresosUnificados,
  generarIngresosEsperados,
  generarResumenFinanciero,
  aplicarFiltrosEgresos,
  formatCurrency,
  formatearFecha,
  getColorEstado,
} from "@/lib/utils-financieros"

// Componentes
import EgresoCard from "./egreso-card"
import IngresoCard from "./ingreso-card"
import RegistrarPagoDialog from "./registrar-pago-dialog"
import VistaEventoDialog from "./vista-evento-dialog"
import ConfiguracionDialog from "./configuracion-dialog"

export default function CentroControlFinanciero() {
  const { costosOperativos, eventos, pagosPersonal, personal } = useStore()
  
  // Estados
  const [diasAnticipacion, setDiasAnticipacion] = useState(7)
  const [filtros, setFiltros] = useState<FiltrosEgresos>({
    mostrarArchivados: false,
    ordenarPor: "urgencia",
    ordenDireccion: "asc"
  })
  const [busqueda, setBusqueda] = useState("")
  const [vistaActual, setVistaActual] = useState<"timeline" | "evento" | "categoria">("timeline")
  const [egresoSeleccionado, setEgresoSeleccionado] = useState<EgresoUnificado | null>(null)
  const [eventoSeleccionado, setEventoSeleccionado] = useState<string | null>(null)
  const [dialogRegistroPago, setDialogRegistroPago] = useState(false)
  const [dialogVistaEvento, setDialogVistaEvento] = useState(false)
  const [dialogConfig, setDialogConfig] = useState(false)

  // Generar datos unificados
  const egresosUnificados = useMemo(() => 
    generarEgresosUnificados(
      costosOperativos,
      eventos,
      pagosPersonal,
      personal,
      diasAnticipacion
    ),
    [costosOperativos, eventos, pagosPersonal, personal, diasAnticipacion]
  )

  const ingresosEsperados = useMemo(() => 
    generarIngresosEsperados(eventos),
    [eventos]
  )

  const resumen = useMemo(() => 
    generarResumenFinanciero(egresosUnificados, ingresosEsperados),
    [egresosUnificados, ingresosEsperados]
  )

  // Aplicar filtros
  const egresosFiltrados = useMemo(() => {
    const filtrosConBusqueda = { ...filtros, busqueda }
    return aplicarFiltrosEgresos(egresosUnificados, filtrosConBusqueda)
  }, [egresosUnificados, filtros, busqueda])

  // Agrupar por evento para vista de evento
  const egresosPorEvento = useMemo(() => {
    const grouped: Record<string, EgresoUnificado[]> = {}
    egresosFiltrados.forEach(egreso => {
      if (egreso.eventoId) {
        if (!grouped[egreso.eventoId]) {
          grouped[egreso.eventoId] = []
        }
        grouped[egreso.eventoId].push(egreso)
      } else {
        if (!grouped['sin-evento']) {
          grouped['sin-evento'] = []
        }
        grouped['sin-evento'].push(egreso)
      }
    })
    return grouped
  }, [egresosFiltrados])

  // Agrupar por categoría
  const egresosPorCategoria = useMemo(() => {
    const grouped: Record<string, EgresoUnificado[]> = {
      'gasto-fijo': [],
      'servicio-evento': [],
      'personal': []
    }
    egresosFiltrados.forEach(egreso => {
      grouped[egreso.tipo].push(egreso)
    })
    return grouped
  }, [egresosFiltrados])

  const handleRegistrarPago = (egreso: EgresoUnificado) => {
    setEgresoSeleccionado(egreso)
    setDialogRegistroPago(true)
  }

  const handleVerEvento = (eventoId: string) => {
    setEventoSeleccionado(eventoId)
    setDialogVistaEvento(true)
  }

  const toggleFiltro = (key: keyof FiltrosEgresos, value: any) => {
    setFiltros(prev => {
      if (key === 'tipo' || key === 'estado') {
        const current = prev[key] as any[] || []
        const exists = current.includes(value)
        return {
          ...prev,
          [key]: exists 
            ? current.filter(v => v !== value)
            : [...current, value]
        }
      }
      return { ...prev, [key]: value }
    })
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Centro de Control Financiero</h1>
          <p className="text-muted-foreground mt-1">
            Gestión unificada de todos los egresos e ingresos
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setDialogConfig(true)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Configuración
        </Button>
      </div>

      {/* Resumen Principal */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumen.egresos.pendientes.count}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(resumen.egresos.pendientes.total)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgentes + Vencidos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {resumen.egresos.urgentes.count + resumen.egresos.vencidos.count}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(resumen.egresos.urgentes.total + resumen.egresos.vencidos.total)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Esperados</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {resumen.ingresos.estaSemana.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Esta semana: {formatCurrency(resumen.ingresos.estaSemana.reduce((s, i) => s + i.monto, 0))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Semanal</CardTitle>
            {resumen.balance.cashflowEstaSemana >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              resumen.balance.cashflowEstaSemana >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {formatCurrency(resumen.balance.cashflowEstaSemana)}
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresos - Egresos (7 días)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas Activas */}
      {(resumen.egresos.vencidos.count > 0 || resumen.egresos.urgentes.count > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-2">⚠️ Alertas Activas</h3>
                <ul className="space-y-1 text-sm text-amber-800">
                  {resumen.egresos.vencidos.count > 0 && (
                    <li>
                      • {resumen.egresos.vencidos.count} pagos vencidos - Total: {formatCurrency(resumen.egresos.vencidos.total)}
                    </li>
                  )}
                  {resumen.egresos.urgentes.count > 0 && (
                    <li>
                      • {resumen.egresos.urgentes.count} pagos vencen en 3 días o menos - Total: {formatCurrency(resumen.egresos.urgentes.total)}
                    </li>
                  )}
                  {resumen.ingresos.estaSemana.length > 0 && (
                    <li>
                      • {resumen.ingresos.estaSemana.length} ingresos esperados esta semana
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ingresos Próximos */}
      {resumen.ingresos.estaSemana.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              Ingresos Esperados (Esta Semana)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resumen.ingresos.estaSemana.map(ingreso => (
                <IngresoCard 
                  key={ingreso.id} 
                  ingreso={ingreso}
                  onVerEvento={handleVerEvento}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controles y Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Búsqueda */}
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por concepto, proveedor, personal..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={filtros.periodo || "todos"}
                onValueChange={(v) => setFiltros(prev => ({ 
                  ...prev, 
                  periodo: v === "todos" ? undefined : v as any 
                }))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los períodos</SelectItem>
                  <SelectItem value="esta-semana">Esta semana</SelectItem>
                  <SelectItem value="este-mes">Este mes</SelectItem>
                  <SelectItem value="este-trimestre">Este trimestre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtros de tipo y estado */}
            <div className="flex flex-wrap gap-2">
              <Label className="text-sm text-muted-foreground mr-2">Tipo:</Label>
              {(['gasto-fijo', 'servicio-evento', 'personal'] as const).map(tipo => (
                <Button
                  key={tipo}
                  variant={filtros.tipo?.includes(tipo) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleFiltro('tipo', tipo)}
                >
                  {tipo === 'gasto-fijo' && <Receipt className="h-3 w-3 mr-1" />}
                  {tipo === 'servicio-evento' && <Briefcase className="h-3 w-3 mr-1" />}
                  {tipo === 'personal' && <User className="h-3 w-3 mr-1" />}
                  {tipo === 'gasto-fijo' ? 'Gastos Fijos' : 
                   tipo === 'servicio-evento' ? 'Servicios' : 'Personal'}
                </Button>
              ))}

              <div className="w-px h-6 bg-border mx-2" />

              <Label className="text-sm text-muted-foreground mr-2">Estado:</Label>
              {(['vencido', 'urgente', 'pendiente', 'pagado'] as const).map(estado => (
                <Button
                  key={estado}
                  variant={filtros.estado?.includes(estado) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleFiltro('estado', estado)}
                >
                  {estado === 'vencido' && '🔴'}
                  {estado === 'urgente' && '🟡'}
                  {estado === 'pendiente' && '🔵'}
                  {estado === 'pagado' && '✅'}
                  {' '}
                  {estado.charAt(0).toUpperCase() + estado.slice(1)}
                </Button>
              ))}

              <div className="flex items-center ml-auto gap-2">
                <Checkbox
                  id="mostrar-archivados"
                  checked={filtros.mostrarArchivados}
                  onCheckedChange={(checked) => 
                    setFiltros(prev => ({ ...prev, mostrarArchivados: !!checked }))
                  }
                />
                <Label htmlFor="mostrar-archivados" className="text-sm cursor-pointer">
                  Mostrar archivados
                </Label>
              </div>
            </div>

            {/* Selector de vista */}
            <div className="flex gap-2">
              <Button
                variant={vistaActual === "timeline" ? "default" : "outline"}
                size="sm"
                onClick={() => setVistaActual("timeline")}
              >
                <CalendarClock className="h-4 w-4 mr-2" />
                Timeline
              </Button>
              <Button
                variant={vistaActual === "evento" ? "default" : "outline"}
                size="sm"
                onClick={() => setVistaActual("evento")}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Por Evento
              </Button>
              <Button
                variant={vistaActual === "categoria" ? "default" : "outline"}
                size="sm"
                onClick={() => setVistaActual("categoria")}
              >
                <Filter className="h-4 w-4 mr-2" />
                Por Categoría
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contenido Principal */}
      {vistaActual === "timeline" && (
        <div className="space-y-3">
          {egresosFiltrados.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground font-medium">No hay egresos que mostrar</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ajusta los filtros para ver más resultados
                </p>
              </CardContent>
            </Card>
          ) : (
            egresosFiltrados.map(egreso => (
              <EgresoCard
                key={egreso.id}
                egreso={egreso}
                onRegistrarPago={handleRegistrarPago}
                onVerEvento={handleVerEvento}
              />
            ))
          )}
        </div>
      )}

      {vistaActual === "evento" && (
        <div className="space-y-4">
          {Object.entries(egresosPorEvento).map(([eventoId, egresos]) => {
            const evento = eventos.find(e => e.id === eventoId)
            const esGeneral = eventoId === 'sin-evento'
            
            return (
              <Card key={eventoId} className="border-l-4 border-l-indigo-500">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {esGeneral ? 'Gastos Generales' : 
                         evento?.nombrePareja || evento?.nombre || 'Evento'}
                      </CardTitle>
                      {!esGeneral && evento && (
                        <CardDescription>
                          Fecha: {formatearFecha(evento.fecha, "largo")}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant="outline">
                      {egresos.length} egreso{egresos.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {egresos.map(egreso => (
                    <EgresoCard
                      key={egreso.id}
                      egreso={egreso}
                      onRegistrarPago={handleRegistrarPago}
                      onVerEvento={handleVerEvento}
                      compact
                    />
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {vistaActual === "categoria" && (
        <div className="space-y-4">
          {Object.entries(egresosPorCategoria).map(([tipo, egresos]) => {
            if (egresos.length === 0) return null
            
            const titulo = tipo === 'gasto-fijo' ? 'Gastos Fijos' :
                          tipo === 'servicio-evento' ? 'Servicios de Eventos' : 
                          'Pagos a Personal'
            
            const icono = tipo === 'gasto-fijo' ? Receipt :
                         tipo === 'servicio-evento' ? Briefcase : User
            
            const Icon = icono
            
            return (
              <Card key={tipo}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {titulo}
                    <Badge variant="outline" className="ml-auto">
                      {egresos.length} items
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {egresos.map(egreso => (
                    <EgresoCard
                      key={egreso.id}
                      egreso={egreso}
                      onRegistrarPago={handleRegistrarPago}
                      onVerEvento={handleVerEvento}
                      compact
                    />
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialogs */}
      <RegistrarPagoDialog
        open={dialogRegistroPago}
        onOpenChange={setDialogRegistroPago}
        egreso={egresoSeleccionado}
      />

      <VistaEventoDialog
        open={dialogVistaEvento}
        onOpenChange={setDialogVistaEvento}
        eventoId={eventoSeleccionado}
        egresos={egresosUnificados}
        ingresos={ingresosEsperados}
      />

      <ConfiguracionDialog
        open={dialogConfig}
        onOpenChange={setDialogConfig}
        diasAnticipacion={diasAnticipacion}
        onDiasChange={setDiasAnticipacion}
      />
    </div>
  )
}

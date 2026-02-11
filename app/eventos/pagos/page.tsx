"use client"

import { useState, useMemo, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import {
  generateId,
  formatCurrency,
  generarCalendarioCuotas,
  type EventoGuardado,
  type PagoEvento,
} from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  Search,
  CreditCard,
  Plus,
  Trash2,
  Printer,
  Users,
  Calendar as CalendarIcon,
  Building2,
  Clock,
  FileText,
  Phone,
} from "lucide-react"

const ESTADO_CONFIG: Record<string, { label: string; className: string; dotColor: string }> = {
  pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-800 border-amber-300", dotColor: "bg-amber-500" },
  confirmado: { label: "Confirmado", className: "bg-emerald-100 text-emerald-800 border-emerald-300", dotColor: "bg-emerald-500" },
  completado: { label: "Completado", className: "bg-sky-100 text-sky-800 border-sky-300", dotColor: "bg-sky-500" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-800 border-red-300", dotColor: "bg-red-400" },
}

function PaymentReceipt({ evento, pago }: { evento: EventoGuardado; pago: PagoEvento }) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const totalCuotas = evento.cantidadCuotas || 0
  const pagoIndex = (evento.pagos || []).findIndex((p) => p.id === pago.id)
  const cuotaActual = pagoIndex >= 0 ? pagoIndex + 1 : (evento.pagos || []).length
  const cuotasFaltantes = Math.max(0, totalCuotas - cuotaActual)

  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>Comprobante de Pago - Los Jazmines</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2d5a3d; padding-bottom: 15px; }
            .header h1 { color: #2d5a3d; font-size: 24px; margin: 0 0 5px 0; }
            .header p { color: #666; margin: 0; font-size: 12px; }
            .section { margin-bottom: 20px; }
            .section h3 { font-size: 14px; color: #2d5a3d; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
            .row .label { color: #666; }
            .row .value { font-weight: bold; }
            .amount { text-align: center; margin: 25px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
            .amount .value { font-size: 28px; font-weight: bold; color: #2d5a3d; }
            .amount .label { font-size: 12px; color: #666; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
            .signature-line { text-align: center; width: 45%; }
            .signature-line .line { border-top: 1px solid #333; margin-bottom: 5px; }
            .signature-line .name { font-size: 12px; color: #666; }
            .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #999; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Los Jazmines</h1>
            <p>Comprobante de Pago</p>
          </div>
          <div class="section">
            <h3>Datos del Evento</h3>
            <div class="row"><span class="label">Evento:</span><span class="value">${evento.nombre || evento.tipoEvento || "Evento"}</span></div>
            <div class="row"><span class="label">Festejados:</span><span class="value">${evento.nombrePareja || "-"}</span></div>
            <div class="row"><span class="label">Fecha del evento:</span><span class="value">${evento.fecha}</span></div>
            <div class="row"><span class="label">Salon:</span><span class="value">${evento.salon || "-"}</span></div>
            ${evento.dniNovio1 ? `<div class="row"><span class="label">DNI 1:</span><span class="value">${evento.dniNovio1}</span></div>` : ""}
            ${evento.dniNovio2 ? `<div class="row"><span class="label">DNI 2:</span><span class="value">${evento.dniNovio2}</span></div>` : ""}
          </div>
          ${(() => {
            if (pago.porcentajeIPC > 0) {
              const montoBase = pago.monto / (1 + pago.porcentajeIPC / 100)
              const ipcMonto = pago.monto - montoBase
              return `
                <div class="section" style="background:#f9fafb;border-radius:8px;padding:15px;margin:20px 0;border:1px solid #e5e7eb;">
                  <div class="row"><span class="label">Monto original de la cuota</span><span class="value">${formatCurrency(montoBase)}</span></div>
                  <div class="row"><span class="label">IPC aplicado (${pago.porcentajeIPC}%)</span><span class="value" style="color:#b45309;">+ ${formatCurrency(ipcMonto)}</span></div>
                  <div style="border-top:2px solid #2d5a3d;margin-top:10px;padding-top:10px;">
                    <div class="row"><span class="label" style="font-weight:bold;font-size:14px;">Monto final a pagar</span><span class="value" style="font-size:22px;color:#2d5a3d;">${formatCurrency(pago.monto)}</span></div>
                  </div>
                </div>
              `
            } else {
              return `
                <div class="amount">
                  <div class="label">Monto del Pago</div>
                  <div class="value">${formatCurrency(pago.monto)}</div>
                </div>
              `
            }
          })()}
          <div class="section">
            <h3>Datos del Pago</h3>
            <div class="row"><span class="label">Fecha de pago:</span><span class="value">${pago.fecha}</span></div>
            <div class="row"><span class="label">Pagado por:</span><span class="value">${pago.pagadoPor}</span></div>
            ${pago.porcentajeIPC > 0 ? `<div class="row"><span class="label">IPC aplicado:</span><span class="value">${pago.porcentajeIPC}%</span></div>` : ""}
            ${pago.notas ? `<div class="row"><span class="label">Notas:</span><span class="value">${pago.notas}</span></div>` : ""}
          </div>
          ${totalCuotas > 0 ? `
          <div class="section" style="background:#eff6ff;border-radius:8px;padding:15px;margin:10px 0;border:1px solid #bfdbfe;">
            <div class="row"><span class="label">Cuota N:</span><span class="value">${cuotaActual} de ${totalCuotas}</span></div>
            <div class="row"><span class="label">Cuotas restantes:</span><span class="value" style="font-size:16px;color:${cuotasFaltantes === 0 ? '#15803d' : '#1d4ed8'};">${cuotasFaltantes === 0 ? 'Ninguna - PAGADO EN SU TOTALIDAD' : cuotasFaltantes}</span></div>
          </div>
          ` : ""}
          ${pago.montoRecibido && pago.montoRecibido > 0 ? `
          <div class="section" style="background:#f0fdf4;border-radius:8px;padding:15px;margin:10px 0;border:1px solid #bbf7d0;">
            <h3 style="color:#15803d;">Detalle de Efectivo</h3>
            <div class="row"><span class="label">Monto recibido del cliente:</span><span class="value">${formatCurrency(pago.montoRecibido)}</span></div>
            <div class="row"><span class="label">Monto a pagar:</span><span class="value">${formatCurrency(pago.monto)}</span></div>
            <div style="border-top:2px solid #15803d;margin-top:8px;padding-top:8px;">
              <div class="row"><span class="label" style="font-weight:bold;font-size:14px;">Vuelto entregado:</span><span class="value" style="font-size:20px;color:#15803d;">${formatCurrency(pago.vuelto || 0)}</span></div>
            </div>
          </div>
          ` : ""}
          <div class="signatures">
            <div class="signature-line">
              <div class="line"></div>
              <div class="name">Firma del Cliente</div>
            </div>
            <div class="signature-line">
              <div class="line"></div>
              <div class="name">Firma Los Jazmines</div>
            </div>
          </div>
          <div class="footer">
            <p>Este comprobante es valido como constancia de pago.</p>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handlePrint}>
      <Printer className="h-3.5 w-3.5" />
    </Button>
  )
}

function PagosPageContent() {
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get("evento") || ""
  const { eventos, updateEvento } = useStore()

  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [selectedEvento, setSelectedEvento] = useState<EventoGuardado | null>(() => {
    if (initialSearch) {
      const found = eventos.find(
        (e) =>
          (e.nombre || "").toLowerCase().includes(initialSearch.toLowerCase()) ||
          (e.nombrePareja || "").toLowerCase().includes(initialSearch.toLowerCase()) ||
          (e.dniNovio1 || "").includes(initialSearch) ||
          (e.dniNovio2 || "").includes(initialSearch) ||
          e.id === initialSearch
      )
      return found || null
    }
    return null
  })

  // Payment dialog
  const [showPagoDialog, setShowPagoDialog] = useState(false)
  const [montoCuotaBase, setMontoCuotaBase] = useState(0) // Original cuota amount before IPC
  const [pagoForm, setPagoForm] = useState({
    monto: 0,
    fecha: new Date().toISOString().split("T")[0],
    pagadoPor: "",
    porcentajeIPC: 0,
    notas: "",
    montoRecibido: 0,
  })

  // Cuotas config
  const [cuotasTotal, setCuotasTotal] = useState(1)
  const [montoTotal, setMontoTotal] = useState(0)
  const [showCuotasConfig, setShowCuotasConfig] = useState(false)

  // Search results
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase().trim()
    return eventos.filter((e) => {
      const nameMatch = (e.nombre || "").toLowerCase().includes(term)
      const parejaMatch = (e.nombrePareja || "").toLowerCase().includes(term)
      const dniMatch = (e.dniNovio1 || "").includes(term) || (e.dniNovio2 || "").includes(term)
      return nameMatch || parejaMatch || dniMatch
    })
  }, [eventos, searchTerm])

  const handleSelectEvento = (ev: EventoGuardado) => {
    setSelectedEvento(ev)
    setSearchTerm("")
    // Load cuotas data if exists
    if (ev.montoTotalPlan && ev.montoTotalPlan > 0) {
      setMontoTotal(ev.montoTotalPlan)
    } else {
      const precioVenta = ev.precioVenta || 0
      const costoTotal = (ev.costoInsumos || 0) + (ev.costoServicios || 0) + (ev.costoOperativo || 0)
      setMontoTotal(precioVenta > 0 ? precioVenta : costoTotal)
    }
    if (ev.planCuotas && ev.planCuotas > 0) {
      setCuotasTotal(ev.planCuotas)
    }
  }

  const handleAddPago = () => {
    if (!selectedEvento || pagoForm.monto <= 0 || !pagoForm.pagadoPor) return
    const vueltoCalculado = pagoForm.montoRecibido > pagoForm.monto ? Math.round((pagoForm.montoRecibido - pagoForm.monto) * 100) / 100 : 0
    const newPago: PagoEvento = {
      id: generateId(),
      monto: pagoForm.monto,
      fecha: pagoForm.fecha,
      pagadoPor: pagoForm.pagadoPor,
      porcentajeIPC: pagoForm.porcentajeIPC,
      notas: pagoForm.notas || undefined,
      montoRecibido: pagoForm.montoRecibido > 0 ? pagoForm.montoRecibido : undefined,
      vuelto: vueltoCalculado > 0 ? vueltoCalculado : undefined,
    }
    const currentPagos = selectedEvento.pagos || []
    const updatedPagos = [...currentPagos, newPago]

    // Also mark the next pending cuota as paid in planDeCuotas
    let updatedPlanDeCuotas = selectedEvento.planDeCuotas
    if (updatedPlanDeCuotas && updatedPlanDeCuotas.numeroCuotas > 0) {
      const cuotasPagadasArr = updatedPlanDeCuotas.cuotasPagadas || []
      // Find the next unpaid cuota number
      const nextUnpaid = Array.from({ length: updatedPlanDeCuotas.numeroCuotas }, (_, i) => i + 1)
        .find(n => !cuotasPagadasArr.includes(n))
      if (nextUnpaid) {
        updatedPlanDeCuotas = {
          ...updatedPlanDeCuotas,
          cuotasPagadas: [...cuotasPagadasArr, nextUnpaid],
        }
      }
    }

    updateEvento(selectedEvento.id, {
      pagos: updatedPagos,
      planCuotas: cuotasTotal,
      montoTotalPlan: montoTotal,
      ...(updatedPlanDeCuotas ? { planDeCuotas: updatedPlanDeCuotas } : {}),
    })
    setSelectedEvento({
      ...selectedEvento,
      pagos: updatedPagos,
      planCuotas: cuotasTotal,
      montoTotalPlan: montoTotal,
      ...(updatedPlanDeCuotas ? { planDeCuotas: updatedPlanDeCuotas } : {}),
    })
    setMontoCuotaBase(0)
    setPagoForm({
      monto: 0,
      fecha: new Date().toISOString().split("T")[0],
      pagadoPor: "",
      porcentajeIPC: 0,
      notas: "",
      montoRecibido: 0,
    })
    setShowPagoDialog(false)
  }

  const handleDeletePago = (pagoId: string) => {
    if (!selectedEvento) return
    const updatedPagos = (selectedEvento.pagos || []).filter((p) => p.id !== pagoId)
    updateEvento(selectedEvento.id, { pagos: updatedPagos })
    setSelectedEvento({ ...selectedEvento, pagos: updatedPagos })
  }

  const totalPagos = selectedEvento ? (selectedEvento.pagos || []).reduce((s, p) => s + p.monto, 0) : 0
  const totalIPCAcumulado = selectedEvento
    ? (selectedEvento.pagos || []).reduce((acc, p) => {
        if (p.porcentajeIPC > 0) {
          const montoBase = p.monto / (1 + p.porcentajeIPC / 100)
          return acc + (p.monto - montoBase)
        }
        return acc
      }, 0)
    : 0
  const saldoPendiente = montoTotal > 0 ? montoTotal - totalPagos : 0
  const cuotasPagadas = selectedEvento ? (selectedEvento.pagos || []).length : 0
  const cuotasRestantes = Math.max(0, cuotasTotal - cuotasPagadas)
  const montoPorCuota = cuotasTotal > 0 && montoTotal > 0 ? montoTotal / cuotasTotal : 0

  const detailTotal = selectedEvento
    ? selectedEvento.adultos + selectedEvento.adolescentes + selectedEvento.ninos + (selectedEvento.personasDietasEspeciales || 0)
    : 0

  // Cuotas del mes actual - recordatorios
  const cuotasDelMes = useMemo(() => {
    const resultado: Array<{
      evento: EventoGuardado
      numeroCuota: number
      fechaVencimiento: string
      monto: number
      pagada: boolean
      rangoRecordatorio: boolean
    }> = []

    const eventosCuotas = eventos.filter(e =>
      e.planDeCuotas &&
      e.planDeCuotas.numeroCuotas > 0 &&
      e.planDeCuotas.fechaInicioPlan &&
      e.estado !== "cancelado" &&
      e.estado !== "completado"
    )

    eventosCuotas.forEach(evento => {
      const cuotas = generarCalendarioCuotas(evento)

      cuotas.forEach(cuota => {
        if (!cuota.fechaVencimiento) return
        const [año, mes, dia] = cuota.fechaVencimiento.split("-").map(Number)
        if (!año || !mes || !dia) return
        const hoy = new Date()
        const mesActual = hoy.getMonth() + 1
        const añoActual = hoy.getFullYear()

        // Si la cuota vence este mes
        if (año === añoActual && mes === mesActual) {
          resultado.push({
            evento,
            ...cuota,
            rangoRecordatorio: dia >= 1 && dia <= 10,
          })
        }
      })
    })

    return resultado.sort((a, b) =>
      a.fechaVencimiento.localeCompare(b.fechaVencimiento)
    )
  }, [eventos])

  const handleMarcarCuotaPagada = (eventoId: string, numeroCuota: number) => {
    const evento = eventos.find(e => e.id === eventoId)
    if (!evento || !evento.planDeCuotas) return

    const cuotasPagadas = evento.planDeCuotas.cuotasPagadas || []
    if (cuotasPagadas.includes(numeroCuota)) return

    updateEvento(eventoId, {
      planDeCuotas: {
        ...evento.planDeCuotas,
        cuotasPagadas: [...cuotasPagadas, numeroCuota],
      },
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center gap-4">
          <Link href="/eventos/calendario" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Pagos de Eventos</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6 space-y-6">
        {/* Search - hidden when event is selected */}
        {!selectedEvento && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Buscar Evento</CardTitle>
              <CardDescription>Busca por DNI o nombre del evento para gestionar sus pagos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, festejados o DNI..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12 text-base"
                  autoFocus
                />
              </div>
              {searchTerm.trim() && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Sin resultados para &quot;{searchTerm}&quot;</p>
                  ) : (
                    searchResults.map((ev) => {
                      const estadoCfg = ESTADO_CONFIG[ev.estado] || ESTADO_CONFIG.pendiente
                      const total = ev.adultos + ev.adolescentes + ev.ninos + (ev.personasDietasEspeciales || 0)
                      const pagosSum = (ev.pagos || []).reduce((s, p) => s + p.monto, 0)
                      return (
                        <div
                          key={ev.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 cursor-pointer transition-colors"
                          onClick={() => handleSelectEvento(ev)}
                        >
                          <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${estadoCfg.dotColor}`} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{ev.nombre || ev.tipoEvento || "Evento"}</p>
                            <p className="text-sm text-muted-foreground">
                              {ev.fecha}
                              {ev.nombrePareja && ` - ${ev.nombrePareja}`}
                              {` - ${total} pax`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge variant="outline" className={`text-xs ${estadoCfg.className}`}>
                              {estadoCfg.label}
                            </Badge>
                            {pagosSum > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Pagado: {formatCurrency(pagosSum)}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* RECORDATORIOS DE CUOTAS DEL MES - only when no event selected */}
        {!selectedEvento && cuotasDelMes.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-amber-600" />
                Cuotas del Mes - Recordatorios
              </CardTitle>
              <CardDescription>
                Cuotas programadas para {new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cuotasDelMes.map((item) => {
                  const cn = (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(' ')

                  return (
                    <div
                      key={`${item.evento.id}-${item.numeroCuota}`}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        item.pagada
                          ? "bg-emerald-50 border-emerald-200"
                          : item.rangoRecordatorio
                            ? "bg-amber-50 border-amber-300 shadow-sm"
                            : "bg-background"
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">
                            {item.evento.nombrePareja || item.evento.nombre}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            Cuota {item.numeroCuota}/{item.evento.planDeCuotas!.numeroCuotas}
                          </Badge>
                          {item.pagada && (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-600 text-xs">
                              {"Pagada"}
                            </Badge>
                          )}
                          {!item.pagada && item.rangoRecordatorio && (
                            <Badge variant="outline" className="text-amber-700 border-amber-600 text-xs">
                              {"Vence pronto"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3.5 w-3.5" />
                            Vence: {new Date(item.fechaVencimiento).toLocaleDateString("es-AR")}
                          </span>
                          {item.evento.contrato?.telefono && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {item.evento.contrato.telefono}
                            </span>
                          )}
                          {item.evento.contrato?.nombreCompleto && (
                            <span className="text-xs">
                              {item.evento.contrato.nombreCompleto}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className="font-mono font-bold text-lg">
                            {formatCurrency(item.monto)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.evento.tipoEvento || "Evento"}
                          </div>
                        </div>
                        {!item.pagada && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarcarCuotaPagada(item.evento.id, item.numeroCuota)}
                          >
                            Marcar Pagada
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected Event Detail */}
        {selectedEvento && (
          <>
            {/* Back to search button */}
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent"
              onClick={() => {
                setSelectedEvento(null)
                setSearchTerm("")
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Buscar otro evento
            </Button>

            {/* Event Info Card */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">
                      {selectedEvento.nombre || selectedEvento.tipoEvento || "Evento"}
                    </CardTitle>
                    {selectedEvento.nombrePareja && (
                      <CardDescription className="text-base mt-1">{selectedEvento.nombrePareja}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={ESTADO_CONFIG[selectedEvento.estado]?.className || ""}>
                      {ESTADO_CONFIG[selectedEvento.estado]?.label || selectedEvento.estado}
                    </Badge>
                    <Link href="/eventos/contratos">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 bg-transparent">
                        <FileText className="h-3 w-3" />
                        Contrato
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Fecha:</span>
                    <span className="font-medium">{selectedEvento.fecha}</span>
                  </div>
                  {selectedEvento.horario && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Horario:</span>
                      <span className="font-medium">{selectedEvento.horario}</span>
                    </div>
                  )}
                  {selectedEvento.salon && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Salon:</span>
                      <span className="font-medium">{selectedEvento.salon}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Personas:</span>
                    <span className="font-medium">{detailTotal}</span>
                  </div>
                  {selectedEvento.dniNovio1 && (
                    <div>
                      <span className="text-muted-foreground">DNI 1:</span>{" "}
                      <span className="font-medium">{selectedEvento.dniNovio1}</span>
                    </div>
                  )}
                  {selectedEvento.dniNovio2 && (
                    <div>
                      <span className="text-muted-foreground">DNI 2:</span>{" "}
                      <span className="font-medium">{selectedEvento.dniNovio2}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cuotas & Monto Total Config */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Plan de Cuotas</CardTitle>
                  <div className="flex items-center gap-2">
                    {showCuotasConfig && montoTotal > 0 && cuotasTotal >= 1 && (
                      <Button
                        size="sm"
                        onClick={() => {
                          updateEvento(selectedEvento.id, {
                            planCuotas: cuotasTotal,
                            montoTotalPlan: montoTotal,
                          })
                          setSelectedEvento({ ...selectedEvento, planCuotas: cuotasTotal, montoTotalPlan: montoTotal })
                          setShowCuotasConfig(false)
                        }}
                      >
                        Guardar Plan
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent"
                      onClick={() => setShowCuotasConfig(!showCuotasConfig)}
                    >
                      {showCuotasConfig ? "Cancelar" : "Configurar"}
                    </Button>
                  </div>
                </div>
                {selectedEvento.planCuotas && selectedEvento.planCuotas > 0 && !showCuotasConfig && (
                  <CardDescription>
                    Plan guardado: {selectedEvento.planCuotas} cuotas de {formatCurrency((selectedEvento.montoTotalPlan || 0) / selectedEvento.planCuotas)}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {showCuotasConfig && (
                  <div className="grid gap-4 sm:grid-cols-2 pb-4 border-b border-border">
                    <div className="space-y-2">
                      <Label>Monto Total del Evento ($)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={montoTotal || ""}
                        onChange={(e) => setMontoTotal(parseFloat(e.target.value) || 0)}
                        className="h-11 text-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cantidad de Cuotas</Label>
                      <Input
                        type="number"
                        min={1}
                        max={48}
                        value={cuotasTotal}
                        onChange={(e) => setCuotasTotal(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-11 text-lg"
                      />
                    </div>
                  </div>
                )}

                {montoTotal > 0 && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Monto Total</p>
                      <p className="text-lg font-bold">{formatCurrency(montoTotal)}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Cuota ({cuotasTotal}x)</p>
                      <p className="text-lg font-bold">{formatCurrency(montoPorCuota)}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Cuotas Restantes</p>
                      <p className="text-lg font-bold">{cuotasRestantes} de {cuotasTotal}</p>
                    </div>
                  </div>
                )}

                {montoTotal > 0 && (
                  <div className="rounded-lg border-2 border-foreground/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Pagado</p>
                        <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalPagos)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Saldo Pendiente</p>
                        <p className={`text-xl font-bold ${saldoPendiente > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                          {formatCurrency(Math.max(0, saldoPendiente))}
                        </p>
                      </div>
                    </div>
                    {totalIPCAcumulado > 0 && (
                      <div className="flex items-center justify-between rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                        <span className="text-xs font-medium text-amber-800">IPC acumulado en pagos</span>
                        <span className="text-sm font-bold text-amber-700">+ {formatCurrency(totalIPCAcumulado)}</span>
                      </div>
                    )}
                    {montoTotal > 0 && (
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${Math.min(100, (totalPagos / montoTotal) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Next Pending Payment Card */}
            {(() => {
              // Get the fresh event data from the store to compute next cuota
              const freshEvento = eventos.find(e => e.id === selectedEvento.id) || selectedEvento
              const calendarioCuotas = generarCalendarioCuotas(freshEvento)
              const proximaCuota = calendarioCuotas.find(c => !c.pagada)
              
              if (proximaCuota && proximaCuota.fechaVencimiento) {
                return (
                  <Card className="border-2 border-primary/30 bg-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        Proximo Pago
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Cuota {proximaCuota.numeroCuota} de {calendarioCuotas.length}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <CalendarIcon className="h-3.5 w-3.5" />
                            Vencimiento: {new Date(proximaCuota.fechaVencimiento + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{formatCurrency(proximaCuota.monto)}</p>
                          <Button
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              setMontoCuotaBase(proximaCuota.monto)
                              setPagoForm({
                                monto: proximaCuota.monto,
                                fecha: new Date().toISOString().split("T")[0],
                                pagadoPor: "",
                                porcentajeIPC: 0,
                                notas: `Cuota ${proximaCuota.numeroCuota}/${calendarioCuotas.length}`,
                                montoRecibido: 0,
                              })
                              setShowPagoDialog(true)
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" /> Registrar este pago
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              }

              // All cuotas paid
              if (calendarioCuotas.length > 0 && !proximaCuota) {
                return (
                  <Card className="border-2 border-emerald-300 bg-emerald-50">
                    <CardContent className="py-6">
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500 text-white">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-800">Todas las cuotas estan pagadas</p>
                          <p className="text-sm text-emerald-600">{calendarioCuotas.length} cuotas completadas</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              }

              return null
            })()}

            {/* Payments List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Pagos Registrados
                  </CardTitle>
                  <Button size="sm" onClick={() => {
                    setMontoCuotaBase(montoPorCuota)
                    setPagoForm({
                      monto: montoPorCuota,
                      fecha: new Date().toISOString().split("T")[0],
                      pagadoPor: "",
                      porcentajeIPC: 0,
                      notas: "",
                      montoRecibido: 0,
                    })
                    setShowPagoDialog(true)
                  }}>
                    <Plus className="h-4 w-4 mr-1" /> Registrar Pago
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(selectedEvento.pagos || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CreditCard className="h-12 w-12 text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground font-medium">No hay pagos registrados</p>
                    <p className="text-sm text-muted-foreground mt-1">Registra el primer pago para este evento</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(selectedEvento.pagos || []).map((pago, index) => (
                      <div key={pago.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold shrink-0">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{formatCurrency(pago.monto)}</span>
                              {pago.porcentajeIPC > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  IPC +{pago.porcentajeIPC}%
                                </Badge>
                              )}
                            </div>
                            {pago.porcentajeIPC > 0 && (() => {
                              const montoBase = pago.monto / (1 + pago.porcentajeIPC / 100)
                              const ipcMonto = pago.monto - montoBase
                              return (
                                <p className="text-xs text-amber-600 mt-0.5">
                                  Cuota base: {formatCurrency(montoBase)} + IPC: {formatCurrency(ipcMonto)}
                                </p>
                              )
                            })()}
                            <p className="text-sm text-muted-foreground">
                              {pago.fecha} - {pago.pagadoPor}
                              {pago.notas && ` - ${pago.notas}`}
                            </p>
                            {pago.montoRecibido && pago.montoRecibido > 0 && (
                              <p className="text-xs text-emerald-600 mt-0.5">
                                Recibido: {formatCurrency(pago.montoRecibido)} | Vuelto: {formatCurrency(pago.vuelto || 0)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <PaymentReceipt evento={selectedEvento} pago={pago} />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => handleDeletePago(pago.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <div className="pt-3 border-t border-border space-y-1">
                      <div className="flex justify-between">
                        <span className="font-semibold">Total pagado:</span>
                        <span className="text-lg font-bold">{formatCurrency(totalPagos)}</span>
                      </div>
                      {totalIPCAcumulado > 0 && (
                        <div className="flex justify-between">
                          <span className="text-xs text-amber-600">Del total, por IPC aplicado:</span>
                          <span className="text-sm font-semibold text-amber-600">+ {formatCurrency(totalIPCAcumulado)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Empty state when no event selected */}
        {!selectedEvento && !searchTerm.trim() && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground">Busca un evento</h2>
            <p className="text-muted-foreground mt-2 max-w-sm">
              Escribe el nombre del evento, festejados o DNI para ver y gestionar los pagos
            </p>
          </div>
        )}
      </main>

      {/* Payment Registration Dialog */}
      <Dialog open={showPagoDialog} onOpenChange={setShowPagoDialog}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-2">
            <DialogTitle className="text-base">Registrar Pago</DialogTitle>
            <DialogDescription className="text-xs">
              {selectedEvento?.nombre || selectedEvento?.tipoEvento || "Este evento"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-2">
            <div className="grid gap-3">
              {/* Fila 1: IPC + Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">% IPC</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={pagoForm.porcentajeIPC || ""}
                    onChange={(e) => {
                      const ipc = parseFloat(e.target.value) || 0
                      const nuevoMonto = montoCuotaBase > 0
                        ? Math.round((montoCuotaBase + (montoCuotaBase * ipc / 100)) * 100) / 100
                        : pagoForm.monto
                      setPagoForm({ ...pagoForm, porcentajeIPC: ipc, monto: nuevoMonto })
                    }}
                    placeholder="0"
                    className="h-9"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Fecha</Label>
                  <Input
                    type="date"
                    value={pagoForm.fecha}
                    onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                    className="h-9"
                  />
                </div>
              </div>

              {/* IPC Breakdown compacto */}
              {montoCuotaBase > 0 && (
                <div className="rounded-md border border-border bg-muted/50 px-3 py-2 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cuota original</span>
                    <span className="font-mono font-medium">{formatCurrency(montoCuotaBase)}</span>
                  </div>
                  {pagoForm.porcentajeIPC > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">IPC ({pagoForm.porcentajeIPC}%)</span>
                      <span className="font-mono font-medium text-amber-600">
                        +{formatCurrency(montoCuotaBase * pagoForm.porcentajeIPC / 100)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <span className="font-semibold">Total a pagar</span>
                    <span className="font-mono font-bold text-sm text-primary">
                      {formatCurrency(pagoForm.monto)}
                    </span>
                  </div>
                </div>
              )}

              {/* Monto final */}
              <div className="grid gap-1">
                <Label className="text-xs">Monto Final ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={pagoForm.monto || ""}
                  onChange={(e) => setPagoForm({ ...pagoForm, monto: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  className="h-10 text-base font-semibold"
                />
              </div>

              {/* Pagado por */}
              <div className="grid gap-1">
                <Label className="text-xs">Pagado por</Label>
                <Input
                  value={pagoForm.pagadoPor}
                  onChange={(e) => setPagoForm({ ...pagoForm, pagadoPor: e.target.value })}
                  placeholder="Nombre de quien paga"
                  className="h-9"
                />
              </div>

              {/* Notas */}
              <div className="grid gap-1">
                <Label className="text-xs">Notas (opcional)</Label>
                <Input
                  value={pagoForm.notas}
                  onChange={(e) => setPagoForm({ ...pagoForm, notas: e.target.value })}
                  placeholder="Observaciones..."
                  className="h-9"
                />
              </div>

              {/* Monto Recibido y Vuelto */}
              <div className="rounded-md border border-dashed border-border px-3 py-2.5 space-y-2">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground font-semibold">Monto que entrega el cliente ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={pagoForm.montoRecibido || ""}
                    onChange={(e) => setPagoForm({ ...pagoForm, montoRecibido: parseFloat(e.target.value) || 0 })}
                    placeholder="Ej: 100000"
                    className="h-10 text-base"
                  />
                </div>
                {pagoForm.montoRecibido > 0 && pagoForm.monto > 0 && (
                  <div className={`rounded-md px-3 py-2 text-center ${
                    pagoForm.montoRecibido >= pagoForm.monto
                      ? "bg-emerald-50 border border-emerald-200"
                      : "bg-red-50 border border-red-200"
                  }`}>
                    {pagoForm.montoRecibido >= pagoForm.monto ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Vuelto</span>
                        <span className="text-xl font-bold text-emerald-700">
                          {formatCurrency(Math.round((pagoForm.montoRecibido - pagoForm.monto) * 100) / 100)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-red-600 font-medium">Faltan</span>
                        <span className="text-base font-bold text-red-700">
                          {formatCurrency(Math.round((pagoForm.monto - pagoForm.montoRecibido) * 100) / 100)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="px-5 pb-4 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setShowPagoDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAddPago} disabled={pagoForm.monto <= 0 || !pagoForm.pagadoPor}>
              Registrar {formatCurrency(pagoForm.monto)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PagosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PagosPageContent />
    </Suspense>
  )
}

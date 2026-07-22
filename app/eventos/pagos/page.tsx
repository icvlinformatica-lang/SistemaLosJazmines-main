"use client"

import { useState, useMemo, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import {
  generateId,
  formatCurrency,
  generarCalendarioCuotas,
  salonLabel,
  SALONES,
  type EventoGuardado,
  type MovimientoCaja,
  type PagoEvento,
  type HistorialIPCEntry,
} from "@/lib/store"
import { buildUltimaVersionContratoHTML } from "@/lib/contract-html"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  TrendingUp,
} from "lucide-react"

const ESTADO_CONFIG: Record<string, { label: string; className: string; dotColor: string }> = {
  pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-800 border-amber-300", dotColor: "bg-amber-500" },
  confirmado: { label: "Confirmado", className: "bg-emerald-100 text-emerald-800 border-emerald-300", dotColor: "bg-emerald-500" },
  completado: { label: "Completado", className: "bg-sky-100 text-sky-800 border-sky-300", dotColor: "bg-sky-500" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-800 border-red-300", dotColor: "bg-red-400" },
}

const MESES_RECIBO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

// Registra un movimiento de dinero en el historial de actividad (Configuración > Actividad).
// Todo manejo de dinero (registrar/eliminar pagos) debe dejar rastro.
function logMoneyActivity(accion: "creado" | "eliminado", nombre: string, detalle: string) {
  fetch("/api/activity-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo: "pago", accion, nombre, detalle }),
  }).catch(() => {})
}

function PaymentReceipt({
  evento,
  pago,
  historialIPC = [],
}: {
  evento: EventoGuardado
  pago: PagoEvento
  historialIPC?: HistorialIPCEntry[]
}) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const totalCuotas = evento.cantidadCuotas || 0
  const pagoIndex = (evento.pagos || []).findIndex((p) => p.id === pago.id)
  const cuotaActual = pagoIndex >= 0 ? pagoIndex + 1 : (evento.pagos || []).length
  const cuotasFaltantes = Math.max(0, totalCuotas - cuotaActual)

  // Mes al que corresponde el IPC aplicado como recargo: el último IPC cargado
  // (>IPC) con fecha igual o anterior a la fecha del pago. Se toma automáticamente.
  const ipcMesLabel = (() => {
    if (!(pago.porcentajeIPC > 0) || historialIPC.length === 0) return ""
    const fechaPago = pago.fecha ? new Date(pago.fecha).getTime() : Date.now()
    const aplicables = historialIPC
      .filter((e) => !e.fechaAplicacion || new Date(e.fechaAplicacion).getTime() <= fechaPago)
      .sort((a, b) => (a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes))
    const ref = aplicables.length > 0 ? aplicables[aplicables.length - 1] : null
    return ref ? `${MESES_RECIBO[ref.mes]} ${ref.anio}` : ""
  })()

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
                  <div class="row"><span class="label">IPC aplicado (${pago.porcentajeIPC}%)${ipcMesLabel ? ` - corresponde a ${ipcMesLabel}` : ""}</span><span class="value" style="color:#b45309;">+ ${formatCurrency(ipcMonto)}</span></div>
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
            ${pago.porcentajeIPC > 0 ? `<div class="row"><span class="label">IPC aplicado:</span><span class="value">${pago.porcentajeIPC}%${ipcMesLabel ? ` (${ipcMesLabel})` : ""}</span></div>` : ""}
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
  const { eventos, updateEvento, configuracionCajas, movimientosCaja, addMovimientosCaja, deleteMovimientoCaja, historialIPC, state } = useStore()
  const [showContractPreview, setShowContractPreview] = useState(false)

  const [searchTerm, setSearchTerm] = useState(initialSearch)
  // Modo de búsqueda: por texto (DNI/nombre) o por fecha y salón
  const [searchMode, setSearchMode] = useState<"texto" | "fechaSalon">("texto")
  const [filtroFecha, setFiltroFecha] = useState("")
  const [filtroSalon, setFiltroSalon] = useState<string>("todos")
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

  // Cuotas config (solo lectura — se edita desde Contratos)
  const [cuotasTotal, setCuotasTotal] = useState(1)
  const [montoTotal, setMontoTotal] = useState(0)

  // Confirmación de eliminación de comprobante/pago
  const [pagoToDelete, setPagoToDelete] = useState<PagoEvento | null>(null)

  // Mantener el evento seleccionado sincronizado con el store: si el plan de
  // cuotas se editó desde Contratos (otra modalidad de financiación, montos o
  // fechas nuevas), acá se refleja al instante en vez de mostrar el plan viejo.
  useEffect(() => {
    if (!selectedEvento) return
    const fresh = eventos.find((e) => e.id === selectedEvento.id)
    if (!fresh || fresh === selectedEvento) return
    setSelectedEvento(fresh)
    cargarPlanDesdeEvento(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos])

  // ¿Hay una búsqueda activa según el modo?
  const hayBusquedaActiva =
    searchMode === "texto"
      ? searchTerm.trim().length > 0
      : filtroFecha.trim().length > 0 || filtroSalon !== "todos"

  // Search results
  const searchResults = useMemo(() => {
    if (searchMode === "texto") {
      if (!searchTerm.trim()) return []
      const term = searchTerm.toLowerCase().trim()
      // Normaliza DNI: quita puntos, espacios y guiones para que "12.345.678" y "12345678" coincidan
      const soloDigitos = (v?: string) => (v || "").replace(/[.\s-]/g, "")
      const termDni = soloDigitos(term)
      return eventos.filter((e) => {
        const nameMatch = (e.nombre || "").toLowerCase().includes(term)
        const parejaMatch = (e.nombrePareja || "").toLowerCase().includes(term)
        const dnis = [e.dniNovio1, e.dniNovio2, e.contrato?.dni]
        const dniMatch =
          termDni.length > 0 && dnis.some((d) => soloDigitos(d).includes(termDni))
        return nameMatch || parejaMatch || dniMatch
      })
    }
    // Modo fecha + salón: al menos un filtro debe estar activo
    if (!filtroFecha.trim() && filtroSalon === "todos") return []
    return eventos
      .filter((e) => {
        const fechaMatch = !filtroFecha.trim() || e.fecha === filtroFecha
        const salonMatch = filtroSalon === "todos" || e.salon === filtroSalon
        return fechaMatch && salonMatch
      })
      .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))
  }, [eventos, searchMode, searchTerm, filtroFecha, filtroSalon])

  // El plan guardado desde el generador de contratos (planDeCuotas) es la
  // fuente de verdad: respeta la modalidad de financiación (pago completo /
  // seña + cuotas / solo cuotas), el recargo y el monto de cuota real.
  // Los campos legacy (montoTotalPlan / planCuotas) quedan solo como fallback
  // para eventos viejos que no tienen planDeCuotas.
  const cargarPlanDesdeEvento = (ev: EventoGuardado) => {
    if (ev.planDeCuotas && ev.planDeCuotas.montoTotal > 0) {
      setMontoTotal(ev.planDeCuotas.montoTotal)
      setCuotasTotal(ev.planDeCuotas.numeroCuotas || 1)
    } else {
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
  }

  // Cargar el plan al entrar con un evento preseleccionado (por URL)
  useEffect(() => {
    if (selectedEvento) cargarPlanDesdeEvento(selectedEvento)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectEvento = (ev: EventoGuardado) => {
    setSelectedEvento(ev)
    setSearchTerm("")
    setFiltroFecha("")
    setFiltroSalon("todos")
    cargarPlanDesdeEvento(ev)
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
    let cuotaPagadaNumero: number | null = null
    if (updatedPlanDeCuotas && updatedPlanDeCuotas.numeroCuotas > 0) {
      const cuotasPagadasArr = updatedPlanDeCuotas.cuotasPagadas || []
      // Find the next unpaid cuota number
      const nextUnpaid = Array.from({ length: updatedPlanDeCuotas.numeroCuotas }, (_, i) => i + 1)
        .find(n => !cuotasPagadasArr.includes(n))
      if (nextUnpaid) {
        cuotaPagadaNumero = nextUnpaid
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

    // Generar los movimientos de caja del ingreso (50% Caja Eventos + 50% Caja Jazmines).
    // Antes solo se hacía desde los recordatorios de cuotas, por lo que un pago
    // registrado desde este diálogo no aparecía en las cajas.
    if (selectedEvento.salon && pagoForm.monto > 0) {
      const nombreEvento = selectedEvento.nombre || selectedEvento.nombrePareja || "Evento"
      const etiquetaCuota = cuotaPagadaNumero ? `Cuota ${cuotaPagadaNumero}` : "Pago"
      const mitadEventos = Math.round((pagoForm.monto / 2) * 100) / 100
      const mitadJazmines = Math.round((pagoForm.monto - mitadEventos) * 100) / 100
      // Usar la fecha real de cobro elegida en el formulario (no la fecha de hoy),
      // así los pagos de cuotas atrasadas quedan asentados en el mes correcto.
      // Se fija el mediodía para evitar corrimientos de día por zona horaria.
      const fechaMov = pagoForm.fecha
        ? new Date(`${pagoForm.fecha}T12:00:00`).toISOString()
        : new Date().toISOString()

      const saldoPrevEventos = movimientosCaja
        .filter((m: MovimientoCaja) => m.cajaDestino === "caja_eventos" && m.salon === selectedEvento.salon)
        .reduce((sum: number, m: MovimientoCaja) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto), 0)
      const saldoPrevJazmines = movimientosCaja
        .filter((m: MovimientoCaja) => m.cajaDestino === "caja_jazmines")
        .reduce((sum: number, m: MovimientoCaja) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto), 0)

      const movEventos: MovimientoCaja = {
        id: generateId(),
        fecha: fechaMov,
        tipo: "ingreso",
        concepto: `${etiquetaCuota} - ${nombreEvento} (Caja Eventos)`,
        monto: mitadEventos,
        salon: selectedEvento.salon,
        eventoId: selectedEvento.id,
        cajaDestino: "caja_eventos",
        saldoResultante: saldoPrevEventos + mitadEventos,
      }
      const movJazmines: MovimientoCaja = {
        id: generateId(),
        fecha: fechaMov,
        tipo: "ingreso",
        concepto: `${etiquetaCuota} - ${nombreEvento} (Caja Jazmines)`,
        monto: mitadJazmines,
        salon: selectedEvento.salon,
        eventoId: selectedEvento.id,
        cajaDestino: "caja_jazmines",
        saldoResultante: saldoPrevJazmines + mitadJazmines,
      }
      addMovimientosCaja([movEventos, movJazmines])
    }

    // Registrar en el historial de actividad (manejo de dinero)
    const nombreEventoLog = selectedEvento.nombre || selectedEvento.nombrePareja || "Evento"
    const etiquetaLog = cuotaPagadaNumero ? `Cuota ${cuotaPagadaNumero}` : "Pago"
    logMoneyActivity(
      "creado",
      `${etiquetaLog} - ${nombreEventoLog}`,
      `Pago registrado por ${formatCurrency(pagoForm.monto)}${pagoForm.pagadoPor ? ` | Pagado por: ${pagoForm.pagadoPor}` : ""}${selectedEvento.salon ? ` | Ingreso dividido 50/50 en Caja Eventos y Caja Jazmines` : ""}`,
    )

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
    const pago = (selectedEvento.pagos || []).find((p) => p.id === pagoId)
    if (!pago) return

    // 1) Determinar a qué cuota corresponde el pago (para revertirla y hallar sus movimientos)
    const matchCuota = /Cuota\s+(\d+)/i.exec(pago.notas || "")
    const numeroCuota = matchCuota ? parseInt(matchCuota[1], 10) : null
    const etiquetaCuota = numeroCuota ? `Cuota ${numeroCuota}` : "Pago"

    // 2) Revertir los movimientos de caja que se habían sumado por este pago.
    //    Se buscan por evento + etiqueta de la cuota, tomando por cada caja el
    //    movimiento cuyo monto más se acerca a la mitad del pago.
    let cajasRevertidas = false
    const candidatos = movimientosCaja.filter(
      (m: MovimientoCaja) =>
        m.eventoId === selectedEvento.id &&
        m.tipo === "ingreso" &&
        typeof m.concepto === "string" &&
        m.concepto.startsWith(`${etiquetaCuota} - `),
    )
    const mitadObjetivo = pago.monto / 2
    ;(["caja_eventos", "caja_jazmines"] as const).forEach((caja) => {
      const delCaja = candidatos.filter((m) => m.cajaDestino === caja)
      if (delCaja.length === 0) return
      const elegido = delCaja.reduce((best, m) =>
        Math.abs(m.monto - mitadObjetivo) < Math.abs(best.monto - mitadObjetivo) ? m : best,
      )
      deleteMovimientoCaja(elegido.id)
      cajasRevertidas = true
    })

    // 3) Marcar la cuota como NO pagada de nuevo (vuelve a adeudarse)
    let updatedPlanDeCuotas = selectedEvento.planDeCuotas
    if (updatedPlanDeCuotas && numeroCuota) {
      updatedPlanDeCuotas = {
        ...updatedPlanDeCuotas,
        cuotasPagadas: (updatedPlanDeCuotas.cuotasPagadas || []).filter((n) => n !== numeroCuota),
      }
    }

    // 4) Quitar el pago del evento
    const updatedPagos = (selectedEvento.pagos || []).filter((p) => p.id !== pagoId)
    updateEvento(selectedEvento.id, {
      pagos: updatedPagos,
      ...(updatedPlanDeCuotas ? { planDeCuotas: updatedPlanDeCuotas } : {}),
    })
    setSelectedEvento({
      ...selectedEvento,
      pagos: updatedPagos,
      ...(updatedPlanDeCuotas ? { planDeCuotas: updatedPlanDeCuotas } : {}),
    })

    // 5) Registrar en el historial de actividad (manejo de dinero)
    const nombreEventoLog = selectedEvento.nombre || selectedEvento.nombrePareja || "Evento"
    logMoneyActivity(
      "eliminado",
      `${etiquetaCuota} - ${nombreEventoLog}`,
      `Pago eliminado por ${formatCurrency(pago.monto)}${cajasRevertidas ? " | Monto descontado de Caja Eventos y Caja Jazmines" : ""}${numeroCuota ? ` | La cuota ${numeroCuota} vuelve a figurar como impaga` : ""}`,
    )

    setPagoToDelete(null)
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
  // Monto real de cada cuota: el del plan guardado en el contrato (incluye
  // recargo por financiación y descuenta la seña). Fallback: división simple.
  const montoPorCuota =
    selectedEvento?.planDeCuotas?.montoCuota && selectedEvento.planDeCuotas.montoCuota > 0
      ? selectedEvento.planDeCuotas.montoCuota
      : cuotasTotal > 0 && montoTotal > 0
        ? montoTotal / cuotasTotal
        : 0

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

  // Revertir una cuota marcada como pagada desde los recordatorios:
  // quita la cuota de cuotasPagadas, elimina el pago registrado y los
  // movimientos de caja generados.
  const handleRevertirCuotaPagada = (eventoId: string, numeroCuota: number) => {
    const evento = eventos.find(e => e.id === eventoId)
    if (!evento || !evento.planDeCuotas) return

    const nombreEvento = evento.nombre || evento.nombrePareja || "Evento"
    const etiquetaCuota = `Cuota ${numeroCuota}`

    // 1) Quitar la cuota de cuotasPagadas
    const updatedPlanDeCuotas = {
      ...evento.planDeCuotas,
      cuotasPagadas: (evento.planDeCuotas.cuotasPagadas || []).filter(n => n !== numeroCuota),
    }

    // 2) Quitar el pago registrado asociado a esta cuota (match por notas)
    const pagoRevertido = (evento.pagos || []).find(p => {
      const m = /Cuota\s+(\d+)/i.exec(p.notas || "")
      return m ? parseInt(m[1], 10) === numeroCuota : false
    })
    const updatedPagos = pagoRevertido
      ? (evento.pagos || []).filter(p => p.id !== pagoRevertido.id)
      : (evento.pagos || [])

    updateEvento(eventoId, {
      pagos: updatedPagos,
      planDeCuotas: updatedPlanDeCuotas,
    })

    // 3) Revertir los movimientos de caja de esta cuota
    let cajasRevertidas = false
    const candidatos = movimientosCaja.filter(
      (m: MovimientoCaja) =>
        m.eventoId === eventoId &&
        m.tipo === "ingreso" &&
        typeof m.concepto === "string" &&
        m.concepto.startsWith(`${etiquetaCuota} - `),
    )
    const mitadObjetivo = (pagoRevertido?.monto ?? evento.planDeCuotas.montoCuota ?? 0) / 2
    ;(["caja_eventos", "caja_jazmines"] as const).forEach((caja) => {
      const delCaja = candidatos.filter((m) => m.cajaDestino === caja)
      if (delCaja.length === 0) return
      const elegido = delCaja.reduce((best, m) =>
        Math.abs(m.monto - mitadObjetivo) < Math.abs(best.monto - mitadObjetivo) ? m : best,
      )
      deleteMovimientoCaja(elegido.id)
      cajasRevertidas = true
    })

    // 4) Registrar en el historial de actividad
    logMoneyActivity(
      "eliminado",
      `${etiquetaCuota} - ${nombreEvento}`,
      `Cuota marcada como impaga${cajasRevertidas ? " | Monto descontado de Caja Eventos y Caja Jazmines" : ""}`,
    )
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

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        {/* Search - hidden when event is selected */}
        {!selectedEvento && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Buscar Evento</CardTitle>
              <CardDescription>Busca por DNI/nombre, o filtra por fecha y salón para gestionar los pagos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs
                value={searchMode}
                onValueChange={(v) => {
                  setSearchMode(v as "texto" | "fechaSalon")
                  setSearchTerm("")
                  setFiltroFecha("")
                  setFiltroSalon("todos")
                }}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="texto">DNI o Nombre</TabsTrigger>
                  <TabsTrigger value="fechaSalon">Fecha y Salón</TabsTrigger>
                </TabsList>
              </Tabs>

              {searchMode === "texto" ? (
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
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="filtro-fecha" className="text-xs text-muted-foreground">
                      Fecha del evento
                    </Label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="filtro-fecha"
                        type="date"
                        value={filtroFecha}
                        onChange={(e) => setFiltroFecha(e.target.value)}
                        className="pl-10 h-11"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="filtro-salon" className="text-xs text-muted-foreground">
                      Salón
                    </Label>
                    <Select value={filtroSalon} onValueChange={setFiltroSalon}>
                      <SelectTrigger id="filtro-salon" className="h-11">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Todos los salones" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los salones</SelectItem>
                        {SALONES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {salonLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(filtroFecha || filtroSalon !== "todos") && (
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroFecha("")
                        setFiltroSalon("todos")
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 justify-self-start sm:col-span-2"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              )}

              {hayBusquedaActiva && (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {searchMode === "texto"
                        ? `Sin resultados para "${searchTerm}"`
                        : "Sin eventos para esa fecha y salón"}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground px-1">
                        {searchResults.length} {searchResults.length === 1 ? "evento encontrado" : "eventos encontrados"}
                      </p>
                      {searchResults.map((ev) => {
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
                                {ev.salon && ` - ${salonLabel(ev.salon)}`}
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
                      })}
                    </>
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
                        {!item.pagada ? (
                          <Button size="sm" variant="outline" onClick={() => handleSelectEvento(item.evento)}>
                            Ir al evento
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (confirm(`¿Marcar la cuota ${item.numeroCuota} como impaga? El cliente la volverá a adeudar.`)) {
                                handleRevertirCuotaPagada(item.evento.id, item.numeroCuota)
                              }
                            }}
                          >
                            Marcar Impaga
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

            <div className="grid gap-6 items-start lg:grid-cols-2">
            {/* Left column: Event info, plan de cuotas y próximo pago */}
            <div className="space-y-6">
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 bg-transparent"
                      onClick={() => setShowContractPreview(true)}
                    >
                      <FileText className="h-3 w-3" />
                      Contrato
                    </Button>
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
                  <Button asChild variant="outline" size="sm" className="bg-transparent">
                    <Link href={`/eventos/contratos?eventoId=${selectedEvento.id}`}>
                      <FileText className="h-4 w-4 mr-1.5" />
                      Editar en Contratos
                    </Link>
                  </Button>
                </div>
                {(() => {
                  const plan = selectedEvento.planDeCuotas
                  if (plan && plan.numeroCuotas > 0) {
                    const modalidad = plan.modalidadPago || "cuotas"
                    const modalidadLabel =
                      modalidad === "completo"
                        ? "Pago completo"
                        : modalidad === "sena"
                          ? "Seña + Cuotas"
                          : "Solo Cuotas"
                    return (
                      <CardDescription className="space-y-1">
                        <span className="block">
                          <span className="font-semibold text-foreground">{modalidadLabel}</span>
                          {modalidad === "completo"
                            ? ` · 1 pago de ${formatCurrency(plan.montoCuota || plan.montoTotal)}`
                            : ` · ${plan.numeroCuotas} cuotas de ${formatCurrency(plan.montoCuota || 0)}`}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {modalidad === "sena" && (plan.montoSena || 0) > 0 && (
                            <Badge variant="secondary" className="text-[11px]">
                              Seña: {formatCurrency(plan.montoSena!)}
                            </Badge>
                          )}
                          {(plan.porcentajeRecargo || 0) > 0 && (
                            <Badge variant="secondary" className="text-[11px]">
                              Recargo financiación: {plan.porcentajeRecargo}%
                            </Badge>
                          )}
                          {plan.ajustaPorIPC === true && (
                            <Badge variant="secondary" className="text-[11px] text-amber-700">
                              Ajusta por IPC
                            </Badge>
                          )}
                        </span>
                      </CardDescription>
                    )
                  }
                  if (selectedEvento.planCuotas && selectedEvento.planCuotas > 0) {
                    return (
                      <CardDescription>
                        Plan guardado: {selectedEvento.planCuotas} cuotas de {formatCurrency((selectedEvento.montoTotalPlan || 0) / selectedEvento.planCuotas)}
                      </CardDescription>
                    )
                  }
                  return (
                    <CardDescription>
                      El plan de cuotas y el monto total se configuran desde Contratos. Aquí solo se registran y consultan los pagos.
                    </CardDescription>
                  )
                })()}
              </CardHeader>
              <CardContent className="space-y-4">
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

            </div>

            {/* Right column: próximo pago y pagos registrados */}
            <div className="space-y-6">
            {/* Next Pending Payment Card */}
            {(() => {
              // Get the fresh event data from the store to compute next cuota
              const freshEvento = eventos.find(e => e.id === selectedEvento.id) || selectedEvento
              const calendarioCuotas = generarCalendarioCuotas(freshEvento)
              const proximaCuota = calendarioCuotas.find(c => !c.pagada)
              const montoCuotaOriginal = freshEvento.planDeCuotas?.montoCuota || 0
              // Estricto: solo eventos marcados explícitamente como ajustables por IPC
              const ajustaPorIPC = freshEvento.planDeCuotas?.ajustaPorIPC === true
              const cuotaFueAjustada = ajustaPorIPC && proximaCuota != null && montoCuotaOriginal > 0 && proximaCuota.monto > montoCuotaOriginal

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
                          {cuotaFueAjustada && (
                            <Badge variant="secondary" className="mt-2 gap-1 text-emerald-700">
                              <TrendingUp className="h-3.5 w-3.5" />
                              Ajustada por IPC
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          {cuotaFueAjustada && (
                            <p className="text-sm text-muted-foreground line-through">{formatCurrency(montoCuotaOriginal)}</p>
                          )}
                          <p className="text-2xl font-bold text-primary">{formatCurrency(proximaCuota.monto)}</p>
                          <Button
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              // IPC acumulado que ya incrementó el precio de esta cuota, calculado
                              // automáticamente: monto ajustado vs monto original del plan (>IPC).
                              // Queda guardado en el pago para que el comprobante imprimible lo detalle.
                              const ipcAcumulado =
                                cuotaFueAjustada && montoCuotaOriginal > 0
                                  ? Math.round(((proximaCuota.monto - montoCuotaOriginal) / montoCuotaOriginal) * 10000) / 100
                                  : 0
                              setMontoCuotaBase(proximaCuota.monto)
                              setPagoForm({
                                monto: proximaCuota.monto,
                                fecha: new Date().toISOString().split("T")[0],
                                pagadoPor: "",
                                porcentajeIPC: ipcAcumulado,
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
                          <PaymentReceipt evento={selectedEvento} pago={pago} historialIPC={historialIPC} />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => setPagoToDelete(pago)}
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
            </div>
            </div>

            {/* Vista previa del contrato (modal) */}
            {showContractPreview && (
              <div
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
                onClick={() => setShowContractPreview(false)}
              >
                <div
                  className="flex h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-background shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Vista Previa del Contrato</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowContractPreview(false)}>
                      Cerrar
                    </Button>
                  </div>
                  <iframe
                    srcDoc={buildUltimaVersionContratoHTML(
                      selectedEvento,
                      state.recetas || [],
                      state.servicios || [],
                      state.pagosPersonal || [],
                    )}
                    className="flex-1 w-full"
                    title="Vista previa del contrato"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state when no event selected */}
        {!selectedEvento && !hayBusquedaActiva && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground">Busca un evento</h2>
            <p className="text-muted-foreground mt-2 max-w-sm">
              {searchMode === "texto"
                ? "Escribe el nombre del evento, festejados o DNI para ver y gestionar los pagos"
                : "Elegí una fecha y/o un salón para ver los eventos y gestionar sus pagos"}
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
              {/* Fecha */}
              <div className="grid gap-1">
                <Label className="text-xs">Fecha de cobro</Label>
                <Input
                  type="date"
                  value={pagoForm.fecha}
                  onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground leading-tight">
                  El ingreso se registra en las cajas con esta fecha. Para cuotas atrasadas, elegí el mes real en que se cobró.
                </p>
              </div>

              {/* Total a pagar (el IPC ya se aplica automáticamente al monto de la cuota) */}
              {montoCuotaBase > 0 && (
                <div className="rounded-md border border-border bg-muted/50 px-3 py-2 flex items-center justify-between text-xs">
                  <span className="font-semibold">Total a pagar</span>
                  <span className="font-mono font-bold text-sm text-primary">
                    {formatCurrency(pagoForm.monto)}
                  </span>
                </div>
              )}

              {/* Monto final */}
              <div className="grid gap-1">
                <Label className="text-xs">Monto Final ($)</Label>
                <MoneyInput
                  value={pagoForm.monto}
                  onValueChange={(monto) => setPagoForm({ ...pagoForm, monto })}
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
                  <MoneyInput
                    value={pagoForm.montoRecibido}
                    onValueChange={(montoRecibido) => setPagoForm({ ...pagoForm, montoRecibido })}
                    placeholder="Ej: 100.000"
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

      {/* Confirmación de eliminación de comprobante/pago */}
      <Dialog open={!!pagoToDelete} onOpenChange={(open) => !open && setPagoToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar este comprobante de pago?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1">
                <p>
                  Vas a eliminar el registro del pago de{" "}
                  <span className="font-semibold text-foreground">
                    {pagoToDelete ? formatCurrency(pagoToDelete.monto) : ""}
                  </span>
                  {pagoToDelete?.notas ? ` (${pagoToDelete.notas})` : ""}. Esta acción:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Descuenta el monto de la Caja Eventos y la Caja Jazmines.</li>
                  <li>Vuelve a marcar la cuota como impaga (el cliente la vuelve a adeudar).</li>
                  <li>Queda registrada en Configuración &gt; Actividad.</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => pagoToDelete && handleDeletePago(pagoToDelete.id)}
            >
              Eliminar pago
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

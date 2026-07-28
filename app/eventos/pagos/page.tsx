"use client"

import { useState, useMemo, useRef, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
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
import { calcularProporcionCajaEventos, repartirEntreCajas } from "@/lib/cobrar-cuota"
import { ContratoPanel } from "@/components/contrato-panel"
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
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Search,
  CreditCard,
  Plus,
  Trash2,
  Printer,
  Pencil,
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

  // Valores por defecto del recibo, autocompletados desde el evento y el pago.
  const buildDefaults = () => ({
    nombreApellido: pago.pagadoPor || evento.nombrePareja || evento.nombre || "",
    dni: pago.dni || evento.dniNovio1 || "",
    fechaPago: pago.fecha || new Date().toISOString().split("T")[0],
    fechaEvento: evento.fecha || "",
    valor: formatCurrency(pago.monto),
    sumaPesos: `${numeroALetras(Math.round(pago.monto))} (${formatCurrency(pago.monto)})`,
    espacio: "CENTENERA 1789, DEL VISO",
    concepto: `Cuota ${cuotaActual}${totalCuotas > 0 ? ` de ${totalCuotas}` : ""}${pago.porcentajeIPC > 0 ? ` - incluye IPC ${pago.porcentajeIPC}%${ipcMesLabel ? ` (${ipcMesLabel})` : ""}` : ""}`,
  })

  const [editOpen, setEditOpen] = useState(false)
  const [campos, setCampos] = useState(buildDefaults)

  const imprimirRecibo = (datos: ReturnType<typeof buildDefaults>) => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const fmtFecha = (iso: string) => {
      const m = (iso || "").match(/(\d{4})-(\d{2})-(\d{2})/)
      return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || ""
    }
    const [dia, mes, anio] = (() => {
      const m = (datos.fechaPago || "").match(/(\d{4})-(\d{2})-(\d{2})/)
      return m ? [m[3], m[2], m[1]] : ["", "", ""]
    })()

    // Una copia del recibo (talon + recibo). Se imprimen dos copias identicas
    // apiladas en vertical, que juntas ocupan 3/4 de la hoja A4.
    const copiaHtml = `
      <div class="copia">
        <!-- Talon para Los Jazmines -->
        <div class="talon">
          <div class="talon-tabla">
            <div class="talon-header"><span class="script">Los Jazmines</span></div>
            <div class="talon-fila">Nombre y Apellido:<div class="dato">${datos.nombreApellido}</div></div>
            <div class="talon-fila">${datos.concepto ? `<div class="dato" style="margin-top:0;">${datos.concepto}</div>` : ""}</div>
            <div class="talon-fila">Fecha Evento:<div class="dato">${fmtFecha(datos.fechaEvento)}</div></div>
            <div class="talon-fila">Valor:<div class="dato">${datos.valor}</div></div>
            <div class="talon-fila">Espacio: <span class="dato" style="display:inline;margin-left:1mm;">${datos.espacio}</span></div>
            <div class="talon-fila">Fecha de Pago:<div class="dato">${fmtFecha(datos.fechaPago)}</div></div>
          </div>
        </div>

        <div class="separador"></div>

        <!-- Recibo para el cliente -->
        <div class="recibo">
          <div class="recibo-top">
            <span class="script">Los Jazmines</span>
            <div class="fecha-grupo">
              <span class="fecha-label">Fecha</span>
              <div class="fecha-cajas">
                <div class="fecha-caja">${dia}</div>
                <div class="fecha-caja">${mes}</div>
                <div class="fecha-caja">${anio}</div>
              </div>
            </div>
          </div>

          <div class="linea"><span class="label">Recib&iacute; de:</span><span class="relleno">${datos.nombreApellido}</span></div>
          <div class="linea"><span class="label">D.N.I.:</span><span class="relleno">${datos.dni}</span></div>
          <div class="linea"><span class="label">La suma de pesos</span><span class="relleno">${datos.sumaPesos}</span></div>
          <div class="linea"><span class="relleno" style="margin-left:0;">${datos.concepto}</span></div>
          <div class="concepto">en concepto de alquiler del salon ubicado en <b>${datos.espacio}</b></div>
          <div class="linea"><span class="label">para el d&iacute;a:</span><span class="relleno">${fmtFecha(datos.fechaEvento)}</span></div>

          <div class="firmas">
            <div class="campo"><span>Firma:</span><span class="relleno"></span></div>
            <div class="campo"><span>Aclaraci&oacute;n:</span><span class="relleno"></span></div>
          </div>
        </div>
      </div>
    `

    printWindow.document.write(`
      <html>
        <head>
          <title>Recibo - Los Jazmines</title>
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; color: #111; }
            .script { font-family: 'Times New Roman', Times, Georgia, serif; font-weight: normal; }

            /* Cada copia ocupa ~3/8 de la hoja: las dos juntas suman 3/4 */
            .copia { display: flex; width: 100%; height: 104mm; overflow: hidden; page-break-inside: avoid; }
            .cut-line { border: none; border-top: 2px dashed #999; margin: 2mm 0; position: relative; }
            .cut-line::after { content: "\\2702 cortar aqui"; position: absolute; top: -3mm; left: 50%; transform: translateX(-50%); background: #fff; padding: 0 6px; font-size: 9px; color: #999; }

            /* ===== Talon izquierdo (Los Jazmines) ===== */
            .talon { width: 33%; padding: 2mm 3mm 2mm 0; }
            .talon-tabla { border: 1.5px solid #111; width: 100%; }
            .talon-fila { border-bottom: 1px solid #111; padding: 1.6mm 2.5mm; min-height: 10mm; font-size: 10px; font-style: italic; }
            .talon-fila:last-child { border-bottom: none; }
            .talon-fila .dato { font-style: normal; font-weight: bold; margin-top: 0.8mm; font-size: 10.5px; }
            .talon-header { text-align: center; padding: 2mm; border-bottom: 1px solid #111; }
            .talon-header .script { font-size: 19px; }

            /* ===== Separador troquelado ===== */
            .separador { width: 0; border-left: 1.5px dashed #999; margin: 2mm 0; }

            /* ===== Recibo derecho (Cliente) ===== */
            .recibo { flex: 1; padding: 3mm 2mm 3mm 5mm; display: flex; flex-direction: column; }
            .recibo-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4mm; }
            .recibo-top .script { font-size: 26px; }
            .fecha-grupo { display: flex; align-items: center; gap: 2mm; margin-top: 2.5mm; }
            .fecha-grupo .fecha-label { font-size: 10px; }
            .fecha-cajas { display: flex; border: 1px solid #111; }
            .fecha-caja { width: 13mm; height: 7mm; border-right: 1px solid #111; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; }
            .fecha-caja:last-child { border-right: none; }
            .linea { font-size: 11px; line-height: 1.9; display: flex; align-items: baseline; }
            .linea .label { white-space: nowrap; }
            .linea .relleno { flex: 1; border-bottom: 1px dotted #444; margin-left: 1.5mm; padding: 0 1.5mm 1px; font-weight: bold; min-height: 4.5mm; }
            .concepto { font-size: 11px; line-height: 1.9; }
            .concepto b { font-weight: bold; }
            .firmas { display: flex; gap: 8mm; margin-top: auto; padding-top: 6mm; font-size: 10px; }
            .firmas .campo { display: flex; align-items: baseline; flex: 1; }
            .firmas .relleno { flex: 1; border-bottom: 1px dotted #444; margin-left: 1.5mm; min-height: 4.5mm; }
          </style>
        </head>
        <body>
          ${copiaHtml}
          <hr class="cut-line" />
          ${copiaHtml}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <>
      {/* Imprimir directo con datos autocompletados */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        title="Imprimir recibo"
        onClick={() => imprimirRecibo(buildDefaults())}
      >
        <Printer className="h-3.5 w-3.5" />
      </Button>

      {/* Editar los datos del recibo antes de imprimir */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        title="Editar recibo antes de imprimir"
        onClick={() => {
          setCampos(buildDefaults())
          setEditOpen(true)
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Editar recibo
            </DialogTitle>
            <DialogDescription>
              Ajusta los datos antes de imprimir. Los campos vienen autocompletados con la informaci&oacute;n del pago.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 max-h-[55vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Recib&iacute; de (Nombre y Apellido)</Label>
              <Input
                value={campos.nombreApellido}
                onChange={(e) => setCampos((p) => ({ ...p, nombreApellido: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>D.N.I.</Label>
                <Input value={campos.dni} onChange={(e) => setCampos((p) => ({ ...p, dni: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de pago</Label>
                <Input
                  type="date"
                  value={campos.fechaPago}
                  onChange={(e) => setCampos((p) => ({ ...p, fechaPago: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>La suma de pesos</Label>
              <Textarea
                rows={2}
                value={campos.sumaPesos}
                onChange={(e) => setCampos((p) => ({ ...p, sumaPesos: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Detalle (cuota / concepto)</Label>
              <Input value={campos.concepto} onChange={(e) => setCampos((p) => ({ ...p, concepto: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (tal&oacute;n)</Label>
                <Input value={campos.valor} onChange={(e) => setCampos((p) => ({ ...p, valor: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha del evento</Label>
                <Input
                  type="date"
                  value={campos.fechaEvento}
                  onChange={(e) => setCampos((p) => ({ ...p, fechaEvento: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Espacio / Sal&oacute;n</Label>
              <Input value={campos.espacio} onChange={(e) => setCampos((p) => ({ ...p, espacio: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                imprimirRecibo(campos)
                setEditOpen(false)
              }}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Convierte un numero entero a letras en espanol (para "La suma de pesos ...").
function numeroALetras(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ""
  if (n === 0) return "Cero"
  const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"]
  const DIECIS = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciseis", "diecisiete", "dieciocho", "diecinueve"]
  const DECENAS = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]
  const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"]

  const tresDigitos = (num: number): string => {
    if (num === 0) return ""
    if (num === 100) return "cien"
    const c = Math.floor(num / 100)
    const resto = num % 100
    let out = c > 0 ? CENTENAS[c] : ""
    if (resto === 0) return out
    if (out) out += " "
    if (resto < 10) return out + UNIDADES[resto]
    if (resto < 20) return out + DIECIS[resto - 10]
    const d = Math.floor(resto / 10)
    const u = resto % 10
    if (d === 2 && u > 0) return out + "veinti" + UNIDADES[u]
    return out + DECENAS[d] + (u > 0 ? " y " + UNIDADES[u] : "")
  }

  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (millones > 0) partes.push(millones === 1 ? "un millon" : `${tresDigitos(millones)} millones`)
  if (miles > 0) partes.push(miles === 1 ? "mil" : `${tresDigitos(miles)} mil`)
  if (resto > 0) partes.push(tresDigitos(resto))
  const texto = partes.join(" ").replace(/\buno mil\b/g, "un mil").trim()
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function PagosPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialSearch = searchParams.get("evento") || ""
  // Si llegó con ?evento= viene desde la Lista de Eventos: la flecha vuelve allá.
  const vieneDeLista = Boolean(initialSearch)
  const { eventos, updateEvento, configuracionCajas, movimientosCaja, addMovimientosCaja, deleteMovimientoCaja, historialIPC, state } = useStore()
  const { toast } = useToast()
  const [showContractPreview, setShowContractPreview] = useState(false)
  const [showContratoPanel, setShowContratoPanel] = useState(false)

  // Protección con PIN de administración para editar el contrato.
  const [showPinContrato, setShowPinContrato] = useState(false)
  const [pinContrato, setPinContrato] = useState("")
  const [pinContratoError, setPinContratoError] = useState("")
  const [verificandoPinContrato, setVerificandoPinContrato] = useState(false)

  const handleVerificarPinContrato = async () => {
    if (!pinContrato.trim() || verificandoPinContrato) return
    setVerificandoPinContrato(true)
    setPinContratoError("")
    try {
      const res = await fetch("/api/auth/verificar-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinContrato }),
      })
      const data = await res.json().catch(() => ({ ok: false }))
      if (data.ok) {
        setShowPinContrato(false)
        setPinContrato("")
        setShowContratoPanel(true)
      } else {
        setPinContratoError("PIN incorrecto")
      }
    } catch {
      setPinContratoError("No se pudo verificar el PIN. Intentá de nuevo.")
    } finally {
      setVerificandoPinContrato(false)
    }
  }

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
    dni: "",
    porcentajeIPC: 0,
    notas: "",
    montoRecibido: 0,
    recibidoPor: "",
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
    if (!selectedEvento || pagoForm.monto <= 0 || !pagoForm.pagadoPor || !pagoForm.recibidoPor.trim()) return
    const vueltoCalculado = pagoForm.montoRecibido > pagoForm.monto ? Math.round((pagoForm.montoRecibido - pagoForm.monto) * 100) / 100 : 0
    const newPago: PagoEvento = {
      id: generateId(),
      monto: pagoForm.monto,
      fecha: pagoForm.fecha,
      pagadoPor: pagoForm.pagadoPor,
      dni: pagoForm.dni || undefined,
      porcentajeIPC: pagoForm.porcentajeIPC,
      notas: pagoForm.notas || undefined,
      montoRecibido: pagoForm.montoRecibido > 0 ? pagoForm.montoRecibido : undefined,
      vuelto: vueltoCalculado > 0 ? vueltoCalculado : undefined,
      recibidoPor: pagoForm.recibidoPor.trim(),
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

    // Generar los movimientos de caja del ingreso, repartidos según la regla del
    // evento: nuevos -> costo del evento + 5% a Caja Eventos y el resto a Caja
    // Jazmines (proporcional en cada pago, costo recalculado en vivo) para TODOS los eventos.
    if (selectedEvento.salon && pagoForm.monto > 0) {
      const nombreEvento = selectedEvento.nombre || selectedEvento.nombrePareja || "Evento"
      const etiquetaCuota = cuotaPagadaNumero ? `Cuota ${cuotaPagadaNumero}` : "Pago"
      const proporcionEventos = calcularProporcionCajaEventos(selectedEvento, {
        insumos: state.insumos || [],
        insumosBarra: state.insumosBarra || [],
        recetas: state.recetas || [],
        cocteles: state.cocteles || [],
      })
      const { montoEventos: mitadEventos, montoJazmines: mitadJazmines } = repartirEntreCajas(
        pagoForm.monto,
        proporcionEventos,
      )
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
      `Pago registrado por ${formatCurrency(pagoForm.monto)}${pagoForm.pagadoPor ? ` | Pagado por: ${pagoForm.pagadoPor}` : ""} | Recibido por: ${pagoForm.recibidoPor.trim()}${selectedEvento.salon ? ` | Ingreso repartido entre Caja Eventos y Caja Jazmines` : ""}`,
    )

    // Enviar automáticamente el comprobante por email (Resend) a los
    // mails configurados: quién pagó, cuándo, cuánto, cuánto le resta
    // y quién recibió el pago. Fire-and-forget: no bloquea el registro.
    const totalPagosNuevo = updatedPagos.reduce((s, p) => s + p.monto, 0)
    const senaCubierta =
      selectedEvento.planDeCuotas?.modalidadPago?.startsWith("sena")
        ? selectedEvento.planDeCuotas.montoSena || 0
        : 0
    const totalPlanResumen = montoTotal > 0 ? montoTotal : selectedEvento.montoTotalPlan || 0
    const restanteResumen = Math.max(0, totalPlanResumen - (totalPagosNuevo + senaCubierta))
    const fechaLegible = pagoForm.fecha
      ? new Date(`${pagoForm.fecha}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : new Date().toLocaleDateString("es-AR")
    fetch("/api/comprobante-pago", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evento: nombreEventoLog,
        concepto: etiquetaLog,
        pagadoPor: pagoForm.pagadoPor,
        fecha: fechaLegible,
        monto: formatCurrency(pagoForm.monto),
        restante: totalPlanResumen > 0 ? formatCurrency(restanteResumen) : null,
        recibidoPor: pagoForm.recibidoPor.trim(),
      }),
    }).catch(() => {})

    setMontoCuotaBase(0)
    setPagoForm({
      monto: 0,
      fecha: new Date().toISOString().split("T")[0],
      pagadoPor: "",
      dni: "",
      porcentajeIPC: 0,
      notas: "",
      montoRecibido: 0,
      recibidoPor: "",
    })
    setShowPagoDialog(false)
  }

  const handleDeletePago = (pagoId: string) => {
    if (!selectedEvento) return
    const pago = (selectedEvento.pagos || []).find((p) => p.id === pagoId)
    if (!pago) return

    // 1) Determinar a qué cuota corresponde el pago (para revertirla y hallar sus movimientos)
    // Un "Pago único (pago completo)" corresponde siempre a la cuota 1: si no se
    // detecta, la cuota quedaría marcada como pagada para siempre tras eliminar el pago.
    const matchCuota = /Cuota\s+(\d+)/i.exec(pago.notas || "")
    const esPagoUnicoNota = /pago\s+(único|unico|completo)/i.test(pago.notas || "")
    const numeroCuota = matchCuota ? parseInt(matchCuota[1], 10) : esPagoUnicoNota ? 1 : null
    const etiquetaCuota = numeroCuota ? `Cuota ${numeroCuota}` : "Pago"

    // 2) Revertir los movimientos de caja que se habían sumado por este pago.
    //    Se buscan por evento + etiqueta de la cuota, tomando por cada caja el
    //    movimiento cuyo monto más se acerca a la parte proporcional que le
    //    correspondió (costo + 5% a Eventos, resto a Jazmines).
    let cajasRevertidas = false
    const candidatos = movimientosCaja.filter(
      (m: MovimientoCaja) =>
        m.eventoId === selectedEvento.id &&
        m.tipo === "ingreso" &&
        typeof m.concepto === "string" &&
        m.concepto.startsWith(`${etiquetaCuota} - `),
    )
    const propEventos = calcularProporcionCajaEventos(selectedEvento, {
      insumos: state.insumos || [],
      insumosBarra: state.insumosBarra || [],
      recetas: state.recetas || [],
      cocteles: state.cocteles || [],
    })
    const objetivoPorCaja: Record<"caja_eventos" | "caja_jazmines", number> = {
      caja_eventos: pago.monto * propEventos,
      caja_jazmines: pago.monto * (1 - propEventos),
    }
    ;(["caja_eventos", "caja_jazmines"] as const).forEach((caja) => {
      const delCaja = candidatos.filter((m) => m.cajaDestino === caja)
      if (delCaja.length === 0) return
      const objetivo = objetivoPorCaja[caja]
      const elegido = delCaja.reduce((best, m) =>
        Math.abs(m.monto - objetivo) < Math.abs(best.monto - objetivo) ? m : best,
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
  // La seña se cobra al firmar el contrato y cubre un porcentaje del total, pero
  // no figura en la lista de "pagos" (esos son solo las cuotas). Para que la barra
  // de progreso y el saldo reflejen la realidad, la sumamos como monto ya cubierto.
  // NO afecta el cálculo de cuotas (montoPorCuota / cuotasRestantes usan el plan).
  const montoSenaPlan =
    selectedEvento?.planDeCuotas?.modalidadPago === "sena"
      ? selectedEvento.planDeCuotas.montoSena || 0
      : 0
  const totalCubierto = totalPagos + montoSenaPlan
  const saldoPendiente = montoTotal > 0 ? montoTotal - totalCubierto : 0
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

        // Si la cuota vence este mes y todavía no fue pagada.
        // Las pagadas desaparecen del recordatorio.
        if (año === añoActual && mes === mesActual && !cuota.pagada) {
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center gap-4">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">PERFIL DEL EVENTO</h1>
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
                        item.rangoRecordatorio
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
                          {item.rangoRecordatorio && (
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
                        <Button size="sm" variant="outline" onClick={() => handleSelectEvento(item.evento)}>
                          Ir al evento
                        </Button>
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
                if (vieneDeLista) {
                  router.push("/eventos/lista")
                } else {
                  setSelectedEvento(null)
                  setSearchTerm("")
                }
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {vieneDeLista ? "Volver a lista de eventos" : "Buscar otro evento"}
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
                    {selectedEvento.createdAt && (
                      <Badge
                        variant="outline"
                        className="mt-2 border-border bg-muted/50 text-xs font-normal text-muted-foreground"
                      >
                        Creado el {new Date(selectedEvento.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </Badge>
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
                {selectedEvento.notasInternas && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-amber-800 mb-1">Observaciones del evento</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 gap-1 text-destructive hover:text-destructive shrink-0"
                        onClick={async () => {
                          if (!confirm("¿Seguro que queres borrar la observacion del evento? Esta accion no se puede deshacer.")) return
                          await updateEvento(selectedEvento.id, { notasInternas: "" })
                          setSelectedEvento({ ...selectedEvento, notasInternas: "" })
                          toast({ title: "Observacion borrada", description: "La observacion del evento fue eliminada" })
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Borrar
                      </Button>
                    </div>
                    <p className="text-sm text-amber-900 whitespace-pre-line">{selectedEvento.notasInternas}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cuotas & Monto Total Config */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Plan de Cuotas</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent"
                    onClick={() => {
                      setPinContrato("")
                      setPinContratoError("")
                      setShowPinContrato(true)
                    }}
                  >
                    <FileText className="h-4 w-4 mr-1.5" />
                    Editar Contrato
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
                        <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalCubierto)}</p>
                        {montoSenaPlan > 0 && (
                          <p className="text-xs text-muted-foreground">Incluye seña de {formatCurrency(montoSenaPlan)}</p>
                        )}
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
                          style={{ width: `${Math.min(100, (totalCubierto / montoTotal) * 100)}%` }}
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

              const esPagoUnico = freshEvento.planDeCuotas?.modalidadPago === "completo"

              if (proximaCuota && proximaCuota.fechaVencimiento) {
                return (
                  <Card className="border-2 border-primary/30 bg-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        {esPagoUnico ? "Pago único" : "Proximo Pago"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground font-bold">
                            {esPagoUnico
                              ? "Pago completo del evento"
                              : `Cuota ${proximaCuota.numeroCuota} de ${calendarioCuotas.length}`}
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
                                dni: selectedEvento?.dniNovio1 || "",
                                porcentajeIPC: ipcAcumulado,
                                notas: esPagoUnico
                                  ? "Pago único (pago completo)"
                                  : `Cuota ${proximaCuota.numeroCuota}/${calendarioCuotas.length}`,
                                montoRecibido: 0,
                                recibidoPor: "",
                              })
                              setShowPagoDialog(true)
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" /> {esPagoUnico ? "Registrar pago" : "Registrar este pago"}
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
                          <p className="font-semibold text-emerald-800">
                            {esPagoUnico ? "Pago completo registrado" : "Todas las cuotas estan pagadas"}
                          </p>
                          <p className="text-sm text-emerald-600">
                            {esPagoUnico ? "El evento está totalmente pagado" : `${calendarioCuotas.length} cuotas completadas`}
                          </p>
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
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Pagos Registrados
                </CardTitle>
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
                      state.barrasTemplates || [],
                      state.cocteles || [],
                    )}
                    className="flex-1 w-full"
                    title="Vista previa del contrato"
                  />
                </div>
              </div>
            )}

            {/* Panel lateral de contrato (sin salir de esta pantalla) */}
            <ContratoPanel
              eventoId={selectedEvento.id}
              open={showContratoPanel}
              onClose={() => setShowContratoPanel(false)}
            />
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

              {/* Pagado por + DNI */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Pagado por</Label>
                  <Input
                    value={pagoForm.pagadoPor}
                    onChange={(e) => setPagoForm({ ...pagoForm, pagadoPor: e.target.value })}
                    placeholder="Nombre de quien paga"
                    className="h-9"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">D.N.I.</Label>
                  <Input
                    value={pagoForm.dni}
                    onChange={(e) => setPagoForm({ ...pagoForm, dni: e.target.value })}
                    placeholder="DNI de quien paga"
                    inputMode="numeric"
                    className="h-9"
                  />
                </div>
              </div>

              {/* Quién registra/recibe el pago (obligatorio) */}
              <div className="grid gap-1">
                <Label className="text-xs">
                  {"¿Quién registra el pago?"} <span className="text-red-600">*</span>
                </Label>
                <Input
                  value={pagoForm.recibidoPor}
                  onChange={(e) => setPagoForm({ ...pagoForm, recibidoPor: e.target.value })}
                  placeholder="Nombre de quien recibe el pago"
                  className={`h-9 ${!pagoForm.recibidoPor.trim() ? "border-red-300" : ""}`}
                />
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Obligatorio: queda asentado en el registro de actividad y en el comprobante.
                </p>
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
            <Button size="sm" onClick={handleAddPago} disabled={pagoForm.monto <= 0 || !pagoForm.pagadoPor || !pagoForm.recibidoPor.trim()}>
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

      {/* PIN de administración para editar el contrato */}
      <Dialog
        open={showPinContrato}
        onOpenChange={(open) => {
          if (!open) {
            setShowPinContrato(false)
            setPinContrato("")
            setPinContratoError("")
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar contrato</DialogTitle>
            <DialogDescription>
              Ingres&aacute; el PIN de administraci&oacute;n para acceder a la edici&oacute;n del contrato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pinContrato}
              autoFocus
              onChange={(e) => {
                setPinContrato(e.target.value)
                setPinContratoError("")
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  handleVerificarPinContrato()
                }
              }}
            />
            {pinContratoError && <p className="text-sm text-destructive">{pinContratoError}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPinContrato(false)
                setPinContrato("")
                setPinContratoError("")
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleVerificarPinContrato} disabled={!pinContrato.trim() || verificandoPinContrato}>
              {verificandoPinContrato ? "Verificando..." : "Acceder"}
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

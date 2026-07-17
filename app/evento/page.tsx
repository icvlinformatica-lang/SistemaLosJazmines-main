"use client"

import { useState, useEffect, useCallback, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import {
  formatCurrency,
  calcularComprasSegmentadas,
  calcularComprasBarras,
  calcularCostoServicios,
  calcularCostosOperativos,
  calcularFechaCuota,
  calcularTotalesPaquete,
  getPrecioVenta,
  generateId,
  generarMovimientoIngreso,
  obtenerPreciosServicio,
  type EventoHistorial,
  type BarraEvento,
  type ServicioEvento,
  type Servicio,
  type PaqueteSalon,
  type EstadoEvento,
  type EventoGuardado,
  type VersionContrato,
  type MovimientoCaja,
  type PersonalDelEvento,
  detectarImpactosContrato,
  SALONES,
} from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
import { UnifiedDocument, type DocumentSections } from "@/components/unified-document"
import { useToast } from "@/hooks/use-toast"
import {
  Users,
  UserCheck,
  Baby,
  ChefHat,
  Calendar as CalendarIcon,
  Clock,
  Save,
  Building2,
  X,
  Plus,
  Minus,
  Heart,
  FileText,
  CheckCircle,
  ArrowLeft,
  Wine,
  Pencil,
  Trash2,
  Eye,
  DollarSign,
  AlertCircle,
  Briefcase,
  Lock,
  ChevronDown,
  UtensilsCrossed,
  Phone,
  Package,
  Percent,
  CreditCard,
  Banknote,
  Receipt,
  Info,
  AlertTriangle,
  ClipboardList,
  TrendingUp,
} from "lucide-react"
import { MenuTable } from "@/components/menu-table"
import { CoctelTable } from "@/components/coctel-table"

function EventoPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editingEventoId = searchParams?.get("id")
  const isEditing = !!editingEventoId
  const fromContratos = searchParams?.get("from") === "contratos"
  const { toast } = useToast()
  
  const { state, loading, setEventoActual, updateEventoActual, updateInsumo, updateInsumoBarra, addEventoHistorial, updateEvento, addEvento, eventos, servicios: catalogoServicios, costosOperativos, preciosVenta, paquetesSalones, configuracionCajas, movimientosCaja, addMovimientosCaja, personal } = useStore()
  const [showUnifiedDoc, setShowUnifiedDoc] = useState(false)
  const [showSectionSelector, setShowSectionSelector] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [showDraftDialog, setShowDraftDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [observacionContrato, setObservacionContrato] = useState("")
  const [docSections, setDocSections] = useState<DocumentSections>({
    listaCompras: true,
    barraCocteles: true,
    guiaProduccion: true,
  })

  // Package selection state (no more individual service dialog)


  // Load event data if editing - use eventos from context (synced with DB)
  // Also try to fetch directly from API if not found in context
  useEffect(() => {
    if (!editingEventoId) return
    if (state.eventoActual?.id === editingEventoId) return // Already loaded
    
    // First try to find in context
    const eventoFromContext = eventos.find((e) => e.id === editingEventoId)
    if (eventoFromContext) {
      setEventoActual(eventoFromContext)
      return
    }
    
    // If still loading, wait
    if (loading) return
    
    // If not found in context after loading, try direct API fetch
    const fetchEvento = async () => {
      try {
        const res = await fetch(`/api/eventos/${editingEventoId}`)
        if (res.ok) {
          const evento = await res.json()
          if (evento) {
            setEventoActual(evento)
            return
          }
        }
      } catch (err) {
        console.error("[v0] Error fetching evento:", err)
      }
      // Only redirect if truly not found
      router.push("/eventos/lista")
    }
    
    fetchEvento()
  }, [editingEventoId, state.eventoActual, setEventoActual, router, eventos, loading])

  const evento = state.eventoActual

  const [saveErrors, setSaveErrors] = useState<string[]>([])
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    detalles: true,
    menu: false,
    barras: false,
    personal: false,
    servicios: false,
    contrato: false,
  })
  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => {
      const wasOpen = prev[key] ?? false
      // Close all sections, then toggle the clicked one (accordion behavior)
      const allClosed: Record<string, boolean> = {}
      for (const k of Object.keys(prev)) {
        allClosed[k] = false
      }
      return { ...allClosed, [key]: !wasOpen }
    })
  }, [])

  // ✅ FIX: Estado local para prevenir pérdida de foco
  const [localNombre, setLocalNombre] = useState("")
  const [localFecha, setLocalFecha] = useState("")
  const [localHorario, setLocalHorario] = useState("")
  const [localHorarioFin, setLocalHorarioFin] = useState("")
  const [localNombrePareja, setLocalNombrePareja] = useState("")
  const [localDniNovio1, setLocalDniNovio1] = useState("")
  const [localDniNovio2, setLocalDniNovio2] = useState("")
  const [localAdultos, setLocalAdultos] = useState("0")
  const [localAdolescentes, setLocalAdolescentes] = useState("0")
  const [localNinos, setLocalNinos] = useState("0")
  const [localDietasEspeciales, setLocalDietasEspeciales] = useState("0")
  const [localDescripcion, setLocalDescripcion] = useState("")

  // Contrato local state
  const [localContratoNombre, setLocalContratoNombre] = useState("")
  const [localContratoDni, setLocalContratoDni] = useState("")
  const [localContratoTelefono, setLocalContratoTelefono] = useState("")
  const [localContratoEmail, setLocalContratoEmail] = useState("")
  const [localContratoDireccion, setLocalContratoDireccion] = useState("")
  const [localContratoFechaNac, setLocalContratoFechaNac] = useState("")
  const [localCondicionIVA, setLocalCondicionIVA] = useState<string>("Consumidor Final")

  // Plan de cuotas local state
  const [localMontoTotal, setLocalMontoTotal] = useState(0)
  const [localNumeroCuotas, setLocalNumeroCuotas] = useState(1)
  const [localDiaVencimiento, setLocalDiaVencimiento] = useState(10)
  const [localFechaInicioPlan, setLocalFechaInicioPlan] = useState("")
  const [localModalidadPago, setLocalModalidadPago] = useState<"completo" | "sena" | "cuotas">("cuotas")
  const [localMontoSena, setLocalMontoSena] = useState(0)
  const [localPorcentajeRecargo, setLocalPorcentajeRecargo] = useState(0)
  const [localAjustaPorIPC, setLocalAjustaPorIPC] = useState(false)
  const [expandedPaquetes, setExpandedPaquetes] = useState<Record<string, boolean>>({})

  // Sincronizar estado local cuando cambia el evento (al cargar)
  useEffect(() => {
    if (evento) {
      setLocalNombre(evento.nombre || "")
      setLocalFecha(evento.fecha || "")
      setLocalHorario(evento.horario || "")
      setLocalHorarioFin(evento.horarioFin || "")
      setLocalNombrePareja(evento.nombrePareja || "")
      setLocalDniNovio1(evento.dniNovio1 || "")
      setLocalDniNovio2(evento.dniNovio2 || "")
      setLocalAdultos(evento.adultos?.toString() || "0")
      setLocalAdolescentes(evento.adolescentes?.toString() || "0")
      setLocalNinos(evento.ninos?.toString() || "0")
      setLocalDietasEspeciales(evento.personasDietasEspeciales?.toString() || "0")
      setLocalDescripcion(evento.descripcionPersonalizada || "")
      // Contrato
      setLocalContratoNombre(evento.contrato?.nombreCompleto || "")
      setLocalContratoDni(evento.contrato?.dni || "")
      setLocalContratoTelefono(evento.contrato?.telefono || "")
      setLocalContratoEmail(evento.contrato?.email || "")
      setLocalContratoDireccion(evento.contrato?.direccion || "")
      setLocalContratoFechaNac(evento.contrato?.fechaNacimiento || "")
      setLocalCondicionIVA(evento.condicionIVA || "Consumidor Final")
      // Plan de cuotas
      setLocalMontoTotal(evento.planDeCuotas?.montoTotal || 0)
      setLocalNumeroCuotas(evento.planDeCuotas?.numeroCuotas || 1)
      setLocalDiaVencimiento(evento.planDeCuotas?.diaVencimiento || 10)
      setLocalFechaInicioPlan(evento.planDeCuotas?.fechaInicioPlan || "")
      setLocalModalidadPago(evento.planDeCuotas?.modalidadPago || "cuotas")
      setLocalMontoSena(evento.planDeCuotas?.montoSena || 0)
      setLocalPorcentajeRecargo(evento.planDeCuotas?.porcentajeRecargo || 0)
      setLocalAjustaPorIPC(evento.planDeCuotas?.ajustaPorIPC === true)
    }
  }, [evento?.id, editingEventoId]) // Solo cuando cambia el ID del evento o el parámetro de edición

  // ✅ Handlers para actualizar el store cuando el usuario termina de escribir
  const handleBlur = useCallback((field: string, value: string | number) => {
    updateEventoActual({ [field]: value })
  }, [updateEventoActual])

  const addRecetaToSegment = useCallback((segment: "adultos" | "adolescentes" | "ninos" | "dietasEspeciales", recetaId: string) => {
    if (!evento) return
    const keyMap = {
      adultos: "recetasAdultos",
      adolescentes: "recetasAdolescentes",
      ninos: "recetasNinos",
      dietasEspeciales: "recetasDietasEspeciales",
    }
    const key = keyMap[segment] as keyof typeof evento
    const current = (evento[key] as string[]) || []
    if (!current.includes(recetaId)) {
      updateEventoActual({ [key]: [...current, recetaId] })
    }
  }, [evento, updateEventoActual])

  const removeRecetaFromSegment = useCallback((
    segment: "adultos" | "adolescentes" | "ninos" | "dietasEspeciales",
    recetaId: string,
  ) => {
    if (!evento) return
    const keyMap = {
      adultos: "recetasAdultos",
      adolescentes: "recetasAdolescentes",
      ninos: "recetasNinos",
      dietasEspeciales: "recetasDietasEspeciales",
    }
    const multiplierKeyMap = {
      adultos: "multipliersAdultos",
      adolescentes: "multipliersAdolescentes",
      ninos: "multipliersNinos",
      dietasEspeciales: "multipliersDietasEspeciales",
    }
    const key = keyMap[segment] as keyof typeof evento
    const multiplierKey = multiplierKeyMap[segment] as keyof typeof evento
    const current = (evento[key] as string[]) || []
    const currentMultipliers = (evento[multiplierKey] as Record<string, number>) || {}
    const { [recetaId]: removed, ...remainingMultipliers } = currentMultipliers

    updateEventoActual({
      [key]: current.filter((id) => id !== recetaId),
      [multiplierKey]: remainingMultipliers,
    })
  }, [evento, updateEventoActual])

  const updateMultiplier = useCallback((
    segment: "adultos" | "adolescentes" | "ninos" | "dietasEspeciales",
    recetaId: string,
    value: number,
  ) => {
    if (!evento) return
    const keyMap = {
      adultos: "multipliersAdultos",
      adolescentes: "multipliersAdolescentes",
      ninos: "multipliersNinos",
      dietasEspeciales: "multipliersDietasEspeciales",
    }
    const key = keyMap[segment] as keyof typeof evento
    const currentMultipliers = (evento[key] as Record<string, number>) || {}

    updateEventoActual({
      [key]: {
        ...currentMultipliers,
        [recetaId]: Math.max(0.25, value),
      },
    })
  }, [evento, updateEventoActual])

  // === Bar Handlers ===
  // === Package Handlers (replace old service handlers) ===
  const paquetesDelSalon = useMemo(() => {
    if (!evento?.salon) return []
    return (paquetesSalones || []).filter(
      (p) => p.salon === evento.salon && p.activo
    )
  }, [evento?.salon, paquetesSalones])

  const paquetesSeleccionados = evento?.paquetesSeleccionados || []

  const handleTogglePaquete = useCallback((paqueteId: string) => {
    if (!evento) return
    const current = evento.paquetesSeleccionados || []
    const updated = current.includes(paqueteId)
      ? current.filter((id) => id !== paqueteId)
      : [...current, paqueteId]
    
    // Also update servicios array from selected packages for backwards compatibility
    const serviciosFromPaquetes: ServicioEvento[] = []
    updated.forEach((pid) => {
      const paq = (paquetesSalones || []).find((p) => p.id === pid)
      if (!paq) return
      paq.serviciosIncluidos.forEach((si) => {
        serviciosFromPaquetes.push({
          servicioId: si.servicioId,
          nombre: si.nombre,
          cantidad: si.cantidad || 1,
          unidad: si.unidad,
          notas: `Paquete: ${paq.nombre}`,
          proveedor: undefined,
        })
      })
    })
    
    updateEventoActual({ 
      paquetesSeleccionados: updated,
      servicios: serviciosFromPaquetes 
    })
  }, [evento, paquetesSalones, updateEventoActual])

  const costoPaquetesOficial = useMemo(() => {
    return paquetesSeleccionados.reduce((total, pid) => {
      const paq = (paquetesSalones || []).find((p) => p.id === pid)
      if (!paq) return total
      const totales = calcularTotalesPaquete(paq, catalogoServicios || [])
      return total + totales.precioOficial
    }, 0)
  }, [paquetesSeleccionados, paquetesSalones, catalogoServicios])

  const costoPaquetesInterno = useMemo(() => {
    return paquetesSeleccionados.reduce((total, pid) => {
      const paq = (paquetesSalones || []).find((p) => p.id === pid)
      if (!paq) return total
      const totales = calcularTotalesPaquete(paq, catalogoServicios || [])
      return total + totales.costoTotal
    }, 0)
  }, [paquetesSeleccionados, paquetesSalones, catalogoServicios])

  // MUST be before early return — useCallback is a hook
  const handleUpdateServicioSeña = useCallback((
    servicioId: string,
    campo: keyof ServicioEvento,
    valor: string | number | boolean | undefined,
  ) => {
    if (!evento) return
    const serviciosActualizados = (evento.servicios || []).map((s) =>
      s.servicioId === servicioId ? { ...s, [campo]: valor } : s
    )
    updateEventoActual({ servicios: serviciosActualizados })
  }, [evento, updateEventoActual])

  // BUTTON 1: Print Draft (READ ONLY - does NOT deduct stock)
  const handlePrintDraft = () => {
    setShowSectionSelector(true)
  }

  const handlePreviewSections = () => {
    setShowSectionSelector(false)
    setShowUnifiedDoc(true)
  }

  // Guardar borrador antes de salir
  const handleGuardarBorrador = async () => {
    if (!evento) return
    const borradorData = {
      ...evento,
      id: evento.id || generateId(),
      estado: "borrador" as EstadoEvento,
    }
    if (isEditing) {
      await updateEvento(borradorData.id, { estado: "borrador" })
    } else {
      await addEvento(borradorData)
    }
    setShowDraftDialog(false)
    setEventoActual(null)
    router.push("/eventos/lista")
  }

  const handleDescartarBorrador = () => {
    setShowDraftDialog(false)
    setEventoActual(null)
    router.push("/eventos/lista")
  }

  // Interceptar navegacion hacia atras: mostrar dialog solo si es un evento nuevo (no guardado)
  const handleNavigateAway = (e?: React.MouseEvent) => {
    // Si ya existe en la lista (isEditing) no preguntamos
    if (isEditing) return
    if (e) e.preventDefault()
    setShowDraftDialog(true)
  }

  // NUEVO: Guardar/Actualizar Evento
  const handleSaveEvento = async () => {
    if (!evento || isSaving) return
    
    setIsSaving(true)
    
    // Validaciones
    const errors: string[] = []
    if (!evento.nombre && !evento.nombrePareja) {
      errors.push("Nombre del evento")
    }
    if (!evento.fecha) {
      errors.push("Fecha")
    }
    if (!evento.salon) {
      errors.push("Salón")
    }
    if ((evento.adultos + evento.adolescentes + evento.ninos + (evento.personasDietasEspeciales || 0)) === 0) {
      errors.push("Al menos 1 invitado")
    }
    
    if (errors.length > 0) {
      setSaveErrors(errors)
      setIsSaving(false)
      toast({
        title: "Faltan datos",
        description: `Por favor completa: ${errors.join(", ")}`,
        variant: "destructive",
      })
      setTimeout(() => setSaveErrors([]), 5000)
      return
    }
    setSaveErrors([])
    
    // Calcular costos
    const costoInsumosCalc = costoTotalMateriaPrima
    
    const eventData = {
      id: evento.id,
      nombre: evento.nombre,
      fecha: evento.fecha,
      horario: evento.horario,
      horarioFin: evento.horarioFin,
      salon: evento.salon,
      tipoEvento: evento.tipoEvento,
      condicionIVA: evento.condicionIVA,
      nombrePareja: evento.nombrePareja,
      dniNovio1: evento.dniNovio1,
      dniNovio2: evento.dniNovio2,
      adultos: evento.adultos,
      adolescentes: evento.adolescentes,
      ninos: evento.ninos,
      personasDietasEspeciales: evento.personasDietasEspeciales,
      recetasAdultos: evento.recetasAdultos,
      recetasAdolescentes: evento.recetasAdolescentes,
      recetasNinos: evento.recetasNinos,
      recetasDietasEspeciales: evento.recetasDietasEspeciales,
      multipliersAdultos: evento.multipliersAdultos,
      multipliersAdolescentes: evento.multipliersAdolescentes,
      multipliersNinos: evento.multipliersNinos,
      multipliersDietasEspeciales: evento.multipliersDietasEspeciales,
      descripcionPersonalizada: evento.descripcionPersonalizada,
      barras: evento.barras,
      servicios: evento.servicios,
      paquetesSeleccionados: evento.paquetesSeleccionados,
      personalEvento: evento.personalEvento,
      contrato: {
        nombreCompleto: localContratoNombre || undefined,
        dni: localContratoDni || undefined,
        telefono: localContratoTelefono || undefined,
        email: localContratoEmail || undefined,
        direccion: localContratoDireccion || undefined,
        fechaNacimiento: localContratoFechaNac || undefined,
      },
      planDeCuotas: localMontoTotal > 0 ? (() => {
        const modalidad = localModalidadPago
        const cuotasEfectivas = modalidad === "completo" ? 1 : localNumeroCuotas
        // Reglas de negocio (aplican tanto a "Seña + Cuotas" como a "Solo Cuotas"):
        // el saldo en cuotas es UNA de dos -> recargo por financiación (fijas) O ajuste por IPC.
        // Cuando se elige IPC, el recargo queda en 0. Pago completo nunca lleva ninguno.
        const usaIPC = modalidad !== "completo" && cuotasEfectivas > 1 && localAjustaPorIPC
        const recargoEfectivo = (modalidad !== "completo" && !usaIPC) ? localPorcentajeRecargo : 0
        const montoFinanciado = modalidad === "sena" 
          ? Math.max(0, localMontoTotal - localMontoSena) 
          : localMontoTotal
        const montoConRecargo = montoFinanciado * (1 + recargoEfectivo / 100)
        const montoCuotaCalc = cuotasEfectivas > 0 ? Math.round((montoConRecargo / cuotasEfectivas) * 100) / 100 : 0
        const cuotasPagadasPrev = evento.planDeCuotas?.cuotasPagadas || []

        // Generar el detalle de cuotas con fechas de vencimiento.
        // Esto es lo que consumen las cajas (caja_eventos / caja_jazmines) para
        // proyectar ingresos: cada cuota se divide 50/50 entre ambas cajas.
        const [planYear, planMonth, planDay] = (localFechaInicioPlan || new Date().toISOString().split("T")[0])
          .split("-")
          .map(Number)
        const diaVenc = localDiaVencimiento || 10
        const cuotasDetalle: NonNullable<EventoGuardado["planDeCuotas"]>["cuotas"] = []

        // La seña NO es una cuota: se cobra al firmar el contrato y se registra
        // como movimiento real en las cajas. La "Fecha Primera Cuota" indica el mes
        // de la cuota 1 (cuota 1 = mes de la fecha de inicio), igual que en la
        // previsualizacion del contrato. Cada cuota suma (numero - 1) meses.
        for (let i = 0; i < cuotasEfectivas; i++) {
          const numeroCuota = i + 1
          const mesVenc = (planMonth - 1) + (numeroCuota - 1)
          const añoVenc = planYear + Math.floor(mesVenc / 12)
          const mesAjustado = ((mesVenc % 12) + 12) % 12
          const ultimoDia = new Date(añoVenc, mesAjustado + 1, 0).getDate()
          const diaAjustado = Math.min(diaVenc, ultimoDia)
          const fechaCuota = new Date(añoVenc, mesAjustado, diaAjustado)
          cuotasDetalle.push({
            numero: numeroCuota,
            montoCuota: montoCuotaCalc,
            fechaVencimiento: fechaCuota.toISOString().split("T")[0],
            pagada: cuotasPagadasPrev.includes(numeroCuota),
          })
        }

        return {
          numeroCuotas: cuotasEfectivas,
          montoCuota: montoCuotaCalc,
          montoTotal: localMontoTotal,
          diaVencimiento: diaVenc,
          fechaInicioPlan: localFechaInicioPlan || "",
          cuotasPagadas: cuotasPagadasPrev,
          modalidadPago: modalidad,
          montoSena: modalidad === "sena" ? localMontoSena : undefined,
          porcentajeRecargo: recargoEfectivo > 0 ? recargoEfectivo : undefined,
          // IPC solo cuando corresponde (Seña+Cuotas siempre; Solo Cuotas si se eligió IPC)
          ajustaPorIPC: usaIPC,
          cuotas: cuotasDetalle,
        }
      })() : undefined,
      // Legacy fields for backwards compatibility with calendario-pagos
      planCuotas: localMontoTotal > 0 && localNumeroCuotas > 0 ? localNumeroCuotas : undefined,
      montoTotalPlan: localMontoTotal > 0 ? localMontoTotal : undefined,
      costoInsumos: costoInsumosCalc,
      costoServicios: costoServicios,
      costoOperativo: costoOperativo,
      precioVenta: (evento.salon && evento.fecha) ? (getPrecioVenta(preciosVenta, evento.salon, evento.fecha) || undefined) : undefined,
    }
    
    if (isEditing && editingEventoId) {
      // When coming from contratos: auto-create a new VersionContrato snapshot
      let versionesContrato = evento?.versionesContrato || []
      if (fromContratos) {
        const serviciosIds = (eventData.servicios || []).map((se: ServicioEvento) => se.servicioId).filter(Boolean) as string[]
        const versionAnterior =
          versionesContrato.length > 0
            ? versionesContrato.reduce((a, b) => (a.version >= b.version ? a : b))
            : undefined
        const snapshotBase = {
          motivo: observacionContrato.trim() || undefined,
          snapshotContrato: {
            nombreCompleto: eventData.contrato?.nombreCompleto,
            dni: eventData.contrato?.dni,
            telefono: eventData.contrato?.telefono,
            direccion: eventData.contrato?.direccion,
            email: eventData.contrato?.email,
            condicionIVA: eventData.condicionIVA,
          },
          snapshotServicios: serviciosIds,
          snapshotServiciosLibres: eventData.serviciosLibresContrato || [],
          snapshotPlanCuotas: eventData.planDeCuotas,
          snapshotMenu: {
            recetasAdultos: eventData.recetasAdultos || [],
            recetasAdolescentes: eventData.recetasAdolescentes || [],
            recetasNinos: eventData.recetasNinos || [],
            recetasDietasEspeciales: eventData.recetasDietasEspeciales || [],
          },
          snapshotBarras: eventData.barras || [],
          snapshotInvitados: {
            adultos: eventData.adultos || 0,
            adolescentes: eventData.adolescentes || 0,
            ninos: eventData.ninos || 0,
            dietasEspeciales: eventData.personasDietasEspeciales || 0,
          },
        }
        const nuevaVersion: VersionContrato = {
          version: (versionesContrato.length > 0 ? Math.max(...versionesContrato.map((v) => v.version)) : 0) + 1,
          fechaGuardado: new Date().toISOString(),
          ...snapshotBase,
          impactos: detectarImpactosContrato(versionAnterior, snapshotBase),
        }
        versionesContrato = [...versionesContrato, nuevaVersion]
      }

      // Actualizar evento existente — await para garantizar persistencia antes de navegar
      await updateEvento(editingEventoId, {
        ...eventData,
        ...(fromContratos ? { versionesContrato } : {}),
      })
      toast({
        title: fromContratos ? "Contrato actualizado" : "Evento actualizado",
        description: fromContratos
          ? `Version ${versionesContrato.length} guardada correctamente`
          : "Los cambios se guardaron correctamente",
      })
      setIsSaving(false)
      if (fromContratos) {
        router.push(`/eventos/contratos?eventoId=${editingEventoId}`)
      } else {
        router.push("/eventos/lista")
      }
    } else {
      // Crear nuevo evento — garantizar un id estable para asociar contrato y movimientos
      const nuevoEventoId = eventData.id || generateId()

      // 1) Generar automaticamente la PRIMERA version del contrato
      const serviciosIds = (eventData.servicios || []).map((se: any) => se.servicioId).filter(Boolean) as string[]
      const primeraVersion: VersionContrato = {
        version: 1,
        fechaGuardado: new Date().toISOString(),
        motivo: "Contrato inicial generado desde el planificador",
        snapshotContrato: {
          nombreCompleto: eventData.contrato?.nombreCompleto,
          dni: eventData.contrato?.dni,
          telefono: eventData.contrato?.telefono,
          direccion: eventData.contrato?.direccion,
          email: eventData.contrato?.email,
          condicionIVA: eventData.condicionIVA,
        },
        snapshotServicios: serviciosIds,
        snapshotServiciosLibres: eventData.serviciosLibresContrato || [],
        snapshotPlanCuotas: eventData.planDeCuotas,
        snapshotMenu: {
          recetasAdultos: eventData.recetasAdultos || [],
          recetasAdolescentes: eventData.recetasAdolescentes || [],
          recetasNinos: eventData.recetasNinos || [],
          recetasDietasEspeciales: eventData.recetasDietasEspeciales || [],
        },
        snapshotBarras: eventData.barras || [],
        snapshotInvitados: {
          adultos: eventData.adultos || 0,
          adolescentes: eventData.adolescentes || 0,
          ninos: eventData.ninos || 0,
          dietasEspeciales: eventData.personasDietasEspeciales || 0,
        },
        impactos: ["sin_cambios"],
      }

      await addEvento({
        ...eventData,
        id: nuevoEventoId,
        estado: "pendiente",
        versionesContrato: [primeraVersion],
      } as any)

      // 2) Registrar automaticamente la seña en las cajas (50/50 entre Caja Eventos y Caja Jazmines)
      if (localModalidadPago === "sena" && localMontoSena > 0 && eventData.salon) {
        const nombreEvento = eventData.nombrePareja || eventData.nombre || "Evento"

        // Aporte a admin / saldo de la caja del salon (segun configuracion)
        const movimientosSalon = generarMovimientoIngreso(
          eventData.salon,
          localMontoSena,
          `Seña - ${nombreEvento}`,
          configuracionCajas,
          movimientosCaja,
          nuevoEventoId,
        )

        const mitad = Math.round((localMontoSena / 2) * 100) / 100
        const fecha = new Date().toISOString()

        const saldoPrevEventos = (movimientosCaja || [])
          .filter((m: MovimientoCaja) => m.cajaDestino === "caja_eventos" && m.salon === eventData.salon)
          .reduce((sum: number, m: MovimientoCaja) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto), 0)
        const saldoPrevJazmines = (movimientosCaja || [])
          .filter((m: MovimientoCaja) => m.cajaDestino === "caja_jazmines")
          .reduce((sum: number, m: MovimientoCaja) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto), 0)

        const movEventos: MovimientoCaja = {
          id: generateId(),
          fecha,
          tipo: "ingreso",
          concepto: `Seña - ${nombreEvento} (Caja Eventos)`,
          monto: mitad,
          salon: eventData.salon,
          eventoId: nuevoEventoId,
          cajaDestino: "caja_eventos",
          saldoResultante: saldoPrevEventos + mitad,
        }
        const movJazmines: MovimientoCaja = {
          id: generateId(),
          fecha,
          tipo: "ingreso",
          concepto: `Seña - ${nombreEvento} (Caja Jazmines)`,
          monto: mitad,
          salon: eventData.salon,
          eventoId: nuevoEventoId,
          cajaDestino: "caja_jazmines",
          saldoResultante: saldoPrevJazmines + mitad,
        }

        await addMovimientosCaja([...movimientosSalon, movEventos, movJazmines])
      }

      // Log activity
      fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "evento", accion: "planificado", nombre: eventData.nombrePareja || eventData.nombre || "Evento sin nombre" }),
      }).catch(() => {})
      setIsSaving(false)
      // Mostrar animación de éxito durante 3s y luego navegar
      setShowSaveSuccess(true)
      setTimeout(() => {
        // Navegar primero, limpiar estado después para evitar re-render con evento=null
        router.push("/eventos/lista")
        setTimeout(() => {
          setShowSaveSuccess(false)
          setEventoActual(null)
        }, 300)
      }, 3000)
    }
  }

  // BUTTON 2: Close Event (Deducts stock, saves history, resets)
  const handleCloseEvent = () => {
    // 1. Deduct calculated amounts from Kitchen Inventory
    compras.forEach((compra) => {
      const insumo = state.insumos.find((i) => i.id === compra.insumoId)
      if (insumo) {
        const newStock = Math.max(0, insumo.stockActual - compra.cantidadNecesaria)
        updateInsumo(insumo.id, { stockActual: newStock })
      }
    })

    // 1b. Deduct bar stock
    comprasBarras.forEach((compra) => {
      const insumo = state.insumosBarra.find((i) => i.id === compra.insumoBarraId)
      if (insumo) {
        const newStock = Math.max(0, insumo.stockActual - compra.cantidadNecesaria)
        updateInsumoBarra(insumo.id, { stockActual: newStock })
      }
    })

    // 2. Save COMPLETE Snapshot to History (includes all data needed to reprint exact PDF)
    const historialEntry: EventoHistorial = {
      id: generateId(),
      eventoId: evento.id,
      nombre: evento.nombrePareja || evento.nombre || "Evento sin nombre",
      fecha: evento.fecha,
      totalPersonas,
      costoTotal: costoTotalMateriaPrima,
      fechaCierre: new Date().toISOString(),
      snapshot: JSON.stringify({
        evento,
        compras,
        comprasBarras,
        recetas: {
          adultos: recetasAdultosSeleccionadas,
          adolescentes: recetasAdolescentesSeleccionadas,
          ninos: recetasNinosSeleccionadas,
          dietasEspeciales: recetasDietasEspecialesSeleccionadas,
        },
        insumos: state.insumos,
        insumosBarra: state.insumosBarra,
        cocteles: state.cocteles,
      }),
    }
    addEventoHistorial(historialEntry)
    // Log closure
    fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "evento", accion: "eliminado", nombre: historialEntry.nombre, detalle: "Evento cerrado y descontado del stock" }),
    }).catch(() => {})

    // 2b. If this event exists in the calendar, mark it as completado
    const calendarEvento = (state.eventos || []).find((e) => e.id === evento.id)
    if (calendarEvento) {
      updateEvento(evento.id, { estado: "completado" })
    }

    // 3. HARD RESET: Clear form and navigate home
    setEventoActual(null)
    setShowCloseDialog(false)
    router.push("/")
  }

  const DishCard = useMemo(
    () =>
      ({
        receta,
        segment,
        multipliers,
      }: {
        receta: (typeof state.recetas)[0]
        segment: "adultos" | "adolescentes" | "ninos" | "dietasEspeciales"
        multipliers: Record<string, number>
      }) => {
        const currentMultiplier = multipliers[receta.id] || 1

        return (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40">
            <span className="truncate font-medium text-sm">{receta.nombre}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-transparent"
                onClick={() => updateMultiplier(segment, receta.id, currentMultiplier - 0.5)}
                disabled={currentMultiplier <= 0.5}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-8 text-center text-sm font-bold">
                {currentMultiplier % 1 === 0 ? currentMultiplier : currentMultiplier.toFixed(1)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-transparent"
                onClick={() => updateMultiplier(segment, receta.id, currentMultiplier + 0.5)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground">u/p</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 ml-1 text-muted-foreground hover:text-destructive"
                onClick={() => removeRecetaFromSegment(segment, receta.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )
      },
    [updateMultiplier, removeRecetaFromSegment]
  )

  const SectionCard = useMemo(
    () =>
      ({
        sectionKey,
        icon,
        title,
        subtitle,
        badge,
        children,
        locked,
        proximamente,
      }: {
        sectionKey: string
        icon: React.ReactNode
        title: string
        subtitle?: string
        badge?: React.ReactNode
        children: React.ReactNode
        locked?: boolean
        proximamente?: boolean
      }) => {
        const isOpen = openSections[sectionKey] ?? false
        if (proximamente) {
          return (
            <div className="rounded-xl border border-border/40 bg-muted/60 overflow-hidden opacity-75">
              <div className="flex w-full items-center gap-4 px-5 py-4 cursor-not-allowed">
                <div className="shrink-0 opacity-50">{icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-muted-foreground truncate">{title}</h2>
                    <span className="text-[11px] font-medium text-emerald-600/80 tracking-wide">proximamente</span>
                  </div>
                </div>
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </div>
            </div>
          )
        }
        if (locked) {
          return (
            <div className="rounded-xl border border-border bg-card overflow-hidden opacity-60">
              <div className="flex w-full items-center gap-4 px-5 py-4 cursor-not-allowed">
                <div className="shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-card-foreground truncate">{title}</h2>
                  </div>
                  {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
                </div>
                <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
              </div>
            </div>
          )
        }
        return (
          <Collapsible open={isOpen} onOpenChange={() => toggleSection(sectionKey)}>
            <div className="rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-md">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold text-card-foreground truncate">{title}</h2>
                      {badge}
                    </div>
                    {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border px-5 py-5 overflow-hidden">{children}</div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )
      },
    [openSections, toggleSection]
  )

  // Early return AFTER all hooks to comply with React rules of hooks
  if (!evento) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-4xl flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-xl font-semibold">Planificador de Evento</h1>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ChefHat className="mb-4 h-16 w-16 text-muted-foreground" />
            <h1 className="mb-2 text-2xl font-bold">No hay evento activo</h1>
            <p className="mb-6 text-lg text-muted-foreground">
              Vuelve al inicio para planificar una nueva fiesta
            </p>
            <Link href="/">
              <Button size="lg" className="h-14 text-lg px-8">
                Volver al Inicio
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // Derived values that depend on evento (safe to compute after the early return)
  const recetasAdultos = evento.recetasAdultos || []
  const recetasAdolescentes = evento.recetasAdolescentes || []
  const recetasNinos = evento.recetasNinos || []
  const recetasDietasEspeciales = evento.recetasDietasEspeciales || []
  const multipliersAdultos = evento.multipliersAdultos || {}
  const multipliersAdolescentes = evento.multipliersAdolescentes || {}
  const multipliersNinos = evento.multipliersNinos || {}
  const multipliersDietasEspeciales = evento.multipliersDietasEspeciales || {}

  const recetasAdultosSeleccionadas = state.recetas.filter((r) => recetasAdultos.includes(r.id))
  const recetasAdolescentesSeleccionadas = state.recetas.filter((r) => recetasAdolescentes.includes(r.id))
  const recetasNinosSeleccionadas = state.recetas.filter((r) => recetasNinos.includes(r.id))
  const recetasDietasEspecialesSeleccionadas = state.recetas.filter((r) => recetasDietasEspeciales.includes(r.id))

  const totalPersonas = evento.adultos + evento.adolescentes + evento.ninos + (evento.personasDietasEspeciales || 0)

  const compras = calcularComprasSegmentadas(evento, state.recetas, state.insumos)
  const comprasBarras = calcularComprasBarras(evento, state.cocteles, state.insumosBarra)
  const costoTotalMateriaPrima = compras.reduce((sum, c) => sum + c.costoMateriaPrima, 0) + comprasBarras.reduce((sum, c) => sum + c.costoMateriaPrima, 0)
  const presupuestoCompra = compras.reduce((sum, c) => sum + c.costoEstimado, 0) + comprasBarras.reduce((sum, c) => sum + c.costoEstimado, 0)
  const serviciosEvento = evento.servicios || []
  const costoServicios = costoPaquetesOficial > 0 ? costoPaquetesOficial : calcularCostoServicios(serviciosEvento, state)
  const costoOperativo = calcularCostosOperativos(evento, costosOperativos || [])

  const barras = evento.barras || []
  const existsInCalendar = (state.eventos || []).some((e) => e.id === evento.id)

  // Bloqueo de campos criticos cuando el stock ya fue comprometido
  const esBloqueado = !!(
    evento.stockDescontado ||
    evento.estado === "en_preparacion" ||
    evento.estado === "completado"
  )
  const esSoloLectura = evento.estado === "completado"

  // Handlers that depend on derived values (must be after early return)
  // Selección de cocteles por click (estilo tabla de menú).
  // Se mantiene una única "barra" implícita para conservar la compatibilidad
  // con calcularComprasBarras (que necesita tragosPorPersona).
  const coctelesEventoSeleccionados = barras[0]?.coctelesIncluidos || []

  const toggleCoctelEvento = (coctelId: string) => {
    const barraActual = barras[0]
    const seleccionados = barraActual?.coctelesIncluidos || []
    const nuevos = seleccionados.includes(coctelId)
      ? seleccionados.filter((id) => id !== coctelId)
      : [...seleccionados, coctelId]

    if (nuevos.length === 0) {
      // Sin cocteles: limpiar las barras del evento
      updateEventoActual({ barras: [] })
      return
    }

    const barraActualizada: BarraEvento = {
      id: barraActual?.id || generateId(),
      barraTemplateId: barraActual?.barraTemplateId || "",
      coctelesIncluidos: nuevos,
      tragosPorPersona: barraActual?.tragosPorPersona ?? 2,
    }
    updateEventoActual({ barras: [barraActualizada] })
  }

  // ==================== PERSONAL DEL EVENTO ====================
  // Roster activo cargado en Finanzas → Personal
  const personalActivoRoster = (personal || []).filter((p) => p.activo)
  const personalDelEvento = evento.personalEvento || []
  const totalSueldosEvento = personalDelEvento.reduce((sum, pe) => sum + (pe.monto || 0), 0)

  const togglePersonalEvento = (personalId: string) => {
    const existente = personalDelEvento.find((pe) => pe.personalId === personalId)
    if (existente) {
      updateEventoActual({
        personalEvento: personalDelEvento.filter((pe) => pe.personalId !== personalId),
      })
      return
    }
    const persona = personalActivoRoster.find((p) => p.id === personalId)
    if (!persona) return
    const nuevaEntrada: PersonalDelEvento = {
      id: generateId(),
      personalId: persona.id,
      nombre: `${persona.nombre} ${persona.apellido}`.trim(),
      funcion: persona.funcion,
      monto: persona.tarifaBase || 0,
    }
    updateEventoActual({ personalEvento: [...personalDelEvento, nuevaEntrada] })
  }

  const updateMontoPersonalEvento = (personalId: string, monto: number) => {
    updateEventoActual({
      personalEvento: personalDelEvento.map((pe) =>
        pe.personalId === personalId ? { ...pe, monto } : pe
      ),
    })
  }

  // Service handlers removed - now using package selection

  return (
    <div className="min-h-screen bg-background">

      {/* Overlay animación guardado exitoso */}
      {showSaveSuccess && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center pointer-events-none"
          style={{ animation: "fadeInOutEvento 3s ease forwards" }}
        >
          <div
            className="flex flex-col items-center gap-4"
            style={{ animation: "scaleInEvento 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
          >
            <div className="rounded-full bg-emerald-500 p-6 shadow-2xl shadow-emerald-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
            <p className="text-2xl font-semibold text-emerald-700 drop-shadow-sm">Evento guardado</p>
            <p className="text-sm text-emerald-600/80">Redirigiendo a lista de eventos...</p>
          </div>
          <style>{`
            @keyframes fadeInOutEvento {
              0%   { opacity: 0; background: rgba(236,253,245,0); }
              15%  { opacity: 1; background: rgba(236,253,245,0.75); }
              80%  { opacity: 1; background: rgba(236,253,245,0.75); }
              100% { opacity: 0; background: rgba(236,253,245,0); }
            }
            @keyframes scaleInEvento {
              0%   { transform: scale(0.5); opacity: 0; }
              100% { transform: scale(1);   opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 sm:px-6 sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex items-center gap-3">
          {isEditing ? (
            <Link href="/eventos/lista" className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleNavigateAway}
              className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">Planificador de Evento</h1>
            {evento.nombrePareja && (
              <p className="text-sm text-muted-foreground truncate">{evento.nombrePareja}</p>
            )}
          </div>
          {existsInCalendar && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs shrink-0">
              <CalendarIcon className="h-3 w-3 mr-1" />
              Calendario
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">

        {/* Banner de bloqueo por stock comprometido */}
        {esSoloLectura && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3">
            <Lock className="h-5 w-5 shrink-0 text-slate-600 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800 text-sm">COMPLETADO — Solo lectura</p>
              <p className="text-xs text-slate-600 mt-0.5">Este evento esta completado. Solo podés ver e imprimir el documento.</p>
            </div>
          </div>
        )}
        {!esSoloLectura && esBloqueado && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">
                Este evento tiene stock comprometido
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Para modificar recetas o personas, primero volve el evento a &quot;Pendiente&quot; desde la Lista de Eventos para recuperar el stock.
                {evento.fechaImpresion && (
                  <span className="block mt-1">
                    Impreso el {new Date(evento.fechaImpresion).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} — la hoja impresa puede quedar desactualizada si editás este evento.
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Collapsible sections */}
        <div className="space-y-4 mb-8">

        <SectionCard
          sectionKey="detalles"
          icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10"><CalendarIcon className="h-5 w-5 text-emerald-700" /></div>}
          title="Detalles del Evento"
          subtitle={evento.tipoEvento ? `${evento.tipoEvento}${evento.nombrePareja ? ` - ${evento.nombrePareja}` : ""}` : "Configura la fecha, salon y comensales"}
          className="bg-emerald-50/60 border-emerald-100"
        >
          <div className="space-y-5">

            {/* Fila 1: Tipo de Evento + Nombre Festejados */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tipoEvento" className="text-sm font-medium">Tipo de Evento</Label>
                <Select
                  value={evento.tipoEvento || ""}
                  onValueChange={(value) => updateEventoActual({ tipoEvento: value as any })}
                >
                  <SelectTrigger id="tipoEvento" className="h-11 text-base">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Casamiento">Casamiento</SelectItem>
                    <SelectItem value="Cumpleanos de 15">Cumpleanos de 15</SelectItem>
                    <SelectItem value="Empresarial">Empresarial</SelectItem>
                    <SelectItem value="Cumpleanos">Cumpleanos</SelectItem>
                    <SelectItem value="Bautismo">Bautismo</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombrePareja" className="text-sm font-medium">Nombre de los Festejados</Label>
                <Input
                  id="nombrePareja"
                  type="text"
                  placeholder="Ej: Juan y Maria"
                  value={localNombrePareja}
                  onChange={(e) => setLocalNombrePareja(e.target.value)}
                  onBlur={() => handleBlur("nombrePareja", localNombrePareja)}
                  className="h-11 text-base"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Fila 2: Fecha + Horario + Hora Fin */}
            <div className="grid gap-4 grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="fecha" className="flex items-center gap-1.5 text-sm font-medium">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  Fecha
                </Label>
                <Input
                  id="fecha"
                  type="date"
                  value={localFecha}
                  onChange={(e) => setLocalFecha(e.target.value)}
                  onBlur={() => handleBlur("fecha", localFecha)}
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horario" className="flex items-center gap-1.5 text-sm font-medium">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Hora inicio
                </Label>
                <Input
                  id="horario"
                  type="time"
                  value={localHorario}
                  onChange={(e) => {
                    const val = e.target.value
                    setLocalHorario(val)
                    // Auto-rellenar hora fin sumando 8 horas solo si fin esta vacio
                    if (val && !localHorarioFin) {
                      const [h, m] = val.split(":").map(Number)
                      const finStr = `${String((h + 8) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`
                      setLocalHorarioFin(finStr)
                      handleBlur("horarioFin", finStr)
                    }
                  }}
                  onBlur={() => handleBlur("horario", localHorario)}
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horarioFin" className="flex items-center gap-1.5 text-sm font-medium">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Hora fin
                </Label>
                <Input
                  id="horarioFin"
                  type="time"
                  value={localHorarioFin}
                  onChange={(e) => setLocalHorarioFin(e.target.value)}
                  onBlur={() => handleBlur("horarioFin", localHorarioFin)}
                  className="h-11 text-base"
                />
              </div>
            </div>

            {/* Fila 3: Salon (toggle buttons) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Salon
              </Label>
              <div className="flex gap-2">
                {SALONES.map((s) => {
                  const active = evento.salon === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateEventoActual({ salon: s, paquetesSeleccionados: [], servicios: [] })}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        active
                          ? "border-[#2d5a3d] bg-[#2d5a3d] text-white"
                          : "border-[#2d5a3d] bg-white text-[#2d5a3d] hover:bg-emerald-50"
                      }`}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Precio de Venta */}
            {evento.fecha && evento.salon && (() => {
              const precioVenta = getPrecioVenta(preciosVenta, evento.salon, evento.fecha)
              return precioVenta !== null ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                  <DollarSign className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">
                      Precio de venta: {formatCurrency(precioVenta)}
                    </p>
                    <p className="text-xs text-emerald-600">
                      Definido en Finanzas para {evento.salon} el {evento.fecha}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      No hay precio definido para {evento.salon} el {evento.fecha}
                    </p>
                    <p className="text-xs text-amber-600">
                      Configura los precios desde Finanzas &gt; Precios
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Fila 4: Comensales — 4 columnas en una sola fila */}
            <div className="space-y-3 rounded-lg border border-emerald-100 bg-white/70 p-4">
              <h4 className="font-semibold text-base text-foreground">Comensales</h4>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="adultos" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Users className="h-3.5 w-3.5" />
                    Adultos
                  </Label>
                  <Input
                    id="adultos"
                    type="number"
                    value={localAdultos}
                    onChange={(e) => setLocalAdultos(e.target.value)}
                    onBlur={() => handleBlur("adultos", Number.parseInt(localAdultos) || 0)}
                    className="h-11 text-center text-lg font-semibold"
                    min={0}
                    disabled={esBloqueado}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adolescentes" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <UserCheck className="h-3.5 w-3.5" />
                    Adolescentes
                  </Label>
                  <Input
                    id="adolescentes"
                    type="number"
                    value={localAdolescentes}
                    onChange={(e) => setLocalAdolescentes(e.target.value)}
                    onBlur={() => handleBlur("adolescentes", Number.parseInt(localAdolescentes) || 0)}
                    className="h-11 text-center text-lg font-semibold"
                    min={0}
                    disabled={esBloqueado}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ninos" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Baby className="h-3.5 w-3.5" />
                    Ninos
                  </Label>
                  <Input
                    id="ninos"
                    type="number"
                    value={localNinos}
                    onChange={(e) => setLocalNinos(e.target.value)}
                    onBlur={() => handleBlur("ninos", Number.parseInt(localNinos) || 0)}
                    className="h-11 text-center text-lg font-semibold"
                    min={0}
                    disabled={esBloqueado}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dietasEspeciales" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Heart className="h-3.5 w-3.5" />
                    Dietas Esp.
                  </Label>
                  <Input
                    id="dietasEspeciales"
                    type="number"
                    value={localDietasEspeciales}
                    onChange={(e) => setLocalDietasEspeciales(e.target.value)}
                    onBlur={() => handleBlur("personasDietasEspeciales", Number.parseInt(localDietasEspeciales) || 0)}
                    className="h-11 text-center text-lg font-semibold"
                    min={0}
                    disabled={esBloqueado}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-secondary p-3 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-base">Total personas:</span>
                  <span className="text-2xl font-bold">{totalPersonas}</span>
                </div>
              </div>
            </div>
          </div>

        </SectionCard>

        <SectionCard
          sectionKey="menu"
          icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10"><UtensilsCrossed className="h-5 w-5 text-orange-600" /></div>}
          title="Menu del Evento"
          subtitle={`${recetasAdultosSeleccionadas.length + recetasAdolescentesSeleccionadas.length + recetasNinosSeleccionadas.length + recetasDietasEspecialesSeleccionadas.length} platos seleccionados`}
          badge={
            (recetasAdultosSeleccionadas.length + recetasAdolescentesSeleccionadas.length + recetasNinosSeleccionadas.length + recetasDietasEspecialesSeleccionadas.length) > 0 ? (
              <Badge variant="secondary" className="text-xs">{recetasAdultosSeleccionadas.length + recetasAdolescentesSeleccionadas.length + recetasNinosSeleccionadas.length + recetasDietasEspecialesSeleccionadas.length} platos</Badge>
            ) : undefined
          }
          locked={esBloqueado}
        >
          <MenuTable
            recetas={state.recetas}
            recetasAdultos={recetasAdultos}
            recetasAdolescentes={recetasAdolescentes}
            recetasNinos={recetasNinos}
            recetasDietasEspeciales={recetasDietasEspeciales}
            multipliersAdultos={multipliersAdultos}
            multipliersAdolescentes={multipliersAdolescentes}
            multipliersNinos={multipliersNinos}
            multipliersDietasEspeciales={multipliersDietasEspeciales}
            adultos={evento.adultos}
            adolescentes={evento.adolescentes}
            ninos={evento.ninos}
            personasDietasEspeciales={evento.personasDietasEspeciales || 0}
            esBloqueado={esBloqueado}
            onToggle={(recetaId, segment) => {
              const isSelected = {
                adultos: recetasAdultos,
                adolescentes: recetasAdolescentes,
                ninos: recetasNinos,
                dietasEspeciales: recetasDietasEspeciales,
              }[segment].includes(recetaId)
              if (isSelected) {
                removeRecetaFromSegment(segment, recetaId)
              } else {
                addRecetaToSegment(segment, recetaId)
              }
            }}
            onMultiplierChange={(recetaId, segment, value) => updateMultiplier(segment, recetaId, value)}
          />
        </SectionCard>

        {/* ==================== BAR SECTION ==================== */}
        <SectionCard
          sectionKey="barras"
          icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10"><Wine className="h-5 w-5 text-violet-600" /></div>}
          title="Barra del Evento"
          subtitle={coctelesEventoSeleccionados.length > 0 ? `${coctelesEventoSeleccionados.length} coctel${coctelesEventoSeleccionados.length > 1 ? "es" : ""} seleccionado${coctelesEventoSeleccionados.length > 1 ? "s" : ""}` : "Selecciona los cocteles para este evento"}
          badge={coctelesEventoSeleccionados.length > 0 ? <Badge variant="secondary" className="text-xs">{coctelesEventoSeleccionados.length} coctel{coctelesEventoSeleccionados.length > 1 ? "es" : ""}</Badge> : undefined}
          locked={esBloqueado}
        >
          <CoctelTable
            cocteles={state.cocteles}
            coctelesSeleccionados={coctelesEventoSeleccionados}
            esBloqueado={esBloqueado}
            onToggle={toggleCoctelEvento}
          />
        </SectionCard>

        {/* ==================== PERSONAL DEL EVENTO ==================== */}
        <SectionCard
          sectionKey="personal"
          icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10"><Users className="h-5 w-5 text-sky-600" /></div>}
          title="Personal del Evento"
          subtitle={
            personalDelEvento.length > 0
              ? `${personalDelEvento.length} persona${personalDelEvento.length > 1 ? "s" : ""} · ${formatCurrency(totalSueldosEvento)} en sueldos`
              : "Selecciona el personal que trabajara este evento"
          }
          badge={
            personalDelEvento.length > 0 ? (
              <Badge variant="secondary" className="text-xs">{formatCurrency(totalSueldosEvento)}</Badge>
            ) : undefined
          }
          locked={esBloqueado}
        >
          {personalActivoRoster.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg">
              <Users className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No hay personal registrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ve a Finanzas → Personal para agregar coordinadores, mozos, barman, etc.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/finanzas/personal">Ir a Personal</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/70 border-b border-border">
                      <th className="w-10 px-3 py-2" />
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Funcion</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-sky-700 uppercase tracking-wide">Sueldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personalActivoRoster.map((persona, idx) => {
                      const entrada = personalDelEvento.find((pe) => pe.personalId === persona.id)
                      const seleccionado = !!entrada
                      return (
                        <tr
                          key={persona.id}
                          className={`${idx % 2 === 1 ? "bg-muted/30" : ""} ${seleccionado ? "bg-sky-50/60" : ""} border-b border-border last:border-0`}
                        >
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={seleccionado}
                              disabled={esBloqueado}
                              onCheckedChange={() => togglePersonalEvento(persona.id)}
                              aria-label={`Incluir a ${persona.nombre} ${persona.apellido}`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium">{persona.nombre} {persona.apellido}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">{persona.funcion}</p>
                          </td>
                          <td className="px-3 py-2 hidden sm:table-cell">
                            <Badge variant="outline" className="text-xs">{persona.funcion}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {seleccionado ? (
                              <MoneyInput
                                value={entrada.monto}
                                onValueChange={(v) => updateMontoPersonalEvento(persona.id, v)}
                                disabled={esBloqueado}
                                className="ml-auto h-8 w-32 text-right"
                              />
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                {persona.tarifaBase > 0 ? formatCurrency(persona.tarifaBase) : "-"}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {personalDelEvento.length > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-sky-50 border border-sky-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-sky-900">Total sueldos del evento</p>
                    <p className="text-xs text-sky-700">
                      Impacta en Caja Eventos como sueldos a pagar, con vencimiento el dia del evento
                    </p>
                  </div>
                  <p className="text-lg font-bold text-sky-900">{formatCurrency(totalSueldosEvento)}</p>
                </div>
              )}
            </div>
          )}
        </SectionCard>



        {/* ==================== SERVICIOS DEL EVENTO ==================== */}
        <SectionCard
          sectionKey="servicios-evento"
          icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10"><Briefcase className="h-5 w-5 text-emerald-600" /></div>}
          title="Servicios del Evento"
          subtitle={serviciosEvento.length > 0 ? `${serviciosEvento.length} servicio${serviciosEvento.length > 1 ? "s" : ""} agregado${serviciosEvento.length > 1 ? "s" : ""}` : "Agrega servicios al evento"}
        >
          {/* Tabla multiplechoice de servicios */}
          {catalogoServicios.filter(s => s.activo).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg">
              <Briefcase className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No hay servicios en el catalogo</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ve a Finanzas → Servicios para agregar servicios
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/70 border-b border-border">
                    <th className="w-10 px-3 py-2" />
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Servicio</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Categoria</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-emerald-700 uppercase tracking-wide">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogoServicios.filter(s => s.activo).map((servicio, idx) => {
                    const seleccionado = serviciosEvento.some(se => se.servicioId === servicio.id)
                    const precioVenta = servicio.precioVenta ?? 0
                    const costoSeña = Math.round((servicio.costoParaCajaEventos ?? 0) * (servicio.porcentajeSeña ?? 30) / 100)

                    const fmt = (n: number) =>
                      new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n)

                    const toggleServicio = () => {
                      if (seleccionado) {
                        updateEventoActual({ servicios: serviciosEvento.filter(se => se.servicioId !== servicio.id) })
                      } else {
                        const fechaEvento = evento?.fecha ? new Date(evento.fecha + "T12:00:00") : new Date()
                        const diasSaldo = servicio.diasAnticipacionSaldo ?? 7
                        const costoBase = servicio.costoParaCajaEventos ?? 0
                        const pct = servicio.porcentajeSeña ?? 30
                        const montoSeña = Math.round(costoBase * pct / 100)
                        const saldoPendiente = costoBase - montoSeña

                        const diasAnticipacion = servicio.diasAnticipacionSeña ?? 30
                        const fechaSeñaDate = new Date(fechaEvento)
                        fechaSeñaDate.setDate(fechaEvento.getDate() - diasAnticipacion)
                        const fechaSaldoDate = new Date(fechaEvento)
                        fechaSaldoDate.setDate(fechaEvento.getDate() - diasSaldo)

                        const nuevoServicio: ServicioEvento = {
                          servicioId: servicio.id,
                          nombre: servicio.nombre,
                          cantidad: 1,
                          unidad: servicio.unidad || "Fijo",
                          estadoPago: "sin_seña",
                          montoSeña,
                          saldoPendiente,
                          fechaSeña: fechaSeñaDate.toISOString().split("T")[0],
                          fechaLimitePago: fechaSaldoDate.toISOString().split("T")[0],
                        }
                        updateEventoActual({ servicios: [...serviciosEvento, nuevoServicio] })
                      }
                    }

                    const esPorHora = servicio.unidad === "Por Hora"
                    const servicioEnEvento = serviciosEvento.find(se => se.servicioId === servicio.id)
                    const horas = servicioEnEvento?.cantidad ?? 1
                    const precioTotal = esPorHora ? precioVenta * horas : precioVenta

                    const handleHoras = (e: React.ChangeEvent<HTMLInputElement>) => {
                      e.stopPropagation()
                      const nuevasHoras = Math.max(1, parseInt(e.target.value) || 1)
                      const nuevoPrecioVenta = precioVenta * nuevasHoras
                      const pct = servicio.porcentajeSeña ?? 30
                      const nuevaSeña = Math.round(nuevoPrecioVenta * pct / 100)
                      const nuevoSaldo = nuevoPrecioVenta - nuevaSeña
                      const nuevoCosto = (servicio.costoParaCajaEventos ?? 0) * nuevasHoras
                      const nuevaSeñaCosto = Math.round(nuevoCosto * pct / 100)

                      const fechaEvento = evento?.fecha ? new Date(evento.fecha + "T12:00:00") : new Date()
                      const diasSaldo = servicio.diasAnticipacionSaldo ?? 7
                      const diasAnticipacion = servicio.diasAnticipacionSeña ?? 30
                      const fechaSeñaDate = new Date(fechaEvento)
                      fechaSeñaDate.setDate(fechaEvento.getDate() - diasAnticipacion)
                      const fechaSaldoDate = new Date(fechaEvento)
                      fechaSaldoDate.setDate(fechaEvento.getDate() - diasSaldo)

                      updateEventoActual({
                        servicios: serviciosEvento.map(se =>
                          se.servicioId === servicio.id
                            ? {
                                ...se,
                                cantidad: nuevasHoras,
                                montoSeña: nuevaSeñaCosto,
                                saldoPendiente: (nuevoCosto - nuevaSeñaCosto),
                                fechaSeña: fechaSeñaDate.toISOString().split("T")[0],
                                fechaLimitePago: fechaSaldoDate.toISOString().split("T")[0],
                              }
                            : se
                        ),
                      })
                    }

                    return (
                      <tr
                        key={servicio.id}
                        onClick={toggleServicio}
                        className={`border-b border-border/50 cursor-pointer transition-colors select-none ${
                          seleccionado
                            ? "bg-emerald-50/70 hover:bg-emerald-50"
                            : idx % 2 === 0
                            ? "hover:bg-muted/40"
                            : "bg-muted/10 hover:bg-muted/40"
                        }`}
                      >
                        {/* Checkbox visual */}
                        <td className="w-10 px-3 py-2.5">
                          <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors ${
                            seleccionado
                              ? "bg-emerald-600 border-emerald-600"
                              : "border-muted-foreground/30 bg-background"
                          }`}>
                            {seleccionado && (
                              <CheckCircle className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                            )}
                          </div>
                        </td>

                        {/* Nombre + input horas si aplica */}
                        <td className="px-3 py-2.5">
                          <span className={`font-medium ${seleccionado ? "text-emerald-900" : ""}`}>
                            {servicio.nombre}
                          </span>
                          {servicio.descripcion && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{servicio.descripcion}</p>
                          )}
                          {esPorHora && seleccionado && (
                            <div
                              className="flex items-center gap-1.5 mt-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <label className="text-xs text-muted-foreground whitespace-nowrap">Horas:</label>
                              <input
                                type="number"
                                min={1}
                                value={horas}
                                onChange={handleHoras}
                                className="w-16 h-6 px-1.5 text-xs rounded border border-emerald-300 bg-white text-emerald-900 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 tabular-nums"
                              />
                              <span className="text-xs text-muted-foreground">h</span>
                            </div>
                          )}
                          {esPorHora && !seleccionado && (
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5">Por hora</p>
                          )}
                        </td>

                        {/* Categoria */}
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          <Badge variant="outline" className="text-[11px]">{servicio.categoria}</Badge>
                        </td>

                        {/* Precio venta (× horas si aplica) */}
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-700">
                          {precioTotal > 0
                            ? (
                              <span>
                                {fmt(precioTotal)}
                                {esPorHora && seleccionado && horas > 1 && (
                                  <span className="block text-[11px] font-normal text-muted-foreground">
                                    {fmt(precioVenta)}/h × {horas}
                                  </span>
                                )}
                              </span>
                            )
                            : <span className="text-muted-foreground font-normal">—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                {/* Footer: resumen seleccionados */}
                {serviciosEvento.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/60 border-t-2 border-border">
                      <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                        {serviciosEvento.length} servicio{serviciosEvento.length !== 1 ? "s" : ""} seleccionado{serviciosEvento.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs font-bold text-emerald-700">
                        {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(
                          serviciosEvento.reduce((sum, se) => {
                            const cat = catalogoServicios.find(s => s.id === se.servicioId)
                            const precio = cat?.precioVenta ?? 0
                            const horas = (cat?.unidad === "Por Hora") ? (se.cantidad ?? 1) : 1
                            return sum + precio * horas
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}


        </SectionCard>

        {/* ==================== CONTRATO SECTION ==================== */}
        <SectionCard
          sectionKey="contrato"
          icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10"><FileText className="h-5 w-5 text-sky-600" /></div>}
          title="Datos del Contrato"
          subtitle="Datos del cliente y plan de cuotas"
        >
          <Tabs defaultValue="cliente">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cliente">Datos del Cliente</TabsTrigger>
              <TabsTrigger value="cuotas">Plan de Cuotas</TabsTrigger>
            </TabsList>

            {/* TAB 1: DATOS DEL CLIENTE */}
            <TabsContent value="cliente" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contratoNombre">Nombre Completo</Label>
                  <Input
                    id="contratoNombre"
                    value={localContratoNombre}
                    onChange={(e) => setLocalContratoNombre(e.target.value)}
                    placeholder="Juan Perez"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contratoDni">DNI</Label>
                  <Input
                    id="contratoDni"
                    value={localContratoDni}
                    onChange={(e) => setLocalContratoDni(e.target.value)}
                    placeholder="12345678"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contratoTelefono" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Telefono
                  </Label>
                  <Input
                    id="contratoTelefono"
                    type="tel"
                    value={localContratoTelefono}
                    onChange={(e) => setLocalContratoTelefono(e.target.value)}
                    placeholder="+54 11 1234-5678"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contratoEmail">Email</Label>
                  <Input
                    id="contratoEmail"
                    type="email"
                    value={localContratoEmail}
                    onChange={(e) => setLocalContratoEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contratoDireccion">Direccion</Label>
                  <Input
                    id="contratoDireccion"
                    value={localContratoDireccion}
                    onChange={(e) => setLocalContratoDireccion(e.target.value)}
                    placeholder="Calle 123, Ciudad"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contratoFechaNac">Fecha de Nacimiento</Label>
                  <Input
                    id="contratoFechaNac"
                    type="date"
                    value={localContratoFechaNac}
                    onChange={(e) => setLocalContratoFechaNac(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="condicionIVA">Condicion IVA</Label>
                  <Select
                    value={localCondicionIVA}
                    onValueChange={(v) => {
                      setLocalCondicionIVA(v)
                      updateEventoActual({ condicionIVA: v as "Consumidor Final" | "Responsable Inscripto" | "Monotributista" | "Exento" })
                    }}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
                      <SelectItem value="Responsable Inscripto">Responsable Inscripto</SelectItem>
                      <SelectItem value="Monotributista">Monotributista</SelectItem>
                      <SelectItem value="Exento">Exento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: PLAN DE CUOTAS */}
            <TabsContent value="cuotas" className="space-y-5 mt-4 overflow-hidden">
              {/* --- MONTO TOTAL DEL EVENTO --- */}
              <div className="space-y-2">
                <Label htmlFor="montoTotalContrato" className="flex items-center gap-2 text-base font-semibold">
                  <DollarSign className="h-4 w-4" />
                  Monto Total del Evento
                </Label>
                <MoneyInput
                  id="montoTotalContrato"
                  value={localMontoTotal || 0}
                  onValueChange={(val) => setLocalMontoTotal(val)}
                  placeholder="Ej: 500.000"
                  className="h-12 text-lg font-mono"
                />
              </div>

              {/* --- MODALIDAD DE PAGO --- */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <CreditCard className="h-4 w-4" />
                  Modalidad de Pago
                </Label>
                <RadioGroup
                  value={localModalidadPago}
                  onValueChange={(v) => {
                    const nueva = v as "completo" | "sena" | "cuotas"
                    setLocalModalidadPago(nueva)
                    if (nueva === "completo") {
                      // Pago completo: sin cuotas, sin recargo ni IPC
                      setLocalAjustaPorIPC(false)
                      setLocalPorcentajeRecargo(0)
                    } else {
                      // Seña + Cuotas / Solo Cuotas: por defecto cuotas fijas con recargo
                      setLocalAjustaPorIPC(false)
                    }
                  }}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                >
                  <label
                    htmlFor="pago-completo"
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${localModalidadPago === "completo" ? "border-primary bg-primary/5" : "border-input hover:border-muted-foreground/30"}`}
                  >
                    <RadioGroupItem value="completo" id="pago-completo" />
                    <div>
                      <p className="font-medium text-sm">Pago Completo</p>
                      <p className="text-xs text-muted-foreground">Un solo pago</p>
                    </div>
                  </label>
                  <label
                    htmlFor="pago-sena"
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${localModalidadPago === "sena" ? "border-primary bg-primary/5" : "border-input hover:border-muted-foreground/30"}`}
                  >
                    <RadioGroupItem value="sena" id="pago-sena" />
                    <div>
                      <p className="font-medium text-sm">{"Seña + Cuotas"}</p>
                      <p className="text-xs text-muted-foreground">{"Seña inicial + saldo en cuotas"}</p>
                    </div>
                  </label>
                  <label
                    htmlFor="pago-cuotas"
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${localModalidadPago === "cuotas" ? "border-primary bg-primary/5" : "border-input hover:border-muted-foreground/30"}`}
                  >
                    <RadioGroupItem value="cuotas" id="pago-cuotas" />
                    <div>
                      <p className="font-medium text-sm">Solo Cuotas</p>
                      <p className="text-xs text-muted-foreground">Todo financiado</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {/* --- SEÑA (solo si modalidad = "sena") --- */}
              {localModalidadPago === "sena" && (
                <div className="space-y-2 p-4 rounded-lg border border-dashed border-primary/40 bg-primary/5">
                  <Label htmlFor="montoSena" className="flex items-center gap-2 font-semibold">
                    <Banknote className="h-4 w-4" />
                    {"Monto de la Seña"}
                  </Label>
                  <MoneyInput
                    id="montoSena"
                    value={localMontoSena || 0}
                    onValueChange={(val) => setLocalMontoSena(val)}
                    placeholder="Ej: 100.000"
                    className="h-11 font-mono"
                  />
                  {localMontoSena > 0 && localMontoTotal > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {"Saldo a financiar: "}<span className="font-mono font-semibold">{formatCurrency(Math.max(0, localMontoTotal - localMontoSena))}</span>
                      {" ("}{Math.round((localMontoSena / localMontoTotal) * 100)}{"% de seña)"}
                    </p>
                  )}
                </div>
              )}

              {/* --- CUOTAS Y RECARGO (solo si no es "completo") --- */}
              {localModalidadPago !== "completo" && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="numeroCuotasContrato" className="font-semibold">Cantidad de Cuotas</Label>
                      <Input
                        id="numeroCuotasContrato"
                        type="number"
                        min="1"
                        max="48"
                        value={localNumeroCuotas || ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1
                          setLocalNumeroCuotas(val)
                        }}
                        placeholder="6"
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="diaVencimientoContrato">Dia de Vencimiento</Label>
                      <Select
                        value={localDiaVencimiento.toString()}
                        onValueChange={(value) => setLocalDiaVencimiento(parseInt(value))}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Dia del mes" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 5, 10, 15, 20, 25, 30].map(dia => (
                            <SelectItem key={dia} value={dia.toString()}>
                              Dia {dia} de cada mes
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fechaInicioPlanContrato">Fecha Primera Cuota</Label>
                      <Input
                        id="fechaInicioPlanContrato"
                        type="date"
                        value={localFechaInicioPlan}
                        onChange={(e) => setLocalFechaInicioPlan(e.target.value)}
                        className="h-11"
                      />
                    </div>
                  </div>

                  {/* --- TIPO DE FINANCIACIÓN: recargo (fijas) O ajuste por IPC (una u otra) --- */}
                  {/* Aplica al saldo en cuotas tanto en "Seña + Cuotas" como en "Solo Cuotas" */}
                  {localModalidadPago !== "completo" && localNumeroCuotas > 1 && (
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2 font-semibold">
                        <TrendingUp className="h-4 w-4" />
                        {localModalidadPago === "sena" ? "Tipo de Financiación del saldo" : "Tipo de Financiación"}
                      </Label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${!localAjustaPorIPC ? "border-primary bg-primary/5" : "border-input hover:border-muted-foreground/30"}`}
                        >
                          <input
                            type="radio"
                            name="tipoFinanciacion"
                            checked={!localAjustaPorIPC}
                            onChange={() => setLocalAjustaPorIPC(false)}
                            className="mt-1"
                          />
                          <div>
                            <p className="font-medium">Cuotas fijas (recargo)</p>
                            <p className="text-xs text-muted-foreground">
                              Cuotas fijas con un porcentaje de recargo por financiación. El monto no cambia durante el plan.
                            </p>
                          </div>
                        </label>
                        <label
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${localAjustaPorIPC ? "border-primary bg-primary/5" : "border-input hover:border-muted-foreground/30"}`}
                        >
                          <input
                            type="radio"
                            name="tipoFinanciacion"
                            checked={localAjustaPorIPC}
                            onChange={() => {
                              setLocalAjustaPorIPC(true)
                              setLocalPorcentajeRecargo(0)
                            }}
                            className="mt-1"
                          />
                          <div>
                            <p className="font-medium">Ajuste por IPC</p>
                            <p className="text-xs text-muted-foreground">
                              Sin recargo. Las cuotas restantes suben cada mes según el IPC que cargues en Finanzas. Las ya pagadas no cambian.
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Recargo: solo cuando se eligió "Cuotas fijas (recargo)" */}
                      {!localAjustaPorIPC && (
                        <div className="space-y-2 p-3 rounded-lg border border-input bg-muted/30">
                          <Label htmlFor="porcentajeRecargo" className="flex items-center gap-2 font-semibold">
                            <Percent className="h-4 w-4" />
                            Recargo por Financiacion ({localPorcentajeRecargo}%)
                          </Label>
                          <div className="flex items-center gap-3">
                            <Slider
                              value={[localPorcentajeRecargo]}
                              onValueChange={(v) => setLocalPorcentajeRecargo(v[0])}
                              min={0}
                              max={50}
                              step={0.5}
                              className="flex-1"
                            />
                            <Input
                              id="porcentajeRecargo"
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={localPorcentajeRecargo || ""}
                              onChange={(e) => setLocalPorcentajeRecargo(parseFloat(e.target.value) || 0)}
                              className="h-9 w-20 font-mono text-center"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {[
                              { cuotas: "1-6", pct: 0 },
                              { cuotas: "7-10", pct: 5 },
                              { cuotas: "11-12", pct: 8 },
                              { cuotas: "13-18", pct: 12 },
                              { cuotas: "19-24", pct: 15 },
                              { cuotas: "25+", pct: 20 },
                            ].map(({ cuotas, pct }) => (
                              <button
                                type="button"
                                key={cuotas}
                                onClick={() => setLocalPorcentajeRecargo(pct)}
                                className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors cursor-pointer ${
                                  localPorcentajeRecargo === pct
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted border-input text-muted-foreground hover:bg-accent"
                                }`}
                              >
                                {cuotas}: {pct}%
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </>
              )}

              {/* --- RESUMEN FINANCIERO --- */}
              {localMontoTotal > 0 && (() => {
                const esCompleto = localModalidadPago === "completo"
                const montoSenaEfectivo = localModalidadPago === "sena" ? localMontoSena : 0
                const montoFinanciado = esCompleto ? localMontoTotal : Math.max(0, localMontoTotal - montoSenaEfectivo)
                const importeRecargo = montoFinanciado * (localPorcentajeRecargo / 100)
                const montoConRecargo = montoFinanciado + importeRecargo
                const cuotasEfectivas = esCompleto ? 1 : localNumeroCuotas
                const montoPorCuota = cuotasEfectivas > 0 ? montoConRecargo / cuotasEfectivas : 0
                const totalFinal = montoSenaEfectivo + montoConRecargo

                return (
                  <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5 space-y-3">
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Resumen Financiero
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <span className="text-muted-foreground">Precio del evento:</span>
                      <span className="font-mono text-right">{formatCurrency(localMontoTotal)}</span>

                      {localModalidadPago === "sena" && (
                        <>
                          <span className="text-muted-foreground">{"Seña:"}</span>
                          <span className="font-mono text-right text-emerald-600">- {formatCurrency(montoSenaEfectivo)}</span>
                        </>
                      )}

                      {!esCompleto && (
                        <>
                          <span className="text-muted-foreground">Monto a financiar:</span>
                          <span className="font-mono text-right">{formatCurrency(montoFinanciado)}</span>
                        </>
                      )}

                      {localPorcentajeRecargo > 0 && !esCompleto && (
                        <>
                          <span className="text-muted-foreground">Recargo ({localPorcentajeRecargo}%):</span>
                          <span className="font-mono text-right text-amber-600">+ {formatCurrency(importeRecargo)}</span>
                        </>
                      )}

                      {!esCompleto && localPorcentajeRecargo > 0 && (
                        <>
                          <span className="text-muted-foreground">Financiado con recargo:</span>
                          <span className="font-mono text-right">{formatCurrency(montoConRecargo)}</span>
                        </>
                      )}

                      {!esCompleto && (
                        <>
                          <div className="col-span-2 border-t border-border my-1" />
                          <span className="font-semibold">Monto por cuota ({cuotasEfectivas}x):</span>
                          <span className="font-mono font-bold text-right text-base">{formatCurrency(montoPorCuota)}</span>
                        </>
                      )}

                      <div className="col-span-2 border-t border-border my-1" />
                      <span className="font-bold">
                        {esCompleto ? "Total a pagar:" : "Total final (con recargo):"}
                      </span>
                      <span className="font-mono font-bold text-right text-base">{formatCurrency(totalFinal)}</span>
                    </div>
                  </div>
                )
              })()}

              {/* --- VISTA PREVIA DEL PLAN DE CUOTAS --- */}
              {localModalidadPago !== "completo" && localNumeroCuotas > 0 && localFechaInicioPlan && localMontoTotal > 0 && (() => {
                const montoSenaEfectivo = localModalidadPago === "sena" ? localMontoSena : 0
                const montoFinanciado = Math.max(0, localMontoTotal - montoSenaEfectivo)
                const montoConRecargo = montoFinanciado * (1 + localPorcentajeRecargo / 100)
                const montoPorCuota = localNumeroCuotas > 0 ? montoConRecargo / localNumeroCuotas : 0

                return (
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <h4 className="text-sm font-semibold mb-3">Vista Previa del Plan</h4>
                    <div className="space-y-2 text-sm">
                      {localModalidadPago === "sena" && montoSenaEfectivo > 0 && (
                        <div className="flex items-center justify-between py-1.5 px-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-emerald-600" />
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">{"Seña (al firmar contrato)"}</span>
                          </div>
                          <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(montoSenaEfectivo)}
                          </span>
                        </div>
                      )}
                      {Array.from({ length: localNumeroCuotas }).map((_, idx) => {
                        const cuotaNum = idx + 1
                        const fechaCuota = calcularFechaCuota(
                          localFechaInicioPlan,
                          cuotaNum,
                          localDiaVencimiento || 10
                        )
                        const estaPagada = evento.planDeCuotas?.cuotasPagadas?.includes(cuotaNum)

                        return (
                          <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded bg-background">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Cuota {cuotaNum}</span>
                              {estaPagada && (
                                <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">
                                  Pagada
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-muted-foreground">
                              <span>{fechaCuota}</span>
                              <span className="font-mono font-semibold">
                                {formatCurrency(montoPorCuota)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-sm font-medium">Total del Plan</span>
                      <span className="font-mono font-bold text-base">
                        {formatCurrency(montoSenaEfectivo + montoConRecargo)}
                      </span>
                    </div>
                    {localPorcentajeRecargo > 0 && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Incluye {localPorcentajeRecargo}% de recargo por financiacion sobre {formatCurrency(montoFinanciado)}
                      </p>
                    )}
                  </div>
                )
              })()}
            </TabsContent>
          </Tabs>
        </SectionCard>

        </div>{/* End of collapsible sections container */}

        {/* Service Dialog removed - now using package selection */}

        {/* ==================== NUEVO FLUJO DE GUARDADO ==================== */}
        <div className="space-y-4 pb-8">
          {/* Validation errors */}
          {saveErrors.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 space-y-1">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Completa los siguientes campos:
              </p>
              {saveErrors.map((err, i) => (
                <p key={i} className="text-sm text-red-600 ml-6">• {err}</p>
              ))}
            </div>
          )}

          {/* BOTÓN PRINCIPAL: Guardar o Actualizar */}
          {!isEditing ? (
            <Button
              onClick={handleSaveEvento}
              className="w-full h-16 text-lg bg-primary hover:bg-primary/90"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <span className="mr-2">Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="h-6 w-6 mr-2" />
                  Guardar Evento
                </>
              )}
            </Button>
          ) : (
            <>
              {/* Observacion field — only when coming from contratos */}
              {fromContratos && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <FileText className="h-4 w-4" />
                    Observacion del contrato
                    <span className="font-normal text-amber-700 ml-1">(opcional)</span>
                  </label>
                  <textarea
                    value={observacionContrato}
                    onChange={(e) => setObservacionContrato(e.target.value)}
                    placeholder="Ej: Cliente solicito agregar servicio de DJ, se modifico el precio acordado..."
                    rows={2}
                    className="w-full resize-none rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              )}

              <Button
                onClick={handleSaveEvento}
                className="w-full h-16 text-lg bg-primary hover:bg-primary/90"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="mr-2">{fromContratos ? "Guardando contrato..." : "Actualizando..."}</span>
                  </>
                ) : (
                  <>
                    <Save className="h-6 w-6 mr-2" />
                    {fromContratos ? "Actualizar contrato" : "Actualizar Evento"}
                  </>
                )}
              </Button>


            </>
          )}

          {/* Botón volver a lista (solo en modo edición) */}
          {isEditing && (
            <Link href="/eventos/lista" className="block">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a Lista
              </Button>
            </Link>
          )}
        </div>

        {/* Close Event Confirmation Dialog */}
        <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl">Confirmar Cierre de Evento</AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                Esta accion descontara los insumos del stock y guardara el evento en el historial.
                La pantalla se limpiara y volveras al inicio.
                <br /><br />
                <strong>Esta accion NO se puede deshacer.</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-12 text-base">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCloseEvent}
                className="h-12 text-base bg-emerald-600 hover:bg-emerald-700"
              >
                Si, Cerrar Evento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Draft Dialog — mostrado al salir sin guardar evento nuevo */}
        <AlertDialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Queres guardar este borrador?</AlertDialogTitle>
              <AlertDialogDescription>
                Podes guardar el evento como borrador y continuar la carga en otro momento. Lo vas a ver en la lista de eventos con la etiqueta <strong>Borrador</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="ghost"
                className="sm:mr-auto text-destructive hover:text-destructive"
                onClick={handleDescartarBorrador}
              >
                No, descartar
              </Button>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleGuardarBorrador} className="bg-primary">
                Si, guardar borrador
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Section Selector Dialog */}
        <Dialog open={showSectionSelector} onOpenChange={setShowSectionSelector}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">Seleccionar Secciones</DialogTitle>
              <DialogDescription>
                Elegir que secciones incluir en el borrador
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors">
                <Checkbox
                  checked={docSections.listaCompras}
                  onCheckedChange={(checked) =>
                    setDocSections((prev) => ({ ...prev, listaCompras: checked === true }))
                  }
                />
                <div>
                  <p className="font-medium">Lista de Compras</p>
                  <p className="text-sm text-muted-foreground">Insumos de cocina a comprar</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors">
                <Checkbox
                  checked={docSections.barraCocteles}
                  onCheckedChange={(checked) =>
                    setDocSections((prev) => ({ ...prev, barraCocteles: checked === true }))
                  }
                />
                <div>
                  <p className="font-medium">Barra y Cocteles</p>
                  <p className="text-sm text-muted-foreground">Insumos de barra a comprar</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors">
                <Checkbox
                  checked={docSections.guiaProduccion}
                  onCheckedChange={(checked) =>
                    setDocSections((prev) => ({ ...prev, guiaProduccion: checked === true }))
                  }
                />
                <div>
                  <p className="font-medium">Guia de Produccion (Mise en Place)</p>
                  <p className="text-sm text-muted-foreground">Cantidades por plato para cocina</p>
                </div>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" className="bg-transparent" onClick={() => setShowSectionSelector(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handlePreviewSections}
                disabled={!docSections.listaCompras && !docSections.barraCocteles && !docSections.guiaProduccion}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unified Document Modal */}
        {showUnifiedDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="relative max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-white">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 z-10 h-12 w-12"
                onClick={() => setShowUnifiedDoc(false)}
              >
                <X className="h-6 w-6" />
              </Button>
              <UnifiedDocument sections={docSections} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function EventoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <EventoPageContent />
    </Suspense>
  )
}

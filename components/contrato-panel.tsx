"use client"

// =====================================================================
// PANEL LATERAL DE CONTRATO (reutilizable)
// Extraído de app/eventos/contratos/page.tsx para poder abrirlo desde
// otras pantallas (p. ej. Perfil del Evento en Cobrar Cuota) sin navegar.
// =====================================================================

import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import {
  formatCurrency,
  calcularTotalesPaquete,
  type EventoGuardado,
  type Receta,
  type Servicio,
  type VersionContrato,
  type ImpactoContrato,
  type BarraTemplate,
  type Coctel,
} from "@/lib/store"
import { generateContractHTML } from "@/lib/contract-html"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FileText,
  Printer,
  Calendar as CalendarIcon,
  Users,
  Eye,
  X,
  User,
  Pencil,
  DollarSign,
  Clock,
  MapPin,
  ListChecks,
  Phone,
  Mail,
  History,
  Save,
  Check,
  ChevronDown,
  Utensils,
  Wine,
  Trash2,
} from "lucide-react"

const SALON_DIRECCIONES: Record<string, string> = {
  Casona: "Casona Florida 6040 - Del Viso - Bs. As.",
  Quinta: "Quinta Los Jazmines - Del Viso - Bs. As.",
  Salon: "Salon Los Jazmines - Del Viso - Bs. As.",
}

const SALON_DOTS: Record<string, string> = {
  Quinta: "bg-emerald-500",
  Casona: "bg-rose-500",
  Salon: "bg-sky-500",
  "Salon 4": "bg-amber-500",
  "Salon 5": "bg-teal-500",
}
const getSalonDot = (salon?: string) => (salon && SALON_DOTS[salon]) || "bg-muted-foreground"

// =====================================================================
// CONTRACT PREVIEW (overlay interno del panel)
// =====================================================================
function ContractPreview({
  open, evento, recetas, serviciosIncluidos, paquetePrecio, personalAsignado, barrasTemplates, cocteles, onClose,
}: {
  open: boolean; evento: EventoGuardado; recetas: Receta[]; serviciosIncluidos: { nombre: string; descripcion?: string }[]; paquetePrecio: number; personalAsignado: { nombre: string; funcion: string }[]; barrasTemplates?: BarraTemplate[]; cocteles?: Coctel[]; onClose: () => void
}) {
  const html = generateContractHTML(evento, recetas, serviciosIncluidos, paquetePrecio, personalAsignado, barrasTemplates || [], cocteles || [])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-background shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <span className="font-semibold">Vista Previa del Contrato</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onClose() }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <iframe
          srcDoc={html}
          className="flex-1 w-full"
          title="Vista previa del contrato"
        />
      </div>
    </div>
  )
}

// =====================================================================
// HELPERS
// =====================================================================
function getServiciosIncluidos(
  evento: EventoGuardado,
  catalogoServicios: { id: string; nombre: string; descripcion?: string; activo?: boolean }[]
): { nombre: string; descripcion?: string }[] {
  const savedIds = evento.serviciosContrato
  const savedLibres = evento.serviciosLibresContrato || []
  const ids = savedIds && savedIds.length > 0
    ? savedIds
    : (evento.servicios || []).map((se) => se.servicioId).filter((id): id is string => Boolean(id))
  // La descripcion es la "letra chica" del servicio que se imprime en el contrato
  const fromCatalog = catalogoServicios
    .filter((s) => ids.includes(s.id) && s.activo !== false)
    .map((s) => ({ nombre: s.nombre, descripcion: s.descripcion }))
  return [...fromCatalog, ...savedLibres.map((nombre) => ({ nombre }))]
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground break-words">{value || "—"}</p>
      </div>
    </div>
  )
}

// =====================================================================
// HISTORIAL DE MODIFICACIONES (TIMELINE)
// =====================================================================
const IMPACTO_META: Record<ImpactoContrato, { label: string; className: string }> = {
  financiero: { label: "Pago / Cuotas", className: "border-amber-300 bg-amber-100 text-amber-800" },
  servicios: { label: "Servicios", className: "border-blue-300 bg-blue-100 text-blue-800" },
  datos_cliente: { label: "Datos cliente", className: "border-slate-300 bg-slate-100 text-slate-700" },
  menu: { label: "Menú", className: "border-emerald-300 bg-emerald-100 text-emerald-800" },
  barra: { label: "Barra", className: "border-rose-300 bg-rose-100 text-rose-800" },
  invitados: { label: "Invitados", className: "border-cyan-300 bg-cyan-100 text-cyan-800" },
  sin_cambios: { label: "Versión inicial", className: "border-border bg-muted text-muted-foreground" },
}

function HistorialContratoTimeline({
  versiones,
  recetas,
  catalogoServicios,
  onDelete,
}: {
  versiones: VersionContrato[]
  recetas: Receta[]
  catalogoServicios: Servicio[]
  onDelete?: (version: number) => void
}) {
  const [expandidas, setExpandidas] = useState<Set<number>>(() => new Set())

  const ordenadas = useMemo(
    () => [...versiones].sort((a, b) => b.version - a.version),
    [versiones],
  )

  if (ordenadas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin modificaciones registradas todavía.</p>
  }

  const nombreReceta = (id: string) => recetas.find((r) => r.id === id)?.nombre || id
  const nombreServicio = (id: string) => catalogoServicios.find((s) => s.id === id)?.nombre || id

  const toggle = (v: number) =>
    setExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })

  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  return (
    <ol className="relative space-y-4 pl-6">
      <span className="absolute left-2 top-1 bottom-1 w-px bg-border" aria-hidden="true" />
      {ordenadas.map((v) => {
        const abierta = expandidas.has(v.version)
        const menu = v.snapshotMenu
        const totalRecetas =
          (menu?.recetasAdultos?.length || 0) +
          (menu?.recetasAdolescentes?.length || 0) +
          (menu?.recetasNinos?.length || 0) +
          (menu?.recetasDietasEspeciales?.length || 0)
        const cocteles = (v.snapshotBarras || []).flatMap((b) => b.coctelesIncluidos || [])
        const plan = v.snapshotPlanCuotas
        return (
          <li key={v.version} className="relative">
            <span className="absolute -left-[18px] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" aria-hidden="true" />
            <div className="rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => toggle(v.version)}
                className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
                aria-expanded={abierta}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Versión {v.version}</span>
                    <span className="text-xs text-muted-foreground">{fmtFecha(v.fechaGuardado)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {v.impactos.map((imp) => (
                      <span
                        key={imp}
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${IMPACTO_META[imp].className}`}
                      >
                        {IMPACTO_META[imp].label}
                      </span>
                    ))}
                  </div>
                  {v.motivo && <p className="text-xs text-muted-foreground break-words">{v.motivo}</p>}
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  {onDelete && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Eliminar versión ${v.version}`}
                      className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(v.version)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          e.stopPropagation()
                          onDelete(v.version)
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <ChevronDown
                    className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierta ? "rotate-180" : ""}`}
                  />
                </span>
              </button>

              {abierta && (
                <div className="space-y-3 border-t border-border px-3 py-3 text-xs">
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Invitados</p>
                      {v.snapshotInvitados ? (
                        <p className="text-muted-foreground">
                          {v.snapshotInvitados.adultos} adultos, {v.snapshotInvitados.adolescentes} adol.,{" "}
                          {v.snapshotInvitados.ninos} niños
                          {v.snapshotInvitados.dietasEspeciales > 0
                            ? `, ${v.snapshotInvitados.dietasEspeciales} dietas esp.`
                            : ""}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Utensils className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">Menú ({totalRecetas} platos)</p>
                      {menu ? (
                        <p className="text-muted-foreground break-words">
                          {[
                            ...(menu.recetasAdultos || []),
                            ...(menu.recetasAdolescentes || []),
                            ...(menu.recetasNinos || []),
                            ...(menu.recetasDietasEspeciales || []),
                          ]
                            .map(nombreReceta)
                            .join(", ") || "Sin platos cargados"}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Wine className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">
                        Barra ({(v.snapshotBarras || []).length} barra{(v.snapshotBarras || []).length === 1 ? "" : "s"})
                      </p>
                      <p className="text-muted-foreground">
                        {cocteles.length > 0 ? `${cocteles.length} cócteles incluidos` : "Sin barra contratada"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <ListChecks className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        Servicios ({v.snapshotServicios.length + (v.snapshotServiciosLibres?.length || 0)})
                      </p>
                      <p className="text-muted-foreground break-words">
                        {[...v.snapshotServicios.map(nombreServicio), ...(v.snapshotServiciosLibres || [])].join(", ") ||
                          "Sin servicios"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <DollarSign className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Modalidad de pago</p>
                      {plan && plan.montoTotal > 0 ? (
                        <p className="text-muted-foreground">
                          Total {formatCurrency(plan.montoTotal)}
                          {plan.montoSena && plan.montoSena > 0 ? ` · Seña ${formatCurrency(plan.montoSena)}` : ""}
                          {plan.numeroCuotas ? ` · ${plan.numeroCuotas} cuotas` : ""}
                          {plan.ajustaPorIPC === false ? " · fijas" : " · ajustables IPC"}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// =====================================================================
// PANEL PRINCIPAL
// =====================================================================
export function ContratoPanel({
  eventoId,
  open,
  onClose,
}: {
  eventoId: string
  open: boolean
  onClose: () => void
}) {
  const { state, updateEvento } = useStore()
  const { eventos, paquetesSalones, recetas } = state
  const catalogoServicios = state.servicios || []

  const showPreviewRef = useRef(false)
  const [showPreview, setShowPreview] = useState(false)
  const setShowPreviewSync = (v: boolean) => {
    showPreviewRef.current = v
    setShowPreview(v)
  }
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  // Borrado de versiones del contrato (protegido por contraseña)
  const [versionAEliminar, setVersionAEliminar] = useState<number | null>(null)
  // Borrado de generaciones del contrato (misma contraseña)
  const [generacionAEliminar, setGeneracionAEliminar] = useState<{ id: string; numero: number } | null>(null)
  const [passwordBorrado, setPasswordBorrado] = useState("")
  const [errorPassword, setErrorPassword] = useState(false)
  const [borrandoVersion, setBorrandoVersion] = useState(false)
  const [editForm, setEditForm] = useState({
    nombreCompleto: "",
    dni: "",
    telefono: "",
    direccion: "",
    email: "",
    condicionIVA: "Consumidor Final",
    observaciones: "",
  })

  const selectedEvento = useMemo(
    () => (eventos || []).find((e) => e.id === eventoId) || null,
    [eventos, eventoId]
  )

  // Al cambiar de evento o reabrir, salir de modo edición y recargar el form
  useEffect(() => {
    setIsEditing(false)
    setShowPreviewSync(false)
    if (selectedEvento) {
      const c = selectedEvento.contrato || {}
      setEditForm({
        nombreCompleto: c.nombreCompleto || "",
        dni: c.dni || "",
        telefono: c.telefono || "",
        direccion: c.direccion || "",
        email: c.email || "",
        condicionIVA: selectedEvento.condicionIVA || "Consumidor Final",
        observaciones: c.observaciones || "",
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvento?.id, open])

  const serviciosIncluidos = useMemo(
    () => (selectedEvento ? getServiciosIncluidos(selectedEvento, catalogoServicios) : []),
    [selectedEvento, catalogoServicios]
  )

  const paquetePrecio = useMemo(() => {
    if (!selectedEvento) return 0
    return (selectedEvento.paquetesSeleccionados || []).reduce((total, pid) => {
      const paq = (paquetesSalones || []).find((p) => p.id === pid)
      if (!paq) return total
      return total + calcularTotalesPaquete(paq, catalogoServicios || []).precioOficial
    }, 0)
  }, [selectedEvento, paquetesSalones, catalogoServicios])

  const personalAsignado = useMemo(() => {
    if (!selectedEvento) return []
    const resultado: { nombre: string; funcion: string }[] = []
    const vistos = new Set<string>()
    for (const pe of selectedEvento.personalEvento || []) {
      const clave = pe.personalId || pe.nombre.toLowerCase()
      if (vistos.has(clave)) continue
      vistos.add(clave)
      resultado.push({ nombre: pe.nombre, funcion: pe.funcion })
    }
    for (const pp of state.pagosPersonal || []) {
      if (pp.eventoId !== selectedEvento.id) continue
      const clave = pp.personalId || pp.nombrePersonal.toLowerCase()
      if (vistos.has(clave) || vistos.has(pp.nombrePersonal.toLowerCase())) continue
      vistos.add(clave)
      resultado.push({ nombre: pp.nombrePersonal, funcion: pp.servicioNombre })
    }
    return resultado
  }, [selectedEvento, state.pagosPersonal])

  const handlePrint = () => {
    if (!selectedEvento) return
    const html = generateContractHTML(selectedEvento, recetas, serviciosIncluidos, paquetePrecio, personalAsignado, state.barrasTemplates || [], state.cocteles || [])
    const printWindow = window.open("", "_blank", "width=900,height=700")
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 300)

    const versionActual = selectedEvento.versionesContrato?.length
      ? Math.max(...selectedEvento.versionesContrato.map((v) => v.version))
      : undefined
    const nuevaGeneracion = {
      id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fecha: new Date().toISOString(),
      origen: "contratos" as const,
      version: versionActual,
      cantidadPersonal: personalAsignado.length,
      cantidadServicios: serviciosIncluidos.length,
      montoTotal: selectedEvento.planDeCuotas?.montoTotal || undefined,
    }
    updateEvento(selectedEvento.id, {
      generacionesContrato: [...(selectedEvento.generacionesContrato || []), nuevaGeneracion],
      fechaImpresion: new Date().toISOString(),
    })
  }

  const handleSaveEdit = async () => {
    if (!selectedEvento) return
    setSaving(true)
    try {
      await updateEvento(selectedEvento.id, {
        contrato: {
          ...(selectedEvento.contrato || {}),
          nombreCompleto: editForm.nombreCompleto.trim(),
          dni: editForm.dni.trim(),
          telefono: editForm.telefono.trim(),
          direccion: editForm.direccion.trim(),
          email: editForm.email.trim(),
          observaciones: editForm.observaciones.trim(),
        },
        condicionIVA: editForm.condicionIVA as EventoGuardado["condicionIVA"],
      })
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  // Borra una versión o una generación del contrato tras validar la contraseña.
  // Deja registro en el historial de actividad (Configuración > Actividad).
  const handleConfirmDeleteVersion = async () => {
    if (!selectedEvento || (versionAEliminar === null && generacionAEliminar === null)) return
    if (passwordBorrado !== "1234") {
      setErrorPassword(true)
      return
    }
    setBorrandoVersion(true)
    try {
      const nombreEvento = selectedEvento.nombrePareja || selectedEvento.nombre || "evento"
      if (versionAEliminar !== null) {
        const version = selectedEvento.versionesContrato?.find((v) => v.version === versionAEliminar)
        const restantes = (selectedEvento.versionesContrato || []).filter((v) => v.version !== versionAEliminar)
        await updateEvento(selectedEvento.id, { versionesContrato: restantes })
        // Registrar en el historial de actividad
        fetch("/api/activity-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "contrato",
            accion: "eliminado",
            nombre: `Versión ${versionAEliminar} del contrato de ${nombreEvento}`,
            detalle: version?.motivo
              ? `Motivo original de la versión: ${version.motivo}`
              : "Modificación del contrato eliminada con autorización",
          }),
        }).catch(() => {})
      } else if (generacionAEliminar !== null) {
        const restantes = (selectedEvento.generacionesContrato || []).filter((g) => g.id !== generacionAEliminar.id)
        await updateEvento(selectedEvento.id, { generacionesContrato: restantes })
        // Registrar en el historial de actividad
        fetch("/api/activity-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: "contrato",
            accion: "eliminado",
            nombre: `Generación #${generacionAEliminar.numero} del contrato de ${nombreEvento}`,
            detalle: "Registro de generación del contrato eliminado con autorización",
          }),
        }).catch(() => {})
      }
      setVersionAEliminar(null)
      setGeneracionAEliminar(null)
      setPasswordBorrado("")
      setErrorPassword(false)
    } finally {
      setBorrandoVersion(false)
    }
  }

  const handleCancelEdit = () => {
    if (selectedEvento) {
      const c = selectedEvento.contrato || {}
      setEditForm({
        nombreCompleto: c.nombreCompleto || "",
        dni: c.dni || "",
        telefono: c.telefono || "",
        direccion: c.direccion || "",
        email: c.email || "",
        condicionIVA: selectedEvento.condicionIVA || "Consumidor Final",
        observaciones: c.observaciones || "",
      })
    }
    setIsEditing(false)
  }

  if (!open || !selectedEvento) return null

  const contrato = selectedEvento.contrato || {}
  const totalInvitados =
    selectedEvento.adultos + selectedEvento.adolescentes + selectedEvento.ninos + (selectedEvento.personasDietasEspeciales || 0)
  const ultimaVersion = selectedEvento.versionesContrato?.length
    ? Math.max(...selectedEvento.versionesContrato.map((v) => v.version))
    : 0

  return (
    <>
      {/* backdrop — solo cierra si no hay preview activa */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={() => {
          if (showPreviewRef.current) return
          onClose()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col gap-0 border-l border-border bg-background shadow-xl overflow-hidden"
      >
        <div className="border-b border-border px-6 py-4 text-left shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${getSalonDot(selectedEvento.salon)}`} />
              <h2 className="text-base font-semibold">
                {selectedEvento.nombrePareja || selectedEvento.nombre || "Evento"}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={onClose}
              aria-label="Cerrar panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">{selectedEvento.salon || "Sin salon"}</Badge>
            {ultimaVersion > 0 ? (
              <Badge variant="secondary" className="gap-1 text-xs">
                <History className="h-3 w-3" />
                Contrato v{ultimaVersion}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">Sin modificaciones</Badge>
            )}
            {(selectedEvento.generacionesContrato?.length || 0) > 0 ? (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Printer className="h-3 w-3" />
                Generado {selectedEvento.generacionesContrato!.length}{selectedEvento.generacionesContrato!.length === 1 ? " vez" : " veces"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">Sin generar</Badge>
            )}
          </div>

          {/* Toolbar: vista previa + imprimir + editar en el planificador */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onPointerDown={(e) => {
                showPreviewRef.current = true
                e.stopPropagation()
              }}
              onClick={() => setShowPreviewSync(true)}
              className="gap-2 bg-transparent"
            >
              <Eye className="h-4 w-4" />
              Vista Previa
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-2 bg-transparent"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Link href={`/evento?id=${selectedEvento.id}&from=contratos`}>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Pencil className="h-4 w-4" />
                Editar en el planificador
              </Button>
            </Link>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-6 px-6 py-5">
            {/* Evento */}
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Datos del evento</p>
              <DetailRow
                icon={<CalendarIcon className="h-4 w-4" />}
                label="Fecha"
                value={new Date(selectedEvento.fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              />
              <DetailRow
                icon={<Clock className="h-4 w-4" />}
                label="Horario"
                value={selectedEvento.horario ? `${selectedEvento.horario}${selectedEvento.horarioFin ? ` a ${selectedEvento.horarioFin}` : ""} hs.` : "—"}
              />
              <DetailRow
                icon={<MapPin className="h-4 w-4" />}
                label="Salon"
                value={selectedEvento.salon ? SALON_DIRECCIONES[selectedEvento.salon] || selectedEvento.salon : "—"}
              />
              <DetailRow
                icon={<Users className="h-4 w-4" />}
                label="Invitados"
                value={`${totalInvitados} personas (${selectedEvento.adultos} adultos, ${selectedEvento.adolescentes} adol., ${selectedEvento.ninos} ninos)`}
              />
            </section>

            <Separator />

            {/* Cliente */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Datos del cliente</p>
                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="panel-edit-nombre" className="text-xs text-muted-foreground">Nombre completo</Label>
                    <Input
                      id="panel-edit-nombre"
                      value={editForm.nombreCompleto}
                      onChange={(e) => setEditForm((f) => ({ ...f, nombreCompleto: e.target.value }))}
                      placeholder="Nombre y apellido"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="panel-edit-dni" className="text-xs text-muted-foreground">DNI</Label>
                      <Input
                        id="panel-edit-dni"
                        value={editForm.dni}
                        onChange={(e) => setEditForm((f) => ({ ...f, dni: e.target.value }))}
                        placeholder="DNI"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="panel-edit-telefono" className="text-xs text-muted-foreground">Telefono</Label>
                      <Input
                        id="panel-edit-telefono"
                        value={editForm.telefono}
                        onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
                        placeholder="Telefono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="panel-edit-direccion" className="text-xs text-muted-foreground">Direccion</Label>
                    <Input
                      id="panel-edit-direccion"
                      value={editForm.direccion}
                      onChange={(e) => setEditForm((f) => ({ ...f, direccion: e.target.value }))}
                      placeholder="Direccion"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="panel-edit-email" className="text-xs text-muted-foreground">Email</Label>
                    <Input
                      id="panel-edit-email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Email"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Condicion IVA</Label>
                    <Select
                      value={editForm.condicionIVA}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, condicionIVA: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Condicion IVA" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
                        <SelectItem value="Responsable Inscripto">Responsable Inscripto</SelectItem>
                        <SelectItem value="Monotributista">Monotributista</SelectItem>
                        <SelectItem value="Exento">Exento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="panel-edit-observaciones" className="text-xs text-muted-foreground">Observaciones del contrato</Label>
                    <Textarea
                      id="panel-edit-observaciones"
                      value={editForm.observaciones}
                      onChange={(e) => setEditForm((f) => ({ ...f, observaciones: e.target.value }))}
                      placeholder="Algo extra que quieras dejar asentado en el contrato..."
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <DetailRow icon={<User className="h-4 w-4" />} label="Nombre completo" value={contrato.nombreCompleto} />
                  <DetailRow icon={<FileText className="h-4 w-4" />} label="DNI" value={contrato.dni} />
                  <DetailRow icon={<Phone className="h-4 w-4" />} label="Telefono" value={contrato.telefono} />
                  <DetailRow icon={<MapPin className="h-4 w-4" />} label="Direccion" value={contrato.direccion} />
                  <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={contrato.email} />
                  <DetailRow icon={<FileText className="h-4 w-4" />} label="Condicion IVA" value={selectedEvento.condicionIVA || "Consumidor Final"} />
                  {contrato.observaciones && (
                    <DetailRow icon={<FileText className="h-4 w-4" />} label="Observaciones" value={contrato.observaciones} />
                  )}
                </>
              )}
            </section>

            <Separator />

            {/* Servicios */}
            <section className="space-y-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <ListChecks className="h-3.5 w-3.5" />
                Servicios del contrato
              </p>
              {serviciosIncluidos.length > 0 ? (
                <ul className="space-y-1">
                  {serviciosIncluidos.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                      <span className="min-w-0">
                        {s.nombre}
                        {s.descripcion ? (
                          <span className="block text-xs italic text-muted-foreground">{s.descripcion}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Sin servicios cargados.</p>
              )}
            </section>

            {/* Plan de cuotas */}
            {selectedEvento.planDeCuotas && selectedEvento.planDeCuotas.montoTotal > 0 && (
              <>
                <Separator />
                <section className="space-y-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    <DollarSign className="h-3.5 w-3.5" />
                    Financiacion
                  </p>
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-semibold">{formatCurrency(selectedEvento.planDeCuotas.montoTotal)}</p>
                    </div>
                    {selectedEvento.planDeCuotas.montoSena && selectedEvento.planDeCuotas.montoSena > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">Sena</p>
                        <p className="font-semibold">{formatCurrency(selectedEvento.planDeCuotas.montoSena)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Cuotas</p>
                      <p className="font-semibold">{selectedEvento.planDeCuotas.numeroCuotas}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Por cuota</p>
                      <p className="font-semibold">{formatCurrency(selectedEvento.planDeCuotas.montoCuota)}</p>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* Personal asignado al evento */}
            {personalAsignado.length > 0 && (
              <>
                <Separator />
                <section className="space-y-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    <Users className="h-3.5 w-3.5" />
                    Personal asignado ({personalAsignado.length})
                  </p>
                  <div className="space-y-1.5">
                    {personalAsignado.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{p.nombre}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{p.funcion}</Badge>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* Historial de modificaciones */}
            <Separator />
            <section className="space-y-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <History className="h-3.5 w-3.5" />
                Historial de modificaciones
              </p>
            <HistorialContratoTimeline
              onDelete={(v) => {
                setVersionAEliminar(v)
                setPasswordBorrado("")
                setErrorPassword(false)
              }}
              versiones={selectedEvento.versionesContrato || []}
                recetas={recetas}
                catalogoServicios={catalogoServicios}
              />
            </section>

            {/* Historial de generaciones del contrato */}
            <Separator />
            <section className="space-y-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Printer className="h-3.5 w-3.5" />
                Historial de generaciones
              </p>
              {(selectedEvento.generacionesContrato || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Este contrato todavia no fue generado.</p>
              ) : (
                <ol className="space-y-2">
                  {[...(selectedEvento.generacionesContrato || [])]
                    .sort((a, b) => b.fecha.localeCompare(a.fecha))
                    .map((gen, idx, arr) => (
                      <li key={gen.id} className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            Generacion #{arr.length - idx}
                            {gen.version ? ` · sobre version ${gen.version}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(gen.fecha).toLocaleDateString("es-AR", {
                              day: "2-digit", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                            {typeof gen.cantidadServicios === "number" ? ` · ${gen.cantidadServicios} servicios` : ""}
                            {typeof gen.cantidadPersonal === "number" && gen.cantidadPersonal > 0 ? ` · ${gen.cantidadPersonal} personal` : ""}
                            {gen.montoTotal ? ` · ${formatCurrency(gen.montoTotal)}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Eliminar generación ${arr.length - idx}`}
                          className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            setGeneracionAEliminar({ id: gen.id, numero: arr.length - idx })
                            setPasswordBorrado("")
                            setErrorPassword(false)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                </ol>
              )}
            </section>
          </div>
        </ScrollArea>

        {/* Actions (solo en modo edicion) */}
        {isEditing && (
          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancelEdit} disabled={saving} className="flex-1 gap-2 bg-transparent">
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving} className="flex-1 gap-2">
                {saving ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        )}

        {/* Preview dentro del panel para que el overlay no lo cierre */}
        <ContractPreview
          open={showPreview}
          evento={selectedEvento}
          recetas={recetas}
          serviciosIncluidos={serviciosIncluidos}
          paquetePrecio={paquetePrecio}
          personalAsignado={personalAsignado}
          barrasTemplates={state.barrasTemplates || []}
          cocteles={state.cocteles || []}
          onClose={() => setShowPreviewSync(false)}
        />

        {/* Diálogo de contraseña para borrar una versión o generación del contrato */}
        {(versionAEliminar !== null || generacionAEliminar !== null) && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar eliminación"
          >
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  {versionAEliminar !== null
                    ? `Eliminar Versión ${versionAEliminar}`
                    : `Eliminar Generación #${generacionAEliminar?.numero}`}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {versionAEliminar !== null
                    ? "Esta acción borra la modificación del contrato de forma permanente y quedará registrada en el historial de actividad. Ingresá la contraseña para confirmar."
                    : "Esta acción borra el registro de generación del contrato de forma permanente y quedará registrada en el historial de actividad. Ingresá la contraseña para confirmar."}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password-borrar-version" className="text-xs text-muted-foreground">
                  Contraseña
                </Label>
                <Input
                  id="password-borrar-version"
                  type="password"
                  value={passwordBorrado}
                  autoFocus
                  onChange={(e) => {
                    setPasswordBorrado(e.target.value)
                    setErrorPassword(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                      handleConfirmDeleteVersion()
                    }
                  }}
                  placeholder="••••"
                />
                {errorPassword && (
                  <p className="text-xs font-medium text-destructive">Contraseña incorrecta</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  disabled={borrandoVersion}
                  onClick={() => {
                    setVersionAEliminar(null)
                    setGeneracionAEliminar(null)
                    setPasswordBorrado("")
                    setErrorPassword(false)
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-1.5"
                  disabled={borrandoVersion || passwordBorrado.length === 0}
                  onClick={handleConfirmDeleteVersion}
                >
                  <Trash2 className="h-4 w-4" />
                  {borrandoVersion ? "Eliminando..." : "Eliminar"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

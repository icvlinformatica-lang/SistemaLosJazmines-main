"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { formatCurrency } from "@/lib/utils-financieros"
import { useStore } from "@/lib/store-context"
import { useToast } from "@/hooks/use-toast"
import { SALONES, salonLabel, generateId, type DistribucionSalon } from "@/lib/store"
import { SalonDot } from "@/components/salon-badge"
import { RepartoSalonesEditor, repartoValido } from "@/components/reparto-salones-editor"
import { cambiarDiaResumen, fechaResumenValida } from "@/lib/resumen-fecha"
import { usuarioActivo } from "@/lib/profile-context"
import type { GastoVariable } from "@/lib/hooks/use-caja-jazmines"
import { Plus, ChevronLeft, ChevronRight, CalendarDays, Sparkles } from "lucide-react"

/**
 * Paleta para carpetas de gastos variables creadas por el usuario; el color
 * se asigna por hash del nombre para que sea estable entre sesiones.
 * (Misma paleta que usa la lista de carpetas en Caja Jazmines.)
 */
const COLORES_CARPETAS_CUSTOM = ["#7c3aed", "#0369a1", "#be185d", "#4d7c0f", "#b91c1c", "#0e7490"]

interface ItemDelDia {
  id: string
  concepto: string
  monto: number
  salon: string | null | undefined
  tipo: "gasto" | "retiro"
  hora: string | null
  cargadoPor: string | null
}

interface GastoRapidoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se pasa, el modal abre en modo edición con los datos de este gasto. */
  costoAEditar?: GastoVariable | null
  /** Salón que se está mirando (ej. el filtro de Caja Jazmines). Si se pasa,
   *  el panel "Gastos de hoy" muestra solo lo que corresponde a ese salón
   *  (incluida la porción prorrateada de los gastos repartidos). Sin este
   *  prop (ej. desde Inicio) el panel muestra todos los salones. */
  salonActual?: string
}

/**
 * Diálogo para agendar un gasto variable o registrar un retiro directo de
 * Caja Jazmines. Usado desde Caja Jazmines (con edición) y desde el botón
 * "Cargar gastos" de Inicio (siempre en modo alta).
 */
export function GastoRapidoModal({ open, onOpenChange, costoAEditar, salonActual }: GastoRapidoModalProps) {
  const { state, updateCostoOperativo, addCostoOperativo, archivarGasto, addMovimientosCaja } = useStore()
  const { toast } = useToast()

  const [nuevoGasto, setNuevoGasto] = useState({
    nombre: "",
    monto: "",
    salon: "",
    fecha: "",
    fechaGasto: "",
    repartir: false,
    distribucion: [] as DistribucionSalon[],
    carpeta: "varios",
  })
  // Modo "crear nueva carpeta" dentro del selector de carpeta del diálogo.
  const [creandoCarpeta, setCreandoCarpeta] = useState(false)
  const [nombreCarpetaNueva, setNombreCarpetaNueva] = useState("")
  // Si tiene valor, el modal está editando ese costo operativo.
  const [editandoVariableId, setEditandoVariableId] = useState<string | null>(null)
  // Modo del modal: "gasto" agenda un gasto variable; "retiro" extrae dinero
  // de la caja ya mismo, siempre asignado a un salón.
  const [modoVariable, setModoVariable] = useState<"gasto" | "retiro">("gasto")

  const variableRepartoInvalido = nuevoGasto.repartir && !repartoValido(nuevoGasto.distribucion)

  // Carpetas ya usadas por otros gastos variables, para el selector.
  const carpetasExistentes = [...new Set(
    (state.costosOperativos || [])
      .filter((c) => c.activo && c.esVariable === true)
      .map((c) => c.categoria || "varios")
      .filter((c) => c !== "comisiones" && c !== "varios"),
  )]

  // ── Sugerencia de carpeta para gastos que se repiten ─────────────────────
  // Si el concepto tipeado ya se cargó antes (activo o archivado) y todavía
  // está en "Varios", se ofrece crearle una carpeta propia con un clic.
  const [sugerenciaDescartada, setSugerenciaDescartada] = useState<string | null>(null)
  const nombreNormalizado = nuevoGasto.nombre.trim().toLowerCase()
  const vecesCargadoAntes =
    nombreNormalizado.length >= 2
      ? (state.costosOperativos || []).filter(
          (c) => c.esVariable && c.id !== editandoVariableId && c.concepto.trim().toLowerCase() === nombreNormalizado,
        ).length +
        (state.gastosArchivados || []).filter(
          (g) =>
            g.origen === "caja_jazmines_variable" &&
            !g.concepto.startsWith("Retiro - ") &&
            g.concepto.trim().toLowerCase() === nombreNormalizado,
        ).length
      : 0
  const sugerirCarpeta =
    modoVariable === "gasto" &&
    !editandoVariableId &&
    nuevoGasto.carpeta === "varios" &&
    vecesCargadoAntes >= 1 &&
    sugerenciaDescartada !== nombreNormalizado

  // ── Panel "Gastos de hoy" ────────────────────────────────────────────────
  // Muestra lo que se fue cargando (gastos agendados + retiros) el día
  // elegido, con flechas para viajar en el tiempo (mismo patrón que el
  // selector de fecha de Resumen diario).
  const hoyPanelISO = new Date().toISOString().slice(0, 10)
  const [fechaPanel, setFechaPanel] = useState<string | null>(null)
  const fechaPanelActual = fechaPanel ?? hoyPanelISO

  // Siempre arranca mostrando "hoy" cada vez que se abre el modal.
  useEffect(() => {
    if (open) setFechaPanel(null)
  }, [open])

  const gastosDelPanel: ItemDelDia[] = (state.costosOperativos || [])
    .filter((c) => c.esVariable && c.createdAt && c.createdAt.slice(0, 10) === fechaPanelActual)
    .flatMap((c) => {
      const hora = c.createdAt ? new Date(c.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : null
      const dist = (c.distribucion || []).filter((d) => d && d.salon && d.porcentaje > 0)
      if (!salonActual) {
        return [{
          id: c.id,
          concepto: c.concepto,
          monto: c.monto,
          salon: c.salon,
          tipo: "gasto" as const,
          hora,
          cargadoPor: c.cargadoPor || null,
        }]
      }
      if (dist.length > 0) {
        const entry = dist.find((d) => d.salon === salonActual)
        if (!entry) return []
        return [{
          id: c.id,
          concepto: `${c.concepto} · ${entry.porcentaje}%`,
          monto: Math.round((c.monto * entry.porcentaje) / 100),
          salon: salonActual,
          tipo: "gasto" as const,
          hora,
          cargadoPor: c.cargadoPor || null,
        }]
      }
      if (c.salon !== salonActual) return []
      return [{
        id: c.id,
        concepto: c.concepto,
        monto: c.monto,
        salon: c.salon,
        tipo: "gasto" as const,
        hora,
        cargadoPor: c.cargadoPor || null,
      }]
    })

  const retirosDelPanel: ItemDelDia[] = (state.gastosArchivados || [])
    .filter((g) => g.origen === "caja_jazmines_variable" && g.fecha === fechaPanelActual && (!salonActual || g.salon === salonActual))
    .map((g) => ({
      id: g.id,
      concepto: g.concepto,
      monto: g.monto,
      salon: g.salon,
      tipo: "retiro",
      hora: null,
      cargadoPor: g.cargadoPor || null,
    }))

  const itemsDelPanel = [...gastosDelPanel, ...retirosDelPanel].sort((a, b) => (b.hora || "").localeCompare(a.hora || ""))
  const totalDelPanel = itemsDelPanel.reduce((s, it) => s + it.monto, 0)

  // Al abrir en modo edición, precarga los campos con los datos del gasto.
  useEffect(() => {
    if (!open || !costoAEditar) return
    const orig = state.costosOperativos?.find((c) => c.id === costoAEditar.id)
    if (!orig) return
    const dist = (orig.distribucion || []).filter((d) => d && d.salon && d.porcentaje > 0)
    setNuevoGasto({
      nombre: orig.concepto,
      monto: String(orig.monto),
      salon: orig.salon || "",
      fecha: orig.fechaVencimiento || "",
      fechaGasto: orig.fechaGasto || "",
      repartir: dist.length > 0,
      distribucion: dist,
      carpeta: orig.categoria || "varios",
    })
    setEditandoVariableId(costoAEditar.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, costoAEditar])

  // ── Retiro de dinero de Caja Jazmines ────────────────────────────────────
  // Se registra desde "Gastos variables" (opción "Retiro") y SIEMPRE con un
  // salón asignado, para que el saldo de cada salón refleje la extracción.
  function registrarRetiro(concepto: string, monto: number, salon: string) {
    if (!monto || monto <= 0 || !concepto || !salon) return

    const hoyISO = new Date().toISOString()
    const fechaCorta = hoyISO.slice(0, 10)
    const conceptoMov = `Retiro - ${concepto}`

    const saldoPrev = (state.movimientosCaja ?? [])
      .filter((m) => m.cajaDestino === "caja_jazmines")
      .reduce((sum, m) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto), 0)

    addMovimientosCaja([
      {
        id: generateId(),
        fecha: hoyISO,
        tipo: "egreso",
        concepto: conceptoMov,
        monto,
        salon,
        cajaDestino: "caja_jazmines",
        saldoResultante: saldoPrev - monto,
      },
    ])

    // Archivo Histórico (retiro de Jazmines = gasto variable)
    archivarGasto({
      fecha: fechaCorta,
      concepto: conceptoMov,
      monto,
      salon,
      origen: "caja_jazmines_variable",
      categoria: "extracción",
      eventoId: null,
      eventoNombre: null,
      refId: null,
      cargadoPor: usuarioActivo() || null,
    })

    // Configuración > Actividad
    fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "caja",
        accion: "extracción",
        nombre: `Caja Jazmines · ${formatCurrency(monto)} (${salonLabel(salon)})`,
        detalle: `Retiro de ${formatCurrency(monto)} del salón ${salonLabel(salon)} | Motivo: ${concepto}`,
      }),
    }).catch(() => {})

    toast({
      title: "Retiro registrado",
      description: `Se retiraron ${formatCurrency(monto)} de Caja Jazmines (${salonLabel(salon)}).`,
    })
  }

  function cerrarYResetear() {
    setNuevoGasto({ nombre: "", monto: "", salon: "", fecha: "", fechaGasto: "", repartir: false, distribucion: [], carpeta: "varios" })
    setCreandoCarpeta(false)
    setEditandoVariableId(null)
    setModoVariable("gasto")
    onOpenChange(false)
  }

  function handleAgregarGasto() {
    // Modo retiro: extrae el dinero de la caja ahora mismo, con salón asignado.
    if (modoVariable === "retiro" && !editandoVariableId) {
      if (!nuevoGasto.nombre || !nuevoGasto.monto || !nuevoGasto.salon) return
      if (!confirm(`¿Registrar el retiro "${nuevoGasto.nombre}" por ${formatCurrency(Number(nuevoGasto.monto))} del salón ${salonLabel(nuevoGasto.salon)}? Se descuenta del saldo ahora.`)) return
      registrarRetiro(nuevoGasto.nombre, Number(nuevoGasto.monto), nuevoGasto.salon)
      cerrarYResetear()
      return
    }
    if (!nuevoGasto.nombre || !nuevoGasto.monto || !nuevoGasto.fecha) return
    if (nuevoGasto.repartir) {
      if (variableRepartoInvalido) return
    } else if (!nuevoGasto.salon) {
      return
    }
    const esEdicion = !!editandoVariableId
    if (!esEdicion && !confirm(`¿Agendar el gasto "${nuevoGasto.nombre}" por ${formatCurrency(Number(nuevoGasto.monto))} con vencimiento el ${nuevoGasto.fecha}?`)) return
    const dist = nuevoGasto.repartir
      ? nuevoGasto.distribucion.filter((d) => d.salon && d.porcentaje > 0)
      : []
    if (esEdicion && editandoVariableId) {
      updateCostoOperativo(editandoVariableId, {
        concepto: nuevoGasto.nombre,
        monto: Number(nuevoGasto.monto),
        salon: dist.length > 0 ? null : nuevoGasto.salon,
        fechaVencimiento: nuevoGasto.fecha,
        fechaGasto: nuevoGasto.fechaGasto || undefined,
        distribucion: dist.length > 0 ? dist : undefined,
        categoria: nuevoGasto.carpeta,
      })
      toast({ title: "Gasto actualizado", description: nuevoGasto.nombre })
    } else {
      addCostoOperativo({
        concepto: nuevoGasto.nombre,
        tipo: "Gastos Generales" as any,
        monto: Number(nuevoGasto.monto),
        frecuencia: "Por Evento",
        esPorPersona: false,
        salon: dist.length > 0 ? null : nuevoGasto.salon,
        activo: true,
        fechaVencimiento: nuevoGasto.fecha,
        fechaGasto: nuevoGasto.fechaGasto || undefined,
        esVariable: true,
        pagado: false,
        distribucion: dist.length > 0 ? dist : undefined,
        categoria: nuevoGasto.carpeta,
        createdAt: new Date().toISOString(),
        cargadoPor: usuarioActivo() || undefined,
      })
    }
    cerrarYResetear()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          setEditandoVariableId(null)
          setModoVariable("gasto")
          setNuevoGasto({ nombre: "", monto: "", salon: "", fecha: "", fechaGasto: "", repartir: false, distribucion: [], carpeta: "varios" })
          setCreandoCarpeta(false)
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {editandoVariableId
              ? "Editar gasto variable"
              : modoVariable === "retiro"
                ? "Registrar retiro de caja"
                : "Agendar gasto variable"}
          </DialogTitle>
          <DialogDescription>
            {modoVariable === "retiro" && !editandoVariableId
              ? "El retiro se descuenta de Caja Jazmines ahora mismo y queda asignado al salón que elijas. Se registra en el Archivo Histórico y en Configuración → Actividad."
              : "Este gasto se carga en Caja Jazmines, no en Caja Eventos."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 min-h-0 flex-col md:flex-row gap-4 overflow-hidden">
        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {!editandoVariableId && (
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  modoVariable === "gasto" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setModoVariable("gasto")}
              >
                Gasto
              </button>
              <button
                type="button"
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  modoVariable === "retiro" ? "bg-background shadow-sm text-red-600" : "text-muted-foreground"
                }`}
                onClick={() => setModoVariable("retiro")}
              >
                Retiro
              </button>
            </div>
          )}
          <div className="space-y-2">
            {modoVariable !== "retiro" && (
              <div className="flex items-center justify-between">
                <Label htmlFor="gv-repartir">Repartir entre varios salones</Label>
                <Switch
                  id="gv-repartir"
                  checked={nuevoGasto.repartir}
                  onCheckedChange={(checked) => setNuevoGasto((p) => ({ ...p, repartir: checked }))}
                />
              </div>
            )}
            {modoVariable !== "retiro" && nuevoGasto.repartir ? (
              <RepartoSalonesEditor
                value={nuevoGasto.distribucion}
                onChange={(v) => setNuevoGasto((p) => ({ ...p, distribucion: v }))}
              />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="gv-salon">{modoVariable === "retiro" ? "Salón del que se retira" : "Salón"}</Label>
                <Select
                  value={nuevoGasto.salon}
                  onValueChange={(v) => setNuevoGasto((p) => ({ ...p, salon: v }))}
                >
                  <SelectTrigger id="gv-salon">
                    <SelectValue placeholder="Seleccionar salón" />
                  </SelectTrigger>
                  <SelectContent>
                    {SALONES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <SalonDot salon={s} size={8} />
                          {salonLabel(s)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gv-concepto">{modoVariable === "retiro" ? "Motivo del retiro" : "Concepto"}</Label>
            <Input
              id="gv-concepto"
              placeholder={modoVariable === "retiro" ? "Ej: Retiro de socios" : "Ej: Reparación de heladera"}
              value={nuevoGasto.nombre}
              onChange={(e) => setNuevoGasto((p) => ({ ...p, nombre: e.target.value }))}
            />
            {sugerirCarpeta && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                <div className="flex-1 space-y-1.5">
                  <p>
                    Venís cargando <span className="font-semibold">"{nuevoGasto.nombre.trim()}"</span> seguido. ¿Querés
                    agendarlo como carpeta propia?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-2 text-xs bg-amber-600 text-white hover:bg-amber-700"
                      onClick={() => {
                        setNuevoGasto((p) => ({ ...p, carpeta: nombreNormalizado }))
                        setSugerenciaDescartada(nombreNormalizado)
                      }}
                    >
                      Sí, crear carpeta
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-amber-700 hover:text-amber-900"
                      onClick={() => setSugerenciaDescartada(nombreNormalizado)}
                    >
                      No, gracias
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gv-monto">Monto (ARS)</Label>
            <MoneyInput
              id="gv-monto"
              placeholder="Ej: 50.000"
              value={Number(nuevoGasto.monto) || 0}
              onValueChange={(v) => setNuevoGasto((p) => ({ ...p, monto: v ? String(v) : "" }))}
            />
          </div>
          {modoVariable !== "retiro" && (
            <div className="space-y-1.5">
              <Label htmlFor="gv-carpeta">Carpeta</Label>
              {creandoCarpeta ? (
                // Mini-formulario para crear la carpeta sin salir del diálogo.
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    placeholder="Nombre de la carpeta"
                    value={nombreCarpetaNueva}
                    onChange={(e) => setNombreCarpetaNueva(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                        e.preventDefault()
                        const nombre = nombreCarpetaNueva.trim().toLowerCase()
                        if (nombre) {
                          setNuevoGasto((p) => ({ ...p, carpeta: nombre }))
                          setCreandoCarpeta(false)
                        }
                      }
                      if (e.key === "Escape") setCreandoCarpeta(false)
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!nombreCarpetaNueva.trim()}
                    onClick={() => {
                      const nombre = nombreCarpetaNueva.trim().toLowerCase()
                      if (!nombre) return
                      setNuevoGasto((p) => ({ ...p, carpeta: nombre }))
                      setCreandoCarpeta(false)
                    }}
                  >
                    Crear
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setCreandoCarpeta(false)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Select
                  value={nuevoGasto.carpeta}
                  onValueChange={(v) => {
                    if (v === "__nueva__") {
                      setNombreCarpetaNueva("")
                      setCreandoCarpeta(true)
                      return
                    }
                    setNuevoGasto((p) => ({ ...p, carpeta: v }))
                  }}
                >
                  <SelectTrigger id="gv-carpeta">
                    <SelectValue placeholder="Seleccionar carpeta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="varios">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#0f766e" }} />
                        Varios
                      </span>
                    </SelectItem>
                    <SelectItem value="comisiones">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#b45309" }} />
                        Comisiones
                      </span>
                    </SelectItem>
                    {/* Carpetas creadas por el usuario (existentes en gastos + la recién elegida) */}
                    {[...new Set([
                      ...carpetasExistentes,
                      ...(nuevoGasto.carpeta !== "comisiones" && nuevoGasto.carpeta !== "varios"
                        ? [nuevoGasto.carpeta]
                        : []),
                    ])]
                      .sort((a, b) => a.localeCompare(b))
                      .map((c) => (
                        <SelectItem key={c} value={c}>
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor:
                                  COLORES_CARPETAS_CUSTOM[
                                    Math.abs([...c].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7)) %
                                      COLORES_CARPETAS_CUSTOM.length
                                  ],
                              }}
                            />
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </span>
                        </SelectItem>
                      ))}
                    <SelectItem value="__nueva__">
                      <span className="flex items-center gap-2 font-medium text-primary">
                        <Plus className="h-3.5 w-3.5" />
                        Crear nueva carpeta
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {modoVariable !== "retiro" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gv-fecha-gasto">Fecha del gasto</Label>
                <Input
                  id="gv-fecha-gasto"
                  type="date"
                  value={nuevoGasto.fechaGasto}
                  onChange={(e) => setNuevoGasto((p) => ({ ...p, fechaGasto: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gv-fecha">Vencimiento</Label>
                <Input
                  id="gv-fecha"
                  type="date"
                  value={nuevoGasto.fecha}
                  onChange={(e) => setNuevoGasto((p) => ({ ...p, fecha: e.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground col-span-2">
                La fecha del gasto es opcional (cuándo se hizo). El vencimiento ordena la lista y dispara las alertas.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 border-t pt-3 md:w-64 md:shrink-0 md:border-t-0 md:border-l md:pt-0 md:pl-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              {fechaPanelActual === hoyPanelISO ? "Gastos de hoy" : "Gastos cargados"}
              {salonActual ? ` · ${salonLabel(salonActual)}` : ""}
            </Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label="Día anterior"
                onClick={() => setFechaPanel(cambiarDiaResumen(fechaPanelActual, -1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Input
                type="date"
                className="h-7 flex-1 px-2 text-xs"
                value={fechaPanelActual}
                onChange={(e) => {
                  if (fechaResumenValida(e.target.value)) setFechaPanel(e.target.value)
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label="Día siguiente"
                onClick={() => setFechaPanel(cambiarDiaResumen(fechaPanelActual, 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            {fechaPanelActual !== hoyPanelISO && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                onClick={() => setFechaPanel(null)}
              >
                <CalendarDays className="h-3 w-3" />
                Volver a hoy
              </Button>
            )}
          </div>
          <div className="space-y-1.5 overflow-y-auto pr-1">
            {itemsDelPanel.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin gastos cargados este día.</p>
            ) : (
              itemsDelPanel.map((it) => (
                <div key={`${it.tipo}-${it.id}`} className="rounded-md border border-border p-2 text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-medium">{it.concepto}</span>
                    <span className={`shrink-0 font-semibold ${it.tipo === "retiro" ? "text-red-600" : "text-foreground"}`}>
                      {formatCurrency(it.monto)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
                    <SalonDot salon={it.salon || "General"} size={6} />
                    <span className="truncate">{salonLabel(it.salon || "General")}</span>
                    {it.tipo === "retiro" && <span className="shrink-0 text-red-600">· retiro</span>}
                    {it.hora && <span className="shrink-0">· {it.hora}</span>}
                    {it.cargadoPor && <span className="shrink-0">· {it.cargadoPor}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
          {itemsDelPanel.length > 0 && (
            <div className="flex items-center justify-between border-t border-border pt-1.5 text-xs font-semibold">
              <span>Total</span>
              <span>{formatCurrency(totalDelPanel)}</span>
            </div>
          )}
        </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAgregarGasto}
            disabled={
              modoVariable === "retiro" && !editandoVariableId
                ? !nuevoGasto.nombre || !nuevoGasto.monto || !nuevoGasto.salon
                : !nuevoGasto.nombre ||
                  !nuevoGasto.monto ||
                  !nuevoGasto.fecha ||
                  (nuevoGasto.repartir ? variableRepartoInvalido : !nuevoGasto.salon)
            }
            className={
              modoVariable === "retiro" && !editandoVariableId
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            }
          >
            {editandoVariableId
              ? "Guardar cambios"
              : modoVariable === "retiro"
                ? "Registrar retiro"
                : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

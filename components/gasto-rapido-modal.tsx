"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { repartoValido, totalReparto } from "@/components/reparto-salones-editor"
import { cambiarDiaResumen, fechaArgentina, fechaResumenValida } from "@/lib/resumen-fecha"
import { usuarioActivo, useProfile } from "@/lib/profile-context"
import { puedeEditarCatalogoLimpieza } from "@/lib/stock-salones"
import {
  buscarArticulosLimpieza,
  conceptoGastoLimpieza,
  precioPorUnidadCompra,
  type ArticuloLimpieza,
} from "@/lib/insumos-limpieza"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import type { GastoVariable } from "@/lib/hooks/use-caja-jazmines"
import { fechaNegocio } from "@/lib/ipc-cuotas"
import { MENSAJE_CAMPO_FALTANTE, type DatosGastoRapido } from "@/lib/gasto-rapido-validacion"
import {
  ETIQUETA_PASO,
  MENSAJE_FALTA_PASO,
  faltantesDelPaso,
  montosPorSalon,
  pasosGasto,
  primerPasoIncompleto,
  puedeIrAlPaso,
  type FaltaPaso,
  type PasoGasto,
  gastoConSalones,
  repartoEnPartesIguales,
} from "@/lib/gasto-rapido-pasos"
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  Sparkles,
  SprayCan,
  Square,
  CheckSquare,
  Check,
  X,
  Pencil,
  AlertTriangle,
} from "lucide-react"

/**
 * Paleta para carpetas de gastos variables creadas por el usuario; el color
 * se asigna por hash del nombre para que sea estable entre sesiones.
 * (Misma paleta que usa la lista de carpetas en Caja Jazmines.)
 */
const COLORES_CARPETAS_CUSTOM = ["#7c3aed", "#0369a1", "#be185d", "#4d7c0f", "#b91c1c", "#0e7490"]

function colorCarpeta(c: string): string {
  if (c === "varios") return "#0f766e"
  if (c === "comisiones") return "#b45309"
  return COLORES_CARPETAS_CUSTOM[Math.abs([...c].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7)) % COLORES_CARPETAS_CUSTOM.length]
}

function nombreCarpeta(c: string): string {
  return c.charAt(0).toUpperCase() + c.slice(1)
}

/** "2026-10-22" → "22/10/2026", para la pantalla de Revisar. */
function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-")
  return a && m && d ? `${d}/${m}/${a}` : iso
}

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

const GASTO_VACIO = {
  nombre: "",
  monto: "",
  salon: "",
  fecha: "",
  fechaGasto: "",
  repartir: false,
  distribucion: [] as DistribucionSalon[],
  carpeta: "varios",
}

/**
 * Botones de salón, más rápidos que un desplegable. Con `value` texto se
 * elige uno; con una lista, cada toque prende o apaga ese salón.
 */
function ElegirSalon({
  value,
  onChange,
  opciones,
  invalido,
}: {
  value: string | string[]
  onChange: (s: string) => void
  opciones: readonly string[]
  invalido?: boolean
}) {
  return (
    <div className={`grid grid-cols-2 gap-1.5 sm:grid-cols-3 ${invalido ? "rounded-lg p-1 ring-1 ring-red-500" : ""}`}>
      {opciones.map((s) => {
        const elegido = Array.isArray(value) ? value.includes(s) : value === s
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-pressed={elegido}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors ${
              elegido
                ? "border-purple-600 bg-purple-50 font-medium text-purple-900 dark:bg-purple-950/40 dark:text-purple-100"
                : "border-border hover:bg-muted"
            }`}
          >
            <SalonDot salon={s} size={8} />
            <span className="flex-1 truncate">{salonLabel(s)}</span>
            {elegido && <Check className="h-4 w-4 shrink-0 text-purple-600" />}
          </button>
        )
      })}
    </div>
  )
}

/** Dos opciones lado a lado (Gasto/Retiro, Un salón/Repartir). */
function Segmentado<T extends string>({
  value,
  onChange,
  opciones,
}: {
  value: T
  onChange: (v: T) => void
  opciones: Array<{ value: T; label: string; className?: string }>
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
      {opciones.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            value === o.value ? `bg-background shadow-sm ${o.className ?? "text-foreground"}` : "text-muted-foreground"
          }`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Fila de la pantalla Revisar: dato a la izquierda, valor a la derecha. */
function FilaResumen({ label, children, onEditar }: { label: string; children: ReactNode; onEditar?: () => void }) {
  return (
    <div className="flex items-start gap-2 py-2 sm:gap-3">
      <span className="w-16 shrink-0 pt-0.5 text-xs text-muted-foreground sm:w-20">{label}</span>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {onEditar && (
        <button
          type="button"
          onClick={onEditar}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Cambiar ${label.toLowerCase()}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

/**
 * Diálogo para agendar un gasto variable o registrar un retiro directo de
 * Caja Jazmines. Usado desde Caja Jazmines (con edición) y desde el botón
 * "Cargar gastos" de Inicio (siempre en modo alta).
 *
 * Desde el 22/10/2026 va por pasos, tipo pasarela de pago (pedido de
 * Rodrigo): Qué → Salones → Fecha y pago → Revisar (lib/gasto-rapido-pasos.ts).
 * Lo que se guarda es lo mismo que antes; "Revisar" reemplaza la ventanita
 * de confirmación del navegador.
 */
export function GastoRapidoModal({ open, onOpenChange, costoAEditar, salonActual }: GastoRapidoModalProps) {
  const { state, updateCostoOperativo, addCostoOperativo, archivarGasto, addMovimientosCaja } = useStore()
  const { toast } = useToast()
  const { perfilActivo } = useProfile()

  // ── Compra de un artículo de limpieza (pedido de Rodrigo, 21/10/2026) ────
  // Administración y Soporte, al escribir el concepto, ven los artículos de
  // limpieza que coinciden. Al tildar uno se pide cuánto se compró: el gasto
  // se agenda como siempre y lo comprado se suma al stock de un salón
  // (/api/insumos-limpieza/compra), con el precio por unidad de esta compra.
  const puedeComprarLimpieza = puedeEditarCatalogoLimpieza(perfilActivo?.id)
  const [articulosLimpieza, setArticulosLimpieza] = useState<ArticuloLimpieza[]>([])
  const [articuloCompra, setArticuloCompra] = useState<ArticuloLimpieza | null>(null)
  const [cantidadCompra, setCantidadCompra] = useState("")
  // Si el gasto se reparte entre salones, lo comprado igual se guarda en UNO.
  const [salonStockCompra, setSalonStockCompra] = useState("")
  // uuid de la compra: se genera al tildar el artículo y se reusa en los
  // reintentos, así no se suma dos veces al stock.
  const [idCompra, setIdCompra] = useState("")
  const [guardando, setGuardando] = useState(false)

  const [nuevoGasto, setNuevoGasto] = useState(GASTO_VACIO)
  // Modo "crear nueva carpeta" dentro del selector de carpeta del diálogo.
  const [creandoCarpeta, setCreandoCarpeta] = useState(false)
  const [nombreCarpetaNueva, setNombreCarpetaNueva] = useState("")
  // Si tiene valor, el modal está editando ese costo operativo.
  const [editandoVariableId, setEditandoVariableId] = useState<string | null>(null)
  // Modo del modal: "gasto" agenda un gasto variable; "retiro" extrae dinero
  // de la caja ya mismo, siempre asignado a un salón.
  const [modoVariable, setModoVariable] = useState<"gasto" | "retiro">("gasto")
  // "Descontar del saldo": el gasto nuevo se agenda ya marcado como pagado. Es
  // el mismo dato que deja el círculo "Marcar como pagado" de Caja Jazmines
  // (pagado: true en el gasto) y, como ese botón, descuenta el monto del
  // saldo de Caja Jazmines de cada salón (el store deja el egreso; desde el
  // 14/10/2026). Prendido por defecto desde el 22/10/2026: casi siempre se
  // carga lo que ya se pagó (pedido de Rodrigo); se apaga para agendarlo.
  const [yaPagado, setYaPagado] = useState(true)
  // Paso actual y si hay que marcar en rojo lo que falta en ese paso (se
  // prende al tocar "Siguiente" con datos faltantes; se apaga al cambiar de paso).
  const [paso, setPaso] = useState<PasoGasto>("que")
  const [mostrarFaltas, setMostrarFaltas] = useState(false)
  // Historial del día en el celular: plegado para no empujar el formulario.
  const [historialAbierto, setHistorialAbierto] = useState(false)

  const editando = !!editandoVariableId
  const esRetiro = modoVariable === "retiro" && !editando
  const compraActiva = !!articuloCompra && !editando && modoVariable === "gasto"
  const pasos = pasosGasto(modoVariable, editando)

  const repartoActivo = nuevoGasto.repartir ? nuevoGasto.distribucion.filter((d) => d.salon && d.porcentaje > 0) : []
  // Dónde queda lo comprado: el salón del gasto o, si se reparte, el elegido
  // (solo vale si sigue en el reparto; con un único salón, ese).
  const salonStockEfectivo = !nuevoGasto.repartir
    ? nuevoGasto.salon
    : repartoActivo.some((d) => d.salon === salonStockCompra)
      ? salonStockCompra
      : repartoActivo.length === 1
        ? repartoActivo[0].salon
        : ""

  const datos: DatosGastoRapido = {
    modo: modoVariable,
    editando,
    nombre: nuevoGasto.nombre.trim(),
    monto: nuevoGasto.monto,
    salon: nuevoGasto.salon,
    // La fecha que se exige es la del gasto; el vencimiento es opcional. Un
    // gasto viejo sin fecha del gasto pasa con su vencimiento.
    fecha: nuevoGasto.fechaGasto || nuevoGasto.fecha,
    repartir: nuevoGasto.repartir,
    repartoValido: repartoValido(nuevoGasto.distribucion),
  }
  const compraPasos = compraActiva ? { cantidad: cantidadCompra, salonStock: salonStockEfectivo } : null
  const faltasPaso = faltantesDelPaso(paso, datos, compraPasos)
  const falta = (c: FaltaPaso) => mostrarFaltas && faltasPaso.includes(c)
  const avisoFalta = (c: FaltaPaso) =>
    falta(c) ? (
      <p className="text-xs font-medium text-red-600">
        {c === "cantidad" || c === "salonStock" ? MENSAJE_FALTA_PASO[c] : MENSAJE_CAMPO_FALTANTE[c]}
      </p>
    ) : null

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
    !editando &&
    nuevoGasto.carpeta === "varios" &&
    vecesCargadoAntes >= 1 &&
    sugerenciaDescartada !== nombreNormalizado

  // ── Panel "Gastos de hoy" ────────────────────────────────────────────────
  // Muestra lo que se fue cargando (gastos agendados + retiros) el día
  // elegido, con flechas para viajar en el tiempo (mismo patrón que el
  // selector de fecha de Resumen diario).
  // Días en hora argentina (no UTC): con toISOString() el panel pasaba al
  // día siguiente a las 21:00 y un gasto cargado a la noche aparecía en el
  // día equivocado.
  const hoyPanelISO = fechaArgentina()
  const [fechaPanel, setFechaPanel] = useState<string | null>(null)
  const fechaPanelActual = fechaPanel ?? hoyPanelISO

  // Siempre arranca en el primer paso y mostrando "hoy" cada vez que se abre
  // el modal, con "Descontar del saldo" prendido.
  useEffect(() => {
    if (!open) return
    setFechaPanel(null)
    setYaPagado(true)
    setPaso("que")
    setMostrarFaltas(false)
  }, [open])

  // La lista de artículos de limpieza se trae al abrir. Si falla (o falta la
  // tabla), el diálogo funciona igual, sin sugerencias.
  useEffect(() => {
    if (!open || !puedeComprarLimpieza) return
    let cancelado = false
    fetch("/api/insumos-limpieza")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelado && d?.ok && Array.isArray(d.articulos)) setArticulosLimpieza(d.articulos)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [open, puedeComprarLimpieza])

  // Al abrir para cargar un gasto nuevo, la fecha del gasto arranca con la de
  // hoy en Argentina (fechaNegocio, no toISOString: después de las 21:00
  // daría mañana). Se puede cambiar si el gasto fue otro día. El vencimiento
  // queda vacío (es opcional). En edición se respeta lo guardado.
  useEffect(() => {
    if (!open || costoAEditar) return
    setNuevoGasto((p) => (p.fechaGasto ? p : { ...p, fechaGasto: fechaNegocio() }))
  }, [open, costoAEditar])

  const gastosDelPanel: ItemDelDia[] = (state.costosOperativos || [])
    .filter((c) => c.esVariable && c.createdAt && fechaArgentina(new Date(c.createdAt)) === fechaPanelActual)
    .flatMap((c) => {
      const hora = c.createdAt
        ? new Date(c.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })
        : null
      const dist = (c.distribucion || []).filter((d) => d && d.salon && d.porcentaje > 0)
      if (!salonActual) {
        return [{
          id: c.id,
          concepto: c.concepto,
          monto: c.monto,
          salon: dist.length > 0 ? null : c.salon,
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
    // Fecha del retiro en hora argentina: hoyISO.slice(0, 10) daba el día
    // siguiente para retiros hechos después de las 21:00.
    const fechaCorta = fechaArgentina()
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

  function limpiarCompra() {
    setArticuloCompra(null)
    setCantidadCompra("")
    setSalonStockCompra("")
    setIdCompra("")
  }

  function elegirArticulo(a: ArticuloLimpieza) {
    setArticuloCompra(a)
    setIdCompra(crypto.randomUUID())
    setNuevoGasto((p) => ({ ...p, nombre: a.descripcion, carpeta: "limpieza" }))
  }

  const sugerenciasLimpieza =
    puedeComprarLimpieza && modoVariable === "gasto" && !editando && !articuloCompra
      ? buscarArticulosLimpieza(nuevoGasto.nombre, articulosLimpieza)
      : []
  const cantidadCompraNum = Number(cantidadCompra.replace(",", "."))
  const montoNum = Number(nuevoGasto.monto) || 0
  const precioUnidadCompra = precioPorUnidadCompra(montoNum, cantidadCompraNum)
  const conceptoFinal =
    compraActiva && articuloCompra && cantidadCompraNum > 0
      ? conceptoGastoLimpieza(articuloCompra.descripcion, cantidadCompraNum, articuloCompra.unidad)
      : nuevoGasto.nombre.trim()

  // Sin vencimiento, vence el día del gasto: así Caja Jazmines lo sigue
  // ordenando y sumando como siempre (antes el vencimiento arrancaba en hoy).
  const vencimientoFinal = nuevoGasto.fecha || nuevoGasto.fechaGasto

  function resetear() {
    setNuevoGasto(GASTO_VACIO)
    setCreandoCarpeta(false)
    setEditandoVariableId(null)
    setModoVariable("gasto")
    setYaPagado(true)
    setPaso("que")
    setMostrarFaltas(false)
    setHistorialAbierto(false)
    limpiarCompra()
  }

  function cerrarYResetear() {
    resetear()
    onOpenChange(false)
  }

  // ── Navegación entre pasos ───────────────────────────────────────────────
  const iPaso = pasos.indexOf(paso)
  function irAlPaso(destino: PasoGasto) {
    if (!puedeIrAlPaso(destino, paso, pasos, datos, compraPasos)) {
      // Lleva al primer paso que falta completar y marca qué falta.
      const pendiente = primerPasoIncompleto(pasos, datos, compraPasos)
      if (pendiente) {
        setPaso(pendiente)
        setMostrarFaltas(true)
      }
      return
    }
    setPaso(destino)
    setMostrarFaltas(false)
  }
  function siguiente() {
    if (faltasPaso.length > 0) {
      setMostrarFaltas(true)
      return
    }
    const prox = pasos[iPaso + 1]
    if (prox) {
      setPaso(prox)
      setMostrarFaltas(false)
    }
  }
  function atras() {
    const prev = pasos[iPaso - 1]
    if (prev) {
      setPaso(prev)
      setMostrarFaltas(false)
    }
  }

  async function guardarCompraLimpieza(articulo: ArticuloLimpieza, dist: DistribucionSalon[]) {
    setGuardando(true)
    try {
      // Primero el stock: si falla, no se agenda nada y se puede reintentar.
      const res = await fetchWithRetry("/api/insumos-limpieza/compra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: idCompra,
          insumoId: articulo.id,
          salon: salonStockEfectivo,
          cantidad: cantidadCompraNum,
          monto: montoNum,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        toast({ title: "No se guardó la compra", description: data?.error || "Volvé a intentar.", variant: "destructive" })
        return
      }
      addCostoOperativo({
        concepto: conceptoFinal,
        tipo: "Gastos Generales" as any,
        monto: montoNum,
        frecuencia: "Por Evento",
        esPorPersona: false,
        salon: dist.length > 0 ? null : nuevoGasto.salon,
        activo: true,
        fechaVencimiento: vencimientoFinal,
        fechaGasto: nuevoGasto.fechaGasto || undefined,
        esVariable: true,
        pagado: yaPagado,
        distribucion: dist.length > 0 ? dist : undefined,
        categoria: nuevoGasto.carpeta,
        createdAt: new Date().toISOString(),
        cargadoPor: usuarioActivo() || undefined,
      })
      toast({
        title: "Compra cargada",
        description: `${conceptoFinal}: gasto en Caja Jazmines y stock de ${salonLabel(salonStockEfectivo)} en ${data.nueva ?? "—"} ${articulo.unidad}.`,
      })
      cerrarYResetear()
    } catch {
      toast({ title: "No se guardó la compra", description: "Se cortó la conexión. Volvé a intentar.", variant: "destructive" })
    } finally {
      setGuardando(false)
    }
  }

  function guardar() {
    if (guardando) return
    // Si falta algo (por ejemplo se borró un dato volviendo atrás), lleva al
    // paso que lo pide en vez de guardar a medias.
    const pendiente = primerPasoIncompleto(pasos, datos, compraPasos)
    if (pendiente) {
      setPaso(pendiente)
      setMostrarFaltas(true)
      return
    }
    // Retiro: extrae el dinero de la caja ahora mismo, con salón asignado.
    if (esRetiro) {
      registrarRetiro(nuevoGasto.nombre.trim(), montoNum, nuevoGasto.salon)
      cerrarYResetear()
      return
    }
    const dist = nuevoGasto.repartir ? repartoActivo : []
    if (compraActiva && articuloCompra) {
      void guardarCompraLimpieza(articuloCompra, dist)
      return
    }
    if (editando && editandoVariableId) {
      updateCostoOperativo(editandoVariableId, {
        concepto: nuevoGasto.nombre.trim(),
        monto: montoNum,
        salon: dist.length > 0 ? null : nuevoGasto.salon,
        fechaVencimiento: vencimientoFinal,
        fechaGasto: nuevoGasto.fechaGasto || undefined,
        distribucion: dist.length > 0 ? dist : undefined,
        categoria: nuevoGasto.carpeta,
      })
      toast({ title: "Gasto actualizado", description: nuevoGasto.nombre.trim() })
    } else {
      addCostoOperativo({
        concepto: nuevoGasto.nombre.trim(),
        tipo: "Gastos Generales" as any,
        monto: montoNum,
        frecuencia: "Por Evento",
        esPorPersona: false,
        salon: dist.length > 0 ? null : nuevoGasto.salon,
        activo: true,
        fechaVencimiento: vencimientoFinal,
        fechaGasto: nuevoGasto.fechaGasto || undefined,
        esVariable: true,
        // Mismo dato que deja "Marcar como pagado" en Caja Jazmines.
        pagado: yaPagado,
        distribucion: dist.length > 0 ? dist : undefined,
        categoria: nuevoGasto.carpeta,
        createdAt: new Date().toISOString(),
        cargadoPor: usuarioActivo() || undefined,
      })
      toast({ title: "Gasto agendado", description: nuevoGasto.nombre.trim() })
    }
    cerrarYResetear()
  }

  // ── Contenido de cada paso ───────────────────────────────────────────────
  const pasoQue = (
    <div className="space-y-4">
      {!editando && (
        <Segmentado
          value={modoVariable}
          onChange={(v) => {
            setModoVariable(v)
            setMostrarFaltas(false)
            if (v === "retiro") limpiarCompra()
          }}
          opciones={[
            { value: "gasto", label: "Gasto" },
            { value: "retiro", label: "Retiro de caja", className: "text-red-600" },
          ]}
        />
      )}
      <div className="space-y-1.5">
        <Label htmlFor="gv-concepto">{esRetiro ? "Motivo del retiro" : "Concepto"}</Label>
        {articuloCompra && compraActiva ? (
          <div className="flex items-center gap-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm dark:border-sky-800 dark:bg-sky-950/40">
            <CheckSquare className="h-4 w-4 shrink-0 text-sky-700" />
            <span className="flex-1 truncate font-medium">{articuloCompra.descripcion}</span>
            <span className="shrink-0 text-xs text-muted-foreground">limpieza</span>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-sky-100 hover:text-foreground dark:hover:bg-sky-900/50"
              aria-label="No es una compra de limpieza"
              onClick={limpiarCompra}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Input
            id="gv-concepto"
            autoFocus
            placeholder={esRetiro ? "Ej: Retiro de socios" : "Ej: Reparación de heladera"}
            value={nuevoGasto.nombre}
            onChange={(e) => setNuevoGasto((p) => ({ ...p, nombre: e.target.value }))}
            aria-invalid={falta("nombre")}
          />
        )}
        {avisoFalta("nombre")}
        {sugerenciasLimpieza.length > 0 && (
          <div className="space-y-0.5 rounded-lg border border-sky-200 bg-sky-50 p-1.5 dark:border-sky-900 dark:bg-sky-950/40">
            <p className="flex items-center gap-1.5 px-1.5 pt-0.5 text-xs text-sky-900 dark:text-sky-200">
              <SprayCan className="h-3.5 w-3.5" />
              ¿Compra de limpieza? Tildala y se suma al stock.
            </p>
            {sugerenciasLimpieza.map((a) => (
              <button
                key={a.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-sky-100 dark:hover:bg-sky-900/50"
                onClick={() => elegirArticulo(a)}
              >
                <Square className="h-4 w-4 shrink-0 text-sky-700" />
                <span className="flex-1 truncate">{a.descripcion}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{a.unidad}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={`grid gap-3 ${compraActiva ? "grid-cols-2" : ""}`}>
        <div className="space-y-1.5">
          <Label htmlFor="gv-monto">{compraActiva ? "Total pagado" : "Monto"}</Label>
          <MoneyInput
            id="gv-monto"
            placeholder="$ 0"
            value={montoNum}
            onValueChange={(v) => setNuevoGasto((p) => ({ ...p, monto: v ? String(v) : "" }))}
            aria-invalid={falta("monto")}
          />
          {avisoFalta("monto")}
        </div>
        {compraActiva && articuloCompra && (
          <div className="space-y-1.5">
            <Label htmlFor="gv-cantidad-compra">Cantidad ({articuloCompra.unidad})</Label>
            <Input
              id="gv-cantidad-compra"
              inputMode="decimal"
              placeholder="Ej: 10"
              value={cantidadCompra}
              onChange={(e) => setCantidadCompra(e.target.value.replace(/[^0-9.,]/g, ""))}
              aria-invalid={falta("cantidad")}
            />
            {avisoFalta("cantidad")}
          </div>
        )}
      </div>
      {compraActiva && articuloCompra && precioUnidadCompra > 0 && (
        <p className="text-xs text-muted-foreground">
          Sale {formatCurrency(precioUnidadCompra)} por {articuloCompra.unidad}. Ese pasa a ser el precio del artículo.
        </p>
      )}
    </div>
  )

  // Salones elegidos: uno es "de ese salón"; dos o más, repartido.
  const salonesElegidos = nuevoGasto.repartir ? nuevoGasto.distribucion.map((d) => d.salon) : nuevoGasto.salon ? [nuevoGasto.salon] : []
  function tocarSalon(s: string) {
    const lista = salonesElegidos.includes(s) ? salonesElegidos.filter((x) => x !== s) : [...salonesElegidos, s]
    setNuevoGasto((p) => ({ ...p, ...gastoConSalones(lista, SALONES) }))
    setMostrarFaltas(false)
  }
  function setPorcentajeSalon(salon: string, pct: number) {
    const valor = Math.max(0, Math.min(100, Math.round(pct)))
    setNuevoGasto((p) => ({
      ...p,
      distribucion: p.distribucion.map((d) => (d.salon === salon ? { ...d, porcentaje: valor } : d)),
    }))
  }
  const totalPct = totalReparto(nuevoGasto.distribucion)
  const montosReparto = montosPorSalon(montoNum, nuevoGasto.distribucion)

  const pasoSalones = (
    <div className="space-y-4">
      {esRetiro ? (
        <div className="space-y-1.5">
          <Label>¿De qué salón sale la plata?</Label>
          <ElegirSalon
            value={nuevoGasto.salon}
            onChange={(s) => setNuevoGasto((p) => ({ ...p, salon: s }))}
            opciones={SALONES}
            invalido={falta("salon")}
          />
          {avisoFalta("salon")}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>
            ¿De qué salón o salones?{" "}
            <span className="font-normal text-muted-foreground">Tocá uno o varios</span>
          </Label>
          <ElegirSalon
            value={salonesElegidos}
            onChange={tocarSalon}
            opciones={SALONES}
            invalido={falta("salon") || falta("reparto")}
          />
          {avisoFalta("salon")}
          {nuevoGasto.repartir && (
            <div className="space-y-1.5 rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Se reparte entre {salonesElegidos.length} salones</p>
                <button
                  type="button"
                  className="text-xs font-medium text-purple-600 hover:text-purple-800"
                  onClick={() =>
                    setNuevoGasto((p) => ({ ...p, distribucion: repartoEnPartesIguales(p.distribucion.map((d) => d.salon)) }))
                  }
                >
                  Repartir igual
                </button>
              </div>
              {nuevoGasto.distribucion.map((d) => {
                const enPesos = montosReparto.find((m) => m.salon === d.salon)?.monto ?? 0
                return (
                  <div key={d.salon} className="flex items-center gap-2 text-sm">
                    <SalonDot salon={d.salon} size={8} />
                    <span className="min-w-0 flex-1 truncate">{salonLabel(d.salon)}</span>
                    <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {montoNum > 0 ? formatCurrency(enPesos) : ""}
                    </span>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        aria-label={`Porcentaje de ${salonLabel(d.salon)}`}
                        className="h-8 w-16 text-right"
                        value={d.porcentaje || ""}
                        onChange={(e) => setPorcentajeSalon(d.salon, Number(e.target.value) || 0)}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                )
              })}
              <p className={`text-right text-xs font-medium ${totalPct === 100 ? "text-teal-600" : "text-red-600"}`}>
                Total {totalPct}%{totalPct !== 100 ? " · tiene que dar 100%" : ""}
              </p>
            </div>
          )}
          {avisoFalta("reparto")}
        </div>
      )}
      {compraActiva && articuloCompra && nuevoGasto.repartir && repartoActivo.length > 1 && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <SprayCan className="h-3.5 w-3.5 text-sky-700" />
            ¿En qué salón se guarda lo comprado?
          </Label>
          <ElegirSalon
            value={salonStockEfectivo}
            onChange={setSalonStockCompra}
            opciones={repartoActivo.map((d) => d.salon)}
            invalido={falta("salonStock")}
          />
          {avisoFalta("salonStock")}
        </div>
      )}
    </div>
  )

  const nombresSalonesGasto = salonesElegidos.map((x) => salonLabel(x)).join(", ").replace(/, ([^,]*)$/, " y $1") || "el salón"

  const pasoFecha = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="gv-fecha-gasto">
            Fecha del gasto
            {nuevoGasto.fechaGasto === fechaNegocio() && <span className="font-normal text-muted-foreground"> (hoy)</span>}
          </Label>
          <Input
            id="gv-fecha-gasto"
            type="date"
            value={nuevoGasto.fechaGasto}
            onChange={(e) => setNuevoGasto((p) => ({ ...p, fechaGasto: e.target.value }))}
            aria-invalid={falta("fecha")}
          />
          {avisoFalta("fecha")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gv-fecha">
            Vence <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="gv-fecha"
            type="date"
            value={nuevoGasto.fecha}
            onChange={(e) => setNuevoGasto((p) => ({ ...p, fecha: e.target.value }))}
          />
        </div>
      </div>
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
                  e.stopPropagation()
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
              {/* Varios, Comisiones y las carpetas creadas por el usuario
                  (existentes en gastos + la recién elegida). */}
              {[
                "varios",
                "comisiones",
                ...[...new Set([
                  ...carpetasExistentes,
                  ...(nuevoGasto.carpeta !== "comisiones" && nuevoGasto.carpeta !== "varios" ? [nuevoGasto.carpeta] : []),
                ])].sort((a, b) => a.localeCompare(b)),
              ].map((c) => (
                <SelectItem key={c} value={c}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorCarpeta(c) }} />
                    {nombreCarpeta(c)}
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
        {sugerirCarpeta && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span className="flex-1">
              Venís cargando <span className="font-semibold">"{nuevoGasto.nombre.trim()}"</span> seguido. ¿Le creo una carpeta propia?
            </span>
            <Button
              type="button"
              size="sm"
              className="h-6 bg-amber-600 px-2 text-xs text-white hover:bg-amber-700"
              onClick={() => {
                setNuevoGasto((p) => ({ ...p, carpeta: nombreNormalizado }))
                setSugerenciaDescartada(nombreNormalizado)
              }}
            >
              Sí
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-amber-700 hover:text-amber-900"
              onClick={() => setSugerenciaDescartada(nombreNormalizado)}
            >
              No
            </Button>
          </div>
        )}
      </div>
      {!editando && (
        <label
          htmlFor="gv-ya-pagado"
          className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border p-2.5"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Descontar del saldo</span>
            <span className="block text-xs text-muted-foreground">
              {yaPagado
                ? `Sale de Caja Jazmines de ${nombresSalonesGasto}. Apagalo si todavía no se pagó.`
                : "No se descuenta: queda agendado sin pagar."}
            </span>
          </span>
          <Switch id="gv-ya-pagado" checked={yaPagado} onCheckedChange={setYaPagado} />
        </label>
      )}
    </div>
  )

  const repartoRevisar = montosPorSalon(montoNum, repartoActivo)
  const pasoRevisar = (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-center">
        <p className="text-xs text-muted-foreground">
          {esRetiro ? "Retiro de Caja Jazmines" : editando ? "Gasto variable (editando)" : "Gasto variable · Caja Jazmines"}
        </p>
        <p className={`text-2xl font-bold tabular-nums ${esRetiro ? "text-red-600" : ""}`}>{formatCurrency(montoNum)}</p>
        <p className="truncate text-sm font-medium">{esRetiro ? `Retiro - ${conceptoFinal}` : conceptoFinal}</p>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border px-3">
        <FilaResumen label={esRetiro ? "Sale de" : nuevoGasto.repartir ? "Repartido" : "Salón"} onEditar={() => irAlPaso("salones")}>
          {nuevoGasto.repartir && !esRetiro ? (
            <ul className="space-y-0.5">
              {repartoRevisar.map((m) => (
                <li key={m.salon} className="flex items-center gap-1.5">
                  <SalonDot salon={m.salon} size={8} />
                  <span className="min-w-0 flex-1 break-words">{salonLabel(m.salon)}</span>
                  <span className="whitespace-nowrap tabular-nums">
                    <span className="text-xs text-muted-foreground">{m.porcentaje}% · </span>
                    {formatCurrency(m.monto)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="flex items-center gap-2">
              <SalonDot salon={nuevoGasto.salon} size={8} />
              {salonLabel(nuevoGasto.salon)}
            </span>
          )}
        </FilaResumen>
        {compraActiva && articuloCompra && (
          <FilaResumen label="Stock" onEditar={() => irAlPaso("que")}>
            +{cantidadCompraNum} {articuloCompra.unidad} en {salonLabel(salonStockEfectivo)}
            <span className="block text-xs text-muted-foreground">
              {formatCurrency(precioUnidadCompra)} por {articuloCompra.unidad} pasa a ser el precio del artículo
            </span>
          </FilaResumen>
        )}
        {!esRetiro && (
          <>
            <FilaResumen label="Fecha" onEditar={() => irAlPaso("fecha")}>
              {nuevoGasto.fechaGasto ? fechaCorta(nuevoGasto.fechaGasto) : "—"}
              {nuevoGasto.fechaGasto === fechaNegocio() && <span className="text-xs text-muted-foreground"> (hoy)</span>}
              {nuevoGasto.fecha && nuevoGasto.fecha !== nuevoGasto.fechaGasto && (
                <span className="text-xs text-muted-foreground"> · vence el {fechaCorta(nuevoGasto.fecha)}</span>
              )}
            </FilaResumen>
            <FilaResumen label="Carpeta" onEditar={() => irAlPaso("fecha")}>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorCarpeta(nuevoGasto.carpeta) }} />
                {nombreCarpeta(nuevoGasto.carpeta)}
              </span>
            </FilaResumen>
            {!editando && (
              <FilaResumen label="Pago" onEditar={() => irAlPaso("fecha")}>
                {yaPagado ? (
                  <>
                    Se descuenta del saldo ahora
                    <span className="block text-xs text-muted-foreground">Caja Jazmines de {nombresSalonesGasto}</span>
                  </>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400">No se descuenta: queda pendiente de pago</span>
                )}
              </FilaResumen>
            )}
          </>
        )}
      </div>
      {esRetiro && (
        <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Se descuenta del saldo ahora mismo y queda en el Archivo Histórico y en Actividad.
        </p>
      )}
    </div>
  )

  const contenidoPaso =
    paso === "que" ? pasoQue : paso === "salones" ? pasoSalones : paso === "fecha" ? pasoFecha : pasoRevisar

  const titulo = editando ? "Editar gasto variable" : esRetiro ? "Retiro de caja" : "Cargar gasto"
  const textoGuardar = editando ? "Guardar cambios" : esRetiro ? "Registrar retiro" : "Agregar gasto"

  // ── Historial del día (a la derecha en la compu, plegado en el celular) ──
  const historial = (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
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
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label="Día siguiente"
          onClick={() => setFechaPanel(cambiarDiaResumen(fechaPanelActual, 1))}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      {fechaPanelActual !== hoyPanelISO && (
        <button
          type="button"
          className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setFechaPanel(null)}
        >
          <CalendarDays className="h-3 w-3" />
          Volver a hoy
        </button>
      )}
      <div className="min-h-0 space-y-1 overflow-y-auto pr-1">
        {itemsDelPanel.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin gastos cargados este día.</p>
        ) : (
          itemsDelPanel.map((it) => (
            <div key={`${it.tipo}-${it.id}`} className="rounded-md border border-border px-2 py-1.5 text-xs">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate font-medium">{it.concepto}</span>
                <span className={`shrink-0 font-semibold tabular-nums ${it.tipo === "retiro" ? "text-red-600" : ""}`}>
                  {formatCurrency(it.monto)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
                <SalonDot salon={it.salon || "General"} size={6} />
                <span className="truncate">{it.salon ? salonLabel(it.salon) : "Repartido"}</span>
                {it.tipo === "retiro" && <span className="shrink-0 text-red-600">· retiro</span>}
                {it.hora && <span className="shrink-0">· {it.hora}</span>}
                {it.cargadoPor && <span className="shrink-0">· {it.cargadoPor}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
  const tituloHistorial = `${fechaPanelActual === hoyPanelISO ? "Gastos de hoy" : `Gastos del ${fechaCorta(fechaPanelActual)}`}${
    salonActual ? ` · ${salonLabel(salonActual)}` : ""
  }`

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (guardando) return
        onOpenChange(next)
        if (!next) resetear()
      }}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col gap-3 overflow-hidden sm:max-w-3xl">
        <DialogHeader className="space-y-1">
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription className="sr-only">
            Carga en pasos: qué se gastó, en qué salones, la fecha y el pago, y una revisión final antes de guardar.
          </DialogDescription>
        </DialogHeader>

        {/* Pasos: numerados, se puede volver a cualquiera ya hecho. */}
        <ol className={`grid gap-1 ${pasos.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
          {pasos.map((p, i) => {
            const hecho = i < iPaso
            const actual = p === paso
            return (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => irAlPaso(p)}
                  aria-current={actual ? "step" : undefined}
                  className="flex w-full flex-col items-center gap-1 rounded-md py-1 text-[11px] sm:flex-row sm:justify-center sm:gap-1.5 sm:text-xs"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                      actual
                        ? "bg-purple-600 text-white"
                        : hecho
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-200"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {hecho ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className={actual ? "font-semibold text-foreground" : "text-muted-foreground"}>
                    {ETIQUETA_PASO[p]}
                  </span>
                </button>
                <span className={`mt-1 block h-0.5 rounded-full ${i <= iPaso ? "bg-purple-600" : "bg-muted"}`} aria-hidden="true" />
              </li>
            )
          })}
        </ol>

        <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row md:gap-4">
          <form
            className="min-h-0 flex-1 overflow-y-auto px-0.5 pb-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (paso === "revisar") guardar()
              else siguiente()
            }}
          >
            {contenidoPaso}
            {/* Enter en un campo avanza al paso siguiente. */}
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          </form>

          {/* Historial: columna a la derecha en la compu. */}
          <aside className="hidden min-h-0 flex-col gap-2 border-l border-border pl-4 md:flex md:w-60 md:shrink-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{tituloHistorial}</span>
              {itemsDelPanel.length > 0 && (
                <span className="text-xs font-semibold tabular-nums">{formatCurrency(totalDelPanel)}</span>
              )}
            </div>
            {historial}
          </aside>

          {/* En el celular, plegado debajo para no empujar el formulario. */}
          <div className="shrink-0 rounded-lg border border-border md:hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm"
              onClick={() => setHistorialAbierto((v) => !v)}
              aria-expanded={historialAbierto}
            >
              <span className="font-medium">
                {tituloHistorial} ({itemsDelPanel.length})
              </span>
              <span className="flex items-center gap-1.5">
                {itemsDelPanel.length > 0 && (
                  <span className="text-xs font-semibold tabular-nums">{formatCurrency(totalDelPanel)}</span>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${historialAbierto ? "rotate-180" : ""}`} />
              </span>
            </button>
            {historialAbierto && <div className="flex max-h-48 flex-col border-t border-border p-2">{historial}</div>}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          {iPaso > 0 ? (
            <Button type="button" variant="outline" onClick={atras} disabled={guardando}>
              <ChevronLeft className="h-4 w-4" />
              Atrás
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
          )}
          <div className="flex-1" />
          {paso === "revisar" ? (
            <Button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className={esRetiro ? "bg-red-600 text-white hover:bg-red-700" : "bg-purple-600 text-white hover:bg-purple-700"}
            >
              {guardando ? "Guardando..." : textoGuardar}
            </Button>
          ) : (
            <Button type="button" onClick={siguiente} className="bg-purple-600 text-white hover:bg-purple-700">
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

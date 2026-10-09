"use client"

import { useState, useRef, useCallback, useEffect, memo, type ReactNode } from "react"
import { useStore } from "@/lib/store-context"
import { generateId, type Servicio, type CategoriaServicio } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Tag,
  DollarSign,
  ShoppingBag,
  Minus,
  AlertTriangle,
  RefreshCw,
  ChevronsLeftRight,
  ChevronsRightLeft,
  Info,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { PapeleraServiciosButton } from "@/components/servicios-eliminados-card"
import { ServicioImpactoDialog, type CampoImpacto } from "@/components/servicio-impacto-dialog"

// ─── Constantes ──────────────────────────────────────────────────────────────

const CATEGORIAS: CategoriaServicio[] = [
  "Salon y Espacio",
  "Fotografia y Video",
  "Decoracion",
  "Entretenimiento",
  "Pasteleria",
  "Transporte",
  "Papeleria",
  // "Menú" y "Barra" ya no se eligen: el menú y la barra se configuran desde
  // Recetas y Cócteles (cotizador por salón). Siguen en el tipo
  // CategoriaServicio y en los colores por si algún dato viejo las trae
  // (scripts/017 borró los 7 servicios que las usaban).
  "Otros",
]

const UNIDADES = ["Fijo", "Por Persona", "Por Hora", "Por Cantidad"] as const

const CATEGORIA_COLORS: Record<CategoriaServicio, string> = {
  "Salon y Espacio":    "bg-blue-50 text-blue-700 border-blue-200",
  "Fotografia y Video": "bg-violet-50 text-violet-700 border-violet-200",
  "Decoracion":         "bg-pink-50 text-pink-700 border-pink-200",
  "Entretenimiento":    "bg-amber-50 text-amber-700 border-amber-200",
  "Pasteleria":         "bg-rose-50 text-rose-700 border-rose-200",
  "Transporte":         "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Papeleria":          "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Menú":               "bg-orange-50 text-orange-700 border-orange-200",
  "Barra":              "bg-teal-50 text-teal-700 border-teal-200",
  "Otros":              "bg-gray-50 text-gray-700 border-gray-200",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatARS(value: number | undefined): string {
  if (!value && value !== 0) return ""
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function parseARS(raw: string): number {
  // Los puntos son separadores de miles (formato es-AR): solo cuentan los dígitos.
  const digits = raw.replace(/\D/g, "")
  const n = parseInt(digits, 10)
  return isNaN(n) ? 0 : n
}

/** Formatea un número con puntos de miles (es-AR), sin símbolo de moneda. */
function formatMiles(n: number): string {
  if (!n) return ""
  return n.toLocaleString("es-AR")
}

function margenColor(margen: number): string {
  if (margen >= 30) return "text-emerald-600"
  if (margen >= 10) return "text-amber-600"
  return "text-red-500"
}

// Línea de ayuda del switch "Se paga como sueldo"
const AYUDA_SUELDO =
  "En Caja Eventos aparece en Sueldos, como un pago único el día del evento, en vez de seña y saldo."

// ─── Columnas plegables ──────────────────────────────────────────────────────
// Solo visual: plegar una columna la deja angosta y vacía, no toca ningún dato.
// Cuáles están plegadas se recuerda en este navegador (localStorage).

type ColumnaPlegable =
  | "categoria"
  | "unidad"
  | "venta"
  | "costo"
  | "sena"
  | "margen"
  | "descripcion"
  | "creado"
  | "activo"
  | "sueldo"

const COLUMNAS_PLEGABLES: ColumnaPlegable[] = [
  "categoria", "unidad", "venta", "costo", "sena", "margen", "descripcion", "creado", "activo", "sueldo",
]

const CLAVE_COLUMNAS_PLEGADAS = "finanzas-servicios-columnas-plegadas"

function leerColumnasPlegadas(): Set<ColumnaPlegable> {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_COLUMNAS_PLEGADAS) || "[]")
    if (!Array.isArray(guardado)) return new Set()
    return new Set(guardado.filter((c): c is ColumnaPlegable => COLUMNAS_PLEGABLES.includes(c)))
  } catch {
    return new Set()
  }
}

function guardarColumnasPlegadas(plegadas: Set<ColumnaPlegable>) {
  try {
    localStorage.setItem(CLAVE_COLUMNAS_PLEGADAS, JSON.stringify([...plegadas]))
  } catch {
    // Sin localStorage (ventana privada, etc.): se pliega igual, solo que no se recuerda.
  }
}

interface ThPlegableProps {
  etiqueta: string
  plegada: boolean
  onToggle: () => void
  className?: string
  title?: string
  children: ReactNode
}

/** Encabezado con botón para plegar. Plegado: columna angosta con el nombre vertical. */
function ThPlegable({ etiqueta, plegada, onToggle, className, title, children }: ThPlegableProps) {
  if (plegada) {
    return (
      <th className="w-8 px-0 py-1.5 align-top">
        <button
          type="button"
          onClick={onToggle}
          title={`Mostrar ${etiqueta}`}
          aria-label={`Mostrar columna ${etiqueta}`}
          className="min-h-0 mx-auto flex flex-col items-center gap-1 rounded px-1 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronsLeftRight className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap [writing-mode:vertical-rl] rotate-180">
            {etiqueta}
          </span>
        </button>
      </th>
    )
  }
  return (
    <th className={cn("group/col relative", className)} title={title}>
      {children}
      <button
        type="button"
        onClick={onToggle}
        title={`Plegar ${etiqueta}`}
        aria-label={`Plegar columna ${etiqueta}`}
        className="min-h-0 absolute top-0.5 right-0.5 p-0.5 rounded text-muted-foreground opacity-0 group-hover/col:opacity-100 focus-visible:opacity-100 hover:bg-muted hover:text-foreground transition-opacity"
      >
        <ChevronsRightLeft className="h-3 w-3" />
      </button>
    </th>
  )
}

/** Celda de una columna plegada (angosta y vacía). */
function TdPlegada() {
  return <td className="w-8 bg-muted/30" />
}

// ─── Celda editable inline ────────────────────────────────────────────────────

interface EditableCellProps {
  value: string
  onCommit: (val: string) => void
  placeholder?: string
  numeric?: boolean
  /** Textarea multilinea para textos largos (ej: letra chica del contrato, ~90 palabras) */
  multiline?: boolean
  className?: string
}

function EditableCell({ value, onCommit, placeholder = "—", numeric = false, multiline = false, className }: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
    setTimeout(() => (multiline ? textareaRef.current?.focus() : inputRef.current?.select()), 0)
  }

  const commit = () => {
    setEditing(false)
    onCommit(draft)
  }

  const cancel = () => {
    setEditing(false)
    setDraft(value)
  }

  if (editing) {
    if (multiline) {
      // Textarea amplio para la letra chica del contrato (textos de ~90 palabras)
      return (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel()
          }}
          rows={5}
          className={cn(
            "w-full min-h-[110px] px-2.5 py-2 text-[13px] leading-snug border border-primary/60 rounded outline-none bg-primary/5 focus:bg-white resize-y",
            className
          )}
          placeholder="Letra chica que se imprime en el contrato"
          autoFocus
        />
      )
    }
    if (numeric) {
      // Input numérico con símbolo $ visual (meramente estético)
      return (
        <div className="relative w-full">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[14px] pointer-events-none select-none">
            $
          </span>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              // Formatear con puntos de miles mientras se escribe
              const digits = e.target.value.replace(/\D/g, "")
              setDraft(digits ? Number(digits).toLocaleString("es-AR") : "")
            }}
            onBlur={commit}
            inputMode="numeric"
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") cancel()
            }}
            className={cn(
              "w-full h-8 pl-6 pr-2.5 text-[14px] border border-primary/60 rounded outline-none bg-primary/5 focus:bg-white text-right tabular-nums",
              className
            )}
            autoFocus
          />
        </div>
      )
    }
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") cancel()
        }}
        className={cn(
          "w-full h-8 px-2.5 text-[14px] border border-primary/60 rounded outline-none bg-primary/5 focus:bg-white",
          className
        )}
        autoFocus
      />
    )
  }

  if (multiline) {
    // Vista de solo lectura: muestra hasta 3 líneas; el texto completo en tooltip
    return (
      <div
        onClick={startEdit}
        className={cn(
          "group relative min-h-8 flex items-start px-2.5 py-1 rounded cursor-pointer hover:bg-muted/70 transition-colors text-[13px] leading-snug",
          !value && "text-muted-foreground/50 italic",
          className
        )}
        title={value || "Clic para editar"}
      >
        <span className="line-clamp-3 whitespace-pre-line pr-4">{value || placeholder}</span>
        <span className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-40 transition-opacity text-[10px] text-muted-foreground">
          ✎
        </span>
      </div>
    )
  }

  return (
    <div
      onClick={startEdit}
      className={cn(
        "group relative min-h-8 flex items-center px-2.5 py-1 leading-snug rounded cursor-pointer hover:bg-muted/70 transition-colors text-[14px]",
        !value && "text-muted-foreground/50 italic",
        numeric && "justify-end tabular-nums",
        className
      )}
      title="Clic para editar"
    >
      {numeric && value ? `$ ${value}` : value || placeholder}
      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity text-[10px] text-muted-foreground">
        ✎
      </span>
    </div>
  )
}

// ─── Filas separadoras de año (verdes) ────────────────────────────────────────
// Son filas de la misma tabla, marcadas con codigo="SEPARADOR" y activo=false,
// por lo que nunca aparecen como servicios contratables en eventos.
const esSeparador = (s: Servicio) => s.codigo === "SEPARADOR"

// Diálogo con estado propio: al tipear acá NO se re-renderiza la tabla entera
// (eso era lo que tildaba la compu al crear separadores).
const SeparadorDialog = memo(function SeparadorDialog({
  open,
  onOpenChange,
  onCrear,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCrear: (texto: string) => void
}) {
  const [texto, setTexto] = useState("")

  const handleCrear = () => {
    const t = texto.trim()
    if (!t) return
    onCrear(t)
    setTexto("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setTexto("")
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo separador</DialogTitle>
          <DialogDescription>
            Crea una fila verde para organizar la tabla. Escribí un año (ej: 2029) o el texto que quieras.
            Después ubicala con las flechas de subir/bajar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ej: 2029, PROMOS, EXTRAS..."
            maxLength={40}
            autoFocus
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.nativeEvent.isComposing &&
                (e as unknown as { keyCode?: number }).keyCode !== 229
              ) {
                handleCrear()
              }
            }}
          />
          {texto.trim() && (
            <div className="rounded-md bg-emerald-600 px-3 py-1.5">
              <span className="text-white font-bold text-[15px] uppercase tracking-widest">{texto.trim()}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleCrear}
            disabled={!texto.trim()}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Crear separador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

// ─── Página principal ─────────────────────────────────────────────────────────

export default function FinanzasServiciosPage() {
  const { servicios, addServicio, updateServicio, deleteServicio, setServicios, eventos, serviciosSincronizados, recargarServicios } = useStore()
  const { toast } = useToast()

  // ── Reintentar traer los servicios de la base (ver aviso arriba de la tabla)
  const [reintentando, setReintentando] = useState(false)
  const handleReintentar = async () => {
    setReintentando(true)
    const ok = await recargarServicios()
    setReintentando(false)
    toast(ok
      ? { title: "Servicios actualizados", description: "La lista ya coincide con la base. Podés editar." }
      : { title: "Sigue sin conexión con la base", description: "Probá de nuevo en unos segundos.", variant: "destructive" })
  }

  const [busqueda, setBusqueda] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaServicio | "todas">("todas")
  const [idEliminar, setIdEliminar] = useState<string | null>(null)
  const [confirmoCongelado, setConfirmoCongelado] = useState(false)
  const [separadorDialogOpen, setSeparadorDialogOpen] = useState(false)
  const [separadorEliminar, setSeparadorEliminar] = useState<Servicio | null>(null)

  // Explicación y leyenda de la tarjeta de arriba: plegadas por defecto.
  const [infoAbierta, setInfoAbierta] = useState(false)

  // Columnas plegadas: arranca todo abierto y después lee lo recordado en este
  // navegador (en un efecto, para no chocar con el render del servidor).
  const [plegadas, setPlegadas] = useState<Set<ColumnaPlegable>>(() => new Set())
  useEffect(() => {
    setPlegadas(leerColumnasPlegadas())
  }, [])
  const plegada = (col: ColumnaPlegable) => plegadas.has(col)
  const togglePlegada = (col: ColumnaPlegable) => {
    setPlegadas((prev) => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      guardarColumnasPlegadas(next)
      return next
    })
  }

  // ── Servicios ordenados (orden manual tipo Excel) ─────────────────────────
  const serviciosOrdenados = servicios
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.orden ?? a.i) - (b.s.orden ?? b.i) || a.i - b.i)
    .map((x) => x.s)

  // ── Servicios filtrados ────────────────────────────────────────────────────
  // Nota: acá se muestran también los desactivados (con el toggle apagado).
  // En el resto del sistema (eventos, contratos, etc.) los inactivos no aparecen.
  const serviciosFiltrados = serviciosOrdenados.filter((s) => {
    if (esSeparador(s)) return !busqueda && categoriaFiltro === "todas"
    if (categoriaFiltro !== "todas" && s.categoria !== categoriaFiltro) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return (
        s.nombre.toLowerCase().includes(q) ||
        s.descripcion?.toLowerCase().includes(q) ||
        s.categoria.toLowerCase().includes(q) ||
        s.codigo?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const serviciosReales = serviciosFiltrados.filter((s) => !esSeparador(s))

  // ── Mover fila arriba/abajo (persiste el orden en la base) ────────────────
  const moverServicio = async (id: string, dir: -1 | 1) => {
    // Guarda servicios completos: sin la lista real de la base no se toca nada.
    if (!serviciosSincronizados) {
      toast({ title: "No se puede mover todavía", description: "La lista de servicios no se pudo traer de la base. Tocá \"Reintentar\".", variant: "destructive" })
      return
    }
    const idx = serviciosFiltrados.findIndex((s) => s.id === id)
    const vecino = serviciosFiltrados[idx + dir]
    if (idx === -1 || !vecino) return
    // Normalizar: asignar orden secuencial según la lista completa actual
    const ordenes = new Map(serviciosOrdenados.map((s, i) => [s.id, i]))
    // Intercambiar las posiciones de la fila y su vecina
    const a = ordenes.get(id)!
    const b = ordenes.get(vecino.id)!
    ordenes.set(id, b)
    ordenes.set(vecino.id, a)
    // Actualizar el estado local en una sola pasada
    const cambiados: Servicio[] = []
    const nuevos = servicios.map((s) => {
      const nuevoOrden = ordenes.get(s.id)
      if (nuevoOrden === undefined || s.orden === nuevoOrden) return s
      const actualizado = { ...s, orden: nuevoOrden }
      cambiados.push(actualizado)
      return actualizado
    })
    setServicios(nuevos)
    // Persistir en Supabase solo los servicios cuyo orden cambió
    try {
      const { upsertServicio } = await import("@/lib/supabase/data-service")
      await Promise.all(cambiados.map((s) => upsertServicio(s)))
    } catch (error) {
      console.error("[v0] Error persistiendo orden de servicios:", error)
      toast({ title: "Error al guardar el orden", description: "Revisá tu conexión e intentá de nuevo.", variant: "destructive" })
    }
  }

  // ── Totales pie de tabla (sin contar filas separadoras de año) ────────────
  const totalVenta = serviciosReales.reduce((sum, s) => sum + (s.precioVenta ?? 0), 0)
  const totalCosto = serviciosReales.reduce((sum, s) => sum + (s.costoParaCajaEventos ?? 0), 0)

  // ── Agregar fila nueva ─────────────────────────────────────────────────────
  const handleAgregarFila = () => {
    const nuevo: Servicio = {
      id: generateId(),
      codigo: `SRV-${Date.now().toString(36).toUpperCase()}`,
      nombre: "Nuevo servicio",
      descripcion: "",
      categoria: "Otros",
      margenGanancia: 0,
      unidad: "Fijo",
      precioVenta: 0,
      costoParaCajaEventos: 0,
      porcentajeSeña: 30,
      diasAnticipacionSeña: 30,
      diasAnticipacionSaldo: 7,
      activo: true,
    }
    addServicio(nuevo)
    toast({ title: "Servicio agregado", description: "Editá las celdas directamente." })
  }

  // ── Crear fila separadora (verde) con texto libre ──────────────────────────
  const handleCrearSeparador = (texto: string) => {
    const nuevo: Servicio = {
      id: generateId(),
      codigo: "SEPARADOR",
      nombre: texto,
      descripcion: "",
      categoria: "Otros",
      margenGanancia: 0,
      unidad: "Fijo",
      precioVenta: 0,
      costoParaCajaEventos: 0,
      porcentajeSeña: 0,
      diasAnticipacionSeña: 30,
      diasAnticipacionSaldo: 7,
      activo: false,
      orden: serviciosOrdenados.length,
    }
    // Cerrar el diálogo ANTES de tocar el estado global para que la UI responda al instante
    setSeparadorDialogOpen(false)
    addServicio(nuevo)
    toast({
      title: "Separador creado",
      description: `"${texto}" se agregó al final de la tabla. Usá las flechas para ubicarlo.`,
    })
  }

  // ── Eliminar separador (confirmación simple, sin papelera ni congelamiento) ─
  const handleEliminarSeparador = () => {
    if (!separadorEliminar) return
    deleteServicio(separadorEliminar.id)
    setSeparadorEliminar(null)
    toast({ title: "Separador eliminado" })
  }

  // ── Handlers de actualización inline ─────────────────────────────────────
  const update = useCallback(
    (id: string, patch: Partial<Servicio>) => {
      updateServicio(id, patch)
    },
    [updateServicio]
  )

  /**
   * Cambio de monto pendiente de confirmación. Los montos de los eventos se
   * recalculan en vivo desde el catálogo, así que antes de guardar mostramos
   * el impacto real en cada evento contratado (ServicioImpactoDialog).
   */
  const [cambioMonto, setCambioMonto] = useState<{
    servicio: Servicio
    campo: CampoImpacto
    valorNuevo: number
  } | null>(null)

  const confirmarCambioMonto = () => {
    if (!cambioMonto) return
    const { servicio, campo, valorNuevo } = cambioMonto
    update(servicio.id, { [campo]: valorNuevo } as Partial<Servicio>)
    setCambioMonto(null)
    toast({
      title: "Monto actualizado",
      description: `Los montos de los eventos con "${servicio.nombre}" ya quedaron recalculados.`,
    })
  }

  const handleEliminarConfirm = () => {
    if (!idEliminar || !confirmoCongelado) return
    deleteServicio(idEliminar)
    setIdEliminar(null)
    setConfirmoCongelado(false)
    toast({
      title: "Servicio movido a la papelera",
      description: "Podés restaurarlo desde el botón Papelera, arriba a la derecha.",
    })
  }

  // Eventos que tienen contratado el servicio a eliminar (para avisar antes de borrar)
  const eventosConServicio = idEliminar
    ? (eventos || []).filter((ev) => (ev.servicios || []).some((s) => s.servicioId === idEliminar))
    : []

  // ─── Render ───────────────────────────────────────────────────────────��───
  return (
    <div className="flex flex-col h-full min-h-0 p-6 gap-4 lg:h-dvh lg:p-4 lg:gap-3">

      {/* Tarjeta única: título, filtros y botones en una línea; la explicación y
          la leyenda quedan plegadas para dejarle más lugar a la tabla. */}
      <div className="shrink-0 rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <h1 className="text-xl font-bold text-foreground mr-1">Servicios</h1>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar servicio..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select
            value={categoriaFiltro}
            onValueChange={(v) => setCategoriaFiltro(v as CategoriaServicio | "todas")}
          >
            <SelectTrigger className="w-[190px] h-9">
              <SelectValue placeholder="Todas las categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorias</SelectItem>
              {CATEGORIAS.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {serviciosReales.length} servicio{serviciosReales.length !== 1 ? "s" : ""}
          </span>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <PapeleraServiciosButton />
            <Button
              variant="outline"
              onClick={() => setSeparadorDialogOpen(true)}
              className="gap-2 border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white"
            >
              <Minus className="h-4 w-4" />
              Separadores
            </Button>
            <Button onClick={handleAgregarFila} className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar servicio
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setInfoAbierta((v) => !v)}
              title={infoAbierta ? "Ocultar explicación" : "Ver explicación de las columnas"}
              aria-label={infoAbierta ? "Ocultar explicación" : "Ver explicación de las columnas"}
              aria-expanded={infoAbierta}
              className="text-muted-foreground"
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {infoAbierta && (
          <div className="flex flex-col gap-1.5 border-t border-border px-3 py-2 text-[12px] text-muted-foreground">
            <p className="text-sm">
              Configurá el precio de venta (contrato) y el costo que impacta en Caja Eventos.
            </p>
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300" />
                Precio Venta = precio que figura en el contrato
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-100 border border-rose-300" />
                Costo Caja Eventos = egreso que impacta en Caja Eventos al registrar el servicio
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground/80">Se paga como sueldo:</span> {AYUDA_SUELDO}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-semibold text-emerald-600">Verde</span> ≥ 30% &nbsp;
                <span className="font-semibold text-amber-600">Naranja</span> 10-30% &nbsp;
                <span className="font-semibold text-red-500">Rojo</span> {`< 10%`}
              </span>
              <span>Cada columna se pliega con el botón chico arriba a la derecha de su título.</span>
            </div>
          </div>
        )}
      </div>

      {/* Aviso: la lista no vino de la base (falló la carga al abrir el sistema) */}
      {!serviciosSincronizados && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800 shrink-0">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm flex-1">
            <strong>No se pudo traer la lista de servicios de la base.</strong> La tabla puede estar
            vacía o incompleta y no coincidir con los contratos. No se puede editar hasta reintentar.
          </p>
          <Button size="sm" variant="outline" onClick={handleReintentar} disabled={reintentando} className="border-red-300 bg-white">
            <RefreshCw className={cn("h-4 w-4", reintentando && "animate-spin")} />
            Reintentar
          </Button>
        </div>
      )}

      {/* Tabla estilo spreadsheet */}
      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-[14px] border-collapse min-w-[920px]">
          <thead>
            <tr className="bg-muted border-b border-border sticky top-0 z-10 shadow-[0_1px_0_var(--border)]">
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground w-[58px] text-[13px] uppercase tracking-wide">#</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground text-[13px] uppercase tracking-wide">Nombre</th>
              <ThPlegable etiqueta="Categoría" plegada={plegada("categoria")} onToggle={() => togglePlegada("categoria")} className="px-3 pt-5 pb-1.5 text-left font-semibold text-muted-foreground text-[13px] uppercase tracking-wide w-[165px]">
                Categoria
              </ThPlegable>
              <ThPlegable etiqueta="Unidad" plegada={plegada("unidad")} onToggle={() => togglePlegada("unidad")} className="px-3 pt-5 pb-1.5 text-left font-semibold text-muted-foreground text-[13px] uppercase tracking-wide w-[125px]">
                Unidad
              </ThPlegable>
              <ThPlegable etiqueta="Venta" plegada={plegada("venta")} onToggle={() => togglePlegada("venta")} className="px-3 pt-5 pb-1.5 text-right font-semibold text-[13px] uppercase tracking-wide w-[170px]">
                <span className="flex items-center justify-end gap-1 text-emerald-700">
                  <ShoppingBag className="h-4 w-4" />
                  Precio Venta
                </span>
              </ThPlegable>
              <ThPlegable etiqueta="Costo" plegada={plegada("costo")} onToggle={() => togglePlegada("costo")} className="px-3 pt-5 pb-1.5 text-right font-semibold text-[13px] uppercase tracking-wide w-[170px]">
                <span className="flex items-center justify-end gap-1 text-rose-600">
                  <DollarSign className="h-4 w-4" />
                  Costo Caja Eventos
                </span>
              </ThPlegable>
              <ThPlegable etiqueta="Seña" plegada={plegada("sena")} onToggle={() => togglePlegada("sena")} className="px-3 pt-5 pb-1.5 text-right font-semibold text-[13px] uppercase tracking-wide w-[150px]">
                <span className="flex items-center justify-end gap-1 text-amber-600">
                  <Tag className="h-4 w-4" />
                  Seña por evento
                </span>
              </ThPlegable>
              <ThPlegable etiqueta="Margen" plegada={plegada("margen")} onToggle={() => togglePlegada("margen")} className="px-2 pt-5 pb-1.5 text-right font-semibold text-muted-foreground text-[13px] uppercase tracking-wide w-[95px]">
                Margen
              </ThPlegable>
              <ThPlegable etiqueta="Descripción" plegada={plegada("descripcion")} onToggle={() => togglePlegada("descripcion")} className="px-3 pt-5 pb-1.5 text-left font-semibold text-muted-foreground text-[13px] uppercase tracking-wide">
                Descripcion (letra chica del contrato)
              </ThPlegable>
              <ThPlegable etiqueta="Creado" plegada={plegada("creado")} onToggle={() => togglePlegada("creado")} className="px-2 pt-5 pb-1.5 text-right font-semibold text-muted-foreground text-[13px] uppercase tracking-wide w-[110px]">
                Creado
              </ThPlegable>
              <ThPlegable etiqueta="Activo" plegada={plegada("activo")} onToggle={() => togglePlegada("activo")} className="px-2 pt-5 pb-1.5 text-center font-semibold text-muted-foreground text-[11px] uppercase tracking-wide w-[70px]">
                Activo
              </ThPlegable>
              <ThPlegable
                etiqueta="Sueldo"
                plegada={plegada("sueldo")}
                onToggle={() => togglePlegada("sueldo")}
                className="px-2 pt-5 pb-1.5 text-center font-semibold text-muted-foreground text-[11px] uppercase tracking-wide leading-tight w-[96px]"
                title={AYUDA_SUELDO}
              >
                Se paga como sueldo
              </ThPlegable>
              <th className="px-2 py-1.5 w-10" />
            </tr>
          </thead>

          <tbody>
            {serviciosFiltrados.length === 0 && (
              <tr>
                <td colSpan={13} className="text-center py-16 text-muted-foreground">
                  {busqueda || categoriaFiltro !== "todas"
                    ? "No se encontraron servicios con esos filtros."
                    : "No hay servicios. Hacé clic en \"Agregar servicio\" para empezar."}
                </td>
              </tr>
            )}

            {serviciosFiltrados.map((s, idx) => {
              // Fila separadora de año: verde, letra blanca, solo se puede subir/bajar y borrar.
              if (esSeparador(s)) {
                return (
                  <tr key={s.id} className="border-b border-border/60 bg-emerald-600 group">
                    <td className="px-1.5 py-[3px] select-none">
                      <div className="flex items-center gap-1">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => moverServicio(s.id, -1)}
                            disabled={idx === 0}
                            className="min-h-0 p-0.5 rounded text-white/60 hover:text-white hover:bg-emerald-700 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                            title="Subir fila"
                            aria-label={`Subir separador ${s.nombre}`}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moverServicio(s.id, 1)}
                            disabled={idx === serviciosFiltrados.length - 1}
                            className="min-h-0 p-0.5 rounded text-white/60 hover:text-white hover:bg-emerald-700 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                            title="Bajar fila"
                            aria-label={`Bajar separador ${s.nombre}`}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td colSpan={11} className="px-3 py-1.5">
                      <span className="text-white font-bold text-[15px] uppercase tracking-widest">{s.nombre}</span>
                    </td>
                    <td className="px-2 py-[3px]">
                      <button
                        type="button"
                        onClick={() => setSeparadorEliminar(s)}
                        className="min-h-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-emerald-700 text-white/60 hover:text-white"
                        title="Eliminar separador"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              }

              const venta = s.precioVenta ?? 0
              const costo = s.costoParaCajaEventos ?? 0
              const ganancia = venta - costo
              const margen = costo > 0 ? (ganancia / costo) * 100 : 0

              return (
                <tr
                  key={s.id}
                  className={cn(
                    "border-b border-border/60 hover:bg-muted/30 transition-colors group",
                    idx % 2 === 0 ? "bg-card" : "bg-muted/10",
                    !s.activo && "opacity-50"
                  )}
                >
                  {/* Nro fila + mover */}
                  <td className="px-1.5 py-[3px] select-none">
                    <div className="flex items-center gap-1">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moverServicio(s.id, -1)}
                          disabled={idx === 0}
                          className="min-h-0 p-0.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:pointer-events-none transition-colors"
                          title="Subir fila"
                          aria-label={`Subir ${s.nombre}`}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moverServicio(s.id, 1)}
                          disabled={idx === serviciosFiltrados.length - 1}
                          className="min-h-0 p-0.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:pointer-events-none transition-colors"
                          title="Bajar fila"
                          aria-label={`Bajar ${s.nombre}`}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-muted-foreground/50 text-[13px] tabular-nums">{idx + 1}</span>
                    </div>
                  </td>

                  {/* Nombre */}
                  <td className="px-1.5 py-[3px] min-w-[120px]">
                    <EditableCell
                      value={s.nombre}
                      placeholder="Nombre del servicio"
                      onCommit={(v) => update(s.id, { nombre: v.trim() || s.nombre })}
                    />
                  </td>

                  {/* Categoria */}
                  {plegada("categoria") ? <TdPlegada /> : (
                    <td className="px-2 py-[3px]">
                      <Select
                        value={s.categoria}
                        onValueChange={(v) => update(s.id, { categoria: v as CategoriaServicio })}
                      >
                        <SelectTrigger className="h-8 min-h-0 border-0 bg-transparent shadow-none px-1.5 hover:bg-muted/70 focus:ring-0 gap-1 text-[14px] [&>svg]:hidden">
                          <Badge
                            variant="outline"
                            className={cn("text-[13px] font-medium px-2 py-0.5 border", CATEGORIA_COLORS[s.categoria])}
                          >
                            {s.categoria}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              <Badge variant="outline" className={cn("text-[13px] font-medium", CATEGORIA_COLORS[cat])}>
                                {cat}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )}

                  {/* Unidad */}
                  {plegada("unidad") ? <TdPlegada /> : (
                    <td className="px-2 py-[3px]">
                      <Select
                        value={s.unidad}
                        onValueChange={(v) => update(s.id, { unidad: v as Servicio["unidad"] })}
                      >
                        <SelectTrigger className="h-8 min-h-0 border-0 bg-transparent shadow-none px-1.5 hover:bg-muted/70 focus:ring-0 text-[14px] [&>svg]:hidden">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )}

                  {/* Precio Venta */}
                  {plegada("venta") ? <TdPlegada /> : (
                    <td className="px-1.5 py-[3px]">
                      <EditableCell
                        value={formatMiles(venta)}
                        placeholder="0"
                        numeric
                        onCommit={(v) => {
                              const nuevo = parseARS(v)
                              if (nuevo === venta) return
                              setCambioMonto({ servicio: s, campo: "precioVenta", valorNuevo: nuevo })
                        }}
                      />
                    </td>
                  )}

                  {/* Costo Caja Eventos */}
                  {plegada("costo") ? <TdPlegada /> : (
                    <td className="px-1.5 py-[3px]">
                      <EditableCell
                        value={formatMiles(costo)}
                        placeholder="0"
                        numeric
                        onCommit={(v) => {
                              const nuevo = parseARS(v)
                              if (nuevo === costo) return
                              setCambioMonto({ servicio: s, campo: "costoParaCajaEventos", valorNuevo: nuevo })
                        }}
                      />
                    </td>
                  )}

                  {/* Seña por evento */}
                  {plegada("sena") ? <TdPlegada /> : (
                    <td className="px-1.5 py-[3px]">
                      <EditableCell
                        value={s.costoParaCajaEventos && s.porcentajeSeña
                          ? formatMiles(Math.round((s.costoParaCajaEventos * (s.porcentajeSeña ?? 30)) / 100))
                          : ""}
                        placeholder="0"
                        numeric
                        onCommit={(v) => {
                          const montoSeña = parseARS(v)
                          const base = s.costoParaCajaEventos ?? 0
                          const pct = base > 0 ? Math.round((montoSeña / base) * 100) : 30
                              if (pct === (s.porcentajeSeña ?? 30)) return
                              setCambioMonto({ servicio: s, campo: "porcentajeSeña", valorNuevo: pct })
                        }}
                      />
                    </td>
                  )}

                  {/* Margen */}
                  {plegada("margen") ? <TdPlegada /> : (
                    <td className="px-2 py-[3px] text-right tabular-nums">
                      {venta > 0 && costo > 0 ? (
                        <span className={cn("font-semibold text-[14px]", margenColor(margen))}>
                          {margen.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  )}

                  {/* Descripcion = letra chica que se imprime en el contrato (~90 palabras) */}
                  {plegada("descripcion") ? <TdPlegada /> : (
                    <td className="px-1.5 py-[3px] min-w-[160px] align-top">
                      <EditableCell
                        value={s.descripcion ?? ""}
                        placeholder="Letra chica del contrato"
                        multiline
                        onCommit={(v) => update(s.id, { descripcion: v })}
                      />
                    </td>
                  )}

                  {/* Fecha de creación */}
                  {plegada("creado") ? <TdPlegada /> : (
                    <td className="px-2 py-[3px] text-right tabular-nums text-[13px] text-muted-foreground whitespace-nowrap">
                      {s.createdAt
                        ? new Date(s.createdAt).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                          })
                        : "—"}
                    </td>
                  )}

                  {/* Activo / Inactivo */}
                  {plegada("activo") ? <TdPlegada /> : (
                    <td className="px-2 py-[3px] text-center">
                      <Switch
                        checked={s.activo}
                        onCheckedChange={(checked) => update(s.id, { activo: checked })}
                        title={s.activo ? "Servicio activo (visible en eventos)" : "Servicio desactivado (oculto en eventos)"}
                        aria-label={`${s.activo ? "Desactivar" : "Activar"} ${s.nombre}`}
                      />
                    </td>
                  )}

                  {/* Se paga como sueldo (pago único el día del evento, ver lib/servicio-sueldo.ts) */}
                  {plegada("sueldo") ? <TdPlegada /> : (
                    <td className="px-2 py-[3px] text-center">
                      <Switch
                        checked={s.sePagaComoSueldo === true}
                        onCheckedChange={(checked) => update(s.id, { sePagaComoSueldo: checked })}
                        title={AYUDA_SUELDO}
                        aria-label={`${s.sePagaComoSueldo ? "Dejar de pagar" : "Pagar"} ${s.nombre} como sueldo`}
                      />
                    </td>
                  )}

                  {/* Eliminar */}
                  <td className="px-2 py-[3px]">
                    <button
                      type="button"
                      onClick={() => setIdEliminar(s.id)}
                      className="min-h-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Eliminar servicio"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Footer totales */}
          {serviciosFiltrados.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/60 font-semibold">
                <td colSpan={4} className="px-3 py-2.5 text-sm text-muted-foreground">
                  Total ({serviciosReales.length} servicio{serviciosReales.length !== 1 ? "s" : ""})
                </td>
                {plegada("venta") ? <TdPlegada /> : (
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                    {formatARS(totalVenta)}
                  </td>
                )}
                {plegada("costo") ? <TdPlegada /> : (
                  <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">
                    {formatARS(totalCosto)}
                  </td>
                )}
                {plegada("sena") ? <TdPlegada /> : (
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-700 font-semibold">
                    {formatARS(serviciosFiltrados.reduce((sum, s) =>
                      sum + Math.round((s.costoParaCajaEventos ?? 0) * (s.porcentajeSeña ?? 30) / 100), 0))}
                  </td>
                )}
                {plegada("margen") ? <TdPlegada /> : (
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {totalCosto > 0 ? (
                      <span className={cn("font-semibold", margenColor(((totalVenta - totalCosto) / totalCosto) * 100))}>
                        {(((totalVenta - totalCosto) / totalCosto) * 100).toFixed(0)}%
                      </span>
                    ) : "—"}
                  </td>
                )}
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Confirm delete */}
      <AlertDialog
        open={!!idEliminar}
        onOpenChange={(o) => {
          if (!o) {
            setIdEliminar(null)
            setConfirmoCongelado(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar o editar este servicio?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Si solo querés cambiar el precio, el costo o el nombre, no hace falta borrarlo:
                  cerrá esta ventana y editá las celdas directamente en la tabla.
                </p>
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800">
                  <p className="font-semibold">Qué pasa si lo borrás:</p>
                  <ul className="text-xs mt-1 list-disc pl-4 space-y-1">
                    <li>El servicio se mueve a la papelera y sale del catálogo.</li>
                    <li>
                      Los eventos que lo tienen contratado quedan con la seña y el saldo{" "}
                      <span className="font-semibold">congelados con los precios actuales</span>.
                    </li>
                    <li>
                      Mientras esté en la papelera, esos montos <span className="font-semibold">no se actualizan más</span>{" "}
                      aunque cambien los precios. Solo vuelven a actualizarse si lo restaurás.
                    </li>
                  </ul>
                  {eventosConServicio.length > 0 && (
                    <>
                      <p className="font-semibold text-xs mt-2">
                        Contratado en {eventosConServicio.length}{" "}
                        {eventosConServicio.length === 1 ? "evento" : "eventos"}:
                      </p>
                      <p className="text-xs mt-0.5">
                        {eventosConServicio
                          .slice(0, 5)
                          .map((ev) => ev.nombrePareja || ev.nombre || "Sin nombre")
                          .join(", ")}
                        {eventosConServicio.length > 5 && ` y ${eventosConServicio.length - 5} más`}
                      </p>
                    </>
                  )}
                </div>
                <label className="flex items-start gap-2 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={confirmoCongelado}
                    onChange={(e) => setConfirmoCongelado(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-destructive"
                  />
                  <span className="text-sm text-foreground">
                    Entiendo que los eventos con este servicio quedarán congelados y no quiero editarlo, quiero borrarlo.
                  </span>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver y editar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminarConfirm}
              disabled={!confirmoCongelado}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:pointer-events-none"
            >
              Borrar (va a la papelera)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Crear separador (fila verde) — componente con estado propio para no re-renderizar la tabla */}
      <SeparadorDialog
        open={separadorDialogOpen}
        onOpenChange={setSeparadorDialogOpen}
        onCrear={handleCrearSeparador}
      />

      {/* Confirmación simple para eliminar separadores */}
      <AlertDialog open={!!separadorEliminar} onOpenChange={(o) => !o && setSeparadorEliminar(null)}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este separador?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Es solo una fila de organización: borrarla no afecta servicios ni eventos.</p>
                {separadorEliminar && (
                  <div className="rounded-md bg-emerald-600 px-3 py-1.5">
                    <span className="text-white font-bold text-[15px] uppercase tracking-widest">
                      {separadorEliminar.nombre}
                    </span>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminarSeparador}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Impacto en el sistema al cambiar un monto del catálogo */}
      <ServicioImpactoDialog
        servicio={cambioMonto?.servicio ?? null}
        campo={cambioMonto?.campo ?? "precioVenta"}
        valorNuevo={cambioMonto?.valorNuevo ?? 0}
        eventos={eventos || []}
        onConfirmar={confirmarCambioMonto}
        onCancelar={() => setCambioMonto(null)}
      />
    </div>
  )
}

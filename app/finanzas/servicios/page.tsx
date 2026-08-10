"use client"

import { useState, useRef, useCallback } from "react"
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
} from "lucide-react"
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

// ─── Constantes ──────────────────────────────────────────────────────────────

const CATEGORIAS: CategoriaServicio[] = [
  "Salon y Espacio",
  "Fotografia y Video",
  "Decoracion",
  "Entretenimiento",
  "Pasteleria",
  "Transporte",
  "Papeleria",
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
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[15px] pointer-events-none select-none">
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
              "w-full h-8 pl-6 pr-2.5 text-[15px] border border-primary/60 rounded outline-none bg-primary/5 focus:bg-white text-right tabular-nums",
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
          "w-full h-8 px-2.5 text-[15px] border border-primary/60 rounded outline-none bg-primary/5 focus:bg-white",
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
        "group relative h-8 flex items-center px-2.5 rounded cursor-pointer hover:bg-muted/70 transition-colors text-[15px]",
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

// ─── Página principal ─────────────────────────────────────────────────────────

export default function FinanzasServiciosPage() {
  const { servicios, addServicio, updateServicio, deleteServicio, setServicios, eventos } = useStore()
  const { toast } = useToast()

  const [busqueda, setBusqueda] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaServicio | "todas">("todas")
  const [idEliminar, setIdEliminar] = useState<string | null>(null)

  // ── Servicios ordenados (orden manual tipo Excel) ─────────────────────────
  const serviciosOrdenados = servicios
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.orden ?? a.i) - (b.s.orden ?? b.i) || a.i - b.i)
    .map((x) => x.s)

  // ── Servicios filtrados ────────────────────────────────────────────────────
  const serviciosFiltrados = serviciosOrdenados.filter((s) => {
    if (!s.activo) return false
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

  // ── Mover fila arriba/abajo (persiste el orden en la base) ────────────────
  const moverServicio = async (id: string, dir: -1 | 1) => {
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

  // ── Totales pie de tabla ───────────────────────────────────────────────────
  const totalVenta = serviciosFiltrados.reduce((sum, s) => sum + (s.precioVenta ?? 0), 0)
  const totalCosto = serviciosFiltrados.reduce((sum, s) => sum + (s.costoParaCajaEventos ?? 0), 0)

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

  // ── Handlers de actualización inline ─────────────────────────────────────
  const update = useCallback(
    (id: string, patch: Partial<Servicio>) => {
      updateServicio(id, patch)
    },
    [updateServicio]
  )

  const handleEliminarConfirm = () => {
    if (!idEliminar) return
    deleteServicio(idEliminar)
    setIdEliminar(null)
    toast({ title: "Servicio eliminado" })
  }

  // Eventos que tienen contratado el servicio a eliminar (para avisar antes de borrar)
  const eventosConServicio = idEliminar
    ? (eventos || []).filter((ev) => (ev.servicios || []).some((s) => s.servicioId === idEliminar))
    : []

  // ─── Render ───────────────────────────────────────────────────────────��───
  return (
    <div className="flex flex-col h-full min-h-0 p-6 gap-4">

      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            Configurá el precio de venta (contrato) y el costo que impacta en Caja Eventos.
          </p>
        </div>
        <Button onClick={handleAgregarFila} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          Agregar servicio
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center shrink-0">
        <div className="relative flex-1 max-w-xs">
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
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Todas las categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorias</SelectItem>
            {CATEGORIAS.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto hidden sm:block">
          {serviciosFiltrados.length} servicio{serviciosFiltrados.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabla estilo spreadsheet */}
      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-[15px] border-collapse min-w-[920px]">
          <thead>
            <tr className="bg-muted/80 border-b border-border sticky top-0 z-10">
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground w-[58px] text-[13px] uppercase tracking-wide">#</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground text-[13px] uppercase tracking-wide">Nombre</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground text-[13px] uppercase tracking-wide w-[165px]">Categoria</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground text-[13px] uppercase tracking-wide w-[125px]">Unidad</th>
              <th className="px-3 py-1.5 text-right font-semibold text-[13px] uppercase tracking-wide w-[170px]">
                <span className="flex items-center justify-end gap-1 text-emerald-700">
                  <ShoppingBag className="h-4 w-4" />
                  Precio Venta
                </span>
              </th>
              <th className="px-3 py-1.5 text-right font-semibold text-[13px] uppercase tracking-wide w-[170px]">
                <span className="flex items-center justify-end gap-1 text-rose-600">
                  <DollarSign className="h-4 w-4" />
                  Costo Caja Eventos
                </span>
              </th>
              <th className="px-3 py-1.5 text-right font-semibold text-[13px] uppercase tracking-wide w-[150px]">
                <span className="flex items-center justify-end gap-1 text-amber-600">
                  <Tag className="h-4 w-4" />
                  Seña por evento
                </span>
              </th>
              <th className="px-3 py-1.5 text-right font-semibold text-muted-foreground text-[13px] uppercase tracking-wide w-[95px]">Margen</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground text-[13px] uppercase tracking-wide">Descripcion (letra chica del contrato)</th>
              <th className="px-2 py-1.5 w-10" />
            </tr>
          </thead>

          <tbody>
            {serviciosFiltrados.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-16 text-muted-foreground">
                  {busqueda || categoriaFiltro !== "todas"
                    ? "No se encontraron servicios con esos filtros."
                    : "No hay servicios. Hacé clic en \"Agregar servicio\" para empezar."}
                </td>
              </tr>
            )}

            {serviciosFiltrados.map((s, idx) => {
              const venta = s.precioVenta ?? 0
              const costo = s.costoParaCajaEventos ?? 0
              const ganancia = venta - costo
              const margen = costo > 0 ? (ganancia / costo) * 100 : 0

              return (
                <tr
                  key={s.id}
                  className={cn(
                    "border-b border-border/60 hover:bg-muted/30 transition-colors group",
                    idx % 2 === 0 ? "bg-card" : "bg-muted/10"
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
                  <td className="px-1.5 py-[3px] min-w-[180px]">
                    <EditableCell
                      value={s.nombre}
                      placeholder="Nombre del servicio"
                      onCommit={(v) => update(s.id, { nombre: v.trim() || s.nombre })}
                    />
                  </td>

                  {/* Categoria */}
                  <td className="px-2 py-[3px]">
                    <Select
                      value={s.categoria}
                      onValueChange={(v) => update(s.id, { categoria: v as CategoriaServicio })}
                    >
                      <SelectTrigger className="h-8 min-h-0 border-0 bg-transparent shadow-none px-1.5 hover:bg-muted/70 focus:ring-0 gap-1 text-[15px]">
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

                  {/* Unidad */}
                  <td className="px-2 py-[3px]">
                    <Select
                      value={s.unidad}
                      onValueChange={(v) => update(s.id, { unidad: v as Servicio["unidad"] })}
                    >
                      <SelectTrigger className="h-8 min-h-0 border-0 bg-transparent shadow-none px-1.5 hover:bg-muted/70 focus:ring-0 text-[15px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIDADES.map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Precio Venta */}
                  <td className="px-1.5 py-[3px]">
                    <EditableCell
                      value={formatMiles(venta)}
                      placeholder="0"
                      numeric
                      onCommit={(v) => {
                        const nuevo = parseARS(v)
                        if (nuevo === venta) return
                        if (!confirm(`¿Establecer el precio de venta de "${s.nombre}" en ${formatARS(nuevo)}?`)) return
                        update(s.id, { precioVenta: nuevo })
                      }}
                    />
                  </td>

                  {/* Costo Caja Eventos */}
                  <td className="px-1.5 py-[3px]">
                    <EditableCell
                      value={formatMiles(costo)}
                      placeholder="0"
                      numeric
                      onCommit={(v) => {
                        const nuevo = parseARS(v)
                        if (nuevo === costo) return
                        if (!confirm(`¿Establecer el costo (Caja Eventos) de "${s.nombre}" en ${formatARS(nuevo)}?`)) return
                        update(s.id, { costoParaCajaEventos: nuevo })
                      }}
                    />
                  </td>

                  {/* Seña por evento */}
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
                        if (!confirm(`¿Establecer la seña de "${s.nombre}" en ${formatARS(montoSeña)} (${pct}%)?`)) return
                        update(s.id, { porcentajeSeña: pct })
                      }}
                    />
                  </td>

                  {/* Margen */}
                  <td className="px-3 py-[3px] text-right tabular-nums">
                    {venta > 0 && costo > 0 ? (
                      <span className={cn("font-semibold text-[15px]", margenColor(margen))}>
                        {margen.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* Descripcion = letra chica que se imprime en el contrato (~90 palabras) */}
                  <td className="px-1.5 py-[3px] min-w-[300px] max-w-[420px] align-top">
                    <EditableCell
                      value={s.descripcion ?? ""}
                      placeholder="Letra chica del contrato"
                      multiline
                      onCommit={(v) => update(s.id, { descripcion: v })}
                    />
                  </td>

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
                  Total ({serviciosFiltrados.length} servicio{serviciosFiltrados.length !== 1 ? "s" : ""})
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                  {formatARS(totalVenta)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">
                  {formatARS(totalCosto)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-amber-700 font-semibold">
                  {formatARS(serviciosFiltrados.reduce((sum, s) =>
                    sum + Math.round((s.costoParaCajaEventos ?? 0) * (s.porcentajeSeña ?? 30) / 100), 0))}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {totalCosto > 0 ? (
                    <span className={cn("font-semibold", margenColor(((totalVenta - totalCosto) / totalCosto) * 100))}>
                      {(((totalVenta - totalCosto) / totalCosto) * 100).toFixed(0)}%
                    </span>
                  ) : "—"}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-[12px] text-muted-foreground shrink-0 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300" />
          Precio Venta = precio que figura en el contrato
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-100 border border-rose-300" />
          Costo Caja Eventos = egreso que impacta en Caja Eventos al registrar el servicio
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-semibold text-emerald-600">Verde</span> ≥ 30% &nbsp;
          <span className="font-semibold text-amber-600">Naranja</span> 10-30% &nbsp;
          <span className="font-semibold text-red-500">Rojo</span> {`< 10%`}
        </span>
      </div>

      {/* Confirm delete */}
      <AlertDialog open={!!idEliminar} onOpenChange={(o) => !o && setIdEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar servicio</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Esta accion es permanente y no se puede deshacer. El servicio sera eliminado del catalogo.</p>
                {eventosConServicio.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800">
                    <p className="font-semibold">
                      Este servicio esta contratado en {eventosConServicio.length}{" "}
                      {eventosConServicio.length === 1 ? "evento" : "eventos"}:
                    </p>
                    <p className="text-xs mt-1">
                      {eventosConServicio
                        .slice(0, 5)
                        .map((ev) => ev.nombrePareja || ev.nombre || "Sin nombre")
                        .join(", ")}
                      {eventosConServicio.length > 5 && ` y ${eventosConServicio.length - 5} mas`}
                    </p>
                    <p className="text-xs mt-2">
                      Los montos de seña y saldo pendientes quedaran congelados con los precios actuales en cada
                      evento, para que sus costos y pagos pendientes no se pierdan.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminarConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

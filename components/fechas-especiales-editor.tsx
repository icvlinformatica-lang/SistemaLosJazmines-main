"use client"

// Cotizaciones > Configuración: FECHAS ESPECIALES (scripts/018).
//
// Días puntuales que se cotizan distinto (feriados, vísperas, fechas de alta
// demanda, promociones), para todos los salones o algunos:
//   - "Como sábado":   usa el recargo de sábado de cada salón.
//   - "Como viernes":  sin recargo, aunque caiga sábado (promociones).
//   - "Recargo propio": monto fijo o %, con los mismos rubros que el de sábado.
// La fecha especial MANDA sobre el día de la semana (lib/cotizador-salon.ts,
// resolverDia). No se repite sola cada año. Dos para el mismo día y salón: no
// deja guardar (lo frena también la base).
//
// Lista ordenada por fecha; las pasadas van aparte, plegadas, sin borrarse.
// API: /api/administracion/fechas-especiales (solo Administración/Soporte).

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react"
import { es } from "react-day-picker/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { SALONES, salonLabel } from "@/lib/store"
import {
  NOMBRES_DIA,
  RECARGO_VACIO,
  diaDeSemana,
  fechaCorta,
  hoyArgentina,
  type FechaEspecial,
  type ModoFechaEspecial,
} from "@/lib/cotizador-salon"
import { fmt } from "@/components/config-bloque"
import { EditorRecargo, textoRecargo } from "@/components/recargo-editor"

const MODOS: Array<{ valor: ModoFechaEspecial; titulo: string; ayuda: string }> = [
  { valor: "sabado", titulo: "Como sábado", ayuda: "Usa el recargo de sábado de cada salón." },
  { valor: "viernes", titulo: "Como viernes", ayuda: "Sin recargo, aunque caiga sábado (promociones)." },
  { valor: "propio", titulo: "Recargo propio", ayuda: "Un monto o porcentaje solo para este día." },
]

type Borrador = Omit<FechaEspecial, "id"> & { id: string | null }

const nuevoBorrador = (): Borrador => ({
  id: null,
  fecha: "",
  nombre: "",
  todosLosSalones: true,
  salones: [...SALONES],
  modo: "sabado",
  recargo: null,
})

/** "YYYY-MM-DD" ↔ Date LOCAL (año, mes, día), nunca vía UTC. */
const aDate = (f: string) => {
  const [a, m, d] = f.split("-").map(Number)
  return a && m && d ? new Date(a, m - 1, d) : undefined
}
const aTexto = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function comoSeCotiza(f: Pick<FechaEspecial, "modo" | "recargo">): string {
  if (f.modo === "sabado") return "Como sábado"
  if (f.modo === "viernes") return "Como viernes (sin recargo)"
  return f.recargo ? `Recargo propio: ${textoRecargo(f.recargo, fmt)}` : "Recargo propio"
}

function salonesTexto(f: Pick<FechaEspecial, "todosLosSalones" | "salones">): string {
  return f.todosLosSalones ? "Todos los salones" : f.salones.map(salonLabel).join(", ")
}

export function FechasEspecialesEditor() {
  const { toast } = useToast()
  const [fechas, setFechas] = useState<FechaEspecial[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [errorBorrador, setErrorBorrador] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aBorrar, setABorrar] = useState<FechaEspecial | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [pasadasAbiertas, setPasadasAbiertas] = useState(false)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/administracion/fechas-especiales")
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) throw new Error(data?.error)
      setFechas(data.fechas)
    } catch (e) {
      setError((e as Error)?.message || "No se pudieron cargar las fechas especiales.")
    }
  }, [])
  useEffect(() => {
    cargar()
  }, [cargar])

  const hoy = hoyArgentina()
  const proximas = useMemo(() => (fechas ?? []).filter((f) => f.fecha >= hoy), [fechas, hoy])
  const pasadas = useMemo(() => (fechas ?? []).filter((f) => f.fecha < hoy).reverse(), [fechas, hoy])

  const abrir = (f: FechaEspecial | null) => {
    setErrorBorrador(null)
    setBorrador(f ? { ...f, salones: [...f.salones] } : nuevoBorrador())
  }
  const cambiar = (c: Partial<Borrador>) => setBorrador((b) => (b ? { ...b, ...c } : b))

  const guardar = async () => {
    if (!borrador) return
    setGuardando(true)
    setErrorBorrador(null)
    try {
      const res = await fetch("/api/administracion/fechas-especiales", {
        method: borrador.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(borrador),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setErrorBorrador(data?.error || "No se pudo guardar.")
        return
      }
      setFechas(data.fechas)
      setBorrador(null)
      toast({ title: `Fecha especial guardada: ${borrador.nombre.trim()}` })
    } catch {
      setErrorBorrador("Error de conexión.")
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async () => {
    if (!aBorrar) return
    setBorrando(true)
    try {
      const res = await fetch(`/api/administracion/fechas-especiales?id=${encodeURIComponent(aBorrar.id)}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: data?.error || "No se pudo borrar", variant: "destructive" })
        return
      }
      setFechas(data.fechas)
      toast({ title: `Fecha especial borrada: ${aBorrar.nombre}` })
      setABorrar(null)
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setBorrando(false)
    }
  }

  const fila = (f: FechaEspecial, pasada: boolean) => {
    const dia = diaDeSemana(f.fecha)
    return (
      <li key={f.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 ${pasada ? "opacity-70" : ""}`}>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-chart-4 px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          {dia != null ? `${NOMBRES_DIA[dia].slice(0, 3)} ` : ""}
          {fechaCorta(f.fecha)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{f.nombre}</p>
          <p className="text-xs text-muted-foreground">
            {comoSeCotiza(f)} · {salonesTexto(f)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => abrir(f)} aria-label={`Editar ${f.nombre}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            // Gris (rojo solo al pasar el mouse): al lado del chip terracota, un
            // tachito rojo fijo se confundía con un error.
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setABorrar(f)}
            aria-label={`Borrar ${f.nombre}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </li>
    )
  }

  const b = borrador
  const diaBorrador = b ? diaDeSemana(b.fecha) : null
  const puedeGuardar =
    !!b &&
    diaBorrador != null &&
    b.nombre.trim().length > 0 &&
    (b.todosLosSalones || b.salones.length > 0) &&
    (b.modo !== "propio" || !!b.recargo)

  return (
    <div className="overflow-hidden rounded-xl border border-border border-t-4 border-t-chart-4 bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-chart-4 text-white">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Fechas especiales</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Días puntuales que se cotizan distinto (feriados, vísperas, alta demanda, promociones). Mandan sobre el día
              de la semana. No se repiten solas cada año.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => abrir(null)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar fecha
        </Button>
      </div>

      {error && (
        <div className="space-y-2 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
          <Button size="sm" variant="outline" onClick={cargar}>
            Reintentar
          </Button>
        </div>
      )}
      {!error && fechas == null && <p className="px-4 py-3 text-sm text-muted-foreground">Cargando...</p>}
      {fechas != null && (
        <>
          {proximas.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No hay fechas especiales cargadas de hoy en adelante.</p>
          ) : (
            <ul className="divide-y divide-border">{proximas.map((f) => fila(f, false))}</ul>
          )}
          {pasadas.length > 0 && (
            <div className="border-t border-border">
              <button
                type="button"
                onClick={() => setPasadasAbiertas((v) => !v)}
                aria-expanded={pasadasAbiertas}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hover:bg-muted/40"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${pasadasAbiertas ? "rotate-180" : ""}`} />
                Fechas pasadas ({pasadas.length})
              </button>
              {pasadasAbiertas && <ul className="divide-y divide-border border-t border-border">{pasadas.map((f) => fila(f, true))}</ul>}
            </div>
          )}
        </>
      )}

      {/* Alta / edición */}
      <Dialog open={!!b} onOpenChange={(open) => !open && setBorrador(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{b?.id ? "Editar fecha especial" : "Nueva fecha especial"}</DialogTitle>
            <DialogDescription>Un día puntual: no se repite solo el año que viene.</DialogDescription>
          </DialogHeader>
          {/* minmax(0,1fr): en el celular la columna no puede ser más ancha que la pantalla. */}
          {b && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col items-center gap-1">
                <Calendar
                  mode="single"
                  locale={es}
                  selected={aDate(b.fecha)}
                  defaultMonth={aDate(b.fecha)}
                  onSelect={(d) => d && cambiar({ fecha: aTexto(d) })}
                  // El dorado (--accent) está reservado para "sábado": acá "hoy"
                  // va con un borde verde y el día bajo el mouse en gris.
                  classNames={{ today: "rounded-md ring-1 ring-primary font-semibold" }}
                  className="rounded-lg border border-border [&_button:hover]:bg-muted [&_button:hover]:text-foreground [&_button[data-selected-single=true]:hover]:bg-primary [&_button[data-selected-single=true]:hover]:text-primary-foreground"
                />
                <p className="text-sm font-medium tabular-nums">
                  {diaBorrador != null ? `${NOMBRES_DIA[diaBorrador]} ${fechaCorta(b.fecha)}` : "Elegí el día"}
                </p>
              </div>
              <div className="min-w-0 space-y-4">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Nombre</span>
                  <Input
                    value={b.nombre}
                    maxLength={80}
                    placeholder="Ej. Víspera 9 de Julio"
                    onChange={(e) => cambiar({ nombre: e.target.value })}
                    autoComplete="off"
                  />
                </label>

                <div className="space-y-1.5 text-sm">
                  <span className="block font-medium">Salones</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-pressed={b.todosLosSalones}
                      onClick={() => cambiar({ todosLosSalones: true, salones: [...SALONES] })}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                        b.todosLosSalones ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                      }`}
                    >
                      Todos
                    </button>
                    {SALONES.map((s) => {
                      const activo = !b.todosLosSalones && b.salones.includes(s)
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={activo}
                          onClick={() => {
                            const base = b.todosLosSalones ? [] : b.salones
                            const salones = activo ? base.filter((x) => x !== s) : [...base, s]
                            cambiar({ todosLosSalones: false, salones: SALONES.filter((x) => salones.includes(x)) })
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-sm ${
                            activo ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                          }`}
                        >
                          {salonLabel(s)}
                        </button>
                      )
                    })}
                  </div>
                  {!b.todosLosSalones && b.salones.length === 0 && (
                    <p className="text-xs font-medium text-red-700">Elegí al menos un salón (o «Todos»).</p>
                  )}
                </div>

                <div className="space-y-1.5 text-sm">
                  <span className="block font-medium">Cómo se cotiza</span>
                  <div className="grid gap-2" role="radiogroup" aria-label="Cómo se cotiza">
                    {MODOS.map((m) => {
                      const activo = b.modo === m.valor
                      return (
                        <button
                          key={m.valor}
                          type="button"
                          role="radio"
                          aria-checked={activo}
                          onClick={() =>
                            cambiar({
                              modo: m.valor,
                              recargo: m.valor === "propio" ? (b.recargo ?? { ...RECARGO_VACIO, rubros: ["salon"] }) : null,
                            })
                          }
                          className={`rounded-lg border-2 px-3 py-2 text-left transition-colors ${
                            activo ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                          }`}
                        >
                          <span className="block text-sm font-semibold">{m.titulo}</span>
                          <span className="block text-xs text-muted-foreground">{m.ayuda}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {b.modo === "propio" && b.recargo && (
                  <div className="rounded-lg border border-border p-3">
                    <EditorRecargo valor={b.recargo} onChange={(recargo) => cambiar({ recargo })} etiqueta="Recargo propio" />
                    {diaBorrador === 6 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Cae sábado: se cobra SOLO este recargo, no se le suma el de sábado.
                      </p>
                    )}
                  </div>
                )}

                {errorBorrador && (
                  <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{errorBorrador}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBorrador(null)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={!puedeGuardar || guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <Dialog open={!!aBorrar} onOpenChange={(open) => !open && setABorrar(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Borrar «{aBorrar?.nombre}»?</DialogTitle>
            <DialogDescription>
              {aBorrar ? `${fechaCorta(aBorrar.fecha)} · ${salonesTexto(aBorrar)}. ` : ""}
              Las cotizaciones ya guardadas no cambian; las nuevas de ese día se cotizan según el día de la semana.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setABorrar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={borrando} onClick={borrar}>
              {borrando ? "Borrando..." : "Borrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

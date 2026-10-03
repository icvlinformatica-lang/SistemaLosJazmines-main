"use client"

// Bloques nuevos de Cotizaciones > Configuración para el cotizador rápido:
// Menú (platos + margen), Barras (barras armadas + margen) y Servicios del
// cotizador (aparece / incluido en el salón). Controlados: el estado vive en
// TarifarioEditor, que guarda todo junto con "Guardar tarifario". Las barras
// son la excepción: se crean, editan, prenden y borran al instante contra
// /api/barra-templates.
//
// Muestran costos y márgenes: solo se ven en Configuración, que es de
// Administración (y la API que los trae corta en el servidor).

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { precioPorPorcion } from "@/lib/precio-menu"
import { precioBarraDesdeCostos } from "@/lib/precio-barra-cotizador"
import { EditorBarra, type BarraParaEditar, type CoctelConCosto } from "@/components/editor-barra"

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

export interface PlatoConCosto {
  id: string
  nombre: string
  categoria: string
  costoPorPorcion: number
}

/** Margen guardado como fracción (0,5) y editado como porcentaje (50). */
function InputMargen({ valor, onChange, etiqueta }: { valor: number; onChange: (n: number) => void; etiqueta: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="font-medium">{etiqueta}</span>
      <span className="inline-flex items-center rounded-lg border border-input bg-background pr-2 focus-within:ring-2 focus-within:ring-[#2d5a3d]/40">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={1000}
          step={1}
          aria-label={etiqueta}
          value={Number.isFinite(valor) ? Math.round(valor * 1000) / 10 : ""}
          onChange={(e) => {
            const pct = Number(e.target.value)
            onChange(Number.isFinite(pct) && pct >= 0 ? pct / 100 : 0)
          }}
          className="h-9 w-20 bg-transparent px-2 text-right tabular-nums outline-none"
        />
        <span className="text-muted-foreground">%</span>
      </span>
    </label>
  )
}

// ─── b) Menú ────────────────────────────────────────────────────────────

export function BloqueMenuContenido({
  platos,
  recetasMenu,
  onRecetasMenu,
  margenMenu,
  onMargenMenu,
}: {
  platos: PlatoConCosto[]
  recetasMenu: string[]
  onRecetasMenu: (ids: string[]) => void
  margenMenu: number
  onMargenMenu: (m: number) => void
}) {
  const disponibles = useMemo(
    () => [...platos].filter((p) => !recetasMenu.includes(p.id)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [platos, recetasMenu],
  )
  const mover = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= recetasMenu.length) return
    const nuevo = [...recetasMenu]
    ;[nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]]
    onRecetasMenu(nuevo)
  }

  return (
    <div className="space-y-4">
      <InputMargen etiqueta="Margen del menú" valor={margenMenu} onChange={onMargenMenu} />
      <p className="text-xs text-muted-foreground">
        Platos que aparecen como botón en el cotizador, en este orden. Precio por porción = costo de una porción
        (insumos a precio actual) + margen.
      </p>
      <ol className="space-y-1.5">
        {recetasMenu.map((id, i) => {
          const plato = platos.find((p) => p.id === id)
          return (
            <li key={id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
              <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
              <span className="min-w-0 flex-1 text-sm font-medium">
                {plato?.nombre ?? <span className="text-red-600">Receta borrada ({id})</span>}
              </span>
              {plato && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  costo {fmt(plato.costoPorPorcion)} por porción →{" "}
                  <span className="font-semibold text-foreground">
                    precio {fmt(precioPorPorcion(plato.costoPorPorcion, margenMenu))}
                  </span>
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="rounded p-1 hover:bg-muted disabled:opacity-30" aria-label="Subir">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === recetasMenu.length - 1} className="rounded p-1 hover:bg-muted disabled:opacity-30" aria-label="Bajar">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onRecetasMenu(recetasMenu.filter((x) => x !== id))} className="rounded p-1 text-red-600 hover:bg-red-50" aria-label="Sacar del menú">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          )
        })}
      </ol>
      {disponibles.length > 0 && (
        <Select value="" onValueChange={(id) => onRecetasMenu([...recetasMenu, id])}>
          <SelectTrigger className="h-9 w-full sm:w-80">
            <SelectValue placeholder="+ Agregar un plato" />
          </SelectTrigger>
          <SelectContent>
            {disponibles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre} · {p.categoria}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

// ─── c) Barras ──────────────────────────────────────────────────────────

export function BloqueBarrasContenido({
  barras,
  onBarras,
  cocteles,
  margenBarra,
  onMargenBarra,
}: {
  barras: BarraParaEditar[]
  onBarras: (b: BarraParaEditar[]) => void
  cocteles: CoctelConCosto[]
  margenBarra: number
  onMargenBarra: (m: number) => void
}) {
  const { toast } = useToast()
  const [editando, setEditando] = useState<BarraParaEditar | null>(null)
  const [editorAbierto, setEditorAbierto] = useState(false)
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [aBorrar, setABorrar] = useState<BarraParaEditar | null>(null)
  const costos = useMemo(() => Object.fromEntries(cocteles.map((c) => [c.id, c.costoPorTrago])), [cocteles])

  const cambiarSwitch = async (b: BarraParaEditar, enCotizador: boolean) => {
    setOcupada(b.id)
    try {
      const res = await fetch(`/api/barra-templates/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enCotizador }),
      })
      if (!res.ok) throw new Error()
      onBarras(barras.map((x) => (x.id === b.id ? { ...x, enCotizador } : x)))
    } catch {
      toast({ title: "No se pudo cambiar", variant: "destructive" })
    } finally {
      setOcupada(null)
    }
  }

  const borrar = async (b: BarraParaEditar) => {
    setABorrar(null)
    setOcupada(b.id)
    try {
      const res = await fetch(`/api/barra-templates/${b.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        toast({ title: `No se puede borrar "${b.nombre}"`, description: data.error, variant: "destructive" })
        return
      }
      if (!res.ok) throw new Error()
      onBarras(barras.filter((x) => x.id !== b.id))
      toast({ title: "Barra borrada", description: b.nombre })
    } catch {
      toast({ title: "No se pudo borrar", variant: "destructive" })
    } finally {
      setOcupada(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InputMargen etiqueta="Margen de barra" valor={margenBarra} onChange={onMargenBarra} />
        <Button
          size="sm"
          onClick={() => {
            setEditando(null)
            setEditorAbierto(true)
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Crear barra
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Son una referencia de precio para cotizar: 1 trago de cada cóctel por adulto. Los tragos reales del evento se
        eligen después en el planificador.
      </p>
      {barras.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay barras.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {barras.map((b) => {
            const precio = precioBarraDesdeCostos(b.coctelesIncluidos, costos, margenBarra)
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{b.nombre}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {precio.tragosPorAdulto} {precio.tragosPorAdulto === 1 ? "cóctel" : "cócteles"} ·{" "}
                    <span className="font-semibold text-foreground">{fmt(precio.precioPorAdulto)} por adulto</span>
                    {precio.esGrande && <span className="ml-1 text-amber-700">· barra grande</span>}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={b.enCotizador}
                    disabled={ocupada === b.id}
                    onCheckedChange={(v) => cambiarSwitch(b, v)}
                    aria-label={`${b.nombre}: aparece en el cotizador`}
                  />
                  Aparece en el cotizador
                </label>
                <span className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(b)
                      setEditorAbierto(true)
                    }}
                    className="rounded p-1.5 hover:bg-muted"
                    aria-label={`Editar ${b.nombre}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setABorrar(b)}
                    disabled={ocupada === b.id}
                    className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40"
                    aria-label={`Borrar ${b.nombre}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <Dialog open={!!aBorrar} onOpenChange={(open) => !open && setABorrar(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Borrar la barra?</DialogTitle>
            <DialogDescription>
              {aBorrar?.nombre}. Si algún evento la usa, no se borra.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setABorrar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => aBorrar && borrar(aBorrar)}>
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <EditorBarra
        abierto={editorAbierto}
        barra={editando}
        cocteles={cocteles}
        margenBarra={margenBarra}
        onCerrar={() => setEditorAbierto(false)}
        onGuardada={(guardada) => {
          setEditorAbierto(false)
          const existe = barras.some((x) => x.id === guardada.id)
          const lista = existe ? barras.map((x) => (x.id === guardada.id ? guardada : x)) : [...barras, guardada]
          onBarras(lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")))
        }}
      />
    </div>
  )
}

// ─── d) Servicios del cotizador ─────────────────────────────────────────

export function BloqueServiciosContenido({
  servicios,
  serviciosOcultos,
  onServiciosOcultos,
  incluidosServicio,
  onIncluidosServicio,
}: {
  servicios: Array<{ id: string; nombre: string; categoria: string }>
  serviciosOcultos: string[]
  /** Sin función (configuración no cargada) el switch "Aparece" queda deshabilitado. */
  onServiciosOcultos?: (ids: string[]) => void
  incluidosServicio: string[]
  onIncluidosServicio: (ids: string[]) => void
}) {
  const alternar = (lista: string[], id: string, prender: boolean) =>
    prender ? [...new Set([...lista, id])] : lista.filter((x) => x !== id)

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        "Incluido en el salón": no se cobra aparte si el salón se vende a precio de lista (grilla o Calendario de
        Precios). Si el salón no tiene precio cargado, se cobra como cualquier adicional.
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {servicios.map((sv) => (
          <li key={sv.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2">
            <span className="min-w-0 flex-1 text-sm">
              {sv.nombre}
              <span className="text-xs text-muted-foreground"> · {sv.categoria}</span>
            </span>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={!serviciosOcultos.includes(sv.id)}
                disabled={!onServiciosOcultos}
                onCheckedChange={(v) => onServiciosOcultos?.(alternar(serviciosOcultos, sv.id, !v))}
                aria-label={`${sv.nombre}: aparece en el cotizador`}
              />
              Aparece en el cotizador
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={incluidosServicio.includes(sv.id)}
                onCheckedChange={(v) => onIncluidosServicio(alternar(incluidosServicio, sv.id, v))}
                aria-label={`${sv.nombre}: incluido en el salón`}
              />
              Incluido en el salón
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

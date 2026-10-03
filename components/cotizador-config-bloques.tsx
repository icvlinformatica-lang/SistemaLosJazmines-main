"use client"

// Bloques de Cotizaciones > Configuración para el cotizador POR SALÓN
// (modelo costo + ganancia, scripts/015): Cocina (platos + ganancia),
// Barras (barras armadas + qué aparece en el salón + ganancia) y Servicios
// (aparece / incluido + ganancia). Controlados: el estado vive en
// CotizadorSalonEditor, que guarda todo el salón junto. La excepción son las
// barras en sí (crear, editar, borrar): son compartidas por todos los salones
// y se guardan al instante contra /api/barra-templates.
//
// También queda BloqueIncluidosAnterior: el "incluido en el salón" GLOBAL
// que sigue usando el cotizador del vendedor hasta el Paso 2.
//
// Muestran costos y ganancias: solo se ven en Configuración, que es de
// Administración (y la API que los trae corta por perfil en el servidor).

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { CATEGORIAS_FUERA_DE_SERVICIOS, precioConGanancia, precioBarraSalon } from "@/lib/cotizador-salon"
import { EditorBarra, type BarraParaEditar, type CoctelConCosto } from "@/components/editor-barra"
import { AvisoSinCosto, InputGanancia, fmt } from "@/components/config-bloque"

export interface PlatoConCosto {
  id: string
  nombre: string
  categoria: string
  costoPorPorcion: number
}

export interface ServicioConCosto {
  id: string
  nombre: string
  categoria: string
  unidad: string
  costo: number
}

export interface EstadoServicioSalon {
  servicioId: string
  oculto: boolean
  incluido: boolean
}

// ─── Cocina ─────────────────────────────────────────────────────────────

export function BloqueCocinaContenido({
  platos,
  recetas,
  onRecetas,
  ganancia,
  onGanancia,
}: {
  platos: PlatoConCosto[]
  /** Platos que aparecen como botón, en orden. */
  recetas: string[]
  onRecetas: (ids: string[]) => void
  ganancia: number
  onGanancia: (n: number) => void
}) {
  const disponibles = useMemo(
    () => [...platos].filter((p) => !recetas.includes(p.id)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [platos, recetas],
  )
  const mover = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= recetas.length) return
    const nuevo = [...recetas]
    ;[nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]]
    onRecetas(nuevo)
  }

  return (
    <div className="space-y-4">
      <InputGanancia etiqueta="Ganancia de cocina" valor={ganancia} onChange={onGanancia} />
      <p className="text-xs text-muted-foreground">
        Platos que aparecen como botón en el cotizador de este salón, en este orden. Costo = una porción con los
        insumos a precio actual. Precio por porción = costo + ganancia.
      </p>
      {recetas.length === 0 && <p className="text-sm text-muted-foreground">Este salón no tiene platos en el cotizador.</p>}
      <ol className="space-y-1.5">
        {recetas.map((id, i) => {
          const plato = platos.find((p) => p.id === id)
          return (
            <li key={id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
              <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
              <span className="min-w-0 flex-1 text-sm font-medium">
                {plato?.nombre ?? <span className="text-red-600">Receta borrada ({id})</span>}
              </span>
              {plato && (
                <span className="flex flex-wrap items-center justify-end gap-1.5 text-xs tabular-nums text-muted-foreground">
                  {plato.costoPorPorcion <= 0 && <AvisoSinCosto />}
                  <span>
                    costo {fmt(plato.costoPorPorcion)} →{" "}
                    <span className="font-semibold text-foreground">
                      precio {fmt(precioConGanancia(plato.costoPorPorcion, ganancia))}
                    </span>{" "}
                    por porción
                  </span>
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="rounded p-1 hover:bg-muted disabled:opacity-30" aria-label="Subir">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === recetas.length - 1} className="rounded p-1 hover:bg-muted disabled:opacity-30" aria-label="Bajar">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onRecetas(recetas.filter((x) => x !== id))} className="rounded p-1 text-red-600 hover:bg-red-50" aria-label="Sacar del menú">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          )
        })}
      </ol>
      {disponibles.length > 0 && (
        <Select value="" onValueChange={(id) => onRecetas([...recetas, id])}>
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

// ─── Barras ─────────────────────────────────────────────────────────────

export function BloqueBarrasContenido({
  barras,
  onBarras,
  visibles,
  onVisibles,
  cocteles,
  ganancia,
  onGanancia,
  salonNombre,
}: {
  /** Todas las barras armadas (son compartidas por todos los salones). */
  barras: BarraParaEditar[]
  onBarras: (b: BarraParaEditar[]) => void
  /** Ids de las barras que aparecen en el cotizador de ESTE salón. */
  visibles: string[]
  onVisibles: (ids: string[]) => void
  cocteles: CoctelConCosto[]
  ganancia: number
  onGanancia: (n: number) => void
  salonNombre: string
}) {
  const { toast } = useToast()
  const [editando, setEditando] = useState<BarraParaEditar | null>(null)
  const [editorAbierto, setEditorAbierto] = useState(false)
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [aBorrar, setABorrar] = useState<BarraParaEditar | null>(null)
  const costos = useMemo(() => Object.fromEntries(cocteles.map((c) => [c.id, c.costoPorTrago])), [cocteles])

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
      onVisibles(visibles.filter((id) => id !== b.id))
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
        <InputGanancia etiqueta="Ganancia de barra" valor={ganancia} onChange={onGanancia} />
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
        Cada barra es un paquete de cócteles: se cotiza 1 trago de cada uno por adulto. Las barras son las mismas para
        todos los salones; el interruptor elige cuáles aparecen en {salonNombre}. Crear, editar o borrar una barra se
        guarda al instante; el interruptor, con "Guardar {salonNombre}".
      </p>
      {barras.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay barras.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {barras.map((b) => {
            const precio = precioBarraSalon(b.coctelesIncluidos, costos, ganancia)
            const costo = precioBarraSalon(b.coctelesIncluidos, costos, 0).precioPorAdulto
            const visible = visibles.includes(b.id)
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{b.nombre}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                    <span>
                      {precio.tragosPorAdulto} {precio.tragosPorAdulto === 1 ? "cóctel" : "cócteles"} · costo {fmt(costo)} →{" "}
                      <span className="font-semibold text-foreground">precio {fmt(precio.precioPorAdulto)} por adulto</span>
                    </span>
                    {precio.esGrande && <span className="text-amber-700">· barra grande</span>}
                    {costo <= 0 && <AvisoSinCosto />}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={visible}
                    onCheckedChange={(v) =>
                      onVisibles(v ? [...new Set([...visibles, b.id])] : visibles.filter((id) => id !== b.id))
                    }
                    aria-label={`${b.nombre}: aparece en el cotizador de ${salonNombre}`}
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
              {aBorrar?.nombre}. Se borra para TODOS los salones. Si algún evento la usa, no se borra.
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
        margenBarra={ganancia / 100}
        onCerrar={() => setEditorAbierto(false)}
        onGuardada={(guardada) => {
          setEditorAbierto(false)
          const existe = barras.some((x) => x.id === guardada.id)
          const lista = existe ? barras.map((x) => (x.id === guardada.id ? guardada : x)) : [...barras, guardada]
          onBarras(lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")))
          // Una barra nueva creada desde un salón arranca visible en ese salón
          // (queda para guardar con el resto).
          if (!existe) onVisibles([...new Set([...visibles, guardada.id])])
        }}
      />
    </div>
  )
}

// ─── Servicios ──────────────────────────────────────────────────────────

export function BloqueServiciosContenido({
  servicios,
  estado,
  onEstado,
  ganancia,
  onGanancia,
}: {
  servicios: ServicioConCosto[]
  /** Solo los servicios con algo distinto de lo normal (oculto o incluido). */
  estado: EstadoServicioSalon[]
  onEstado: (e: EstadoServicioSalon[]) => void
  ganancia: number
  onGanancia: (n: number) => void
}) {
  const de = (id: string) => estado.find((e) => e.servicioId === id) ?? { servicioId: id, oculto: false, incluido: false }
  const cambiar = (id: string, cambios: Partial<EstadoServicioSalon>) => {
    const nuevo = { ...de(id), ...cambios }
    const resto = estado.filter((e) => e.servicioId !== id)
    onEstado(nuevo.oculto || nuevo.incluido ? [...resto, nuevo] : resto)
  }

  // Al marcar un servicio como incluido también queda visible: un incluido
  // oculto no se vería ni tildado en el cotizador del vendedor.
  const marcarIncluido = (id: string, incluido: boolean) => cambiar(id, incluido ? { incluido: true, oculto: false } : { incluido: false })

  // Menú y barra se configuran desde Recetas y Cócteles: nunca como servicio.
  const lista = servicios.filter((sv) => !CATEGORIAS_FUERA_DE_SERVICIOS.includes(sv.categoria))
  const contratables = lista.filter((sv) => !de(sv.id).incluido)
  const incluidos = lista.filter((sv) => de(sv.id).incluido)

  const switchIncluido = (sv: ServicioConCosto, incluido: boolean) => (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <Switch
        checked={incluido}
        onCheckedChange={(v) => marcarIncluido(sv.id, v)}
        aria-label={`${sv.nombre}: incluido en el salón`}
      />
      Incluido en el salón
    </label>
  )

  return (
    <div className="space-y-4">
      <InputGanancia etiqueta="Ganancia de servicios" valor={ganancia} onChange={onGanancia} />
      <p className="text-xs text-muted-foreground">
        Costo = el "costo para Caja Eventos" de cada servicio (se edita en Finanzas &gt; Servicios). Una sola ganancia
        para todos los servicios del salón. El switch "Incluido en el salón" pasa el servicio de una lista a la otra.
      </p>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Servicios que se pueden contratar</p>
        {contratables.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos los servicios vienen incluidos en este salón.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {contratables.map((sv) => {
              const e = de(sv.id)
              return (
                <li key={sv.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">
                    {sv.nombre}
                    <span className="text-xs text-muted-foreground"> · {sv.categoria}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                      <span>
                        costo {fmt(sv.costo)} →{" "}
                        <span className="font-semibold text-foreground">precio {fmt(precioConGanancia(sv.costo, ganancia))}</span>
                        {sv.unidad && sv.unidad !== "Fijo" ? ` (${sv.unidad.toLowerCase()})` : ""}
                      </span>
                      {sv.costo <= 0 && !e.oculto && <AvisoSinCosto />}
                    </span>
                  </span>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={!e.oculto}
                      onCheckedChange={(v) => cambiar(sv.id, { oculto: !v })}
                      aria-label={`${sv.nombre}: aparece en el cotizador`}
                    />
                    Aparece en el cotizador
                  </label>
                  {switchIncluido(sv, false)}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Incluidos en el salón por defecto</p>
        <p className="text-xs text-muted-foreground">
          Vienen con el salón: el vendedor los ve tildados y no se cobran aparte.
        </p>
        {incluidos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este salón no tiene servicios incluidos.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-muted/30">
            {incluidos.map((sv) => (
              <li key={sv.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2">
                <span className="min-w-0 flex-1 text-sm">
                  {sv.nombre}
                  <span className="text-xs text-muted-foreground"> · {sv.categoria}</span>
                </span>
                {switchIncluido(sv, true)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Configuración anterior: "incluido en el salón" global ──────────────

export function BloqueIncluidosAnterior({
  servicios,
  incluidosServicio,
  onIncluidosServicio,
}: {
  servicios: Array<{ id: string; nombre: string; categoria: string }>
  incluidosServicio: string[]
  onIncluidosServicio: (ids: string[]) => void
}) {
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
                checked={incluidosServicio.includes(sv.id)}
                onCheckedChange={(v) =>
                  onIncluidosServicio(
                    v ? [...new Set([...incluidosServicio, sv.id])] : incluidosServicio.filter((x) => x !== sv.id),
                  )
                }
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

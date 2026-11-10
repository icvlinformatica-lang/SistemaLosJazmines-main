"use client"

// Tarjeta "Barras" de Cócteles (pedido de Rodrigo, 10/11/2026): un solo
// bloque "Barras | +": tocar "Barras" abre las barras armadas ya creadas, con
// sus cócteles, el lápiz para editarlas y el tachito para borrarlas; "+" crea una barra nueva
// (el mismo editor de Cotizaciones > Configuración > Barras).
//
// Ver no guarda nada. El costo por adulto es la misma cuenta de "Crear barra"
// (1 trago de cada cóctel, lib/precio-barra-cotizador.ts, sin ganancia) y
// solo lo ve quien ve costos. Borrar usa DELETE /api/barra-templates/[id],
// que es solo de Administración y Soporte y NO borra una barra que use algún
// evento (responde 409 con cuántos la usan). Borrarla la saca también del
// cotizador de todos los salones.

import { useMemo, useState } from "react"
import { GlassWater, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useStore } from "@/lib/store-context"
import { formatCurrency } from "@/lib/store"
import { costoPorTrago } from "@/lib/precio-barra"
import { filasBarrasCreadas, type FilaBarraCreada } from "@/lib/barras-creadas"
import { BotonCrearBarra, EditorBarra, type BarraParaEditar, type CoctelConCosto } from "@/components/editor-barra"

export function TarjetaBarras({ veCostos, puedeEditar }: { veCostos: boolean; puedeEditar: boolean }) {
  const { state, setBarrasTemplates } = useStore()
  const { toast } = useToast()
  const [abierto, setAbierto] = useState(false)
  const [aBorrar, setABorrar] = useState<FilaBarraCreada | null>(null)
  const [borrando, setBorrando] = useState(false)
  // Barra que se está editando (el mismo editor de "Crear barra").
  const [editando, setEditando] = useState<BarraParaEditar | null>(null)

  // La carta para el editor, con la misma cuenta de costo por trago.
  const coctelesEditor = useMemo<CoctelConCosto[]>(
    () =>
      state.cocteles
        .map((c) => ({
          id: c.id,
          nombre: c.nombre,
          categoria: c.categoria || "Con Alcohol",
          costoPorTrago: veCostos ? costoPorTrago(c, state.insumosBarra) : 0,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [state.cocteles, state.insumosBarra, veCostos],
  )

  const filas = useMemo(() => {
    const costos = veCostos
      ? Object.fromEntries(state.cocteles.map((c) => [c.id, costoPorTrago(c, state.insumosBarra)]))
      : {}
    return filasBarrasCreadas(state.barrasTemplates || [], state.cocteles, costos)
  }, [state.barrasTemplates, state.cocteles, state.insumosBarra, veCostos])

  const borrar = async (fila: FilaBarraCreada) => {
    setBorrando(true)
    try {
      const res = await fetch(`/api/barra-templates/${fila.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        toast({ title: `No se puede borrar "${fila.nombre}"`, description: data.error, variant: "destructive" })
        return
      }
      if (!res.ok) {
        toast({ title: "No se pudo borrar", description: data.error, variant: "destructive" })
        return
      }
      setBarrasTemplates((state.barrasTemplates || []).filter((t) => t.id !== fila.id))
      toast({ title: "Barra borrada", description: fila.nombre })
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setBorrando(false)
      setABorrar(null)
    }
  }

  return (
    <>
      {/* "Barras" mismo abre la lista; el "+" crea una nueva. */}
      <div className="flex h-10 items-center gap-1 rounded-md border border-input bg-background px-1 shadow-xs">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-2 px-2"
          onClick={() => setAbierto(true)}
          aria-label="Ver las barras creadas"
        >
          <GlassWater className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Barras</span>
          <Badge variant="secondary" className="tabular-nums">
            {filas.length}
          </Badge>
        </Button>
        {puedeEditar && <span className="h-5 w-px bg-border" aria-hidden />}
        {puedeEditar && (
          <BotonCrearBarra
            compacto
            onCreada={(b) =>
              setBarrasTemplates([
                ...(state.barrasTemplates || []).filter((t) => t.id !== b.id),
                { id: b.id, nombre: b.nombre, coctelesIncluidos: b.coctelesIncluidos, enCotizador: b.enCotizador },
              ])
            }
          />
        )}
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-2xl w-11/12 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Barras creadas</DialogTitle>
            <DialogDescription>
              Cada barra es un paquete de cócteles. En qué salón aparece en el cotizador se elige en Cotizaciones &gt;
              Configuración &gt; Barras.
            </DialogDescription>
          </DialogHeader>
          {filas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay barras creadas.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {filas.map((f) => (
                <li key={f.id} className="flex items-start gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="font-medium">{f.nombre}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {f.cocteles.length} {f.cocteles.length === 1 ? "cóctel" : "cócteles"}
                        {veCostos && (
                          <>
                            {" · costo "}
                            <span className="font-semibold text-foreground">{formatCurrency(f.costoPorAdulto)}</span>
                            {" por adulto"}
                          </>
                        )}
                      </p>
                    </div>
                    {f.cocteles.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {f.cocteles.map((c) => (
                          <Badge key={c.id} variant="outline" className="font-normal">
                            {c.nombre}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700">Sus cócteles ya no están en la carta.</p>
                    )}
                    {f.borrados > 0 && f.cocteles.length > 0 && (
                      <p className="text-xs text-amber-700">
                        {f.borrados === 1 ? "1 cóctel ya no está" : `${f.borrados} cócteles ya no están`} en la carta (no
                        suma).
                      </p>
                    )}
                  </div>
                  {puedeEditar && (
                    <button
                      type="button"
                      onClick={() => {
                        const t = (state.barrasTemplates || []).find((x) => x.id === f.id)
                        // Solo los cócteles que siguen en la carta: los borrados no
                        // se pueden tildar y no suman.
                        setEditando({
                          id: f.id,
                          nombre: f.nombre,
                          coctelesIncluidos: f.cocteles.map((c) => c.id),
                          enCotizador: !!t?.enCotizador,
                        })
                      }}
                      className="shrink-0 rounded p-1.5 hover:bg-muted"
                      aria-label={`Editar ${f.nombre}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {puedeEditar && (
                    <button
                      type="button"
                      onClick={() => setABorrar(f)}
                      className="shrink-0 rounded p-1.5 text-red-600 hover:bg-red-50"
                      aria-label={`Borrar ${f.nombre}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!aBorrar} onOpenChange={(open) => !open && !borrando && setABorrar(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Borrar la barra?</DialogTitle>
            <DialogDescription>
              {aBorrar?.nombre}. Se saca también del cotizador de todos los salones. Si algún evento la usa, no se borra.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setABorrar(null)} disabled={borrando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => aBorrar && borrar(aBorrar)} disabled={borrando}>
              {borrando ? "Borrando..." : "Borrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {editando && (
        <EditorBarra
          abierto={!!editando}
          barra={editando}
          cocteles={coctelesEditor}
          margenBarra={0}
          onCerrar={() => setEditando(null)}
          onGuardada={(g) => {
            setEditando(null)
            setBarrasTemplates(
              (state.barrasTemplates || []).map((t) =>
                t.id === g.id ? { ...t, nombre: g.nombre, coctelesIncluidos: g.coctelesIncluidos } : t,
              ),
            )
          }}
        />
      )}
    </>
  )
}

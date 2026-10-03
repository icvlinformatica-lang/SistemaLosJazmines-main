"use client"

// Editor de una barra armada para cotizar (barra_templates). Un solo
// componente con dos accesos: Cotizaciones > Configuración > Barras y el
// botón "Crear barra" de Cócteles (BotonCrearBarra, abajo).
//
// La barra es una REFERENCIA DE PRECIO para el cotizador: 1 trago de cada
// cóctel por adulto (lib/precio-barra-cotizador.ts). Los tragos reales del
// evento se eligen después en el planificador, y su costo lo sigue
// calculando calcularComprasBarras(), que no cambia.

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { precioBarraDesdeCostos, COCTELES_BARRA_GRANDE } from "@/lib/precio-barra-cotizador"

export interface CoctelConCosto {
  id: string
  nombre: string
  categoria: string
  costoPorTrago: number
}

export interface BarraParaEditar {
  id: string
  nombre: string
  coctelesIncluidos: string[]
  enCotizador: boolean
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

export function EditorBarra({
  abierto,
  barra,
  cocteles,
  margenBarra,
  onCerrar,
  onGuardada,
}: {
  abierto: boolean
  /** null = barra nueva. */
  barra: BarraParaEditar | null
  cocteles: CoctelConCosto[]
  margenBarra: number
  onCerrar: () => void
  onGuardada: (barra: BarraParaEditar) => void
}) {
  const { toast } = useToast()
  const [nombre, setNombre] = useState("")
  const [elegidos, setElegidos] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setNombre(barra?.nombre ?? "")
    setElegidos(barra?.coctelesIncluidos ?? [])
  }, [abierto, barra])

  const costos = useMemo(() => Object.fromEntries(cocteles.map((c) => [c.id, c.costoPorTrago])), [cocteles])
  const precio = precioBarraDesdeCostos(elegidos, costos, margenBarra)

  const porCategoria = useMemo(() => {
    const grupos = new Map<string, CoctelConCosto[]>()
    for (const c of [...cocteles].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))) {
      grupos.set(c.categoria, [...(grupos.get(c.categoria) ?? []), c])
    }
    return [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"))
  }, [cocteles])

  const guardar = async () => {
    if (!nombre.trim() || elegidos.length === 0 || guardando) return
    setGuardando(true)
    try {
      const res = await fetch(barra ? `/api/barra-templates/${barra.id}` : "/api/barra-templates", {
        method: barra ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        // Una barra nueva hecha acá es para cotizar: arranca visible en el
        // cotizador. Al editar no se toca el switch.
        body: JSON.stringify({
          nombre: nombre.trim(),
          coctelesIncluidos: elegidos,
          ...(barra ? {} : { enCotizador: true }),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.id) {
        toast({ title: "No se pudo guardar la barra", variant: "destructive" })
        return
      }
      toast({ title: barra ? "Barra actualizada" : "Barra creada", description: data.nombre })
      onGuardada({
        id: data.id,
        nombre: data.nombre,
        coctelesIncluidos: data.coctelesIncluidos ?? elegidos,
        enCotizador: !!data.enCotizador,
      })
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{barra ? "Editar barra" : "Crear barra"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre-barra">Nombre</Label>
            <Input
              id="nombre-barra"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Barra tropical"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Cócteles</p>
            <p className="text-xs text-muted-foreground">
              Pensada chica (3 a 5 cócteles): se cotiza 1 trago de cada uno por adulto. Los tragos reales del evento
              se eligen después en el planificador.
            </p>
            {porCategoria.map(([categoria, lista]) => (
              <div key={categoria} className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{categoria}</p>
                <div className="flex flex-wrap gap-1.5">
                  {lista.map((c) => {
                    const activo = elegidos.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={activo}
                        onClick={() =>
                          setElegidos((prev) => (activo ? prev.filter((id) => id !== c.id) : [...prev, c.id]))
                        }
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          activo
                            ? "border-[#2d5a3d] bg-[#2d5a3d] text-white"
                            : "border-border bg-white text-muted-foreground hover:bg-muted"
                        }`}
                        title={`Costo ${fmt(c.costoPorTrago)} por trago`}
                      >
                        {c.nombre}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
            <p className="text-sm font-semibold tabular-nums">
              {fmt(precio.precioPorAdulto)} por adulto · {precio.tragosPorAdulto}{" "}
              {precio.tragosPorAdulto === 1 ? "trago" : "tragos"} por adulto
            </p>
            <p className="text-xs text-muted-foreground">
              Suma del precio por trago de cada cóctel (costo + {Math.round(margenBarra * 100)} %).
            </p>
          </div>
          {precio.esGrande && (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Barra grande: cotiza {precio.tragosPorAdulto} tragos por adulto. Pensadas para {COCTELES_BARRA_GRANDE} cócteles o menos.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!nombre.trim() || elegidos.length === 0 || guardando}>
            {guardando ? "Guardando..." : barra ? "Guardar cambios" : "Crear barra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Botón "Crear barra" para Cócteles: trae los costos de la carta y el margen
 * guardado de /api/administracion/cotizador-config y abre el mismo editor.
 */
export function BotonCrearBarra() {
  const { toast } = useToast()
  const [abierto, setAbierto] = useState(false)
  const [datos, setDatos] = useState<{ cocteles: CoctelConCosto[]; margenBarra: number } | null>(null)
  const [cargando, setCargando] = useState(false)

  const abrir = async () => {
    setCargando(true)
    try {
      const res = await fetch("/api/administracion/cotizador-config")
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: data?.error || "No se pudo cargar la carta", variant: "destructive" })
        return
      }
      setDatos({ cocteles: data.cocteles ?? [], margenBarra: Number(data.config?.margenBarra) || 0 })
      setAbierto(true)
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={abrir} disabled={cargando}>
        <Plus className="h-4 w-4 mr-1.5" />
        {cargando ? "Cargando..." : "Crear barra"}
      </Button>
      {datos && (
        <EditorBarra
          abierto={abierto}
          barra={null}
          cocteles={datos.cocteles}
          margenBarra={datos.margenBarra}
          onCerrar={() => setAbierto(false)}
          onGuardada={() => setAbierto(false)}
        />
      )}
    </>
  )
}

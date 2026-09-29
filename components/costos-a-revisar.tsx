"use client"

// Diálogo "Costos a revisar": encuentra los insumos cuyo costo está mal
// calculado porque la receta los pide en gramos o cc y ellos se compran por
// unidad, sin que nadie haya cargado cuánto trae esa unidad.
//
// Se puede resolver desde acá mismo (cargar el contenido arregla de una vez
// todas las recetas que usan ese insumo), cerrarlo para ir a mirar algo, y
// volver a abrirlo con el botón que queda en la pantalla.
//
// Aparece en Recetario, Almacén, Cócteles y Barra. Se abre solo una vez por
// día y por pantalla; después queda el botón con el contador.

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, Loader2, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import type { InsumoConProblema } from "@/lib/diagnostico-costos"

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

/** Una sola apertura automática por día y por pantalla. */
function yaSeAbrioHoy(pantalla: string): boolean {
  try {
    const hoy = new Date().toISOString().slice(0, 10)
    return localStorage.getItem(`costos_revisar_${pantalla}`) === hoy
  } catch {
    return true // si no se puede leer, mejor no molestar
  }
}
function marcarAbiertoHoy(pantalla: string) {
  try {
    localStorage.setItem(`costos_revisar_${pantalla}`, new Date().toISOString().slice(0, 10))
  } catch {}
}

function FilaInsumo({
  insumo,
  onResuelto,
}: {
  insumo: InsumoConProblema
  onResuelto: () => void
}) {
  const { toast } = useToast()
  const [abierto, setAbierto] = useState(false)
  const [cantidad, setCantidad] = useState(insumo.sugerencia ? String(insumo.sugerencia.cantidad) : "")
  const [unidad, setUnidad] = useState<"GRS" | "CC">(insumo.sugerencia?.unidad ?? "GRS")
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    const n = Number(cantidad)
    if (!(n > 0)) {
      toast({ title: "Cargá cuánto trae cada unidad", variant: "destructive" })
      return
    }
    setGuardando(true)
    try {
      const res = await fetch("/api/diagnostico-costos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insumoId: insumo.insumoId, sector: insumo.sector, cantidad: n, unidad }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo guardar", variant: "destructive" })
        return
      }
      toast({
        title: `${insumo.insumoDescripcion} corregido`,
        description: `Se arreglaron ${insumo.afectados.length} ${insumo.afectados.length === 1 ? "receta" : "recetas"}.`,
      })
      onResuelto()
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setGuardando(false)
    }
  }

  const ejemplo = insumo.afectados[0]

  return (
    <div className={`rounded-lg border p-3 ${insumo.urgente ? "border-red-300 bg-red-50/50" : "border-border"}`}>
      <button type="button" onClick={() => setAbierto((v) => !v)} className="flex w-full items-start gap-2 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{insumo.insumoDescripcion}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {insumo.sector === "barra" ? "Barra" : "Cocina"}
            </span>
            {insumo.urgente && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">Urgente</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Está en <strong>unidades</strong> a {fmt(insumo.precioUnitario)}, pero{" "}
            {insumo.afectados.length === 1 ? (
              <>
                <strong>{ejemplo.nombre}</strong> lo pide en {ejemplo.unidad.toLowerCase()}
              </>
            ) : (
              <>
                <strong>{insumo.afectados.length} recetas</strong> lo piden en {ejemplo.unidad.toLowerCase()}
              </>
            )}
            .
          </p>
          <p className="text-xs mt-1">
            <span className="text-red-700 font-medium">Hoy cobra {fmt(ejemplo.costoActual)}</span>
            <span className="text-muted-foreground"> por {insumo.sector === "barra" ? "trago" : "persona"} en {ejemplo.nombre}</span>
          </p>
        </div>
        {abierto ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground mt-1" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-1" />}
      </button>

      {abierto && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {insumo.afectados.length > 1 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Cargar este dato arregla {insumo.afectados.length} de una vez:
              </p>
              <ul className="space-y-0.5">
                {insumo.afectados.map((a, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    · <strong>{a.nombre}</strong>: pide {a.cantidad} {a.unidad.toLowerCase()} → hoy cobra{" "}
                    <span className="text-red-700">{fmt(a.costoActual)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">¿Cuánto trae cada unidad de {insumo.insumoDescripcion}?</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="Ej: 700"
                className="flex-1"
              />
              <Select value={unidad} onValueChange={(v) => setUnidad(v as "GRS" | "CC")}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GRS">gramos</SelectItem>
                  <SelectItem value="CC">cc</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={guardar} disabled={guardando} size="sm">
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
              </Button>
            </div>
            {insumo.sugerencia && (
              <p className="text-xs text-muted-foreground">
                Sugerido {insumo.sugerencia.origen} — confirmalo antes de guardar.
              </p>
            )}
            {!insumo.sugerencia && (
              <p className="text-xs text-muted-foreground">
                El nombre no dice el contenido: hay que mirarlo en el envase.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function CostosARevisar({ pantalla }: { pantalla: "recetario" | "almacen" | "cocteles" | "barra" }) {
  const [insumos, setInsumos] = useState<InsumoConProblema[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState(false)

  const traer = useCallback(async (abrirSiHay: boolean) => {
    try {
      const res = await fetch("/api/diagnostico-costos")
      const data = await res.json().catch(() => ({}))
      if (data?.ok) {
        setInsumos(data.insumos || [])
        if (abrirSiHay && (data.insumos || []).length > 0 && !yaSeAbrioHoy(pantalla)) {
          setAbierto(true)
          marcarAbiertoHoy(pantalla)
        }
      }
    } catch {
      // Si falla, no se muestra nada: es una ayuda, no puede romper la pantalla.
    } finally {
      setCargando(false)
    }
  }, [pantalla])

  useEffect(() => {
    traer(true)
  }, [traer])

  if (cargando || insumos.length === 0) return null

  const urgentes = insumos.filter((i) => i.urgente).length

  return (
    <>
      {/* Queda siempre visible para volver cuando quieras. */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
          urgentes > 0
            ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
            : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
        }`}
      >
        <AlertTriangle className="h-4 w-4" />
        {insumos.length} {insumos.length === 1 ? "costo a revisar" : "costos a revisar"}
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-600" />
              Costos a revisar
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              Estos insumos se compran <strong>por unidad</strong> (una lata, una botella) pero las recetas los piden
              en gramos o cc. Como no está cargado cuánto trae cada unidad, el sistema lee{" "}
              <strong>&quot;30 gramos&quot; como &quot;30 latas&quot;</strong> y el costo sale multiplicado.
            </p>
            <p className="mt-1.5 text-amber-800/90">
              Cargá cuánto trae cada uno y se arregla solo. Podés cerrar esto, ir a mirar la receta, y volver con el
              botón &quot;costos a revisar&quot;.
            </p>
          </div>

          {urgentes > 0 && (
            <p className="text-sm font-medium text-red-700">
              {urgentes} {urgentes === 1 ? "está inflando" : "están inflando"} más de $50.000.000 en un evento de 100
              personas.
            </p>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
            {insumos.map((i) => (
              <FilaInsumo key={`${i.sector}-${i.insumoId}`} insumo={i} onResuelto={() => traer(false)} />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Ordenados por cuánta plata están inflando. Arreglando el primero se corrige lo más grave.
            </p>
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Cartel de "no queda nada por revisar", para cuando se resuelven todos. */
export function CostosRevisadosOk() {
  return (
    <span className="flex items-center gap-1.5 text-sm text-emerald-700">
      <CheckCircle2 className="h-4 w-4" />
      Sin costos a revisar
    </span>
  )
}

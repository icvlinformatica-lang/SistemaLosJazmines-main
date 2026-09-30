"use client"

// Tabla pivotada del conteo físico por salón, para la pestaña "Stock por
// salón" de /admin/almacen (cocina) y /admin/barra (bebidas). Antes vivía
// sola en /admin/stock-salones; se movió acá para tener el catálogo y el
// conteo en la misma pantalla.
//
// Se arma EN VIVO desde /api/stock-salones/consolidado (tabla stock_salones),
// sin copias intermedias. SOLO LECTURA: no escribe nada.
//
// La columna Total es la suma de los salones, que es de dónde sale la columna
// Stock de la pestaña de al lado (ver app/api/stock-salones/sesiones). Por eso
// se muestran las dos juntas: casi siempre son el mismo número, y cuando no lo
// son, la diferencia se marca y se explica.

import { useEffect, useMemo, useState } from "react"
import { SALONES, salonLabel } from "@/lib/store"
import { type SectorStock } from "@/lib/stock-salones"
import { SalonDot } from "@/components/salon-badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Info, Loader2, RefreshCw, Search } from "lucide-react"

interface Celda {
  cantidad: number
  actualizadoPor: string | null
  actualizadoEn: string
}

interface Consolidado {
  insumos: { id: string; descripcion: string; unidad: string | null }[]
  celdas: Array<Celda & { insumoId: string; salon: string }>
}

/** Lo mínimo que hace falta del catálogo para comparar con la columna Stock. */
export interface InsumoParaComparar {
  id: string
  stockActual: number
}

function fmtCantidad(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n)
}

function fmtFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function StockPorSalonTabla({
  sector,
  insumos,
}: {
  sector: SectorStock
  /** El catálogo de la pestaña de al lado, para comparar Total con Stock. */
  insumos: InsumoParaComparar[]
}) {
  const [datos, setDatos] = useState<Consolidado | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [soloContados, setSoloContados] = useState(true)

  const cargar = async () => {
    setCargando(true)
    setError("")
    try {
      const res = await fetch(`/api/stock-salones/consolidado?sector=${sector}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError(data?.error || "No se pudo cargar el stock")
        setDatos(null)
        return
      }
      setDatos({ insumos: data.insumos, celdas: data.celdas })
    } catch {
      setError("No se pudo cargar el stock")
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector])

  const stockPorInsumo = useMemo(() => new Map(insumos.map((i) => [i.id, i.stockActual])), [insumos])

  const celdasPorInsumo = useMemo(() => {
    const m = new Map<string, Map<string, Celda>>()
    for (const c of datos?.celdas || []) {
      if (!m.has(c.insumoId)) m.set(c.insumoId, new Map())
      m.get(c.insumoId)!.set(c.salon, c)
    }
    return m
  }, [datos])

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (datos?.insumos || []).filter((i) => {
      if (q && !i.descripcion.toLowerCase().includes(q)) return false
      if (soloContados && !celdasPorInsumo.has(i.id)) return false
      return true
    })
  }, [datos, busqueda, soloContados, celdasPorInsumo])

  // Cuántos tienen el Total distinto del Stock. Pasa cuando se imprimió el
  // documento de un evento (descuenta del Stock lo que se va a comprar), al
  // cerrar un evento (descuenta lo consumido) o si alguien editó el Stock a
  // mano. Ninguna de esas cosas toca el conteo por salón, que sigue mostrando
  // lo último que se contó a mano.
  const conDiferencia = useMemo(() => {
    let n = 0
    for (const [insumoId, porSalon] of celdasPorInsumo) {
      const total = [...porSalon.values()].reduce((s, c) => s + c.cantidad, 0)
      const stock = stockPorInsumo.get(insumoId)
      if (stock !== undefined && Math.abs(stock - total) > 0.0001) n++
    }
    return n
  }, [celdasPorInsumo, stockPorInsumo])

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Esto es lo que Cocina y Barra contaron en cada salón. El{" "}
          <span className="font-semibold">Total</span> es la suma de los cinco, y es de ahí que sale la columna{" "}
          <span className="font-semibold">Stock</span> de la pestaña de al lado: cuando un salón carga su conteo, el
          Stock se actualiza solo. Un <span className="font-semibold">—</span> quiere decir que en ese salón todavía
          nadie contó, que no es lo mismo que no haber nada.
        </p>
      </div>

      {conDiferencia > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Hay <span className="font-semibold">{conDiferencia}</span>{" "}
            {conDiferencia === 1 ? "insumo con el Stock distinto del Total" : "insumos con el Stock distinto del Total"}{" "}
            contado. Es normal: el Stock baja solo cuando se imprime el documento de un evento y cuando se cierra un
            evento, y el conteo sigue mostrando lo último que se contó a mano en el salón. Se vuelven a emparejar
            cuando el salón carga un conteo nuevo.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar insumo..."
            className="pl-9"
            aria-label="Buscar insumo"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={soloContados} onChange={(e) => setSoloContados(e.target.checked)} />
          Solo insumos ya contados
        </label>
        <Button variant="outline" size="sm" onClick={cargar} disabled={cargando} className="sm:ml-auto">
          <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : cargando && !datos ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </p>
      ) : filas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {soloContados && !busqueda
            ? "Todavía no se cargó stock de este sector en ningún salón."
            : "No hay insumos que coincidan."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="sticky left-0 z-20 bg-muted px-3 py-2 text-left font-semibold">Insumo</th>
                {SALONES.map((s) => (
                  <th key={s} className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <SalonDot salon={s} size={7} />
                      {salonLabel(s)}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-bold">Total</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Stock</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((ins) => {
                const porSalon = celdasPorInsumo.get(ins.id)
                const total = [...(porSalon?.values() || [])].reduce((s, c) => s + c.cantidad, 0)
                const stock = stockPorInsumo.get(ins.id)
                const difiere = porSalon && stock !== undefined && Math.abs(stock - total) > 0.0001
                return (
                  <tr key={ins.id} className="border-t bg-background">
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2 [background-color:inherit]">
                      <span className="font-medium">{ins.descripcion}</span>
                      {ins.unidad ? <span className="ml-1 text-xs text-muted-foreground">({ins.unidad})</span> : null}
                    </td>
                    {SALONES.map((s) => {
                      const c = porSalon?.get(s)
                      if (!c) {
                        return (
                          <td key={s} className="px-3 py-2 text-right text-muted-foreground/60">
                            —
                          </td>
                        )
                      }
                      return (
                        <td key={s} className="px-3 py-2 text-right tabular-nums">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="rounded px-1 underline decoration-dotted underline-offset-4 hover:bg-muted"
                                title={`Cargó ${c.actualizadoPor || "sin nombre"} · ${fmtFechaHora(c.actualizadoEn)}`}
                              >
                                {fmtCantidad(c.cantidad)}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 text-xs" align="end">
                              <p className="font-semibold">{salonLabel(s)}</p>
                              <p>Cargó: {c.actualizadoPor || "sin nombre"}</p>
                              <p>{fmtFechaHora(c.actualizadoEn)}</p>
                            </PopoverContent>
                          </Popover>
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {porSalon ? fmtCantidad(total) : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        difiere ? "font-semibold text-amber-700" : "text-muted-foreground"
                      }`}
                      title={
                        difiere
                          ? "El Stock quedó distinto del último conteo: se imprimió o se cerró un evento (que descuentan del Stock), o se editó a mano."
                          : undefined
                      }
                    >
                      {stock === undefined ? "—" : fmtCantidad(stock)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

"use client"

// Stock consolidado por salón (Administración / Soporte): tabla pivotada del
// conteo físico que cargan Cocina y Barra en /stock. Se arma EN VIVO desde
// /api/stock-salones/consolidado (tabla stock_salones), sin copias
// intermedias. Es independiente del stock_actual global de /admin/almacen y
// /admin/barra: son dos números distintos a propósito.

import { useEffect, useMemo, useState } from "react"
import { SALONES, salonLabel } from "@/lib/store"
import { useProfile } from "@/lib/profile-context"
import { puedeVerConsolidado, type SectorStock } from "@/lib/stock-salones"
import { SalonDot } from "@/components/salon-badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Info, Loader2, RefreshCw, Search, Table2 } from "lucide-react"

interface Celda {
  cantidad: number
  actualizadoPor: string | null
  actualizadoEn: string
}

interface Consolidado {
  insumos: { id: string; descripcion: string; unidad: string | null }[]
  celdas: Array<Celda & { insumoId: string; salon: string }>
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

export default function StockConsolidadoPage() {
  const { perfilActivo } = useProfile()
  const [sector, setSector] = useState<SectorStock>("cocina")
  const [datos, setDatos] = useState<Consolidado | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [soloContados, setSoloContados] = useState(true)

  const cargar = async (s: SectorStock) => {
    setCargando(true)
    setError("")
    try {
      const res = await fetch(`/api/stock-salones/consolidado?sector=${s}`)
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
    cargar(sector)
  }, [sector])

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

  if (!puedeVerConsolidado(perfilActivo?.id)) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Solo Administración puede ver el stock consolidado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Table2 className="h-6 w-6" /> Stock
          </h1>
          <p className="text-sm text-muted-foreground">Lo que Cocina y Barra contaron en cada salón.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => cargar(sector)} disabled={cargando}>
          <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Este total es el <span className="font-semibold">conteo físico por salón</span>. Es independiente del stock
          global que se ve en Insumos Cocina / Insumos Bebidas: son dos números distintos a propósito y no hay que
          sincronizarlos.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-lg border p-1">
          {(["cocina", "barra"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSector(s)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                sector === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "cocina" ? "Cocina" : "Barra"}
            </button>
          ))}
        </div>
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
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Insumo</th>
                {SALONES.map((s) => (
                  <th key={s} className="px-3 py-2 text-right font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <SalonDot salon={s} size={7} />
                      {salonLabel(s)}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((ins) => {
                const porSalon = celdasPorInsumo.get(ins.id)
                const total = [...(porSalon?.values() || [])].reduce((s, c) => s + c.cantidad, 0)
                return (
                  <tr key={ins.id} className="border-t">
                    <td className="px-3 py-2">
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

"use client"

// Columna "Contado en salones" de /admin/almacen (cocina) y /admin/barra:
// conteo físico que cargan los salones en /stock (tabla stock_salones).
// SOLO LECTURA y solo para Administración / Soporte. Es independiente de la
// columna Stock (stock_actual global), que no se toca: son dos números
// distintos a propósito y no hay que igualarlos.

import { useEffect, useState } from "react"
import { useProfile } from "@/lib/profile-context"
import {
  fechaHoraCortaArgentina,
  puedeVerConsolidado,
  type ResumenStockInsumo,
  type SectorStock,
} from "@/lib/stock-salones"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Info } from "lucide-react"

interface StockContado {
  /** false → no se muestra la columna (perfil sin permiso o error al cargar). */
  visible: boolean
  salones: Array<{ id: string; nombre: string }>
  porInsumo: Map<string, ResumenStockInsumo>
  error: boolean
}

export function useStockContadoSalones(sector: SectorStock): StockContado {
  const { perfilActivo } = useProfile()
  const permitido = puedeVerConsolidado(perfilActivo?.id)
  const [salones, setSalones] = useState<Array<{ id: string; nombre: string }>>([])
  const [porInsumo, setPorInsumo] = useState<Map<string, ResumenStockInsumo>>(new Map())
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!permitido) return
    let cancelado = false
    fetch(`/api/stock-salones/por-insumo?sector=${sector}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return
        if (!data?.ok) {
          setError(true)
          return
        }
        setSalones(data.salones || [])
        setPorInsumo(new Map((data.insumos as ResumenStockInsumo[]).map((i) => [i.insumoId, i])))
      })
      .catch(() => {
        if (!cancelado) setError(true)
      })
    return () => {
      cancelado = true
    }
  }, [permitido, sector])

  return { visible: permitido && !error, salones, porInsumo, error: permitido && error }
}

function fmtCantidad(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n)
}

/**
 * Celda de un insumo. Sin conteos → "—". Con conteos → total contado
 * (parcial) + "(n de 5)" y un desplegable con los 5 salones: cantidad, quién
 * y cuándo; los salones sin conteo con "—" (nunca 0: "no lo conté" no es
 * "no tengo").
 */
export function StockContadoCelda({
  resumen,
  unidad,
  salones,
}: {
  resumen: ResumenStockInsumo | undefined
  unidad: string
  salones: Array<{ id: string; nombre: string }>
}) {
  if (!resumen) return <span className="text-muted-foreground">—</span>

  const porSalon = new Map(resumen.detalle.map((d) => [d.salon, d]))
  // Salones con conteo que ya no estén en la configuración también se listan.
  const extras = resumen.detalle.filter((d) => !salones.some((s) => s.id === d.salon))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded px-1 text-right tabular-nums hover:bg-muted"
          aria-label={`Ver desglose por salón: ${fmtCantidad(resumen.total)} ${unidad}`}
        >
          <span className="font-semibold underline decoration-dotted underline-offset-4">{fmtCantidad(resumen.total)}</span>
          <span className="ml-1 text-xs text-muted-foreground">
            {unidad} ({resumen.salonesContados} de {salones.length || resumen.salonesContados})
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 text-xs" align="end">
        <p className="mb-2 font-semibold">Contado en salones</p>
        <div className="space-y-1">
          {[...salones.map((s) => ({ id: s.id, nombre: s.nombre })), ...extras.map((e) => ({ id: e.salon, nombre: e.salon }))].map(
            (s) => {
              const d = porSalon.get(s.id)
              return (
                <div key={s.id} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate">{s.nombre}</span>
                  {d ? (
                    <span className="shrink-0 text-right">
                      <span className="font-semibold tabular-nums">
                        {fmtCantidad(d.cantidad)} {unidad}
                      </span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {d.por || "sin nombre"} · {fechaHoraCortaArgentina(new Date(d.en))}
                      </span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-muted-foreground">—</span>
                  )}
                </div>
              )
            },
          )}
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t pt-2 font-semibold">
          <span>Total contado</span>
          <span className="tabular-nums">
            {fmtCantidad(resumen.total)} {unidad}
          </span>
        </div>
        {salones.length > 0 && resumen.salonesContados < salones.length && (
          <p className="mt-1 text-muted-foreground">
            Total parcial: faltan contar {salones.length - resumen.salonesContados} de {salones.length} salones.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Nota corta que explica la columna, arriba de la tabla. */
export function StockContadoNota({ error }: { error?: boolean }) {
  if (error) {
    return <p className="mb-3 text-xs text-muted-foreground">No se pudo cargar el conteo por salón.</p>
  }
  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-xs text-sky-900">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>
        <span className="font-semibold">Contado en salones</span> es el conteo físico que cargan los salones al terminar
        cada evento. Es independiente de la columna Stock: son dos números distintos y no se sincronizan. Tocá un número
        para ver el desglose.
      </p>
    </div>
  )
}

"use client"

// Columna "Contado en salones" de /admin/almacen (cocina) y /admin/barra:
// conteo físico que cargan los salones en /stock (tabla stock_salones).
// SOLO LECTURA y solo para Administración / Soporte. Es independiente de la
// columna Stock (stock_actual global), que no se toca: son dos números
// distintos a propósito y no hay que igualarlos.

import { useEffect, useState, type CSSProperties } from "react"
import { useProfile } from "@/lib/profile-context"
import { useStore } from "@/lib/store-context"
import { salonColor } from "@/lib/store"
import {
  fechaHoraCortaArgentina,
  puedeVerConsolidado,
  type ResumenStockInsumo,
  type SectorStock,
} from "@/lib/stock-salones"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronDown, Info } from "lucide-react"

interface StockContado {
  /** false → no se muestra la columna (perfil sin permiso o error al cargar). */
  visible: boolean
  /** color: el del salón (Configuración de Cajas o el de siempre). */
  salones: Array<{ id: string; nombre: string; color: string }>
  porInsumo: Map<string, ResumenStockInsumo>
  error: boolean
  /** Vuelve a pedir los conteos (después de ajustar el stock desde el lapicito). */
  recargar: () => void
}

export function useStockContadoSalones(sector: SectorStock): StockContado {
  const { perfilActivo } = useProfile()
  const permitido = puedeVerConsolidado(perfilActivo?.id)
  const [salones, setSalones] = useState<Array<{ id: string; nombre: string }>>([])
  const [porInsumo, setPorInsumo] = useState<Map<string, ResumenStockInsumo>>(new Map())
  const [error, setError] = useState(false)
  const [version, setVersion] = useState(0)

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
        setError(false)
        setSalones(data.salones || [])
        setPorInsumo(new Map((data.insumos as ResumenStockInsumo[]).map((i) => [i.insumoId, i])))
      })
      .catch(() => {
        if (!cancelado) setError(true)
      })
    return () => {
      cancelado = true
    }
  }, [permitido, sector, version])

  const { configuracionCajas } = useStore()
  const salonesConColor = salones.map((s) => ({ ...s, color: salonColor(s.id, configuracionCajas) }))

  return {
    visible: permitido && !error,
    salones: salonesConColor,
    porInsumo,
    error: permitido && error,
    recargar: () => setVersion((v) => v + 1),
  }
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

/**
 * Celda de UN salón para un insumo: la cantidad contada ahí, o "—" si en ese
 * salón nadie contó. Tocarla abre el mismo desglose de siempre (quién cargó y
 * cuándo, en todos los salones), para no perder ese dato al partir la columna
 * única en una por salón.
 *
 * "—" es "nadie contó acá", que no es lo mismo que "no hay": por eso nunca se
 * muestra 0 en su lugar.
 */
export function StockSalonCelda({
  resumen,
  unidad,
  salonId,
  salones,
}: {
  resumen: ResumenStockInsumo | undefined
  unidad: string
  salonId: string
  salones: Array<{ id: string; nombre: string }>
}) {
  const dato = resumen?.detalle.find((d) => d.salon === salonId)
  if (!dato) return <span className="text-muted-foreground">—</span>

  const nombreSalon = salones.find((s) => s.id === salonId)?.nombre || salonId

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="-mr-1 rounded px-1 text-right tabular-nums hover:bg-muted"
          aria-label={`${nombreSalon}: ${fmtCantidad(dato.cantidad)} ${unidad}. Ver quién lo cargó y el desglose completo`}
        >
          <span className="font-semibold underline decoration-dotted underline-offset-4">{fmtCantidad(dato.cantidad)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 text-xs" align="end">
        <p className="mb-2 font-semibold">{nombreSalon}</p>
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold tabular-nums">
            {fmtCantidad(dato.cantidad)} {unidad}
          </span>
          <span className="text-muted-foreground">
            {dato.por || "sin nombre"} · {fechaHoraCortaArgentina(new Date(dato.en))}
          </span>
        </div>

        <p className="mt-3 mb-1 font-semibold">Todos los salones</p>
        <div className="space-y-1">
          {salones.map((s) => {
            const d = resumen?.detalle.find((x) => x.salon === s.id)
            return (
              <div key={s.id} className="flex items-baseline justify-between gap-2">
                <span className={`min-w-0 truncate ${s.id === salonId ? "font-semibold" : ""}`}>{s.nombre}</span>
                {d ? (
                  <span className="shrink-0 font-semibold tabular-nums">
                    {fmtCantidad(d.cantidad)} {unidad}
                  </span>
                ) : (
                  <span className="shrink-0 text-muted-foreground">—</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t pt-2 font-semibold">
          <span>Total (columna Stock)</span>
          <span className="tabular-nums">
            {fmtCantidad(resumen?.total ?? 0)} {unidad}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Fondo suave con el color del salón para su columna (título y celdas), así
 * cada columna se reconoce de un vistazo. "14" en hex es ~8 % de opacidad.
 */
export function fondoSalon(color: string): CSSProperties {
  return { backgroundColor: `${color}14` }
}

/** Nota corta que explica las columnas de salones, arriba de la tabla. */
export function StockContadoNota({ error }: { error?: boolean }) {
  if (error) {
    return <p className="mb-3 text-xs text-muted-foreground">No se pudo cargar el conteo por salón.</p>
  }
  // Va plegada: es una explicación que se lee una vez y ocupaba lugar arriba
  // de la tabla. Se despliega tocando el título.
  return (
    <details className="group mb-3 rounded-lg border border-sky-200 bg-sky-50 text-xs text-sky-900">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 font-medium [&::-webkit-details-marker]:hidden">
        <Info className="h-3.5 w-3.5 shrink-0" />
        ¿Cómo se lee la columna Stock?
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <p className="px-2.5 pb-2.5 pl-8">
        La columna <span className="font-semibold">Stock</span> es la suma de lo que hay en cada salón. Se actualiza
        sola cuando Cocina o Barra cargan su conteo desde la pantalla de Stock — no hace falta tocarla a mano. Un{" "}
        <span className="font-semibold">—</span> quiere decir que en ese salón todavía nadie contó, que no es lo mismo
        que no haber nada. Tocá un número para ver quién lo cargó.
      </p>
    </details>
  )
}

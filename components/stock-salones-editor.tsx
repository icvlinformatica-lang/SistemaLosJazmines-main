"use client"

// Campos de stock por salón dentro del lapicito de Almacén (cocina) y
// Almacén de Barra. Solo para Administración / Soporte, los mismos que ven
// las columnas por salón. Guarda por /api/stock-salones/ajuste, que usa el
// mismo camino que una carga desde la pantalla de Stock.

import type { ResumenStockInsumo } from "@/lib/stock-salones"
import { cambiosDeStockPorSalon, totalConCambios, type SectorAjuste } from "@/lib/stock-ajuste-almacen"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type SalonConColor = { id: string; nombre: string; color: string }

/** Lo contado hoy en cada salón (sin entrada = nadie contó ahí). */
export function stockActualPorSalon(resumen: ResumenStockInsumo | undefined): Map<string, number> {
  return new Map((resumen?.detalle || []).map((d) => [d.salon, d.cantidad]))
}

/** Valores para arrancar el formulario: lo contado, o vacío si nadie contó. */
export function valoresInicialesPorSalon(
  resumen: ResumenStockInsumo | undefined,
  salones: SalonConColor[],
): Record<string, string> {
  const actuales = stockActualPorSalon(resumen)
  const valores: Record<string, string> = {}
  for (const s of salones) {
    const v = actuales.get(s.id)
    valores[s.id] = v === undefined ? "" : String(v)
  }
  return valores
}

/**
 * Guarda los salones que cambiaron. Devuelve el Stock total nuevo, o null si
 * no cambió ningún salón. Lanza Error con un mensaje para mostrar si el
 * servidor lo rechaza o no hay conexión.
 */
export async function guardarStockPorSalon(params: {
  sector: SectorAjuste
  insumoId: string
  resumen: ResumenStockInsumo | undefined
  valores: Record<string, string>
}): Promise<number | null> {
  const cambios = cambiosDeStockPorSalon(stockActualPorSalon(params.resumen), params.valores)
  if (cambios.length === 0) return null
  const res = await fetchWithRetry("/api/stock-salones/ajuste", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sector: params.sector,
      insumoId: params.insumoId,
      // Un id por salón, fijo para esta llamada: si fetchWithRetry reintenta,
      // el servidor reconoce las sesiones y no las aplica dos veces.
      items: cambios.map((c) => ({ ...c, sesionId: crypto.randomUUID() })),
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `El servidor rechazó el stock (error ${res.status}).`)
  }
  return Number(data.total)
}

/** Un campo por salón, con su color, y el total que va a quedar. */
export function StockPorSalonCampos({
  salones,
  resumen,
  unidad,
  valores,
  onChange,
}: {
  salones: SalonConColor[]
  resumen: ResumenStockInsumo | undefined
  unidad: string
  valores: Record<string, string>
  onChange: (valores: Record<string, string>) => void
}) {
  const actuales = stockActualPorSalon(resumen)
  const total = totalConCambios(actuales, cambiosDeStockPorSalon(actuales, valores))

  return (
    <div className="grid grid-cols-4 items-start gap-4">
      <Label className="pt-2 text-right">Stock</Label>
      <div className="col-span-3 space-y-2">
        {salones.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <label htmlFor={`stock-${s.id}`} className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium" style={{ color: s.color }}>
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
              <span className="truncate">{s.nombre}</span>
            </label>
            <Input
              id={`stock-${s.id}`}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={valores[s.id] ?? ""}
              placeholder={actuales.has(s.id) ? "" : "sin contar"}
              onChange={(e) => onChange({ ...valores, [s.id]: e.target.value })}
              className="w-28 text-right tabular-nums"
            />
          </div>
        ))}
        <div className="flex items-center justify-between border-t pt-2 text-sm">
          <span className="text-muted-foreground">Stock total (suma de los salones)</span>
          <span className="font-semibold tabular-nums">
            {total.toLocaleString("es-AR")} {unidad}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Queda registrado en Actividad como un ajuste desde Almacén. Un campo vacío no cambia nada.
        </p>
      </div>
    </div>
  )
}

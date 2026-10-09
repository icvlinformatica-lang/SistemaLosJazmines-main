"use client"

// Carga de dietas especiales por tipo (celíaco, vegano, alergia…). Lo usan el
// planificador del evento y el cotizador del vendedor. Las cuentas están en
// lib/dietas-evento.ts: el total de dietas nunca queda por debajo de lo que
// suma el detalle, y lo que sobra se muestra como "sin detallar".

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { AlertTriangle, Plus, Trash2 } from "lucide-react"
import {
  TIPOS_DIETA,
  ETIQUETA_DIETA,
  totalDietasDetalle,
  type DietaDetalle,
  type TipoDieta,
} from "@/lib/dietas-evento"

interface Props {
  detalle: DietaDetalle[]
  /** Total cargado de dietas (en el evento). Sin él, no se muestra "sin detallar". */
  total?: number
  disabled?: boolean
  onChange: (detalle: DietaDetalle[]) => void
  /** Texto de ayuda debajo del título. */
  ayuda?: string
}

export function DietasDetalleEditor({ detalle, total, disabled, onChange, ayuda }: Props) {
  const suma = totalDietasDetalle(detalle)
  const sinDetallar = total !== undefined ? Math.max(0, total - suma) : 0

  const cambiar = (i: number, cambios: Partial<DietaDetalle>) =>
    onChange(detalle.map((d, j) => (j === i ? { ...d, ...cambios } : d)))

  const agregar = (tipo: TipoDieta) => onChange([...detalle, { tipo, cantidad: 1 }])

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div>
        <p className="text-sm font-semibold">Dietas especiales por tipo</p>
        {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
      </div>
      {detalle.map((d, i) => (
        <div
          key={i}
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-md border p-2",
            d.tipo === "alergia" ? "border-red-300 bg-red-50" : "border-border",
          )}
        >
          <span className={cn("flex w-24 shrink-0 items-center gap-1 text-sm font-medium", d.tipo === "alergia" && "text-red-700")}>
            {d.tipo === "alergia" && <AlertTriangle className="h-3.5 w-3.5" />}
            {ETIQUETA_DIETA[d.tipo]}
          </span>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={d.cantidad || ""}
            onChange={(e) => cambiar(i, { cantidad: Math.max(0, Number.parseInt(e.target.value) || 0) })}
            className="h-9 w-20 text-center"
            aria-label={`Cantidad ${ETIQUETA_DIETA[d.tipo]}`}
            disabled={disabled}
          />
          <Input
            value={d.nota ?? ""}
            onChange={(e) => cambiar(i, { nota: e.target.value })}
            placeholder={d.tipo === "alergia" ? "¿A qué? (ej. maní)" : "Aclaración (opcional)"}
            className="h-9 min-w-0 flex-1 basis-32 text-sm"
            aria-label={`Aclaración ${ETIQUETA_DIETA[d.tipo]}`}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Sacar ${ETIQUETA_DIETA[d.tipo]}`}
            onClick={() => onChange(detalle.filter((_, j) => j !== i))}
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        {TIPOS_DIETA.map((tipo) => (
          <button
            key={tipo}
            type="button"
            onClick={() => agregar(tipo)}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50",
              tipo === "alergia" && "border-red-300 text-red-700",
            )}
          >
            <Plus className="h-3 w-3" />
            {ETIQUETA_DIETA[tipo]}
          </button>
        ))}
      </div>
      {sinDetallar > 0 && (
        <p className="text-xs text-muted-foreground">
          {sinDetallar} {sinDetallar === 1 ? "dieta sin detallar" : "dietas sin detallar"}: sumalas arriba con su tipo para que la cocina sepa qué preparar.
        </p>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { SalonDot } from "@/components/salon-badge"
import { SALONES, salonLabel, type DistribucionSalon } from "@/lib/store"

/** Suma de porcentajes del reparto. */
export function totalReparto(dist: DistribucionSalon[]): number {
  return dist.reduce((s, d) => s + (Number(d.porcentaje) || 0), 0)
}

/** Un reparto es válido si tiene al menos un salón y los porcentajes suman 100. */
export function repartoValido(dist: DistribucionSalon[]): boolean {
  const activos = dist.filter((d) => d.salon && (Number(d.porcentaje) || 0) > 0)
  return activos.length > 0 && totalReparto(activos) === 100
}

/**
 * Editor para repartir un gasto entre varios salones por porcentaje.
 * Cada salón tildado suma su porción; el total debe dar 100%.
 */
export function RepartoSalonesEditor({
  value,
  onChange,
}: {
  value: DistribucionSalon[]
  onChange: (v: DistribucionSalon[]) => void
}) {
  const total = totalReparto(value)

  function toggleSalon(salon: string, checked: boolean) {
    if (checked) {
      if (value.some((d) => d.salon === salon)) return
      onChange([...value, { salon, porcentaje: 0 }])
    } else {
      onChange(value.filter((d) => d.salon !== salon))
    }
  }

  function setPorcentaje(salon: string, pct: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)))
    onChange(value.map((d) => (d.salon === salon ? { ...d, porcentaje: clamped } : d)))
  }

  function repartirIgual() {
    if (value.length === 0) return
    const base = Math.floor(100 / value.length)
    const resto = 100 - base * value.length
    onChange(value.map((d, i) => ({ ...d, porcentaje: base + (i < resto ? 1 : 0) })))
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Tildá los salones y asigná el porcentaje que le corresponde a cada uno.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-purple-600 hover:text-purple-800"
          onClick={repartirIgual}
          disabled={value.length === 0}
        >
          Repartir igual
        </Button>
      </div>
      <div className="space-y-1.5">
        {SALONES.map((s) => {
          const entry = value.find((d) => d.salon === s)
          const checked = !!entry
          return (
            <div key={s} className="flex items-center gap-2.5">
              <Checkbox
                id={`rep-${s}`}
                checked={checked}
                onCheckedChange={(v) => toggleSalon(s, v === true)}
              />
              <Label htmlFor={`rep-${s}`} className="flex-1 text-sm font-normal cursor-pointer flex items-center gap-2">
                <SalonDot salon={s} size={8} />
                {salonLabel(s)}
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  disabled={!checked}
                  value={checked ? String(entry?.porcentaje ?? 0) : ""}
                  onChange={(e) => setPorcentaje(s, Number(e.target.value))}
                  className="h-8 w-20 text-right"
                  aria-label={`Porcentaje de ${salonLabel(s)}`}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="text-xs text-muted-foreground">Total asignado</span>
        <span className={`text-sm font-bold ${total === 100 ? "text-teal-600" : "text-red-600"}`}>
          {total}%
        </span>
      </div>
      {total !== 100 && (
        <p className="text-xs text-red-600">Los porcentajes deben sumar 100%.</p>
      )}
    </div>
  )
}

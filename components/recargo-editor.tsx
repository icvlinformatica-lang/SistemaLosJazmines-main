"use client"

// Editor de un recargo (scripts/018): "Monto fijo" o "Porcentaje" + valor +
// rubros (solo en porcentaje). Lo usan el bloque "Recargo de sábado" del
// editor por salón y el "Recargo propio" de las fechas especiales.
//
// Personal NO es una opción a propósito: ya tiene tarifas distintas de
// viernes y sábado, y se cobraría dos veces.

import { InputPrecio } from "@/components/config-bloque"
import { PuntoRubro } from "@/components/cotizador-colores"
import { RECARGO_PORCENTAJE_MAXIMO, RUBROS_RECARGO, type ReglaRecargo, type RubroRecargo } from "@/lib/cotizador-salon"

export const NOMBRE_RUBRO_RECARGO: Record<RubroRecargo, string> = {
  salon: "Salón",
  cocina: "Cocina",
  barra: "Barra",
  servicios: "Servicios",
}

export function EditorRecargo({
  valor,
  onChange,
  etiqueta,
}: {
  valor: ReglaRecargo
  onChange: (r: ReglaRecargo) => void
  /** Para los aria-label ("Recargo de sábado", "Recargo propio"). */
  etiqueta: string
}) {
  const alternarRubro = (r: RubroRecargo) => {
    const rubros = valor.rubros.includes(r) ? valor.rubros.filter((x) => x !== r) : [...valor.rubros, r]
    onChange({ ...valor, rubros: RUBROS_RECARGO.filter((x) => rubros.includes(x)) })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 text-sm">
          <span className="block font-medium">Tipo</span>
          <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label={`${etiqueta}: tipo`}>
            {(
              [
                ["monto", "Monto fijo"],
                ["porcentaje", "Porcentaje"],
              ] as const
            ).map(([tipo, texto]) => (
              <button
                key={tipo}
                type="button"
                role="radio"
                aria-checked={valor.tipo === tipo}
                onClick={() => onChange({ ...valor, tipo })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  valor.tipo === tipo ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>
        <label className="space-y-1.5 text-sm">
          <span className="block font-medium">{valor.tipo === "monto" ? "Monto" : "Porcentaje"}</span>
          {valor.tipo === "monto" ? (
            <InputPrecio
              valor={valor.valor}
              onChange={(n) => onChange({ ...valor, valor: n ?? 0 })}
              etiqueta={`${etiqueta}: monto`}
              className="h-10 w-40"
            />
          ) : (
            <span className="inline-flex items-center rounded-lg border border-input bg-background pr-2 focus-within:ring-2 focus-within:ring-ring/40">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={RECARGO_PORCENTAJE_MAXIMO}
                step={1}
                aria-label={`${etiqueta}: porcentaje`}
                value={Number.isFinite(valor.valor) ? valor.valor : ""}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  onChange({ ...valor, valor: Number.isFinite(n) && n >= 0 ? n : 0 })
                }}
                className="h-10 w-20 rounded-lg bg-transparent px-2 text-right text-sm tabular-nums focus:outline-none"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </span>
          )}
        </label>
      </div>

      {valor.tipo === "porcentaje" ? (
        <div className="space-y-1.5 text-sm">
          <span className="block font-medium">Sobre el precio de</span>
          <div className="flex flex-wrap gap-2">
            {RUBROS_RECARGO.map((r) => {
              const activo = valor.rubros.includes(r)
              return (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    activo ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={() => alternarRubro(r)}
                    className="h-4 w-4 accent-primary"
                  />
                  <PuntoRubro clave={r} />
                  {NOMBRE_RUBRO_RECARGO[r]}
                </label>
              )
            })}
          </div>
          {valor.rubros.length === 0 && (
            <p className="text-xs font-medium text-red-700">Tildá al menos un rubro.</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">El monto fijo se suma una sola vez al total de la cotización.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Personal no se incluye: ya tiene tarifas distintas de viernes y sábado, y se cobraría dos veces.
      </p>
    </div>
  )
}

/** "+$500.000" o "+10 % de Salón y Cocina" (resumen corto de un recargo). */
export function textoRecargo(r: ReglaRecargo, fmt: (n: number) => string): string {
  if (!(r.valor > 0)) return "sin recargo"
  if (r.tipo === "monto") return `+${fmt(r.valor)}`
  const nombres = r.rubros.map((x) => NOMBRE_RUBRO_RECARGO[x])
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : nombres[0]
  return `+${r.valor} % de ${lista}`
}

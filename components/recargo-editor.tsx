"use client"

// Editor de un recargo (scripts/018 y 020): "Monto fijo" (se suma una vez) o
// "Porcentaje por rubro" (Salón, Cocina, Barra y Servicios, cada uno con su
// propio %). Lo usan el bloque "Recargo de sábado" del editor por salón y el
// "Recargo propio" de las fechas especiales.
//
// Personal NO es una opción a propósito: ya tiene tarifas distintas de
// viernes y sábado, y se cobraría dos veces.

import { InputPrecio } from "@/components/config-bloque"
import { PuntoRubro } from "@/components/cotizador-colores"
import {
  RECARGO_PORCENTAJE_MAXIMO,
  RECARGO_VACIO,
  RUBROS_RECARGO,
  porcentajesPorRubro,
  reglaPorcentajePorRubro,
  type ReglaRecargo,
  type RubroRecargo,
} from "@/lib/cotizador-salon"

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
  // Lo guardado antes del % por rubro (un solo % para los tildados) se
  // muestra ya repartido: cada rubro tildado con ese mismo %.
  const porcentajes = porcentajesPorRubro(valor)
  const cambiarPorcentaje = (rubro: RubroRecargo, texto: string) => {
    const n = Number(texto)
    onChange(reglaPorcentajePorRubro({ ...porcentajes, [rubro]: Number.isFinite(n) && n >= 0 ? n : 0 }))
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
                ["porcentaje", "Porcentaje por rubro"],
              ] as const
            ).map(([tipo, texto]) => (
              <button
                key={tipo}
                type="button"
                role="radio"
                aria-checked={valor.tipo === tipo}
                // Al cambiar de tipo todo vuelve a 0: $500.000 no son 500.000 %.
                onClick={() =>
                  tipo !== valor.tipo &&
                  onChange(tipo === "monto" ? { ...RECARGO_VACIO, rubros: [...RECARGO_VACIO.rubros] } : reglaPorcentajePorRubro({}))
                }
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  valor.tipo === tipo ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>
        {valor.tipo === "monto" && (
          <label className="space-y-1.5 text-sm">
            <span className="block font-medium">Monto</span>
            <InputPrecio
              valor={valor.valor}
              onChange={(n) => onChange({ ...valor, valor: n ?? 0 })}
              etiqueta={`${etiqueta}: monto`}
              className="h-10 w-40"
            />
          </label>
        )}
      </div>

      {valor.tipo === "porcentaje" ? (
        <div className="@container space-y-1.5 text-sm">
          <span className="block font-medium">Porcentaje de cada rubro</span>
          {/* Columnas según el ANCHO DEL EDITOR, no el de la pantalla: en la
              ventana de fecha especial va angosto aunque la pantalla sea
              grande. Dos columnas solo si entra "Servicios" al lado de su %. */}
          <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
            {RUBROS_RECARGO.map((r) => (
              <label
                key={r}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 transition-colors ${
                  porcentajes[r] > 0 ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <PuntoRubro clave={r} />
                  {NOMBRE_RUBRO_RECARGO[r]}
                </span>
                <span className="inline-flex shrink-0 items-center rounded-md border border-input bg-background pr-1.5 focus-within:ring-2 focus-within:ring-ring/40">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={RECARGO_PORCENTAJE_MAXIMO}
                    step={1}
                    aria-label={`${etiqueta}: porcentaje de ${NOMBRE_RUBRO_RECARGO[r]}`}
                    value={porcentajes[r]}
                    onChange={(e) => cambiarPorcentaje(r, e.target.value)}
                    className="h-8 w-14 rounded-md bg-transparent px-1.5 text-right text-sm tabular-nums focus:outline-none"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Cada rubro suma su propio porcentaje sobre su precio. En 0, ese rubro no tiene recargo.
          </p>
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

const porcentaje = (n: number) => n.toLocaleString("es-AR")

/** Resumen corto de un recargo: "+$500.000", "+10 % de Salón y Cocina" o,
 *  con porcentajes distintos, "Salón +17 %, Cocina +17 % y Servicios +10 %". */
export function textoRecargo(r: ReglaRecargo, fmt: (n: number) => string): string {
  if (r.tipo === "monto") return r.valor > 0 ? `+${fmt(r.valor)}` : "sin recargo"
  const p = porcentajesPorRubro(r)
  const conRecargo = RUBROS_RECARGO.filter((x) => p[x] > 0)
  if (conRecargo.length === 0) return "sin recargo"
  const lista = (partes: string[]) =>
    partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}` : partes[0]
  if (new Set(conRecargo.map((x) => p[x])).size === 1) {
    return `+${porcentaje(p[conRecargo[0]])} % de ${lista(conRecargo.map((x) => NOMBRE_RUBRO_RECARGO[x]))}`
  }
  return lista(conRecargo.map((x) => `${NOMBRE_RUBRO_RECARGO[x]} +${porcentaje(p[x])} %`))
}

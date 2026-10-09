"use client"

// Aviso "Falta: contrato, menú…" de los eventos que vinieron de una
// cotización aprobada (ver lib/faltantes-evento.ts). Solo muestra: no guarda
// nada ni cambia cálculos.

import { AlertTriangle } from "lucide-react"
import { faltantesContrato, faltantesEvento, textoFaltantes, type EventoParaFaltantes, type FaltanteEvento } from "@/lib/faltantes-evento"

/** Chip chico para la lista de eventos. No muestra nada si no falta nada. */
export function FaltantesEventoChip({ evento }: { evento: EventoParaFaltantes }) {
  return (
    <FaltantesChip
      faltan={faltantesEvento(evento)}
      title="Este evento vino de una cotización y todavía le faltan datos. Completalos desde el planificador."
    />
  )
}

/** El mismo chip a partir de la lista ya calculada (bandeja de cotizaciones). */
export function FaltantesChip({ faltan, title }: { faltan: FaltanteEvento[]; title?: string }) {
  const texto = textoFaltantes(faltan)
  if (!texto) return null
  return (
    <span
      className="mt-1 inline-flex max-w-full items-start gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium leading-tight text-amber-800"
      title={title}
    >
      <AlertTriangle className="h-3 w-3 shrink-0 mt-px" aria-hidden="true" />
      <span className="whitespace-normal break-words">{texto}</span>
    </span>
  )
}

/** Recuadro para el planificador, con el detalle de cada cosa que falta. */
export function FaltantesEventoAviso({ evento }: { evento: EventoParaFaltantes }) {
  const faltan = faltantesEvento(evento)
  const texto = textoFaltantes(faltan)
  if (!texto) return null
  const detalleContrato = faltantesContrato(evento.contrato)
  const detalle: Record<string, string> = {
    contrato: `falta ${detalleContrato.join(", ")}.`,
    "plan de pagos": "no tiene la forma de pago (seña y cuotas). Sin plan no se puede cobrar y la comisión del vendedor no queda lista para pagar.",
    servicios: "no tiene ningún servicio contratado.",
    "menú": "no tiene ningún plato elegido.",
    barra: "no tiene cócteles elegidos (si se cotizó la barra clásica, los cócteles se eligen acá).",
  }
  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold text-amber-800 text-sm">{texto}</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Este evento vino de una cotización aprobada. Para que quede bien cargado, revisá:
        </p>
        <ul className="mt-1 list-disc list-inside text-xs text-amber-700 space-y-0.5">
          {faltan.map((f) => (
            <li key={f}>
              <span className="font-semibold">{f[0].toUpperCase() + f.slice(1)}:</span> {detalle[f]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

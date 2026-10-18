"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { MESES, celdasDelMes, fechaLarga } from "@/lib/clientes-simulador"

const INICIALES = ["L", "M", "M", "J", "V", "S", "D"]

/** Calendario del simulador. Arranca el lunes para que el fin de semana quede
 *  junto, a la derecha. Las fechas ocupadas del salón elegido van tachadas y
 *  no se pueden elegir; las pasadas y las de más allá del rango, apagadas. */
export function CalendarioFiesta({
  valor,
  onElegir,
  desde,
  hasta,
  ocupadas,
}: {
  valor: string | null
  onElegir: (fecha: string) => void
  /** "YYYY-MM-DD": hoy en Argentina. */
  desde: string
  hasta: string
  ocupadas: Set<string>
}) {
  const inicial = valor || desde
  const [mes, setMes] = useState(() => ({ anio: Number(inicial.slice(0, 4)), mes0: Number(inicial.slice(5, 7)) - 1 }))
  const celdas = useMemo(() => celdasDelMes(mes.anio, mes.mes0), [mes])

  const clave = (a: number, m: number) => a * 12 + m
  const minimo = clave(Number(desde.slice(0, 4)), Number(desde.slice(5, 7)) - 1)
  const maximo = clave(Number(hasta.slice(0, 4)), Number(hasta.slice(5, 7)) - 1)
  const actual = clave(mes.anio, mes.mes0)
  const mover = (delta: number) =>
    setMes(({ anio, mes0 }) => {
      const total = clave(anio, mes0) + delta
      return { anio: Math.floor(total / 12), mes0: total % 12 }
    })

  return (
    <div className="rounded-2xl border border-[rgba(245,240,232,0.12)] bg-[#12261a] p-3 sm:p-4">
      <div className="flex items-center justify-between px-1 pb-3">
        <button
          type="button"
          onClick={() => mover(-1)}
          disabled={actual <= minimo}
          aria-label="Mes anterior"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#f5f0e8] transition-colors hover:bg-[rgba(245,240,232,0.08)] disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-[family-name:var(--font-fiesta)] text-[21px] text-[#f5f0e8] first-letter:uppercase" aria-live="polite">
          {MESES[mes.mes0]} {mes.anio}
        </p>
        <button
          type="button"
          onClick={() => mover(1)}
          disabled={actual >= maximo}
          aria-label="Mes siguiente"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#f5f0e8] transition-colors hover:bg-[rgba(245,240,232,0.08)] disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center" role="grid" aria-label={`${MESES[mes.mes0]} ${mes.anio}`}>
        {INICIALES.map((d, i) => (
          <span
            key={`${d}-${i}`}
            className={`pb-1 text-[12px] font-medium ${i >= 4 ? "text-[#f3cf7a]/80" : "text-[rgba(245,240,232,0.5)]"}`}
            aria-hidden="true"
          >
            {d}
          </span>
        ))}
        {celdas.map((f, i) => {
          if (!f) return <span key={`v-${i}`} />
          const dia = Number(f.slice(8, 10))
          const fuera = f < desde || f > hasta
          const ocupada = !fuera && ocupadas.has(f)
          const elegida = f === valor
          const etiqueta = `${fechaLarga(f)}${ocupada ? ", ya reservado" : ""}`
          return (
            <div key={f} className="flex justify-center" role="gridcell">
              <button
                type="button"
                onClick={() => onElegir(f)}
                disabled={fuera || ocupada}
                aria-label={etiqueta}
                aria-pressed={elegida}
                className={[
                  "relative flex h-10 w-10 items-center justify-center rounded-full text-[15px] tabular-nums transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a]",
                  elegida
                    ? "bg-[#f3cf7a] font-semibold text-[#0d1d14] shadow-[0_0_22px_-4px_rgba(243,207,122,0.8)]"
                    : fuera
                      ? "text-[rgba(245,240,232,0.18)]"
                      : ocupada
                        ? "text-[rgba(232,163,155,0.55)] line-through decoration-[1.5px]"
                        : "text-[#f5f0e8] hover:bg-[rgba(245,240,232,0.1)]",
                ].join(" ")}
              >
                {dia}
              </button>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 px-1 text-[12.5px] text-[rgba(245,240,232,0.6)]">
        <span className="flex items-center gap-1.5">
          <span className="line-through decoration-[1.5px] text-[rgba(232,163,155,0.75)] tabular-nums">14</span>
          ya reservado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[#f3cf7a]/80">V S D</span>
          fin de semana
        </span>
      </div>
    </div>
  )
}

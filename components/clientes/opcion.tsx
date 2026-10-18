"use client"

import { Check } from "lucide-react"

/** Fila elegible del simulador: un radio (uno por grupo) o una casilla. A la
 *  derecha va cuánto cambia el total si se elige ("+ $ 120.000"), o lo que
 *  la pantalla quiera mostrar. */
export function Opcion({
  tipo,
  elegida,
  onElegir,
  titulo,
  detalle,
  lateral,
  deshabilitada,
  children,
}: {
  tipo: "radio" | "casilla"
  elegida: boolean
  onElegir: () => void
  titulo: React.ReactNode
  detalle?: React.ReactNode
  lateral?: React.ReactNode
  deshabilitada?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className={[
        "rounded-xl border transition-[background-color,border-color,box-shadow] duration-200",
        elegida
          ? "border-[#c9a227] bg-[#1a3a2a] shadow-[0_0_28px_-12px_rgba(243,207,122,0.7)]"
          : "border-[rgba(245,240,232,0.12)] bg-[#12261a]",
        deshabilitada && !elegida ? "opacity-45" : "",
      ].join(" ")}
    >
      <button
        type="button"
        role={tipo === "radio" ? "radio" : "checkbox"}
        aria-checked={elegida}
        onClick={onElegir}
        disabled={deshabilitada && !elegida}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf7a] disabled:cursor-not-allowed"
      >
        <span
          aria-hidden="true"
          className={[
            "flex h-5 w-5 shrink-0 items-center justify-center border transition-colors",
            tipo === "radio" ? "rounded-full" : "rounded-md",
            elegida ? "border-[#f3cf7a] bg-[#f3cf7a] text-[#0d1d14]" : "border-[rgba(245,240,232,0.4)]",
          ].join(" ")}
        >
          {elegida && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] leading-snug text-[#f5f0e8]">{titulo}</span>
          {detalle && <span className="mt-0.5 block text-[13px] leading-snug text-[rgba(245,240,232,0.6)]">{detalle}</span>}
        </span>
        {lateral && <span className="shrink-0 text-right text-[13.5px] tabular-nums text-[#f3cf7a]">{lateral}</span>}
      </button>
      {children && elegida && <div className="px-4 pb-3.5">{children}</div>}
    </div>
  )
}

"use client"

// Tarjeta del gasto que propuso el chat con IA: muestra los datos y pide la
// confirmación. La IA no carga nada; lo carga la persona con "Sí, cargar"
// (POST /api/chat/gasto, que lee la propuesta guardada, no la de pantalla).
import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, Receipt, XCircle } from "lucide-react"
import { salonLabel } from "@/lib/store"
import type { PropuestaGastoChat } from "@/lib/chat-ia-gasto"
import { fechaCorta, pesos } from "@/components/chat-ia-tarjeta-evento"

export function TarjetaGastoChatIA({
  gasto,
  mensajeId,
  propio,
  onResuelto,
  onIr,
}: {
  gasto: PropuestaGastoChat
  mensajeId: string
  /** false cuando Soporte mira el chat de otra persona: no puede confirmar. */
  propio: boolean
  onResuelto: (gasto: PropuestaGastoChat) => void
  onIr?: () => void
}) {
  const [enviando, setEnviando] = useState<"confirmar" | "cancelar" | null>(null)
  const [error, setError] = useState("")

  const resolver = async (accion: "confirmar" | "cancelar") => {
    if (enviando) return
    setEnviando(accion)
    setError("")
    try {
      const res = await fetch("/api/chat/gasto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajeId, accion }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.gasto) throw new Error(data.error || "No se pudo. Probá de nuevo.")
      onResuelto(data.gasto as PropuestaGastoChat)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo. Probá de nuevo.")
    } finally {
      setEnviando(null)
    }
  }

  const filas: [string, string][] = [
    ["Concepto", gasto.concepto],
    ["Monto", pesos(gasto.monto)],
    ["Salón", salonLabel(gasto.salon)],
    ["Vence", fechaCorta(gasto.vencimiento)],
    ["Carpeta", "Varios"],
  ]

  return (
    <div className="rounded-xl border border-[#d4a533]/60 bg-white px-3 py-2.5 text-gray-900 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-bold text-[#2d5a3d]">
        <Receipt className="h-4 w-4 shrink-0" aria-hidden="true" />
        Gasto variable para Caja Jazmines
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {filas.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-gray-500">{k}</dt>
            <dd className="break-words text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-[11px] text-gray-500">Queda agendado sin pagar; no mueve plata de la caja.</p>

      {gasto.estado === "pendiente" && propio && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => resolver("confirmar")}
            disabled={!!enviando}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2d5a3d] px-3 py-1.5 text-xs font-semibold text-[#f5f0e8] transition-colors hover:bg-[#3a6f4e] disabled:opacity-50"
          >
            {enviando === "confirmar" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Sí, cargar
          </button>
          <button
            type="button"
            onClick={() => resolver("cancelar")}
            disabled={!!enviando}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {enviando === "cancelar" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Cancelar
          </button>
        </div>
      )}
      {gasto.estado === "pendiente" && !propio && (
        <p className="mt-2 text-xs text-gray-500">Sin confirmar.</p>
      )}
      {gasto.estado === "cargado" && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Cargado{gasto.resueltoPor ? ` por ${gasto.resueltoPor}` : ""}.
          <Link href="/finanzas/caja-jazmines" prefetch={false} onClick={onIr} className="underline">
            Ver en Caja Jazmines
          </Link>
        </p>
      )}
      {gasto.estado === "cancelado" && (
        <p className="mt-2 flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">
          <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Cancelado: no se cargó nada.
        </p>
      )}
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  )
}

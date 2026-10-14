"use client"

// Tarjeta del cobro de cuota que preparó el chat con IA: muestra todo el
// detalle y pide la confirmación. La IA no cobra nada; cobra la persona con
// "Sí, cobrar", por el mismo camino que Cobrar cuota: se vuelve a calcular
// con el evento y el IPC de este momento (lib/chat-ia-cobro.ts), se reparte
// entre las cajas con construirMovimientosPago y se guarda con updateEvento
// (PATCH /api/eventos/[id]: transacción, concurrencia e IPC validado). Si
// algo cambió desde que se preparó, no cobra. Después se marca la tarjeta
// como cobrada (/api/chat/cobro, que verifica que el pago esté en el evento).
import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, HandCoins, Loader2, XCircle } from "lucide-react"
import { useStore } from "@/lib/store-context"
import { salonLabel } from "@/lib/store"
import { construirMovimientosPago } from "@/lib/cobrar-cuota"
import { fechaNegocio } from "@/lib/ipc-cuotas"
import { armarCobroDesdePropuesta, type PropuestaCobroChat } from "@/lib/chat-ia-cobro"
import { fechaCorta, pesos } from "@/components/chat-ia-tarjeta-evento"

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

/** "2026-09" → "sep 2026". */
function periodoCorto(periodo: string): string {
  const [a, m] = periodo.split("-").map(Number)
  return a && m ? `${MESES[m - 1]} ${a}` : periodo
}

export function TarjetaCobroChatIA({
  cobro,
  mensajeId,
  propio,
  onResuelto,
  onIr,
}: {
  cobro: PropuestaCobroChat
  mensajeId: string
  /** false cuando Soporte mira el chat de otra persona: no puede confirmar. */
  propio: boolean
  onResuelto: (cobro: PropuestaCobroChat) => void
  onIr?: () => void
}) {
  const { eventos, updateEvento, movimientosCaja, historialIPC, state } = useStore()
  const [enviando, setEnviando] = useState<"confirmar" | "cancelar" | null>(null)
  const [error, setError] = useState("")

  // Marca la tarjeta en el historial del chat (el cobro ya está guardado en el evento).
  const marcar = async (accion: "confirmar" | "cancelar") => {
    const res = await fetch("/api/chat/cobro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensajeId, accion }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.cobro) throw new Error(data.error || "No se pudo. Probá de nuevo.")
    onResuelto(data.cobro as PropuestaCobroChat)
  }

  const resolver = async (accion: "confirmar" | "cancelar") => {
    if (enviando) return
    setEnviando(accion)
    setError("")
    try {
      if (accion === "confirmar") {
        const evento = eventos.find((e) => e.id === cobro.eventoId)
        if (!evento) throw new Error("No encuentro el evento. Actualizá la página y probá de nuevo.")
        // Si el pago ya está en el evento (un toque anterior que no llegó a marcar la tarjeta), no se cobra otra vez.
        if (!(evento.pagos ?? []).some((p) => p.id === cobro.id)) {
          const r = armarCobroDesdePropuesta(evento, historialIPC, fechaNegocio(), cobro)
          if (!r.ok) throw new Error(r.motivo)
          const armado = r.cobro
          // Mismo reparto entre Caja Eventos y Caja Jazmines que Cobrar cuota (costo del evento + 5 %).
          const movimientos = construirMovimientosPago(
            evento,
            armado.etiquetaCaja,
            armado.pago.monto,
            armado.pago.fecha,
            movimientosCaja,
            {
              insumos: state.insumos || [],
              insumosBarra: state.insumosBarra || [],
              recetas: state.recetas || [],
              cocteles: state.cocteles || [],
              servicios: state.servicios || [],
            },
          )
          const guardado = await updateEvento(
            evento.id,
            {
              pagos: armado.pagos,
              planCuotas: armado.planCuotas,
              montoTotalPlan: armado.montoTotalPlan,
              planDeCuotas: armado.planDeCuotas,
            },
            movimientos,
          )
          if (!guardado) throw new Error("No se cobró. Revisá el aviso y probá de nuevo.")
        }
      }
      await marcar(accion)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo. Probá de nuevo.")
    } finally {
      setEnviando(null)
    }
  }

  const cuota = cobro.esPagoUnico
    ? "Pago único"
    : `${cobro.numeroCuota} de ${cobro.totalCuotas}${cobro.esSaldoDeCuota ? " (lo que falta)" : ""}`
  const filas: [string, string][] = [
    ["Evento", cobro.evento],
    ["Salón · fecha", `${salonLabel(cobro.salon)} · ${cobro.fechaEvento ? fechaCorta(cobro.fechaEvento) : "sin fecha"}`],
    ["Cuota", cuota],
    ["Vence", fechaCorta(cobro.vencimiento)],
    [
      "Valor de la cuota",
      `${pesos(cobro.montoCuota)}${cobro.ipc ? ` (IPC ${cobro.ipc.porcentaje.toLocaleString("es-AR")}% ${periodoCorto(cobro.ipc.periodo)}${cobro.ipc.provisorio ? ", provisorio" : ""})` : ""}`,
    ],
  ]
  if (cobro.yaPagado > 0) filas.push(["Ya pagado", pesos(cobro.yaPagado)])
  if (cobro.recargo > 0) {
    filas.push([`Recargo (${cobro.diasAtraso} ${cobro.diasAtraso === 1 ? "día" : "días"} de atraso)`, pesos(cobro.recargo)])
  } else if (cobro.recargoPerdonado > 0) {
    filas.push([`Recargo (${cobro.diasAtraso} ${cobro.diasAtraso === 1 ? "día" : "días"} de atraso)`, `Perdonado (${pesos(cobro.recargoPerdonado)})`])
  }
  filas.push(["Paga", cobro.pagadoPor], ["Recibe", cobro.recibidoPor])
  if (cobro.pagaCon) filas.push(["Paga con", pesos(cobro.pagaCon)])
  if (cobro.vuelto) filas.push(["Vuelto", pesos(cobro.vuelto)])

  return (
    <div className="rounded-xl border border-[#d4a533]/60 bg-white px-3 py-2.5 text-gray-900 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-bold text-[#2d5a3d]">
        <HandCoins className="h-4 w-4 shrink-0" aria-hidden="true" />
        Cobro de cuota
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {filas.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-gray-500">{k}</dt>
            <dd className="break-words text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 flex items-baseline justify-between gap-2 rounded-md bg-[#2d5a3d]/5 px-2 py-1.5">
        <span className="text-xs font-semibold text-[#2d5a3d]">Total a cobrar</span>
        <span className="text-base font-bold text-[#2d5a3d]">{pesos(cobro.monto)}</span>
      </div>
      {!cobro.quedaCompleta && (
        <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Pago parcial: quedan {pesos(cobro.saldoQueQueda)} de esta cuota,{" "}
            {cobro.saldoDecision === "acumular" ? "que se suman a la cuota siguiente" : "que quedan aparte"} y{" "}
            {cobro.recargoSaldo === "acumula" ? "siguen generando IPC" : "quedan congelados"}.
          </span>
        </p>
      )}
      <p className="mt-1.5 text-[11px] text-gray-500">
        Entra repartido entre Caja Eventos y Caja Jazmines, igual que en Cobrar cuota.
      </p>

      {cobro.estado === "pendiente" && propio && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => resolver("confirmar")}
            disabled={!!enviando}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2d5a3d] px-3 py-1.5 text-xs font-semibold text-[#f5f0e8] transition-colors hover:bg-[#3a6f4e] disabled:opacity-50"
          >
            {enviando === "confirmar" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Sí, cobrar
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
      {cobro.estado === "pendiente" && !propio && <p className="mt-2 text-xs text-gray-500">Sin confirmar.</p>}
      {cobro.estado === "cobrado" && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Cobrado{cobro.resueltoPor ? ` por ${cobro.resueltoPor}` : ""}.
          <Link
            href={`/eventos/pagos?evento=${encodeURIComponent(cobro.eventoId)}`}
            prefetch={false}
            onClick={onIr}
            className="underline"
          >
            Ver el pago y el recibo
          </Link>
        </p>
      )}
      {cobro.estado === "cancelado" && (
        <p className="mt-2 flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">
          <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Cancelado: no se cobró nada.
        </p>
      )}
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  )
}

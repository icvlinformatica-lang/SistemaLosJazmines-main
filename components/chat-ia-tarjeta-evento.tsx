"use client"

// Tarjeta de un evento en el chat con IA: la plata ordenada (total, cobrado
// con barra, saldo, cuotas vencidas y la próxima). Los números vienen armados
// del servidor (lib/chat-ia-tarjetas.ts), no del texto de la IA.
import Link from "next/link"
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight } from "lucide-react"
import type { TarjetaEventoChat } from "@/lib/chat-ia-tarjetas"

export function pesos(n: number): string {
  // Sin centavos si es redondo; si no, siempre dos ($792.213,50).
  const decimales = Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`
}

/** "2026-10-17" → "17/10/2026". */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-")
  return a && m && d ? `${Number(d)}/${Number(m)}/${a}` : iso
}

export function TarjetaEventoChatIA({ t, onIr }: { t: TarjetaEventoChat; onIr?: () => void }) {
  const finalizado = t.estado === "completado" || t.estado === "cancelado"
  const porcentaje =
    t.montoTotal && t.montoTotal > 0 ? Math.max(0, Math.min(100, Math.round((t.cobrado / t.montoTotal) * 100))) : null
  const href = finalizado ? "/eventos/finalizados" : `/eventos/pagos?evento=${encodeURIComponent(t.id)}`

  return (
    <div className="rounded-xl border border-[#2d5a3d]/15 bg-white px-3 py-2.5 text-gray-900 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-bold text-[#2d5a3d]" title={t.nombre}>
          {t.nombre}
        </p>
        <p className="shrink-0 text-[11px] text-gray-500">
          {t.salon} · {fechaCorta(t.fecha)}
        </p>
      </div>

      {t.montoTotal === null ? (
        <p className="mt-1 text-xs text-gray-500">Sin precio cargado.</p>
      ) : (
        <>
          <div className="mt-2 flex items-baseline justify-between gap-2 text-xs">
            <span className="text-gray-600">
              Cobrado <span className="font-semibold text-gray-900">{pesos(t.cobrado)}</span>
            </span>
            <span className="text-gray-500">de {pesos(t.montoTotal)}</span>
          </div>
          <div
            className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={porcentaje ?? 0}
            aria-label="Porcentaje cobrado"
          >
            <div className="h-full rounded-full bg-[#2d5a3d]" style={{ width: `${porcentaje ?? 0}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
            <span className="text-gray-500">Saldo</span>
            <span className="text-right font-semibold">{pesos(t.saldoPendiente ?? 0)}</span>
            {t.sena > 0 && (
              <>
                <span className="text-gray-500">Seña</span>
                <span className="text-right">{pesos(t.sena)}</span>
              </>
            )}
            {t.cuotasPendientes > 0 && (
              <>
                <span className="text-gray-500">Cuotas pendientes</span>
                <span className="text-right">{t.cuotasPendientes}</span>
              </>
            )}
          </div>
        </>
      )}

      {!finalizado && t.cuotasVencidas > 0 && (
        <p className="mt-2 flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t.cuotasVencidas === 1 ? "1 cuota vencida" : `${t.cuotasVencidas} cuotas vencidas`} · {pesos(t.montoVencido)}
        </p>
      )}
      {!finalizado && t.cuotasVencidas === 0 && t.montoTotal !== null && (
        <p className="mt-2 flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Al día
        </p>
      )}
      {!finalizado && t.proximaCuota && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Próxima: cuota {t.proximaCuota.numero}, {fechaCorta(t.proximaCuota.vencimiento)} · {pesos(t.proximaCuota.monto)}
        </p>
      )}
      {t.ipcPendiente && (
        <p className="mt-1 text-[11px] text-amber-700">Algún monto puede cambiar: falta el IPC.</p>
      )}
      {finalizado && <p className="mt-2 text-xs text-gray-500">Evento finalizado.</p>}

      <Link
        href={href}
        prefetch={false}
        onClick={onIr}
        className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-[#2d5a3d] hover:underline"
      >
        {finalizado ? "Ver en el Archivo" : "Ver cuotas"}
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  )
}

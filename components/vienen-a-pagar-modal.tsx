"use client"

// Sección "Vienen a pagar" de Inicio: quiénes deben venir a pagar su cuota
// esta semana, con nombre, fecha del evento y salón. Si además deben cuotas
// vencidas de semanas anteriores, se marca ATRASADO con el monto adeudado.

import { useEffect, useState } from "react"
import { X, Users, Loader2, AlertTriangle, CalendarDays } from "lucide-react"

interface VieneAPagar {
  evento: string
  salon: string
  fechaEvento: string
  cuotaSemana: { numero: number; fechaVencimiento: string; monto: number } | null
  montoAtrasado: number
  cuotasAtrasadas: number
}

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR")
}

function fechaCorta(ymd: string): string {
  try {
    return new Date(ymd + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return ymd
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VienenAPagarModal({ open, onOpenChange }: Props) {
  const [lista, setLista] = useState<VieneAPagar[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setLoading(true)
      fetch("/api/resumen-diario")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          setLista(data && !data.error ? data.vienenAPagar || [] : null)
          setLoading(false)
        })
        .catch(() => {
          setLista(null)
          setLoading(false)
        })
    }
  }, [open])

  if (!open) return null

  const totalSemana = (lista || []).reduce((s, v) => s + (v.cuotaSemana?.monto || 0), 0)
  const totalAtrasado = (lista || []).reduce((s, v) => s + v.montoAtrasado, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Vienen a pagar esta semana"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-[#f5f0e8] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 bg-[#2d5a3d] px-5 py-4 text-[#f5f0e8]">
          <div>
            <h2 className="text-lg font-bold">Vienen a pagar</h2>
            <p className="text-xs opacity-90">Cuotas que vencen esta semana y deudas atrasadas</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#2d5a3d]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando cuotas de la semana...
            </div>
          ) : !lista ? (
            <p className="py-10 text-center text-sm text-gray-500">No se pudo cargar la lista.</p>
          ) : lista.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              Nadie tiene cuotas por pagar esta semana ni deudas atrasadas.
            </p>
          ) : (
            <>
              {/* Totales rápidos */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[#2d5a3d]/20 bg-white p-3">
                  <p className="text-xs font-semibold text-gray-600">Por cobrar esta semana</p>
                  <p className="text-sm font-bold text-emerald-700">{fmt(totalSemana)}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-white p-3">
                  <p className="text-xs font-semibold text-gray-600">Deuda atrasada</p>
                  <p className="text-sm font-bold text-red-600">{fmt(totalAtrasado)}</p>
                </div>
              </div>

              {/* Lista */}
              <div className="rounded-lg border border-[#2d5a3d]/20 bg-white">
                {lista.map((v, i) => (
                  <div key={i} className="border-b border-gray-100 px-3 py-2.5 last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold text-gray-800">{v.evento}</span>
                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                          <CalendarDays className="h-3 w-3" />
                          {v.salon} · evento {fechaCorta(v.fechaEvento)}
                        </span>
                      </span>
                      {v.cuotaSemana && (
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-bold text-[#2d5a3d]">{fmt(v.cuotaSemana.monto)}</span>
                          <span className="block text-[11px] text-gray-400">
                            Cuota {v.cuotaSemana.numero} · vence {fechaCorta(v.cuotaSemana.fechaVencimiento)}
                          </span>
                        </span>
                      )}
                    </div>
                    {v.montoAtrasado > 0 && (
                      <p className="mt-1.5 flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Atrasado: debe {fmt(v.montoAtrasado)} ({v.cuotasAtrasadas} cuota
                        {v.cuotasAtrasadas === 1 ? "" : "s"} vencida{v.cuotasAtrasadas === 1 ? "" : "s"})
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <Users className="h-3 w-3" />
                Semana actual de lunes a domingo. Los atrasos incluyen todas las cuotas vencidas sin pagar.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

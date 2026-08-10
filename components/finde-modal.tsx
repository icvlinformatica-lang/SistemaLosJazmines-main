"use client"

// Sección "Este finde" de Inicio: eventos del fin de semana (viernes a
// domingo) con su salón y un pequeño desglose de costos calculado en vivo
// con los mismos criterios que la pantalla Costos del evento.

import { useMemo } from "react"
import { X, CalendarDays, MapPin, ChefHat, Martini, Briefcase, Users, PartyPopper } from "lucide-react"
import { useStore } from "@/lib/store-context"
import {
  calcularComprasSegmentadas,
  calcularComprasBarras,
  calcularMontoPersonalDelEvento,
  calcularSeñaSaldoServicio,
  salonLabel,
} from "@/lib/store"

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR")
}

/** Rango [viernes, domingo] del fin de semana actual o próximo (hora AR). */
function rangoFinde(): { desde: string; hasta: string } {
  const hoyStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
  const hoy = new Date(hoyStr + "T12:00:00")
  const dia = hoy.getDay() // 0 = domingo
  let offsetViernes: number
  if (dia === 0) offsetViernes = -2 // domingo: el finde arrancó el viernes pasado
  else if (dia === 6) offsetViernes = -1 // sábado
  else offsetViernes = 5 - dia // lunes a viernes: el viernes que viene (o hoy)
  const viernes = new Date(hoy)
  viernes.setDate(hoy.getDate() + offsetViernes)
  const domingo = new Date(viernes)
  domingo.setDate(viernes.getDate() + 2)
  const toStr = (d: Date) => d.toISOString().slice(0, 10)
  return { desde: toStr(viernes), hasta: toStr(domingo) }
}

function fechaCorta(fecha: string): string {
  try {
    return new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "short",
    })
  } catch {
    return fecha
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FindeModal({ open, onOpenChange }: Props) {
  const { state } = useStore()

  const { desde, hasta } = useMemo(() => rangoFinde(), [])

  const eventosFinde = useMemo(() => {
    return (state.eventos || [])
      .filter(
        (e) =>
          e.fecha &&
          e.fecha >= desde &&
          e.fecha <= hasta &&
          e.estado !== "cancelado" &&
          e.estado !== "borrador",
      )
      .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))
      .map((evento) => {
        // Mismo criterio de costos que la pantalla "Costos del evento"
        const comprasCocina = calcularComprasSegmentadas(evento, state.recetas || [], state.insumos || [])
        const comprasBarra = calcularComprasBarras(evento, state.cocteles || [], state.insumosBarra || [])
        const costoCocina = comprasCocina.reduce((s, c) => s + c.costoMateriaPrima, 0)
        const costoBarra = comprasBarra.reduce((s, c) => s + c.costoMateriaPrima, 0)
        const totalPersonal = (evento.personalEvento || []).reduce(
          (s, pe) => s + (calcularMontoPersonalDelEvento(pe, state.personal) || 0),
          0,
        )
        const totalServicios = (evento.servicios || []).reduce((s, srv) => {
          const { montoSeña, saldoPendiente } = calcularSeñaSaldoServicio(srv, {
            servicios: state.servicios ?? [],
          })
          return s + montoSeña + saldoPendiente
        }, 0)
        const invitados =
          (evento.adultos || 0) + (evento.adolescentes || 0) + (evento.ninos || 0)
        return {
          evento,
          costoCocina,
          costoBarra,
          totalPersonal,
          totalServicios,
          total: costoCocina + costoBarra + totalPersonal + totalServicios,
          invitados,
        }
      })
  }, [state, desde, hasta])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Eventos de este fin de semana"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-[#f5f0e8] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 bg-[#2d5a3d] px-5 py-4 text-[#f5f0e8]">
          <div>
            <h2 className="text-lg font-bold">Este finde</h2>
            <p className="text-xs opacity-90">
              Del {fechaCorta(desde)} al {fechaCorta(hasta)}
            </p>
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
          {eventosFinde.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
              <PartyPopper className="h-8 w-8" />
              <p className="text-sm">No hay eventos este fin de semana.</p>
            </div>
          ) : (
            eventosFinde.map(({ evento, costoCocina, costoBarra, totalPersonal, totalServicios, total, invitados }) => (
              <div key={evento.id} className="rounded-lg border border-[#2d5a3d]/20 bg-white p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-800">
                      {evento.nombre || evento.nombrePareja || "Sin nombre"}
                    </p>
                    <p className="flex items-center gap-1 text-xs capitalize text-gray-500">
                      <CalendarDays className="h-3 w-3" />
                      {evento.fecha ? fechaCorta(evento.fecha) : "Sin fecha"}
                      {evento.horario ? ` · ${evento.horario}` : ""}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#2d5a3d]/10 px-2.5 py-1 text-xs font-semibold text-[#2d5a3d]">
                    <MapPin className="h-3 w-3" />
                    {salonLabel(evento.salon)}
                  </span>
                </div>

                {/* Desglose de costos */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <ChefHat className="h-3.5 w-3.5" /> Cocina
                  </span>
                  <span className="text-right font-medium text-gray-800">{fmt(costoCocina)}</span>
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Martini className="h-3.5 w-3.5" /> Barra
                  </span>
                  <span className="text-right font-medium text-gray-800">{fmt(costoBarra)}</span>
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Briefcase className="h-3.5 w-3.5" /> Servicios
                  </span>
                  <span className="text-right font-medium text-gray-800">{fmt(totalServicios)}</span>
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Users className="h-3.5 w-3.5" /> Personal
                  </span>
                  <span className="text-right font-medium text-gray-800">{fmt(totalPersonal)}</span>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                  <span className="text-xs text-gray-500">
                    {invitados > 0 ? `${invitados} invitados` : "Sin invitados cargados"}
                  </span>
                  <span className="text-sm font-bold text-[#2d5a3d]">Total {fmt(total)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

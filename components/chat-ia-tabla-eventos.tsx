"use client"

// Tabla del chat con IA: cantidad de eventos por salón (filas) y por mes
// (columnas), con totales. Los números los arma el servidor
// (lib/chat-ia-tabla.ts); acá solo se muestran.
import { CalendarDays } from "lucide-react"
import { salonLabel } from "@/lib/store"
import type { TablaEventosChat } from "@/lib/chat-ia-tabla"
import { fechaCorta } from "@/components/chat-ia-tarjeta-evento"

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

function mesCorto(mes: string, conAnio: boolean): string {
  const [a, m] = mes.split("-").map(Number)
  const nombre = MESES_CORTOS[(m ?? 1) - 1] ?? mes
  return conAnio ? `${nombre} ${String(a).slice(2)}` : nombre
}

const celda = (n: number) => (n === 0 ? <span className="text-gray-300">–</span> : n)

export function TablaEventosChatIA({ tabla }: { tabla: TablaEventosChat }) {
  const variosAnios = new Set(tabla.meses.map((m) => m.slice(0, 4))).size > 1
  return (
    <div className="rounded-xl border border-[#d4a533]/60 bg-white px-3 py-2.5 text-gray-900 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-bold text-[#2d5a3d]">
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
        Eventos por salón y mes
      </p>
      <p className="mt-0.5 text-[11px] text-gray-500">
        Del {fechaCorta(tabla.desde)} al {fechaCorta(tabla.hasta)}
      </p>
      {tabla.filas.length === 0 ? (
        <p className="mt-2 text-xs text-gray-600">No hay eventos en ese período.</p>
      ) : (
        // Si hay muchos meses, se desliza la tabla, no la pantalla.
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-1 pr-2 text-left font-medium">Salón</th>
                {tabla.meses.map((m) => (
                  <th key={m} className="px-1.5 py-1 text-right font-medium">
                    {mesCorto(m, variosAnios)}
                  </th>
                ))}
                <th className="py-1 pl-2 text-right font-semibold text-[#2d5a3d]">Total</th>
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((f) => (
                <tr key={f.salon} className="border-b border-gray-100">
                  <td className="whitespace-nowrap py-1 pr-2 font-medium">{salonLabel(f.salon)}</td>
                  {f.porMes.map((n, i) => (
                    <td key={tabla.meses[i]} className="px-1.5 py-1 text-right">
                      {celda(n)}
                    </td>
                  ))}
                  <td className="py-1 pl-2 text-right font-semibold">{f.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#2d5a3d]/5 font-bold text-[#2d5a3d]">
                <td className="rounded-l-md py-1.5 pl-1 pr-2">Total</td>
                {tabla.totalPorMes.map((n, i) => (
                  <td key={tabla.meses[i]} className="px-1.5 py-1.5 text-right">
                    {n}
                  </td>
                ))}
                <td className="rounded-r-md py-1.5 pl-2 pr-1 text-right text-sm">{tabla.total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {tabla.borradores > 0 && (
        <p className="mt-1.5 text-[11px] text-gray-500">
          Incluye {tabla.borradores} {tabla.borradores === 1 ? "borrador" : "borradores"}.
        </p>
      )}
    </div>
  )
}

"use client"

// Tabla del chat con IA: eventos por salón, mes, estado o tipo, o el
// Historial de Actividad por persona, tema o día, con totales. Los números
// los arma el servidor (lib/chat-ia-tabla.ts); acá solo se muestran.
import { Table2 } from "lucide-react"
import { salonLabel } from "@/lib/store"
import type { TablaChat } from "@/lib/chat-ia-tabla"
import { pesos } from "@/components/chat-ia-tarjeta-evento"

const ENCABEZADO: Record<string, string> = {
  salon: "Salón",
  mes: "Mes",
  estado: "Estado",
  tipo: "Tipo",
  persona: "Quién",
  tema: "Tema",
  dia: "Día",
}

export function TablaChatIA({ tabla }: { tabla: TablaChat }) {
  const valor = (n: number) => (tabla.formato === "pesos" ? pesos(n) : n.toLocaleString("es-AR"))
  const celda = (n: number) => (n === 0 ? <span className="text-gray-300">–</span> : valor(n))
  // Los salones se muestran con el nombre configurado (Configuración), no con la clave.
  const etiqueta = (por: string | null, clave: string, texto: string) => (por === "salon" && clave !== "__otros" ? salonLabel(clave) : texto)
  const sinColumnas = tabla.columnas.length === 0

  return (
    <div className="rounded-xl border border-[#d4a533]/60 bg-white px-3 py-2.5 text-gray-900 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-bold text-[#2d5a3d]">
        <Table2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        {tabla.titulo}
      </p>
      <p className="mt-0.5 text-[11px] text-gray-500">{tabla.subtitulo}</p>
      {tabla.filas.length === 0 ? (
        <p className="mt-2 text-xs text-gray-600">No hay datos en ese período.</p>
      ) : (
        // Si hay muchas columnas, se desliza la tabla, no la pantalla (la primera columna queda fija).
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="sticky left-0 bg-white py-1 pr-2 text-left font-medium">{ENCABEZADO[tabla.filasPor] ?? ""}</th>
                {tabla.columnas.map((c) => (
                  <th key={c.clave} className="whitespace-nowrap px-1.5 py-1 text-right font-medium">
                    {etiqueta(tabla.columnasPor, c.clave, c.etiqueta)}
                  </th>
                ))}
                <th className="py-1 pl-2 text-right font-semibold text-[#2d5a3d]">Total</th>
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((f) => (
                <tr key={f.clave} className="border-b border-gray-100">
                  <td className="sticky left-0 bg-white py-1 pr-2 font-medium">{etiqueta(tabla.filasPor, f.clave, f.etiqueta)}</td>
                  {f.valores.map((n, i) => (
                    <td key={tabla.columnas[i].clave} className="whitespace-nowrap px-1.5 py-1 text-right">
                      {celda(n)}
                    </td>
                  ))}
                  <td className={`whitespace-nowrap py-1 pl-2 text-right ${sinColumnas ? "" : "font-semibold"}`}>{valor(f.total)}</td>
                </tr>
              ))}
            </tbody>
            {tabla.filas.length > 1 && (
              <tfoot>
                <tr className="bg-[#2d5a3d]/5 font-bold text-[#2d5a3d]">
                  <td className="sticky left-0 rounded-l-md bg-[#f4f7f5] py-1.5 pl-1 pr-2">Total</td>
                  {tabla.totalPorColumna.map((n, i) => (
                    <td key={tabla.columnas[i].clave} className="whitespace-nowrap px-1.5 py-1.5 text-right">
                      {valor(n)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap rounded-r-md py-1.5 pl-2 pr-1 text-right text-sm">{valor(tabla.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {tabla.nota && <p className="mt-1.5 text-[11px] text-gray-500">{tabla.nota}</p>}
    </div>
  )
}

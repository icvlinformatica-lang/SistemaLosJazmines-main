"use client"

// Campo de búsqueda + filtro por mes de Caja Eventos ("Por cobrar", "Por
// pagar" e "Historial"). Solo pantalla: filtra lo que ya está cargado; la
// lógica está en lib/buscador-caja-eventos.ts.

import { Search, X, ChevronDown } from "lucide-react"
import { etiquetaMes } from "@/lib/buscador-caja-eventos"

export function BuscadorCaja({
  q,
  onQ,
  mes,
  onMes,
  meses,
  placeholder,
  etiquetaMesTodos = "Todos los meses",
}: {
  q: string
  onQ: (q: string) => void
  mes: string
  onMes: (mes: string) => void
  /** Meses "YYYY-MM" para elegir (del más nuevo al más viejo). */
  meses: string[]
  placeholder: string
  etiquetaMesTodos?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 pb-2">
      <div className="flex min-w-0 flex-1 basis-[12rem] items-center gap-1.5 rounded-full border border-border bg-card pl-3 pr-1 py-1">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(ev) => onQ(ev.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            type="button"
            onClick={() => onQ("")}
            aria-label="Borrar búsqueda"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="relative shrink-0">
        <select
          value={mes}
          onChange={(ev) => onMes(ev.target.value)}
          aria-label="Filtrar por mes"
          className={`appearance-none rounded-full border pl-3 pr-7 py-1 text-xs font-medium cursor-pointer transition-colors ${
            mes !== "todos"
              ? "bg-foreground text-background border-foreground"
              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
          }`}
        >
          <option value="todos">{etiquetaMesTodos}</option>
          {/* Si el mes elegido ya no tiene renglones, se mantiene en la lista para poder volver atrás. */}
          {(mes !== "todos" && !meses.includes(mes) ? [mes, ...meses] : meses).map((m) => (
            <option key={m} value={m}>
              {etiquetaMes(m)}
            </option>
          ))}
        </select>
        <ChevronDown
          className={`pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 ${
            mes !== "todos" ? "text-background" : "text-muted-foreground"
          }`}
        />
      </div>
    </div>
  )
}

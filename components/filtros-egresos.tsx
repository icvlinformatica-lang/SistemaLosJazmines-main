"use client"

// Barra de filtros combinables para las tablas "Por pagar" y "Gastos futuros"
// de Caja Eventos: salón (filtro madre) + tipo de pasivo + sub-filtro
// (tipo de servicio o evento según el chip) + búsqueda por texto (lupa).
// Todos los filtros se aplican A LA VEZ.

import { useMemo, useRef, useEffect } from "react"
import { Search, X, ChevronDown } from "lucide-react"
import { salonLabel } from "@/lib/store"
import type { EgresoPendienteServicio } from "@/lib/hooks/use-caja-eventos"

export interface FiltroEgresos {
  salon: string // "todos" o id del salón
  tipo: string // "todos" | "seña" | "saldo" | "menu" | "barra" | "sueldo" | "servicios"
  sub: string | null // tipo de servicio (seña/saldo/servicios) o nombre de evento (sueldo)
  q: string // texto de búsqueda
  qAbierta: boolean // si el input de búsqueda está desplegado
}

export const FILTRO_EGRESOS_INICIAL: FiltroEgresos = {
  salon: "todos",
  tipo: "todos",
  sub: null,
  q: "",
  qAbierta: false,
}

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

const coincideTipo = (e: EgresoPendienteServicio, tipo: string) => {
  if (tipo === "todos") return true
  if (tipo === "servicios") return e.tipo === "seña" || e.tipo === "saldo"
  return e.tipo === tipo
}

/** Aplica salón + tipo + sub-filtro + búsqueda, todos combinados. */
export function filtrarEgresos(egresos: EgresoPendienteServicio[], f: FiltroEgresos): EgresoPendienteServicio[] {
  return egresos.filter((e) => {
    if (f.salon !== "todos" && e.salon !== f.salon) return false
    if (!coincideTipo(e, f.tipo)) return false
    if (f.sub) {
      if (f.tipo === "sueldo") {
        if (e.eventoNombre !== f.sub) return false
      } else if (e.servicioNombre !== f.sub) {
        return false
      }
    }
    if (f.q.trim()) {
      const q = norm(f.q)
      if (!norm(e.eventoNombre).includes(q) && !norm(e.servicioNombre).includes(q)) return false
    }
    return true
  })
}

export function esFiltroEgresosActivo(f: FiltroEgresos): boolean {
  return f.salon !== "todos" || f.tipo !== "todos" || f.sub !== null || f.q.trim() !== ""
}

const CHIPS_TIPO = [
  { id: "todos", label: "Todos", activo: "bg-foreground text-background border-foreground", inactivo: "bg-muted/50 text-muted-foreground border-border hover:bg-muted" },
  { id: "menu", label: "Menú", activo: "bg-sky-500 text-white border-sky-500", inactivo: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100" },
  { id: "barra", label: "Barra", activo: "bg-violet-500 text-white border-violet-500", inactivo: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100" },
  { id: "sueldo", label: "Sueldos", activo: "bg-emerald-500 text-white border-emerald-500", inactivo: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
  { id: "servicios", label: "Servicios", activo: "bg-indigo-500 text-white border-indigo-500", inactivo: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" },
]

/** Estilo del sub-chip según el tipo activo, para mantener coherencia de color. */
const SUB_ESTILOS: Record<string, { activo: string; inactivo: string }> = {
  "seña": { activo: "bg-amber-500 text-white border-amber-500", inactivo: "bg-card text-amber-800 border-amber-300 hover:bg-amber-50" },
  saldo: { activo: "bg-orange-500 text-white border-orange-500", inactivo: "bg-card text-orange-800 border-orange-300 hover:bg-orange-50" },
  sueldo: { activo: "bg-emerald-600 text-white border-emerald-600", inactivo: "bg-card text-emerald-800 border-emerald-300 hover:bg-emerald-50" },
  servicios: { activo: "bg-indigo-500 text-white border-indigo-500", inactivo: "bg-card text-indigo-800 border-indigo-300 hover:bg-indigo-50" },
}

export function BarraFiltrosEgresos({
  egresos,
  filtro,
  onChange,
  catalogoServicios = [],
}: {
  egresos: EgresoPendienteServicio[]
  filtro: FiltroEgresos
  onChange: (f: FiltroEgresos) => void
  /** Nombres de todos los servicios activos del catálogo (Finanzas → Servicios),
   * para que el sub-filtro de "Servicios" muestre todo lo que ofrecemos, no
   * solo los que tienen un pago pendiente en este momento. */
  catalogoServicios?: string[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (filtro.qAbierta) inputRef.current?.focus()
  }, [filtro.qAbierta])

  // Salones disponibles entre los egresos (filtro madre, siempre sobre el total)
  const salones = useMemo(() => {
    const s = new Set<string>()
    for (const e of egresos) if (e.salon) s.add(e.salon)
    return [...s].sort()
  }, [egresos])

  // Base para contar chips de tipo: aplica salón + búsqueda (no tipo/sub)
  const base = useMemo(
    () => filtrarEgresos(egresos, { ...filtro, tipo: "todos", sub: null }),
    [egresos, filtro],
  )
  const conteo = useMemo(() => {
    const c: Record<string, number> = { todos: base.length, servicios: 0 }
    for (const e of base) {
      c[e.tipo] = (c[e.tipo] || 0) + 1
      if (e.tipo === "seña" || e.tipo === "saldo") c.servicios++
    }
    return c
  }, [base])

  // Sub-opciones según el tipo activo: para "Servicios" es el catálogo
  // completo (todo lo que ofrecemos, tenga o no pagos pendientes ahora);
  // para "Sueldos" son los eventos con pagos de personal pendientes.
  const subOpciones = useMemo(() => {
    if (filtro.tipo === "servicios") {
      const enTipo = base.filter((e) => coincideTipo(e, "servicios"))
      const c = new Map<string, number>()
      for (const e of enTipo) {
        if (e.servicioNombre) c.set(e.servicioNombre, (c.get(e.servicioNombre) || 0) + 1)
      }
      const nombres = new Set(catalogoServicios)
      for (const nombre of c.keys()) nombres.add(nombre)
      return [...nombres].sort((a, b) => a.localeCompare(b)).map((nombre) => [nombre, c.get(nombre) || 0] as [string, number])
    }
    if (filtro.tipo !== "sueldo") return []
    const enTipo = base.filter((e) => coincideTipo(e, filtro.tipo))
    const c = new Map<string, number>()
    for (const e of enTipo) {
      if (e.eventoNombre) c.set(e.eventoNombre, (c.get(e.eventoNombre) || 0) + 1)
    }
    return [...c.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [base, filtro.tipo, catalogoServicios])

  const setTipo = (tipo: string) => onChange({ ...filtro, tipo, sub: null })

  return (
    <div className="flex flex-col gap-2 px-6 pb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Filtro madre: salón */}
        <div className="relative">
          <select
            value={filtro.salon}
            onChange={(ev) => onChange({ ...filtro, salon: ev.target.value })}
            aria-label="Filtrar por salón"
            className={`appearance-none rounded-full border pl-3 pr-7 py-1 text-xs font-medium cursor-pointer transition-colors ${
              filtro.salon !== "todos"
                ? "bg-foreground text-background border-foreground"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            <option value="todos">Salón: todos</option>
            {salones.map((s) => (
              <option key={s} value={s}>
                {salonLabel(s)}
              </option>
            ))}
          </select>
          <ChevronDown
            className={`pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 ${
              filtro.salon !== "todos" ? "text-background" : "text-muted-foreground"
            }`}
          />
        </div>
        <span className="h-4 w-px bg-border mx-0.5" aria-hidden="true" />
        {/* Chips por tipo de pasivo */}
        {CHIPS_TIPO.filter((f) => (conteo[f.id] || 0) > 0 || f.id === "todos").map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTipo(f.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filtro.tipo === f.id ? f.activo : f.inactivo
            }`}
          >
            {f.label}
            <span className={`text-[10px] font-bold ${filtro.tipo === f.id ? "opacity-80" : "opacity-60"}`}>
              {conteo[f.id] || 0}
            </span>
          </button>
        ))}
        {/* Lupa de búsqueda a la derecha */}
        <div className="ml-auto flex items-center gap-1">
          {filtro.qAbierta ? (
            <div className="flex items-center gap-1 rounded-full border border-border bg-card pl-2.5 pr-1 py-0.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={filtro.q}
                onChange={(ev) => onChange({ ...filtro, q: ev.target.value })}
                placeholder="Buscar evento o servicio..."
                className="w-44 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => onChange({ ...filtro, q: "", qAbierta: false })}
                aria-label="Cerrar búsqueda"
                className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onChange({ ...filtro, qAbierta: true })}
              aria-label="Buscar evento"
              className="rounded-full border border-border bg-muted/50 p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {/* Sub-filtros del tipo activo: tipos de servicio o eventos */}
      {subOpciones.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-1 border-l-2 border-border ml-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium pl-1.5">
            {filtro.tipo === "sueldo" ? "Evento:" : "Servicio:"}
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...filtro, sub: null })}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              filtro.sub === null
                ? (SUB_ESTILOS[filtro.tipo]?.activo ?? "bg-foreground text-background border-foreground")
                : (SUB_ESTILOS[filtro.tipo]?.inactivo ?? "bg-card text-muted-foreground border-border hover:bg-muted")
            }`}
          >
            Todos
          </button>
          {subOpciones.map(([nombre, cant]) => (
            <button
              key={nombre}
              type="button"
              onClick={() => onChange({ ...filtro, sub: filtro.sub === nombre ? null : nombre })}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                filtro.sub === nombre
                  ? (SUB_ESTILOS[filtro.tipo]?.activo ?? "bg-foreground text-background border-foreground")
                  : (SUB_ESTILOS[filtro.tipo]?.inactivo ?? "bg-card text-muted-foreground border-border hover:bg-muted")
              }`}
            >
              {nombre}
              <span className={`text-[9px] font-bold ${filtro.sub === nombre ? "opacity-80" : "opacity-50"}`}>{cant}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

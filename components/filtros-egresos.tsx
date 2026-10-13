"use client"

// Barra de filtros combinables para las tablas "Por pagar" y "Gastos futuros"
// de Caja Eventos: salón (filtro madre) + tipo de pasivo + sub-filtro
// (tipo de servicio o evento según el chip) + búsqueda por texto + mes de
// vencimiento. Todos los filtros se aplican A LA VEZ. El campo de búsqueda y
// el mes se dibujan aparte (app/finanzas/caja-eventos/buscador-caja.tsx),
// siempre visibles; acá solo se aplican.

import { useMemo } from "react"
import { ChevronDown } from "lucide-react"
import { salonLabel } from "@/lib/store"
import type { EgresoPendienteServicio } from "@/lib/hooks/use-caja-eventos"
import { etiquetaGrupo, grupoServicio } from "@/lib/grupo-servicio"
import { coincideEgresoBusqueda, coincideMes } from "@/lib/buscador-caja-eventos"

export interface FiltroEgresos {
  salon: string // "todos" o id del salón
  tipo: string // "todos" | "seña" | "saldo" | "menu" | "barra" | "sueldo" | "servicios"
  sub: string | null // grupo de servicio (grupoServicio, ej. "VESTIDO") o persona (sueldo)
  q: string // texto de búsqueda (evento, proveedor/persona o concepto)
  qAbierta: boolean // ya no se usa: la búsqueda queda siempre visible
  mes: string // "todos" o "YYYY-MM" (mes de vencimiento)
}

export const FILTRO_EGRESOS_INICIAL: FiltroEgresos = {
  salon: "todos",
  tipo: "todos",
  sub: null,
  q: "",
  qAbierta: false,
  mes: "todos",
}

/** A quién se le paga un sueldo: el personal (sin la función) o el servicio
 *  que se paga como sueldo. Fallback al nombre completo por las dudas. */
const personaDe = (e: EgresoPendienteServicio) => e.persona || e.servicioNombre

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
        if (personaDe(e) !== f.sub) return false
      } else if (grupoServicio(e.servicioNombre) !== f.sub) {
        return false
      }
    }
    if (!coincideMes(f.mes, e.fechaVencimiento)) return false
    if (!coincideEgresoBusqueda(e, f.q)) return false
    return true
  })
}

export function esFiltroEgresosActivo(f: FiltroEgresos): boolean {
  return f.salon !== "todos" || f.tipo !== "todos" || f.sub !== null || f.q.trim() !== "" || (f.mes ?? "todos") !== "todos"
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
  /** Nombres de todos los servicios activos del catálogo (Finanzas → Servicios).
   * Solo aportan variantes de nombre para la etiqueta del grupo: el sub-filtro
   * muestra únicamente los servicios con algún pago en la lista. */
  catalogoServicios?: string[]
}) {
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

  // Sub-opciones según el tipo activo: para "Servicios" son los servicios
  // con algún pago en la lista (los que no tienen ninguno no aparecen),
  // agrupados: "VESTIDO 2027", "vestido 2025" y "VESTIDO" son una sola
  // pastilla "VESTIDO" (lib/grupo-servicio.ts);
  // para "Sueldos" son las personas (y servicios pagados como sueldo) con
  // pagos pendientes, de todos los eventos.
  const subOpciones = useMemo(() => {
    if (filtro.tipo === "servicios") {
      const enTipo = base.filter((e) => coincideTipo(e, "servicios"))
      const c = new Map<string, number>()
      const nombresPorGrupo = new Map<string, string[]>()
      const sumarNombre = (nombre: string) => {
        if (!nombre) return
        const g = grupoServicio(nombre)
        nombresPorGrupo.set(g, [...(nombresPorGrupo.get(g) ?? []), nombre])
      }
      for (const nombre of catalogoServicios) sumarNombre(nombre)
      for (const e of enTipo) {
        if (!e.servicioNombre) continue
        sumarNombre(e.servicioNombre)
        const g = grupoServicio(e.servicioNombre)
        c.set(g, (c.get(g) || 0) + 1)
      }
      // Solo los servicios que tienen algún pago en la lista (o el que está
      // elegido, para poder destildarlo si un filtro lo dejó en 0).
      return [...nombresPorGrupo.entries()]
        .filter(([g]) => (c.get(g) || 0) > 0 || g === filtro.sub)
        .map(([g, nombres]) => [g, c.get(g) || 0, etiquetaGrupo(g, nombres)] as [string, number, string])
        .sort((a, b) => a[2].localeCompare(b[2], "es"))
    }
    if (filtro.tipo !== "sueldo") return []
    const enTipo = base.filter((e) => coincideTipo(e, filtro.tipo))
    const c = new Map<string, number>()
    for (const e of enTipo) {
      const persona = personaDe(e)
      if (persona) c.set(persona, (c.get(persona) || 0) + 1)
    }
    return [...c.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "es"))
      .map(([persona, cant]) => [persona, cant, persona] as [string, number, string])
  }, [base, filtro.tipo, filtro.sub, catalogoServicios])

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
      </div>
      {/* Sub-filtros del tipo activo: tipos de servicio o eventos */}
      {subOpciones.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-1 border-l-2 border-border ml-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium pl-1.5">
            {filtro.tipo === "sueldo" ? "Persona:" : "Servicio:"}
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
          {subOpciones.map(([nombre, cant, etiqueta]) => (
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
              {etiqueta}
              <span className={`text-[9px] font-bold ${filtro.sub === nombre ? "opacity-80" : "opacity-50"}`}>{cant}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

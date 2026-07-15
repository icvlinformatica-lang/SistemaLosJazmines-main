"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import type { Receta } from "@/lib/store"

const CATEGORIAS_ORDEN = [
  "Recepción",
  "Entrada",
  "Plato Principal",
  "Guarnición",
  "Postre",
  "Mesa Dulce",
  "Menú para Niños",
  "Menú Adolescente",
  "Celiaco",
  "Vegano",
  "Vegetariano",
  "Sin Sal",
]

const FILTROS = [
  { label: "Todos", value: null },
  { label: "Recepción", value: "Recepción" },
  { label: "Entradas", value: "Entrada" },
  { label: "Principales", value: "Plato Principal" },
  { label: "Guarnición", value: "Guarnición" },
  { label: "Postres", value: "Postre" },
  { label: "Mesa Dulce", value: "Mesa Dulce" },
  { label: "Niños", value: "Menú para Niños" },
]

type Segment = "adultos" | "adolescentes" | "ninos" | "dietasEspeciales"

interface Props {
  recetas: Receta[]
  recetasAdultos: string[]
  recetasAdolescentes: string[]
  recetasNinos: string[]
  recetasDietasEspeciales: string[]
  multipliersAdultos: Record<string, number>
  multipliersAdolescentes: Record<string, number>
  multipliersNinos: Record<string, number>
  multipliersDietasEspeciales: Record<string, number>
  adultos: number
  adolescentes: number
  ninos: number
  personasDietasEspeciales: number
  esBloqueado: boolean
  onToggle: (recetaId: string, segment: Segment) => void
  onMultiplierChange: (recetaId: string, segment: Segment, value: number) => void
}

const OPCIONES: { value: number; label: string }[] = [
  { value: 0.25, label: "¼" },
  { value: 0.5,  label: "½" },
  { value: 1,    label: "1" },
  { value: 2,    label: "2" },
]

function MultiplierPopover({
  recetaId,
  segment,
  current,
  onSelect,
  onRemove,
  disabled,
}: {
  recetaId: string
  segment: Segment
  current: number
  onSelect: (value: number) => void
  onRemove: () => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const labelActual = OPCIONES.find((o) => o.value === current)?.label ?? `${current}x`

  // Cierra al hacer click fuera
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return
    e.stopPropagation()
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const popoverH = 44
      const spaceBelow = window.innerHeight - rect.bottom
      const top = spaceBelow >= popoverH + 8
        ? rect.bottom + 4
        : rect.top - popoverH - 4
      setPopoverStyle({
        position: "fixed",
        top,
        left: rect.left + rect.width / 2,
        transform: "translateX(-50%)",
        zIndex: 9999,
      })
    }
    setOpen((v) => !v)
  }

  const handleSelect = (e: React.MouseEvent, v: number) => {
    e.stopPropagation()
    onSelect(v)
    setOpen(false)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove()
    setOpen(false)
  }

  const popoverContent = open ? (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="bg-white border border-border rounded-lg shadow-xl p-1 flex gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {OPCIONES.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={(e) => handleSelect(e, value)}
          className={`w-8 h-8 rounded text-sm font-semibold transition-colors
            ${current === value ? "bg-[#2d5a3d] text-white" : "hover:bg-emerald-50 text-foreground"}`}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        onClick={handleRemove}
        className="w-8 h-8 rounded text-sm font-semibold transition-colors text-red-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center"
        title="Quitar plato"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
      </button>
    </div>
  ) : null

  return (
    <div className="relative flex items-center justify-center">
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`flex items-center gap-1 rounded px-2 py-1 text-sm font-medium transition-colors select-none
          ${disabled ? "cursor-default opacity-60" : "hover:bg-emerald-100 cursor-pointer"}
          text-[#2d5a3d]`}
        title={disabled ? undefined : "Ajustar porciones o quitar"}
      >
        <span className="text-base">✓</span>
        {current !== 1 && <span className="text-xs">({labelActual})</span>}
      </button>
      {typeof window !== "undefined" && popoverContent
        ? createPortal(popoverContent, document.body)
        : null}
    </div>
  )
}

export function MenuTable({
  recetas,
  recetasAdultos,
  recetasAdolescentes,
  recetasNinos,
  recetasDietasEspeciales,
  multipliersAdultos,
  multipliersAdolescentes,
  multipliersNinos,
  multipliersDietasEspeciales,
  adultos,
  adolescentes,
  ninos,
  personasDietasEspeciales,
  esBloqueado,
  onToggle,
  onMultiplierChange,
}: Props) {
  const [filtroActivo, setFiltroActivo] = useState<string | null>(null)

  const segmentArrays: Record<Segment, string[]> = {
    adultos: recetasAdultos,
    adolescentes: recetasAdolescentes,
    ninos: recetasNinos,
    dietasEspeciales: recetasDietasEspeciales,
  }

  const segmentMultipliers: Record<Segment, Record<string, number>> = {
    adultos: multipliersAdultos,
    adolescentes: multipliersAdolescentes,
    ninos: multipliersNinos,
    dietasEspeciales: multipliersDietasEspeciales,
  }

  const recetasFiltradas = filtroActivo
    ? recetas.filter((r) => r.categoria === filtroActivo)
    : recetas

  // Agrupar por categoria respetando el orden. Cualquier categoría que no esté
  // en CATEGORIAS_ORDEN (nuevas categorías/platos) se agrega al final para que
  // siempre se muestre y nunca quede oculta.
  const categoriasExtra = Array.from(
    new Set(recetasFiltradas.map((r) => r.categoria).filter((c) => !CATEGORIAS_ORDEN.includes(c))),
  )
  const grupos = [...CATEGORIAS_ORDEN, ...categoriasExtra]
    .map((cat) => ({
      categoria: cat,
      recetas: recetasFiltradas.filter((r) => r.categoria === cat),
    }))
    .filter((g) => g.recetas.length > 0)

  const totalSeleccionados =
    recetasAdultos.length + recetasAdolescentes.length + recetasNinos.length + recetasDietasEspeciales.length

  const SEGMENTS: { key: Segment; label: string; count: number }[] = [
    { key: "adultos", label: "Adultos", count: adultos },
    { key: "adolescentes", label: "Adolesc.", count: adolescentes },
    { key: "ninos", label: "Niños", count: ninos },
    { key: "dietasEspeciales", label: "Especiales", count: personasDietasEspeciales },
  ]

  return (
    <div className="space-y-3">
      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setFiltroActivo(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors
              ${filtroActivo === f.value
                ? "bg-[#2d5a3d] text-white border-[#2d5a3d]"
                : "bg-white text-foreground border-border hover:border-[#2d5a3d] hover:text-[#2d5a3d]"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="py-2.5 px-3 text-left font-medium text-muted-foreground w-[45%]">Plato</th>
              {SEGMENTS.map((s) => (
                <th key={s.key} className="py-2.5 px-2 text-center font-medium text-muted-foreground">
                  <div className="leading-tight">{s.label}</div>
                  <div className="text-xs font-normal text-muted-foreground/70">({s.count})</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                  No hay recetas disponibles
                </td>
              </tr>
            )}
            {grupos.map((grupo) => (
              <>
                {/* Encabezado de categoría */}
                <tr key={`cat-${grupo.categoria}`}>
                  <td
                    colSpan={5}
                    className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-white"
                    style={{ backgroundColor: "#2d5a3d" }}
                  >
                    {grupo.categoria}
                  </td>
                </tr>
                {/* Filas de recetas */}
                {grupo.recetas.map((receta, idx) => (
                  <tr
                    key={receta.id}
                    className={`border-b border-border/50 transition-colors hover:bg-muted/20 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
                    <td className="py-2.5 px-3 font-medium text-foreground">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{receta.nombre}</span>
                        {(!receta.insumos || receta.insumos.length === 0) && (
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none border border-amber-400 bg-amber-50 text-amber-600">
                            falta completar
                          </span>
                        )}
                      </div>
                    </td>
                    {SEGMENTS.map((s) => {
                      const selected = segmentArrays[s.key].includes(receta.id)
                      const multiplier = segmentMultipliers[s.key][receta.id] || 1
                      return (
                        <td key={s.key} className="py-1.5 px-2 text-center">
                          {selected ? (
                            <MultiplierPopover
                              recetaId={receta.id}
                              segment={s.key}
                              current={multiplier}
                              onSelect={(v) => onMultiplierChange(receta.id, s.key, v)}
                              onRemove={() => onToggle(receta.id, s.key)}
                              disabled={esBloqueado}
                            />
                          ) : (
                            <button
                              type="button"
                              disabled={esBloqueado}
                              onClick={() => !esBloqueado && onToggle(receta.id, s.key)}
                              className={`w-8 h-8 mx-auto flex items-center justify-center rounded border border-dashed border-border transition-colors
                                ${esBloqueado ? "opacity-30 cursor-default" : "hover:border-[#2d5a3d] hover:bg-emerald-50 cursor-pointer"}`}
                              aria-label={`Agregar ${receta.nombre} para ${s.label}`}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resumen */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">
          Total: <strong>{adultos}</strong> adultos · <strong>{adolescentes}</strong> adolesc. · <strong>{ninos}</strong> niños · <strong>{personasDietasEspeciales}</strong> especiales
        </span>
        <span className="font-medium text-foreground">
          {totalSeleccionados} plato{totalSeleccionados !== 1 ? "s" : ""} seleccionado{totalSeleccionados !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  )
}

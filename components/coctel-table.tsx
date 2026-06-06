"use client"

import { useState } from "react"
import type { Coctel } from "@/lib/store"

const CATEGORIAS_ORDEN = [
  "Clásicos",
  "Tropicales",
  "Sin Alcohol",
  "Jugos",
  "Garnish",
  "Otros",
]

interface Props {
  cocteles: Coctel[]
  coctelesSeleccionados: string[]
  esBloqueado: boolean
  onToggle: (coctelId: string) => void
}

export function CoctelTable({ cocteles, coctelesSeleccionados, esBloqueado, onToggle }: Props) {
  const [filtroActivo, setFiltroActivo] = useState<string | null>(null)

  // Categorias presentes en los cocteles (para los filtros)
  const categoriasPresentes = CATEGORIAS_ORDEN.filter((cat) =>
    cocteles.some((c) => (c.categoria || "Otros") === cat),
  )

  const filtros: { label: string; value: string | null }[] = [
    { label: "Todos", value: null },
    ...categoriasPresentes.map((c) => ({ label: c, value: c })),
  ]

  const coctelesFiltrados = filtroActivo
    ? cocteles.filter((c) => (c.categoria || "Otros") === filtroActivo)
    : cocteles

  // Agrupar por categoria respetando el orden
  const grupos = CATEGORIAS_ORDEN.map((cat) => ({
    categoria: cat,
    cocteles: coctelesFiltrados.filter((c) => (c.categoria || "Otros") === cat),
  })).filter((g) => g.cocteles.length > 0)

  return (
    <div className="space-y-3">
      {/* Filtros rápidos */}
      {filtros.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {filtros.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setFiltroActivo(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors
                ${filtroActivo === f.value
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-foreground border-border hover:border-violet-600 hover:text-violet-700"
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="py-2.5 px-3 text-left font-medium text-muted-foreground">Coctel</th>
              <th className="py-2.5 px-2 text-center font-medium text-muted-foreground w-24">Incluir</th>
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 && (
              <tr>
                <td colSpan={2} className="py-8 text-center text-muted-foreground text-sm">
                  No hay cocteles disponibles
                </td>
              </tr>
            )}
            {grupos.map((grupo) => (
              <>
                {/* Encabezado de categoría */}
                <tr key={`cat-${grupo.categoria}`}>
                  <td
                    colSpan={2}
                    className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-white"
                    style={{ backgroundColor: "#7c3aed" }}
                  >
                    {grupo.categoria}
                  </td>
                </tr>
                {/* Filas de cocteles */}
                {grupo.cocteles.map((coctel, idx) => {
                  const selected = coctelesSeleccionados.includes(coctel.id)
                  const sinInsumos = !coctel.insumos || coctel.insumos.length === 0
                  return (
                    <tr
                      key={coctel.id}
                      onClick={() => !esBloqueado && onToggle(coctel.id)}
                      className={`border-b border-border/50 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}
                        ${esBloqueado ? "" : "cursor-pointer hover:bg-muted/30"}`}
                    >
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{coctel.nombre}</span>
                          {sinInsumos && (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none border border-amber-400 bg-amber-50 text-amber-600">
                              falta completar
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {selected ? (
                          <span className="mx-auto flex h-8 w-8 items-center justify-center rounded bg-violet-600 text-base font-semibold text-white">
                            ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={esBloqueado}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!esBloqueado) onToggle(coctel.id)
                            }}
                            className={`mx-auto flex h-8 w-8 items-center justify-center rounded border border-dashed border-border transition-colors
                              ${esBloqueado ? "opacity-30 cursor-default" : "hover:border-violet-600 hover:bg-violet-50 cursor-pointer"}`}
                            aria-label={`Agregar ${coctel.nombre}`}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resumen */}
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg bg-muted/40 px-4 py-2.5 text-sm">
        <span className="font-medium text-foreground">
          {coctelesSeleccionados.length} coctel{coctelesSeleccionados.length !== 1 ? "es" : ""} seleccionado{coctelesSeleccionados.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  )
}

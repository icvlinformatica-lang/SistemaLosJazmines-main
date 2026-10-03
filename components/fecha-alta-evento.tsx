"use client"

// "Fecha de alta" de un evento (fecha real de venta, lib/fecha-alta.ts).
// Solo lectura para todos; Administración/Soporte la pueden corregir.

import { useState } from "react"
import { Check, Pencil, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { esFechaAltaValida } from "@/lib/fecha-alta"

const aDDMMAAAA = (iso: string) => iso.split("-").reverse().join("/")

export function FechaAltaEvento({
  fechaAlta,
  puedeEditar,
  onGuardar,
}: {
  fechaAlta?: string
  puedeEditar: boolean
  /** Guarda la nueva fecha ("YYYY-MM-DD"); devuelve true si se guardó. */
  onGuardar: (fecha: string) => Promise<boolean>
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(fechaAlta ?? "")
  const [guardando, setGuardando] = useState(false)

  if (editando) {
    const valida = esFechaAltaValida(valor) && valor !== fechaAlta
    return (
      <span className="mt-2 inline-flex items-center gap-1">
        <span className="text-xs text-muted-foreground">Fecha de alta</span>
        <Input
          type="date"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="h-7 w-[140px] px-2 text-xs"
          aria-label="Fecha de alta del evento"
          autoFocus
        />
        <button
          type="button"
          disabled={!valida || guardando}
          onClick={async () => {
            setGuardando(true)
            const ok = await onGuardar(valor)
            setGuardando(false)
            if (ok) setEditando(false)
          }}
          className="min-h-0 rounded p-1 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
          title="Guardar fecha de alta"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="min-h-0 rounded p-1 text-muted-foreground hover:bg-muted"
          title="Cancelar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    )
  }

  return (
    <Badge variant="outline" className="mt-2 gap-1 border-border bg-muted/50 text-xs font-normal text-muted-foreground">
      Fecha de alta: {fechaAlta ? aDDMMAAAA(fechaAlta) : "sin cargar"}
      {puedeEditar && (
        <button
          type="button"
          onClick={() => {
            setValor(fechaAlta ?? "")
            setEditando(true)
          }}
          className="ml-0.5 min-h-0 rounded p-0.5 hover:bg-muted"
          title="Editar fecha de alta (solo Administración)"
          aria-label="Editar fecha de alta"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </Badge>
  )
}

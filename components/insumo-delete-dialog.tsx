"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, ChefHat, CalendarDays, Trash2 } from "lucide-react"
import type { Insumo, Receta } from "@/lib/store"

interface InsumoDeleteDialogProps {
  insumo: Insumo | null
  recetas: Receta[]
  onConfirm: (insumo: Insumo) => Promise<void> | void
  onClose: () => void
}

export function InsumoDeleteDialog({ insumo, recetas, onConfirm, onClose }: InsumoDeleteDialogProps) {
  const [entiendeRecetas, setEntiendeRecetas] = useState(false)
  const [entiendePermanente, setEntiendePermanente] = useState(false)
  const [confirmacionTexto, setConfirmacionTexto] = useState("")
  const [eliminando, setEliminando] = useState(false)

  // Recetas que usan este insumo (conexión con guías de producción de eventos)
  const recetasAfectadas = useMemo(() => {
    if (!insumo) return []
    return recetas.filter((r) => (r.insumos || []).some((i) => i.insumoId === insumo.id))
  }, [insumo, recetas])

  const reset = () => {
    setEntiendeRecetas(false)
    setEntiendePermanente(false)
    setConfirmacionTexto("")
    setEliminando(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const textoOk = confirmacionTexto.trim().toUpperCase() === "ELIMINAR"
  const puedeEliminar = entiendeRecetas && entiendePermanente && textoOk && !eliminando

  const handleConfirm = async () => {
    if (!insumo || !puedeEliminar) return
    setEliminando(true)
    try {
      await onConfirm(insumo)
      handleClose()
    } catch {
      setEliminando(false)
    }
  }

  return (
    <Dialog open={!!insumo} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Eliminar insumo
          </DialogTitle>
          <DialogDescription>
            Estás por eliminar <strong className="text-foreground">{insumo?.descripcion}</strong> (código{" "}
            <span className="font-mono">{insumo?.codigo}</span>). Leé con atención antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Impacto en recetas */}
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <ChefHat className="h-4 w-4 shrink-0" />
              {recetasAfectadas.length > 0
                ? `Este insumo se usa en ${recetasAfectadas.length} receta${recetasAfectadas.length !== 1 ? "s" : ""}`
                : "Este insumo no se usa en ninguna receta"}
            </p>
            {recetasAfectadas.length > 0 ? (
              <>
                <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                  {recetasAfectadas.map((r) => (
                    <li key={r.id} className="text-xs text-amber-800">
                      • {r.nombre}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-800">
                  Si lo borrás, el ingrediente desaparece de esas recetas: los costos por plato y las cantidades de las
                  guías de producción se recalculan sin él.
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-amber-800">Ninguna receta lo tiene como ingrediente hoy.</p>
            )}
          </div>

          {/* Impacto en eventos */}
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <CalendarDays className="h-4 w-4 shrink-0" />
              Impacto en eventos
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Los eventos que tienen platos con este ingrediente dejarán de contarlo en sus listas de compras y costos
              de cocina. Los eventos ya realizados no cambian su historial de gastos, pero al recalcular un evento
              futuro este insumo ya no va a aparecer.
            </p>
          </div>

          {/* Confirmaciones */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="conf-recetas"
                checked={entiendeRecetas}
                onCheckedChange={(v) => setEntiendeRecetas(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="conf-recetas" className="text-sm font-normal leading-snug cursor-pointer">
                Entiendo que el insumo se quita de las recetas y de los cálculos de los eventos.
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="conf-permanente"
                checked={entiendePermanente}
                onCheckedChange={(v) => setEntiendePermanente(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="conf-permanente" className="text-sm font-normal leading-snug cursor-pointer">
                Entiendo que la eliminación es permanente y también borra su historial de precios.
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conf-texto" className="text-sm">
                Escribí <span className="font-mono font-semibold">ELIMINAR</span> para confirmar:
              </Label>
              <Input
                id="conf-texto"
                value={confirmacionTexto}
                onChange={(e) => setConfirmacionTexto(e.target.value)}
                placeholder="ELIMINAR"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={eliminando}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!puedeEliminar}>
            <Trash2 className="mr-2 h-4 w-4" />
            {eliminando ? "Eliminando..." : "Eliminar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

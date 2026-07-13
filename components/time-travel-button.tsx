"use client"

import { useState } from "react"
import { CalendarClock, RotateCcw } from "lucide-react"
import { useClock } from "@/lib/clock-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TimeTravelButton() {
  const { ahora, fechaSimulada, viajeActivo, setFechaSimulada, volverAHoy } = useClock()
  const [open, setOpen] = useState(false)
  const [valor, setValor] = useState<string>(fechaSimulada ?? hoyISO())

  const fechaCorta = ahora.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

  const abrir = () => {
    setValor(fechaSimulada ?? hoyISO())
    setOpen(true)
  }

  const viajar = () => {
    if (!valor) return
    setFechaSimulada(valor)
    setOpen(false)
  }

  const resetear = () => {
    volverAHoy()
    setValor(hoyISO())
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={
          viajeActivo
            ? "flex w-full items-center gap-2 rounded-lg bg-[#d4a533]/90 px-3 py-2 text-left text-[#1a1a1a] transition-colors hover:bg-[#d4a533]"
            : "flex w-full items-center gap-2 rounded-lg bg-[#f5f0e8]/8 px-3 py-2 text-left text-[#f5f0e8]/80 transition-colors hover:bg-[#f5f0e8]/12 hover:text-[#f5f0e8]"
        }
        title="Cambiar la fecha del sistema"
      >
        <CalendarClock className="h-4 w-4 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-xs font-semibold">{fechaCorta}</span>
          <span className={viajeActivo ? "text-[10px] font-medium" : "text-[10px] opacity-60"}>
            {viajeActivo ? "Viajando · solo lectura" : "Fecha del sistema"}
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar fecha del sistema</DialogTitle>
            <DialogDescription>
              Elegí una fecha para ver todo el sistema (eventos, ingresos, gastos y vencimientos)
              calculado a ese día. Mientras viajás, todo queda en solo lectura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="fecha-viaje">Fecha a visualizar</Label>
            <Input
              id="fecha-viaje"
              type="date"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={resetear}
              disabled={!viajeActivo}
              className="gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              Volver a hoy
            </Button>
            <Button onClick={viajar} disabled={!valor} className="gap-1.5">
              <CalendarClock className="h-4 w-4" />
              Ver en esta fecha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

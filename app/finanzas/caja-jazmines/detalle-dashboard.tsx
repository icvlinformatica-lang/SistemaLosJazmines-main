"use client"

/**
 * Ventana de detalle de las tarjetas del dashboard de Caja Jazmines: al tocar
 * una tarjeta (Saldo actual, Gastos a 30 días, etc.) se ve de qué ítems se
 * compone su monto. Solo muestra datos: no cambia nada.
 *
 * Los ítems los arma la página con los MISMOS cálculos que la tarjeta, así
 * la suma de la ventana siempre da el número de la tarjeta.
 */

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SalonDot } from "@/components/salon-badge"
import { formatCurrency } from "@/lib/utils-financieros"
import { ChevronDown, ChevronUp, ArrowRight } from "lucide-react"

export interface FilaDetalle {
  id: string
  titulo: string
  /** Línea chica de abajo: fecha, cuota, tipo… */
  detalle?: string
  salon?: string | null
  monto: number
  /** Marca en rojo (ej. vencido). */
  alerta?: boolean
  /** Si está, la fila es un botón que abre otro detalle (ej. desde Balance). */
  onClick?: () => void
}

export interface SeccionDetalle {
  titulo: string
  /** +1 suma, −1 resta: define el signo y el color de los montos. */
  signo: 1 | -1
  filas: FilaDetalle[]
  /** Texto cuando no hay filas. */
  vacio?: string
  /** Aclaración debajo del título de la sección. */
  nota?: string
}

const FILAS_VISIBLES = 8

function Seccion({ seccion }: { seccion: SeccionDetalle }) {
  const [verTodas, setVerTodas] = useState(false)
  const subtotal = seccion.filas.reduce((s, f) => s + f.monto, 0)
  const visibles = verTodas ? seccion.filas : seccion.filas.slice(0, FILAS_VISIBLES)
  const color = seccion.signo > 0 ? "text-emerald-700" : "text-red-600"
  const signo = seccion.signo > 0 ? "+" : "−"
  return (
    <section className="rounded-lg border border-border">
      <div className="flex items-baseline justify-between gap-3 border-b border-border bg-muted/40 px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            {seccion.titulo}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">({seccion.filas.length})</span>
          </h3>
          {seccion.nota && <p className="text-xs text-muted-foreground">{seccion.nota}</p>}
        </div>
        <span className={`shrink-0 text-sm font-bold tabular-nums ${color}`}>
          {`${signo}${formatCurrency(subtotal)}`}
        </span>
      </div>
      {seccion.filas.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{seccion.vacio ?? "Nada por acá."}</p>
      ) : (
        <ul className="divide-y divide-border">
          {visibles.map((f) => {
            const contenido = (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground" title={f.titulo}>
                    {f.titulo}
                  </p>
                  {(f.detalle || f.salon) && (
                    <p className={`flex items-center gap-1.5 text-xs ${f.alerta ? "text-red-600" : "text-muted-foreground"}`}>
                      {f.salon && <SalonDot salon={f.salon} size={7} />}
                      <span className="truncate">{f.detalle}</span>
                    </p>
                  )}
                </div>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${color}`}>
                  {`${signo}${formatCurrency(f.monto)}`}
                </span>
                {f.onClick && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
              </>
            )
            return (
              <li key={f.id}>
                {f.onClick ? (
                  <button
                    type="button"
                    onClick={f.onClick}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                  >
                    {contenido}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2">{contenido}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {seccion.filas.length > FILAS_VISIBLES && (
        <div className="border-t border-border px-3 py-1.5 text-center">
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setVerTodas((v) => !v)}>
            {verTodas ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Ver menos
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                {`Ver los ${seccion.filas.length}`}
              </>
            )}
          </Button>
        </div>
      )}
    </section>
  )
}

export function DetalleDashboardDialog({
  abierto,
  onOpenChange,
  titulo,
  descripcion,
  secciones,
  totalEtiqueta,
  total,
  colorTotal,
}: {
  abierto: boolean
  onOpenChange: (abierto: boolean) => void
  titulo: string
  descripcion: string
  secciones: SeccionDetalle[]
  totalEtiqueta: string
  total: number
  /** Color del número final (el mismo de la tarjeta). */
  colorTotal?: string
}) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1">
          {secciones.map((s) => (
            <Seccion key={s.titulo} seccion={s} />
          ))}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-lg border-2 border-border bg-muted/40 px-3 py-2.5">
          <span className="text-sm font-semibold text-foreground">{totalEtiqueta}</span>
          <span className="text-lg font-bold tabular-nums" style={colorTotal ? { color: colorTotal } : undefined}>
            {formatCurrency(total)}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

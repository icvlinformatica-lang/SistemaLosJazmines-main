"use client"

// En la ventana de eliminar un evento con plata cobrada: qué pasa con esa
// plata (pedido del dueño el 30/10/2026, lib/plata-al-eliminar.ts). Queda en
// las cajas, se devuelve toda o se devuelve una parte.
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { formatCurrency } from "@/lib/store"
import { validarDevolucion, type OpcionPlataAlEliminar } from "@/lib/plata-al-eliminar"

interface Props {
  cobrado: number
  opcion: OpcionPlataAlEliminar
  parte: number
  onOpcion: (o: OpcionPlataAlEliminar) => void
  onParte: (n: number) => void
  disabled?: boolean
}

export function ElegirPlataAlEliminar({ cobrado, opcion, parte, onOpcion, onParte, disabled }: Props) {
  const errorParte = opcion === "parte" ? (parte <= 0 ? "Poné cuánto se devuelve." : validarDevolucion(parte, cobrado)) : null
  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm text-amber-900">
        Este evento tiene <span className="font-semibold">{formatCurrency(cobrado)}</span> cobrados. ¿Qué pasa con esa plata?
      </p>
      <RadioGroup value={opcion} onValueChange={(v) => onOpcion(v as OpcionPlataAlEliminar)} disabled={disabled} className="gap-2">
        <div className="flex items-start gap-2">
          <RadioGroupItem value="queda" id="plata-queda" className="mt-0.5" />
          <Label htmlFor="plata-queda" className="font-normal leading-snug">
            Queda en las cajas (no se devuelve)
          </Label>
        </div>
        <div className="flex items-start gap-2">
          <RadioGroupItem value="todo" id="plata-todo" className="mt-0.5" />
          <Label htmlFor="plata-todo" className="font-normal leading-snug">
            Se le devuelve todo al cliente ({formatCurrency(cobrado)})
          </Label>
        </div>
        <div className="flex items-start gap-2">
          <RadioGroupItem value="parte" id="plata-parte" className="mt-0.5" />
          <Label htmlFor="plata-parte" className="font-normal leading-snug">
            Se le devuelve una parte
          </Label>
        </div>
      </RadioGroup>
      {opcion === "parte" && (
        <div className="space-y-1 pl-6">
          <MoneyInput value={parte} onValueChange={onParte} disabled={disabled} placeholder="Monto a devolver" />
          {errorParte ? (
            <p className="text-xs text-destructive">{errorParte}</p>
          ) : (
            <p className="text-xs text-amber-900">Quedan en las cajas {formatCurrency(Math.max(0, cobrado - parte))}.</p>
          )}
        </div>
      )}
      <p className="text-xs text-amber-900/80">
        Lo cobrado sigue figurando en las cajas como &quot;(evento eliminado)&quot;. Lo que se devuelve sale de cada caja en la misma
        proporción en que entró, y queda anotado como &quot;Devolución por evento eliminado&quot;.
      </p>
    </div>
  )
}

/** true si lo elegido se puede mandar (la parte, entre 0 y lo cobrado). */
export function plataAlEliminarValida(opcion: OpcionPlataAlEliminar, parte: number, cobrado: number): boolean {
  if (opcion !== "parte") return true
  return parte > 0 && validarDevolucion(parte, cobrado) === null
}

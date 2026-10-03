"use client"

// Candado de señas (lib/candado-senas.ts): aviso "Se habilita el ..." y el
// diálogo de pago extraordinario (PIN de Administración + motivo). El PIN se
// valida con /api/auth/verificar-pin; si es correcto, quien lo abrió sigue
// con su flujo de pago normal (mismos montos, mismo reparto).

import { useEffect, useState } from "react"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatoHabilitacion } from "@/lib/candado-senas"

export function AvisoSeñaBloqueada({ fechaHabilitacion }: { fechaHabilitacion: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
      <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
      Se habilita el {formatoHabilitacion(fechaHabilitacion)}
    </span>
  )
}

export interface SeñaExtraordinaria {
  eventoNombre: string
  servicioNombre: string
  monto: number
  fechaHabilitacion: string
}

/** Deja asentado en Configuración → Actividad un pago de seña antes de tiempo.
 *  El nombre de quien lo hizo lo agrega la API desde la cookie lj_usuario. */
export async function registrarPagoSeñaExtraordinario(seña: SeñaExtraordinaria, motivo: string, montoTexto: string) {
  try {
    await fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "pago_seña_extraordinario",
        accion: "modificado",
        nombre: seña.eventoNombre,
        detalle: `Seña ${seña.servicioNombre} · ${montoTexto} · Motivo: ${motivo} · Se habilitaba el ${formatoHabilitacion(seña.fechaHabilitacion)}`,
      }),
    })
  } catch {
    // El pago ya quedó hecho; el registro es informativo.
  }
}

export function PinSeñaExtraordinariaDialog({
  seña,
  montoTexto,
  onCancelar,
  onAutorizado,
}: {
  seña: SeñaExtraordinaria | null
  montoTexto: string
  onCancelar: () => void
  /** PIN correcto: sigue el flujo de pago normal con este motivo. */
  onAutorizado: (motivo: string) => void
}) {
  const [pin, setPin] = useState("")
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState("")
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    if (seña) {
      setPin("")
      setMotivo("")
      setError("")
    }
  }, [seña])

  const verificar = async () => {
    if (!pin.trim() || !motivo.trim() || verificando) return
    setVerificando(true)
    setError("")
    try {
      const res = await fetch("/api/auth/verificar-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json().catch(() => ({ ok: false }))
      if (data.ok) {
        onAutorizado(motivo.trim())
      } else {
        setError(res.status === 429 && data.error ? data.error : "PIN incorrecto")
      }
    } catch {
      setError("No se pudo verificar el PIN. Intentá de nuevo.")
    } finally {
      setVerificando(false)
    }
  }

  return (
    <Dialog open={!!seña} onOpenChange={(open) => !open && onCancelar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-700" /> Pago extraordinario de seña
          </DialogTitle>
          <DialogDescription>
            {seña && (
              <>
                La seña de <strong>{seña.servicioNombre}</strong> ({seña.eventoNombre}, {montoTexto}) recién se
                habilita el <strong>{formatoHabilitacion(seña.fechaHabilitacion)}</strong>. Para pagarla antes
                hace falta el PIN de Administración y un motivo.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            verificar()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="motivo-sena-extra">Motivo (obligatorio)</Label>
            <Textarea
              id="motivo-sena-extra"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="¿Por qué se paga antes?"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin-sena-extra">PIN de Administración</Label>
            <Input
              id="pin-sena-extra"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value)
                setError("")
              }}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!pin.trim() || !motivo.trim() || verificando}>
              {verificando ? "Verificando..." : "Continuar con el pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

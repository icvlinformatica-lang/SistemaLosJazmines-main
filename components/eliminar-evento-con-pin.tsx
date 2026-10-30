"use client"

// Botón "Eliminar evento" del Perfil del evento (Cobrar cuota), con el PIN de
// Administración. Pedido del dueño el 30/10/2026. Hace lo mismo que
// "Eliminar" de la Lista: el evento va a Eventos → Finalizados, pestaña
// Eliminados (se puede restaurar), y deja de figurar en Cobrar cuota. El PIN
// se prueba primero con /api/auth/verificar-pin (para decir "PIN incorrecto"
// sin borrar nada) y después viaja con el borrado, que lo vuelve a verificar
// en el servidor.
import { useState } from "react"
import { Trash2 } from "lucide-react"
import { useStore } from "@/lib/store-context"
import { motivoNoEliminarDesdePerfil } from "@/lib/eliminar-evento-pin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Props {
  evento: { id: string; nombre?: string; nombrePareja?: string; fecha?: string; stockDescontado?: boolean }
  onEliminado: () => void
}

export function EliminarEventoConPin({ evento, onEliminado }: Props) {
  const { deleteEvento } = useStore()
  const [abierto, setAbierto] = useState(false)
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [eliminando, setEliminando] = useState(false)

  const motivoNo = motivoNoEliminarDesdePerfil(evento)
  const nombre = evento.nombrePareja || evento.nombre || "Sin nombre"

  const cerrar = () => {
    if (eliminando) return
    setAbierto(false)
    setPin("")
    setError("")
  }

  const eliminar = async () => {
    if (!pin.trim() || eliminando || motivoNo) return
    setEliminando(true)
    setError("")
    try {
      const res = await fetch("/api/auth/verificar-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json().catch(() => ({ ok: false }))
      if (!data.ok) {
        setError(data.error || "PIN incorrecto")
        return
      }
      const ok = await deleteEvento(evento.id, undefined, { pinAdministracion: pin })
      if (!ok) {
        setError("No se pudo eliminar. Probá de nuevo o hacelo desde la Lista de eventos.")
        return
      }
      setAbierto(false)
      setPin("")
      onEliminado()
    } catch {
      setError("No se pudo verificar el PIN. Intentá de nuevo.")
    } finally {
      setEliminando(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="bg-transparent text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setAbierto(true)}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Eliminar evento
      </Button>

      <Dialog open={abierto} onOpenChange={(open) => { if (!open) cerrar() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar evento</DialogTitle>
            <DialogDescription>
              {nombre}
              {evento.fecha ? ` · ${evento.fecha.split("-").reverse().join("/")}` : ""}. Pasa a Eventos → Finalizados,
              pestaña Eliminados: de ahí lo podés restaurar.
            </DialogDescription>
          </DialogHeader>
          {motivoNo ? (
            <p className="text-sm text-amber-700">{motivoNo}</p>
          ) : (
            <div className="space-y-2">
              <Input
                type="password"
                inputMode="numeric"
                placeholder="PIN de Administración"
                value={pin}
                autoFocus
                onChange={(e) => {
                  setPin(e.target.value)
                  setError("")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) eliminar()
                }}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={cerrar} disabled={eliminando}>
              Cancelar
            </Button>
            {!motivoNo && (
              <Button
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={eliminar}
                disabled={!pin.trim() || eliminando}
              >
                {eliminando ? "Eliminando..." : "Sí, eliminar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

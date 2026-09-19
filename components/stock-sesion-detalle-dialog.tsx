"use client"

// Detalle de una sesión de carga de Stock por salón, abierto desde
// Configuración → Actividad (el id del renglón de actividad es el id de la
// sesión). Muestra insumo, unidad y cantidad anterior → nueva.

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowRight, Loader2 } from "lucide-react"

interface Detalle {
  sesion: {
    salonNombre: string
    sector: string
    cargadoPor: string
    cerradaEn: string | null
    cantidadItems: number
    evento: { nombre: string; fecha: string | null } | null
  }
  items: Array<{
    insumoId: string
    descripcion: string
    unidad: string | null
    cantidadAnterior: number | null
    cantidadNueva: number
  }>
}

function fmtCantidad(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n)
}

export function StockSesionDetalleDialog({ sesionId, onClose }: { sesionId: string | null; onClose: () => void }) {
  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!sesionId) return
    setDetalle(null)
    setError("")
    fetch(`/api/stock-salones/sesiones/${encodeURIComponent(sesionId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) setDetalle({ sesion: data.sesion, items: data.items })
        else setError(data?.error || "No se pudo cargar el detalle")
      })
      .catch(() => setError("No se pudo cargar el detalle"))
  }, [sesionId])

  const s = detalle?.sesion
  return (
    <Dialog open={!!sesionId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{s ? `${s.salonNombre} — ${s.sector}` : "Carga de stock"}</DialogTitle>
          <DialogDescription>
            {s
              ? `${s.cargadoPor} · ${
                  s.cerradaEn
                    ? new Date(s.cerradaEn).toLocaleString("es-AR", {
                        timeZone: "America/Argentina/Buenos_Aires",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""
                } · ${s.cantidadItems} ${s.cantidadItems === 1 ? "insumo" : "insumos"}${
                  s.evento ? ` · después de ${s.evento.nombre}` : ""
                }`
              : "Conteo físico de insumos en el salón"}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !detalle ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="divide-y rounded-lg border">
              {detalle.items.map((it) => (
                <div key={it.insumoId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{it.descripcion}</span>
                  <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-muted-foreground">
                    {it.cantidadAnterior === null ? "—" : fmtCantidad(it.cantidadAnterior)}
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span className="font-semibold text-foreground">{fmtCantidad(it.cantidadNueva)}</span>
                    {it.unidad ? <span className="w-8 text-xs">{it.unidad}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}

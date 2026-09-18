"use client"

// Papelera de "Mis cotizaciones generadas" y "Paquetes reutilizables"
// borrados desde /vendedor/paquetes. Dos vistas comparten este mismo
// componente:
// - modo="personal" (/vendedor/papelera): cada vendedor ve solo lo que
//   borró él mismo, vía /api/vendedor/papelera (filtrado server-side por la
//   cookie lj_usuario).
// - modo="global" (/eventos/papelera-vendedores, solo Administración): ve
//   lo borrado por todos los vendedores, vía /api/eventos/papelera-vendedores,
//   con el nombre de quién lo borró en cada tarjeta.
// Restaurar y borrar definitivo pegan a los mismos endpoints en ambos modos.

import { useEffect, useState } from "react"
import { CalendarClock, Package, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { salonColor, salonLabel } from "@/lib/store"
import { ESTADO_COTIZACION_CLASE, ESTADO_COTIZACION_LABEL, type EstadoCotizacion } from "@/lib/estado-cotizacion"

interface CotizacionEliminada {
  id: string
  clienteNombre: string
  fechaEvento: string | null
  salon: string | null
  tipoEvento: string | null
  nombreFestejados: string | null
  precioVentaSugerido: number
  estado: EstadoCotizacion
  eliminadoAt: string
  eliminadoPor?: string | null
  vendedor?: string
}

interface PaqueteEliminado {
  id: string
  salon: string
  nombre: string
  descripcion: string
  precioVenta?: number
  precioOficial?: number
  servicios: Array<{ servicioId: string; nombre: string }>
  eliminadoAt: string
  eliminadoPor?: string | null
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

function fmtFechaHora(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  } catch {
    return iso
  }
}

export function PapeleraVendedor({ modo }: { modo: "personal" | "global" }) {
  const { toast } = useToast()
  const endpoint = modo === "personal" ? "/api/vendedor/papelera" : "/api/eventos/papelera-vendedores"

  const [cargando, setCargando] = useState(true)
  const [cotizaciones, setCotizaciones] = useState<CotizacionEliminada[]>([])
  const [paquetes, setPaquetes] = useState<PaqueteEliminado[]>([])
  const [accionCotizacionId, setAccionCotizacionId] = useState<string | null>(null)
  const [accionPaqueteId, setAccionPaqueteId] = useState<string | null>(null)
  const [borrarCotizacion, setBorrarCotizacion] = useState<CotizacionEliminada | null>(null)
  const [borrarPaquete, setBorrarPaquete] = useState<PaqueteEliminado | null>(null)

  const cargarDatos = () => {
    setCargando(true)
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ok) {
          setCotizaciones(data.cotizaciones || [])
          setPaquetes(data.paquetes || [])
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(cargarDatos, [])

  const restaurarCotizacion = async (id: string) => {
    setAccionCotizacionId(id)
    try {
      const res = await fetch(`/api/vendedor/papelera/cotizaciones/${id}/restaurar`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo restaurar", variant: "destructive" })
        return
      }
      toast({ title: "Cotización restaurada" })
      cargarDatos()
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setAccionCotizacionId(null)
    }
  }

  const confirmarBorrarCotizacion = async () => {
    if (!borrarCotizacion) return
    setAccionCotizacionId(borrarCotizacion.id)
    try {
      const res = await fetch(`/api/vendedor/papelera/cotizaciones/${borrarCotizacion.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo borrar", variant: "destructive" })
        return
      }
      toast({ title: "Cotización eliminada para siempre" })
      setBorrarCotizacion(null)
      cargarDatos()
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setAccionCotizacionId(null)
    }
  }

  const restaurarPaquete = async (id: string) => {
    setAccionPaqueteId(id)
    try {
      const res = await fetch(`/api/vendedor/papelera/paquetes/${id}/restaurar`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo restaurar", variant: "destructive" })
        return
      }
      toast({ title: "Paquete restaurado" })
      cargarDatos()
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setAccionPaqueteId(null)
    }
  }

  const confirmarBorrarPaquete = async () => {
    if (!borrarPaquete) return
    setAccionPaqueteId(borrarPaquete.id)
    try {
      const res = await fetch(`/api/vendedor/papelera/paquetes/${borrarPaquete.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo borrar", variant: "destructive" })
        return
      }
      toast({ title: "Paquete eliminado para siempre" })
      setBorrarPaquete(null)
      cargarDatos()
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setAccionPaqueteId(null)
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Cotizaciones borradas</h2>
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : cotizaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed rounded-lg">
            <Trash2 className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No hay cotizaciones borradas.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {cotizaciones.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border-l-4 border border-border bg-card overflow-hidden"
                style={{ borderLeftColor: c.salon ? salonColor(c.salon) : "#6b7280" }}
              >
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-card-foreground">{c.clienteNombre}</p>
                    <Badge variant="outline" className={`text-[11px] shrink-0 ${ESTADO_COTIZACION_CLASE[c.estado]}`}>
                      {ESTADO_COTIZACION_LABEL[c.estado]}
                    </Badge>
                  </div>
                  {c.nombreFestejados && <p className="text-sm text-muted-foreground mt-0.5">{c.nombreFestejados}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                    {c.salon && <span>{salonLabel(c.salon)}</span>}
                    {c.tipoEvento && <span>{c.tipoEvento}</span>}
                    {c.fechaEvento && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {c.fechaEvento}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Borrada el {fmtFechaHora(c.eliminadoAt)}
                    {modo === "global" && (c.eliminadoPor || c.vendedor) ? ` por ${c.eliminadoPor || c.vendedor}` : ""}
                  </p>
                </div>
                <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-lg font-bold text-emerald-700">{fmt(c.precioVentaSugerido)}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setBorrarCotizacion(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Borrar para siempre
                    </Button>
                    <Button size="sm" onClick={() => restaurarCotizacion(c.id)} disabled={accionCotizacionId === c.id}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      {accionCotizacionId === c.id ? "Restaurando..." : "Restaurar"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Paquetes borrados</h2>
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : paquetes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed rounded-lg">
            <Package className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No hay paquetes borrados.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {paquetes.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border-l-4 border border-border bg-card overflow-hidden"
                style={{ borderLeftColor: salonColor(p.salon) }}
              >
                <div className="px-4 py-3">
                  <p className="font-semibold text-card-foreground">{p.nombre}</p>
                  {p.descripcion && <p className="text-sm text-muted-foreground mt-0.5">{p.descripcion}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                    <span>{salonLabel(p.salon)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Borrado el {fmtFechaHora(p.eliminadoAt)}
                    {modo === "global" && p.eliminadoPor ? ` por ${p.eliminadoPor}` : ""}
                  </p>
                </div>
                <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-lg font-bold text-emerald-700">{fmt(p.precioVenta ?? p.precioOficial ?? 0)}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setBorrarPaquete(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Borrar para siempre
                    </Button>
                    <Button size="sm" onClick={() => restaurarPaquete(p.id)} disabled={accionPaqueteId === p.id}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      {accionPaqueteId === p.id ? "Restaurando..." : "Restaurar"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!borrarCotizacion} onOpenChange={(open) => !open && setBorrarCotizacion(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Borrar para siempre</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que querés borrar para siempre la cotización de "{borrarCotizacion?.clienteNombre}"? No se va a poder recuperar.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBorrarCotizacion(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarBorrarCotizacion} disabled={accionCotizacionId === borrarCotizacion?.id}>
              {accionCotizacionId === borrarCotizacion?.id ? "Borrando..." : "Borrar para siempre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!borrarPaquete} onOpenChange={(open) => !open && setBorrarPaquete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Borrar para siempre</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que querés borrar para siempre el paquete "{borrarPaquete?.nombre}"? No se va a poder recuperar.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBorrarPaquete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarBorrarPaquete} disabled={accionPaqueteId === borrarPaquete?.id}>
              {accionPaqueteId === borrarPaquete?.id ? "Borrando..." : "Borrar para siempre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

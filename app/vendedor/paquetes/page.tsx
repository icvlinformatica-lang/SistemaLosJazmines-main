"use client"

// Pantalla de paquetes para el perfil Vendedor. Dos secciones:
//
// "Mis cotizaciones generadas": las cotizaciones completas (cliente, fecha,
// menú, servicios) que el vendedor generó desde /vendedor/cotizar con el
// botón "Generar cotización" — nunca se envían a revisión desde Cotizar, eso
// pasa acá, con el botón "Enviar a revisión" en la tarjeta. Se pueden borrar
// si se cargó mal alguna.
//
// "Paquetes reutilizables por salón": leída de "paquetes_salones" — la misma
// tabla que usa Administración en /admin/servicios, siempre a través de
// /api/vendedor/paquetes, que nunca expone precioInterno/costoTotal/
// ganancia/margen por servicio (eso sigue siendo exclusivo de
// Administración). La creación pasa por /vendedor/cotizar (botón dorado
// "Generar paquete", junto a los servicios ya armados ahí) — acá solo se
// usan, se prueban en el cotizador o se borran.

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarClock, Package, Phone, Send, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { SALONES, salonColor, salonLabel } from "@/lib/store"
import { ESTADO_COTIZACION_CLASE, ESTADO_COTIZACION_LABEL, type EstadoCotizacion } from "@/lib/estado-cotizacion"

interface PaqueteVendedor {
  id: string
  salon: string
  nombre: string
  descripcion: string
  capacidadMinima: number
  capacidadMaxima: number
  precioVenta: number
  servicios: Array<{ servicioId: string; nombre: string; categoria: string; unidad: string; cantidad: number; precioVenta: number }>
}

interface CotizacionGenerada {
  id: string
  clienteNombre: string
  clienteTelefono: string | null
  fechaEvento: string | null
  salon: string | null
  tipoEvento: string | null
  nombreFestejados: string | null
  totalPersonas: number
  precioVentaSugerido: number
  estado: EstadoCotizacion
  comentarioAdmin: string | null
  updatedAt: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

export default function PaquetesPage() {
  const { toast } = useToast()

  const [cargando, setCargando] = useState(true)
  const [paquetes, setPaquetes] = useState<PaqueteVendedor[]>([])
  const [cotizaciones, setCotizaciones] = useState<CotizacionGenerada[]>([])
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [paqueteABorrar, setPaqueteABorrar] = useState<PaqueteVendedor | null>(null)
  const [borrandoPaqueteId, setBorrandoPaqueteId] = useState<string | null>(null)
  const [cotizacionABorrar, setCotizacionABorrar] = useState<CotizacionGenerada | null>(null)
  const [borrandoCotizacionId, setBorrandoCotizacionId] = useState<string | null>(null)

  const cargarDatos = () => {
    setCargando(true)
    Promise.all([
      fetch("/api/vendedor/paquetes").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/vendedor/cotizaciones").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([paquetesData, cotizacionesData]) => {
        if (paquetesData?.ok) setPaquetes(paquetesData.paquetes || [])
        if (cotizacionesData?.ok) setCotizaciones(cotizacionesData.cotizaciones || [])
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(cargarDatos, [])

  const enviarARevision = async (id: string) => {
    setEnviandoId(id)
    try {
      const res = await fetch(`/api/vendedor/cotizaciones/${id}/enviar`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo enviar", variant: "destructive" })
        return
      }
      toast({ title: "Cotización enviada a revisión" })
      cargarDatos()
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setEnviandoId(null)
    }
  }

  const borrarPaquete = async () => {
    if (!paqueteABorrar) return
    setBorrandoPaqueteId(paqueteABorrar.id)
    try {
      const res = await fetch(`/api/vendedor/paquetes/${paqueteABorrar.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo borrar el paquete", variant: "destructive" })
        return
      }
      toast({ title: "Paquete borrado" })
      setPaqueteABorrar(null)
      cargarDatos()
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setBorrandoPaqueteId(null)
    }
  }

  const borrarCotizacion = async () => {
    if (!cotizacionABorrar) return
    setBorrandoCotizacionId(cotizacionABorrar.id)
    try {
      const res = await fetch(`/api/vendedor/cotizaciones/${cotizacionABorrar.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo borrar la cotización", variant: "destructive" })
        return
      }
      toast({ title: "Cotización borrada" })
      setCotizacionABorrar(null)
      cargarDatos()
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setBorrandoCotizacionId(null)
    }
  }

  const paquetesPorSalon = useMemo(() => {
    const grupos = new Map<string, PaqueteVendedor[]>()
    for (const s of SALONES) grupos.set(s, [])
    for (const p of paquetes) {
      if (!grupos.has(p.salon)) grupos.set(p.salon, [])
      grupos.get(p.salon)!.push(p)
    }
    return Array.from(grupos.entries()).filter(([, items]) => items.length > 0)
  }, [paquetes])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 sm:px-6 sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex items-center gap-3">
          <Link href="/vendedor" className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">Paquetes</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-8">
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Mis cotizaciones generadas</h2>
          {cargando ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : cotizaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed rounded-lg">
              <Package className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Todavía no generaste ninguna. Armala en{" "}
                <Link href="/vendedor/cotizar" className="underline">
                  Cotizar
                </Link>{" "}
                y tocá "Generar cotización".
              </p>
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
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className={`text-[11px] ${ESTADO_COTIZACION_CLASE[c.estado]}`}>
                          {ESTADO_COTIZACION_LABEL[c.estado]}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => setCotizacionABorrar(c)}
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label={`Borrar cotización de ${c.clienteNombre}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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
                      {c.totalPersonas > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {c.totalPersonas}
                        </span>
                      )}
                      {c.clienteTelefono && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {c.clienteTelefono}
                        </span>
                      )}
                    </div>
                    {c.estado === "rechazada" && c.comentarioAdmin && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5 mt-2">
                        {c.comentarioAdmin}
                      </p>
                    )}
                  </div>
                  <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-lg font-bold text-emerald-700">{fmt(c.precioVentaSugerido)}</span>
                    <div className="flex items-center gap-2">
                      <Link href={`/vendedor/cotizar?id=${c.id}`}>
                        <Button size="sm" variant="outline">
                          {c.estado === "borrador" || c.estado === "rechazada" ? "Editar" : "Ver"}
                        </Button>
                      </Link>
                      {(c.estado === "borrador" || c.estado === "rechazada") && (
                        <Button size="sm" onClick={() => enviarARevision(c.id)} disabled={enviandoId === c.id}>
                          <Send className="h-3.5 w-3.5 mr-1.5" />
                          {enviandoId === c.id ? "Enviando..." : "Enviar a revisión"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Paquetes reutilizables por salón</h2>
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : paquetesPorSalon.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg">
            <Package className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Todavía no hay paquetes creados. Armá los servicios en{" "}
              <Link href="/vendedor/cotizar" className="underline">
                Cotizar
              </Link>{" "}
              y tocá el botón dorado "Generar paquete".
            </p>
          </div>
        ) : (
          paquetesPorSalon.map(([salonNombre, items]) => (
            <div key={salonNombre} className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: salonColor(salonNombre) }}>
                {salonLabel(salonNombre)}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border-l-4 border border-border bg-card overflow-hidden"
                    style={{ borderLeftColor: salonColor(p.salon) }}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-card-foreground">{p.nombre}</p>
                        <button
                          type="button"
                          onClick={() => setPaqueteABorrar(p)}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label={`Borrar paquete ${p.nombre}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {p.descripcion && <p className="text-sm text-muted-foreground mt-0.5">{p.descripcion}</p>}
                      {(p.capacidadMinima > 0 || p.capacidadMaxima > 0) && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {p.capacidadMinima} - {p.capacidadMaxima} personas
                        </div>
                      )}
                    </div>
                    <div className="border-t border-border px-4 py-3 space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Incluye</p>
                      {p.servicios.map((s) => (
                        <div key={s.servicioId} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {s.nombre}
                            {s.cantidad > 1 ? ` ×${s.cantidad}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-2">
                      <span className="text-lg font-bold text-emerald-700">{fmt(p.precioVenta)}</span>
                      <Link href={`/vendedor/cotizar?paqueteId=${p.id}`}>
                        <Button size="sm">
                          <Send className="h-3.5 w-3.5 mr-1.5" />
                          Usar en el cotizador
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        </div>
      </main>

      <Dialog open={!!paqueteABorrar} onOpenChange={(open) => !open && setPaqueteABorrar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Borrar paquete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que querés borrar "{paqueteABorrar?.nombre}"? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaqueteABorrar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={borrarPaquete} disabled={borrandoPaqueteId === paqueteABorrar?.id}>
              {borrandoPaqueteId === paqueteABorrar?.id ? "Borrando..." : "Borrar paquete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cotizacionABorrar} onOpenChange={(open) => !open && setCotizacionABorrar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Borrar cotización</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que querés borrar la cotización de "{cotizacionABorrar?.clienteNombre}"? Esta acción no se puede deshacer.
            {cotizacionABorrar?.estado === "convertida" && " El evento ya creado a partir de esta cotización no se ve afectado."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCotizacionABorrar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={borrarCotizacion} disabled={borrandoCotizacionId === cotizacionABorrar?.id}>
              {borrandoCotizacionId === cotizacionABorrar?.id ? "Borrando..." : "Borrar cotización"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

// Bandeja de aprobación de cotizaciones (Etapa 5) — visible solo para
// administracion/soporte (ver components/sidebar.tsx). A diferencia de las
// pantallas del vendedor, ACÁ SÍ se ve el desglose completo de costos
// internos: es la única pantalla de todo el flujo de cotizaciones que lo
// muestra.
//
// "Aprobar" arma el evento real llamando a /api/administracion/cotizaciones/
// [id]/aprobar, que a su vez reusa el POST /api/eventos ya existente (mismo
// camino que usa app/evento/page.tsx) — no se reimplementa esa lógica acá.
// "Rechazar / pedir ajuste" vuelve la cotización a "rechazada" con un
// comentario para que el vendedor la corrija desde /vendedor/paquetes.

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Calendar, CheckCircle2, ChevronDown, Phone, Users, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import { useStore } from "@/lib/store-context"
import { salonColor, salonLabel } from "@/lib/store"

interface CotizacionPendiente {
  id: string
  vendedor: string
  clienteNombre: string
  clienteTelefono: string | null
  fechaEvento: string | null
  horario: string | null
  horarioFin: string | null
  salon: string | null
  tipoEvento: string | null
  nombreFestejados: string | null
  totalPersonas: number
  invitados: { adultos: number; adolescentes: number; ninos: number; personasDietasEspeciales: number }
  recetasElegidas: { adultos: string[]; adolescentes: string[]; ninos: string[]; dietasEspeciales: string[] }
  servicios: Array<{ servicioId: string; nombre: string; unidad: string; cantidad: number; precioVenta: number; precioTotal: number }>
  precioVentaSugerido: number
  precioBaseSalon: number
  costosServicios: Array<{ servicioId: string; nombre: string; cantidad: number; costoTotal: number }>
  totalCostoServicios: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

export default function CotizacionesPendientesPage() {
  const { toast } = useToast()
  const { recetas, vendedores } = useStore()

  const [cargando, setCargando] = useState(true)
  const [cotizaciones, setCotizaciones] = useState<CotizacionPendiente[]>([])
  const [abiertaId, setAbiertaId] = useState<string | null>(null)

  // Aprobar
  const [vendedorElegido, setVendedorElegido] = useState<Record<string, string>>({})
  const [aprobandoId, setAprobandoId] = useState<string | null>(null)

  // Rechazar
  const [comentarioPorId, setComentarioPorId] = useState<Record<string, string>>({})
  const [rechazandoId, setRechazandoId] = useState<string | null>(null)
  const [mostrarRechazoId, setMostrarRechazoId] = useState<string | null>(null)

  const cargar = () => {
    setCargando(true)
    fetch("/api/administracion/cotizaciones")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok) setCotizaciones(data.cotizaciones || [])
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [])

  const nombreReceta = (id: string) => recetas.find((r) => r.id === id)?.nombre || id

  const aprobar = async (c: CotizacionPendiente) => {
    const vendedor = vendedorElegido[c.id]
    if (!vendedor) {
      toast({ title: "Elegí el vendedor para la comisión", variant: "destructive" })
      return
    }
    setAprobandoId(c.id)
    try {
      const res = await fetch(`/api/administracion/cotizaciones/${c.id}/aprobar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendedor }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo aprobar", variant: "destructive" })
        return
      }
      toast({ title: "Evento creado", description: `"${data.eventoNombre}" ya figura en Eventos > Lista.` })
      cargar()
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setAprobandoId(null)
    }
  }

  const rechazar = async (c: CotizacionPendiente) => {
    const comentario = (comentarioPorId[c.id] || "").trim()
    if (!comentario) {
      toast({ title: "Escribí qué hay que ajustar", variant: "destructive" })
      return
    }
    setRechazandoId(c.id)
    try {
      const res = await fetch(`/api/administracion/cotizaciones/${c.id}/rechazar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comentario }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo rechazar", variant: "destructive" })
        return
      }
      toast({ title: "Cotización devuelta al vendedor" })
      setMostrarRechazoId(null)
      cargar()
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setRechazandoId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 sm:px-6 sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex items-center gap-3">
          <Link href="/" className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">Cotizaciones para revisar</h1>
            <p className="text-sm text-muted-foreground">{cotizaciones.length} esperando aprobación</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-4">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : cotizaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No hay cotizaciones esperando revisión</p>
          </div>
        ) : (
          cotizaciones.map((c) => {
            const ganancia = c.precioVentaSugerido - (c.precioBaseSalon + c.totalCostoServicios)
            const abierta = abiertaId === c.id
            return (
              <div
                key={c.id}
                className="rounded-xl border-l-4 border border-border bg-card overflow-hidden"
                style={{ borderLeftColor: c.salon ? salonColor(c.salon) : "#6b7280" }}
              >
                <Collapsible open={abierta} onOpenChange={(open) => setAbiertaId(open ? c.id : null)}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-card-foreground">{c.clienteNombre}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                          <span>Vendedor: {c.vendedor}</span>
                          {c.salon && <span>{salonLabel(c.salon)}</span>}
                          {c.fechaEvento && <span>{c.fechaEvento}</span>}
                        </div>
                      </div>
                      <span className="text-lg font-bold text-emerald-700 shrink-0">{fmt(c.precioVentaSugerido)}</span>
                      <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${abierta ? "rotate-180" : ""}`} />
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t border-border px-4 py-4 space-y-4">
                      {/* Datos del cliente / evento */}
                      <div className="grid gap-2 sm:grid-cols-2 text-sm">
                        {c.clienteTelefono && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" /> {c.clienteTelefono}
                          </div>
                        )}
                        {c.fechaEvento && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" /> {c.fechaEvento}
                            {c.horario && ` · ${c.horario}${c.horarioFin ? ` a ${c.horarioFin}` : ""}`}
                          </div>
                        )}
                        {c.tipoEvento && <div className="text-muted-foreground">Tipo: {c.tipoEvento}</div>}
                        {c.nombreFestejados && <div className="text-muted-foreground">Festejados: {c.nombreFestejados}</div>}
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" /> {c.totalPersonas} personas
                          <span className="text-xs">
                            ({c.invitados.adultos} ad. · {c.invitados.adolescentes} adol. · {c.invitados.ninos} niños · {c.invitados.personasDietasEspeciales} dietas)
                          </span>
                        </div>
                      </div>

                      {/* Menú */}
                      {(c.recetasElegidas.adultos.length + c.recetasElegidas.adolescentes.length + c.recetasElegidas.ninos.length + c.recetasElegidas.dietasEspeciales.length) > 0 && (
                        <div className="text-sm">
                          <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">Menú elegido</p>
                          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                            {c.recetasElegidas.adultos.map((id) => <li key={`a-${id}`}>{nombreReceta(id)} (adultos)</li>)}
                            {c.recetasElegidas.adolescentes.map((id) => <li key={`t-${id}`}>{nombreReceta(id)} (adolescentes)</li>)}
                            {c.recetasElegidas.ninos.map((id) => <li key={`n-${id}`}>{nombreReceta(id)} (niños)</li>)}
                            {c.recetasElegidas.dietasEspeciales.map((id) => <li key={`d-${id}`}>{nombreReceta(id)} (dietas)</li>)}
                          </ul>
                        </div>
                      )}

                      {/* Servicios: costo interno vs precio de venta */}
                      {c.servicios.length > 0 && (
                        <div className="text-sm">
                          <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">Servicios (costo interno / precio de venta)</p>
                          <div className="space-y-1">
                            {c.servicios.map((s) => {
                              const costo = c.costosServicios.find((cs) => cs.servicioId === s.servicioId)
                              return (
                                <div key={s.servicioId} className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    {s.nombre}
                                    {s.cantidad > 1 ? ` ×${s.cantidad}` : ""}
                                  </span>
                                  <span className="tabular-nums">
                                    <span className="text-red-600">{fmt(costo?.costoTotal || 0)}</span>
                                    {" / "}
                                    <span className="text-emerald-700">{fmt(s.precioTotal)}</span>
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Totales */}
                      <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm">
                        {c.precioBaseSalon > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Precio base del salón</span>
                            <span className="tabular-nums">{fmt(c.precioBaseSalon)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-muted-foreground">
                          <span>Costo interno total (servicios)</span>
                          <span className="tabular-nums text-red-600">{fmt(c.precioBaseSalon + c.totalCostoServicios)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Precio de venta</span>
                          <span className="tabular-nums text-emerald-700">{fmt(c.precioVentaSugerido)}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t border-border pt-1">
                          <span>Ganancia estimada</span>
                          <span className="tabular-nums text-blue-700">{fmt(ganancia)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground pt-1">
                          No incluye costo de insumos/recetas (comida) — esta cotización solo calculó el costo de los servicios contratados.
                        </p>
                      </div>

                      {/* Acciones */}
                      {mostrarRechazoId === c.id ? (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="¿Qué hay que ajustar?"
                            value={comentarioPorId[c.id] || ""}
                            onChange={(e) => setComentarioPorId((prev) => ({ ...prev, [c.id]: e.target.value }))}
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setMostrarRechazoId(null)}>
                              Cancelar
                            </Button>
                            <Button variant="destructive" onClick={() => rechazar(c)} disabled={rechazandoId === c.id}>
                              {rechazandoId === c.id ? "Enviando..." : "Confirmar rechazo"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Select value={vendedorElegido[c.id] || ""} onValueChange={(v) => setVendedorElegido((prev) => ({ ...prev, [c.id]: v }))}>
                            <SelectTrigger className="sm:w-48">
                              <SelectValue placeholder="Vendedor (comisión)" />
                            </SelectTrigger>
                            <SelectContent>
                              {vendedores.map((v) => (
                                <SelectItem key={v.id} value={v.nombre}>
                                  {v.emoji} {v.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2 flex-1">
                            <Button
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => aprobar(c)}
                              disabled={aprobandoId === c.id}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1.5" />
                              {aprobandoId === c.id ? "Aprobando..." : "Aprobar"}
                            </Button>
                            <Button variant="outline" className="flex-1" onClick={() => setMostrarRechazoId(c.id)}>
                              <XCircle className="h-4 w-4 mr-1.5" />
                              Rechazar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}

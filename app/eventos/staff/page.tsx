"use client"

// Pantalla de solo lectura para staff externo (DJ, Fotógrafo, Vestido,
// Pantalla, Coordinación): calendario de próximos eventos. Al tocar un
// evento se abre un panel con fecha, festejados, tipo de evento, teléfono
// de contacto y los servicios contratados, resaltando el que le
// corresponde al perfil activo. Página aparte de /eventos/produccion,
// que sigue siendo solo para cocina/barra.

import { useMemo, useState } from "react"
import { useEventos } from "@/lib/use-eventos"
import { useProfile } from "@/lib/profile-context"
import { useSyncTiempoReal } from "@/lib/hooks/use-sync-tiempo-real"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CalendarDays, ChevronLeft, ChevronRight, Users, Phone, Sparkles, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EventoGuardado } from "@/lib/store"

/**
 * Servicio a resaltar según el perfil activo (coincidencia por nombre del
 * catálogo). DJ y Coordinación todavía no tienen un servicio propio en el
 * catálogo: cuando se agregue, sumar su caso acá.
 *
 * El catálogo real tiene variantes versionadas por año para casi todos los
 * servicios (ej. "FOTOGRAFIA 2027", "VESTIDO 2028") y algo de inconsistencia
 * de formato ("FOTO  + VIDEO" con doble espacio, "FOTO-VIDEO 2027" con
 * guion en vez de "+"). Por eso se normaliza espacios/guiones/"+" antes de
 * comparar, y "empieza con" en vez de exacto también para Pantalla — el
 * mismo patrón de versionado por año probablemente le va a llegar tarde o
 * temprano, aunque hoy solo exista "PANTALLA LED" sin año.
 */
function normalizarNombreServicio(s: string): string {
  return (s || "").trim().toUpperCase().replace(/[+\-]/g, " ").replace(/\s+/g, " ")
}

function esServicioDestacado(perfilId: string | undefined, nombreServicio: string): boolean {
  const n = normalizarNombreServicio(nombreServicio)
  switch (perfilId) {
    case "fotografo":
      return n.startsWith("FOTOGRAFIA") || n.startsWith("FOTO VIDEO")
    case "vestido":
      return n.startsWith("VESTIDO")
    case "pantalla":
      return n.startsWith("PANTALLA LED")
    default:
      return false
  }
}

function formatFecha(fecha: string): string {
  if (!fecha) return "Sin fecha"
  const d = new Date(fecha + "T12:00:00")
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

type CeldaDia = { dia: number; eventos: EventoGuardado[] } | null

export default function StaffPage() {
  const { eventos, loading } = useEventos()
  const { perfilActivo } = useProfile()
  // Refresca eventos cada 15s y al volver a la pestaña, para que el
  // calendario y los servicios reflejen cambios sin recargar a mano.
  useSyncTiempoReal()

  const [selectedEvento, setSelectedEvento] = useState<EventoGuardado | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [diaDialog, setDiaDialog] = useState<{ fecha: string; eventos: EventoGuardado[] } | null>(null)

  const hoy = new Date()
  const [mesActual, setMesActual] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1))

  const eventosConFecha = useMemo(
    () => eventos.filter((e) => !!e.fecha && e.estado !== "cancelado").sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [eventos],
  )

  const celdas = useMemo<CeldaDia[]>(() => {
    const anio = mesActual.getFullYear()
    const mes = mesActual.getMonth()
    const porDia = new Map<number, EventoGuardado[]>()
    for (const e of eventosConFecha) {
      const [y, m, d] = e.fecha.split("-").map((n) => Number.parseInt(n, 10))
      if (y === anio && m - 1 === mes) {
        const arr = porDia.get(d) || []
        arr.push(e)
        porDia.set(d, arr)
      }
    }
    const primerDia = new Date(anio, mes, 1)
    const diasEnMes = new Date(anio, mes + 1, 0).getDate()
    const offsetLunes = (primerDia.getDay() + 6) % 7 // 0 = lunes
    const out: CeldaDia[] = []
    for (let i = 0; i < offsetLunes; i++) out.push(null)
    for (let d = 1; d <= diasEnMes; d++) out.push({ dia: d, eventos: porDia.get(d) || [] })
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [eventosConFecha, mesActual])

  const proximosEventos = useMemo(() => {
    const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
    return eventosConFecha.filter((e) => e.fecha >= hoyISO).slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventosConFecha])

  const esHoy = (dia: number) =>
    hoy.getFullYear() === mesActual.getFullYear() && hoy.getMonth() === mesActual.getMonth() && hoy.getDate() === dia

  const abrirEvento = (e: EventoGuardado) => {
    setSelectedEvento(e)
    setDialogOpen(true)
  }

  const handleDiaClick = (celda: CeldaDia) => {
    if (!celda || celda.eventos.length === 0) return
    if (celda.eventos.length === 1) {
      abrirEvento(celda.eventos[0])
      return
    }
    const anio = mesActual.getFullYear()
    const mes = mesActual.getMonth()
    const fecha = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(celda.dia).padStart(2, "0")}`
    setDiaDialog({ fecha, eventos: celda.eventos })
  }

  const totalInvitados = (e: EventoGuardado) =>
    (e.adultos || 0) + (e.adolescentes || 0) + (e.ninos || 0) + (e.personasDietasEspeciales || 0)

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Cargando eventos...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          Próximos eventos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tocá un día para ver el detalle del evento y los servicios contratados.
        </p>
      </div>

      {/* Calendario mensual */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-transparent"
              onClick={() => setMesActual((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold capitalize">
                {mesActual.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setMesActual(new Date(hoy.getFullYear(), hoy.getMonth(), 1))}
              >
                Este mes
              </Button>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-transparent"
              onClick={() => setMesActual((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <div key={i} className="text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {celdas.map((celda, i) => {
              if (celda === null) return <div key={`v-${i}`} className="h-16" />
              const tiene = celda.eventos.length > 0
              return (
                <button
                  key={`d-${celda.dia}`}
                  type="button"
                  disabled={!tiene}
                  onClick={() => handleDiaClick(celda)}
                  className={cn(
                    "relative flex h-16 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-sm transition-colors",
                    tiene
                      ? "cursor-pointer bg-primary/10 font-semibold text-primary hover:bg-primary/20"
                      : "text-muted-foreground/50",
                    esHoy(celda.dia) && "ring-2 ring-primary",
                  )}
                  title={tiene ? celda.eventos.map((e) => e.nombrePareja || e.nombre || "Sin nombre").join(", ") : undefined}
                >
                  <span>{celda.dia}</span>
                  {tiene && (
                    <span className="max-w-full truncate text-[10px] font-normal leading-tight">
                      {celda.eventos.length > 1
                        ? `${celda.eventos.length} eventos`
                        : celda.eventos[0].nombrePareja || celda.eventos[0].nombre || "Evento"}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lista rápida de los próximos eventos */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Los próximos en la agenda</h3>
          {proximosEventos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay eventos próximos.</p>
          ) : (
            <div className="space-y-1.5">
              {proximosEventos.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => abrirEvento(e)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{e.nombrePareja || e.nombre || "Sin nombre"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatFecha(e.fecha)}
                      {e.tipoEvento ? ` · ${e.tipoEvento}` : ""}
                    </span>
                  </span>
                  <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: elegir entre varios eventos del mismo día */}
      <Dialog open={!!diaDialog} onOpenChange={(open) => !open && setDiaDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-5 w-5" />
              Eventos del {diaDialog ? formatFecha(diaDialog.fecha) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {diaDialog?.eventos.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  setDiaDialog(null)
                  abrirEvento(e)
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-left transition-colors hover:bg-primary/10"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{e.nombrePareja || e.nombre || "Sin nombre"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {totalInvitados(e)} invitados{e.tipoEvento ? ` · ${e.tipoEvento}` : ""}
                  </span>
                </span>
                <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: panel del evento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedEvento && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-5 w-5" />
                  {selectedEvento.nombrePareja || selectedEvento.nombre || "Evento"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{formatFecha(selectedEvento.fecha)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{selectedEvento.tipoEvento || "Sin tipo de evento"}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{selectedEvento.contrato?.telefono || "Sin teléfono cargado"}</span>
                  </div>
                </div>

                {selectedEvento.notaStaff && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                    <p className="mb-1 text-xs font-semibold text-sky-800">Nota</p>
                    <p className="whitespace-pre-line text-sm text-sky-900">{selectedEvento.notaStaff}</p>
                  </div>
                )}

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Servicios contratados</h4>
                  {(selectedEvento.servicios || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Este evento no tiene servicios cargados.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(selectedEvento.servicios || []).map((s, i) => {
                        const destacado = esServicioDestacado(perfilActivo?.id, s.nombre)
                        return (
                          <div
                            key={`${s.servicioId}-${i}`}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                              destacado ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border",
                            )}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              {destacado && <Sparkles className="h-4 w-4 shrink-0" />}
                              <span className="truncate">{s.nombre}</span>
                            </span>
                            {s.cantidad > 1 && (
                              <Badge variant="outline" className="shrink-0">
                                x{s.cantidad}
                              </Badge>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

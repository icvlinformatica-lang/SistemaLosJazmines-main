"use client"

// Sección "Resumen diario" de Inicio: mismo contenido que el mail de las
// 21:00 — dinero por caja, movimientos importantes y cuotas del día.

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ResumenMensual } from "@/components/resumen-mensual"
import { cn } from "@/lib/utils"
import { X, Wallet, TrendingUp, TrendingDown, CreditCard, Mail, Loader2, MapPin, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cambiarDiaResumen, fechaArgentina, fechaResumenValida } from "@/lib/resumen-fecha"

interface MovimientoResumen {
  tipo: string
  concepto: string
  monto: number
  caja: string
  salon: string
}

interface CuotaResumen {
  evento: string
  salon: string
  monto: number
  pagadoPor: string
  notas: string
}

interface IngresoSalonResumen {
  salon: string
  total: number
}

interface VieneAPagar {
  evento: string
  salon: string
  fechaEvento: string
  cuotaSemana: { numero: number; fechaVencimiento: string; monto: number } | null
  montoAtrasado: number
  cuotasAtrasadas: number
}

interface ResumenDiario {
  fecha: string
  fechaLegible: string
  ingresoCajaJazmines: number
  ingresoCajaEventos: number
  egresoCajaJazmines: number
  egresoCajaEventos: number
  ingresosPorSalon: IngresoSalonResumen[]
  movimientosImportantes: MovimientoResumen[]
  cuotasDelDia: CuotaResumen[]
  totalCuotas: number
  cantidadMovimientos: number
  vienenAPagar: VieneAPagar[]
}

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR")
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResumenDiarioModal({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState("diario")
  const [fechaElegida, setFechaElegida] = useState<string | null>(null)
  const hoy = fechaArgentina()
  const fecha = fechaElegida ?? hoy
  const fechaLegible = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const touchX = useRef<number | null>(null)
  const { data: resumen, isLoading: loading, error, mutate } = useSWR<ResumenDiario>(open && tab === "diario" ? `/api/resumen-diario?fecha=${fecha}` : null, async (url: string) => {
    const respuesta = await fetch(url, { cache: "no-store" })
    if (!respuesta.ok) throw new Error("No se pudo cargar el resumen")
    const data = await respuesta.json()
    if (data.error) throw new Error("No se pudo cargar el resumen")
    return data
  }, { keepPreviousData: false })
  useEffect(() => { if (!open) { setTab("diario"); setFechaElegida(null) } }, [open])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={cn("flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-xl p-0", tab === "mensual" ? "sm:max-w-[calc(100%-2rem)]" : "bg-[#f5f0e8] sm:max-w-lg")}>
        <DialogDescription className="sr-only">Consultá el resumen diario o mensual de las cajas por salón.</DialogDescription>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 bg-[#2d5a3d] px-5 py-4 text-[#f5f0e8]">
          <div>
            <DialogTitle className="text-lg font-bold">Resumen</DialogTitle>
            <p className="text-xs opacity-90 capitalize">{tab === "diario" ? fechaLegible : "Ingresos y egresos por salón"}</p>
          </div>
          <DialogClose
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
          <div className="bg-background p-3 text-foreground">
            <TabsList className="w-full" aria-label="Tipo de resumen"
              onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
              onTouchEnd={(e) => {
                if (touchX.current !== null) {
                  const distancia = e.changedTouches[0].clientX - touchX.current
                  if (Math.abs(distancia) > 45) setTab(distancia < 0 ? "mensual" : "diario")
                }
                touchX.current = null
              }}>
              <TabsTrigger value="diario">Diario</TabsTrigger>
              <TabsTrigger value="mensual">Mensual</TabsTrigger>
            </TabsList>
          </div>
        <TabsContent value="diario" className="min-h-0 overflow-y-auto">
        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="rounded-lg border bg-background p-3 text-foreground">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fecha-resumen-diario">Fecha del resumen</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Día anterior" disabled={fecha === "0001-01-01"} onClick={() => setFechaElegida(cambiarDiaResumen(fecha, -1))}><ChevronLeft /></Button>
                <Input id="fecha-resumen-diario" className="w-40" type="date" min="0001-01-01" max="9999-12-31" value={fecha} onChange={(e) => { if (fechaResumenValida(e.target.value)) setFechaElegida(e.target.value) }} />
                <Button variant="outline" size="icon" aria-label="Día siguiente" disabled={fecha === "9999-12-31"} onClick={() => setFechaElegida(cambiarDiaResumen(fecha, 1))}><ChevronRight /></Button>
                <Button variant="ghost" size="sm" disabled={fecha === hoy} onClick={() => setFechaElegida(null)}><CalendarDays />Hoy</Button>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#2d5a3d]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Armando el resumen del día...
            </div>
          ) : error || !resumen || resumen.fecha !== fecha ? (
            <div role="alert" className="rounded-lg bg-background p-4 text-center text-foreground"><p className="text-sm">No se pudo cargar el resumen de esta fecha.</p><Button variant="outline" size="sm" onClick={() => void mutate()}>Reintentar</Button></div>
          ) : (
            <>
              {/* Dinero por caja */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#2d5a3d]">
                  <Wallet className="h-4 w-4" />
                  Dinero por caja
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { nombre: "Caja Jazmines", ingreso: resumen.ingresoCajaJazmines, egreso: resumen.egresoCajaJazmines },
                    { nombre: "Caja Eventos", ingreso: resumen.ingresoCajaEventos, egreso: resumen.egresoCajaEventos },
                  ].map((caja) => (
                    <div key={caja.nombre} className="rounded-lg border border-[#2d5a3d]/20 bg-white p-3">
                      <p className="mb-1.5 text-xs font-semibold text-gray-600">{caja.nombre}</p>
                      <p className="flex items-center gap-1 text-sm font-bold text-emerald-700">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {fmt(caja.ingreso)}
                      </p>
                      <p className="flex items-center gap-1 text-xs font-medium text-red-600">
                        <TrendingDown className="h-3 w-3" />
                        {fmt(caja.egreso)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Ingresos por salón */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#2d5a3d]">
                  <MapPin className="h-4 w-4" />
                  Ingresos por salón
                </h3>
                <div className="rounded-lg border border-[#2d5a3d]/20 bg-white">
                  {resumen.ingresosPorSalon.length === 0 ? (
                    <p className="p-3 text-sm text-gray-400">Sin ingresos registrados para este día.</p>
                  ) : (
                    resumen.ingresosPorSalon.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0"
                      >
                        <span className="text-sm font-medium text-gray-700">{s.salon}</span>
                        <span className="shrink-0 text-sm font-bold text-emerald-700">+ {fmt(s.total)}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Movimientos importantes */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#2d5a3d]">
                  <TrendingUp className="h-4 w-4" />
                  Movimientos importantes
                </h3>
                <div className="rounded-lg border border-[#2d5a3d]/20 bg-white">
                  {resumen.movimientosImportantes.length === 0 ? (
                    <p className="p-3 text-sm text-gray-400">Sin movimientos registrados para este día.</p>
                  ) : (
                    resumen.movimientosImportantes.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm text-gray-700">{m.concepto}</span>
                          <span className="text-[11px] text-gray-400">
                            {m.salon} · {m.caja}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-sm font-semibold ${m.tipo === "ingreso" ? "text-emerald-700" : "text-red-600"}`}
                        >
                          {m.tipo === "ingreso" ? "+" : "-"} {fmt(m.monto)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Cuotas del día */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#2d5a3d]">
                  <CreditCard className="h-4 w-4" />
                  Cuotas que entraron este día
                </h3>
                <div className="rounded-lg border border-[#2d5a3d]/20 bg-white">
                  {resumen.cuotasDelDia.length === 0 ? (
                    <p className="p-3 text-sm text-gray-400">No entraron cuotas este día.</p>
                  ) : (
                    <>
                      {resumen.cuotasDelDia.map((c, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2"
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium text-gray-700">{c.evento}</span>
                            <span className="truncate text-[11px] text-gray-400">
                              {c.salon}
                              {c.notas || c.pagadoPor ? ` · ${c.notas || c.pagadoPor}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-bold text-emerald-700">{fmt(c.monto)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-2 px-3 py-2 font-semibold">
                        <span className="text-sm text-gray-800">Total cuotas</span>
                        <span className="text-sm text-emerald-700">{fmt(resumen.totalCuotas)}</span>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <Mail className="h-3 w-3" />
                Este resumen se envía por mail todos los días a las 21:00.
              </p>
            </>
          )}
        </div>
        </TabsContent>
        <TabsContent value="mensual" className="min-h-0 overflow-y-auto">
          {tab === "mensual" && <ResumenMensual />}
        </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

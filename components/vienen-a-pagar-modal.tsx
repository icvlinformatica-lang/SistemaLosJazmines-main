"use client"

// Sección "Vienen a pagar" de Inicio: quiénes deben venir a pagar su cuota
// esta semana, con nombre, fecha del evento y salón. Si además deben cuotas
// vencidas de semanas anteriores, se marca ATRASADO con el monto adeudado.

import { useEffect, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { X, Users, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SalonDot } from "@/components/salon-badge"
import { useStore } from "@/lib/store-context"
import { SALON_COLORES_DEFAULT, salonLabel } from "@/lib/store"
import { agruparCuotasPorSalon, ordenarCuotasPorEvento, limiteCuotasVisibles, type CuotaPorPagar } from "@/lib/vienen-a-pagar"
import type { ResumenDiario } from "@/lib/resumen-diario"

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR")
}

function fechaCorta(ymd: string): string {
  if (!ymd) return "Sin fecha"
  return new Date(ymd + "T12:00:00Z").toLocaleDateString("es-AR", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })
}

function CuotaFila({ cuota, onAbrirEvento }: { cuota: CuotaPorPagar & { salon: string }; onAbrirEvento: () => void }) {
  return (
    <li className="border-b border-border px-3 py-2 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="break-words text-sm font-semibold">{cuota.evento}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>Evento {fechaCorta(cuota.fechaEvento)}</span>
            <span className="inline-flex items-center gap-1"><SalonDot salon={cuota.salon} />{salonLabel(cuota.salon)}</span>
          </p>
        </div>
        <div className="flex flex-col gap-1 text-right text-sm">
          <p>Cuota {cuota.numero} · <strong className="tabular-nums">{cuota.ipcPendiente ? "A definir" : fmt(cuota.monto)}</strong></p>
          {cuota.ipcPendiente && <p className="text-destructive">{cuota.ipcPendiente}</p>}
          {cuota.recargo > 0 && (
            <p className="font-semibold text-destructive tabular-nums">
              + {fmt(cuota.recargo)} recargo <span className="font-normal">({cuota.diasAtraso} {cuota.diasAtraso === 1 ? "día" : "días"} de atraso)</span>
            </p>
          )}
          {cuota.recargo > 0 && !cuota.ipcPendiente && (
            <p className="tabular-nums">Total con recargo: <strong>{fmt(cuota.monto + cuota.recargo)}</strong></p>
          )}
          <p className="text-muted-foreground">Vence {fechaCorta(cuota.fechaVencimiento)}</p>
        </div>
        {cuota.eventoId ? (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={`/eventos/pagos?evento=${encodeURIComponent(cuota.eventoId)}`} prefetch={false} onClick={onAbrirEvento} aria-label={`Ir al evento ${cuota.evento}, cuota ${cuota.numero}`}>Ir al evento</Link>
          </Button>
        ) : <Button variant="outline" size="sm" disabled title="No se pudo identificar el evento. Volvé a abrir la lista.">Ir al evento</Button>}
      </div>
    </li>
  )
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VienenAPagarModal({ open, onOpenChange }: Props) {
  const { configuracionCajas } = useStore()
  const [salonFiltro, setSalonFiltro] = useState("todos")
  const [busqueda, setBusqueda] = useState("")
  const [ampliaciones, setAmpliaciones] = useState(0)
  const { data, isLoading, error, mutate } = useSWR<ResumenDiario>(open ? "/api/resumen-diario" : null, async (url: string) => {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) throw new Error("No se pudo cargar la lista")
    const resumen = await response.json()
    if (!Array.isArray(resumen.vienenAPagar) || resumen.vienenAPagar.some((v: { cuotasPendientes?: unknown }) => !Array.isArray(v.cuotasPendientes))) throw new Error("Respuesta de cuotas incompleta")
    return resumen
  })
  useEffect(() => { if (!open) { setSalonFiltro("todos"); setBusqueda(""); setAmpliaciones(0) } }, [open])

  if (!open) return null

  const grupos = agruparCuotasPorSalon(data?.vienenAPagar ?? [])
  const salones = [...new Set([...Object.keys(SALON_COLORES_DEFAULT), ...Object.keys(configuracionCajas?.salones ?? {}), ...grupos.map((g) => g.salon)])]
  const visibles = grupos.filter((g) => salonFiltro === "todos" || (g.salon || "general") === salonFiltro)
  const textoBusqueda = busqueda.trim().toLowerCase()
  const cuotasOrdenadas = ordenarCuotasPorEvento(visibles)
  const cuotas = textoBusqueda
    ? cuotasOrdenadas.filter((cuota) =>
        cuota.evento.toLowerCase().includes(textoBusqueda) ||
        cuota.fechaEvento.toLowerCase().includes(textoBusqueda) ||
        fechaCorta(cuota.fechaEvento).toLowerCase().includes(textoBusqueda),
      )
    : cuotasOrdenadas
  const cuotasMostradas = cuotas.slice(0, limiteCuotasVisibles(ampliaciones))
  const totalSemana = visibles.reduce((s, g) => s + g.totalSemana, 0)
  const cantidadSemana = visibles.reduce((s, g) => s + g.cantidadSemana, 0)
  const cantidadAtrasada = visibles.reduce((s, g) => s + g.cantidadAtrasada, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false) }} role="dialog" aria-modal="true" aria-labelledby="titulo-vienen-pagar" onKeyDown={(e) => { if (e.key === "Escape") onOpenChange(false) }}>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-background text-foreground shadow-2xl">
        {/* Header */}
        <div className="bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="titulo-vienen-pagar" className="text-lg font-bold">Vienen a pagar</h2>
              <p className="text-sm">Cuotas que vencen esta semana y deudas atrasadas</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Cerrar"><X /></Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="salon-cuotas">Filtrar por salón</Label>
              <Select value={salonFiltro} onValueChange={(salon) => { setSalonFiltro(salon); setAmpliaciones(0) }}>
                <SelectTrigger id="salon-cuotas" className="w-64 max-w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>
                  <SelectItem value="todos">Todos los salones</SelectItem>
                  {salones.map((salon) => <SelectItem key={salon || "general"} value={salon || "general"}><SalonDot salon={salon} />{salonLabel(salon)}</SelectItem>)}
                </SelectGroup></SelectContent>
              </Select>
            </div>
            {!isLoading && !error && data && <p className="text-sm font-semibold" aria-live="polite">{cantidadSemana + cantidadAtrasada} cuotas por pagar</p>}
          </div>

          {isLoading ? (
            <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm"><Loader2 className="size-4 animate-spin" />Buscando cuotas de la semana...</div>
          ) : error || !data ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-6"><p>No se pudo cargar la lista.</p><Button variant="outline" onClick={() => void mutate()}>Reintentar</Button></div>
          ) : (
            <>
              {/* Totales rápidos */}
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border bg-card p-3 text-card-foreground" aria-live="polite"><p className="text-sm text-muted-foreground">Por cobrar esta semana · {cantidadSemana} cuotas</p><p className="font-bold tabular-nums">{fmt(totalSemana)}</p></div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="search"
                    value={busqueda}
                    onChange={(e) => { setBusqueda(e.target.value); setAmpliaciones(0) }}
                    placeholder="Buscar por nombre, fecha o salón..."
                    aria-label="Buscar por nombre o fecha"
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Lista */}
              {cuotas.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No hay cuotas por pagar esta semana ni atrasadas{salonFiltro !== "todos" ? " para este salón" : ""}.</p> : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">Ordenadas por evento más próximo a más lejano</p>
                  <ul id="lista-cuotas-pendientes" className="rounded-lg border bg-card text-card-foreground" aria-label="Cuotas por fecha del evento">
                    {cuotasMostradas.map((cuota, i) => <CuotaFila key={`${cuota.eventoId}-${cuota.numero}-${i}`} cuota={cuota} onAbrirEvento={() => onOpenChange(false)} />)}
                  </ul>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground" aria-live="polite">Mostrando {cuotasMostradas.length} de {cuotas.length} cuotas</p>
                    {cuotasMostradas.length < cuotas.length && <Button variant="outline" size="sm" aria-controls="lista-cuotas-pendientes" onClick={() => setAmpliaciones((actual) => actual + 1)}>{ampliaciones >= 2 ? "Ver más (todas)" : `Ver más (+${Math.min(5, cuotas.length - cuotasMostradas.length)})`}</Button>}
                  </div>
                </div>
              )}
              <p className="flex items-start gap-2 text-sm text-muted-foreground"><Users className="size-4 shrink-0" />Semana actual de lunes a domingo. Los atrasos incluyen todas las cuotas vencidas sin pagar. Los totales incluyen todas las cuotas del salón seleccionado. Si una cuota está a definir, su último importe guardado integra el total solo como referencia; no es un importe confirmado para cobrar.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

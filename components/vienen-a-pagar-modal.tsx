"use client"

// Sección "Vienen a pagar" de Inicio: quiénes deben venir a pagar su cuota
// esta semana, con nombre, fecha del evento y salón. Si además deben cuotas
// vencidas de semanas anteriores, se marca ATRASADO con el monto adeudado.

import { useEffect, useState } from "react"
import useSWR from "swr"
import { X, Users, Loader2, AlertTriangle, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SalonDot } from "@/components/salon-badge"
import { useStore } from "@/lib/store-context"
import { SALON_COLORES_DEFAULT, salonLabel, salonColor } from "@/lib/store"
import { agruparCuotasPorSalon, type CuotaPorPagar } from "@/lib/vienen-a-pagar"
import type { ResumenDiario } from "@/lib/resumen-diario"

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR")
}

function fechaCorta(ymd: string): string {
  if (!ymd) return "Sin fecha"
  return new Date(ymd + "T12:00:00Z").toLocaleDateString("es-AR", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })
}

function CuotaCard({ cuota }: { cuota: CuotaPorPagar }) {
  return (
    <li className="rounded-lg border bg-card p-3 text-card-foreground">
      <div className="flex flex-col gap-1">
        <p className="break-words text-sm font-semibold">{cuota.evento}</p>
        <p className="flex items-center gap-1 text-sm text-muted-foreground"><CalendarDays className="size-4 shrink-0" />Evento {fechaCorta(cuota.fechaEvento)}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">Cuota {cuota.numero}</span>
          <span className="text-sm font-bold tabular-nums">{fmt(cuota.monto)}</span>
        </div>
        <p className="text-sm text-muted-foreground">Vence {fechaCorta(cuota.fechaVencimiento)}</p>
        {cuota.atrasada && <p className="flex items-center gap-1 text-sm font-semibold text-destructive"><AlertTriangle className="size-4" />Atrasada · sin pagar</p>}
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
  const { data, isLoading, error, mutate } = useSWR<ResumenDiario>(open ? "/api/resumen-diario" : null, async (url: string) => {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) throw new Error("No se pudo cargar la lista")
    const resumen = await response.json()
    if (!Array.isArray(resumen.vienenAPagar) || resumen.vienenAPagar.some((v: { cuotasPendientes?: unknown }) => !Array.isArray(v.cuotasPendientes))) throw new Error("Respuesta de cuotas incompleta")
    return resumen
  })
  useEffect(() => { if (!open) setSalonFiltro("todos") }, [open])

  if (!open) return null

  const grupos = agruparCuotasPorSalon(data?.vienenAPagar ?? [])
  const salones = [...new Set([...Object.keys(SALON_COLORES_DEFAULT), ...Object.keys(configuracionCajas?.salones ?? {}), ...grupos.map((g) => g.salon)])]
  const visibles = grupos.filter((g) => salonFiltro === "todos" || (g.salon || "general") === salonFiltro)
  const totalSemana = visibles.reduce((s, g) => s + g.totalSemana, 0)
  const totalAtrasado = visibles.reduce((s, g) => s + g.totalAtrasado, 0)
  const cantidadSemana = visibles.reduce((s, g) => s + g.cantidadSemana, 0)
  const cantidadAtrasada = visibles.reduce((s, g) => s + g.cantidadAtrasada, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false) }} role="dialog" aria-modal="true" aria-labelledby="titulo-vienen-pagar" onKeyDown={(e) => { if (e.key === "Escape") onOpenChange(false) }}>
      <div className="flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-background text-foreground shadow-2xl">
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
              <Select value={salonFiltro} onValueChange={setSalonFiltro}>
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-live="polite">
                <div className="rounded-lg border bg-card p-3 text-card-foreground"><p className="text-sm text-muted-foreground">Por cobrar esta semana · {cantidadSemana} cuotas</p><p className="font-bold tabular-nums">{fmt(totalSemana)}</p></div>
                <div className="rounded-lg border bg-card p-3 text-card-foreground"><p className="text-sm text-muted-foreground">Deuda atrasada · {cantidadAtrasada} cuotas</p><p className="font-bold tabular-nums text-destructive">{fmt(totalAtrasado)}</p></div>
              </div>

              {/* Lista */}
              {visibles.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No hay cuotas por pagar esta semana ni atrasadas{salonFiltro !== "todos" ? " para este salón" : ""}.</p> : visibles.map((grupo) => (
                <section key={grupo.salon} className="min-w-0 rounded-lg border bg-card p-3 text-card-foreground" aria-label={`Cuotas de ${salonLabel(grupo.salon)}`}>
                  <div className="flex flex-col gap-3">
                    <div className="rounded-md p-3" style={{ backgroundColor: `${salonColor(grupo.salon, configuracionCajas)}20` }}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 font-semibold"><SalonDot salon={grupo.salon} />{salonLabel(grupo.salon)}</h3>
                        <p className="text-sm font-semibold">{grupo.cuotas.length} cuotas · {grupo.cantidadSemana} de la semana · {grupo.cantidadAtrasada} atrasadas</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto pb-2" role="region" aria-label={`Columnas de cuotas de ${salonLabel(grupo.salon)}`} tabIndex={0}>
                      <div className="flex items-start gap-3">
                        {grupo.columnas.map((columna, i) => <div key={i} className="w-64 shrink-0">
                          <div className="flex flex-col gap-2">
                            <p className="text-sm text-muted-foreground">Cuotas {i * 5 + 1}–{i * 5 + columna.length} de {grupo.cuotas.length}</p>
                            <ul className="flex flex-col gap-2" aria-label={`Cuotas ${i * 5 + 1} a ${i * 5 + columna.length}`}>{columna.map((cuota, j) => <CuotaCard key={`${i}-${j}`} cuota={cuota} />)}</ul>
                          </div>
                        </div>)}
                      </div>
                    </div>
                  </div>
                </section>
              ))}
              <p className="flex items-start gap-2 text-sm text-muted-foreground"><Users className="size-4 shrink-0" />Semana actual de lunes a domingo. Los atrasos incluyen todas las cuotas vencidas sin pagar. Cada columna muestra hasta 5 cuotas; deslizá horizontalmente para ver más.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

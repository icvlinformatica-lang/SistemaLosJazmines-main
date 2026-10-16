"use client"

// Sección "Vienen a pagar" de Inicio: quiénes deben venir a pagar su cuota
// esta semana, con nombre, fecha del evento y salón. Si además deben cuotas
// vencidas de semanas anteriores, se marca ATRASADO con el monto adeudado.

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { X, Users, Loader2, Search, Phone, MessageCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SalonDot } from "@/components/salon-badge"
import { useStore } from "@/lib/store-context"
import { SALONES, salonColor, salonLabel } from "@/lib/store"
import { useProfile } from "@/lib/profile-context"
import { calcularCajaEventos } from "@/lib/hooks/use-caja-eventos"
import { fechaNegocio } from "@/lib/ipc-cuotas"
import { agruparCuotasPorSalon, ordenarCuotasPorEvento, claveCuotaVienenAPagar, sinCuotasParaMasTarde, limiteCuotasVisibles, porEntrarDelMesPorSalon, type CuotaPorPagar, type PorEntrarSalon } from "@/lib/vienen-a-pagar"
import type { ResumenDiario } from "@/lib/resumen-diario"
import { enlaceWhatsApp, mensajeRecordatorioCuota } from "@/lib/recordatorio-cuota"

/**
 * Carga de la lista. Se exporta para que el botón de Inicio use la MISMA
 * clave y la misma validación de SWR: así el número de atrasadas del botón
 * sale de los mismos datos que muestra este modal (y al abrirlo ya están).
 */
export const CLAVE_VIENEN_A_PAGAR = "/api/resumen-diario"
export async function cargarResumenVienenAPagar(url: string): Promise<ResumenDiario> {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error("No se pudo cargar la lista")
  const resumen = await response.json()
  if (!Array.isArray(resumen.vienenAPagar) || resumen.vienenAPagar.some((v: { cuotasPendientes?: unknown }) => !Array.isArray(v.cuotasPendientes))) throw new Error("Respuesta de cuotas incompleta")
  return resumen
}

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR")
}

function fechaCorta(ymd: string): string {
  if (!ymd) return "Sin fecha"
  return new Date(ymd + "T12:00:00Z").toLocaleDateString("es-AR", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })
}

function CuotaFila({ cuota, onAbrirEvento, onVerMasTarde }: { cuota: CuotaPorPagar & { salon: string }; onAbrirEvento: () => void; onVerMasTarde: () => void }) {
  // Recordatorio por WhatsApp: solo si el teléfono del contrato da un número
  // usable. "venció" para las que ya pasaron su vencimiento (aunque sean de
  // esta semana), "vence" para las que todavía no.
  const whatsapp = enlaceWhatsApp(cuota.telefono, mensajeRecordatorioCuota({
    nombre: cuota.evento,
    numeroCuota: cuota.numero,
    monto: cuota.monto,
    fechaVencimiento: cuota.fechaVencimiento,
    vencida: cuota.atrasada || (cuota.diasAtraso ?? 0) > 0,
    montoADefinir: !!cuota.ipcPendiente,
  }))
  return (
    <li className="border-b border-border px-3 py-2 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2 break-words text-sm font-semibold">
            {cuota.evento}
            {cuota.atrasada && <span className="rounded bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground">ATRASADA</span>}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>Evento {fechaCorta(cuota.fechaEvento)}</span>
            <span className="inline-flex items-center gap-1"><SalonDot salon={cuota.salon} />{salonLabel(cuota.salon)}</span>
            {cuota.telefono && (
              <a href={`tel:${cuota.telefono.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 underline underline-offset-2"><Phone className="size-3.5" />{cuota.telefono}</a>
            )}
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
        {/* En la compu (lg) los botones van apilados; en el celular siguen uno al lado del otro. */}
        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:items-stretch">
        {whatsapp && (
          <Button asChild size="sm" className="bg-[#2f8f5b] text-white hover:bg-[#2f8f5b]/90">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`Mandar recordatorio por WhatsApp a ${cuota.evento}, cuota ${cuota.numero}`}><MessageCircle />WhatsApp</a>
          </Button>
        )}
        {cuota.eventoId ? (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={`/eventos/pagos?evento=${encodeURIComponent(cuota.eventoId)}`} prefetch={false} onClick={onAbrirEvento} aria-label={`Ir al evento ${cuota.evento}, cuota ${cuota.numero}`}>Ir al evento</Link>
          </Button>
        ) : <Button variant="outline" size="sm" disabled title="No se pudo identificar el evento. Volvé a abrir la lista.">Ir al evento</Button>}
        {/* Saca la cuota de la lista hasta que se cierre la ventana; no guarda nada. */}
        <Button type="button" variant="ghost" size="sm" onClick={onVerMasTarde} aria-label={`Ver más tarde a ${cuota.evento}, cuota ${cuota.numero}`}><Clock />Ver más tarde</Button>
        </div>
      </div>
    </li>
  )
}

/**
 * Tarjeta de un salón (o "Todos") con lo que falta entrar este mes. Plegada
 * es una sola línea del tamaño del texto; desplegada se agranda y, para
 * Administración y Soporte, muestra cuánto va a cada caja.
 */
export function TarjetaPorEntrar({ fila, color, elegida, desplegada, veCajas, onClick }: {
  fila: PorEntrarSalon
  color: string
  elegida: boolean
  desplegada: boolean
  veCajas: boolean
  onClick: () => void
}) {
  const nombre = fila.salon === "todos" ? "Todos" : salonLabel(fila.salon)
  const total = fmt(fila.cajaEventos + fila.cajaJazmines)
  return (
    <button
      type="button"
      aria-pressed={elegida}
      aria-expanded={desplegada}
      data-tarjeta-salon=""
      onClick={onClick}
      className={`rounded-lg border-2 text-left text-foreground transition-all ${desplegada ? "flex flex-col gap-1 p-3 text-sm" : "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs"}`}
      style={{ backgroundColor: `${color}${elegida ? "4d" : "1f"}`, borderColor: elegida ? color : `${color}59` }}
    >
      <span className="font-semibold">{nombre}</span>
      <strong className={`tabular-nums ${desplegada ? "text-lg" : ""}`}>{total}</strong>
      {desplegada && veCajas && (
        <span className="flex flex-col gap-1 border-t pt-1" style={{ borderColor: `${color}59` }}>
          <span className="flex items-baseline justify-between gap-4"><span>Caja Eventos</span><strong className="tabular-nums">{fmt(fila.cajaEventos)}</strong></span>
          <span className="flex items-baseline justify-between gap-4"><span>Caja Jazmines</span><strong className="tabular-nums">{fmt(fila.cajaJazmines)}</strong></span>
        </span>
      )}
    </button>
  )
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VienenAPagarModal({ open, onOpenChange }: Props) {
  const { state, configuracionCajas } = useStore()
  const [conRecargo, setConRecargo] = useState(false)
  const { perfilActivo } = useProfile()
  // El reparto entre cajas deja deducir el costo de cada evento: solo lo ven
  // Administración y Soporte (Cobrar cuota tampoco ve las cajas en el Resumen diario).
  const veCajas = perfilActivo?.id === "administracion" || perfilActivo?.id === "soporte"
  const hoy = fechaNegocio()
  // El total por salón lo ven todos (es la suma de las cuotas); el desglose por caja, solo veCajas.
  const porEntrar = useMemo(
    () => (open ? porEntrarDelMesPorSalon(calcularCajaEventos(state).ingresosPendientes, hoy, SALONES, conRecargo) : []),
    [open, state, hoy, conRecargo],
  )
  const nombreMes = new Date(`${hoy}T12:00:00`).toLocaleDateString("es-AR", { month: "long" })
  const [salonFiltro, setSalonFiltro] = useState("todos")
  const [desplegada, setDesplegada] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [ampliaciones, setAmpliaciones] = useState(0)
  // Cuotas que se tocaron "Ver más tarde": salen de la lista y entra la
  // siguiente. Vive solo mientras la ventana está abierta (se vacía al cerrar).
  const [paraMasTarde, setParaMasTarde] = useState<Set<string>>(() => new Set())
  const { data, isLoading, error, mutate } = useSWR<ResumenDiario>(open ? CLAVE_VIENEN_A_PAGAR : null, cargarResumenVienenAPagar)
  useEffect(() => { if (!open) { setSalonFiltro("todos"); setDesplegada(null); setBusqueda(""); setAmpliaciones(0); setConRecargo(false); setParaMasTarde(new Set()) } }, [open])

  if (!open) return null

  const grupos = agruparCuotasPorSalon(data?.vienenAPagar ?? [])
  const visibles = grupos.filter((g) => salonFiltro === "todos" || (g.salon || "general") === salonFiltro)
  const textoBusqueda = busqueda.trim().toLowerCase()
  const cuotasOrdenadas = ordenarCuotasPorEvento(visibles)
  const cuotasALaVista = sinCuotasParaMasTarde(cuotasOrdenadas, paraMasTarde)
  const cantidadParaMasTarde = cuotasOrdenadas.length - cuotasALaVista.length
  const cuotas = textoBusqueda
    ? cuotasALaVista.filter((cuota) =>
        cuota.evento.toLowerCase().includes(textoBusqueda) ||
        cuota.fechaEvento.toLowerCase().includes(textoBusqueda) ||
        fechaCorta(cuota.fechaEvento).toLowerCase().includes(textoBusqueda),
      )
    : cuotasALaVista
  const cuotasMostradas = cuotas.slice(0, limiteCuotasVisibles(ampliaciones))
  const totalSemana = visibles.reduce((s, g) => s + g.totalSemana, 0)
  const cantidadSemana = visibles.reduce((s, g) => s + g.cantidadSemana, 0)

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

        {/* Tocar cualquier lugar que no sea una tarjeta de salón las pliega a todas (el filtro elegido sigue). */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5" onClick={(e) => { if (!(e.target as HTMLElement).closest("[data-tarjeta-salon]")) setDesplegada(null) }}>
              {/* Tarjetas por salón: lo que falta entrar este mes. Tocar una filtra la lista por ese salón y la despliega. */}
              <section aria-labelledby="titulo-por-entrar" className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="titulo-por-entrar" className="text-sm font-semibold">Falta entrar si se pagan todas las cuotas de {nombreMes} (con las atrasadas)</h3>
                  <div className="flex gap-1" role="group" aria-label="Recargo por atraso">
                    <Button type="button" size="sm" variant={conRecargo ? "outline" : "default"} aria-pressed={!conRecargo} onClick={() => setConRecargo(false)}>Sin recargo</Button>
                    <Button type="button" size="sm" variant={conRecargo ? "default" : "outline"} aria-pressed={conRecargo} onClick={() => setConRecargo(true)}>Con recargo</Button>
                  </div>
                </div>
                {/* Plegadas: una línea con nombre y total, del tamaño del texto. Al tocarla se agranda y filtra la lista. */}
                <div className="flex flex-wrap items-start gap-2">
                  {[{ salon: "todos", cajaEventos: porEntrar.reduce((s, f) => s + f.cajaEventos, 0), cajaJazmines: porEntrar.reduce((s, f) => s + f.cajaJazmines, 0) }, ...porEntrar].map((fila) => (
                    <TarjetaPorEntrar
                      key={fila.salon}
                      fila={fila}
                      color={fila.salon === "todos" ? "#64748b" : salonColor(fila.salon, configuracionCajas)}
                      elegida={salonFiltro === fila.salon}
                      desplegada={desplegada === fila.salon}
                      veCajas={veCajas}
                      onClick={() => {
                        const cerrar = desplegada === fila.salon
                        setDesplegada(cerrar ? null : fila.salon)
                        setSalonFiltro(cerrar ? "todos" : fila.salon)
                        setAmpliaciones(0)
                      }}
                    />
                  ))}
                </div>
              </section>

          {isLoading ? (
            <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm"><Loader2 className="size-4 animate-spin" />Buscando cuotas de la semana...</div>
          ) : error || !data ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-6"><p>No se pudo cargar la lista.</p><Button variant="outline" onClick={() => void mutate()}>Reintentar</Button></div>
          ) : (
            <>
              {/* Totales rápidos */}
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border bg-card p-3 text-card-foreground" aria-live="polite"><p className="text-sm text-muted-foreground">Por cobrar esta semana · {cantidadSemana} {cantidadSemana === 1 ? "cuota" : "cuotas"}</p><p className="font-bold tabular-nums">{fmt(totalSemana)}</p></div>
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
              {cantidadParaMasTarde > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground" aria-live="polite">
                  <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />{cantidadParaMasTarde} {cantidadParaMasTarde === 1 ? "cuota dejada" : "cuotas dejadas"} para más tarde. Vuelven al cerrar y abrir la ventana.</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setParaMasTarde(new Set())}>Mostrarlas</Button>
                </div>
              )}
              {cuotas.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{cantidadParaMasTarde > 0 && !textoBusqueda ? "No quedan cuotas a la vista: las demás quedaron para más tarde." : <>No hay cuotas por pagar esta semana ni atrasadas{salonFiltro !== "todos" ? " para este salón" : ""}.</>}</p> : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">Ordenadas por evento más próximo a más lejano</p>
                  <ul id="lista-cuotas-pendientes" className="rounded-lg border bg-card text-card-foreground" aria-label="Cuotas por fecha del evento">
                    {cuotasMostradas.map((cuota, i) => <CuotaFila key={`${cuota.eventoId}-${cuota.numero}-${i}`} cuota={cuota} onAbrirEvento={() => onOpenChange(false)} onVerMasTarde={() => setParaMasTarde((actual) => new Set(actual).add(claveCuotaVienenAPagar(cuota)))} />)}
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

"use client"

// Aviso de los lunes para Administración (reglas en lib/aviso-semanal.ts).
// La ventana se abre sola una vez por semana y por persona; después el mismo
// contenido queda plegado arriba de todo en Novedades, con punto rojo
// mientras falte finalizar algún evento del finde anterior. Si el evento no
// se hizo, desde acá también se puede mandar a la papelera.

import { useEffect, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { X, CalendarCheck, CalendarDays, HandCoins, PartyPopper, Check, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SalonDot } from "@/components/salon-badge"
import { useStore } from "@/lib/store-context"
import { salonLabel } from "@/lib/store"
import { usuarioActivo } from "@/lib/profile-context"
import { fechaNegocio } from "@/lib/ipc-cuotas"
import { CLAVE_VIENEN_A_PAGAR, cargarResumenVienenAPagar } from "@/components/vienen-a-pagar-modal"
import {
  PERFILES_AVISO_SEMANAL,
  claveAvisoVisto,
  debeAbrirAviso,
  eventosParaFinalizar,
  eventosProximoFinde,
  findeAnterior,
  ingresosDeLaSemana,
  lunesDeLaSemana,
  proximoFinde,
  puedeEliminarDesdeAviso,
} from "@/lib/aviso-semanal"

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR")
}

function dia(fecha: string, conAnio = false): string {
  return new Date(fecha + "T12:00:00Z").toLocaleDateString("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
    ...(conAnio ? { year: "numeric" } : {}),
  })
}

/**
 * Estado del aviso para Inicio: si le toca a este perfil, cuántos eventos
 * faltan finalizar y si hay que abrir la ventana sola.
 */
export function useAvisoSemanal(perfilId: string | undefined) {
  const { eventos } = useStore()
  const aplica = !!perfilId && PERFILES_AVISO_SEMANAL.includes(perfilId)
  const hoy = fechaNegocio()
  const pendientes = aplica ? eventosParaFinalizar(eventos || [], hoy) : []

  const [abierto, setAbierto] = useState(false)
  const clave = perfilId ? claveAvisoVisto(perfilId, usuarioActivo()) : ""
  useEffect(() => {
    if (!aplica) return
    let visto: string | null = null
    try {
      visto = localStorage.getItem(clave)
    } catch {
      // Sin almacenamiento: se abre igual, una vez por carga de Inicio.
    }
    if (debeAbrirAviso(perfilId, visto, hoy)) setAbierto(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplica, clave])

  const cerrar = () => {
    setAbierto(false)
    try {
      localStorage.setItem(clave, lunesDeLaSemana(hoy))
    } catch {
      // Sin almacenamiento: no se recuerda que se vio.
    }
  }

  return { aplica, cantidadPendientes: pendientes.length, abierto, cerrar }
}

/** El contenido del aviso: lo usa la ventana y la sección de Novedades. */
export function AvisoSemanalContenido({ onIr }: { onIr?: () => void }) {
  const { eventos, updateEvento, deleteEvento } = useStore()
  const hoy = fechaNegocio()
  const anterior = findeAnterior(hoy)
  const proximo = proximoFinde(hoy)
  // Los del finde anterior: los pendientes y los que se finalizaron desde
  // esta ventana (para que se vea el "Finalizado" en vez de desaparecer).
  const [finalizados, setFinalizados] = useState<Set<string>>(new Set())
  const [finalizando, setFinalizando] = useState<string | null>(null)
  // Los que se mandaron a la papelera desde acá, con su nombre para seguir
  // mostrándolos ("Eliminado") aunque ya no estén en el store.
  const [eliminados, setEliminados] = useState<Array<{ id: string; nombre: string; fecha?: string; salon?: string }>>([])
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pendientes = eventosParaFinalizar(eventos || [], hoy)
  const recienFinalizados = (eventos || []).filter((e) => finalizados.has(e.id) && !pendientes.some((p) => p.id === e.id))
  const delFinde = [...pendientes, ...recienFinalizados].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))
  const siguientes = eventosProximoFinde(eventos || [], hoy)

  const { data: resumen, error: errorIngresos } = useSWR(CLAVE_VIENEN_A_PAGAR, cargarResumenVienenAPagar)
  const ingresos = resumen ? ingresosDeLaSemana(resumen.vienenAPagar) : null

  // Mismo camino que "Finalizar" de la Lista de eventos: el store congela los
  // costos al pasar a "completado".
  const finalizar = async (id: string) => {
    setFinalizando(id)
    setError(null)
    const ok = await updateEvento(id, { estado: "completado" })
    setFinalizando(null)
    if (ok) setFinalizados((prev) => new Set(prev).add(id))
    else setError("No se pudo finalizar. Probá de nuevo o hacelo desde la Lista de eventos.")
  }

  // Mismo camino que "Eliminar" de la Lista: va a la papelera (se puede
  // restaurar) y deja de figurar en Cobrar cuota y en "Vienen a pagar".
  const eliminar = async (evento: (typeof pendientes)[number]) => {
    setEliminando(evento.id)
    setError(null)
    const ok = await deleteEvento(evento.id)
    setEliminando(null)
    setConfirmandoEliminar(null)
    if (ok) {
      setEliminados((prev) => [...prev, { id: evento.id, nombre: evento.nombre || evento.nombrePareja || "Sin nombre", fecha: evento.fecha, salon: evento.salon }])
    } else {
      setError("No se pudo eliminar. Probá de nuevo o hacelo desde la Lista de eventos.")
    }
  }

  return (
    <div className="flex flex-col gap-4 text-foreground">
      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <CalendarCheck className="size-4 text-[#2d5a3d]" />
          Eventos del finde pasado ({dia(anterior.desde)} al {dia(anterior.hasta)})
        </h3>
        {delFinde.length === 0 && eliminados.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quedan eventos del finde pasado por cerrar.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {delFinde.map((evento) => {
              const nombre = evento.nombre || evento.nombrePareja || "Sin nombre"
              const listo = finalizados.has(evento.id) && !pendientes.some((p) => p.id === evento.id)
              return (
                <li key={evento.id} className="rounded-lg border bg-card p-3 text-card-foreground">
                  <p className="text-sm font-semibold">¿Cómo estuvo el evento de {nombre}?</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs capitalize text-muted-foreground">
                    <span>{evento.fecha ? dia(evento.fecha) : "Sin fecha"}</span>
                    <span className="inline-flex items-center gap-1 normal-case"><SalonDot salon={evento.salon} />{salonLabel(evento.salon)}</span>
                  </p>
                  {listo ? (
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[#2d5a3d]">
                      <Check className="size-4" />Finalizado
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-col gap-2">
                      <p className="text-sm text-muted-foreground">¿Querés marcarlo como finalizado? Si no se hizo, lo podés eliminar.</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="bg-[#2d5a3d] text-[#f5f0e8] hover:bg-[#3a6f4e]"
                          disabled={finalizando !== null || eliminando !== null}
                          onClick={() => finalizar(evento.id)}
                        >
                          {finalizando === evento.id ? <Loader2 className="animate-spin" /> : <Check />}
                          Sí, finalizar
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/eventos/lista?evento=${encodeURIComponent(evento.id)}`} prefetch={false} onClick={onIr}>Ver evento</Link>
                        </Button>
                        {puedeEliminarDesdeAviso(evento) && confirmandoEliminar !== evento.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={finalizando !== null || eliminando !== null}
                            onClick={() => setConfirmandoEliminar(evento.id)}
                          >
                            <Trash2 />
                            No se hizo, eliminar
                          </Button>
                        )}
                      </div>
                      {confirmandoEliminar === evento.id && (
                        <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                          <p className="text-sm">
                            ¿Eliminar el evento de {nombre}? Va a la papelera (se puede restaurar) y deja de figurar en Cobrar cuota.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="destructive" disabled={eliminando !== null} onClick={() => eliminar(evento)}>
                              {eliminando === evento.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                              Sí, eliminar
                            </Button>
                            <Button size="sm" variant="outline" disabled={eliminando !== null} onClick={() => setConfirmandoEliminar(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                      {!puedeEliminarDesdeAviso(evento) && (
                        <p className="text-xs text-muted-foreground">Si no se hizo, eliminalo desde la Lista: ahí elegís si se devuelve el stock.</p>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
            {eliminados.map((evento) => (
              <li key={evento.id} className="rounded-lg border bg-card p-3 text-card-foreground">
                <p className="text-sm font-semibold">{evento.nombre}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs capitalize text-muted-foreground">
                  <span>{evento.fecha ? dia(evento.fecha) : "Sin fecha"}</span>
                  <span className="inline-flex items-center gap-1 normal-case"><SalonDot salon={evento.salon} />{salonLabel(evento.salon)}</span>
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <Trash2 className="size-4" />Eliminado (está en la papelera)
                </p>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <HandCoins className="size-4 text-[#2d5a3d]" />
          Ingresos que vienen esta semana
        </h3>
        {ingresos ? (
          <>
            <p className="text-sm">
              {ingresos.cantidad === 0
                ? "No vence ninguna cuota esta semana."
                : <>{ingresos.cantidad} {ingresos.cantidad === 1 ? "cuota" : "cuotas"} por <strong className="tabular-nums">{fmt(ingresos.total)}</strong>{ingresos.aDefinir > 0 && <> ({ingresos.aDefinir} con IPC a definir)</>}.</>}
            </p>
            {ingresos.cantidadAtrasada > 0 && (
              <p className="text-sm text-destructive">
                Además hay {ingresos.cantidadAtrasada} {ingresos.cantidadAtrasada === 1 ? "cuota atrasada" : "cuotas atrasadas"} por <span className="tabular-nums">{fmt(ingresos.totalAtrasado)}</span>.
              </p>
            )}
            <p className="text-xs text-muted-foreground">El detalle está en "Vienen a pagar" de Inicio.</p>
          </>
        ) : errorIngresos ? (
          <p className="text-sm text-muted-foreground">No se pudieron cargar las cuotas. Miralas en "Vienen a pagar".</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando…</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <PartyPopper className="size-4 text-[#2d5a3d]" />
          Próximo finde ({dia(proximo.desde)} al {dia(proximo.hasta)})
        </h3>
        {siguientes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay eventos el próximo finde.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {siguientes.map((evento) => (
              <li key={evento.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                <span className="font-semibold">{evento.nombre || evento.nombrePareja || "Sin nombre"}</span>
                <span className="inline-flex items-center gap-1 capitalize text-muted-foreground"><CalendarDays className="size-3.5" />{evento.fecha ? dia(evento.fecha) : "Sin fecha"}</span>
                <span className="inline-flex items-center gap-1 text-muted-foreground"><SalonDot salon={evento.salon} />{salonLabel(evento.salon)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** La ventana que se abre sola el lunes (o el primer día que se entra en la semana). */
export function AvisoSemanalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Aviso de la semana"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-[#f5f0e8] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 bg-[#2d5a3d] px-5 py-4 text-[#f5f0e8]">
          <div>
            <h2 className="text-lg font-bold">Aviso de la semana</h2>
            <p className="text-xs opacity-90">Cerremos el finde y miremos la semana. Si lo dejás para después, queda en Novedades.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <AvisoSemanalContenido onIr={onClose} />
        </div>
      </div>
    </div>
  )
}

"use client"

// Cronograma de la noche de un evento: hora, momento y a quién le toca.
// - Para leer (staff): cada uno ve resaltadas sus líneas.
// - Para editar (Administración en Cobrar cuota, Coordinación en su
//   calendario): agregar, cambiar, sacar, o arrancar del sugerido según el
//   tipo de evento. Se guarda por /api/eventos/[id]/cronograma, que es la que
//   controla quién puede (lib/staff-evento.ts).

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Clock, ListOrdered, Plus, Trash2, Wand2 } from "lucide-react"
import {
  PERFILES_STAFF,
  NOMBRE_PERFIL_STAFF,
  cronogramaSugerido,
  esMomentoDelPerfil,
  normalizarCronograma,
  type MomentoCronograma,
  type PerfilStaff,
} from "@/lib/staff-evento"

interface Props {
  eventoId: string
  tipoEvento?: string | null
  horario?: string | null
  cronograma?: MomentoCronograma[] | null
  /** Perfil que mira: se le resaltan sus líneas. */
  perfilId?: string | null
  editable?: boolean
  onGuardado?: (cronograma: MomentoCronograma[]) => void
}

const nuevoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 12)

function igual(a: MomentoCronograma[], b: MomentoCronograma[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function CronogramaEvento({ eventoId, tipoEvento, horario, cronograma, perfilId, editable, onGuardado }: Props) {
  const { toast } = useToast()
  const guardado = cronograma ?? []
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState<MomentoCronograma[]>(guardado)
  const [guardando, setGuardando] = useState(false)

  // Al cambiar de evento (o si llega una versión nueva y no se está editando)
  useEffect(() => {
    if (!editando) setBorrador(cronograma ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId, JSON.stringify(cronograma ?? [])])

  const cambiar = (id: string, cambios: Partial<MomentoCronograma>) =>
    setBorrador((lista) => lista.map((m) => (m.id === id ? { ...m, ...cambios } : m)))

  const alternarPerfil = (id: string, perfil: PerfilStaff) =>
    setBorrador((lista) =>
      lista.map((m) =>
        m.id !== id
          ? m
          : { ...m, perfiles: m.perfiles.includes(perfil) ? m.perfiles.filter((p) => p !== perfil) : [...m.perfiles, perfil] },
      ),
    )

  const guardar = async () => {
    if (guardando) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/eventos/${encodeURIComponent(eventoId)}/cronograma`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cronograma: borrador }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "No se pudo guardar el cronograma")
      const final = normalizarCronograma(json.cronograma, horario)
      setBorrador(final)
      setEditando(false)
      onGuardado?.(final)
      toast({ title: "Cronograma guardado" })
    } catch (err) {
      toast({ title: "No se guardó", description: err instanceof Error ? err.message : "Volvé a intentar.", variant: "destructive" })
    } finally {
      setGuardando(false)
    }
  }

  // ---- Lectura ----
  if (!editando) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold">
            <ListOrdered className="h-4 w-4 text-muted-foreground" />
            Cronograma de la noche
          </h4>
          {editable && (
            <Button type="button" size="sm" variant="outline" className="h-7 bg-transparent text-xs" onClick={() => setEditando(true)}>
              {guardado.length ? "Editar" : "Armar"}
            </Button>
          )}
        </div>
        {guardado.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay cronograma cargado.</p>
        ) : (
          <ol className="space-y-1">
            {guardado.map((m) => {
              const mio = esMomentoDelPerfil(m, perfilId)
              return (
                <li
                  key={m.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-1.5 text-sm",
                    mio ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border",
                  )}
                >
                  <span className="w-11 shrink-0 tabular-nums">{m.hora}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{m.momento}</span>
                    {m.perfiles.length > 0 && (
                      <span className={cn("block text-xs font-normal", mio ? "text-primary/80" : "text-muted-foreground")}>
                        {m.perfiles.map((p) => NOMBRE_PERFIL_STAFF[p]).join(" · ")}
                      </span>
                    )}
                    {m.nota && <span className="block text-xs font-normal text-muted-foreground">{m.nota}</span>}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    )
  }

  // ---- Edición ----
  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold">
        <ListOrdered className="h-4 w-4 text-muted-foreground" />
        Cronograma de la noche
      </h4>
      {borrador.length === 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full bg-transparent"
          onClick={() => setBorrador(cronogramaSugerido(tipoEvento, horario, nuevoId))}
        >
          <Wand2 className="mr-1.5 h-4 w-4" />
          Usar el cronograma sugerido para {tipoEvento || "el evento"}
        </Button>
      )}
      {borrador.map((m) => (
        <div key={m.id} className="space-y-1.5 rounded-lg border p-2">
          <div className="flex items-center gap-2">
            <div className="relative w-[6.5rem] shrink-0">
              <Clock className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="time"
                value={m.hora}
                onChange={(e) => cambiar(m.id, { hora: e.target.value })}
                className="h-9 pl-7 text-sm"
                aria-label="Hora"
              />
            </div>
            <Input
              value={m.momento}
              onChange={(e) => cambiar(m.id, { momento: e.target.value })}
              placeholder="Qué pasa (ej. Vals)"
              className="h-9 min-w-0 flex-1 text-sm"
              aria-label="Momento"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Sacar este momento"
              onClick={() => setBorrador((lista) => lista.filter((x) => x.id !== m.id))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {PERFILES_STAFF.map((p) => {
              const activo = m.perfiles.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => alternarPerfil(m.id, p)}
                  aria-pressed={activo}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs transition-colors",
                    activo ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {NOMBRE_PERFIL_STAFF[p]}
                </button>
              )
            })}
          </div>
          <Input
            value={m.nota ?? ""}
            onChange={(e) => cambiar(m.id, { nota: e.target.value })}
            placeholder="Aclaración (opcional)"
            className="h-8 text-xs"
            aria-label="Aclaración"
          />
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() => {
          const ultima = borrador[borrador.length - 1]?.hora || horario || "21:00"
          setBorrador((lista) => [...lista, { id: nuevoId(), hora: ultima, momento: "", perfiles: [] }])
        }}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Agregar momento
      </Button>
      <p className="text-[11px] text-muted-foreground">Al guardar se ordena solo por hora. Las líneas sin hora o sin texto no se guardan.</p>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="bg-transparent"
          disabled={guardando}
          onClick={() => {
            setBorrador(guardado)
            setEditando(false)
          }}
        >
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={guardando || igual(borrador, guardado)} onClick={guardar}>
          {guardando ? "Guardando..." : "Guardar cronograma"}
        </Button>
      </div>
    </div>
  )
}

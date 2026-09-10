"use client"

import { useId, useMemo, useState } from "react"
import { Calendar, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { salonLabel, type EventoGuardado } from "@/lib/store"
import { obtenerAgendaPersonal } from "@/lib/agenda-personal"

export function PersonalAgenda({ personalId, nombre, eventos }: {
  personalId: string
  nombre: string
  eventos: EventoGuardado[]
}) {
  const [abierto, setAbierto] = useState(false)
  const regionId = useId()
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date())
  const agenda = useMemo(() => abierto ? obtenerAgendaPersonal(eventos, personalId, hoy) : [], [abierto, eventos, personalId, hoy])

  return (
    <div className="py-1">
      <Button type="button" variant="outline" size="sm" aria-expanded={abierto} aria-controls={regionId}
        aria-label={`${abierto ? "Ocultar" : "Ver"} eventos de ${nombre}`} onClick={() => setAbierto(!abierto)}>
        <Calendar data-icon="inline-start" />
        {abierto ? "Ocultar eventos" : "Ver eventos"}
        {abierto ? <ChevronUp data-icon="inline-end" /> : <ChevronDown data-icon="inline-end" />}
      </Button>
      <div id={regionId} hidden={!abierto} role="region" aria-label={`Eventos de ${nombre}`}>
        {abierto && (
          <div className="pt-2">
            {agenda.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin eventos asignados.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto rounded-md border border-border bg-background text-foreground divide-y divide-border">
                {agenda.map((evento) => {
                  const anterior = evento.fecha < hoy || evento.estado === "completado"
                  return (
                    <li key={evento.id} className="px-3 py-2 text-sm leading-6">
                      <p className="font-medium break-words">{evento.nombre || evento.nombrePareja || "Evento sin nombre"}</p>
                      <p className="text-muted-foreground">
                        <time dateTime={evento.fecha}>{new Date(`${evento.fecha}T12:00:00`).toLocaleDateString("es-AR")}</time>
                        {" · "}{salonLabel(evento.salon)}
                      </p>
                      <p className="text-muted-foreground">{anterior ? "Anterior / finalizado" : evento.fecha === hoy ? "Hoy" : "Próximo"}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

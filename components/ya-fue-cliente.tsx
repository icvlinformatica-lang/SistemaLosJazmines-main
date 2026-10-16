"use client"

// Aviso "Ya hizo un evento con ustedes" cuando el DNI o el teléfono cargados
// coinciden con otro evento. Lo ven solo Administración y Soporte (la ruta
// /api/eventos/cliente-previo lo controla): muestra datos de otro evento.

import { useEffect, useState } from "react"
import { History } from "lucide-react"
import { salonLabel } from "@/lib/store"
import { fechaEventoCorta } from "@/lib/fecha-evento"
import { claveDni, claveTelefono, type EventoDelCliente } from "@/lib/origen-cliente"

interface Props {
  dni?: string | null
  telefono?: string | null
  /** El evento que se está editando: no cuenta como "otro". */
  excluirId?: string | null
}

export function YaFueCliente({ dni, telefono, excluirId }: Props) {
  const [eventos, setEventos] = useState<EventoDelCliente[]>([])
  const kDni = claveDni(dni)
  const kTel = claveTelefono(telefono)

  useEffect(() => {
    if (!kDni && !kTel) {
      setEventos([])
      return
    }
    let cancelado = false
    // Espera a que se termine de escribir antes de buscar.
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams()
        if (kDni) qs.set("dni", kDni)
        if (kTel) qs.set("telefono", kTel)
        if (excluirId) qs.set("excluir", excluirId)
        const res = await fetch(`/api/eventos/cliente-previo?${qs}`)
        const data = await res.json().catch(() => null)
        if (!cancelado) setEventos(res.ok && data?.ok ? data.eventos : [])
      } catch {
        if (!cancelado) setEventos([])
      }
    }, 500)
    return () => {
      cancelado = true
      clearTimeout(t)
    }
  }, [kDni, kTel, excluirId])

  if (eventos.length === 0) return null
  return (
    <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900" role="status">
      <History className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold">Ya hizo {eventos.length === 1 ? "un evento" : `${eventos.length} eventos`} con ustedes</p>
        <ul className="text-xs">
          {eventos.slice(0, 5).map((e) => (
            <li key={e.id}>
              {[e.tipoEvento, e.fecha ? fechaEventoCorta(e.fecha) : "", e.salon ? salonLabel(e.salon) : ""].filter(Boolean).join(", ")}
              {" · "}
              {e.nombre}
              {e.coincide === "telefono" ? " (mismo teléfono)" : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

"use client"

import { use } from "react"
import { useStore } from "@/lib/store-context"
import { AsignacionesContent } from "./asignaciones-content"

export default function AsignacionesPage({
  params,
}: {
  params: Promise<{ eventoId: string }>
}) {
  const { eventoId } = use(params)
  const { eventos } = useStore()
  const evento = eventos.find((e) => e.id === eventoId)

  if (!evento) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-lg font-medium text-foreground">Evento no encontrado</p>
          <p className="text-sm text-muted-foreground">
            {"El evento solicitado no existe o fue eliminado."}
          </p>
        </div>
      </div>
    )
  }

  return <AsignacionesContent evento={evento} />
}

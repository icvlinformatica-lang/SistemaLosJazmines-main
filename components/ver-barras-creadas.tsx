"use client"

// Botón "Ver barras" de Cócteles (pedido de Rodrigo, 10/11/2026): muestra las
// barras armadas que ya se crearon (barra_templates), con sus cócteles. Antes
// desde Cócteles solo se podía crear una barra; la lista estaba únicamente en
// Cotizaciones > Configuración > Barras, que es donde se siguen editando,
// borrando y eligiendo por salón.
//
// Solo pantalla: lee lo que ya está en el store y no guarda nada. El costo
// por adulto es la misma cuenta de "Crear barra" (1 trago de cada cóctel,
// lib/precio-barra-cotizador.ts, sin ganancia) y solo lo ve quien ve costos.

import { useMemo, useState } from "react"
import { GlassWater } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useStore } from "@/lib/store-context"
import { formatCurrency } from "@/lib/store"
import { costoPorTrago } from "@/lib/precio-barra"
import { filasBarrasCreadas } from "@/lib/barras-creadas"

export function BotonVerBarras({ veCostos }: { veCostos: boolean }) {
  const { state } = useStore()
  const [abierto, setAbierto] = useState(false)

  const filas = useMemo(() => {
    const costos = veCostos
      ? Object.fromEntries(state.cocteles.map((c) => [c.id, costoPorTrago(c, state.insumosBarra)]))
      : {}
    return filasBarrasCreadas(state.barrasTemplates || [], state.cocteles, costos)
  }, [state.barrasTemplates, state.cocteles, state.insumosBarra, veCostos])

  return (
    <>
      <Button variant="outline" onClick={() => setAbierto(true)}>
        <GlassWater className="mr-2 h-4 w-4" />
        Ver barras
        <Badge variant="secondary" className="ml-2 tabular-nums">
          {filas.length}
        </Badge>
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-2xl w-11/12 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Barras creadas</DialogTitle>
            <DialogDescription>
              Cada barra es un paquete de cócteles. Se editan, se borran y se elige en qué salón aparecen en
              Cotizaciones &gt; Configuración &gt; Barras.
            </DialogDescription>
          </DialogHeader>
          {filas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay barras creadas.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {filas.map((f) => (
                <li key={f.id} className="space-y-1.5 px-3 py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="font-medium">{f.nombre}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {f.cocteles.length} {f.cocteles.length === 1 ? "cóctel" : "cócteles"}
                      {veCostos && (
                        <>
                          {" · costo "}
                          <span className="font-semibold text-foreground">{formatCurrency(f.costoPorAdulto)}</span>
                          {" por adulto"}
                        </>
                      )}
                    </p>
                  </div>
                  {f.cocteles.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {f.cocteles.map((c) => (
                        <Badge key={c.id} variant="outline" className="font-normal">
                          {c.nombre}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700">Sus cócteles ya no están en la carta.</p>
                  )}
                  {f.borrados > 0 && f.cocteles.length > 0 && (
                    <p className="text-xs text-amber-700">
                      {f.borrados === 1 ? "1 cóctel ya no está" : `${f.borrados} cócteles ya no están`} en la carta (no
                      suma).
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

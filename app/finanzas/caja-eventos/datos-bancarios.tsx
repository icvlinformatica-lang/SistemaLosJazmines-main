"use client"

// Banco, CBU y alias de la persona a la que se le paga un sueldo desde Caja
// Eventos, con botón "Copiar" para la transferencia. Solo muestra lo que ya
// está cargado en Finanzas → Personal (cuentaBancaria); no guarda nada.

import { Copy, Landmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { datosBancarios } from "@/lib/buscador-caja-eventos"
import type { PersonalEvento } from "@/lib/store"

export function DatosBancariosPersona({ persona }: { persona: PersonalEvento | null }) {
  const { toast } = useToast()
  const datos = datosBancarios(persona)

  async function copiar(valor: string, que: "CBU" | "Alias") {
    try {
      await navigator.clipboard.writeText(valor)
      toast({ title: que === "CBU" ? "CBU copiado" : "Alias copiado", description: valor })
    } catch {
      // Algunos navegadores bloquean el portapapeles (sin HTTPS o sin permiso).
      toast({ title: "No se pudo copiar", description: "Copialo a mano: " + valor, variant: "destructive" })
    }
  }

  if (!datos) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Landmark className="h-3.5 w-3.5 shrink-0" />
        Sin CBU cargado
      </div>
    )
  }

  return (
    <div className="space-y-1.5 rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Landmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {persona ? `${persona.nombre} ${persona.apellido ?? ""}`.trim() : "Datos bancarios"}
        {datos.banco && <span className="font-normal text-muted-foreground">· {datos.banco}</span>}
      </p>
      {(
        [
          { que: "CBU" as const, valor: datos.cbu },
          { que: "Alias" as const, valor: datos.alias },
        ]
      ).map(({ que, valor }) => (
        <div key={que} className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-[11px] text-muted-foreground">{que}</span>
          {valor ? (
            <>
              <span className="min-w-0 flex-1 break-all font-mono text-xs">{valor}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1 px-2 text-xs bg-transparent"
                onClick={() => copiar(valor, que)}
                aria-label={`Copiar ${que}`}
              >
                <Copy className="h-3 w-3" /> Copiar
              </Button>
            </>
          ) : (
            <span className="flex-1 text-xs text-muted-foreground">Sin {que === "CBU" ? "CBU" : "alias"} cargado</span>
          )}
        </div>
      ))}
    </div>
  )
}

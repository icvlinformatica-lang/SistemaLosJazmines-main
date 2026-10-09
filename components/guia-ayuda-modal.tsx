"use client"

// Guía de uso del sistema, para leer. Se abre con el botón "?" de Inicio.
// Muestra el mismo texto que usa el chat de ayuda (lib/guia-sistema.ts), así
// hay una sola guía para mantener. Las rutas entre paréntesis ("/eventos/lista")
// se sacan porque a quien lee no le sirven.
import { Fragment, type ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GUIA_SISTEMA } from "@/lib/guia-sistema"

/** Pasa "**negrita**" a <strong>; el resto queda como texto. */
function conNegritas(texto: string): ReactNode {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith("**") && parte.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {parte.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{parte}</Fragment>
    ),
  )
}

function sinRutas(linea: string): string {
  return linea.replace(/ ?\(\/[^)]*\)/g, "")
}

/** Arma los bloques de la guía: títulos "## ", ítems "- " y párrafos. */
function bloquesGuia(): ReactNode[] {
  const bloques: ReactNode[] = []
  let items: string[] = []
  const cerrarLista = () => {
    if (items.length === 0) return
    bloques.push(
      <ul key={`ul-${bloques.length}`} className="list-disc space-y-1.5 pl-5">
        {items.map((it, i) => (
          <li key={i}>{conNegritas(it)}</li>
        ))}
      </ul>,
    )
    items = []
  }
  for (const cruda of GUIA_SISTEMA.split("\n")) {
    const linea = sinRutas(cruda.trim())
    if (!linea || linea.startsWith("# ")) {
      // El título "# …" ya está en el encabezado del diálogo.
      cerrarLista()
      continue
    }
    if (linea.startsWith("## ")) {
      cerrarLista()
      bloques.push(
        <h3 key={`h-${bloques.length}`} className="pt-3 text-base font-semibold text-foreground">
          {linea.slice(3)}
        </h3>,
      )
    } else if (linea.startsWith("- ")) {
      items.push(linea.slice(2))
    } else {
      cerrarLista()
      bloques.push(<p key={`p-${bloques.length}`}>{conNegritas(linea)}</p>)
    }
  }
  cerrarLista()
  return bloques
}

export function GuiaAyudaModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Guía de uso del sistema</DialogTitle>
          <DialogDescription>Qué hay en cada pantalla y cómo se hacen las cosas más comunes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{bloquesGuia()}</div>
      </DialogContent>
    </Dialog>
  )
}

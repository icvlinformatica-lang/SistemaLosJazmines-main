"use client"

import { useState } from "react"
import { Printer, ChevronDown, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Tarjeta reutilizable de vista previa de un contrato.
 *
 * - Muestra el HTML del contrato dentro de un iframe escalado para que la
 *   hoja A4 entre en columnas angostas.
 * - Boton chico de imprimir arriba a la derecha (abre ventana + print()).
 * - Con `plegada` se renderiza como <details> cerrado y el iframe se monta
 *   recien al abrir (lazy), para no generar el preview de todas las
 *   versiones de entrada.
 */
export function ContratoPreviewCard({
  titulo,
  subtitulo,
  html,
  plegada = false,
  alturaPreview = 420,
  acento = "#2d5a3d",
}: {
  titulo: string
  subtitulo?: string
  /** HTML completo del contrato, o una funcion que lo genera al necesitarlo (lazy). */
  html: string | (() => string)
  plegada?: boolean
  /** Altura visible del preview en px. */
  alturaPreview?: number
  /** Color de acento del encabezado. */
  acento?: string
}) {
  const [abierta, setAbierta] = useState(!plegada)
  // El HTML se resuelve recien cuando la tarjeta esta abierta (lazy)
  const [htmlResuelto, setHtmlResuelto] = useState<string | null>(
    !plegada ? (typeof html === "string" ? html : html()) : null,
  )

  const resolverHtml = () => (typeof html === "string" ? html : html())

  const imprimir = () => {
    const contenido = htmlResuelto ?? resolverHtml()
    const win = window.open("", "_blank")
    if (win) {
      win.document.write(contenido)
      win.document.close()
      win.focus()
      setTimeout(() => {
        win.print()
      }, 600)
    }
  }

  const toggle = () => {
    const siguiente = !abierta
    setAbierta(siguiente)
    if (siguiente && htmlResuelto === null) setHtmlResuelto(resolverHtml())
  }

  // Si el HTML llega como string y cambio (preview en vivo), reflejarlo
  if (typeof html === "string" && abierta && htmlResuelto !== html) {
    setHtmlResuelto(html)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: `color-mix(in srgb, ${acento} 8%, white)` }}
      >
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={abierta}
          aria-label={`${abierta ? "Plegar" : "Desplegar"} ${titulo}`}
        >
          <FileText className="h-4 w-4 shrink-0" style={{ color: acento }} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold" style={{ color: `color-mix(in srgb, ${acento} 80%, black)` }}>
              {titulo}
            </span>
            {subtitulo && <span className="block truncate text-xs text-muted-foreground">{subtitulo}</span>}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierta ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1 bg-white px-2 text-xs"
          onClick={imprimir}
          title={`Imprimir ${titulo}`}
        >
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
          Imprimir
        </Button>
      </div>

      {abierta && htmlResuelto !== null && (
        <div className="overflow-y-auto border-t border-border bg-muted/30" style={{ height: alturaPreview }}>
          {/* Hoja A4 (~880px de ancho util) escalada al ancho de la columna;
              el contenedor scrollea sobre la altura ya escalada */}
          <div className="relative mx-auto overflow-hidden" style={{ width: 880 * 0.36, height: 4200 * 0.36 }}>
            <iframe
              srcDoc={htmlResuelto}
              title={`Vista previa de ${titulo}`}
              className="pointer-events-none origin-top-left border-0"
              style={{ width: "880px", height: "4200px", transform: "scale(0.36)" }}
              sandbox=""
              scrolling="no"
            />
          </div>
        </div>
      )}
    </div>
  )
}

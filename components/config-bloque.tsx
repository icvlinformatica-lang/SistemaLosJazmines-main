"use client"

// Piezas chicas compartidas por Cotizaciones > Configuración: el bloque
// plegable, el campo de precio, el de porcentaje y el aviso de "sin costo".
// Las usan TarifarioEditor (configuración anterior) y CotizadorSalonEditor.

import { useState } from "react"
import { AlertTriangle, ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

/**
 * Input de precio que muestra "$ 3.500.000" cuando está en reposo y el número
 * pelado apenas se lo enfoca. Formatear mientras se tipea pelea con el cursor
 * (se va al final en cada tecla), así que se formatea solo al salir.
 */
export function InputPrecio({
  valor,
  onChange,
  etiqueta,
  placeholder = "$ 0",
  className = "",
}: {
  valor: number | null
  onChange: (n: number | null) => void
  etiqueta: string
  placeholder?: string
  className?: string
}) {
  const [enFoco, setEnFoco] = useState(false)
  const [borrador, setBorrador] = useState("")
  const v = valor ?? 0

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={etiqueta}
      value={enFoco ? borrador : valor != null && v > 0 ? fmt(v) : ""}
      placeholder={placeholder}
      onFocus={() => {
        setBorrador(valor != null && v > 0 ? String(v) : "")
        setEnFoco(true)
      }}
      onChange={(e) => {
        const limpio = e.target.value.replace(/[^\d]/g, "")
        setBorrador(limpio)
        onChange(limpio === "" ? null : Number(limpio))
      }}
      onBlur={() => setEnFoco(false)}
      className={`h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-right text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#2d5a3d]/40 focus:border-[#2d5a3d] ${className}`}
    />
  )
}

/** Porcentaje de ganancia, guardado y editado como porcentaje (50 = 50 %). */
export function InputGanancia({
  valor,
  onChange,
  etiqueta,
  mostrarEtiqueta = true,
}: {
  valor: number
  onChange: (n: number) => void
  etiqueta: string
  mostrarEtiqueta?: boolean
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      {mostrarEtiqueta && <span className="font-medium">{etiqueta}</span>}
      <span className="inline-flex items-center rounded-lg border border-input bg-background pr-2 focus-within:ring-2 focus-within:ring-[#2d5a3d]/40">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={1000}
          step={1}
          aria-label={etiqueta}
          value={Number.isFinite(valor) ? valor : ""}
          onChange={(e) => {
            const pct = Number(e.target.value)
            onChange(Number.isFinite(pct) && pct >= 0 ? pct : 0)
          }}
          className="h-9 w-16 bg-transparent px-2 text-right tabular-nums outline-none"
        />
        <span className="text-muted-foreground">%</span>
      </span>
    </label>
  )
}

/** Aviso ámbar para un rubro (o un ítem) que va a cotizar $0. */
export function AvisoSinCosto({ texto = "Sin costo cargado: va a cotizar $0" }: { texto?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {texto}
    </span>
  )
}

export function Bloque({
  icon,
  title,
  subtitle,
  resumen,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  /** Se ve a la derecha del título aunque el bloque esté plegado. */
  resumen?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
          <div className="shrink-0">{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            {resumen && <div className="mt-1">{resumen}</div>}
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

"use client"

// Campo "¿Cuánto trae cada unidad?", compartido por Almacén, Barra y el
// diálogo de Costos a revisar.
//
// Se guarda siempre en gramos o cc (es lo que espera normalizeToStockUnit),
// pero se puede ESCRIBIR en litros o kilos, que es como se habla: una botella
// es "de 2 litros", no "de 2000 cc". La conversión la hace este componente.

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { contenidoABase, contenidoDesdeBase } from "@/lib/diagnostico-costos"

/** Lo que se guarda en la base. */
export type UnidadContenido = "GRS" | "CC"
/** Lo que se puede escribir en el campo. */
type UnidadEntrada = "GRS" | "KG" | "CC" | "L"

const ETIQUETAS: Record<UnidadEntrada, string> = {
  GRS: "gramos",
  KG: "kilos",
  CC: "cc",
  L: "litros",
}

// La conversión vive en lib/diagnostico-costos.ts para poder probarla.
const aBase = contenidoABase
const desdeBase = contenidoDesdeBase

export function ContenidoPorUnidadInput({
  cantidad,
  unidad,
  onChange,
  autoFocus,
  className,
}: {
  /** Valor guardado, en gramos o cc. 0 = sin cargar. */
  cantidad: number
  unidad: UnidadContenido
  onChange: (valor: { cantidad: number; unidad: UnidadContenido }) => void
  autoFocus?: boolean
  className?: string
}) {
  // Estado propio para poder escribir "2 litros" sin que el valor guardado
  // (2000 cc) pise lo que se está tipeando.
  const inicial = cantidad > 0 ? desdeBase(cantidad, unidad) : { cantidad: 0, unidad }
  const [texto, setTexto] = useState(inicial.cantidad > 0 ? String(inicial.cantidad) : "")
  const [unidadEntrada, setUnidadEntrada] = useState<UnidadEntrada>(inicial.unidad)

  // Si el valor cambia desde afuera (ej. se guardó y la lista se recargó),
  // el campo acompaña.
  useEffect(() => {
    const v = cantidad > 0 ? desdeBase(cantidad, unidad) : { cantidad: 0, unidad }
    setTexto(v.cantidad > 0 ? String(v.cantidad) : "")
    setUnidadEntrada(v.unidad)
  }, [cantidad, unidad])

  const emitir = (nuevoTexto: string, nuevaUnidad: UnidadEntrada) => {
    const n = Number(nuevoTexto.replace(",", "."))
    onChange(n > 0 ? aBase(n, nuevaUnidad) : { cantidad: 0, unidad: nuevaUnidad === "KG" ? "GRS" : nuevaUnidad === "L" ? "CC" : nuevaUnidad })
  }

  const enBase = Number(texto.replace(",", ".")) > 0 ? aBase(Number(texto.replace(",", ".")), unidadEntrada) : null

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          autoFocus={autoFocus}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            emitir(e.target.value, unidadEntrada)
          }}
          placeholder="Ej: 2"
          className="flex-1"
          aria-label="Cuánto trae cada unidad"
        />
        <Select
          value={unidadEntrada}
          onValueChange={(v) => {
            setUnidadEntrada(v as UnidadEntrada)
            emitir(texto, v as UnidadEntrada)
          }}
        >
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="L">litros</SelectItem>
            <SelectItem value="CC">cc</SelectItem>
            <SelectItem value="KG">kilos</SelectItem>
            <SelectItem value="GRS">gramos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Cuando se escribe en litros o kilos, mostrar en qué se traduce: así
          nadie se sorprende si después lo ve en cc. */}
      {enBase && (unidadEntrada === "L" || unidadEntrada === "KG") && (
        <p className="text-xs text-muted-foreground mt-1">
          Se guarda como {enBase.cantidad.toLocaleString("es-AR")} {enBase.unidad === "GRS" ? "gramos" : "cc"}.
        </p>
      )}
    </div>
  )
}

export { ETIQUETAS as ETIQUETAS_CONTENIDO }

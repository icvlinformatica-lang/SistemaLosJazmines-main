"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"

/**
 * Convierte un número real (ej: 1234.5) al formato visual argentino "1.234,5".
 * Devuelve "" para 0 / NaN para que se muestre el placeholder.
 */
function formatFromNumber(n: number): string {
  if (!n || Number.isNaN(n)) return ""
  const [entero, dec] = String(n).split(".")
  const enteroFmt = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return dec !== undefined ? `${enteroFmt},${dec.slice(0, 2)}` : enteroFmt
}

/**
 * Convierte el string visual "1.234,56" al número real 1234.56.
 */
function parseToNumber(visual: string): number {
  const parseable = visual.replace(/\./g, "").replace(",", ".")
  return Number.parseFloat(parseable) || 0
}

interface MoneyInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  /** Valor numérico real (el que se guarda en el estado/BD). */
  value: number
  /** Se dispara con el valor numérico real ya parseado. */
  onValueChange: (value: number) => void
}

/**
 * Input de moneda: muestra un valor formateado (miles con punto, decimales con coma)
 * mientras mantiene el valor numérico real hacia afuera vía `onValueChange`.
 */
export function MoneyInput({ value, onValueChange, ...props }: MoneyInputProps) {
  // Estado visual: string formateado que ve el usuario.
  const [visual, setVisual] = React.useState<string>(() => formatFromNumber(value))

  // Sincroniza el valor visual cuando el valor numérico cambia desde afuera
  // (ej: al precargar el monto de la cuota o al resetear el formulario),
  // sin pisar lo que el usuario está tipeando si ya representa el mismo número.
  React.useEffect(() => {
    setVisual((prev) => (parseToNumber(prev) === value ? prev : formatFromNumber(value)))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 1. Removemos cualquier caracter que no sea número o coma
    let cruda = e.target.value.replace(/[^0-9,]/g, "")

    // 2. Evitamos múltiples comas
    const partes = cruda.split(",")
    if (partes.length > 2) {
      cruda = partes[0] + "," + partes.slice(1).join("")
    }

    // 3. Separamos parte entera de decimales
    const [entera, decimal] = cruda.split(",")

    // 4. Separador de miles (puntos) en la parte entera
    const enteroFmt = (entera || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".")

    // 5. Reconstruimos el string visual (máximo 2 decimales)
    let resultado = enteroFmt
    if (decimal !== undefined) {
      resultado += "," + decimal.slice(0, 2)
    }

    setVisual(resultado)

    // 6. Valor numérico real para el estado/BD
    onValueChange(parseToNumber(resultado))
  }

  return <Input type="text" inputMode="decimal" value={visual} onChange={handleChange} {...props} />
}

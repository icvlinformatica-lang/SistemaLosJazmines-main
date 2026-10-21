import type { Metadata } from "next"
import { fuenteFiesta } from "./fuente-fiesta"

export const metadata: Metadata = {
  title: "Armá tu fiesta — Los Jazmines",
  description: "Diseñá tu evento a medida y conocé el valor al instante.",
}

export default function ClientesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={fuenteFiesta.variable}>
      {/* Fondo de noche también detrás de la página: al tirar de más (el
          rebote del iPhone) no aparece una franja blanca. */}
      <style>{"html,body{background:#0d1d14}@media print{html,body{background:#fff}}"}</style>
      {children}
    </div>
  )
}

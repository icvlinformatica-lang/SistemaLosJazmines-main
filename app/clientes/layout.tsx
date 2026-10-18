import type { Metadata } from "next"
import { fuenteFiesta } from "./fuente-fiesta"

export const metadata: Metadata = {
  title: "Armá tu fiesta — Los Jazmines",
  description: "Diseñá tu evento a medida y conocé el valor al instante.",
}

export default function ClientesLayout({ children }: { children: React.ReactNode }) {
  return <div className={fuenteFiesta.variable}>{children}</div>
}

"use client"

/**
 * Vista rápida del año de cada gasto fijo, para ver de un vistazo qué meses
 * se pagaron sin abrir cada gasto (pedido del 14/10/2026).
 *
 * - EncabezadoMeses: la fila "Ene Feb Mar …" que va arriba de los gastos de
 *   cada carpeta.
 * - TiraMesesMini: en cada gasto plegado, 12 rayitas alineadas con esa fila:
 *   verde = pagado, amarilla = cargado y se debe, gris = sin cargar.
 *
 * Solo lee: usa la MISMA regla que la tira grande de meses (pagoDelMesActual
 * de lib/pago-gasto-fijo.ts), así que nunca puede mostrar otra cosa. Para
 * pagar o cambiar montos se sigue abriendo el gasto.
 */

import { formatCurrency } from "@/lib/utils-financieros"
import type { CostoOperativo } from "@/lib/store"
import { pagoDelMesActual } from "@/lib/pago-gasto-fijo"

export const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

/**
 * "Columnas invisibles" de Gastos fijos: la fila de meses, cada gasto plegado
 * y la tira grande de un gasto abierto usan EXACTAMENTE estas columnas, así
 * cada mes, el nombre y el monto caen siempre en el mismo lugar:
 * símbolo · nombre · 12 meses · monto y menú.
 * Solo desde pantallas medianas; en el celular cada gasto se acomoda solo.
 */
export const COLUMNAS_FILA_FIJO = "md:grid-cols-[2.25rem_minmax(8rem,13rem)_minmax(0,1fr)_9rem]"

/**
 * Márgenes que alinean las columnas con las de cada gasto: el gasto tiene
 * borde de 1px, 0,75rem de margen y a la derecha la flecha de desplegar
 * (2rem + 0,5rem). La fila de meses y la tira grande usan los mismos.
 */
export const MARGEN_FILA_FIJO = "pl-3 pr-3 md:pr-[3.25rem]"

type EstadoMini = "pagado" | "debe" | "vacio"

function estadoDelMes(
  gasto: CostoOperativo,
  mesISO: string,
  parte?: { salon: string; porcentaje: number },
): { estado: EstadoMini; monto: number } {
  const registro = (gasto.historialMontos || []).find((r) => r.mes === mesISO)
  if (!registro) return { estado: "vacio", monto: 0 }
  const { monto, pagado } = pagoDelMesActual(gasto, parte, mesISO)
  return { estado: pagado ? "pagado" : "debe", monto }
}

const COLOR_RAYITA: Record<EstadoMini, string> = {
  pagado: "bg-emerald-500",
  debe: "bg-amber-400",
  vacio: "bg-muted",
}

/** Fila con los nombres de los meses, alineada con las rayitas de cada gasto. */
export function EncabezadoMeses({ anio, mesHoy }: { anio: number; mesHoy: string }) {
  return (
    // Borde transparente de 1px + los mismos márgenes que cada gasto.
    <div
      className={`hidden md:grid ${COLUMNAS_FILA_FIJO} ${MARGEN_FILA_FIJO} items-end gap-x-3 border border-transparent pb-0.5`}
      aria-hidden="true"
    >
      <span className="col-span-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {`Pagos ${anio}`}
      </span>
      <div className="grid grid-cols-12 gap-1">
        {MESES_CORTOS.map((m, i) => {
          const mesISO = `${anio}-${String(i + 1).padStart(2, "0")}`
          const esHoy = mesISO === mesHoy
          return (
            <span
              key={m}
              className={`text-center text-[10px] font-semibold leading-none ${
                esHoy ? "text-purple-700" : "text-muted-foreground"
              }`}
            >
              {m}
            </span>
          )
        })}
      </div>
      <span />
    </div>
  )
}

/** Las 12 rayitas de un gasto: qué meses del año están pagados. */
export function TiraMesesMini({
  gasto,
  anio,
  mesHoy,
  parte,
}: {
  gasto: CostoOperativo | undefined
  anio: number
  mesHoy: string
  /** Gasto repartido visto desde un salón: estado de la parte de ese salón. */
  parte?: { salon: string; porcentaje: number }
}) {
  if (!gasto) return <span className="hidden md:block" />
  const meses = MESES_CORTOS.map((nombre, i) => {
    const mesISO = `${anio}-${String(i + 1).padStart(2, "0")}`
    return { nombre, mesISO, ...estadoDelMes(gasto, mesISO, parte) }
  })
  const pagados = meses.filter((m) => m.estado === "pagado").length
  return (
    <div
      className="order-last w-full basis-full md:order-none md:basis-auto"
      role="img"
      aria-label={`${gasto.concepto}: ${pagados} de 12 meses de ${anio} pagados`}
    >
      {/* En el celular no hay fila de meses arriba: va la inicial debajo. */}
      <div className="grid grid-cols-12 gap-1">
        {meses.map((m) => (
          <span key={m.mesISO} className="flex flex-col items-center gap-0.5">
            <span
              className={`h-2.5 w-full rounded-full ${COLOR_RAYITA[m.estado]} ${
                m.mesISO === mesHoy ? "ring-2 ring-purple-300 ring-offset-1" : ""
              }`}
              title={`${m.nombre} ${anio}: ${
                m.estado === "pagado"
                  ? `pagado ${formatCurrency(m.monto)}`
                  : m.estado === "debe"
                    ? `se debe ${formatCurrency(m.monto)}`
                    : "sin cargar"
              }`}
            />
            <span className="text-[9px] leading-none text-muted-foreground md:hidden">{m.nombre.charAt(0)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

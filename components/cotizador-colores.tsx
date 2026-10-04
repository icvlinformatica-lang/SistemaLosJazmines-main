// Colores del cotizador: UN significado por color, igual en Configuración,
// en la pantalla del vendedor y en la tarjeta de Administración. Solo
// variables del tema (app/globals.css), así funcionan en claro y en oscuro.
//
//   Rubros (punto o borde al lado del título / renglón):
//     Salón = verde (--primary)        Cocina = azul (--chart-2)
//     Barra = violeta (--rubro-barra)  Servicios = frambuesa (--rubro-servicios)
//     Personal = gris pizarra (--chart-5)
//   Días (chip al lado de la fecha):
//     Sábado = dorado (--accent) RELLENO + ícono de sol
//     Viernes / como viernes = verde suave (--primary al 15 %) + punto
//     Fecha especial = terracota (--chart-4) RELLENO + ícono de calendario
//   Ámbar = aviso y rojo = error/bloqueo: SOLO para eso (fondo pálido + ⚠).
//
// Contraste: el texto chico va siempre en el color de texto normal; el color
// va en el relleno, el punto o el borde. Los únicos textos sobre color son
// oscuro sobre dorado (~9:1), blanco sobre terracota (~4,8:1) y blanco sobre
// verde (~5-7:1): AA en claro y en oscuro.

import { CalendarDays, Sun } from "lucide-react"
import type { ClaveRubro, DiaCotizado } from "@/lib/cotizador-salon"

export const COLOR_RUBRO: Record<ClaveRubro, { punto: string; borde: string; icono: string }> = {
  salon: { punto: "bg-primary", borde: "border-t-primary", icono: "bg-primary/15 text-primary" },
  cocina: { punto: "bg-chart-2", borde: "border-t-chart-2", icono: "bg-chart-2/15 text-chart-2" },
  barra: { punto: "bg-rubro-barra", borde: "border-t-rubro-barra", icono: "bg-rubro-barra/15 text-rubro-barra" },
  servicios: {
    punto: "bg-rubro-servicios",
    borde: "border-t-rubro-servicios",
    icono: "bg-rubro-servicios/15 text-rubro-servicios",
  },
  personal: { punto: "bg-chart-5", borde: "border-t-chart-5", icono: "bg-chart-5/15 text-chart-5" },
  // El recargo toma el color de su motivo (ver colorRecargo).
  recargo: { punto: "bg-accent", borde: "border-t-accent", icono: "bg-accent/20 text-foreground" },
}

/** Color del renglón del recargo: dorado si es por sábado, terracota si es fecha especial. */
export function colorRecargo(origen: "sabado" | "especial" | null | undefined): string {
  return origen === "especial" ? "bg-chart-4" : "bg-accent"
}

/** Punto de color de un rubro (o del recargo, según su motivo). */
export function PuntoRubro({ clave, origen }: { clave: string; origen?: "sabado" | "especial" | null }) {
  const color = clave === "recargo" ? colorRecargo(origen) : (COLOR_RUBRO[clave as ClaveRubro]?.punto ?? "bg-chart-5")
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

/**
 * Chip del día al lado de la fecha: "Viernes", "Sábado · +$X",
 * "Domingo · se cotiza como viernes" o "Víspera 9 de Julio · +$X".
 * Sin fecha no muestra nada (eso es un AVISO ámbar, aparte).
 */
export function ChipDia({ dia, recargo }: { dia: Pick<DiaCotizado, "tipo" | "etiqueta" | "fechaEspecial"> | null; recargo: number }) {
  if (!dia || dia.tipo === "sin_fecha") return null
  const base = "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
  const mas = recargo > 0 ? ` · +${fmt(recargo)}` : ""
  if (dia.tipo === "sabado") {
    return (
      <span className={`${base} bg-accent text-accent-foreground`}>
        <Sun className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">
          {dia.etiqueta}
          {mas}
        </span>
      </span>
    )
  }
  if (dia.tipo === "especial") {
    const texto = recargo > 0 ? mas : dia.fechaEspecial?.modo === "viernes" ? " · se cotiza como viernes" : ""
    return (
      <span className={`${base} bg-chart-4 text-white`}>
        <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">
          {dia.etiqueta}
          {texto}
        </span>
      </span>
    )
  }
  return (
    <span className={`${base} bg-primary/15 text-foreground`}>
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-primary" />
      <span className="truncate">
        {dia.etiqueta}
        {dia.tipo === "como_viernes" ? " · se cotiza como viernes" : ""}
      </span>
    </span>
  )
}

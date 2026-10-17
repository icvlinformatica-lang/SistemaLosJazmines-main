"use client"

// Lista de compras de un proveedor en "Por pagar" (filtro Menú → Proveedor):
// los insumos de cocina que hay que comprarle, sumados entre los menús que se
// ven con los filtros puestos, y cuánto le toca a cada evento. Solo muestra;
// pagar el menú sigue siendo por evento, como siempre.

import { ShoppingCart } from "lucide-react"
import { formatCurrency } from "@/lib/utils-financieros"
import { SIN_PROVEEDOR, type ComprasDeProveedor } from "@/lib/compras-por-proveedor"

const formatoCantidad = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 })

function fechaCorta(fecha?: string) {
  if (!fecha) return ""
  const [a, m, d] = fecha.split("-")
  return d && m ? `${d}/${m}${a ? `/${a.slice(2)}` : ""}` : fecha
}

export function ComprasProveedor({
  clave,
  nombre,
  compras,
}: {
  clave: string
  nombre: string
  compras: ComprasDeProveedor
}) {
  const sinProveedor = clave === SIN_PROVEEDOR
  return (
    <div className="mx-4 sm:mx-6 mb-3 rounded-lg border border-sky-200 bg-sky-50/50 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 font-semibold text-sky-900">
          <ShoppingCart className="h-4 w-4 shrink-0" />
          {sinProveedor ? "Insumos sin proveedor cargado" : `Para comprarle a ${nombre}`}
        </p>
        <p className="font-bold text-red-600">−{formatCurrency(compras.total)}</p>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {compras.porEvento.length} {compras.porEvento.length === 1 ? "evento" : "eventos"} de la lista. Cantidad que pide
        el menú y precio de hoy del Almacén, sin descontar stock.
        {sinProveedor && " El proveedor se carga en cada insumo del Almacén."}
      </p>

      {compras.insumos.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Ningún menú de la lista lleva insumos de este proveedor.</p>
      ) : (
        <ul className="mt-2 divide-y divide-sky-100 rounded-md border border-sky-100 bg-card">
          {compras.insumos.map((i) => (
            <li key={i.insumoId} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <span className="min-w-0">
                <span className="font-medium">{i.descripcion}</span>
                <span className="ml-1.5 whitespace-nowrap text-xs text-muted-foreground">
                  {formatoCantidad.format(i.cantidad)} {i.unidad}
                  {i.eventos > 1 && ` · ${i.eventos} eventos`}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-xs">{formatCurrency(i.costo)}</span>
            </li>
          ))}
        </ul>
      )}

      {compras.porEvento.length > 1 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-sky-800">Cuánto es de cada evento</summary>
          <ul className="mt-1 space-y-0.5 pl-1">
            {compras.porEvento.map((e) => (
              <li key={e.eventoId} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {e.eventoFecha && <span className="text-muted-foreground">{fechaCorta(e.eventoFecha)} · </span>}
                  {e.eventoNombre}
                </span>
                <span className="shrink-0 tabular-nums">{formatCurrency(e.costo)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

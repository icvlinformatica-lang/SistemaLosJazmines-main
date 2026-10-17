"use client"

// Lista de compras de un proveedor en "Por pagar" (filtro Menú → Proveedor):
// los insumos de cocina que falta comprarle, sumados entre los menús que se
// ven con los filtros puestos, y el detalle de cada evento con sus cantidades.
// En cada evento se puede marcar pagado a ese proveedor: deja un egreso en
// Caja Eventos por lo suyo (lib/pago-menu-proveedor.ts) y el menú del evento
// queda debiendo el resto.

import { useState } from "react"
import { CheckCircle2, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatCurrency } from "@/lib/utils-financieros"
import { SIN_PROVEEDOR, type CompraDeEvento, type ComprasDeProveedor } from "@/lib/compras-por-proveedor"

const formatoCantidad = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 })

function fechaCorta(fecha?: string) {
  if (!fecha) return ""
  const [a, m, d] = fecha.slice(0, 10).split("-")
  return d && m ? `${d}/${m}${a ? `/${a.slice(2)}` : ""}` : fecha
}

export function ComprasProveedor({
  clave,
  nombre,
  compras,
  onPagar,
  guardando = false,
}: {
  clave: string
  nombre: string
  compras: ComprasDeProveedor
  /** Paga lo de este proveedor en un evento. Sin esto no se muestra el botón. */
  onPagar?: (evento: CompraDeEvento) => Promise<boolean>
  guardando?: boolean
}) {
  const sinProveedor = clave === SIN_PROVEEDOR
  const [aPagar, setAPagar] = useState<CompraDeEvento | null>(null)
  const sinPagar = compras.porEvento.filter((e) => !e.pago).length

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
        {sinPagar} {sinPagar === 1 ? "evento" : "eventos"} sin pagar de la lista
        {compras.pagado > 0 && <> · ya pagado {formatCurrency(compras.pagado)}</>}. Cantidad que pide el menú y precio de
        hoy del Almacén, sin descontar stock.
        {sinProveedor && " El proveedor se carga en cada insumo del Almacén."}
      </p>

      {compras.insumos.length > 0 && (
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

      {compras.porEvento.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Ningún menú de la lista lleva insumos de este proveedor.</p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-sky-800">Por evento</p>
          {compras.porEvento.map((e) => (
            <div
              key={e.eventoId}
              className={`rounded-md border px-3 py-2 ${e.pago ? "border-emerald-200 bg-emerald-50/60" : "border-sky-100 bg-card"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <p className="min-w-0 font-medium">
                  {e.eventoFecha && <span className="font-normal text-muted-foreground">{fechaCorta(e.eventoFecha)} · </span>}
                  {e.eventoNombre}
                </p>
                {e.pago ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Pagado {formatCurrency(e.pago.monto)} el {fechaCorta(e.pago.fecha)}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-xs font-semibold text-red-600">−{formatCurrency(e.costo)}</span>
                    {onPagar && !sinProveedor && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        disabled={guardando || e.costo <= 0}
                        onClick={() => setAPagar(e)}
                      >
                        Marcar pagado
                      </Button>
                    )}
                  </span>
                )}
              </div>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {e.insumos.map((i) => (
                  <li key={i.insumoId} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      {i.descripcion}{" "}
                      <span className="whitespace-nowrap font-medium text-foreground">
                        {formatoCantidad.format(i.cantidad)} {i.unidad}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatCurrency(i.costo)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!aPagar} onOpenChange={(abierto) => !abierto && setAPagar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar pagado a {nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              Sale {aPagar ? formatCurrency(aPagar.costo) : ""} de Caja Eventos por lo de {nombre} en el menú de{" "}
              {aPagar?.eventoNombre}. El menú del evento queda debiendo lo de los otros proveedores. Se puede revertir desde
              el Historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={guardando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={guardando}
              onClick={async (ev) => {
                ev.preventDefault()
                if (!aPagar || !onPagar) return
                if (await onPagar(aPagar)) setAPagar(null)
              }}
            >
              Sí, pagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

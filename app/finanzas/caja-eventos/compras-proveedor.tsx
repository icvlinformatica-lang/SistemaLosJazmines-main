"use client"

// "Por pagar" con un proveedor elegido (filtro Menú → Proveedor): los insumos
// de cocina que falta comprarle, sumados entre los menús que se ven con los
// filtros puestos, y una fila por evento con sus cantidades.
// En cada evento, como la seña y el saldo de un servicio, se le paga a ese
// proveedor una parte a cuenta y después el resto (o todo junto): cada pago
// deja un egreso en Caja Eventos (lib/pago-menu-proveedor.ts) y el menú del
// evento queda debiendo lo que falta.

import { useState, type ReactNode } from "react"
import { CheckCircle2, ChevronDown, ShoppingCart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
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

// Celdas de pago con el mismo aspecto que la seña y el saldo de "Por pagar"
// (renderCeldaPago en page.tsx): verde lo pagado, amarillo lo que se toca para pagar.
function CeldaPagado({ monto, fecha }: { monto: number; fecha?: string }) {
  return (
    <div className="inline-flex flex-col items-end gap-0.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1">
      <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
        {formatCurrency(monto)}
      </span>
      {fecha && <span className="text-[10px] text-emerald-600">{fechaCorta(fecha)}</span>}
    </div>
  )
}

function CeldaACuenta({ e, puedePagar, guardando, onPedir }: CeldaProps) {
  if (e.aCuenta > 0) return <CeldaPagado monto={e.aCuenta} fecha={e.fechaACuenta} />
  if (!puedePagar) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <button
      type="button"
      title="Pagarle una parte ahora y el resto después"
      disabled={guardando}
      onClick={onPedir}
      className="inline-flex min-h-0 items-center rounded-md border border-dashed border-yellow-400 bg-background px-2.5 py-1 text-xs font-medium text-yellow-800 transition-colors hover:bg-yellow-50 disabled:opacity-50"
    >
      + A cuenta
    </button>
  )
}

function CeldaResta({ e, puedePagar, guardando, onPedir }: CeldaProps) {
  if (e.saldado) return <CeldaPagado monto={Math.max(0, e.pagado - e.aCuenta)} fecha={e.fechaPago} />
  if (!puedePagar) return <span className="text-xs font-bold text-red-600">−{formatCurrency(e.resta)}</span>
  return (
    <button
      type="button"
      title={e.aCuenta > 0 ? "Pagar el resto" : "Pagar todo"}
      disabled={guardando}
      onClick={onPedir}
      className="inline-flex min-h-0 flex-col items-end gap-0.5 rounded-md border border-yellow-300 bg-yellow-50 px-2.5 py-1 text-right transition-colors hover:bg-yellow-100 disabled:opacity-50"
    >
      <span className="text-xs font-bold text-red-600">−{formatCurrency(e.resta)}</span>
    </button>
  )
}

interface CeldaProps {
  e: CompraDeEvento
  puedePagar: boolean
  guardando: boolean
  onPedir: () => void
}

function QuePide({ e }: { e: CompraDeEvento }) {
  return (
    <p className="mt-0.5 whitespace-normal text-xs text-muted-foreground">
      {e.insumos.map((i, n) => (
        <span key={i.insumoId}>
          {n > 0 && " · "}
          {i.descripcion}{" "}
          <span className="whitespace-nowrap font-medium text-foreground">
            {formatoCantidad.format(i.cantidad)} {i.unidad}
          </span>
        </span>
      ))}
    </p>
  )
}

/**
 * Vista "Por pagar" con un proveedor elegido (Menú → Proveedor): reemplaza la
 * tabla de menús enteros. Arriba, plegable, la lista de compras; abajo la
 * misma tabla de "Por pagar" con una fila por evento, donde la columna de la
 * seña es lo dado a cuenta y la del saldo, lo que resta.
 */
export function ComprasProveedor({
  clave,
  nombre,
  compras,
  onPagar,
  guardando = false,
  celdasEvento,
}: {
  clave: string
  nombre: string
  compras: ComprasDeProveedor
  /** Paga lo de este proveedor en un evento: una parte a cuenta o el resto.
   *  Sin esto no se pueden tocar las celdas. */
  onPagar?: (evento: CompraDeEvento, modo: "cuenta" | "resto", montoACuenta: number) => Promise<boolean>
  guardando?: boolean
  /** Las celdas del evento (fecha de carga, fecha, nombre y tipo), iguales a
   *  las del resto de "Por pagar". */
  celdasEvento: (eventoId: string) => ReactNode
}) {
  const sinProveedor = clave === SIN_PROVEEDOR
  const [aPagar, setAPagar] = useState<{ compra: CompraDeEvento; modo: "cuenta" | "resto" } | null>(null)
  const [montoACuenta, setMontoACuenta] = useState(0)
  const [listaAbierta, setListaAbierta] = useState(true)
  const totalCompras = compras.insumos.reduce((s, i) => s + i.costo, 0)

  const pedirACuenta = (e: CompraDeEvento) => {
    setMontoACuenta(0)
    setAPagar({ compra: e, modo: "cuenta" })
  }
  const pedirResto = (e: CompraDeEvento) => setAPagar({ compra: e, modo: "resto" })
  const puedePagar = (e: CompraDeEvento) => !!onPagar && !sinProveedor && !e.saldado && e.resta > 0
  const celdas = (e: CompraDeEvento) => ({
    e,
    puedePagar: puedePagar(e),
    guardando,
  })

  return (
    <div>
      {/* Lista de compras: una franja más de la tarjeta, plegable. */}
      {compras.insumos.length > 0 && (
        <div className="border-y border-sky-100 bg-sky-50/40">
          <button
            type="button"
            onClick={() => setListaAbierta((v) => !v)}
            aria-expanded={listaAbierta}
            className="flex w-full min-h-0 items-center gap-2 px-4 py-2 text-left sm:px-6"
          >
            <ShoppingCart className="h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
            <span className="text-sm font-semibold text-sky-900">
              {sinProveedor ? "Insumos sin proveedor" : `Lista de compras de ${nombre}`}
            </span>
            <span className="text-xs text-muted-foreground">
              {compras.insumos.length} {compras.insumos.length === 1 ? "insumo" : "insumos"} ·{" "}
              {formatCurrency(totalCompras)}
            </span>
            <ChevronDown
              className={`ml-auto h-4 w-4 shrink-0 text-sky-700 transition-transform ${listaAbierta ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {listaAbierta && (
            <div className="px-4 pb-3 sm:px-6">
              <ul className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
                {compras.insumos.map((i) => (
                  <li
                    key={i.insumoId}
                    className="flex items-baseline justify-between gap-3 border-b border-sky-100/80 py-1.5 last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="text-sm font-medium">{i.descripcion}</span>
                      <span className="ml-1.5 whitespace-nowrap text-xs text-muted-foreground">
                        {formatoCantidad.format(i.cantidad)} {i.unidad}
                        {i.eventos > 1 && ` · ${i.eventos} eventos`}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-xs">{formatCurrency(i.costo)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                De los eventos a los que todavía no se le pagó nada. Cantidad que pide el menú y precio de hoy del Almacén,
                sin descontar stock.
                {sinProveedor && " El proveedor se carga en cada insumo del Almacén."}
              </p>
            </div>
          )}
        </div>
      )}

      {compras.porEvento.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Ningún menú de la lista lleva insumos de este proveedor.</p>
      ) : (
        <>
          {/* Compu: la misma tabla de "Por pagar". */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 w-[260px]">Tipo de servicio</TableHead>
                  <TableHead className="whitespace-nowrap">Fecha de carga</TableHead>
                  <TableHead className="whitespace-nowrap">Fecha del evento</TableHead>
                  <TableHead>Nombre del evento</TableHead>
                  <TableHead>Tipo de evento</TableHead>
                  <TableHead className="text-right">A cuenta</TableHead>
                  <TableHead className="text-right pr-6">Saldo restante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compras.porEvento.map((e) => (
                  <TableRow key={e.eventoId}>
                    <TableCell className="pl-6 w-[260px] max-w-[260px] align-top">
                      <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[11px]">
                        Menú
                      </Badge>
                      <p className="mt-1 text-sm font-medium">{nombre}</p>
                      <QuePide e={e} />
                    </TableCell>
                    {celdasEvento(e.eventoId)}
                    <TableCell className="text-right">
                      <CeldaACuenta {...celdas(e)} onPedir={() => pedirACuenta(e)} />
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <CeldaResta {...celdas(e)} onPedir={() => pedirResto(e)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Celu: una fila por evento, con las dos celdas al costado. */}
          <ul className="divide-y divide-border md:hidden">
            {compras.porEvento.map((e) => (
              <li key={e.eventoId} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{e.eventoNombre}</p>
                    {e.eventoFecha && <p className="text-xs text-muted-foreground">{fechaCorta(e.eventoFecha)}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Total <span className="tabular-nums font-medium text-foreground">{formatCurrency(e.costo)}</span>
                  </span>
                </div>
                <QuePide e={e} />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">A cuenta</p>
                    <CeldaACuenta {...celdas(e)} onPedir={() => pedirACuenta(e)} />
                  </div>
                  <div className="text-right">
                    <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Saldo restante
                    </p>
                    <CeldaResta {...celdas(e)} onPedir={() => pedirResto(e)} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <AlertDialog open={!!aPagar} onOpenChange={(abierto) => !abierto && setAPagar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {aPagar?.modo === "cuenta"
                ? `¿Cuánto le pagás a cuenta a ${nombre}?`
                : `¿Pagar ${aPagar && aPagar.compra.aCuenta > 0 ? "el resto" : "todo"} a ${nombre}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {aPagar?.modo === "cuenta" ? (
                <>
                  Menú de {aPagar.compra.eventoNombre}: resta {formatCurrency(aPagar.compra.resta)}. Sale de Caja Eventos lo
                  que pongas y el resto queda para pagar después.
                </>
              ) : (
                <>
                  Sale {aPagar ? formatCurrency(aPagar.compra.resta) : ""} de Caja Eventos y {nombre} queda pagado en el menú
                  de {aPagar?.compra.eventoNombre}. Se puede revertir desde el Historial.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {aPagar?.modo === "cuenta" && (
            <div className="space-y-1">
              <Label htmlFor="monto-a-cuenta">Monto a cuenta</Label>
              <MoneyInput id="monto-a-cuenta" value={montoACuenta} onValueChange={setMontoACuenta} placeholder="0" />
              {montoACuenta > 0 && montoACuenta < aPagar.compra.resta && (
                <p className="text-xs text-muted-foreground">
                  Queda para después: {formatCurrency(aPagar.compra.resta - montoACuenta)}
                </p>
              )}
              {montoACuenta >= aPagar.compra.resta && (
                <p className="text-xs text-amber-700">Para pagar todo, tocá el saldo restante.</p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={guardando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                guardando ||
                (aPagar?.modo === "cuenta" && !(montoACuenta > 0 && montoACuenta < aPagar.compra.resta))
              }
              onClick={async (ev) => {
                ev.preventDefault()
                if (!aPagar || !onPagar) return
                if (await onPagar(aPagar.compra, aPagar.modo, montoACuenta)) setAPagar(null)
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

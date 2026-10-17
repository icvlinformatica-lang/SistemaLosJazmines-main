"use client"

// Lista de compras de un proveedor en "Por pagar" (filtro Menú → Proveedor):
// los insumos de cocina que falta comprarle, sumados entre los menús que se
// ven con los filtros puestos, y el detalle de cada evento con sus cantidades.
// En cada evento, como la seña y el saldo de un servicio, se le paga a ese
// proveedor una parte a cuenta y después el resto (o todo junto): cada pago
// deja un egreso en Caja Eventos (lib/pago-menu-proveedor.ts) y el menú del
// evento queda debiendo lo que falta.

import { useState } from "react"
import { CheckCircle2, ChevronDown, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
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

/** Lo dado a cuenta: monto con tilde y fecha, o una raya. */
function ACuenta({ e }: { e: CompraDeEvento }) {
  if (e.aCuenta <= 0) return <p className="text-xs text-muted-foreground">—</p>
  return (
    <p className="flex flex-wrap items-center gap-1 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      <span className="tabular-nums">{formatCurrency(e.aCuenta)}</span>
      {e.fechaACuenta && <span className="font-normal">el {fechaCorta(e.fechaACuenta)}</span>}
    </p>
  )
}

/** Lo que resta (en rojo) o, ya saldado, lo pagado al final con tilde. */
function Resta({ e }: { e: CompraDeEvento }) {
  if (!e.saldado) return <p className="tabular-nums text-xs font-semibold text-red-600">−{formatCurrency(e.resta)}</p>
  return (
    <p className="flex flex-wrap items-center gap-1 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      <span className="tabular-nums">{formatCurrency(Math.max(0, e.pagado - e.aCuenta))}</span>
      {e.fechaPago && <span className="font-normal">el {fechaCorta(e.fechaPago)}</span>}
    </p>
  )
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
  /** Paga lo de este proveedor en un evento: una parte a cuenta o el resto.
   *  Sin esto no se muestran los botones. */
  onPagar?: (evento: CompraDeEvento, modo: "cuenta" | "resto", montoACuenta: number) => Promise<boolean>
  guardando?: boolean
}) {
  const sinProveedor = clave === SIN_PROVEEDOR
  const [aPagar, setAPagar] = useState<{ compra: CompraDeEvento; modo: "cuenta" | "resto" } | null>(null)
  const [montoACuenta, setMontoACuenta] = useState(0)
  const [porEventoAbierto, setPorEventoAbierto] = useState(false)
  const sinPagar = compras.porEvento.filter((e) => !e.saldado).length

  const pedirACuenta = (e: CompraDeEvento) => {
    setMontoACuenta(0)
    setAPagar({ compra: e, modo: "cuenta" })
  }
  const pedirResto = (e: CompraDeEvento) => setAPagar({ compra: e, modo: "resto" })
  const puedePagar = (e: CompraDeEvento) => !!onPagar && !sinProveedor && !e.saldado && e.resta > 0

  return (
    <div className="mx-4 sm:mx-6 mb-3 rounded-lg border border-sky-200 bg-sky-50/50 px-3 py-3 text-sm md:px-4 md:py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold text-sky-900 md:text-base">
            <ShoppingCart className="h-4 w-4 shrink-0" />
            {sinProveedor ? "Insumos sin proveedor cargado" : `Para comprarle a ${nombre}`}
          </p>
          <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">
            {sinPagar} {sinPagar === 1 ? "evento" : "eventos"} sin pagar de la lista. Cantidad que pide el menú y precio de
            hoy del Almacén, sin descontar stock.
            {sinProveedor && " El proveedor se carga en cada insumo del Almacén."}
          </p>
        </div>
        {/* Totales: en la compu, dos recuadros a la derecha; en el celu, una línea. */}
        <div className="flex gap-2">
          <div className="rounded-md border border-red-100 bg-card px-3 py-1.5 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Falta pagar</p>
            <p className="tabular-nums text-sm font-bold text-red-600 md:text-base">−{formatCurrency(compras.total)}</p>
          </div>
          {compras.pagado > 0 && (
            <div className="rounded-md border border-emerald-100 bg-card px-3 py-1.5 text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Ya pagado</p>
              <p className="tabular-nums text-sm font-bold text-emerald-700 md:text-base">{formatCurrency(compras.pagado)}</p>
            </div>
          )}
        </div>
      </div>

      {compras.insumos.length > 0 && (
        <>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-sky-800">
            Para comprar (eventos sin ningún pago)
          </p>
          {/* En pantalla ancha, en columnas para no dejar media pantalla vacía. */}
          <ul className="mt-1 grid gap-px overflow-hidden rounded-md border border-sky-100 bg-sky-100 md:grid-cols-2 xl:grid-cols-3">
            {compras.insumos.map((i) => (
              <li key={i.insumoId} className="flex items-baseline justify-between gap-3 bg-card px-3 py-1.5">
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
        </>
      )}

      {compras.porEvento.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Ningún menú de la lista lleva insumos de este proveedor.</p>
      ) : (
        <div className="mt-3">
          {/* Plegable para que no ocupe lugar cuando solo se mira la lista de compras. */}
          <button
            type="button"
            onClick={() => setPorEventoAbierto((v) => !v)}
            aria-expanded={porEventoAbierto}
            className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-[11px] font-medium uppercase tracking-wide text-sky-800 hover:bg-sky-100/60"
          >
            <span>
              Por evento ({compras.porEvento.length}) · pagado y lo que resta
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${porEventoAbierto ? "rotate-180" : ""}`} />
          </button>
          {porEventoAbierto && (
            <>
              {/* Compu: una tabla, una fila por evento, con a cuenta y resta en dos columnas. Los
                  botones son chicos (min-h-0): el mínimo de 44 px de globals.css es para el dedo. */}
              <div className="mt-1.5 hidden overflow-hidden rounded-md border border-sky-100 bg-card md:block">
                <table className="w-full text-xs">
                  <thead className="bg-sky-50 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Evento</th>
                      <th className="px-3 py-2 text-left font-medium">Qué pide</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="w-44 px-3 py-2 text-left font-medium">A cuenta</th>
                      <th className="w-44 px-3 py-2 text-left font-medium">Resta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100">
                    {compras.porEvento.map((e) => (
                      <tr key={e.eventoId} className={`align-top ${e.saldado ? "bg-emerald-50/60" : ""}`}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground">{e.eventoNombre}</p>
                          {e.eventoFecha && <p className="text-muted-foreground">{fechaCorta(e.eventoFecha)}</p>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          <ul className="space-y-0.5">
                            {e.insumos.map((i) => (
                              <li key={i.insumoId}>
                                {i.descripcion}{" "}
                                <span className="whitespace-nowrap font-medium text-foreground">
                                  {formatoCantidad.format(i.cantidad)} {i.unidad}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(e.costo)}</td>
                        <td className="px-3 py-2">
                          <ACuenta e={e} />
                          {puedePagar(e) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-1 h-7 min-h-0 px-2.5 text-xs"
                              disabled={guardando}
                              onClick={() => pedirACuenta(e)}
                            >
                              Pagar a cuenta
                            </Button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Resta e={e} />
                          {puedePagar(e) && (
                            <Button size="sm" className="mt-1 h-7 min-h-0 px-2.5 text-xs" disabled={guardando} onClick={() => pedirResto(e)}>
                              {e.aCuenta > 0 ? "Pagar resto" : "Pagar todo"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Celu: una tarjeta por evento. */}
              <div className="mt-1.5 space-y-2 md:hidden">
                {compras.porEvento.map((e) => (
                  <div
                    key={e.eventoId}
                    className={`rounded-md border px-3 py-2 ${e.saldado ? "border-emerald-200 bg-emerald-50/60" : "border-sky-100 bg-card"}`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="min-w-0 font-medium">
                        {e.eventoFecha && <span className="font-normal text-muted-foreground">{fechaCorta(e.eventoFecha)} · </span>}
                        {e.eventoNombre}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        Total <span className="tabular-nums font-medium text-foreground">{formatCurrency(e.costo)}</span>
                      </span>
                    </div>

                    {/* Dos columnas, como la seña y el saldo de un servicio. */}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded border border-border/60 bg-background/60 px-2 py-1.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">A cuenta</p>
                        <ACuenta e={e} />
                        {puedePagar(e) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-1 h-7 w-full px-2 text-xs"
                            disabled={guardando}
                            onClick={() => pedirACuenta(e)}
                          >
                            Pagar a cuenta
                          </Button>
                        )}
                      </div>
                      <div className="rounded border border-border/60 bg-background/60 px-2 py-1.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {e.aCuenta > 0 ? "Resta" : "Total a pagar"}
                        </p>
                        <Resta e={e} />
                        {puedePagar(e) && (
                          <Button size="sm" className="mt-1 h-7 w-full px-2 text-xs" disabled={guardando} onClick={() => pedirResto(e)}>
                            {e.aCuenta > 0 ? "Pagar resto" : "Pagar todo"}
                          </Button>
                        )}
                      </div>
                    </div>

                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
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
            </>
          )}
        </div>
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
                <p className="text-xs text-amber-700">Para pagar todo, usá &quot;Pagar resto&quot;.</p>
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

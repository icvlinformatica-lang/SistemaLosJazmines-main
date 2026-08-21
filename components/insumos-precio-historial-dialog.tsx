"use client"

import { useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { History, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react"
import { formatCurrency } from "@/lib/store"

interface RegistroPrecio {
  fecha: string
  precioAnterior: number | null
  precio: number
}

interface HistorialInsumo {
  insumoId: string
  descripcion: string
  unidad: string
  registros: RegistroPrecio[]
}

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(r)))

function formatFechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10))
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

export function InsumosPrecioHistorialDialog() {
  const [open, setOpen] = useState(false)
  const [semanas, setSemanas] = useState("4")

  const { data, isLoading, error } = useSWR<HistorialInsumo[]>(
    open ? `/api/insumos/precios-historial?semanas=${semanas}` : null,
    fetcher,
  )

  const historial = (data || [])
    .filter((h) => h.registros.length > 0)
    .sort((a, b) => a.descripcion.localeCompare(b.descripcion))

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        title="Ver evolución de precios"
        aria-label="Ver evolución de precios de los insumos"
      >
        <History className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Evolución de precios
            </DialogTitle>
            <DialogDescription>
              Registro automático de cada cambio del precio unitario. Se guarda un valor por insumo por día.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mostrar últimas</span>
            <Select value={semanas} onValueChange={setSemanas}>
              <SelectTrigger className="h-8 w-[130px]" aria-label="Rango de semanas">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 semanas</SelectItem>
                <SelectItem value="4">4 semanas</SelectItem>
                <SelectItem value="8">8 semanas</SelectItem>
                <SelectItem value="12">12 semanas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {isLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Cargando historial...</p>
            ) : error ? (
              <p className="py-10 text-center text-sm text-destructive">No se pudo cargar el historial.</p>
            ) : historial.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground space-y-1">
                <p>Todavía no hay cambios de precio registrados en este período.</p>
                <p className="text-xs">
                  El registro es automático: cada vez que edites el precio unitario de un insumo, queda guardado acá.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {historial.map((h) => {
                  const primero = h.registros[0]
                  const ultimo = h.registros[h.registros.length - 1]
                  const base = primero.precioAnterior ?? primero.precio
                  const variacion = base > 0 ? ((ultimo.precio - base) / base) * 100 : 0
                  const subio = variacion > 0.05
                  const bajo = variacion < -0.05

                  return (
                    <div key={h.insumoId} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {h.descripcion}
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">({h.unidad})</span>
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            subio
                              ? "border-red-300 bg-red-50 text-red-700"
                              : bajo
                                ? "border-green-300 bg-green-50 text-green-700"
                                : "text-muted-foreground"
                          }
                        >
                          {subio ? (
                            <TrendingUp className="mr-1 h-3 w-3" aria-hidden="true" />
                          ) : bajo ? (
                            <TrendingDown className="mr-1 h-3 w-3" aria-hidden="true" />
                          ) : (
                            <Minus className="mr-1 h-3 w-3" aria-hidden="true" />
                          )}
                          {variacion > 0 ? "+" : ""}
                          {variacion.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
                        </Badge>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {h.registros.map((r) => (
                          <li
                            key={r.fecha}
                            className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1 text-xs"
                          >
                            <span className="text-muted-foreground">{formatFechaCorta(r.fecha)}</span>
                            <span className="flex items-center gap-1.5 font-mono">
                              {r.precioAnterior !== null && (
                                <>
                                  <span className="text-muted-foreground line-through">
                                    {formatCurrency(r.precioAnterior)}
                                  </span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                                </>
                              )}
                              <span
                                className={
                                  r.precioAnterior === null
                                    ? "font-semibold"
                                    : r.precio > r.precioAnterior
                                      ? "font-semibold text-red-700"
                                      : r.precio < r.precioAnterior
                                        ? "font-semibold text-green-700"
                                        : "font-semibold"
                                }
                              >
                                {formatCurrency(r.precio)}
                              </span>
                              {r.precioAnterior === null && (
                                <span className="text-[10px] text-muted-foreground">(precio inicial)</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

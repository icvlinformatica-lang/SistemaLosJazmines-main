"use client"

// "¿Cómo nos conocieron?": cuántos eventos vinieron de cada red, por mes de
// venta (fecha de alta). Solo para Administración (está en Eventos >
// Vendedores). Cuentas en lib/origen-cliente.ts.

import { useMemo, useState } from "react"
import { Megaphone } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { contarPorOrigen, mesesConDatos, type FilaOrigen } from "@/lib/origen-cliente"
import type { EventoGuardado } from "@/lib/store"

function nombreMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number)
  const texto = new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function VentasPorOrigen({ eventos }: { eventos: EventoGuardado[] }) {
  const filas = useMemo<FilaOrigen[]>(
    () =>
      eventos.map((e) => ({
        origen: e.origenCliente,
        // Mes de venta: la fecha de alta; si no tiene, cuándo se cargó.
        fecha: e.fechaAlta || (e.createdAt ? String(e.createdAt).slice(0, 10) : null),
      })),
    [eventos],
  )
  const meses = useMemo(() => mesesConDatos(filas), [filas])
  const [mes, setMes] = useState<string>("")
  const conteo = contarPorOrigen(filas, mes || null)
  const total = conteo.reduce((s, c) => s + c.cantidad, 0)
  const maximo = Math.max(1, ...conteo.filter((c) => c.origen !== "sin_dato").map((c) => c.cantidad))

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            ¿Cómo nos conocieron?
          </CardTitle>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            aria-label="Mes de venta"
          >
            <option value="">Todos los meses</option>
            {meses.map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          Eventos por mes de venta. Se carga en el cotizador y en el planificador; los eventos de antes quedan "Sin dato".
        </p>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No hay eventos en ese mes.</p>
        ) : (
          conteo.map((c) => (
            <div key={c.origen} className="flex items-center gap-2 text-sm">
              <span className={`w-32 shrink-0 truncate ${c.origen === "sin_dato" ? "text-muted-foreground" : ""}`}>{c.etiqueta}</span>
              <span className="min-w-0 flex-1">
                {c.origen !== "sin_dato" && (
                  <span className="block h-2 rounded-full bg-primary/70" style={{ width: `${Math.max(4, (c.cantidad / maximo) * 100)}%` }} />
                )}
              </span>
              <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{c.cantidad}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

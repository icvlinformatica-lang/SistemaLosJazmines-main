"use client"

// Montos de la "Proyección a 12 meses" de Caja Jazmines: al tocarlos se abre,
// en una ventana centrada, el desglose del mes (lib/proyeccion-jazmines.ts):
// cuánto ya entró o ya se pagó, cuánto falta y de qué. Es la misma ventana de
// Caja Eventos (usa sus mismas piezas). Solo muestra: no cobra, no paga y no
// guarda nada.

import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from "lucide-react"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils-financieros"
import { salonLabel } from "@/lib/store"
import type { DesgloseMesJaz, PagoJazPendienteMes } from "@/lib/proyeccion-jazmines"
import { Encabezado, Linea, ListaConFlechas, Resumen, Seccion } from "../caja-eventos/desglose-proyeccion"

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number)
  if (!y || !m || !d) return fecha
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
}

const unir = (partes: (string | null | undefined | false)[]) => partes.filter(Boolean).join(" · ")

const TIPO_PAGO: Record<PagoJazPendienteMes["tipo"], string> = {
  fijo: "Gasto fijo",
  anual: "Gasto anual",
  sueldo: "Sueldo",
  variable: "Gasto variable",
}

interface Props {
  tipo: "cobrar" | "pagar"
  /** "noviembre de 2026" */
  mesLabel: string
  /** El número de la tabla: lo que falta cobrar o pagar ese mes. */
  monto: number
  desglose?: DesgloseMesJaz
}

export function MontoProyeccionJazmines({ tipo, mesLabel, monto, desglose }: Props) {
  const texto = monto > 0 ? `${tipo === "cobrar" ? "+" : "−"}${formatCurrency(monto)}` : "—"
  const yaHecho = tipo === "cobrar" ? (desglose?.cobrar.yaIngreso ?? 0) : (desglose?.pagar.yaPagado ?? 0)
  if (!desglose || (monto <= 0 && yaHecho <= 0)) return <>{texto}</>

  const etiqueta = tipo === "cobrar" ? "a cobrar" : "a pagar"
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Ver el detalle de lo ${etiqueta} en ${mesLabel}`}
          title="Ver el detalle"
          className="rounded px-1.5 py-0.5 underline decoration-dotted underline-offset-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {monto > 0 ? (
            texto
          ) : (
            <span className="inline-flex items-center gap-1 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> al día
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(calc(100dvh-4rem),760px)] sm:max-w-lg">
        {tipo === "cobrar" ? <DetalleCobrar mesLabel={mesLabel} d={desglose.cobrar} /> : <DetallePagar mesLabel={mesLabel} d={desglose.pagar} />}
      </DialogContent>
    </Dialog>
  )
}

function DetalleCobrar({ mesLabel, d }: { mesLabel: string; d: DesgloseMesJaz["cobrar"] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Encabezado
        icono={<ArrowDownToLine className="h-4 w-4 text-emerald-600" />}
        titulo={`A cobrar · ${mesLabel}`}
        ayuda="Parte de Caja Jazmines de cada cuota: lo que entró este mes y lo que falta cobrar, con las cuotas atrasadas."
      />
      <Resumen
        filas={[
          { label: "Total del mes", valor: d.total },
          { label: "Ya ingresó", valor: d.yaIngreso, className: "text-emerald-700" },
          { label: "Falta cobrar", valor: d.falta, destacado: true },
        ]}
        hecho={d.yaIngreso}
        total={d.total}
        textoAvance="ingresado"
        colorBarra="bg-emerald-500"
      />
      <ListaConFlechas>
        <Seccion titulo={`Falta cobrar · de quién (${d.pendientes.length})`} vacio="No falta cobrar nada de este mes.">
          {d.pendientes.map((p) => (
            <Linea
              key={p.id}
              titulo={p.eventoNombre}
              detalle={unir([`Cuota ${p.numeroCuota}/${p.totalCuotas}`, `vence ${formatFecha(p.fechaVencimiento)}`, p.salon && salonLabel(p.salon)])}
              monto={p.monto}
              marcas={p.vencida && <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">vencida</Badge>}
            />
          ))}
        </Seccion>
        <Seccion titulo={`Ya ingresó (${d.cobrados.length})`} vacio="Todavía no entró nada este mes.">
          {d.cobrados.map((c) => (
            <Linea
              key={c.id}
              titulo={c.eventoNombre}
              detalle={unir([c.concepto, `entró ${formatFecha(c.fecha)}`, c.salon && salonLabel(c.salon)])}
              monto={c.monto}
              montoClassName="text-emerald-700"
            />
          ))}
        </Seccion>
      </ListaConFlechas>
    </div>
  )
}

function DetallePagar({ mesLabel, d }: { mesLabel: string; d: DesgloseMesJaz["pagar"] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Encabezado
        icono={<ArrowUpFromLine className="h-4 w-4 text-[var(--accent)]" />}
        titulo={`A pagar · ${mesLabel}`}
        ayuda="Gastos fijos, sueldos de vendedores y gastos variables agendados de este mes (los variables vencidos sin pagar, en el mes actual)."
      />
      <Resumen
        filas={[
          { label: "Total a pagar", valor: d.total },
          { label: "Ya pagado", valor: d.yaPagado, className: "text-[var(--accent)]" },
          { label: "Falta pagar", valor: d.falta, destacado: true },
        ]}
        hecho={d.yaPagado}
        total={d.total}
        textoAvance="pagado"
        colorBarra="bg-[var(--accent)]"
      />
      <ListaConFlechas>
        <Seccion titulo={`Falta pagar (${d.pendientes.length})`} vacio="No falta pagar nada de este mes.">
          {d.pendientes.map((p) => (
            <Linea
              key={p.id}
              titulo={p.concepto}
              detalle={unir([
                TIPO_PAGO[p.tipo],
                p.fechaVencimiento && `vence ${formatFecha(p.fechaVencimiento)}`,
                p.salon && salonLabel(p.salon),
              ])}
              monto={p.monto}
              marcas={p.vencido && <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">vencido</Badge>}
            />
          ))}
        </Seccion>
        <Seccion titulo={`Ya pagado (${d.pagados.length})`} vacio="Todavía no se pagó nada este mes.">
          {d.pagados.map((p) => (
            <Linea
              key={p.id}
              titulo={p.concepto}
              detalle={unir([`pagado ${formatFecha(p.fecha)}`, p.salon && salonLabel(p.salon)])}
              monto={p.monto}
              montoClassName="text-[var(--accent)]"
            />
          ))}
        </Seccion>
      </ListaConFlechas>
    </div>
  )
}

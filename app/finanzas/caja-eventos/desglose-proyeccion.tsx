"use client"

// Montos de la "Proyección en 12 meses" de Caja Eventos: al tocarlos se abre,
// en el lugar, el desglose del mes (lib/desglose-proyeccion.ts): de lo que
// vence ese mes, cuánto ya entró o ya se pagó, cuánto falta y de quién.
// Solo muestra: no cobra, no paga y no guarda nada.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils-financieros"
import { salonLabel } from "@/lib/store"
import type { DesgloseCobrarMes, DesgloseMesProyeccion, DesglosePagarMes, PagoMes } from "@/lib/desglose-proyeccion"

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number)
  if (!y || !m || !d) return fecha
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
}

const unir = (partes: (string | null | undefined | false)[]) => partes.filter(Boolean).join(" · ")

function conceptoPago(p: PagoMes): string {
  if (p.tipo === "menu") return "Menú"
  if (p.tipo === "barra") return "Barra"
  if (p.tipo === "seña") return `Seña · ${p.servicioNombre}`
  if (p.tipo === "saldo") return `Saldo · ${p.servicioNombre}`
  return `Sueldo · ${p.servicioNombre}`
}

interface MontoProyeccionProps {
  tipo: "cobrar" | "pagar"
  /** "octubre de 2026" */
  mesLabel: string
  /** El número de la tabla: lo que falta cobrar o pagar ese mes. */
  monto: number
  desglose?: DesgloseMesProyeccion
}

export function MontoProyeccion({ tipo, mesLabel, monto, desglose }: MontoProyeccionProps) {
  const texto = monto > 0 ? `${tipo === "cobrar" ? "+" : "−"}${formatCurrency(monto)}` : "—"
  const yaHecho = tipo === "cobrar" ? (desglose?.cobrar.yaIngreso ?? 0) : (desglose?.pagar.yaPagado ?? 0)
  // Sin nada que vencer ese mes, la celda queda como siempre.
  if (!desglose || (monto <= 0 && yaHecho <= 0)) return <>{texto}</>

  const etiqueta = tipo === "cobrar" ? "a cobrar" : "a pagar"
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ver el detalle de lo ${etiqueta} en ${mesLabel}`}
          title="Ver el detalle"
          className="rounded px-1.5 py-0.5 underline decoration-dotted underline-offset-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {monto > 0 ? (
            texto
          ) : (
            // Todo lo que vence ese mes ya se cobró o se pagó.
            <span className="inline-flex items-center gap-1 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> al día
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" collisionPadding={12} className="w-[min(380px,calc(100vw-1.5rem))] p-0">
        {tipo === "cobrar" ? (
          <DetalleCobrar mesLabel={mesLabel} d={desglose.cobrar} />
        ) : (
          <DetallePagar mesLabel={mesLabel} d={desglose.pagar} />
        )}
      </PopoverContent>
    </Popover>
  )
}

function DetalleCobrar({ mesLabel, d }: { mesLabel: string; d: DesgloseCobrarMes }) {
  return (
    <div>
      <Encabezado
        icono={<ArrowDownToLine className="h-4 w-4 text-emerald-600" />}
        titulo={`A cobrar · ${mesLabel}`}
        ayuda="Parte de Caja Eventos de las cuotas que vencen este mes."
      />
      <Resumen
        filas={[
          { label: "Debía ingresar", valor: d.debiaIngresar },
          { label: "Ya ingresó", valor: d.yaIngreso, className: "text-emerald-700" },
          { label: "Falta cobrar", valor: d.falta, destacado: true },
        ]}
        hecho={d.yaIngreso}
        total={d.debiaIngresar}
        textoAvance="ingresado"
        colorBarra="bg-emerald-500"
      />
      <ListaConFlechas>
        <Seccion titulo={`Falta cobrar · de quién (${d.pendientes.length})`} vacio="No falta cobrar nada de este mes.">
          {d.pendientes.map((p) => (
            <Linea
              key={p.id}
              titulo={p.cliente}
              detalle={unir([
                p.eventoNombre !== p.cliente && p.eventoNombre,
                `Cuota ${p.numeroCuota}/${p.totalCuotas}`,
                `vence ${formatFecha(p.fechaVencimiento)}`,
                p.salon && salonLabel(p.salon),
              ])}
              monto={p.monto}
              marcas={
                (p.vencida || p.parcial) && (
                  <>
                    {p.vencida && <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">vencida</Badge>}
                    {p.parcial && (
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-sky-100 text-sky-800">parcial</span>
                    )}
                  </>
                )
              }
            />
          ))}
        </Seccion>
        <Seccion titulo={`Ya ingresó (${d.cobrados.length})`} vacio="Todavía no entró nada de este mes.">
          {d.cobrados.map((c) => (
            <Linea
              key={c.id}
              titulo={c.cliente}
              detalle={unir([
                c.eventoNombre !== c.cliente && c.eventoNombre,
                `Cuota ${c.numeroCuota}/${c.totalCuotas}`,
                c.sinMovimiento ? "no figura en la caja · monto estimado" : c.fechaCobro && `cobrada ${formatFecha(c.fechaCobro)}`,
              ])}
              monto={c.monto}
              montoClassName="text-emerald-700"
            />
          ))}
        </Seccion>
      </ListaConFlechas>
    </div>
  )
}

function DetallePagar({ mesLabel, d }: { mesLabel: string; d: DesglosePagarMes }) {
  return (
    <div>
      <Encabezado
        icono={<ArrowUpFromLine className="h-4 w-4 text-[var(--accent)]" />}
        titulo={`A pagar · ${mesLabel}`}
        ayuda="Pagos a proveedores y personal de los eventos que vencen este mes."
      />
      <Resumen
        filas={[
          { label: "Total a pagar", valor: d.totalAPagar },
          { label: "Ya pagado", valor: d.yaPagado, className: "text-[var(--accent)]" },
          { label: "Falta pagar", valor: d.falta, destacado: true },
        ]}
        hecho={d.yaPagado}
        total={d.totalAPagar}
        textoAvance="pagado"
        colorBarra="bg-[var(--accent)]"
      />
      <ListaConFlechas>
        <Seccion titulo={`Falta pagar (${d.pendientes.length})`} vacio="No falta pagar nada de este mes.">
          {d.pendientes.map((p, i) => (
            <Linea
              key={`${p.id}-${i}`}
              titulo={conceptoPago(p)}
              detalle={unir([p.eventoNombre, `vence ${formatFecha(p.fechaVencimiento)}`, p.salon && salonLabel(p.salon)])}
              monto={p.monto}
              marcas={p.vencido && <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">vencido</Badge>}
            />
          ))}
        </Seccion>
        <Seccion titulo={`Ya pagado (${d.pagados.length})`} vacio="Todavía no se pagó nada de este mes.">
          {d.pagados.map((p, i) => (
            <Linea
              key={`${p.id}-${i}`}
              titulo={conceptoPago(p)}
              detalle={unir([
                p.eventoNombre,
                p.sinMovimiento ? "no figura en la caja" : p.fechaPago && `pagado ${formatFecha(p.fechaPago)}`,
              ])}
              monto={p.monto}
              montoClassName="text-[var(--accent)]"
            />
          ))}
        </Seccion>
      </ListaConFlechas>
    </div>
  )
}

function Encabezado({ icono, titulo, ayuda }: { icono: ReactNode; titulo: string; ayuda: string }) {
  return (
    <div className="border-b px-4 pb-2 pt-3">
      <p className="flex items-center gap-2 text-sm font-semibold">
        {icono}
        {titulo}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{ayuda}</p>
    </div>
  )
}

interface FilaResumen {
  label: string
  valor: number
  className?: string
  destacado?: boolean
}

function Resumen({
  filas,
  hecho,
  total,
  textoAvance,
  colorBarra,
}: {
  filas: FilaResumen[]
  hecho: number
  total: number
  textoAvance: string
  colorBarra: string
}) {
  const porcentaje = total > 0 ? Math.min(100, Math.round((hecho / total) * 100)) : 0
  return (
    <div className="space-y-1.5 border-b px-4 py-3">
      {filas.map((f) => (
        <div key={f.label} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{f.label}</span>
          <span className={`tabular-nums ${f.destacado ? "font-bold" : "font-medium"} ${f.className ?? ""}`}>
            {formatCurrency(f.valor)}
          </span>
        </div>
      ))}
      <div className="pt-1">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={porcentaje}
          aria-label={`${porcentaje} % ${textoAvance}`}
        >
          <div className={`h-full rounded-full ${colorBarra}`} style={{ width: `${porcentaje}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {porcentaje} % {textoAvance}
        </p>
      </div>
    </div>
  )
}

function Seccion({ titulo, vacio, children }: { titulo: string; vacio: string; children: ReactNode[] }) {
  return (
    <section className="py-1.5">
      <h4 className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h4>
      {children.length === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">{vacio}</p>
      ) : (
        <ul className="divide-y">{children}</ul>
      )}
    </section>
  )
}

function Linea({
  titulo,
  detalle,
  monto,
  marcas,
  montoClassName,
}: {
  titulo: string
  detalle: string
  monto: number
  marcas?: ReactNode
  montoClassName?: string
}) {
  return (
    <li className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium leading-snug">{titulo}</p>
        {detalle && <p className="text-[11px] leading-snug text-muted-foreground">{detalle}</p>}
        {marcas && <div className="mt-0.5 flex flex-wrap gap-1">{marcas}</div>}
      </div>
      <span className={`shrink-0 text-sm font-semibold tabular-nums ${montoClassName ?? ""}`}>{formatCurrency(monto)}</span>
    </li>
  )
}

// Scroll interno sin barra nativa, con flechas que aparecen solo cuando hay
// contenido oculto en esa dirección (DESIGN.md, regla 4).
function ListaConFlechas({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hayArriba, setHayArriba] = useState(false)
  const [hayAbajo, setHayAbajo] = useState(false)
  const actualizar = useCallback(() => {
    const el = ref.current
    if (!el) return
    setHayArriba(el.scrollTop > 4)
    setHayAbajo(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
  }, [])
  useEffect(() => {
    actualizar()
    const el = ref.current
    if (!el || typeof ResizeObserver === "undefined") return
    const observador = new ResizeObserver(actualizar)
    observador.observe(el)
    return () => observador.disconnect()
  }, [actualizar])
  const mover = (direccion: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy({ top: direccion * el.clientHeight * 0.7, behavior: "smooth" })
  }
  return (
    <div className="relative">
      <Flecha visible={hayArriba} arriba onClick={() => mover(-1)} />
      <div ref={ref} onScroll={actualizar} className="no-scrollbar max-h-[min(50vh,340px)] overflow-y-auto px-4 py-1">
        {children}
      </div>
      <Flecha visible={hayAbajo} onClick={() => mover(1)} />
    </div>
  )
}

// La flecha va sobre una franja que difumina el borde de la lista, así no
// tapa a medias el texto de la fila que queda debajo.
function Flecha({ visible, arriba = false, onClick }: { visible: boolean; arriba?: boolean; onClick: () => void }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-10 flex h-9 justify-center from-popover to-transparent transition-opacity ${
        arriba ? "top-0 items-start bg-gradient-to-b pt-1" : "bottom-0 items-end bg-gradient-to-t pb-1"
      } ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <button
        type="button"
        onClick={onClick}
        tabIndex={visible ? 0 : -1}
        aria-hidden={!visible}
        aria-label={arriba ? "Ver más arriba" : "Ver más abajo"}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm ${
          visible ? "pointer-events-auto" : ""
        }`}
      >
        {arriba ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

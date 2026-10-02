"use client"

// Planilla de cuotas de Cobrar cuota (/eventos/pagos): filas = eventos
// agrupados por salón, columnas = meses. Cada celda muestra la cuota que vence
// ese mes ("C3") con su estado. SOLO VISUAL: el estado sale tal cual de
// generarCalendarioCuotas (pendiente / parcial / pagada); acá no se calcula
// ningún monto ni IPC. Tocar una cuota pendiente o parcial avisa a la página,
// que abre el cobro como siempre.

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { SalonDot } from "@/components/salon-badge"
import { generarCalendarioCuotas, salonLabel, SALONES, type EventoGuardado } from "@/lib/store"
import { formatCurrency } from "@/lib/utils-financieros"

type CuotaCalendario = ReturnType<typeof generarCalendarioCuotas>[number]

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const MESES_LARGOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const SIN_SALON = "__sin_salon__"
// Subgrupos por fecha del evento dentro de cada salón
const YA_REALIZADOS = "__ya_realizados__"
const SIN_FECHA = "__sin_fecha__"

/** "2026-10" → "oct 26" */
function etiquetaMes(mes: string): string {
  const [anio, m] = mes.split("-").map(Number)
  return `${MESES_CORTOS[m - 1]} ${String(anio).slice(2)}`
}

function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  let [anio, mes] = desde.split("-").map(Number)
  const [anioFin, mesFin] = hasta.split("-").map(Number)
  while (anio < anioFin || (anio === anioFin && mes <= mesFin)) {
    out.push(`${anio}-${String(mes).padStart(2, "0")}`)
    mes++
    if (mes > 12) {
      mes = 1
      anio++
    }
  }
  return out
}

type Tono = "pagada" | "parcial" | "atrasada" | "futura"

// Estado visual de una cuota: el estado (pagada/parcial/pendiente) es el del
// sistema; acá solo se decide el color de una pendiente según su mes.
function tonoDe(cuota: CuotaCalendario, mesActual: string): Tono {
  if (cuota.estado === "pagada") return "pagada"
  if (cuota.estado === "parcial") return "parcial"
  return cuota.fechaVencimiento.slice(0, 7) <= mesActual ? "atrasada" : "futura"
}

const ESTILO_TONO: Record<Tono, string> = {
  pagada: "bg-emerald-100 text-emerald-800 border-emerald-300",
  parcial: "bg-amber-100 text-amber-900 border-amber-300",
  atrasada: "bg-red-100 text-red-800 border-red-300",
  futura: "bg-muted text-muted-foreground border-border",
}

const TITULO_TONO: Record<Tono, string> = {
  pagada: "Pagada",
  parcial: "Pago parcial",
  atrasada: "Sin cobrar",
  futura: "Todavía no vence",
}

interface FilaEvento {
  evento: EventoGuardado
  cuotasPorMes: Map<string, CuotaCalendario[]>
  totalCuotas: number
  todoPagado: boolean
}

export function PlanillaCuotas({
  eventos,
  hoy,
  onCobrarCuota,
}: {
  eventos: EventoGuardado[]
  /** "YYYY-MM-DD" de hoy (fecha del sistema). */
  hoy: string
  /** Se tocó una cuota pendiente o parcial: la página abre su cobro. */
  onCobrarCuota: (evento: EventoGuardado, numeroCuota: number) => void
}) {
  const mesActual = hoy.slice(0, 7)
  const [ocultarPagados, setOcultarPagados] = useState(true)

  // Salones desplegados: al entrar, todos arrancan plegados.
  const [abiertos, setAbiertos] = useState<string[]>([])
  const togglePlegado = (salon: string) =>
    setAbiertos((prev) => (prev.includes(salon) ? prev.filter((s) => s !== salon) : [...prev, salon]))

  // Una fila por evento con plan de cuotas (mismo universo que la tarjeta
  // anterior: sin cancelados ni archivados).
  const filas = useMemo<FilaEvento[]>(() => {
    return eventos
      .filter((e) => e.estado !== "cancelado" && e.estado !== "completado" && (e.planDeCuotas?.numeroCuotas ?? 0) > 0)
      .map((evento) => {
        const cuotas = generarCalendarioCuotas(evento).filter((c) => /^\d{4}-\d{2}/.test(c.fechaVencimiento))
        const cuotasPorMes = new Map<string, CuotaCalendario[]>()
        for (const c of cuotas) {
          const mes = c.fechaVencimiento.slice(0, 7)
          cuotasPorMes.set(mes, [...(cuotasPorMes.get(mes) ?? []), c])
        }
        return {
          evento,
          cuotasPorMes,
          totalCuotas: cuotas.length,
          todoPagado: cuotas.length > 0 && cuotas.every((c) => c.estado === "pagada"),
        }
      })
      .filter((f) => f.totalCuotas > 0)
  }, [eventos])

  const visibles = useMemo(() => (ocultarPagados ? filas.filter((f) => !f.todoPagado) : filas), [filas, ocultarPagados])
  const cantidadPagados = filas.filter((f) => f.todoPagado).length

  // Grupos por salón, en el orden de SALONES; "Sin salón" al final.
  const grupos = useMemo(() => {
    const porSalon = new Map<string, FilaEvento[]>()
    for (const f of visibles) {
      const clave = f.evento.salon || SIN_SALON
      porSalon.set(clave, [...(porSalon.get(clave) ?? []), f])
    }
    const orden = [
      ...SALONES.filter((s) => porSalon.has(s)),
      ...[...porSalon.keys()].filter((s) => s !== SIN_SALON && !(SALONES as readonly string[]).includes(s)),
      ...(porSalon.has(SIN_SALON) ? [SIN_SALON] : []),
    ]
    return orden.map((salon) => ({
      salon,
      filas: porSalon.get(salon)!.sort((a, b) => (a.evento.fecha || "").localeCompare(b.evento.fecha || "")),
    }))
  }, [visibles])

  // Columnas: del primer al último mes con alguna cuota, siempre incluyendo el actual.
  const meses = useMemo(() => {
    let min = mesActual
    let max = mesActual
    for (const f of visibles) {
      for (const mes of f.cuotasPorMes.keys()) {
        if (mes < min) min = mes
        if (mes > max) max = mes
      }
    }
    return mesesEntre(min, max)
  }, [visibles, mesActual])

  // Al entrar (y al cambiar el filtro), el mes actual queda a la vista.
  const scrollRef = useRef<HTMLDivElement>(null)
  const mesActualRef = useRef<HTMLTableCellElement>(null)
  useEffect(() => {
    const cont = scrollRef.current
    const th = mesActualRef.current
    if (!cont || !th) return
    const fija = cont.querySelector<HTMLElement>("[data-columna-fija]")?.offsetWidth ?? 0
    cont.scrollLeft = Math.max(0, th.offsetLeft - fija - (cont.clientWidth - fija - th.offsetWidth) / 2)
  }, [meses, ocultarPagados])

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-amber-600" />
              Planilla de cuotas
            </CardTitle>
            <CardDescription>Cada celda es la cuota que vence ese mes. Tocá una sin cobrar para registrar el pago.</CardDescription>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
            <Switch checked={ocultarPagados} onCheckedChange={setOcultarPagados} aria-label="Ocultar eventos 100% pagados" />
            Ocultar eventos 100% pagados
            {cantidadPagados > 0 && <span className="text-xs text-muted-foreground">({cantidadPagados})</span>}
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
          {(["pagada", "parcial", "atrasada", "futura"] as Tono[]).map((t) => (
            <span key={t} className="flex items-center gap-1">
              <span className={`inline-block h-3 w-3 rounded-sm border ${ESTILO_TONO[t]}`} />
              {t === "atrasada" ? "Atrasada o del mes, sin cobrar" : t === "futura" ? "Futura" : t === "parcial" ? "Parcial (falta)" : "Pagada"}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2 sm:px-6">
        {visibles.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            {ocultarPagados && filas.length > 0 ? "Todos los eventos tienen sus cuotas pagadas." : "No hay eventos con plan de cuotas."}
          </p>
        ) : (
          <div ref={scrollRef} className="max-h-[70vh] overflow-auto border-y sm:rounded-md sm:border">
            <table className="w-max border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th
                    data-columna-fija
                    className="sticky left-0 top-0 z-30 w-[132px] min-w-[132px] border-b border-r bg-background px-2 py-2 text-left font-semibold sm:w-[200px] sm:min-w-[200px]"
                  >
                    Evento
                  </th>
                  {meses.map((mes) => {
                    const esActual = mes === mesActual
                    return (
                      <th
                        key={mes}
                        ref={esActual ? mesActualRef : undefined}
                        className={`sticky top-0 z-20 min-w-[76px] border-b px-1 py-2 text-center font-semibold capitalize ${
                          esActual ? "bg-amber-100 text-amber-900" : "bg-background text-muted-foreground"
                        }`}
                      >
                        {etiquetaMes(mes)}
                        {esActual && <span className="block text-[9px] font-medium normal-case">este mes</span>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <GrupoSalon
                    key={g.salon}
                    salon={g.salon}
                    filas={g.filas}
                    meses={meses}
                    hoy={hoy}
                    plegado={!abiertos.includes(g.salon)}
                    onTogglePlegado={() => togglePlegado(g.salon)}
                    onCobrarCuota={onCobrarCuota}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GrupoSalon({
  salon,
  filas,
  meses,
  hoy,
  plegado,
  onTogglePlegado,
  onCobrarCuota,
}: {
  salon: string
  filas: FilaEvento[]
  meses: string[]
  hoy: string
  plegado: boolean
  onTogglePlegado: () => void
  onCobrarCuota: (evento: EventoGuardado, numeroCuota: number) => void
}) {
  const mesActual = hoy.slice(0, 7)
  // Cuotas sin cobrar que ya vencieron o vencen este mes (rojas o parciales):
  // se muestran en el título para que no se pierdan con el salón plegado.
  const urgentes = filas.reduce(
    (n, f) => n + [...f.cuotasPorMes.values()].flat().filter((c) => tonoDe(c, mesActual) === "atrasada" || c.estado === "parcial").length,
    0,
  )

  // Subgrupos por fecha del evento, del más próximo al más lejano: primero los
  // que ya se hicieron y todavía deben cuotas, después mes a mes.
  const subgrupos = useMemo(() => {
    const porClave = new Map<string, FilaEvento[]>()
    for (const f of filas) {
      const fecha = f.evento.fecha || ""
      const clave = !/^\d{4}-\d{2}/.test(fecha) ? SIN_FECHA : fecha < hoy ? YA_REALIZADOS : fecha.slice(0, 7)
      porClave.set(clave, [...(porClave.get(clave) ?? []), f])
    }
    const claves = [...porClave.keys()].sort((a, b) => {
      const peso = (k: string) => (k === YA_REALIZADOS ? 0 : k === SIN_FECHA ? 2 : 1)
      return peso(a) - peso(b) || a.localeCompare(b)
    })
    return claves.map((clave) => ({
      clave,
      titulo:
        clave === YA_REALIZADOS
          ? "Ya realizados"
          : clave === SIN_FECHA
            ? "Sin fecha"
            : `${MESES_LARGOS[Number(clave.slice(5, 7)) - 1]} ${clave.slice(0, 4)}`,
      filas: porClave.get(clave)!,
    }))
  }, [filas, hoy])

  return (
    <>
      {/* Fila de título del salón (plegable): el nombre queda fijo a la izquierda */}
      <tr>
        <td className="sticky left-0 z-10 border-b border-r bg-muted p-0 font-semibold">
          <button
            type="button"
            onClick={onTogglePlegado}
            aria-expanded={!plegado}
            className="flex min-h-0 w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted-foreground/10"
            title={plegado ? "Desplegar salón" : "Plegar salón"}
          >
            {plegado ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
            {salon !== SIN_SALON && <SalonDot salon={salon} size={8} />}
            <span className="truncate">{salon === SIN_SALON ? "Sin salón" : salonLabel(salon)}</span>
            <span className="text-[10px] font-normal text-muted-foreground">{filas.length}</span>
            {plegado && urgentes > 0 && (
              <span className="ml-auto shrink-0 rounded bg-red-100 px-1 text-[10px] font-semibold text-red-800" title="Cuotas sin cobrar vencidas o del mes">
                {urgentes}
              </span>
            )}
          </button>
        </td>
        <td colSpan={meses.length} className="border-b bg-muted" />
      </tr>
      {!plegado &&
        subgrupos.map((sg) => (
          <SubgrupoFecha key={sg.clave} titulo={sg.titulo} filas={sg.filas} meses={meses} mesActual={mesActual} onCobrarCuota={onCobrarCuota} />
        ))}
    </>
  )
}

function SubgrupoFecha({
  titulo,
  filas,
  meses,
  mesActual,
  onCobrarCuota,
}: {
  titulo: string
  filas: FilaEvento[]
  meses: string[]
  mesActual: string
  onCobrarCuota: (evento: EventoGuardado, numeroCuota: number) => void
}) {
  return (
    <>
      {/* Subtítulo: mes del evento */}
      <tr>
        <td className="sticky left-0 z-10 border-b border-r bg-background px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo} <span className="font-normal">· {filas.length}</span>
        </td>
        <td colSpan={meses.length} className="border-b bg-background" />
      </tr>
      {filas.map((f) => (
        <tr key={f.evento.id} className="group">
          <td className="sticky left-0 z-10 w-[132px] min-w-[132px] max-w-[132px] border-b border-r bg-background px-2 py-1 group-hover:bg-muted/60 sm:w-[200px] sm:min-w-[200px] sm:max-w-[200px]">
            <span className="block truncate font-medium" title={f.evento.nombrePareja || f.evento.nombre}>
              {f.evento.nombrePareja || f.evento.nombre || "Sin nombre"}
            </span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {f.evento.fecha ? f.evento.fecha.split("-").reverse().join("/") : "Sin fecha"} · {f.totalCuotas} cuotas
            </span>
          </td>
          {meses.map((mes) => {
            const cuotas = f.cuotasPorMes.get(mes) ?? []
            return (
              <td key={mes} className={`border-b px-1 py-1 text-center align-middle ${mes === mesActual ? "bg-amber-50" : ""}`}>
                <div className="flex flex-col items-center gap-0.5">
                  {cuotas.map((c) => {
                    const tono = tonoDe(c, mesActual)
                    const cobrable = c.estado === "pendiente" || c.estado === "parcial"
                    const contenido = (
                      <>
                        <span className="font-semibold">C{c.numeroCuota}</span>
                        {c.estado === "parcial" && (
                          <span className="block text-[9px] leading-tight">falta {formatCurrency(c.saldoRestante)}</span>
                        )}
                      </>
                    )
                    const clase = `min-h-0 w-full min-w-[64px] rounded border px-1 py-1 text-[11px] leading-tight ${ESTILO_TONO[tono]}`
                    const titulo = `Cuota ${c.numeroCuota} · vence ${c.fechaVencimiento.split("-").reverse().join("/")} · ${TITULO_TONO[tono]}`
                    return cobrable ? (
                      <button
                        key={c.numeroCuota}
                        type="button"
                        onClick={() => onCobrarCuota(f.evento, c.numeroCuota)}
                        title={`${titulo} · tocá para cobrar`}
                        className={`${clase} cursor-pointer transition-shadow hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                      >
                        {contenido}
                      </button>
                    ) : (
                      <span key={c.numeroCuota} title={titulo} className={`${clase} block`}>
                        {contenido}
                      </span>
                    )
                  })}
                </div>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

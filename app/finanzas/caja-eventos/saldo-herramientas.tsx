"use client"

/**
 * Herramientas del saldo de Caja Eventos:
 *
 * 1. DESGLOSE DEL SALDO — "¿De dónde sale este número?": lista cada evento
 *    con cuánto dinero entró (señas/cuotas) y cuánto salió, más los gastos
 *    generales, retiros y ajustes que no pertenecen a ningún evento.
 *    La suma de todas las filas es EXACTAMENTE el saldo actual.
 *
 * 2. CONCILIACIÓN DE CAJA — "Poner el sistema a la realidad": se cuenta la
 *    plata física por salón y el sistema registra UN ajuste (ingreso o egreso)
 *    que lleva el saldo del salón al número contado. Práctica contable
 *    estándar de saldo de apertura / arqueo de caja.
 */

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Badge } from "@/components/ui/badge"
import { useStore } from "@/lib/store-context"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils-financieros"
import { SALONES, salonLabel, generateId } from "@/lib/store"
import { SalonDot } from "@/components/salon-badge"
import { ConfirmAction } from "@/components/confirm-action"
import { ListTree, Scale, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Wallet, ChevronDown } from "lucide-react"
import { avisosSaldoCajaEventos } from "@/lib/avisos-saldo-caja-eventos"
import { tablaSaldoCajaEventos } from "@/lib/tabla-saldo-caja-eventos"
import { calcularCostoEventoCajaEventos } from "@/lib/costo-evento"
import type { EventoGuardado } from "@/lib/store"

// ============================================================
// Tipos internos
// ============================================================
interface FilaEvento {
  eventoId: string
  nombre: string
  salon: string | null
  ingresos: number
  /** Parte de los ingresos que son señas y cuotas (solo para mostrar). */
  senas: number
  cuotas: number
  egresos: number
}

interface DesgloseData {
  filasEventos: FilaEvento[]
  gastosGenerales: { concepto: string; monto: number; salon: string | null }[]
  retiros: { concepto: string; monto: number; salon: string | null }[]
  ajustes: { concepto: string; monto: number; tipo: string; salon: string | null }[]
  otrosIngresos: { concepto: string; monto: number; salon: string | null }[]
  totalIngresos: number
  totalEgresos: number
  saldo: number
}

// "2026-09-25" → "25/9/26", para los avisos.
function fechaCorta(fecha: string): string {
  const [y, m, d] = fecha.slice(0, 10).split("-")
  return y && m && d ? `${Number(d)}/${Number(m)}/${y.slice(2)}` : fecha
}

// ============================================================
// Componente principal: dos botones + dos diálogos
// ============================================================
export function SaldoHerramientasEventos({
  salonFiltro,
  desgloseAbierto: desgloseControlado,
  onDesgloseAbiertoChange,
  onVerPatrimonio,
}: {
  salonFiltro: string
  /** Si se pasa, la página abre el desglose (tocando la tarjeta Saldo actual). */
  desgloseAbierto?: boolean
  onDesgloseAbiertoChange?: (abierto: boolean) => void
  /** Abre la ventana de efectivo + stock y retiros de la página. */
  onVerPatrimonio?: () => void
}) {
  const { state, addMovimientosCaja, archivarGasto } = useStore()
  const { toast } = useToast()
  const [desgloseLocal, setDesgloseLocal] = useState(false)
  const desgloseAbierto = desgloseControlado ?? desgloseLocal
  const setDesgloseAbierto = (v: boolean) => {
    setDesgloseLocal(v)
    onDesgloseAbiertoChange?.(v)
  }
  const [conciliarAbierto, setConciliarAbierto] = useState(false)

  // Costo del stock de cocina (pedido de Rodrigo, 3/11/2026): la misma cuenta
  // de "Tengo ahora" en la página (stock actual × precio por unidad de cada
  // insumo). Es de todos los salones: `stockActual` es la suma de los salones.
  // Solo se muestra, no entra en el saldo.
  const valorStockCocina = useMemo(
    () => (state.insumos ?? []).reduce((sum, ins) => sum + (ins.stockActual ?? 0) * (ins.precioUnitario ?? 0), 0),
    [state.insumos],
  )

  // ----------------------------------------------------------
  // DESGLOSE: agrupa todos los movimientos de caja_eventos
  // ----------------------------------------------------------
  const desglose: DesgloseData = useMemo(() => {
    const salonSel = salonFiltro !== "todos" ? salonFiltro : null
    const movs = (state.movimientosCaja || []).filter(
      (m) => m.cajaDestino === "caja_eventos" && (!salonSel || m.salon === salonSel),
    )
    const eventosPorId = new Map((state.eventos || []).map((e) => [e.id, e]))

    const porEvento = new Map<string, FilaEvento>()
    const gastosGenerales: DesgloseData["gastosGenerales"] = []
    const retiros: DesgloseData["retiros"] = []
    const ajustes: DesgloseData["ajustes"] = []
    const otrosIngresos: DesgloseData["otrosIngresos"] = []
    let totalIngresos = 0
    let totalEgresos = 0

    for (const m of movs) {
      const monto = m.monto
      if (m.tipo === "ingreso") totalIngresos += monto
      else if (m.tipo === "egreso") totalEgresos += monto
      else continue

      // ¿Pertenece a un evento?
      if (m.eventoId) {
        const ev = eventosPorId.get(m.eventoId)
        const nombre =
          ev?.nombrePareja || ev?.nombre || ev?.tipoEvento || "Evento eliminado"
        const fila = porEvento.get(m.eventoId) ?? {
          eventoId: m.eventoId,
          nombre,
          salon: ev?.salon ?? m.salon ?? null,
          ingresos: 0,
          senas: 0,
          cuotas: 0,
          egresos: 0,
        }
        if (m.tipo === "ingreso") {
          fila.ingresos += monto
          if (/^se[ñn]a\b/i.test(m.concepto || "")) fila.senas += monto
          else if (/^cuota\s+\d+/i.test(m.concepto || "")) fila.cuotas += monto
        } else fila.egresos += monto
        porEvento.set(m.eventoId, fila)
        continue
      }

      // Sin evento: clasificamos por concepto
      const c = m.concepto || ""
      if (/^Retiro\s*-/i.test(c) || /extracci[oó]n/i.test(c)) {
        retiros.push({ concepto: c, monto, salon: m.salon || null })
      } else if (/ajuste|conciliaci[oó]n/i.test(c)) {
        ajustes.push({ concepto: c, monto, tipo: m.tipo, salon: m.salon || null })
      } else if (m.tipo === "egreso") {
        gastosGenerales.push({ concepto: c, monto, salon: m.salon || null })
      } else {
        otrosIngresos.push({ concepto: c, monto, salon: m.salon || null })
      }
    }

    const filasEventos = [...porEvento.values()].sort(
      (a, b) => b.ingresos - b.egresos - (a.ingresos - a.egresos),
    )

    return {
      filasEventos,
      gastosGenerales: gastosGenerales.sort((a, b) => b.monto - a.monto),
      retiros: retiros.sort((a, b) => b.monto - a.monto),
      ajustes,
      otrosIngresos: otrosIngresos.sort((a, b) => b.monto - a.monto),
      totalIngresos,
      totalEgresos,
      saldo: totalIngresos - totalEgresos,
    }
  }, [state.movimientosCaja, state.eventos, salonFiltro])

  // Avisos: por qué el saldo del sistema puede no ser la plata que hay.
  const avisos = useMemo(
    () =>
      avisosSaldoCajaEventos(
        state.movimientosCaja || [],
        state.eventos || [],
        salonFiltro !== "todos" ? salonFiltro : null,
      ),
    [state.movimientosCaja, state.eventos, salonFiltro],
  )
  // Tabla por evento: vendido, pagado, costo (la cuenta de Costos del evento)
  // y lo que entró a Caja Eventos. Se calcula solo con el desglose abierto.
  const tabla = useMemo(() => {
    if (!desgloseAbierto) return null
    return tablaSaldoCajaEventos(
      state.movimientosCaja || [],
      state.eventos || [],
      salonFiltro !== "todos" ? salonFiltro : null,
      (ev) => calcularCostoEventoCajaEventos(ev as EventoGuardado, state).costoTotalEvento,
    )
  }, [desgloseAbierto, state, salonFiltro])

  const cantidadAvisos =
    avisos.cuotasRepetidas.length + avisos.todoACajaEventos.length + avisos.finalizadosSinPagar.length
  const hayAvisos = cantidadAvisos > 0
  // Las excepciones arrancan plegadas en un botón (pedido de Rodrigo, 2/11/2026).
  const [verExcepciones, setVerExcepciones] = useState(false)
  // Cada vez que se abre el desglose, las excepciones vuelven a arrancar plegadas.
  useEffect(() => {
    if (desgloseAbierto) setVerExcepciones(false)
  }, [desgloseAbierto])

  // ----------------------------------------------------------
  // CONCILIACIÓN: saldo del sistema por salón + plata contada
  // ----------------------------------------------------------
  const saldoPorSalon = useMemo(() => {
    const r: Record<string, number> = {}
    for (const s of SALONES) r[s] = 0
    for (const m of state.movimientosCaja || []) {
      if (m.cajaDestino !== "caja_eventos" || !m.salon) continue
      if (!(m.salon in r)) r[m.salon] = 0
      r[m.salon] += m.tipo === "ingreso" ? m.monto : -m.monto
    }
    return r
  }, [state.movimientosCaja])

  const salonesAConciliar = salonFiltro !== "todos" ? [salonFiltro] : [...SALONES]
  // Monto contado por salón: null = "no tocar este salón"
  const [contado, setContado] = useState<Record<string, number | null>>({})

  const ajustesPendientes = salonesAConciliar
    .map((s) => {
      const real = contado[s]
      if (real === null || real === undefined) return null
      const sistema = saldoPorSalon[s] ?? 0
      const diff = Math.round((real - sistema) * 100) / 100
      if (diff === 0) return null
      return { salon: s, sistema, real, diff }
    })
    .filter(Boolean) as { salon: string; sistema: number; real: number; diff: number }[]

  function aplicarConciliacion() {
    if (ajustesPendientes.length === 0) return
    const hoyISO = new Date().toISOString()
    const fechaCorta = hoyISO.slice(0, 10)

    // Un movimiento por salón: ingreso si falta registrar plata, egreso si sobra.
    let saldoAcum = (state.movimientosCaja || [])
      .filter((m) => m.cajaDestino === "caja_eventos")
      .reduce((sum, m) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto), 0)

    const nuevos = ajustesPendientes.map((a) => {
      const esIngreso = a.diff > 0
      const monto = Math.abs(a.diff)
      saldoAcum += esIngreso ? monto : -monto
      return {
        id: generateId(),
        fecha: hoyISO,
        tipo: esIngreso ? ("ingreso" as const) : ("egreso" as const),
        concepto: `Ajuste de conciliación - saldo real al ${fechaCorta}`,
        monto,
        salon: a.salon,
        cajaDestino: "caja_eventos" as const,
        saldoResultante: saldoAcum,
      }
    })
    addMovimientosCaja(nuevos)

    // Los egresos de conciliación quedan en el Archivo Histórico como
    // gastos no registrados en su momento.
    for (const a of ajustesPendientes) {
      if (a.diff < 0) {
        archivarGasto({
          fecha: fechaCorta,
          concepto: `Ajuste de conciliación - gastos históricos no cargados`,
          monto: Math.abs(a.diff),
          salon: a.salon,
          origen: "caja_eventos",
          categoria: "conciliación",
          eventoId: null,
          eventoNombre: null,
          refId: null,
        })
      }
    }

    // Configuración > Actividad
    fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "caja",
        accion: "conciliación",
        nombre: `Caja Eventos · conciliación de ${ajustesPendientes.length} salón/es`,
        detalle: ajustesPendientes
          .map(
            (a) =>
              `${salonLabel(a.salon)}: sistema ${formatCurrency(a.sistema)} → real ${formatCurrency(a.real)} (ajuste ${a.diff > 0 ? "+" : "−"}${formatCurrency(Math.abs(a.diff))})`,
          )
          .join(" | "),
      }),
    }).catch(() => {})

    toast({
      title: "Conciliación aplicada",
      description: `Se ajustó el saldo de ${ajustesPendientes
        .map((a) => salonLabel(a.salon))
        .join(" y ")} al dinero contado.`,
    })
    setContado({})
    setConciliarAbierto(false)
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs bg-transparent"
          onClick={() => setDesgloseAbierto(true)}
        >
          <ListTree className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Desglose</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs bg-transparent"
          onClick={() => setConciliarAbierto(true)}
        >
          <Scale className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Conciliar</span>
        </Button>
      </div>

      {/* ══════════════ DIALOG 1: DESGLOSE DEL SALDO ══════════════ */}
      <Dialog open={desgloseAbierto} onOpenChange={setDesgloseAbierto}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Desglose del saldo</DialogTitle>
            <DialogDescription>
              De dónde sale el saldo de Caja Eventos
              {salonFiltro !== "todos" ? ` · ${salonLabel(salonFiltro)}` : ""}: cuánto
              entró y salió por cada evento, más los movimientos generales.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 min-w-0">
            {/* Costo del stock de cocina: aparte del saldo */}
            <div className="rounded-lg border border-border px-3 py-2.5 flex flex-col gap-1">
              <div className="flex justify-between gap-2 text-sm font-semibold">
                <span>Stock de cocina (costo)</span>
                <span className="tabular-nums">{formatCurrency(valorStockCocina)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Lo que hay en el Almacén de cocina, al precio de la última compra de cada insumo
                {salonFiltro !== "todos" ? ", de todos los salones" : ""}. No está sumado en el saldo.
              </p>
            </div>

            {/* Cuenta resumida */}
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 flex flex-col gap-1">
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Entró</span>
                <span className="font-medium text-emerald-600 tabular-nums">+{formatCurrency(desglose.totalIngresos)}</span>
              </div>
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Salió</span>
                <span className="font-medium text-red-500 tabular-nums">−{formatCurrency(desglose.totalEgresos)}</span>
              </div>
              <div className="flex justify-between gap-2 text-base font-bold pt-1 border-t border-border">
                <span>Saldo según el sistema</span>
                <span className="tabular-nums">{formatCurrency(desglose.saldo)}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                De cada seña y cuota, a Caja Eventos entra solo la parte del costo del evento más el 5 %; el resto va a
                Caja Jazmines. Si la plata contada no coincide, usá Conciliar.
              </p>
            </div>

            {hayAvisos && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setVerExcepciones((v) => !v)}
                aria-expanded={verExcepciones}
                className="w-full justify-between gap-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Excepciones ({cantidadAvisos})
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${verExcepciones ? "rotate-180" : ""}`} />
              </Button>
            )}

            {hayAvisos && verExcepciones && (
              <section className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex flex-col gap-3 dark:bg-amber-950/30 dark:border-amber-800">
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  Pueden hacer que el saldo no sea la plata real. Son para revisar: no se corrigen solas.
                </p>

                {avisos.cuotasRepetidas.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      Cuotas anotadas más de una vez ({avisos.cuotasRepetidas.length})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      La caja tiene más cobros de la cuota que pagos el evento: probablemente sobra una fila.
                    </p>
                    {avisos.cuotasRepetidas.map((c) => (
                      <div key={`${c.eventoId}-${c.numeroCuota}`} className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                        <span className="min-w-0 truncate">
                          {c.nombre} {c.fechaEvento && <span className="text-xs text-muted-foreground">· {fechaCorta(c.fechaEvento)}</span>} · Cuota {c.numeroCuota}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {c.montos.map((m) => formatCurrency(m)).join(" + ")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {avisos.todoACajaEventos.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      Cobros que fueron enteros a Caja Eventos ({avisos.todoACajaEventos.length} ·{" "}
                      {formatCurrency(avisos.totalTodoACajaEventos)})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      No le dejaron nada a Caja Jazmines. Antes del 2/11/2026 el costo operativo contaba en el reparto y
                      muchos eventos mandaban todo acá; lo ya anotado no se reparte de nuevo.
                    </p>
                    {avisos.todoACajaEventos.map((c) => (
                      <div key={c.eventoId} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          {c.nombre} {c.fechaEvento && <span className="text-xs text-muted-foreground">· {fechaCorta(c.fechaEvento)}</span>}
                        </span>
                        <span className="shrink-0 tabular-nums">{formatCurrency(c.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {avisos.finalizadosSinPagar.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      Finalizados sin pago de menú o barra ({avisos.finalizadosSinPagar.length})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      No hay ningún pago de eso en Caja Eventos: si se pagó, no se anotó y esa plata sigue en el saldo.
                    </p>
                    {avisos.finalizadosSinPagar.map((f) => (
                      <div key={f.eventoId} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          {f.nombre} {f.fechaEvento && <span className="text-xs text-muted-foreground">· {fechaCorta(f.fechaEvento)}</span>}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {[f.menu && "menú", f.barra && "barra"].filter(Boolean).join(" y ")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Tabla por evento */}
            {tabla && tabla.filas.length > 0 && (
              <section className="min-w-0">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Cada evento: venta, pagos y costo ({tabla.filas.length})
                </h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[680px] text-xs tabular-nums">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="sticky left-0 bg-muted px-2 py-2 text-left font-medium">Evento</th>
                        <th className="px-2 py-2 text-right font-medium">Vendido</th>
                        <th className="px-2 py-2 text-right font-medium">Seña</th>
                        <th className="px-2 py-2 text-right font-medium">Cuotas</th>
                        <th className="px-2 py-2 text-right font-medium">Total pagado</th>
                        <th className="px-2 py-2 text-right font-medium">Costo</th>
                        <th className="px-2 py-2 text-right font-medium">Entró a Caja Eventos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tabla.filas.map((f) => (
                        <tr key={f.eventoId}>
                          <td className="sticky left-0 bg-background px-2 py-1.5 max-w-[130px]">
                            <span className="block truncate font-medium text-foreground">{f.nombre}</span>
                            {f.fechaEvento && (
                              <span className="block text-[11px] text-muted-foreground">{fechaCorta(f.fechaEvento)}</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right">{formatCurrency(f.vendido)}</td>
                          <td className="px-2 py-1.5 text-right">{formatCurrency(f.sena)}</td>
                          <td className="px-2 py-1.5 text-right">{formatCurrency(f.cuotas)}</td>
                          <td className="px-2 py-1.5 text-right">{formatCurrency(f.pagado)}</td>
                          <td className="px-2 py-1.5 text-right">{formatCurrency(f.costo)}</td>
                          <td className="px-2 py-1.5 text-right font-semibold">{formatCurrency(f.entroCajaEventos)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-border bg-muted/50 font-bold">
                      <tr>
                        <td className="sticky left-0 bg-muted px-2 py-2">Total</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(tabla.totales.vendido)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(tabla.totales.sena)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(tabla.totales.cuotas)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(tabla.totales.pagado)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(tabla.totales.costo)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(tabla.totales.entroCajaEventos)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  "Seña", "Cuotas" y "Total pagado" son lo que entró a las dos cajas. "Costo" es el de Costos del evento
                  (comida, bebida, servicios y sueldos; el de los finalizados, el guardado al finalizar). "Entró a Caja
                  Eventos" es la parte del total pagado que vino a esta caja.
                </p>
              </section>
            )}

            {/* Por evento */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Por evento ({desglose.filasEventos.length})
              </h3>
              {desglose.filasEventos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin movimientos de eventos.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {desglose.filasEventos.map((f) => (
                    <div key={f.eventoId} className="flex items-start gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.nombre}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          {f.salon && <SalonDot salon={f.salon} size={7} />}
                          {f.salon ? salonLabel(f.salon) : "Sin salón"}
                        </p>
                        {/* Qué entró (señas y cuotas por separado) y qué salió. */}
                        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-0.5 pt-0.5">
                          {f.senas > 0 && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <ArrowDownToLine className="h-3 w-3" />
                              Señas {formatCurrency(f.senas)}
                            </span>
                          )}
                          {f.cuotas > 0 && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <ArrowDownToLine className="h-3 w-3" />
                              Cuotas {formatCurrency(f.cuotas)}
                            </span>
                          )}
                          {f.ingresos - f.senas - f.cuotas > 0.005 && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <ArrowDownToLine className="h-3 w-3" />
                              Otros {formatCurrency(f.ingresos - f.senas - f.cuotas)}
                            </span>
                          )}
                          {f.egresos > 0 && (
                            <span className="inline-flex items-center gap-1 text-red-500">
                              <ArrowUpFromLine className="h-3 w-3" />
                              Salió {formatCurrency(f.egresos)}
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="text-right text-sm font-semibold shrink-0 tabular-nums">
                        {formatCurrency(f.ingresos - f.egresos)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Otros ingresos */}
            {desglose.otrosIngresos.length > 0 && (
              <SeccionMovs
                titulo={`Otros ingresos (${desglose.otrosIngresos.length})`}
                items={desglose.otrosIngresos}
                signo={1}
              />
            )}

            {/* Gastos generales */}
            {desglose.gastosGenerales.length > 0 && (
              <SeccionMovs
                titulo={`Gastos pagados (${desglose.gastosGenerales.length})`}
                items={desglose.gastosGenerales}
                signo={-1}
              />
            )}

            {/* Retiros */}
            {desglose.retiros.length > 0 && (
              <SeccionMovs
                titulo={`Retiros (${desglose.retiros.length})`}
                items={desglose.retiros}
                signo={-1}
              />
            )}

            {/* Ajustes */}
            {desglose.ajustes.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Ajustes de saldo ({desglose.ajustes.length})
                </h3>
                <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {desglose.ajustes.map((g, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{g.concepto}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          {g.salon && <SalonDot salon={g.salon} size={7} />}
                          {g.salon ? salonLabel(g.salon) : "General"}
                        </p>
                      </div>
                      <p
                        className={`text-sm font-semibold shrink-0 ${g.tipo === "ingreso" ? "text-emerald-600" : "text-red-500"}`}
                      >
                        {g.tipo === "ingreso" ? "+" : "−"}
                        {formatCurrency(g.monto)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Totales */}
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total ingresos</span>
                <span className="font-medium text-emerald-600">
                  +{formatCurrency(desglose.totalIngresos)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total egresos</span>
                <span className="font-medium text-red-500">
                  −{formatCurrency(desglose.totalEgresos)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold pt-1 border-t border-border">
                <span>Saldo actual</span>
                <span>{formatCurrency(desglose.saldo)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  setDesgloseAbierto(false)
                  setConciliarAbierto(true)
                }}
              >
                <Scale className="h-4 w-4" />
                Conciliar con la plata contada
              </Button>
              {onVerPatrimonio && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    setDesgloseAbierto(false)
                    onVerPatrimonio()
                  }}
                >
                  <Wallet className="h-4 w-4" />
                  Stock y retiros
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════ DIALOG 2: CONCILIAR CAJA ══════════════ */}
      <Dialog
        open={conciliarAbierto}
        onOpenChange={(v) => {
          setConciliarAbierto(v)
          if (!v) setContado({})
        }}
      >
        <DialogContent className="max-w-md max-h-[85dvh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Conciliar caja</DialogTitle>
            <DialogDescription>
              Contá la plata que tenés hoy en mano por salón y cargala acá. El sistema
              registra un único ajuste que deja el saldo igual al dinero real. Dejá en
              blanco los salones que no quieras tocar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 overflow-y-auto min-h-0 flex-1 pr-1">
            {salonesAConciliar.map((s) => {
              const sistema = saldoPorSalon[s] ?? 0
              const real = contado[s]
              const diff =
                real === null || real === undefined
                  ? null
                  : Math.round((real - sistema) * 100) / 100
              return (
                <div key={s} className="rounded-lg border border-border p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <SalonDot salon={s} size={8} />
                      {salonLabel(s)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Sistema: <span className="font-medium text-foreground">{formatCurrency(sistema)}</span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`contado-ev-${s}`} className="text-xs text-muted-foreground">
                      Dinero real contado
                    </Label>
                    <MoneyInput
                      id={`contado-ev-${s}`}
                      value={real ?? 0}
                      onValueChange={(v) =>
                        setContado((p) => ({ ...p, [s]: v === 0 ? null : v }))
                      }
                      placeholder="Dejar vacío para no ajustar"
                    />
                  </div>
                  {diff !== null && (
                    <Badge
                      variant="outline"
                      className={
                        diff === 0
                          ? "w-fit text-muted-foreground"
                          : diff > 0
                            ? "w-fit border-emerald-300 text-emerald-700 bg-emerald-50"
                            : "w-fit border-red-300 text-red-700 bg-red-50"
                      }
                    >
                      {diff === 0
                        ? "Coincide, no hace falta ajuste"
                        : diff > 0
                          ? `Ajuste: +${formatCurrency(diff)} (ingreso no registrado)`
                          : `Ajuste: −${formatCurrency(Math.abs(diff))} (gastos históricos no cargados)`}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>

          <DialogFooter className="gap-2 shrink-0">
            <Button variant="outline" onClick={() => setConciliarAbierto(false)}>
              Cancelar
            </Button>
            <ConfirmAction
              title="¿Aplicar conciliación?"
              description={
                ajustesPendientes.length === 0
                  ? "No hay ajustes para aplicar."
                  : ajustesPendientes
                      .map(
                        (a) =>
                          `${salonLabel(a.salon)}: ${formatCurrency(a.sistema)} → ${formatCurrency(a.real)}`,
                      )
                      .join(" · ") +
                    ". Esta acción registra los ajustes en el historial y no se deshace sola."
              }
              onConfirm={aplicarConciliacion}
            >
              <Button disabled={ajustesPendientes.length === 0}>
                Aplicar {ajustesPendientes.length > 0 ? `(${ajustesPendientes.length})` : ""}
              </Button>
            </ConfirmAction>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================================
// Sección genérica de movimientos sin evento
// ============================================================
function SeccionMovs({
  titulo,
  items,
  signo,
}: {
  titulo: string
  items: { concepto: string; monto: number; salon: string | null }[]
  signo: 1 | -1
}) {
  const [verTodos, setVerTodos] = useState(false)
  const visibles = verTodos ? items : items.slice(0, 5)
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {titulo}
      </h3>
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {visibles.map((g, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{g.concepto}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {g.salon && <SalonDot salon={g.salon} size={7} />}
                {g.salon ? salonLabel(g.salon) : "General"}
              </p>
            </div>
            <p
              className={`text-sm font-semibold shrink-0 ${signo > 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {signo > 0 ? "+" : "−"}
              {formatCurrency(g.monto)}
            </p>
          </div>
        ))}
      </div>
      {items.length > 5 && (
        <button
          type="button"
          className="mt-1.5 text-xs text-muted-foreground hover:text-foreground underline"
          onClick={() => setVerTodos((v) => !v)}
        >
          {verTodos ? "Ver menos" : `Ver los ${items.length}`}
        </button>
      )}
    </section>
  )
}

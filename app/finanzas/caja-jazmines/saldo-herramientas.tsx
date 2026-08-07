"use client"

/**
 * Herramientas del saldo de Caja Jazmines:
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

import { useMemo, useState } from "react"
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
import { ListTree, Scale, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"

// ============================================================
// Tipos internos
// ============================================================
interface FilaEvento {
  eventoId: string
  nombre: string
  salon: string | null
  ingresos: number
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

// ============================================================
// Componente principal: dos botones + dos diálogos
// ============================================================
export function SaldoHerramientas({ salonFiltro }: { salonFiltro: string }) {
  const { state, addMovimientosCaja, archivarGasto } = useStore()
  const { toast } = useToast()
  const [desgloseAbierto, setDesgloseAbierto] = useState(false)
  const [conciliarAbierto, setConciliarAbierto] = useState(false)

  // ----------------------------------------------------------
  // DESGLOSE: agrupa todos los movimientos de caja_jazmines
  // ----------------------------------------------------------
  const desglose: DesgloseData = useMemo(() => {
    const salonSel = salonFiltro !== "todos" ? salonFiltro : null
    const movs = (state.movimientosCaja || []).filter(
      (m) => m.cajaDestino === "caja_jazmines" && (!salonSel || m.salon === salonSel),
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
          egresos: 0,
        }
        if (m.tipo === "ingreso") fila.ingresos += monto
        else fila.egresos += monto
        porEvento.set(m.eventoId, fila)
        continue
      }

      // Sin evento: clasificamos por concepto
      const c = m.concepto || ""
      if (/^Retiro\s*-/i.test(c) || /extracci[oó]n/i.test(c)) {
        retiros.push({ concepto: c, monto, salon: m.salon ?? null })
      } else if (/ajuste|conciliaci[oó]n/i.test(c)) {
        ajustes.push({ concepto: c, monto, tipo: m.tipo, salon: m.salon ?? null })
      } else if (m.tipo === "egreso") {
        gastosGenerales.push({ concepto: c, monto, salon: m.salon ?? null })
      } else {
        otrosIngresos.push({ concepto: c, monto, salon: m.salon ?? null })
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

  // ----------------------------------------------------------
  // CONCILIACIÓN: saldo del sistema por salón + plata contada
  // ----------------------------------------------------------
  const saldoPorSalon = useMemo(() => {
    const r: Record<string, number> = {}
    for (const s of SALONES) r[s] = 0
    for (const m of state.movimientosCaja || []) {
      if (m.cajaDestino !== "caja_jazmines" || !m.salon) continue
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
      .filter((m) => m.cajaDestino === "caja_jazmines")
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
        cajaDestino: "caja_jazmines" as const,
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
          origen: "caja_jazmines_variable",
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
        nombre: `Caja Jazmines · conciliación de ${ajustesPendientes.length} salón/es`,
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Desglose del saldo</DialogTitle>
            <DialogDescription>
              De dónde sale el saldo de Caja Jazmines
              {salonFiltro !== "todos" ? ` · ${salonLabel(salonFiltro)}` : ""}: cuánto
              entró y salió por cada evento, más los movimientos generales.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
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
                    <div key={f.eventoId} className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.nombre}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          {f.salon && <SalonDot salon={f.salon} size={7} />}
                          {f.salon ? salonLabel(f.salon) : "Sin salón"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-emerald-600 flex items-center justify-end gap-1">
                          <ArrowDownToLine className="h-3 w-3" />
                          {formatCurrency(f.ingresos)}
                        </p>
                        {f.egresos > 0 && (
                          <p className="text-xs text-red-500 flex items-center justify-end gap-1">
                            <ArrowUpFromLine className="h-3 w-3" />
                            {formatCurrency(f.egresos)}
                          </p>
                        )}
                      </div>
                      <p className="w-28 text-right text-sm font-semibold shrink-0">
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conciliar caja</DialogTitle>
            <DialogDescription>
              Contá la plata que tenés hoy en mano por salón y cargala acá. El sistema
              registra un único ajuste que deja el saldo igual al dinero real. Dejá en
              blanco los salones que no quieras tocar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
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
                    <Label htmlFor={`contado-${s}`} className="text-xs text-muted-foreground">
                      Dinero real contado
                    </Label>
                    <MoneyInput
                      id={`contado-${s}`}
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

          <DialogFooter className="gap-2">
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

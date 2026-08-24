"use client"

/**
 * Tira de 12 mini-tarjetas de meses para cada gasto fijo.
 *
 * Cada chip muestra el estado del mes (pagado, cargado sin pagar, pendiente,
 * futuro) y al hacer click abre un popover con el monto cargado, el monto
 * sugerido según la tendencia del gasto y un campo para registrar cuánto se
 * paga. El registro escribe en historialMontos con las MISMAS reglas que la
 * carga individual (⋯ → "Cargar nuevo monto") y el check de pago de la fila,
 * así la tarjeta sigue funcionando con normalidad en Caja Jazmines.
 */

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/ui/money-input"
import { formatCurrency } from "@/lib/utils-financieros"
import { generateId, type CostoOperativo, type RegistroMonto } from "@/lib/store"
import { Check, Sparkles } from "lucide-react"

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

function mesActualISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/** "2026-08" → "agosto de 2026" */
function nombreMesLargo(mes: string): string {
  const [y, m] = mes.split("-").map(Number)
  if (!y || !m) return mes
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

/** Tendencia: promedio de los últimos 3 aumentos reales del historial. */
function tendenciaDeCosto(c: CostoOperativo): number {
  const hist = (c.historialMontos || []).slice().sort((a, b) => a.mes.localeCompare(b.mes))
  const cambios: number[] = []
  for (let i = 1; i < hist.length; i++) {
    const prev = hist[i - 1].monto
    if (prev > 0 && hist[i].monto !== prev) cambios.push((hist[i].monto - prev) / prev)
  }
  const ultimos = cambios.slice(-3)
  if (ultimos.length === 0) return 0
  return ultimos.reduce((s, x) => s + x, 0) / ultimos.length
}

/** Monto sugerido: monto vigente proyectado por la tendencia del gasto. */
function montoSugerido(c: CostoOperativo): number {
  const t = tendenciaDeCosto(c)
  return t === 0 ? c.monto : Math.round(c.monto * (1 + t))
}

type EstadoMes = "pagado" | "cargado" | "actual" | "pasado" | "futuro"

function estadoDeMes(mesISO: string, registro: RegistroMonto | undefined, hoyISO: string): EstadoMes {
  if (registro) return registro.pagado === false ? "cargado" : "pagado"
  if (mesISO === hoyISO) return "actual"
  return mesISO < hoyISO ? "pasado" : "futuro"
}

const ESTILO_CHIP: Record<EstadoMes, string> = {
  pagado: "bg-teal-600 border-teal-600 text-white hover:bg-teal-700",
  cargado: "bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200",
  actual: "bg-white border-dashed border-purple-500 text-purple-700 hover:bg-purple-50",
  pasado: "bg-muted border-border text-muted-foreground hover:bg-purple-50 hover:text-purple-700",
  futuro: "bg-transparent border-border/60 text-muted-foreground/50 hover:bg-purple-50 hover:text-purple-700",
}

export function MesesFijo({
  gasto,
  updateCostoOperativo,
}: {
  gasto: CostoOperativo
  updateCostoOperativo: (id: string, cambios: Partial<CostoOperativo>) => void
}) {
  const hoyISO = mesActualISO()
  const anio = Number(hoyISO.split("-")[0])
  const [mesAbierto, setMesAbierto] = useState<string | null>(null)
  const [montoPagar, setMontoPagar] = useState(0)

  const hist = gasto.historialMontos || []
  const registroDe = (mesISO: string) => hist.find((r) => r.mes === mesISO)
  const sugerido = montoSugerido(gasto)

  function abrirMes(mesISO: string, abierto: boolean) {
    if (!abierto) {
      setMesAbierto(null)
      return
    }
    const registro = registroDe(mesISO)
    setMesAbierto(mesISO)
    setMontoPagar(registro?.monto ?? sugerido)
  }

  /**
   * Registra el pago del mes elegido replicando las reglas existentes:
   * - Si el mes ya tenía registro, se actualiza su monto y queda pagado.
   * - Si no lo tenía, se crea el registro (montoAnterior = monto vigente).
   * - Si el mes es el período más reciente del historial, el monto pasa a ser
   *   el vigente del gasto y la fila queda tildada como pagada (incluidas las
   *   cuotas por salón si el gasto está repartido).
   */
  function registrarPago() {
    const monto = montoPagar
    if (!mesAbierto || !monto || monto <= 0) return
    const registro = registroDe(mesAbierto)
    let historial: RegistroMonto[]
    if (registro) {
      historial = hist.map((r) =>
        r.id === registro.id ? { ...r, monto, pagado: true, fecha: new Date().toISOString() } : r,
      )
    } else {
      historial = [
        ...hist,
        {
          id: generateId(),
          mes: mesAbierto,
          monto,
          montoAnterior: gasto.monto,
          fecha: new Date().toISOString(),
          pagado: true,
        },
      ].sort((a, b) => a.mes.localeCompare(b.mes))
    }
    // ¿El mes pagado es el período más reciente? → pasa a ser el monto vigente.
    const esVigente = historial.length > 0 && historial[historial.length - 1].mes === mesAbierto
    updateCostoOperativo(gasto.id, {
      historialMontos: historial,
      ...(esVigente
        ? {
            monto,
            pagado: true,
            ...(gasto.distribucion && gasto.distribucion.length > 0
              ? { distribucion: gasto.distribucion.map((d) => ({ ...d, pagado: true })) }
              : {}),
          }
        : {}),
    })
    setMesAbierto(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-1" aria-label={`Meses de ${gasto.concepto}`}>
      {MESES_CORTOS.map((nombre, i) => {
        const mesISO = `${anio}-${String(i + 1).padStart(2, "0")}`
        const registro = registroDe(mesISO)
        const estado = estadoDeMes(mesISO, registro, hoyISO)
        return (
          <Popover key={mesISO} open={mesAbierto === mesISO} onOpenChange={(o) => abrirMes(mesISO, o)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`h-6 w-8 rounded border text-[10px] font-semibold leading-none transition-colors ${ESTILO_CHIP[estado]}`}
                title={`${nombre} · ${
                  estado === "pagado"
                    ? `pagado ${formatCurrency(registro!.monto)}`
                    : estado === "cargado"
                      ? `cargado ${formatCurrency(registro!.monto)}, sin pagar`
                      : "sin monto cargado"
                }`}
              >
                {nombre.charAt(0)}
                <span className="sr-only">{`${nombre}: ${estado === "pagado" ? "pagado" : estado === "cargado" ? "cargado sin pagar" : "sin cargar"}`}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3" style={{ backgroundColor: "#ffffff" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">
                {nombreMesLargo(mesISO)}
              </p>
              <div className="mt-2 space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Monto cargado</span>
                  {registro ? (
                    <span className={`font-bold ${registro.pagado === false ? "text-amber-700" : "text-teal-700"}`}>
                      {formatCurrency(registro.monto)}
                      {registro.pagado === false ? " · debe" : " · pagado"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin cargar</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-purple-500" />
                    Sugerido
                  </span>
                  <span className="font-semibold text-purple-700">{formatCurrency(sugerido)}</span>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <label
                  htmlFor={`pago-${gasto.id}-${mesISO}`}
                  className="text-xs font-medium text-foreground"
                >
                  Voy a pagar
                </label>
                <MoneyInput
                  id={`pago-${gasto.id}-${mesISO}`}
                  value={montoPagar}
                  onValueChange={setMontoPagar}
                  className="h-8"
                />
                <Button
                  size="sm"
                  className="w-full h-8 gap-1.5 bg-teal-600 text-white hover:bg-teal-700"
                  onClick={registrarPago}
                  disabled={!montoPagar || montoPagar <= 0}
                >
                  <Check className="h-3.5 w-3.5" />
                  Registrar pago de {nombre}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )
      })}
    </div>
  )
}

"use client"

/**
 * Tira de 12 mini-tarjetas de meses para cada gasto fijo, con navegación de año.
 *
 * Cada chip muestra el estado del mes (pagado, cargado sin pagar, pendiente,
 * futuro) y al hacer click abre un popover donde se hace TODO el manejo del
 * mes: ver el monto cargado, ver el monto sugerido según la tendencia, cargar
 * un monto nuevo (queda como deuda) y marcar/desmarcar el pago. El registro
 * escribe en historialMontos con las MISMAS reglas que la carga individual
 * (⋯ → "Cargar nuevo monto") y el check de pago de la fila, así la tarjeta
 * sigue funcionando con normalidad en Caja Jazmines.
 *
 * Si se pasa `parte` (gasto repartido visto desde UN salón), todos los montos
 * visibles son la porción de ese salón, con el monto general en chiquito; los
 * montos ingresados también se interpretan como porción del salón y se
 * convierten al general antes de escribir en el historial. El pago marca la
 * cuota de ESE salón (misma regla que el check de la fila): el gasto completo
 * queda pagado solo cuando todos los salones pagaron.
 */

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/ui/money-input"
import { formatCurrency } from "@/lib/utils-financieros"
import { generateId, type CostoOperativo, type RegistroMonto } from "@/lib/store"
import { Check, ChevronLeft, ChevronRight, RotateCcw, Sparkles, Wallet } from "lucide-react"

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
  parte,
}: {
  gasto: CostoOperativo
  updateCostoOperativo: (id: string, cambios: Partial<CostoOperativo>) => void
  /** Gasto repartido visto desde un salón: porción que le corresponde. */
  parte?: { salon: string; porcentaje: number }
}) {
  const hoyISO = mesActualISO()
  const anioActual = Number(hoyISO.split("-")[0])
  const [anioVer, setAnioVer] = useState(anioActual)
  const [mesAbierto, setMesAbierto] = useState<string | null>(null)
  const [montoPagar, setMontoPagar] = useState(0)

  const hist = gasto.historialMontos || []
  const registroDe = (mesISO: string) => hist.find((r) => r.mes === mesISO)
  const sugeridoGeneral = montoSugerido(gasto)
  const mesVigente = hist.length > 0 ? hist[hist.length - 1].mes : null

  // Con `parte`, todo monto visible/ingresado es la porción del salón.
  const factor = parte ? parte.porcentaje / 100 : 1
  const aParte = (x: number) => Math.round(x * factor)
  const aGeneral = (x: number) => (parte ? Math.round((x * 100) / parte.porcentaje) : x)

  /**
   * Estado de pago del mes desde la mirada del salón: para el período vigente
   * de un gasto repartido manda la cuota del salón (distribucion), igual que
   * el check de la fila; para el resto, el flag del registro.
   */
  const pagadoDelMes = (registro: RegistroMonto) => {
    if (parte && registro.mes === mesVigente) {
      const d = gasto.distribucion?.find((x) => x.salon === parte.salon)
      if (d) return d.pagado === true
    }
    return registro.pagado !== false
  }

  const estadoDeMes = (mesISO: string, registro: RegistroMonto | undefined): EstadoMes => {
    if (registro) return pagadoDelMes(registro) ? "pagado" : "cargado"
    if (mesISO === hoyISO) return "actual"
    return mesISO < hoyISO ? "pasado" : "futuro"
  }

  // Se puede navegar desde el primer año con historial hasta 2 años adelante.
  const anioMin = Math.min(anioActual, ...hist.map((r) => Number(r.mes.split("-")[0])).filter(Boolean))
  const anioMax = anioActual + 2

  function abrirMes(mesISO: string, abierto: boolean) {
    if (!abierto) {
      setMesAbierto(null)
      return
    }
    const registro = registroDe(mesISO)
    setMesAbierto(mesISO)
    setMontoPagar(aParte(registro?.monto ?? sugeridoGeneral))
  }

  /**
   * Guarda el monto del mes elegido replicando las reglas existentes:
   * - Si el mes ya tenía registro, se actualiza su monto y su estado de pago.
   * - Si no lo tenía, se crea el registro (montoAnterior = monto vigente).
   * - Si el mes es el período más reciente del historial, el monto pasa a ser
   *   el vigente del gasto y la fila refleja el estado de pago.
   * - Con `parte`, el monto ingresado es la porción del salón (se convierte al
   *   general) y el pago marca la cuota de ese salón: el gasto completo queda
   *   pagado solo si todos los salones pagaron (regla de pagarCuotaSalon).
   */
  function guardarMes(monto: number, pagado: boolean) {
    if (!mesAbierto || !monto || monto <= 0) return
    const montoTotal = aGeneral(monto)
    const registro = registroDe(mesAbierto)

    // ¿El mes editado será el período más reciente? → pasa a ser el vigente.
    const mesesOrdenados = [...new Set([...hist.map((r) => r.mes), mesAbierto])].sort()
    const esVigente = mesesOrdenados[mesesOrdenados.length - 1] === mesAbierto

    // Reparto por salón: el pago afecta solo la cuota de este salón.
    let distActualizada = gasto.distribucion
    let pagadoGasto = pagado
    if (parte && gasto.distribucion && gasto.distribucion.length > 0) {
      distActualizada = gasto.distribucion.map((d) => (d.salon === parte.salon ? { ...d, pagado } : d))
      pagadoGasto = distActualizada.every((d) => d.pagado === true)
    } else if (gasto.distribucion && gasto.distribucion.length > 0) {
      distActualizada = gasto.distribucion.map((d) => ({ ...d, pagado }))
    }

    let historial: RegistroMonto[]
    if (registro) {
      historial = hist.map((r) =>
        r.id === registro.id
          ? { ...r, monto: montoTotal, pagado: parte ? pagadoGasto : pagado, fecha: new Date().toISOString() }
          : r,
      )
    } else {
      historial = [
        ...hist,
        {
          id: generateId(),
          mes: mesAbierto,
          monto: montoTotal,
          montoAnterior: gasto.monto,
          fecha: new Date().toISOString(),
          pagado: parte ? pagadoGasto : pagado,
        },
      ].sort((a, b) => a.mes.localeCompare(b.mes))
    }

    updateCostoOperativo(gasto.id, {
      historialMontos: historial,
      ...(esVigente
        ? {
            monto: montoTotal,
            pagado: pagadoGasto,
            ...(distActualizada ? { distribucion: distActualizada } : {}),
          }
        : {}),
    })
    setMesAbierto(null)
  }

  return (
    <div className="flex items-center gap-1.5" aria-label={`Meses de ${gasto.concepto}${parte ? ` (${parte.salon})` : ""}`}>
      <button
        type="button"
        onClick={() => setAnioVer((a) => Math.max(anioMin, a - 1))}
        disabled={anioVer <= anioMin}
        className="h-6 w-5 shrink-0 rounded border border-border text-muted-foreground transition-colors hover:bg-purple-50 hover:text-purple-700 disabled:opacity-30"
        title="Año anterior"
      >
        <ChevronLeft className="mx-auto h-3.5 w-3.5" />
        <span className="sr-only">Ver año anterior</span>
      </button>
      <span className="w-8 shrink-0 text-center text-[10px] font-semibold tabular-nums text-muted-foreground">
        {anioVer}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {MESES_CORTOS.map((nombre, i) => {
          const mesISO = `${anioVer}-${String(i + 1).padStart(2, "0")}`
          const registro = registroDe(mesISO)
          const estado = estadoDeMes(mesISO, registro)
          return (
            <Popover key={mesISO} open={mesAbierto === mesISO} onOpenChange={(o) => abrirMes(mesISO, o)}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`h-6 w-8 rounded border text-[10px] font-semibold leading-none transition-colors ${ESTILO_CHIP[estado]}`}
                  title={`${nombre} ${anioVer} · ${
                    estado === "pagado"
                      ? `pagado ${formatCurrency(aParte(registro!.monto))}`
                      : estado === "cargado"
                        ? `cargado ${formatCurrency(aParte(registro!.monto))}, sin pagar`
                        : "sin monto cargado"
                  }${parte ? ` (${parte.salon} ${parte.porcentaje}%)` : ""}`}
                >
                  {nombre.charAt(0)}
                  <span className="sr-only">{`${nombre} ${anioVer}: ${estado === "pagado" ? "pagado" : estado === "cargado" ? "cargado sin pagar" : "sin cargar"}`}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3" style={{ backgroundColor: "#ffffff" }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">
                  {nombreMesLargo(mesISO)}
                </p>
                {parte && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {`Porción de ${parte.salon} (${parte.porcentaje}%)`}
                  </p>
                )}
                <div className="mt-2 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Monto cargado</span>
                    {registro ? (
                      <span className={`font-bold ${pagadoDelMes(registro) ? "text-teal-700" : "text-amber-700"}`}>
                        {formatCurrency(aParte(registro.monto))}
                        {pagadoDelMes(registro) ? " · pagado" : " · debe"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin cargar</span>
                    )}
                  </div>
                  {parte && registro && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">General</span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {formatCurrency(registro.monto)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-purple-500" />
                      Sugerido
                    </span>
                    <span className="font-semibold text-purple-700">{formatCurrency(aParte(sugeridoGeneral))}</span>
                  </div>
                  {parte && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">General sugerido</span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {formatCurrency(sugeridoGeneral)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  <label htmlFor={`pago-${gasto.id}-${mesISO}`} className="text-xs font-medium text-foreground">
                    {parte ? `Monto de ${nombre} (${parte.salon})` : `Monto de ${nombre}`}
                  </label>
                  <MoneyInput
                    id={`pago-${gasto.id}-${mesISO}`}
                    value={montoPagar}
                    onValueChange={setMontoPagar}
                    className="h-8"
                  />
                  {parte && montoPagar > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      {`Equivale a un monto general de ${formatCurrency(aGeneral(montoPagar))}`}
                    </p>
                  )}
                  <Button
                    size="sm"
                    className="w-full h-8 gap-1.5 bg-teal-600 text-white hover:bg-teal-700"
                    onClick={() => guardarMes(montoPagar, true)}
                    disabled={!montoPagar || montoPagar <= 0}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {parte ? `Registrar pago de ${parte.salon}` : "Registrar pago"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 gap-1.5 border-amber-400 text-amber-800 hover:bg-amber-50"
                    style={{ backgroundColor: "#ffffff" }}
                    onClick={() => guardarMes(montoPagar, false)}
                    disabled={!montoPagar || montoPagar <= 0}
                    title="Deja el monto cargado como deuda del mes, sin pagar"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Cargar monto sin pagar
                  </Button>
                  {registro && pagadoDelMes(registro) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => guardarMes(aParte(registro.monto), false)}
                      title="Deshacer el pago de este mes"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Marcar como no pagado
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => setAnioVer((a) => Math.min(anioMax, a + 1))}
        disabled={anioVer >= anioMax}
        className="h-6 w-5 shrink-0 rounded border border-border text-muted-foreground transition-colors hover:bg-purple-50 hover:text-purple-700 disabled:opacity-30"
        title="Año siguiente"
      >
        <ChevronRight className="mx-auto h-3.5 w-3.5" />
        <span className="sr-only">Ver año siguiente</span>
      </button>
    </div>
  )
}

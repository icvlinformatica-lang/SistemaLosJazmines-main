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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils-financieros"
import { generateId, type CostoOperativo, type RegistroMonto } from "@/lib/store"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react"

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

/**
 * Sugerido por tendencia: DESACTIVADO temporalmente a pedido del usuario.
 * Cambiar a true para volver a mostrar el chip "Sugerido" en el popover
 * y pre-cargar el input con la proyección en meses sin registro.
 */
const SUGERIDO_ACTIVO = false

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
  onEditar,
  onEliminar,
}: {
  gasto: CostoOperativo
  updateCostoOperativo: (id: string, cambios: Partial<CostoOperativo>) => void
  /** Gasto repartido visto desde un salón: porción que le corresponde. */
  parte?: { salon: string; porcentaje: number }
  /** Abre el formulario de edición del gasto (reemplaza al menú "⋯"). */
  onEditar?: () => void
  /** Dispara la eliminación del gasto, con su confirmación existente. */
  onEliminar?: () => void
}) {
  const hoyISO = mesActualISO()
  const anioActual = Number(hoyISO.split("-")[0])
  const [anioVer, setAnioVer] = useState(anioActual)
  // Dirección del deslizamiento al cambiar de año (para la animación).
  const [deslizar, setDeslizar] = useState<"izq" | "der">("der")
  const [mesAbierto, setMesAbierto] = useState<string | null>(null)
  const [montoPagar, setMontoPagar] = useState(0)
  // El input del monto está oculto: aparece al tocar el lápiz junto al
  // monto. Al confirmar se decide si pagar o solo guardar el nuevo valor.
  const [editando, setEditando] = useState(false)
  const { toast } = useToast()

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
      setEditando(false)
      return
    }
    const registro = registroDe(mesISO)
    setMesAbierto(mesISO)
    setEditando(false)
    // Sin registro previo: con el sugerido apagado se pre-carga el monto vigente.
    setMontoPagar(aParte(registro?.monto ?? (SUGERIDO_ACTIVO ? sugeridoGeneral : gasto.monto)))
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
  function guardarMes(monto: number, pagado: boolean, aviso?: string) {
    if (!mesAbierto || !monto || monto <= 0) return
    const mesGuardado = mesAbierto
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
    setEditando(false)
    if (aviso) {
      toast({
        title: aviso,
        description: `${gasto.concepto}${parte ? ` (${parte.salon})` : ""} · ${nombreMesLargo(mesGuardado)} · ${formatCurrency(monto)}`,
      })
    }
  }

  return (
    <div className="flex w-full items-center gap-1.5" aria-label={`Meses de ${gasto.concepto}${parte ? ` (${parte.salon})` : ""}`}>
      <button
        type="button"
        onClick={() => {
          setDeslizar("izq")
          setAnioVer((a) => Math.max(anioMin, a - 1))
        }}
        disabled={anioVer <= anioMin}
        className="h-7 w-6 shrink-0 rounded border border-border text-muted-foreground transition-colors hover:bg-purple-50 hover:text-purple-700 disabled:opacity-30"
        title="Año anterior"
      >
        <ChevronLeft className="mx-auto h-3.5 w-3.5" />
        <span className="sr-only">Ver año anterior</span>
      </button>
      <span className="w-9 shrink-0 text-center text-[11px] font-semibold tabular-nums text-muted-foreground">
        {anioVer}
      </span>
      {/* key={anioVer} re-monta la fila y dispara el deslizamiento */}
      <div
        key={anioVer}
        className={`flex min-w-0 flex-1 items-center gap-1 overflow-hidden animate-in fade-in duration-300 ${
          deslizar === "der" ? "slide-in-from-right-8" : "slide-in-from-left-8"
        }`}
      >
        {MESES_CORTOS.map((nombre, i) => {
          const mesISO = `${anioVer}-${String(i + 1).padStart(2, "0")}`
          const registro = registroDe(mesISO)
          const estado = estadoDeMes(mesISO, registro)
          return (
            <Popover key={mesISO} open={mesAbierto === mesISO} onOpenChange={(o) => abrirMes(mesISO, o)}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`h-7 min-w-0 flex-1 rounded border text-[10px] font-semibold leading-none transition-colors ${ESTILO_CHIP[estado]}`}
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
              <PopoverContent align="end" className="w-60 p-3" style={{ backgroundColor: "#ffffff" }}>
                {/* Encabezado en una línea + acciones secundarias como íconos */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold capitalize text-foreground">
                    {nombreMesLargo(mesISO)}
                    {parte && (
                      <span className="ml-1 font-normal normal-case text-muted-foreground">
                        {`· ${parte.salon} ${parte.porcentaje}%`}
                      </span>
                    )}
                  </p>
                  {(onEditar || onEliminar) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          title={`Opciones de ${gasto.concepto}`}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                          <span className="sr-only">{`Opciones de ${gasto.concepto}`}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" style={{ backgroundColor: "#ffffff" }}>
                        {onEditar && (
                          <DropdownMenuItem
                            onClick={() => {
                              setMesAbierto(null)
                              onEditar()
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar gasto
                          </DropdownMenuItem>
                        )}
                        {onEliminar && (
                          <DropdownMenuItem
                            className="text-red-600 focus:bg-red-50 focus:text-red-700"
                            onClick={() => {
                              setMesAbierto(null)
                              onEliminar()
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            Eliminar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Dato protagonista: el monto del mes con su estado. Si el mes
                    todavía no tiene registro se muestra el monto vigente como
                    "A pagar", así el importe siempre está arriba. */}
                {(() => {
                  const montoGeneralMes = registro?.monto ?? gasto.monto
                  const estadoPago = !registro ? "aPagar" : pagadoDelMes(registro) ? "pagado" : "debe"
                  return (
                    <div className="mt-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={`text-lg font-bold tabular-nums ${
                              estadoPago === "aPagar" ? "text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {formatCurrency(aParte(montoGeneralMes))}
                          </span>
                          {/* Lápiz: único punto para cambiar el monto del mes.
                              Al confirmar se elige pagar o solo guardar. */}
                          {estadoPago !== "pagado" && !editando && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setMontoPagar(aParte(montoGeneralMes))
                                setEditando(true)
                              }}
                              title="Cambiar el monto de este mes"
                            >
                              <Pencil className="h-3 w-3" />
                              <span className="sr-only">Cambiar el monto de este mes</span>
                            </Button>
                          )}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            estadoPago === "pagado"
                              ? "bg-teal-50 text-teal-700"
                              : estadoPago === "debe"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {estadoPago === "pagado" ? "Pagado" : estadoPago === "debe" ? "Debe" : "A pagar"}
                        </span>
                      </div>
                      {parte && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {`General ${formatCurrency(montoGeneralMes)}`}
                        </p>
                      )}
                    </div>
                  )
                })()}

                {/* Acciones. Un solo camino: arriba se ve cuánto pagar,
                    "Pagar" paga eso, y el lápiz abre el editor donde se
                    decide al final si pagar o solo guardar el nuevo monto. */}
                <div className="mt-3 space-y-2">
                  {editando && (
                    <>
                      <MoneyInput
                        id={`pago-${gasto.id}-${mesISO}`}
                        value={montoPagar}
                        onValueChange={setMontoPagar}
                        className="h-8"
                        autoFocus
                        aria-label={parte ? `Monto de ${nombre} (${parte.salon})` : `Monto de ${nombre}`}
                      />
                      {/* Sugerido por tendencia: DESACTIVADO temporalmente a pedido
                          del usuario. Para reactivarlo, cambiar a true. */}
                      {SUGERIDO_ACTIVO && (
                        <button
                          type="button"
                          onClick={() => setMontoPagar(aParte(sugeridoGeneral))}
                          className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 transition-colors hover:bg-purple-100"
                          title={
                            parte ? `Usar sugerido (general ${formatCurrency(sugeridoGeneral)})` : "Usar el monto sugerido"
                          }
                        >
                          <Sparkles className="h-3 w-3" />
                          {`Sugerido ${formatCurrency(aParte(sugeridoGeneral))}`}
                        </button>
                      )}
                    </>
                  )}
                  <div className="flex items-center gap-1.5">
                    {registro && pagadoDelMes(registro) ? (
                      /* Mes pagado: el botón principal se transforma en Deshacer. */
                      <Button
                        size="sm"
                        className="h-8 flex-1 gap-1.5 bg-teal-600 text-white hover:bg-teal-700"
                        onClick={() => guardarMes(aParte(registro.monto), false, "Pago deshecho")}
                        title="Deshacer el pago de este mes"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Deshacer
                      </Button>
                    ) : editando ? (
                      /* Editando: al final se decide — pagar ya o solo dejar
                         el monto anotado como pendiente. */
                      <div className="w-full space-y-1.5">
                        <Button
                          size="sm"
                          className="h-8 w-full gap-1.5 bg-teal-600 text-white hover:bg-teal-700"
                          onClick={() => guardarMes(montoPagar, true, "Pago registrado")}
                          disabled={!montoPagar || montoPagar <= 0}
                          title={parte ? `Registrar pago de ${parte.salon}` : "Registrar pago del mes"}
                        >
                          <Check className="h-3.5 w-3.5" />
                          {`Pagar ${formatCurrency(montoPagar)}`}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-full gap-1.5 border-border text-xs text-muted-foreground hover:text-foreground"
                          style={{ backgroundColor: "#ffffff" }}
                          onClick={() => guardarMes(montoPagar, false, "Monto guardado")}
                          disabled={!montoPagar || montoPagar <= 0}
                          title="Deja el nuevo monto anotado como pendiente, sin pagarlo"
                        >
                          Solo guardar
                        </Button>
                        <button
                          type="button"
                          className="w-full text-center text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => {
                            setEditando(false)
                            setMontoPagar(aParte(registro?.monto ?? gasto.monto))
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      /* Estado inicial: una sola acción — pagar lo de arriba.
                         Para cambiar el número está el lápiz junto al monto. */
                      <Button
                        size="sm"
                        className="h-8 flex-1 gap-1.5 bg-teal-600 text-white hover:bg-teal-700"
                        onClick={() => guardarMes(aParte(registro?.monto ?? gasto.monto), true, "Pago registrado")}
                        title={parte ? `Registrar pago de ${parte.salon}` : "Registrar pago del mes"}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {`Pagar ${formatCurrency(aParte(registro?.monto ?? gasto.monto))}`}
                      </Button>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          setDeslizar("der")
          setAnioVer((a) => Math.min(anioMax, a + 1))
        }}
        disabled={anioVer >= anioMax}
        className="h-7 w-6 shrink-0 rounded border border-border text-muted-foreground transition-colors hover:bg-purple-50 hover:text-purple-700 disabled:opacity-30"
        title="Año siguiente"
      >
        <ChevronRight className="mx-auto h-3.5 w-3.5" />
        <span className="sr-only">Ver año siguiente</span>
      </button>
    </div>
  )
}

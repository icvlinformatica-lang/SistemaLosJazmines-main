"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { destinoVolverCostos, ORIGEN_CAJA_EVENTOS } from "@/lib/volver-desde-costos"
import { LinkVolver } from "@/components/link-volver"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { MoneyInput } from "@/components/ui/money-input"
import { Input } from "@/components/ui/input"
import { pagosMenuProveedor, totalPagosMenuProveedor } from "@/lib/pago-menu-proveedor"
import {
  costosConPagoFinalizado,
  montoPagoFinalizadoValido,
  montoSugeridoFinalizado,
  type RubroFinalizado,
} from "@/lib/pago-finalizado"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useStore } from "@/lib/store-context"
import { saldoEsperaSeña } from "@/lib/servicio-sueldo"
import { useSyncTiempoReal } from "@/lib/hooks/use-sync-tiempo-real"
import {
  calcularCostoEventoCajaEventos,
  congeladoValido,
  porcentajeEntero,
  resumenCobroCliente,
} from "@/lib/costo-evento"
import {
  nombreEventoEnCaja,
  prefijoPagoBarra,
  prefijoPagoMenu,
  prefijoPagoSaldo,
  prefijoPagoSeña,
  prefijoPagoSueldoPersonal,
  ultimoEgresoEvento,
} from "@/lib/egresos-evento"
import { useToast } from "@/hooks/use-toast"
import { fechaHabilitacionSeña, señaBloqueada } from "@/lib/candado-senas"
import { fechaNegocio } from "@/lib/ipc-cuotas"
import {
  AvisoSeñaBloqueada,
  PinSeñaExtraordinariaDialog,
  registrarPagoSeñaExtraordinario,
  type SeñaExtraordinaria,
} from "@/components/pago-sena-extraordinario"
import { formatCurrency } from "@/lib/utils-financieros"
import {
  generateId,
  generarCalendarioCuotas,
  calcularCostoReceta,
  calcularMontoPersonalDelEvento,
  calcularSeñaSaldoServicio,
  congelarCostosEvento,
  salonLabel,
  type MovimientoCaja,
} from "@/lib/store"
import {
  ArrowLeft,
  ChefHat,
  Wine,
  ConciergeBell,
  Users,
  CreditCard,
  StickyNote,
  CheckCircle2,
  CalendarDays,
  PieChart as PieChartIcon,
  BookOpen,
  RefreshCw,
  Lock,
  Pencil,
  HandCoins,
} from "lucide-react"
import {
  accionCajaAlCorregir,
  fotoConCostoCorregido,
  fotoConPersonalPagado,
  fotoConInsumoCorregido,
  type LineaCostoFinalizado,
  type SectorCompra,
} from "@/lib/correccion-finalizado"
import { PieChart, Pie, Cell, Label } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"

function formatFecha(dateStr?: string): string {
  if (!dateStr) return "—"
  const [y, m, d] = dateStr.split("-").map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

// "2026-09-01" → "01/09/2026": para los detalles debajo de cada pago, donde
// la fecha larga no entra en una línea.
function formatFechaCorta(dateStr?: string): string {
  if (!dateStr) return "—"
  const [y, m, d] = dateStr.slice(0, 10).split("-")
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}

function CostosEventoContent() {
  const searchParams = useSearchParams()
  const eventoId = searchParams.get("id") || ""
  // Si se entró desde Caja de eventos, la flecha vuelve ahí (al mismo mes)
  const volver = destinoVolverCostos(searchParams.get("from"), searchParams.get("mes"))
  // Desde Caja de eventos se va directo ahí (con el mes); si no, a la
  // pantalla anterior o, si se entró directo, a la lista de eventos.
  const LinkVolverCostos = searchParams.get("from") === ORIGEN_CAJA_EVENTOS ? Link : LinkVolver
  const {
    state,
    updateEvento,
    addMovimientosCaja,
    deleteMovimientoCaja,
  } = useStore()
  const { toast } = useToast()

  const evento = state.eventos.find((e) => e.id === eventoId)

  // ------------------------------------------------------------------
  // Sincronización en tiempo real: refresca precios de almacén (insumos
  // cocina/barra), recetas, cócteles y el contrato del evento (servicios,
  // personal, menú) cada 15 segundos y al volver a la pestaña. Así los
  // costos siempre reflejan la última versión del contrato y los últimos
  // precios cargados en la web.
  // ------------------------------------------------------------------
  const { ultimaSync, errorSync } = useSyncTiempoReal(15000, true)

  // Observación guardada dentro de costosCalculados (JSON ya persistido del evento)
  const observacionGuardada =
    ((evento?.costosCalculados as Record<string, unknown> | null)?.observacionCostos as string) || ""
  const [observacion, setObservacion] = useState(observacionGuardada)
  const [guardandoObs, setGuardandoObs] = useState(false)
  // Candado de señas: seña bloqueada esperando PIN + motivo (lib/candado-senas.ts).
  const [señaPidiendoPin, setSeñaPidiendoPin] = useState<
    { servicioId: string; seña: SeñaExtraordinaria } | null
  >(null)

  // Pago del menú o la barra de un evento finalizado: se confirma viendo (y
  // corrigiendo) el monto (lib/pago-finalizado.ts).
  const [pagoFinalizado, setPagoFinalizado] = useState<{ rubro: RubroFinalizado; monto: number } | null>(null)
  // Corrección de un costo de un evento finalizado (lib/correccion-finalizado.ts).
  const [correccion, setCorreccion] = useState<{
    linea: LineaCostoFinalizado
    titulo: string
    actual: number
    monto: number
    /** Corrección de UN insumo de cocina o barra (cantidad y precio por unidad). */
    insumo?: {
      sector: SectorCompra
      id: string
      unidad: string
      cantidad: number
      /** Lo que se escribe en el campo (acepta coma decimal). */
      cantidadTexto: string
      precio: number
      cantidadAntes: number
      costoAntes: number
    }
  } | null>(null)
  const [guardandoCorreccion, setGuardandoCorreccion] = useState(false)

  // --- ARCHIVO: foto congelada de costos (si el evento está archivado) ---
  // Mientras el evento esté en el Archivo se muestran los datos guardados al
  // archivarlo; nada se recalcula en vivo. Al sacarlo del archivo, la foto se
  // descarta (en updateEvento del store) y todo vuelve a calcularse en vivo.
  const esArchivado = evento?.estado === "completado"
  // Una foto sin ningún dato se considera inválida (pudo generarse antes de
  // que cargaran los catálogos) y se ignora para no mostrar todo en cero.
  const congelado = evento ? congeladoValido(evento) : undefined

  // Los catálogos deben estar cargados antes de congelar nada; si no, la foto
  // saldría vacía.
  const catalogosCargados =
    (state.recetas?.length ?? 0) > 0 && (state.insumos?.length ?? 0) > 0

  // Respaldo: eventos archivados antes de que existiera el congelado generan
  // su foto la primera vez que se abre esta pantalla (una sola vez, con los
  // catálogos ya cargados).
  const congeladoGeneradoRef = useRef(false)
  useEffect(() => {
    if (evento && esArchivado && !congelado && catalogosCargados && !congeladoGeneradoRef.current) {
      congeladoGeneradoRef.current = true
      try {
        const archivoCongelado = congelarCostosEvento(evento, state)
        updateEvento(evento.id, {
          costosCalculados: { ...(evento.costosCalculados || {}), archivoCongelado },
        } as Partial<typeof evento>)
      } catch (err) {
        console.error("[v0] Error generando congelado de archivo:", err)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento?.id, esArchivado, !congelado, catalogosCargados])

  // --- Costos calculados en vivo (o congelados si está archivado) ---
  // Mismo cálculo que el panel "Gastos del mes por evento" de Caja Eventos
  // (lib/costo-evento.ts): el costo del evento para Caja Eventos.
  const costos = useMemo(
    () => (evento ? calcularCostoEventoCajaEventos(evento, state) : null),
    [evento, state],
  )
  const cuotas = useMemo(() => (evento ? generarCalendarioCuotas(evento) : []), [evento])

  if (!evento) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-10">
        <p className="text-muted-foreground">Evento no encontrado.</p>
        <Button asChild variant="outline" className="mt-4 bg-transparent">
          <LinkVolverCostos href={volver.href}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {volver.etiqueta}
          </LinkVolverCostos>
        </Button>
      </main>
    )
  }

  const nombreEvento = evento.nombre || evento.nombrePareja || "Evento sin nombre"
  // En los conceptos de caja va el mismo nombre que usa Caja Eventos.
  const nombreEnCaja = nombreEventoEnCaja(evento)
  const servicios = evento.servicios || []
  // Todo el costo sale de lib/costo-evento.ts (ver ahí el criterio: servicios
  // en vivo con lo pagado a su monto real, personal en vivo, congelado si está
  // archivado).
  const {
    comprasCocina,
    comprasBarra,
    costoCocina,
    costoBarra,
    costoCocinaHoy,
    costoBarraHoy,
    fechaPagoCocina,
    fechaPagoBarra,
    personal,
    serviciosCalc,
    totalServicios,
    pagadoServicios,
    totalPersonal,
    pagadoPersonal,
    pagadoCocina,
    pagadoBarra,
    costoTotalEvento,
    totalCubierto,
  } = costos!

  // --- Menú completo elegido por la familia (recetas por segmento, en vivo) ---
  // Cada plato lleva su costo de materia prima para el segmento completo:
  // costo por persona de la receta × invitados del segmento × multiplicador de porción.
  // Si el evento está archivado, se usa el menú congelado al archivar.
  const menuPorSegmento = congelado?.menuPorSegmento ?? [
    {
      segmento: "Adultos",
      pax: evento.adultos || 0,
      recetas: evento.recetasAdultos || [],
      multipliers: evento.multipliersAdultos || {},
    },
    {
      segmento: "Adolescentes",
      pax: evento.adolescentes || 0,
      recetas: evento.recetasAdolescentes || [],
      multipliers: evento.multipliersAdolescentes || {},
    },
    {
      segmento: "Niños",
      pax: evento.ninos || 0,
      recetas: evento.recetasNinos || [],
      multipliers: evento.multipliersNinos || {},
    },
    {
      segmento: "Dietas especiales",
      pax: evento.personasDietasEspeciales || 0,
      recetas: evento.recetasDietasEspeciales || [],
      multipliers: evento.multipliersDietasEspeciales || {},
    },
  ]
    .map((s) => ({
      segmento: s.segmento,
      pax: s.pax,
      platos: s.recetas
        .map((id) => {
          const receta = state.recetas?.find((r) => r.id === id)
          if (!receta) return null
          const costo =
            calcularCostoReceta(receta, state.insumos || []) * s.pax * (s.multipliers[id] || 1)
          return { id, nombre: receta.nombre, costo }
        })
        .filter((p): p is { id: string; nombre: string; costo: number } => !!p),
    }))
    .filter((s) => s.platos.length > 0)

  // --- Lo cobrado al cliente ---
  // Seña + lo cobrado de cada cuota (también pagos parciales), frente a lo que
  // el cliente va a pagar en total. La diferencia con el precio del contrato es
  // el recargo por financiación o el ajuste por IPC de las cuotas.
  const cobro = resumenCobroCliente(evento.planDeCuotas, cuotas)
  const cuotasPagadas = cuotas.filter((c) => c.pagada)
  const cuotasParciales = cuotas.filter((c) => !c.pagada && c.montoAcumulado > 0)

  // --- Porcentaje cubierto (dice 100% solo si no falta pagar nada) ---
  const porcentajeCubierto = porcentajeEntero(totalCubierto, costoTotalEvento)
  const pendienteTotal = Math.max(0, costoTotalEvento - totalCubierto)

  // Precio de venta del evento (el del contrato) y proporción del costo.
  const precioVentaEvento = cobro.precioContrato
  const proporcionCostoVenta = precioVentaEvento > 0 ? (costoTotalEvento / precioVentaEvento) * 100 : null

  // Desglose por rubro: la tabla del resumen muestra los cuatro (aunque estén
  // en 0) para que se vea que suman el costo total; el anillo, los que tienen costo.
  const rubros = [
    { key: "cocina", nombre: "Cocina", total: costoCocina, pagado: pagadoCocina },
    { key: "barra", nombre: "Barra", total: costoBarra, pagado: pagadoBarra },
    { key: "servicios", nombre: "Servicios", total: totalServicios, pagado: pagadoServicios },
    { key: "personal", nombre: "Personal", total: totalPersonal, pagado: pagadoPersonal },
  ]
  const datosGrafico = rubros.filter((d) => d.total > 0)

  // Cada categoría se divide en dos porciones: lo pagado (color pleno) y lo
  // pendiente (mismo color atenuado). Así el anillo solo se "llena" de color
  // a medida que se van cubriendo los costos.
  const datosAnillo = datosGrafico.flatMap((d) => {
    const slices = []
    if (d.pagado > 0) slices.push({ ...d, sliceKey: `${d.key}-pagado`, valor: d.pagado, esPagado: true })
    if (d.total - d.pagado > 0)
      slices.push({ ...d, sliceKey: `${d.key}-pendiente`, valor: d.total - d.pagado, esPagado: false })
    return slices
  })

  const chartConfig = {
    cocina: { label: "Cocina", color: "var(--chart-1)" },
    barra: { label: "Barra", color: "var(--chart-2)" },
    servicios: { label: "Servicios", color: "var(--chart-3)" },
    personal: { label: "Personal", color: "var(--chart-4)" },
  } satisfies ChartConfig

  // ------------------------------------------------------------------
  // Registro/eliminación de egresos reales en Caja Eventos
  // (mismos formatos de concepto que Finanzas → Caja Eventos)
  // ------------------------------------------------------------------
  const registrarEgreso = (concepto: string, monto: number) => {
    const saldoPrev = (state.movimientosCaja ?? [])
      .filter((m) => m.cajaDestino === "caja_eventos")
      .reduce((sum, m) => (m.tipo === "ingreso" ? sum + m.monto : sum - m.monto), 0)
    const movimiento: MovimientoCaja = {
      id: generateId(),
      fecha: new Date().toISOString(),
      tipo: "egreso",
      concepto,
      monto,
      salon: evento.salon || "",
      eventoId: evento.id,
      cajaDestino: "caja_eventos",
      saldoResultante: saldoPrev - monto,
    }
    addMovimientosCaja([movimiento])
  }

  // Busca y elimina el egreso más reciente de este evento que empieza con el
  // prefijo (para revertir un pago). Se busca sin el nombre del evento porque
  // Caja Eventos y esta pantalla no siempre lo escribieron igual.
  const quitarEgreso = (prefijo: string): MovimientoCaja | undefined => {
    const mov = ultimoEgresoEvento(state.movimientosCaja, evento.id, prefijo)
    if (mov) deleteMovimientoCaja(mov.id)
    return mov
  }

  const hoyStr = fechaNegocio()

  // Con el evento finalizado los montos salen de la foto guardada al
  // finalizar (no del catálogo de hoy): se paga y se corrige sobre esa foto
  // (pedido de Rodrigo, 3/11/2026). Sin foto válida no se toca nada.
  const bloquearPorArchivo = (): boolean => {
    if (!esArchivado || congelado) return false
    toast({
      title: "Evento finalizado",
      description: "Todavía no se guardaron los costos de este evento finalizado. Esperá unos segundos y probá de nuevo.",
    })
    return true
  }
  // Seña y saldo de un servicio según la foto (finalizado) o en vivo.
  const montosServicioFoto = (servicioId: string) => serviciosCalc.find((c) => c.srv.servicioId === servicioId)

  // --- Menú o barra de un evento finalizado ---
  // Lo ya dado a proveedores a cuenta del menú (Caja Eventos → Por pagar).
  const pagadoProveedoresMenu = () => totalPagosMenuProveedor(pagosMenuProveedor(state.movimientosCaja, evento.id))

  const abrirPagoFinalizado = (rubro: RubroFinalizado) => {
    const monto =
      rubro === "cocina"
        ? montoSugeridoFinalizado(costoCocina, pagadoProveedoresMenu())
        : montoSugeridoFinalizado(costoBarra)
    setPagoFinalizado({ rubro, monto })
  }

  const confirmarPagoFinalizado = () => {
    if (!pagoFinalizado || !montoPagoFinalizadoValido(pagoFinalizado.monto)) return
    const { rubro, monto } = pagoFinalizado
    // En la foto queda el total pagado del rubro (con lo dado a cuenta).
    const totalPagado = rubro === "cocina" ? pagadoProveedoresMenu() + monto : monto
    const costosCalculados = costosConPagoFinalizado(
      evento.costosCalculados as Record<string, unknown> | undefined,
      rubro,
      totalPagado,
    )
    if (rubro === "cocina") {
      updateEvento(evento.id, { cocinaPagada: true, costosCalculados } as Partial<typeof evento>)
      registrarEgreso(`${prefijoPagoMenu}${nombreEnCaja}`, monto)
      toast({ title: "Menú pagado", description: formatCurrency(monto) })
    } else {
      updateEvento(evento.id, { barraPagada: true, costosCalculados } as Partial<typeof evento>)
      registrarEgreso(`${prefijoPagoBarra}${nombreEnCaja}`, monto)
      toast({ title: "Barra pagada", description: formatCurrency(monto) })
    }
    setPagoFinalizado(null)
  }

  // Revertir no borra el monto de la foto: queda como el costo del rubro (lo
  // que se pagó o lo que se corrigió), para no volver a la foto inflada.
  const revertirPagoFinalizado = (rubro: RubroFinalizado) => {
    const costosCalculados = evento.costosCalculados
    if (rubro === "cocina") {
      updateEvento(evento.id, { cocinaPagada: false, costosCalculados } as Partial<typeof evento>)
      quitarEgreso(prefijoPagoMenu)
      toast({ title: "Pago del menú revertido" })
    } else {
      updateEvento(evento.id, { barraPagada: false, costosCalculados } as Partial<typeof evento>)
      quitarEgreso(prefijoPagoBarra)
      toast({ title: "Pago de la barra revertido" })
    }
  }

  // --- Corregir un costo de un evento finalizado ---
  // Qué está pagado y con qué egreso, para cada línea.
  const datosLinea = (linea: LineaCostoFinalizado) => {
    if (linea.rubro === "cocina")
      return { pagado: !!evento.cocinaPagada, prefijo: prefijoPagoMenu, aparte: pagadoProveedoresMenu() }
    if (linea.rubro === "barra") return { pagado: !!evento.barraPagada, prefijo: prefijoPagoBarra, aparte: 0 }
    if (linea.rubro === "sueldo") {
      const pe = personal.find((p) => p.id === linea.personalId)
      return { pagado: !!pe?.pagado, prefijo: pe ? prefijoPagoSueldoPersonal(pe.nombre, pe.funcion) : "", aparte: 0 }
    }
    const c = montosServicioFoto(linea.servicioId)
    const pagado = linea.rubro === "seña" ? !!c?.senaPagada : !!c?.saldoPagado
    const prefijo = c ? (linea.rubro === "seña" ? prefijoPagoSeña(c.srv.nombre) : prefijoPagoSaldo(c.srv.nombre)) : ""
    return { pagado, prefijo, aparte: 0 }
  }
  const accionCorreccion = (linea: LineaCostoFinalizado, montoNuevo: number) => {
    const { pagado, prefijo, aparte } = datosLinea(linea)
    const egreso = prefijo ? ultimoEgresoEvento(state.movimientosCaja, evento.id, prefijo) : undefined
    return { egreso, prefijo, accion: accionCajaAlCorregir({ pagado, egresoMonto: egreso?.monto, pagadoAparte: aparte, montoNuevo }) }
  }
  const abrirCorreccion = (linea: LineaCostoFinalizado, titulo: string, actual: number) =>
    setCorreccion({ linea, titulo, actual, monto: Math.round(actual * 100) / 100 })

  // Insumo de cocina o barra de un finalizado: cambia solo esa fila de la foto
  // (no el Almacén, las recetas, el stock ni otros eventos).
  const abrirCorreccionInsumo = (
    sector: SectorCompra,
    id: string,
    nombre: string,
    unidad: string,
    cantidad: number,
    costo: number,
    precioCatalogo?: number,
  ) => {
    const precio = cantidad > 0 ? costo / cantidad : (precioCatalogo ?? 0)
    setCorreccion({
      linea: { rubro: sector },
      titulo: nombre,
      actual: sector === "cocina" ? costoCocina : costoBarra,
      monto: 0,
      insumo: {
        sector,
        id,
        unidad,
        cantidad: Number(cantidad.toFixed(3)),
        cantidadTexto: String(Number(cantidad.toFixed(3))).replace(".", ","),
        precio: Math.round(precio * 100) / 100,
        cantidadAntes: cantidad,
        costoAntes: costo,
      },
    })
  }

  // Lo que se va a guardar: la foto corregida, el costo nuevo de la línea (o
  // del rubro, si es un insumo) y el de antes.
  const resultadoCorreccion = (c: NonNullable<typeof correccion>) => {
    const costosEvento = evento.costosCalculados as Record<string, unknown> | undefined
    if (c.insumo) {
      const r = fotoConInsumoCorregido(costosEvento, c.insumo.sector, c.insumo.id, c.insumo.cantidad, c.insumo.precio)
      return r ? { costosCalculados: r.costosCalculados, montoNuevo: r.totalNuevo, actual: r.totalAntes, costoLinea: r.costoLinea } : null
    }
    const costosCalculados = fotoConCostoCorregido(costosEvento, c.linea, c.monto)
    return costosCalculados ? { costosCalculados, montoNuevo: c.monto, actual: c.actual, costoLinea: c.monto } : null
  }

  const guardarCorreccion = async () => {
    if (!correccion || guardandoCorreccion) return
    const { linea, insumo } = correccion
    const resultado = resultadoCorreccion(correccion)
    const costosCalculados = resultado?.costosCalculados
    const monto = resultado?.montoNuevo ?? 0
    const actual = resultado?.actual ?? correccion.actual
    // En el historial: qué insumo y cómo quedó, o la línea corregida.
    const titulo = insumo
      ? `${insumo.sector === "cocina" ? "Cocina" : "Barra"}, ${correccion.titulo}: ${Number(insumo.cantidadAntes.toFixed(3))} ${insumo.unidad} (${formatCurrency(insumo.costoAntes)}) → ${insumo.cantidad} ${insumo.unidad} a ${formatCurrency(insumo.precio)} (${formatCurrency(resultado?.costoLinea ?? 0)}); total`
      : correccion.titulo
    if (!costosCalculados) {
      toast({ title: "No se pudo corregir", description: "No se encontró ese costo en los datos guardados del evento.", variant: "destructive" })
      return
    }
    const { egreso, prefijo, accion } = accionCorreccion(linea, monto)
    if (accion.accion === "imposible") return
    setGuardandoCorreccion(true)
    try {
      // Primero la caja: si falla, no se toca la foto. El egreso nuevo se
      // anota antes de borrar el viejo (si se corta en el medio, queda a la
      // vista en el historial de Caja Eventos y no se pierde plata).
      if (accion.accion === "reemplazar" && egreso) {
        if (accion.montoEgreso > 0.005) {
          const ok = await addMovimientosCaja([{ ...egreso, id: generateId(), monto: accion.montoEgreso }])
          if (!ok) throw new Error("no se pudo anotar el pago corregido")
        }
        const borrado = await deleteMovimientoCaja(egreso.id)
        if (!borrado) throw new Error("no se pudo quitar el pago anterior")
      } else if (accion.accion === "agregar") {
        registrarEgreso(`${prefijo}${nombreEnCaja}`, accion.montoEgreso)
      }
      // Personal: el monto corregido también en el evento (como al pagar).
      const extra: Partial<typeof evento> = {}
      if (linea.rubro === "sueldo") {
        extra.personalEvento = (evento.personalEvento || []).map((p) => (p.id === linea.personalId ? { ...p, monto } : p))
      }
      const ok = await updateEvento(evento.id, { ...extra, costosCalculados } as Partial<typeof evento>)
      if (!ok) throw new Error("no se pudo guardar el costo corregido")
      fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "evento",
          accion: "modificado",
          nombre: nombreEvento,
          detalle: `Costo corregido (evento finalizado): ${titulo} de ${formatCurrency(actual)} a ${formatCurrency(monto)}${
            accion.diferencia ? ` · Caja Eventos ${accion.diferencia > 0 ? "pagó" : "recuperó"} ${formatCurrency(Math.abs(accion.diferencia))}` : ""
          }`,
        }),
      }).catch(() => {})
      toast({
        title: "Costo corregido",
        description: accion.diferencia
          ? `${titulo}: ${formatCurrency(monto)}. Caja Eventos ${accion.diferencia > 0 ? "pagó" : "recuperó"} ${formatCurrency(Math.abs(accion.diferencia))}.`
          : `${titulo}: ${formatCurrency(monto)}.`,
      })
      setCorreccion(null)
    } catch (err) {
      toast({
        title: "No se pudo corregir",
        description: `${err instanceof Error ? err.message : "Error"}. Revisá el historial de Caja Eventos antes de probar de nuevo.`,
        variant: "destructive",
      })
    } finally {
      setGuardandoCorreccion(false)
    }
  }

  // --- Cocina ---
  const toggleCocina = (checked: boolean) => {
    if (esArchivado) {
      if (checked) abrirPagoFinalizado("cocina")
      else revertirPagoFinalizado("cocina")
      return
    }
    updateEvento(evento.id, { cocinaPagada: checked })
    if (checked) {
      // Si ya se pagó una parte por proveedor (Caja Eventos), sale solo el resto.
      const resto = pagadoCocina > 0 ? Math.max(0, costoCocina - pagadoCocina) : costoCocinaHoy
      registrarEgreso(`${prefijoPagoMenu}${nombreEnCaja}`, resto)
      toast({ title: "Cocina marcada como pagada", description: formatCurrency(resto) })
    } else {
      quitarEgreso(prefijoPagoMenu)
      toast({ title: "Pago de cocina revertido" })
    }
  }

  // --- Barra ---
  const toggleBarra = (checked: boolean) => {
    if (esArchivado) {
      if (checked) abrirPagoFinalizado("barra")
      else revertirPagoFinalizado("barra")
      return
    }
    updateEvento(evento.id, { barraPagada: checked })
    if (checked) {
      registrarEgreso(`${prefijoPagoBarra}${nombreEnCaja}`, costoBarraHoy)
      toast({ title: "Barra marcada como pagada", description: formatCurrency(costoBarraHoy) })
    } else {
      quitarEgreso(prefijoPagoBarra)
      toast({ title: "Pago de barra revertido" })
    }
  }

  // --- Servicios: seña ---
  // Fecha de habilitación si la seña todavía está bloqueada (null si ya se puede pagar).
  const habilitacionSeña = señaBloqueada(evento.fechaAlta, evento.fecha, fechaNegocio())
    ? fechaHabilitacionSeña(evento.fechaAlta, evento.fecha)
    : null

  // Tildar una seña bloqueada pide PIN + motivo; destildar no cambia.
  const toggleSena = (servicioId: string, checked: boolean) => {
    if (checked && habilitacionSeña) {
      if (bloquearPorArchivo()) return
      const srv = servicios.find((s) => s.servicioId === servicioId)
      if (!srv) return
      const { montoSeña } = calcularSeñaSaldoServicio(
        { ...srv, estadoPago: "sin_seña" },
        { servicios: state.servicios ?? [] },
      )
      setSeñaPidiendoPin({
        servicioId,
        seña: {
          eventoNombre: nombreEvento,
          servicioNombre: srv.nombre,
          monto: montoSeña,
          fechaHabilitacion: habilitacionSeña,
        },
      })
      return
    }
    aplicarToggleSena(servicioId, checked)
  }

  const aplicarToggleSena = (servicioId: string, checked: boolean) => {
    if (bloquearPorArchivo()) return
    const srv = servicios.find((s) => s.servicioId === servicioId)
    if (!srv) return
    // Monto EN VIVO desde el catálogo: lo que se registra en caja es lo que
    // se está mostrando en pantalla, no la foto guardada al contratar.
    const montoSeñaLive =
      esArchivado && montosServicioFoto(servicioId)
        ? montosServicioFoto(servicioId)!.montoSeña
        : calcularSeñaSaldoServicio({ ...srv, estadoPago: "sin_seña" }, { servicios: state.servicios ?? [] }).montoSeña
    const nuevosServicios = servicios.map((s) => {
      if (s.servicioId !== servicioId) return s
      // Al pagar, fijar el monto pagado como histórico del servicio.
      if (checked) return { ...s, estadoPago: "señado" as const, fechaPagoSeña: hoyStr, montoSeña: montoSeñaLive }
      return { ...s, estadoPago: "sin_seña" as const, fechaPagoSeña: undefined }
    })
    updateEvento(evento.id, { servicios: nuevosServicios })
    if (checked) {
      registrarEgreso(`${prefijoPagoSeña(srv.nombre)}${nombreEnCaja}`, montoSeñaLive)
      toast({ title: `Seña de ${srv.nombre} pagada`, description: formatCurrency(montoSeñaLive) })
    } else {
      quitarEgreso(prefijoPagoSeña(srv.nombre))
      toast({ title: `Seña de ${srv.nombre} revertida` })
    }
  }

  // --- Servicios: saldo ---
  const toggleSaldo = (servicioId: string, checked: boolean) => {
    if (bloquearPorArchivo()) return
    const srv = servicios.find((s) => s.servicioId === servicioId)
    if (!srv) return
    if (checked && saldoEsperaSeña(srv, { servicios: state.servicios ?? [] })) {
      toast({ title: "Primero la seña", description: `Pagá la seña de ${srv.nombre} antes que el saldo.` })
      return
    }
    if (checked) {
      // Saldo EN VIVO desde el catálogo (costo actual − seña pagada).
      // Finalizado: el saldo de la foto (el que se ve en pantalla).
      const monto =
        esArchivado && montosServicioFoto(servicioId)
          ? montosServicioFoto(servicioId)!.saldo
          : calcularSeñaSaldoServicio(srv, { servicios: state.servicios ?? [] }).saldoPendiente
      const nuevosServicios = servicios.map((s) =>
        s.servicioId === servicioId
          ? { ...s, pagado: true, estadoPago: "pagado_total" as const, saldoPendiente: 0, fechaPagoSaldo: hoyStr }
          : s,
      )
      updateEvento(evento.id, { servicios: nuevosServicios })
      registrarEgreso(`${prefijoPagoSaldo(srv.nombre)}${nombreEnCaja}`, monto)
      toast({ title: `Saldo de ${srv.nombre} pagado`, description: formatCurrency(monto) })
    } else {
      const mov = quitarEgreso(prefijoPagoSaldo(srv.nombre))
      const montoRestaurado = mov?.monto || 0
      const nuevosServicios = servicios.map((s) =>
        s.servicioId === servicioId
          ? {
              ...s,
              pagado: false,
              estadoPago: "saldo_pendiente" as const,
              saldoPendiente: montoRestaurado,
              fechaPagoSaldo: undefined,
            }
          : s,
      )
      updateEvento(evento.id, { servicios: nuevosServicios })
      toast({ title: `Saldo de ${srv.nombre} revertido` })
    }
  }

  // --- Personal ---
  const togglePersonal = (peId: string, checked: boolean) => {
    if (bloquearPorArchivo()) return
    // Finalizado: la persona y su sueldo salen de la foto, y el "pagado" se
    // anota en la foto (que es lo que se muestra) y en el evento.
    const peFoto = esArchivado ? personal.find((p) => p.id === peId) : undefined
    const pe = peFoto ?? (evento.personalEvento || []).find((p) => p.id === peId)
    if (!pe) return
    const prefijo = prefijoPagoSueldoPersonal(pe.nombre, pe.funcion)
    // Monto EN VIVO desde el roster: lo que se registra en caja es lo que se
    // muestra en pantalla. Al pagar, ese monto queda fijado como histórico.
    const montoLive = peFoto ? peFoto.monto || 0 : calcularMontoPersonalDelEvento(pe, state.personal)
    const nuevoPersonal = (evento.personalEvento || []).map((p) =>
      p.id === peId ? (checked ? { ...p, pagado: true, monto: montoLive } : { ...p, pagado: false }) : p,
    )
    if (peFoto) {
      const costosCalculados = fotoConPersonalPagado(
        evento.costosCalculados as Record<string, unknown> | undefined,
        peId,
        checked,
      )
      if (!costosCalculados) return
      updateEvento(evento.id, { personalEvento: nuevoPersonal, costosCalculados } as Partial<typeof evento>)
    } else {
      updateEvento(evento.id, { personalEvento: nuevoPersonal })
    }
    if (checked) {
      registrarEgreso(`${prefijo}${nombreEnCaja}`, montoLive)
      toast({ title: `Sueldo de ${pe.nombre} pagado`, description: formatCurrency(montoLive) })
    } else {
      quitarEgreso(prefijo)
      toast({ title: `Sueldo de ${pe.nombre} revertido` })
    }
  }

  // --- Observación ---
  const guardarObservacion = async () => {
    setGuardandoObs(true)
    const costosCalculados = {
      ...((evento.costosCalculados as Record<string, unknown> | null) || {}),
      observacionCostos: observacion,
    }
    updateEvento(evento.id, { costosCalculados } as Partial<typeof evento>)
    setTimeout(() => setGuardandoObs(false), 600)
    toast({ title: "Observación guardada" })
  }

  const fmtPorcentaje = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <div className="mx-auto w-full max-w-none px-4 py-6 space-y-5 xl:px-6">
      <Dialog open={!!pagoFinalizado} onOpenChange={(abierto) => !abierto && setPagoFinalizado(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pagoFinalizado?.rubro === "barra" ? "Pagar la barra" : "Pagar el menú"} de un evento finalizado
            </DialogTitle>
            <DialogDescription>
              Sale de Caja Eventos ({salonLabel(evento.salon)}) con fecha de hoy. El monto propuesto es el costo guardado al
              finalizar el evento
              {pagoFinalizado?.rubro === "cocina" && pagadoProveedoresMenu() > 0
                ? `, menos ${formatCurrency(pagadoProveedoresMenu())} ya dados a proveedores a cuenta`
                : ""}
              . Revisalo y corregilo si lo que se pagó fue otra cifra.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="monto-pago-finalizado" className="text-sm font-medium">
              Monto pagado
            </label>
            <MoneyInput
              id="monto-pago-finalizado"
              inputMode="decimal"
              value={pagoFinalizado?.monto ?? 0}
              onValueChange={(monto) => setPagoFinalizado((p) => (p ? { ...p, monto } : p))}
              placeholder="0"
            />
            {pagoFinalizado && !montoPagoFinalizadoValido(pagoFinalizado.monto) && (
              <p className="text-xs text-red-600">Poné un monto mayor a cero.</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPagoFinalizado(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarPagoFinalizado}
              disabled={!pagoFinalizado || !montoPagoFinalizadoValido(pagoFinalizado.monto)}
            >
              Pagar {pagoFinalizado ? formatCurrency(pagoFinalizado.monto) : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!correccion} onOpenChange={(abierto) => !abierto && !guardandoCorreccion && setCorreccion(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Corregir{" "}
              {correccion
                ? correccion.insumo
                  ? correccion.titulo
                  : correccion.titulo.charAt(0).toLowerCase() + correccion.titulo.slice(1)
                : ""}
            </DialogTitle>
            <DialogDescription>
              {correccion?.insumo
                ? `Solo para este evento finalizado: no cambia el Almacén, las recetas, el stock ni otros eventos. Hoy figura ${Number(correccion.insumo.cantidadAntes.toFixed(3))} ${correccion.insumo.unidad} por ${formatCurrency(correccion.insumo.costoAntes)}.`
                : `Evento finalizado. El costo guardado es ${formatCurrency(correccion?.actual ?? 0)}; poné el que corresponde.`}
            </DialogDescription>
          </DialogHeader>
          {correccion?.insumo ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cantidad-insumo" className="text-sm font-medium">
                  Cantidad ({correccion.insumo.unidad || "unidades"})
                </label>
                <Input
                  id="cantidad-insumo"
                  inputMode="decimal"
                  value={correccion.insumo.cantidadTexto}
                  onChange={(e) => {
                    const texto = e.target.value.replace(/[^0-9.,]/g, "")
                    // Con coma, la coma es el decimal (y los puntos, miles); sin coma, el punto es el decimal.
                    const numero = texto.includes(",") ? Number(texto.replace(/\./g, "").replace(",", ".")) : Number(texto)
                    setCorreccion((c) =>
                      c?.insumo
                        ? { ...c, insumo: { ...c.insumo, cantidadTexto: texto, cantidad: texto === "" ? NaN : numero } }
                        : c,
                    )
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="precio-insumo" className="text-sm font-medium">
                  Precio por {correccion.insumo.unidad || "unidad"}
                </label>
                <MoneyInput
                  id="precio-insumo"
                  inputMode="decimal"
                  value={correccion.insumo.precio}
                  onValueChange={(precio) => setCorreccion((c) => (c?.insumo ? { ...c, insumo: { ...c.insumo, precio } } : c))}
                  placeholder="0"
                />
              </div>
              {(() => {
                const r = resultadoCorreccion(correccion)
                return r ? (
                  <p className="col-span-2 text-sm">
                    Esta fila queda en <span className="font-semibold">{formatCurrency(r.costoLinea)}</span> y el total de{" "}
                    {correccion.insumo.sector === "cocina" ? "cocina" : "barra"} pasa de {formatCurrency(r.actual)} a{" "}
                    <span className="font-semibold">{formatCurrency(r.montoNuevo)}</span>.
                  </p>
                ) : (
                  <p className="col-span-2 text-xs text-red-600">Poné una cantidad y un precio válidos.</p>
                )
              })()}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="monto-correccion" className="text-sm font-medium">
                Costo correcto
              </label>
              <MoneyInput
                id="monto-correccion"
                inputMode="decimal"
                value={correccion?.monto ?? 0}
                onValueChange={(monto) => setCorreccion((c) => (c ? { ...c, monto } : c))}
                placeholder="0"
              />
            </div>
          )}
          {correccion &&
            resultadoCorreccion(correccion) &&
            (() => {
              const { egreso, accion } = accionCorreccion(correccion.linea, resultadoCorreccion(correccion)!.montoNuevo)
              const caja = `Caja Eventos (${salonLabel(evento.salon)})`
              let texto: string
              let tono = "border-border bg-muted/40 text-foreground"
              if (accion.accion === "imposible") {
                texto = `No puede ser menos que ${formatCurrency(accion.minimo)}, lo ya dado a proveedores a cuenta. Eso se revierte desde el historial de Caja Eventos.`
                tono = "border-red-300 bg-red-50 text-red-800"
              } else if (accion.accion === "reemplazar") {
                const fecha = egreso?.fecha ? ` el ${formatFechaCorta(fechaNegocio(new Date(egreso.fecha)))}` : ""
                texto =
                  accion.diferencia < 0
                    ? `Ya se pagó ${formatCurrency(egreso?.monto ?? 0)}${fecha}. Al guardar, ese pago pasa a ${formatCurrency(accion.montoEgreso)} y ${caja} recupera ${formatCurrency(-accion.diferencia)}.`
                    : `Ya se pagó ${formatCurrency(egreso?.monto ?? 0)}${fecha}. Al guardar, ese pago pasa a ${formatCurrency(accion.montoEgreso)} y salen ${formatCurrency(accion.diferencia)} más de ${caja}.`
                tono = "border-amber-300 bg-amber-50 text-amber-900"
              } else if (accion.accion === "agregar") {
                texto = `Se anota un pago de ${formatCurrency(accion.montoEgreso)} en ${caja}, además de lo ya dado a proveedores.`
                tono = "border-amber-300 bg-amber-50 text-amber-900"
              } else if (accion.accion === "sinEgreso") {
                texto = `Está marcado pagado pero no tiene un pago anotado en Caja Eventos: se corrige el costo y la caja no cambia.`
              } else if (datosLinea(correccion.linea).pagado) {
                texto = `El pago ya es de ese monto: la caja no cambia.`
              } else {
                texto = `Todavía no se pagó: se corrige el costo y la caja no cambia. Al marcarlo pagado, sale de ${caja} por el monto corregido.`
              }
              return <p className={`rounded-md border px-3 py-2 text-sm ${tono}`}>{texto}</p>
            })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCorreccion(null)} disabled={guardandoCorreccion}>
              Cancelar
            </Button>
            <Button
              onClick={guardarCorreccion}
              disabled={
                !correccion ||
                guardandoCorreccion ||
                !resultadoCorreccion(correccion) ||
                (correccion.insumo
                  ? Math.abs(correccion.insumo.cantidad - correccion.insumo.cantidadAntes) < 0.0005 &&
                    Math.abs(resultadoCorreccion(correccion)!.costoLinea - correccion.insumo.costoAntes) < 0.005
                  : Math.abs(correccion.monto - correccion.actual) < 0.005) ||
                accionCorreccion(correccion.linea, resultadoCorreccion(correccion)!.montoNuevo).accion.accion === "imposible"
              }
            >
              {guardandoCorreccion ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PinSeñaExtraordinariaDialog
        seña={señaPidiendoPin?.seña ?? null}
        montoTexto={señaPidiendoPin ? formatCurrency(señaPidiendoPin.seña.monto) : ""}
        onCancelar={() => setSeñaPidiendoPin(null)}
        onAutorizado={(motivo) => {
          if (!señaPidiendoPin) return
          const { servicioId, seña } = señaPidiendoPin
          setSeñaPidiendoPin(null)
          aplicarToggleSena(servicioId, true)
          registrarPagoSeñaExtraordinario(seña, motivo, formatCurrency(seña.monto))
        }}
      />
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0">
            <LinkVolverCostos href={volver.href} aria-label={volver.etiqueta} title={volver.etiqueta}>
              <ArrowLeft className="h-4 w-4" />
            </LinkVolverCostos>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-balance">Costos del evento</h1>
            <p className="text-sm text-muted-foreground">
              {nombreEvento} · {salonLabel(evento.salon)} · {formatFecha(evento.fecha)}
            </p>
          </div>
        </div>
        {esArchivado ? (
          <span className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Lock className="h-3 w-3" />
            {congelado
              ? `Evento archivado — datos congelados al ${formatFecha(fechaNegocio(new Date(congelado.fechaArchivado)))}`
              : "Evento archivado — datos congelados"}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            {errorSync
              ? "Sin conexión: mostrando la última información disponible"
              : ultimaSync
              ? `Precios y contrato actualizados ${ultimaSync.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Sincronización en tiempo real activa"}
          </span>
        )}
      </div>

      {/* Resumen: anillo de lo pagado, desglose por rubro que suma el costo
          total y la relación con el precio del contrato. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChartIcon className="h-4 w-4 text-teal-600" />
            Resumen de costos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {datosGrafico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este evento no tiene costos calculados.</p>
          ) : (
            <div className="grid items-center gap-6 lg:grid-cols-[200px_minmax(0,1fr)_minmax(220px,280px)]">
              <div className="flex flex-col items-center gap-2">
                <ChartContainer config={chartConfig} className="aspect-square w-full max-w-[200px]">
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload as (typeof datosAnillo)[number]
                        return (
                          <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                            <p className="font-semibold">{d.nombre}</p>
                            <p>
                              Costo: <span className="font-medium">{formatCurrency(d.total)}</span>
                            </p>
                            <p className="text-emerald-700">
                              Pagado: <span className="font-medium">{formatCurrency(d.pagado)}</span>
                            </p>
                            <p className="text-muted-foreground">
                              Falta pagar: {formatCurrency(d.total - d.pagado)}
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Pie
                      data={datosAnillo}
                      dataKey="valor"
                      nameKey="nombre"
                      innerRadius={62}
                      outerRadius={90}
                      strokeWidth={2}
                    >
                      {datosAnillo.map((d) => (
                        <Cell
                          key={d.sliceKey}
                          fill={`var(--color-${d.key})`}
                          fillOpacity={d.esPagado ? 1 : 0.18}
                        />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null
                          const { cx, cy } = viewBox as { cx: number; cy: number }
                          return (
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan x={cx} y={cy - 8} className="fill-foreground text-2xl font-bold">
                                {porcentajeCubierto}%
                              </tspan>
                              <tspan x={cx} y={cy + 14} className="fill-muted-foreground text-xs">
                                pagado
                              </tspan>
                            </text>
                          )
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <p className="text-center text-xs text-muted-foreground/70">
                  Color pleno = pagado · tenue = falta pagar
                </p>
              </div>

              {/* Desglose: las cuatro filas suman la fila Total */}
              <div className="min-w-0 text-xs sm:text-sm lg:max-w-2xl">
                <div className="grid grid-cols-[minmax(4.25rem,1fr)_repeat(3,auto)] gap-x-2 gap-y-1.5 sm:gap-x-6">
                  <span className="text-xs text-muted-foreground">Rubro</span>
                  <span className="text-right text-xs text-muted-foreground">Costo</span>
                  <span className="text-right text-xs text-muted-foreground">Pagado</span>
                  <span className="text-right text-xs text-muted-foreground">Falta pagar</span>
                  {rubros.map((d) => (
                    <div key={d.key} className="contents">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: chartConfig[d.key as keyof typeof chartConfig].color }}
                        />
                        <span>{d.nombre}</span>
                      </span>
                      <span className="text-right tabular-nums">{formatCurrency(d.total)}</span>
                      <span className="text-right tabular-nums text-emerald-700">{formatCurrency(d.pagado)}</span>
                      <span className={`text-right tabular-nums ${d.total - d.pagado > 0.005 ? "text-red-600" : "text-muted-foreground"}`}>
                        {formatCurrency(Math.max(0, d.total - d.pagado))}
                      </span>
                    </div>
                  ))}
                  <span className="border-t pt-1.5 font-semibold">Total</span>
                  <span className="border-t pt-1.5 text-right font-semibold tabular-nums">{formatCurrency(costoTotalEvento)}</span>
                  <span className="border-t pt-1.5 text-right font-semibold tabular-nums text-emerald-700">
                    {formatCurrency(totalCubierto)}
                  </span>
                  <span className={`border-t pt-1.5 text-right font-semibold tabular-nums ${pendienteTotal > 0.005 ? "text-red-600" : "text-muted-foreground"}`}>
                    {formatCurrency(pendienteTotal)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-sm">
                {precioVentaEvento > 0 ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Precio del contrato</span>
                      <span className="font-semibold tabular-nums text-teal-700">{formatCurrency(precioVentaEvento)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Costo del evento</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(costoTotalEvento)}</span>
                    </div>
                    <p className="border-t pt-1.5 text-xs text-muted-foreground">
                      El costo es el{" "}
                      <span className="font-semibold text-foreground">
                        {proporcionCostoVenta !== null ? `${fmtPorcentaje(proporcionCostoVenta)}%` : "—"}
                      </span>{" "}
                      del precio del contrato.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    El evento no tiene precio de contrato cargado: no se puede comparar con el costo.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Las cuatro tarjetas: una al lado de la otra en PC grande, de a dos en
          notebook y tablet, y una debajo de la otra en celular. */}
      <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {/* Cocina */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex min-w-0 items-center gap-2 text-base">
              <ChefHat className="h-4 w-4 shrink-0 text-teal-600" />
              <span className="truncate" title="Cocina (menú e insumos)">
                Cocina
              </span>
            </CardTitle>
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm font-medium">
              <Checkbox
                checked={!!evento.cocinaPagada}
                onCheckedChange={(v) => toggleCocina(v === true)}
                // Si ya está pagada se puede revertir aunque hoy dé $0.
                disabled={costoCocinaHoy <= 0 && !evento.cocinaPagada}
                aria-label="Marcar cocina como pagada"
              />
              <span className={evento.cocinaPagada ? "text-emerald-700" : "text-muted-foreground"}>Pagado</span>
            </label>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {comprasCocina.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin menú/insumos calculados para este evento.</p>
          ) : (
            <>
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {comprasCocina.map((c) => (
                  <div key={c.insumoId} className="flex items-start justify-between gap-2 text-sm">
                    <span className="flex min-w-0 flex-col">
                      <span className="break-words text-muted-foreground">{c.insumo?.descripcion || c.insumoId}</span>
                      <span className="text-xs text-muted-foreground/60">
                        {Number(c.cantidadNecesaria.toFixed(2))} {c.insumo?.unidad || ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="font-medium tabular-nums">{formatCurrency(c.costoMateriaPrima)}</span>
                      {esArchivado && congelado && (
                        <BotonCorregir
                          etiqueta={`Corregir ${c.insumo?.descripcion || "insumo"}`}
                          onClick={() =>
                            abrirCorreccionInsumo(
                              "cocina",
                              c.insumoId,
                              c.insumo?.descripcion || c.insumoId,
                              c.insumo?.unidad || "",
                              c.cantidadNecesaria,
                              c.costoMateriaPrima,
                              c.insumo?.precioUnitario,
                            )
                          }
                        />
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <TotalRubro
                etiqueta="Total cocina"
                total={costoCocina}
                hoy={costoCocinaHoy}
                pagado={!!evento.cocinaPagada}
                fechaPago={fechaPagoCocina}
                onCorregir={esArchivado && congelado ? () => abrirCorreccion({ rubro: "cocina" }, "Menú (cocina)", costoCocina) : undefined}
              />
              {!evento.cocinaPagada && pagadoCocina > 0 && (
                <p className="text-xs text-emerald-700">
                  Pagado en parte por proveedor: {formatCurrency(pagadoCocina)}. Falta {formatCurrency(Math.max(0, costoCocina - pagadoCocina))}.
                </p>
              )}
              {menuPorSegmento.length > 0 && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                      <BookOpen className="h-4 w-4 mr-2" />
                      Ver menú completo
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <ChefHat className="h-4 w-4 text-teal-600" />
                        Menú elegido — {nombreEvento}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {menuPorSegmento.map((seg) => (
                        <div key={seg.segmento}>
                          <p className="mb-1.5 flex items-center justify-between text-sm font-semibold">
                            {seg.segmento}
                            <span className="text-xs font-normal text-muted-foreground">
                              {seg.pax} {seg.pax === 1 ? "invitado" : "invitados"}
                            </span>
                          </p>
                          <ul className="space-y-1 rounded-md border border-border p-3">
                            {seg.platos.map((plato) => (
                              <li key={plato.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="min-w-0 truncate text-muted-foreground">{plato.nombre}</span>
                                <span className="shrink-0 font-medium tabular-nums">{formatCurrency(plato.costo)}</span>
                              </li>
                            ))}
                            <li className="flex items-center justify-between gap-2 border-t pt-1.5 text-sm font-semibold">
                              <span>Subtotal {seg.segmento.toLowerCase()}</span>
                              <span className="tabular-nums">{formatCurrency(seg.platos.reduce((s, p) => s + p.costo, 0))}</span>
                            </li>
                          </ul>
                        </div>
                      ))}
                      <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                        <span>{congelado ? "Total cocina" : "Total cocina a precios de hoy"}</span>
                        <span className="tabular-nums">
                          {formatCurrency(menuPorSegmento.reduce((s, seg) => s + seg.platos.reduce((t, p) => t + p.costo, 0), 0))}
                        </span>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Barra */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex min-w-0 items-center gap-2 text-base">
              <Wine className="h-4 w-4 shrink-0 text-teal-600" />
              <span className="truncate" title="Barra (insumos de bebidas)">
                Barra
              </span>
            </CardTitle>
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm font-medium">
              <Checkbox
                checked={!!evento.barraPagada}
                onCheckedChange={(v) => toggleBarra(v === true)}
                disabled={costoBarraHoy <= 0 && !evento.barraPagada}
                aria-label="Marcar barra como pagada"
              />
              <span className={evento.barraPagada ? "text-emerald-700" : "text-muted-foreground"}>Pagado</span>
            </label>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {comprasBarra.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin barra configurada para este evento.</p>
          ) : (
            <>
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {comprasBarra.map((c) => (
                  <div key={c.insumoBarraId} className="flex items-start justify-between gap-2 text-sm">
                    <span className="flex min-w-0 flex-col">
                      <span className="break-words text-muted-foreground">
                        {c.insumoBarra?.descripcion || c.insumoBarraId}
                      </span>
                      <span className="text-xs text-muted-foreground/60">
                        {Number(c.cantidadNecesaria.toFixed(2))} {c.insumoBarra?.unidad || ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="font-medium tabular-nums">{formatCurrency(c.costoMateriaPrima)}</span>
                      {esArchivado && congelado && (
                        <BotonCorregir
                          etiqueta={`Corregir ${c.insumoBarra?.descripcion || "insumo"}`}
                          onClick={() =>
                            abrirCorreccionInsumo(
                              "barra",
                              c.insumoBarraId,
                              c.insumoBarra?.descripcion || c.insumoBarraId,
                              c.insumoBarra?.unidad || "",
                              c.cantidadNecesaria,
                              c.costoMateriaPrima,
                              c.insumoBarra?.precioUnitario,
                            )
                          }
                        />
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <TotalRubro
                etiqueta="Total barra"
                total={costoBarra}
                hoy={costoBarraHoy}
                pagado={!!evento.barraPagada}
                fechaPago={fechaPagoBarra}
                onCorregir={esArchivado && congelado ? () => abrirCorreccion({ rubro: "barra" }, "Barra", costoBarra) : undefined}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Servicios */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <ConciergeBell className="h-4 w-4 shrink-0 text-teal-600" />
            <span className="truncate" title="Servicios contratados (señas y saldos)">
              Servicios contratados
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {servicios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin servicios contratados.</p>
          ) : (
            <>
              <div className="space-y-3">
                {serviciosCalc.map(({ srv, senaPagada, saldoPagado, montoSeña, saldo, comoSueldo, señaSinEgreso, saldoSinEgreso }) => (
                  <div key={srv.servicioId} className="rounded-lg border border-border p-3">
                    <p className="mb-2 flex items-start justify-between gap-2 text-sm font-semibold">
                      <span className="min-w-0 break-words">{srv.nombre}</span>
                      <span className="shrink-0 tabular-nums">{formatCurrency(montoSeña + saldo)}</span>
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {montoSeña > 0 && (
                        <FilaPago
                          className="bg-muted/40"
                          checked={senaPagada}
                          onChange={(v) => toggleSena(srv.servicioId, v)}
                          disabled={saldoPagado || comoSueldo}
                          ariaLabel={`Marcar seña de ${srv.nombre} como pagada`}
                          titulo="Seña"
                          detalle={
                            senaPagada
                              ? srv.fechaPagoSeña
                                ? `pagada el ${formatFechaCorta(srv.fechaPagoSeña)}`
                                : "pagada"
                              : srv.fechaSeña
                                ? `vence ${formatFechaCorta(srv.fechaSeña)}`
                                : undefined
                          }
                          aviso={
                            <>
                              {señaSinEgreso && <AvisoSinEgreso />}
                              {habilitacionSeña && !senaPagada && !saldoPagado && !comoSueldo && (
                                <AvisoSeñaBloqueada fechaHabilitacion={habilitacionSeña} />
                              )}
                            </>
                          }
                          monto={montoSeña}
                          pagado={senaPagada}
                          onCorregir={
                            esArchivado && congelado
                              ? () => abrirCorreccion({ rubro: "seña", servicioId: srv.servicioId }, `Seña de ${srv.nombre}`, montoSeña)
                              : undefined
                          }
                        />
                      )}
                      <FilaPago
                        className="bg-muted/40"
                        checked={saldoPagado}
                        onChange={(v) => toggleSaldo(srv.servicioId, v)}
                        // Como sueldo se paga solo desde Caja Eventos → Sueldos
                        // (un único pago), para no pagarlo por dos caminos. El
                        // saldo de un proveedor espera a que se pague la seña.
                        disabled={comoSueldo || (!saldoPagado && saldoEsperaSeña(srv, { servicios: state.servicios ?? [] }))}
                        ariaLabel={`Marcar ${comoSueldo ? "sueldo" : "saldo"} de ${srv.nombre} como pagado`}
                        titulo={comoSueldo ? "Sueldo" : "Saldo"}
                        detalle={
                          saldoPagado
                            ? srv.fechaPagoSaldo
                              ? `pagado el ${formatFechaCorta(srv.fechaPagoSaldo)}`
                              : "pagado"
                            : !comoSueldo && saldoEsperaSeña(srv, { servicios: state.servicios ?? [] })
                              ? `se paga después de la seña${srv.fechaLimitePago ? ` · vence ${formatFechaCorta(srv.fechaLimitePago)}` : ""}`
                              : comoSueldo
                              ? `se paga en Caja Eventos → Sueldos${(srv.fechaSueldoManual || evento.fecha) ? ` · vence ${formatFechaCorta(srv.fechaSueldoManual || evento.fecha)}` : ""}`
                              : srv.fechaLimitePago
                                ? `vence ${formatFechaCorta(srv.fechaLimitePago)}`
                                : undefined
                        }
                        aviso={saldoSinEgreso ? <AvisoSinEgreso /> : undefined}
                        monto={saldo}
                        pagado={saldoPagado}
                        onCorregir={
                          esArchivado && congelado && !comoSueldo
                            ? () => abrirCorreccion({ rubro: "saldo", servicioId: srv.servicioId }, `Saldo de ${srv.nombre}`, saldo)
                            : undefined
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>Total servicios</span>
                <span className="tabular-nums">{formatCurrency(totalServicios)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Personal */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-teal-600" />
            Personal del evento
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {personal.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin personal asignado con costo.</p>
          ) : (
            <>
              <div className="space-y-2">
                {personal.map((pe) => (
                  <FilaPago
                    key={pe.id}
                    className="border border-border"
                    checked={!!pe.pagado}
                    onChange={(v) => togglePersonal(pe.id, v)}
                    ariaLabel={`Marcar sueldo de ${pe.nombre} como pagado`}
                    titulo={<span className="font-medium">{pe.nombre}</span>}
                    detalle={
                      <span className="flex flex-wrap items-center gap-x-1.5">
                        <span>{pe.funcion}</span>
                        {!pe.pagado && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {/* Sin fecha, el sueldo vence el día del evento */}
                            {formatFechaCorta(pe.fechaPago || evento.fecha)}
                          </span>
                        )}
                        {pe.pagado && <span>· pagado</span>}
                      </span>
                    }
                    monto={pe.monto || 0}
                    pagado={!!pe.pagado}
                    onCorregir={
                      esArchivado && congelado
                        ? () => abrirCorreccion({ rubro: "sueldo", personalId: pe.id }, `Sueldo de ${pe.nombre}`, pe.monto || 0)
                        : undefined
                    }
                  />
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>Total personal</span>
                <span className="tabular-nums">{formatCurrency(totalPersonal)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Lo cobrado al cliente */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            Cobrado al cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cuotas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este evento no tiene plan de cuotas.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="text-lg font-semibold tabular-nums text-emerald-700">{formatCurrency(cobro.cobrado)}</span>
                  <span className="text-muted-foreground"> de {formatCurrency(cobro.totalACobrar)}</span>
                </span>
                <span className="text-muted-foreground">
                  {cuotasPagadas.length} de {cuotas.length} cuotas pagadas
                  {cuotasParciales.length > 0 &&
                    ` · ${cuotasParciales.length} con pago parcial`}
                </span>
              </div>
              <Progress
                value={cobro.progreso}
                className="h-4 bg-emerald-100 [&>div]:bg-emerald-600"
                aria-label={`${cobro.progreso}% cobrado`}
              />
              <div className="flex flex-wrap gap-1.5">
                {cuotas.map((c) => {
                  const parcial = !c.pagada && c.montoAcumulado > 0
                  return (
                    <span
                      key={c.numeroCuota}
                      title={`Cuota ${c.numeroCuota} · vence ${formatFecha(c.fechaVencimiento)} · ${formatCurrency(c.monto)}${parcial ? ` · cobrado ${formatCurrency(c.montoAcumulado)}` : ""}`}
                      className={`flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-semibold ${
                        c.pagada
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : parcial
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-border bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {c.numeroCuota}
                    </span>
                  )
                })}
              </div>
              {/* Cómo se llega al total: precio + recargo/IPC = seña + cuotas */}
              <div className="grid gap-x-6 gap-y-1 border-t pt-3 text-sm sm:grid-cols-2">
                {cobro.precioContrato > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Precio del contrato</span>
                    <span className="tabular-nums">{formatCurrency(cobro.precioContrato)}</span>
                  </div>
                )}
                {Math.abs(cobro.ajuste) >= 1 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      {evento.planDeCuotas?.ajustaPorIPC ? "Ajuste por IPC y financiación" : "Recargo por financiación"}
                    </span>
                    <span className="tabular-nums">
                      {cobro.ajuste > 0 ? "+ " : "− "}
                      {formatCurrency(Math.abs(cobro.ajuste))}
                    </span>
                  </div>
                )}
                {cobro.seña > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Seña (cobrada al firmar)</span>
                    <span className="tabular-nums text-emerald-700">{formatCurrency(cobro.seña)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Falta cobrar</span>
                  <span className={`font-semibold tabular-nums ${cobro.faltaCobrar > 0.005 ? "text-red-600" : "text-emerald-700"}`}>
                    {formatCurrency(cobro.faltaCobrar)}
                  </span>
                </div>
              </div>
              {cobro.faltaCobrar <= 0.005 && (
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> El cliente pagó todas las cuotas.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Observaciones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <StickyNote className="h-4 w-4 text-teal-600" />
            Observaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Dejá una nota sobre los costos de este evento (proveedores, acuerdos, pendientes...)"
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={guardarObservacion}
              disabled={guardandoObs || observacion === observacionGuardada}
              className="bg-teal-600 text-white hover:bg-teal-700"
            >
              {guardandoObs ? "Guardando..." : "Guardar observación"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Acceso directo a Cobrar cuota con este evento ya elegido (pedido del
          dueño, 10/11/2026): para registrar ahí las cuotas que pagó el
          cliente. Con ?evento= también abre los finalizados, que no salen en
          el buscador. */}
      <Button asChild variant="outline" className="w-full gap-2">
        <Link href={`/eventos/pagos?evento=${encodeURIComponent(evento.id)}`} prefetch={false}>
          <HandCoins className="h-4 w-4" />
          Registrar cuotas en Cobrar cuota
        </Link>
      </Button>
    </div>
  )
}

/**
 * Total de cocina o barra. Ya pagado, muestra lo que salió de Caja Eventos; si
 * los precios cambiaron desde entonces, aclara cuánto daría hoy la lista de
 * arriba, para que la lista y el total no parezcan no cerrar.
 */
function TotalRubro({
  etiqueta,
  total,
  hoy,
  pagado,
  fechaPago,
  onCorregir,
}: {
  etiqueta: string
  total: number
  hoy: number
  pagado: boolean
  fechaPago?: string
  /** Evento finalizado: lápiz para corregir el costo (lib/correccion-finalizado.ts). */
  onCorregir?: () => void
}) {
  const difiere = pagado && Math.abs(total - hoy) >= 0.01
  return (
    <div className="space-y-1 border-t pt-2 text-sm">
      {difiere && (
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <span>A precios de hoy</span>
          <span className="tabular-nums">{formatCurrency(hoy)}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 font-semibold">
        <span>{difiere ? `${etiqueta} (pagado)` : etiqueta}</span>
        <span className="flex items-center gap-1">
          <span className={`tabular-nums ${pagado ? "text-emerald-700" : "text-red-600"}`}>{formatCurrency(total)}</span>
          {onCorregir && <BotonCorregir onClick={onCorregir} etiqueta={`Corregir ${etiqueta.toLowerCase()}`} />}
        </span>
      </div>
      {pagado && fechaPago && (
        <p className="text-xs text-muted-foreground">
          Pagado el {formatFechaCorta(fechaNegocio(new Date(fechaPago)))} desde Caja Eventos
        </p>
      )}
    </div>
  )
}

// Fila de pago (seña, saldo, sueldo): casilla, nombre con un detalle debajo
// y el monto a la derecha. El detalle va en su propia línea para que no se
// pise con el monto cuando la tarjeta es angosta.
function FilaPago({
  checked,
  onChange,
  disabled,
  ariaLabel,
  titulo,
  detalle,
  aviso,
  monto,
  pagado,
  className = "",
  onCorregir,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  ariaLabel: string
  titulo: React.ReactNode
  detalle?: React.ReactNode
  aviso?: React.ReactNode
  monto: number
  pagado: boolean
  className?: string
  /** Evento finalizado: lápiz para corregir el monto (lib/correccion-finalizado.ts). */
  onCorregir?: () => void
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 text-sm ${disabled ? "cursor-default" : ""} ${className}`}
    >
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="break-words">{titulo}</span>
        {detalle && <span className="text-xs text-muted-foreground">{detalle}</span>}
        {aviso}
      </span>
      <span className={`shrink-0 font-medium tabular-nums ${pagado ? "text-emerald-700" : "text-red-600"}`}>
        {formatCurrency(monto)}
      </span>
      {onCorregir && (
        <BotonCorregir
          etiqueta={`Corregir ${typeof titulo === "string" ? titulo.toLowerCase() : "monto"}`}
          onClick={onCorregir}
        />
      )}
    </label>
  )
}

// Lápiz para corregir un costo de un evento finalizado. Va dentro de la fila
// (que es un <label>): frena el clic para no tildar ni destildar el pago.
function BotonCorregir({ onClick, etiqueta }: { onClick: () => void; etiqueta: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className="-my-1 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={etiqueta}
      title="Corregir"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  )
}

// Pagos marcados en el evento que no tienen su egreso en Caja Eventos (datos
// viejos, o un saldo pagado sin haber pagado la seña): se avisa sin cambiar montos.
function AvisoSinEgreso() {
  return <span className="text-xs text-amber-700 dark:text-amber-400">Marcado pagado, sin pago en Caja Eventos</span>
}

export default function CostosEventoPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Cargando...</div>}>
      <CostosEventoContent />
    </Suspense>
  )
}

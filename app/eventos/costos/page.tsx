"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useStore } from "@/lib/store-context"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils-financieros"
import {
  generateId,
  generarCalendarioCuotas,
  calcularComprasSegmentadas,
  calcularComprasBarras,
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
} from "lucide-react"
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

function CostosEventoContent() {
  const searchParams = useSearchParams()
  const eventoId = searchParams.get("id") || ""
  const {
    state,
    updateEvento,
    addMovimientosCaja,
    deleteMovimientoCaja,
    setInsumos,
    setInsumosBarra,
    setRecetas,
    setCocteles,
    setEventos,
    setServicios,
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
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null)
  const sincronizando = useRef(false)

  useEffect(() => {
    const refrescar = async () => {
      if (sincronizando.current) return
      sincronizando.current = true
      try {
        const fetchSafe = async (url: string) => {
          try {
            const r = await fetch(url, { cache: "no-store" })
            if (!r.ok) return null
            const data = await r.json()
            return Array.isArray(data) ? data : null
          } catch {
            return null
          }
        }
        // El catálogo de servicios (precios, % de seña) vive en Supabase vía
        // data-service, no en un endpoint HTTP; lo traemos con fetchServicios().
        const fetchServiciosSafe = async () => {
          try {
            const { fetchServicios } = await import("@/lib/supabase/data-service")
            const data = await fetchServicios()
            return Array.isArray(data) ? data : null
          } catch {
            return null
          }
        }
        const [insumosRes, insumosBarraRes, recetasRes, coctelesRes, eventosRes, serviciosRes] = await Promise.all([
          fetchSafe("/api/insumos"),
          fetchSafe("/api/insumos-barra"),
          fetchSafe("/api/recetas"),
          fetchSafe("/api/cocteles"),
          fetchSafe("/api/eventos"),
          fetchServiciosSafe(),
        ])
        if (insumosRes) setInsumos(insumosRes)
        if (insumosBarraRes) setInsumosBarra(insumosBarraRes)
        if (recetasRes) setRecetas(recetasRes)
        if (coctelesRes) setCocteles(coctelesRes)
        if (eventosRes) setEventos(eventosRes)
        if (serviciosRes) setServicios(serviciosRes)
        setUltimaSync(new Date())
      } finally {
        sincronizando.current = false
      }
    }

    const interval = setInterval(refrescar, 15000)
    const onVisible = () => {
      if (document.visibilityState === "visible") refrescar()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Observación guardada dentro de costosCalculados (JSON ya persistido del evento)
  const observacionGuardada =
    ((evento?.costosCalculados as Record<string, unknown> | null)?.observacionCostos as string) || ""
  const [observacion, setObservacion] = useState(observacionGuardada)
  const [guardandoObs, setGuardandoObs] = useState(false)

  // --- ARCHIVO: foto congelada de costos (si el evento está archivado) ---
  // Mientras el evento esté en el Archivo se muestran los datos guardados al
  // archivarlo; nada se recalcula en vivo. Al sacarlo del archivo, la foto se
  // descarta (en updateEvento del store) y todo vuelve a calcularse en vivo.
  const esArchivado = evento?.estado === "completado"
  const congeladoRaw = esArchivado ? evento?.costosCalculados?.archivoCongelado : undefined
  // Una foto sin ningún dato se considera inválida (pudo generarse antes de
  // que cargaran los catálogos) y se ignora para no mostrar todo en cero.
  const congelado =
    congeladoRaw &&
    ((congeladoRaw.comprasCocina?.length ?? 0) > 0 ||
      (congeladoRaw.comprasBarra?.length ?? 0) > 0 ||
      (congeladoRaw.personal?.length ?? 0) > 0 ||
      (congeladoRaw.serviciosCalc?.length ?? 0) > 0)
      ? congeladoRaw
      : undefined

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
  const comprasCocinaLive = useMemo(
    () => (evento ? calcularComprasSegmentadas(evento, state.recetas || [], state.insumos || []) : []),
    [evento, state.recetas, state.insumos],
  )
  const comprasBarraLive = useMemo(
    () => (evento ? calcularComprasBarras(evento, state.cocteles || [], state.insumosBarra || []) : []),
    [evento, state.cocteles, state.insumosBarra],
  )
  const comprasCocina = congelado?.comprasCocina ?? comprasCocinaLive
  const comprasBarra = congelado?.comprasBarra ?? comprasBarraLive
  const cuotas = useMemo(() => (evento ? generarCalendarioCuotas(evento) : []), [evento])

  if (!evento) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-10">
        <p className="text-muted-foreground">Evento no encontrado.</p>
        <Button asChild variant="outline" className="mt-4 bg-transparent">
          <Link href="/eventos/lista">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver a la lista
          </Link>
        </Button>
      </main>
    )
  }

  const nombreEvento = evento.nombre || evento.nombrePareja || "Evento sin nombre"
  const costoCocina = comprasCocina.reduce((s, c) => s + c.costoMateriaPrima, 0)
  const costoBarra = comprasBarra.reduce((s, c) => s + c.costoMateriaPrima, 0)
  const servicios = evento.servicios || []
  // Sueldos EN VIVO desde el roster (Finanzas → Personal): siguen la tarifa
  // vigente salvo que estén pagados o con monto personalizado por evento.
  // Si el evento está archivado, se usan los sueldos congelados al archivar.
  const personal =
    congelado?.personal ??
    (evento.personalEvento || [])
      .map((pe) => ({ ...pe, monto: calcularMontoPersonalDelEvento(pe, state.personal) }))
      .filter((pe) => (pe.monto || 0) > 0)

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

  // --- Progreso de cuotas del cliente ---
  // La seña se cobra al firmar el contrato y cubre un porcentaje del total, pero
  // no figura como cuota. Para que la barra refleje lo realmente cobrado, se suma
  // como monto ya cubierto (misma lógica que en la página de pagos del evento).
  const cuotasPagadas = cuotas.filter((c) => c.pagada)
  const montoSenaCobrada =
    evento.planDeCuotas?.modalidadPago === "sena" ? evento.planDeCuotas.montoSena || 0 : 0
  const montoTotalCuotas = cuotas.reduce((s, c) => s + c.monto, 0) + montoSenaCobrada
  const montoCobrado = cuotasPagadas.reduce((s, c) => s + c.monto, 0) + montoSenaCobrada
  const progresoCuotas = montoTotalCuotas > 0 ? Math.round((montoCobrado / montoTotalCuotas) * 100) : 0

  // --- Totales por tarjeta para el gráfico circular ---
  // Monto de saldo pagado se recupera del movimiento registrado en Caja Eventos
  const montoSaldoPagado = (nombreServicio: string): number => {
    const mov = [...(state.movimientosCaja ?? [])]
      .reverse()
      .find(
        (m) =>
          m.tipo === "egreso" &&
          m.cajaDestino === "caja_eventos" &&
          m.eventoId === evento.id &&
          m.concepto === `Pago saldo ${nombreServicio} - ${evento.nombre || evento.nombrePareja || "Evento sin nombre"}`,
      )
    return mov?.monto || 0
  }
  // Cada servicio contratado recalcula su seña y saldo EN VIVO a partir del
  // catálogo global (state.servicios): si en Producción → Servicios se edita el
  // costo o el % de seña, el costo del servicio acá se actualiza al instante.
  // Las porciones YA PAGADAS conservan el monto real que movió la caja (histórico);
  // solo las porciones pendientes reflejan el precio vigente. Si el servicio fue
  // eliminado del catálogo, se usa el valor guardado en el contrato como respaldo.
  const serviciosCalc = servicios.map((srv) => {
    const senaPagada =
      srv.estadoPago === "señado" || srv.estadoPago === "saldo_pendiente" || srv.estadoPago === "pagado_total"
    const saldoPagado = srv.estadoPago === "pagado_total" || srv.pagado === true

    // Cálculo centralizado en vivo (mismo criterio que Caja Eventos, Cashflow y Balance).
    const { montoSeña: montoSeñaCalc, saldoPendiente: saldoCalc } = calcularSeñaSaldoServicio(srv, {
      servicios: state.servicios ?? [],
    })

    // Si el evento está archivado, usar los montos congelados al archivar.
    const frozen = congelado?.serviciosCalc?.find((f) => f.servicioId === srv.servicioId)

    // Preservar lo ya pagado; recalcular en vivo lo pendiente.
    const montoSeña = frozen ? frozen.montoSeña : montoSeñaCalc
    const saldo = frozen ? frozen.saldo : saldoPagado ? montoSaldoPagado(srv.nombre) : saldoCalc

    return { srv, senaPagada, saldoPagado, montoSeña, saldo }
  })

  const totalServicios = serviciosCalc.reduce((s, c) => s + c.montoSeña + c.saldo, 0)
  const pagadoServicios = serviciosCalc.reduce(
    (s, c) => s + (c.senaPagada ? c.montoSeña : 0) + (c.saldoPagado ? c.saldo : 0),
    0,
  )
  const totalPersonal = personal.reduce((s, pe) => s + (pe.monto || 0), 0)
  const pagadoPersonal = personal.filter((pe) => pe.pagado).reduce((s, pe) => s + (pe.monto || 0), 0)
  const pagadoCocina = evento.cocinaPagada ? costoCocina : 0
  const pagadoBarra = evento.barraPagada ? costoBarra : 0

  const costoTotalEvento = costoCocina + costoBarra + totalServicios + totalPersonal
  const totalCubierto = pagadoCocina + pagadoBarra + pagadoServicios + pagadoPersonal
  const porcentajeCubierto = costoTotalEvento > 0 ? Math.round((totalCubierto / costoTotalEvento) * 100) : 0

  // Precio de venta del evento (monto total del plan de pago) y proporción
  // del costo del evento frente a ese precio de venta.
  const precioVentaEvento = evento.planDeCuotas?.montoTotal ?? 0
  const proporcionCostoVenta = precioVentaEvento > 0 ? (costoTotalEvento / precioVentaEvento) * 100 : null

  const datosGrafico = [
    { key: "cocina", nombre: "Cocina", total: costoCocina, pagado: pagadoCocina },
    { key: "barra", nombre: "Barra", total: costoBarra, pagado: pagadoBarra },
    { key: "servicios", nombre: "Servicios", total: totalServicios, pagado: pagadoServicios },
    { key: "personal", nombre: "Personal", total: totalPersonal, pagado: pagadoPersonal },
  ].filter((d) => d.total > 0)

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

  // Busca y elimina el último egreso que coincide (para revertir un pago)
  const quitarEgreso = (concepto: string): MovimientoCaja | undefined => {
    const mov = [...(state.movimientosCaja ?? [])]
      .reverse()
      .find(
        (m) =>
          m.tipo === "egreso" &&
          m.cajaDestino === "caja_eventos" &&
          m.eventoId === evento.id &&
          m.concepto === concepto,
      )
    if (mov) deleteMovimientoCaja(mov.id)
    return mov
  }

  const hoyStr = new Date().toISOString().split("T")[0]

  // Con el evento archivado no se registran ni revierten pagos: los datos
  // están congelados hasta que se saque el evento del archivo.
  const bloquearPorArchivo = (): boolean => {
    if (!esArchivado) return false
    toast({
      title: "Evento archivado",
      description: "Los datos están congelados. Sacá el evento del archivo para modificar pagos.",
    })
    return true
  }

  // --- Cocina ---
  const toggleCocina = (checked: boolean) => {
    if (bloquearPorArchivo()) return
    updateEvento(evento.id, { cocinaPagada: checked })
    const concepto = `Pago menú - ${nombreEvento}`
    if (checked) {
      registrarEgreso(concepto, costoCocina)
      toast({ title: "Cocina marcada como pagada", description: formatCurrency(costoCocina) })
    } else {
      quitarEgreso(concepto)
      toast({ title: "Pago de cocina revertido" })
    }
  }

  // --- Barra ---
  const toggleBarra = (checked: boolean) => {
    if (bloquearPorArchivo()) return
    updateEvento(evento.id, { barraPagada: checked })
    const concepto = `Pago barra - ${nombreEvento}`
    if (checked) {
      registrarEgreso(concepto, costoBarra)
      toast({ title: "Barra marcada como pagada", description: formatCurrency(costoBarra) })
    } else {
      quitarEgreso(concepto)
      toast({ title: "Pago de barra revertido" })
    }
  }

  // --- Servicios: seña ---
  const toggleSena = (servicioId: string, checked: boolean) => {
    if (bloquearPorArchivo()) return
    const srv = servicios.find((s) => s.servicioId === servicioId)
    if (!srv) return
    const concepto = `Pago seña ${srv.nombre} - ${nombreEvento}`
    // Monto EN VIVO desde el catálogo: lo que se registra en caja es lo que
    // se está mostrando en pantalla, no la foto guardada al contratar.
    const { montoSeña: montoSeñaLive } = calcularSeñaSaldoServicio(
      { ...srv, estadoPago: "sin_seña" },
      { servicios: state.servicios ?? [] },
    )
    const nuevosServicios = servicios.map((s) => {
      if (s.servicioId !== servicioId) return s
      // Al pagar, fijar el monto pagado como histórico del servicio.
      if (checked) return { ...s, estadoPago: "señado" as const, fechaPagoSeña: hoyStr, montoSeña: montoSeñaLive }
      return { ...s, estadoPago: "sin_seña" as const, fechaPagoSeña: undefined }
    })
    updateEvento(evento.id, { servicios: nuevosServicios })
    if (checked) {
      registrarEgreso(concepto, montoSeñaLive)
      toast({ title: `Seña de ${srv.nombre} pagada`, description: formatCurrency(montoSeñaLive) })
    } else {
      quitarEgreso(concepto)
      toast({ title: `Seña de ${srv.nombre} revertida` })
    }
  }

  // --- Servicios: saldo ---
  const toggleSaldo = (servicioId: string, checked: boolean) => {
    if (bloquearPorArchivo()) return
    const srv = servicios.find((s) => s.servicioId === servicioId)
    if (!srv) return
    const concepto = `Pago saldo ${srv.nombre} - ${nombreEvento}`
    if (checked) {
      // Saldo EN VIVO desde el catálogo (costo actual − seña pagada).
      const { saldoPendiente: saldoLive } = calcularSeñaSaldoServicio(srv, { servicios: state.servicios ?? [] })
      const monto = saldoLive
      const nuevosServicios = servicios.map((s) =>
        s.servicioId === servicioId
          ? { ...s, pagado: true, estadoPago: "pagado_total" as const, saldoPendiente: 0, fechaPagoSaldo: hoyStr }
          : s,
      )
      updateEvento(evento.id, { servicios: nuevosServicios })
      registrarEgreso(concepto, monto)
      toast({ title: `Saldo de ${srv.nombre} pagado`, description: formatCurrency(monto) })
    } else {
      const mov = quitarEgreso(concepto)
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
    const pe = (evento.personalEvento || []).find((p) => p.id === peId)
    if (!pe) return
    const concepto = `Pago sueldo ${pe.nombre} (${pe.funcion}) - ${nombreEvento}`
    // Monto EN VIVO desde el roster: lo que se registra en caja es lo que se
    // muestra en pantalla. Al pagar, ese monto queda fijado como histórico.
    const montoLive = calcularMontoPersonalDelEvento(pe, state.personal)
    const nuevoPersonal = (evento.personalEvento || []).map((p) =>
      p.id === peId ? (checked ? { ...p, pagado: true, monto: montoLive } : { ...p, pagado: false }) : p,
    )
    updateEvento(evento.id, { personalEvento: nuevoPersonal })
    if (checked) {
      registrarEgreso(concepto, montoLive)
      toast({ title: `Sueldo de ${pe.nombre} pagado`, description: formatCurrency(montoLive) })
    } else {
      quitarEgreso(concepto)
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

  return (
    <main className="mx-auto w-full max-w-none px-4 py-6 space-y-5 xl:px-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link href="/eventos/lista" aria-label="Volver a la lista de eventos">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
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
              ? `Evento archivado — datos congelados al ${formatFecha(congelado.fechaArchivado.slice(0, 10))}`
              : "Evento archivado — datos congelados"}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            {ultimaSync
              ? `Precios y contrato actualizados ${ultimaSync.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Sincronización en tiempo real activa"}
          </span>
        )}
      </div>

      {/* En PC: las 4 tarjetas + gráfico una al lado de la otra; en pantallas medianas 2x2 + gráfico */}
      <div className="grid gap-4 items-start xl:grid-cols-5 xl:items-stretch">
      <div className="grid gap-4 items-start md:grid-cols-2 xl:col-span-4 xl:grid-cols-4 xl:items-stretch">
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
                disabled={costoCocina <= 0}
                aria-label="Marcar cocina como pagada"
              />
              {evento.cocinaPagada ? (
                <span className="text-emerald-700">Pagado</span>
              ) : (
                <span className="text-muted-foreground">Pagado</span>
              )}
            </label>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
          {comprasCocina.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin menú/insumos calculados para este evento.</p>
          ) : (
            <>
              <div className="max-h-48 min-h-0 space-y-1 overflow-y-auto pr-1 xl:max-h-none xl:flex-1 xl:basis-0">
                {comprasCocina.map((c) => (
                  <div key={c.insumoId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-muted-foreground">{c.insumo?.descripcion || c.insumoId}</span>
                      <span className="text-xs text-muted-foreground/60">
                        {Number(c.cantidadNecesaria.toFixed(2))} {c.insumo?.unidad || ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium">{formatCurrency(c.costoMateriaPrima)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>Total cocina</span>
                <span className={evento.cocinaPagada ? "text-emerald-700" : "text-red-600"}>
                  {formatCurrency(costoCocina)}
                </span>
              </div>
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
                                <span className="shrink-0 font-medium">{formatCurrency(plato.costo)}</span>
                              </li>
                            ))}
                            <li className="flex items-center justify-between gap-2 border-t pt-1.5 text-sm font-semibold">
                              <span>Subtotal {seg.segmento.toLowerCase()}</span>
                              <span>{formatCurrency(seg.platos.reduce((s, p) => s + p.costo, 0))}</span>
                            </li>
                          </ul>
                        </div>
                      ))}
                      <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                        <span>Total cocina</span>
                        <span>{formatCurrency(costoCocina)}</span>
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
                disabled={costoBarra <= 0}
                aria-label="Marcar barra como pagada"
              />
              {evento.barraPagada ? (
                <span className="text-emerald-700">Pagado</span>
              ) : (
                <span className="text-muted-foreground">Pagado</span>
              )}
            </label>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
          {comprasBarra.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin barra configurada para este evento.</p>
          ) : (
            <>
              <div className="max-h-48 min-h-0 space-y-1 overflow-y-auto pr-1 xl:max-h-none xl:flex-1 xl:basis-0">
                {comprasBarra.map((c) => (
                  <div key={c.insumoBarraId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-muted-foreground">
                        {c.insumoBarra?.descripcion || c.insumoBarraId}
                      </span>
                      <span className="text-xs text-muted-foreground/60">
                        {Number(c.cantidadNecesaria.toFixed(2))} {c.insumoBarra?.unidad || ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium">{formatCurrency(c.costoMateriaPrima)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>Total barra</span>
                <span className={evento.barraPagada ? "text-emerald-700" : "text-red-600"}>
                  {formatCurrency(costoBarra)}
                </span>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full bg-transparent">
                    <Wine className="h-4 w-4 mr-2" />
                    Ver barra completa
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Wine className="h-4 w-4 text-teal-600" />
                      Barra completa — {nombreEvento}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-1">
                    {comprasBarra.map((c) => (
                      <div key={c.insumoBarraId} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-muted-foreground">
                            {c.insumoBarra?.descripcion || c.insumoBarraId}
                          </span>
                          <span className="text-xs text-muted-foreground/60">
                            {Number(c.cantidadNecesaria.toFixed(2))} {c.insumoBarra?.unidad || ""}
                          </span>
                        </span>
                        <span className="shrink-0 font-medium">{formatCurrency(c.costoMateriaPrima)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                      <span>Total barra</span>
                      <span>{formatCurrency(costoBarra)}</span>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
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
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="max-h-[300px] min-h-0 space-y-3 overflow-y-auto pr-1 xl:max-h-none xl:flex-1 xl:basis-0">
          {servicios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin servicios contratados.</p>
          ) : (
            serviciosCalc.map(({ srv, senaPagada, saldoPagado, montoSeña, saldo }) => {
              return (
                <div key={srv.servicioId} className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-semibold">{srv.nombre}</p>
                  <div className="flex flex-col gap-2">
                    {montoSeña > 0 && (
                      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <Checkbox
                            checked={senaPagada}
                            onCheckedChange={(v) => toggleSena(srv.servicioId, v === true)}
                            disabled={saldoPagado}
                            aria-label={`Marcar seña de ${srv.nombre} como pagada`}
                          />
                          <span className="shrink-0">Seña</span>
                          {srv.fechaSeña && !senaPagada && (
                            <span className="truncate text-xs text-muted-foreground">
                              vence {formatFecha(srv.fechaSeña)}
                            </span>
                          )}
                        </span>
                        <span
                          className={`shrink-0 font-medium ${senaPagada ? "text-emerald-700" : "text-red-600"}`}
                        >
                          {formatCurrency(montoSeña)}
                        </span>
                      </label>
                    )}
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          checked={saldoPagado}
                          onCheckedChange={(v) => toggleSaldo(srv.servicioId, v === true)}
                          aria-label={`Marcar saldo de ${srv.nombre} como pagado`}
                        />
                        <span className="shrink-0">Saldo</span>
                        {srv.fechaLimitePago && !saldoPagado && (
                          <span className="truncate text-xs text-muted-foreground">
                            vence {formatFecha(srv.fechaLimitePago)}
                          </span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 font-medium ${saldoPagado ? "text-emerald-700" : "text-red-600"}`}
                      >
                        {saldoPagado ? "Pagado" : formatCurrency(saldo)}
                      </span>
                    </label>
                  </div>
                </div>
              )
            })
          )}
          </div>
          {servicios.length > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  <ConciergeBell className="h-4 w-4 mr-2" />
                  Ver servicios completos
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ConciergeBell className="h-4 w-4 text-teal-600" />
                    Servicios contratados — {nombreEvento}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {serviciosCalc.map(({ srv, senaPagada, saldoPagado, montoSeña, saldo }) => (
                    <div key={srv.servicioId} className="rounded-lg border border-border p-3">
                      <p className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold">
                        <span className="min-w-0 truncate">{srv.nombre}</span>
                        <span className="shrink-0">{formatCurrency(montoSeña + saldo)}</span>
                      </p>
                      <div className="space-y-1 text-sm">
                        {montoSeña > 0 && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Seña</span>
                            <span className={senaPagada ? "font-medium text-emerald-700" : "font-medium text-red-600"}>
                              {formatCurrency(montoSeña)} {senaPagada ? "(pagada)" : "(pendiente)"}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">Saldo</span>
                          <span className={saldoPagado ? "font-medium text-emerald-700" : "font-medium text-red-600"}>
                            {formatCurrency(saldo)} {saldoPagado ? "(pagado)" : "(pendiente)"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                    <span>Total servicios</span>
                    <span>{formatCurrency(totalServicios)}</span>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="max-h-[300px] min-h-0 space-y-2 overflow-y-auto pr-1 xl:max-h-none xl:flex-1 xl:basis-0">
          {personal.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin personal asignado con costo.</p>
          ) : (
            personal.map((pe) => (
              <label
                key={pe.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Checkbox
                    checked={!!pe.pagado}
                    onCheckedChange={(v) => togglePersonal(pe.id, v === true)}
                    aria-label={`Marcar sueldo de ${pe.nombre} como pagado`}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{pe.nombre}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate">{pe.funcion}</span>
                      {pe.fechaPago && !pe.pagado && (
                        <span className="flex shrink-0 items-center gap-1">
                          <CalendarDays className="h-3 w-3" /> {formatFecha(pe.fechaPago)}
                        </span>
                      )}
                    </span>
                  </span>
                </span>
                <span className={`shrink-0 font-medium ${pe.pagado ? "text-emerald-700" : "text-red-600"}`}>
                  {formatCurrency(pe.monto || 0)}
                </span>
              </label>
            ))
          )}
          </div>
          {personal.length > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  <Users className="h-4 w-4 mr-2" />
                  Ver personal completo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-teal-600" />
                    Personal del evento — {nombreEvento}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-1">
                  {personal.map((pe) => (
                    <div
                      key={pe.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{pe.nombre}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {pe.funcion}
                          {pe.pagado ? " · pagado" : pe.fechaPago ? ` · paga el ${formatFecha(pe.fechaPago)}` : ""}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 font-medium ${pe.pagado ? "text-emerald-700" : "text-red-600"}`}
                      >
                        {formatCurrency(pe.monto || 0)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                    <span>Total personal</span>
                    <span>{formatCurrency(totalPersonal)}</span>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Gráfico circular: porcentaje cubierto y costo total del evento */}
      <Card className="xl:sticky xl:top-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChartIcon className="h-4 w-4 text-teal-600" />
            Cobertura de costos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          {datosGrafico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este evento no tiene costos calculados.</p>
          ) : (
            <>
              <ChartContainer config={chartConfig} className="aspect-square w-full max-w-[220px]">
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
                            Costo total: <span className="font-medium">{formatCurrency(d.total)}</span>
                          </p>
                          <p className="text-emerald-700">
                            Pagado: <span className="font-medium">{formatCurrency(d.pagado)}</span>
                          </p>
                          <p className="text-muted-foreground">
                            Pendiente: {formatCurrency(d.total - d.pagado)}
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
                              cubierto
                            </tspan>
                          </text>
                        )
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="w-full space-y-1.5 text-sm">
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-muted-foreground">Costo total del evento</span>
                  <span className="font-semibold">{formatCurrency(costoTotalEvento)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cubierto</span>
                  <span className="font-semibold text-emerald-700">{formatCurrency(totalCubierto)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pendiente</span>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(costoTotalEvento - totalCubierto)}
                  </span>
                </div>
                {precioVentaEvento > 0 && (
                  <>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-muted-foreground">Vendido en</span>
                      <span className="font-semibold text-teal-700">{formatCurrency(precioVentaEvento)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Costo / venta</span>
                      <span className="font-semibold">
                        {proporcionCostoVenta !== null ? `${proporcionCostoVenta.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground/70">
                      El costo del evento representa el {proporcionCostoVenta?.toFixed(1)}% del precio de venta.
                    </p>
                  </>
                )}
              </div>
              <div className="w-full space-y-1.5 border-t pt-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {datosGrafico.map((d) => (
                    <span key={d.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: chartConfig[d.key as keyof typeof chartConfig].color }}
                      />
                      {d.nombre}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/70">
                  Color pleno = pagado · color tenue = pendiente de pago
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Progreso de cuotas del cliente: ancho completo, barra verde */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            Cuotas cobradas al cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cuotas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este evento no tiene plan de cuotas.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">
                  {cuotasPagadas.length}/{cuotas.length} cuotas pagadas
                  {montoSenaCobrada > 0 && (
                    <span className="ml-2 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Seña cobrada: {formatCurrency(montoSenaCobrada)}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  <span className="font-semibold text-emerald-700">{formatCurrency(montoCobrado)}</span>
                  {" de "}
                  {formatCurrency(montoTotalCuotas)}
                  {montoSenaCobrada > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground/70">(incluye seña)</span>
                  )}
                </span>
              </div>
              <Progress
                value={progresoCuotas}
                className="h-4 bg-emerald-100 [&>div]:bg-emerald-600"
                aria-label={`${progresoCuotas}% de las cuotas cobradas`}
              />
              <div className="flex flex-wrap gap-1.5">
                {cuotas.map((c) => (
                  <span
                    key={c.numeroCuota}
                    title={`Cuota ${c.numeroCuota} · vence ${c.fechaVencimiento} · ${formatCurrency(c.monto)}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-semibold ${
                      c.pagada
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-border bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {c.numeroCuota}
                  </span>
                ))}
              </div>
              {progresoCuotas === 100 && (
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
    </main>
  )
}

export default function CostosEventoPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Cargando...</div>}>
      <CostosEventoContent />
    </Suspense>
  )
}

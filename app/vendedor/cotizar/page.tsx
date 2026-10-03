"use client"

// Cotizador del VENDEDOR — modelo costo + ganancia por salón (Paso 2).
//
// Pantalla rápida pensada para celular, en tarjetas: Cliente, Salón,
// Comensales, Menú, Barra y Servicios. Abajo, fijo: el precio total (tocándolo
// se ve el desglose por rubro, SOLO precios) y los botones "Guardar borrador"
// y "Enviar a Administración".
//
// El precio en vivo sale de armarCotizacion (lib/cotizador-salon.ts) con los
// PRECIOS por unidad del catálogo (/api/vendedor/catalogo, bloque
// cotizadorPorSalon) — la misma función que usa el servidor, que recalcula
// siempre al guardar con los costos reales (/api/vendedor/cotizaciones). El
// vendedor nunca recibe costos, ganancias ni márgenes.
//
// Fuera de esta pantalla (los carga Administración después): teléfono,
// festejados, horarios, dietas, plato por plato, trago por trago y datos del
// contrato. Adolescentes y dietas especiales quedan en 0.
//
// ?id=... reabre un borrador o una cotización rechazada para corregirla.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Home,
  Minus,
  PackageCheck,
  Plus,
  Send,
  User,
  Users,
  Wine,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { SALONES, salonColor, salonLabel } from "@/lib/store"
import { ESTADO_COTIZACION_CLASE, ESTADO_COTIZACION_LABEL, type EstadoCotizacion } from "@/lib/estado-cotizacion"
import { servicioCorrespondeAlAnio } from "@/lib/tarifario-cotizador"
import { UNIDADES_CON_CANTIDAD, armarCotizacion, type AplicaRegla } from "@/lib/cotizador-salon"

const TIPOS_EVENTO = ["Casamiento", "Cumpleaños de 15", "Empresarial", "Cumpleaños", "Bautismo", "Otro"] as const
const ATAJOS_ADULTOS = [50, 60, 70, 80, 90, 100]

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

interface ServicioCatalogo {
  id: string
  nombre: string
  categoria: string
  unidad: string
}

/** Lo que el catálogo trae de cada salón: SOLO precios. */
interface SalonCotizable {
  salon: string
  capacidadMaxima: number | null
  precioSalon: number
  menu: Array<{ recetaId: string; nombre: string; precioPorPorcion: number }>
  barras: Array<{ id: string; nombre: string; coctelesIncluidos: string[]; precioPorAdulto: number; tragosPorAdulto: number }>
  servicios: Array<{ servicioId: string; precio: number; incluido: boolean }>
  personal: Array<{ funcion: string; cadaNInvitados: number; minimo: number; aplica: AplicaRegla; precioPorPersona: number }>
}

function Tarjeta({
  icono,
  titulo,
  resumen,
  children,
}: {
  icono: React.ReactNode
  titulo: string
  resumen?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2d5a3d]/10 text-[#2d5a3d]">{icono}</span>
        <h2 className="flex-1 text-base font-semibold">{titulo}</h2>
        {resumen && <span className="text-xs text-muted-foreground">{resumen}</span>}
      </div>
      {children}
    </section>
  )
}

function Contador({
  etiqueta,
  valor,
  onChange,
  deshabilitado,
}: {
  etiqueta: string
  valor: number
  onChange: (n: number) => void
  deshabilitado?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
      <span className="text-sm font-medium">{etiqueta}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={deshabilitado || valor <= 0}
          onClick={() => onChange(Math.max(0, valor - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-40"
          aria-label={`Menos ${etiqueta.toLowerCase()}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          disabled={deshabilitado}
          aria-label={etiqueta}
          value={valor}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="h-10 w-16 rounded-lg border border-input bg-background text-center text-base font-semibold tabular-nums"
        />
        <button
          type="button"
          disabled={deshabilitado}
          onClick={() => onChange(valor + 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-40"
          aria-label={`Más ${etiqueta.toLowerCase()}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function Chip({
  activo,
  onClick,
  children,
  deshabilitado,
}: {
  activo: boolean
  onClick?: () => void
  children: React.ReactNode
  deshabilitado?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      disabled={deshabilitado}
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default ${
        activo ? "border-[#2d5a3d] bg-[#2d5a3d] text-white" : "border-border bg-white hover:bg-muted"
      }`}
    >
      {children}
    </button>
  )
}

function CotizarPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const idParam = searchParams.get("id")

  const [catalogo, setCatalogo] = useState<{ servicios: ServicioCatalogo[]; salones: SalonCotizable[] } | null>(null)
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null)

  const [cotizacionId, setCotizacionId] = useState<string | null>(idParam)
  const [estado, setEstado] = useState<EstadoCotizacion>("borrador")
  const [comentarioAdmin, setComentarioAdmin] = useState<string | null>(null)
  const [cargandoCotizacion, setCargandoCotizacion] = useState(!!idParam)

  const [clienteNombre, setClienteNombre] = useState("")
  const [clienteDni, setClienteDni] = useState("")
  const [tipoEvento, setTipoEvento] = useState("")
  const [fecha, setFecha] = useState("")
  const [salon, setSalon] = useState("")
  const [adultos, setAdultos] = useState(0)
  const [ninos, setNinos] = useState(0)
  const [recetas, setRecetas] = useState<string[]>([])
  const [barraId, setBarraId] = useState<string | null>(null)
  /** servicioId → cantidad. Solo los ADICIONALES elegidos (los incluidos van solos). */
  const [servicios, setServicios] = useState<Record<string, number>>({})

  const [desgloseAbierto, setDesgloseAbierto] = useState(false)
  const [guardando, setGuardando] = useState<"guardar" | "enviar" | null>(null)

  const soloLectura = !!cotizacionId && !["borrador", "rechazada"].includes(estado)

  // ── Catálogo (solo precios) ──
  const cargarCatalogo = useCallback(async () => {
    setErrorCatalogo(null)
    try {
      const res = await fetch("/api/vendedor/catalogo")
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) throw new Error()
      if (!Array.isArray(data.cotizadorPorSalon)) {
        setErrorCatalogo("Todavía no está cargada la configuración de los salones.")
        return
      }
      setCatalogo({ servicios: data.servicios ?? [], salones: data.cotizadorPorSalon })
    } catch {
      setErrorCatalogo("No se pudo cargar el catálogo.")
    }
  }, [])
  useEffect(() => {
    cargarCatalogo()
  }, [cargarCatalogo])

  // ── Reabrir una cotización (?id=) ──
  useEffect(() => {
    if (!idParam) return
    let cancelado = false
    ;(async () => {
      try {
        const res = await fetch(`/api/vendedor/cotizaciones/${idParam}`)
        const data = await res.json().catch(() => null)
        if (cancelado) return
        if (!res.ok || !data?.ok) {
          toast({ title: data?.error || "No se pudo abrir la cotización", variant: "destructive" })
          return
        }
        const c = data.cotizacion
        setEstado(c.estado)
        setComentarioAdmin(c.comentarioAdmin || null)
        setClienteNombre(c.clienteNombre || "")
        setClienteDni(c.clienteDni || "")
        setTipoEvento(c.tipoEvento || "")
        setFecha(c.fechaEvento || "")
        setSalon(c.salon || "")
        // Las cotizaciones viejas podían tener adolescentes y dietas: cuentan como adultos.
        setAdultos((c.invitados?.adultos || 0) + (c.invitados?.adolescentes || 0) + (c.invitados?.personasDietasEspeciales || 0))
        setNinos(c.invitados?.ninos || 0)
        setRecetas(Array.isArray(c.recetasElegidas?.adultos) ? c.recetasElegidas.adultos : [])
        setBarraId(c.barraId || null)
        const sel: Record<string, number> = {}
        for (const s of c.serviciosElegidos || []) sel[s.servicioId] = s.cantidad || 1
        setServicios(sel)
        if (c.version !== 2 && c.barra) {
          toast({ title: "La barra de esta cotización era del cotizador anterior", description: "Elegí una barra del salón." })
        }
      } finally {
        if (!cancelado) setCargandoCotizacion(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [idParam, toast])

  const config = useMemo(() => catalogo?.salones.find((s) => s.salon === salon) ?? null, [catalogo, salon])
  const nombreServicio = useCallback(
    (id: string) => catalogo?.servicios.find((s) => s.id === id),
    [catalogo],
  )

  /** Servicios de este salón que se pueden ofrecer para la fecha elegida. */
  const serviciosDelSalon = useMemo(() => {
    if (!config || !catalogo) return []
    return config.servicios
      .map((s) => ({ ...s, info: nombreServicio(s.servicioId) }))
      .filter((s): s is typeof s & { info: ServicioCatalogo } => !!s.info)
      .filter((s) => servicioCorrespondeAlAnio(s.info.nombre, fecha))
  }, [config, catalogo, nombreServicio, fecha])

  // Al cambiar de salón (o de fecha) se descarta lo que ya no está disponible.
  useEffect(() => {
    if (!config || cargandoCotizacion) return
    setRecetas((prev) => prev.filter((id) => config.menu.some((m) => m.recetaId === id)))
    setBarraId((prev) => (prev && config.barras.some((b) => b.id === prev) ? prev : null))
    setServicios((prev) => {
      const sig: Record<string, number> = {}
      for (const [id, cant] of Object.entries(prev)) {
        const s = serviciosDelSalon.find((x) => x.servicioId === id)
        if (s && !s.incluido) sig[id] = cant
      }
      return sig
    })
  }, [config, serviciosDelSalon, cargandoCotizacion])

  // ── Precio en vivo: la MISMA cuenta que el servidor, solo con precios ──
  const calculo = useMemo(() => {
    if (!config) return null
    return armarCotizacion({
      adultos,
      ninos,
      capacidadMaxima: config.capacidadMaxima,
      salon: { precio: config.precioSalon },
      recetas: config.menu
        .filter((m) => recetas.includes(m.recetaId))
        .map((m) => ({ id: m.recetaId, nombre: m.nombre, precio: m.precioPorPorcion })),
      barra: (() => {
        const b = config.barras.find((x) => x.id === barraId)
        return b ? { id: b.id, nombre: b.nombre, tragosPorAdulto: b.tragosPorAdulto, precio: b.precioPorAdulto } : null
      })(),
      servicios: serviciosDelSalon
        .filter((s) => s.incluido || s.servicioId in servicios)
        .map((s) => ({
          servicioId: s.servicioId,
          nombre: s.info.nombre,
          unidad: s.info.unidad,
          cantidad: servicios[s.servicioId] ?? 1,
          incluido: s.incluido,
          precio: s.precio,
        })),
      personal: config.personal.map((p) => ({ ...p, precio: p.precioPorPersona })),
    })
  }, [config, adultos, ninos, recetas, barraId, servicios, serviciosDelSalon])

  const faltan: string[] = []
  if (!clienteNombre.trim()) faltan.push("el nombre del cliente")
  if (!salon) faltan.push("el salón")
  if (adultos + ninos <= 0) faltan.push("los invitados")
  const puedeGuardar = faltan.length === 0 && !soloLectura && !!config
  const puedeEnviar = puedeGuardar && !calculo?.superaCapacidad

  const guardar = async (accion: "guardar" | "enviar") => {
    if (accion === "enviar" ? !puedeEnviar : !puedeGuardar) return
    setGuardando(accion)
    try {
      const res = await fetch("/api/vendedor/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cotizacionId || undefined,
          accion,
          clienteNombre: clienteNombre.trim(),
          clienteDni: clienteDni.trim(),
          tipoEvento,
          fechaEvento: fecha,
          salon,
          adultos,
          ninos,
          recetas,
          barraId,
          servicios: Object.entries(servicios).map(([servicioId, cantidad]) => ({ servicioId, cantidad })),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: data?.error || "No se pudo guardar", variant: "destructive" })
        return
      }
      if (accion === "enviar") {
        toast({ title: "Enviada a Administración", description: `${clienteNombre.trim()} · ${fmt(data.total)}` })
        router.push("/vendedor/paquetes")
        return
      }
      setCotizacionId(data.id)
      setEstado(data.estado)
      if (!idParam) router.replace(`/vendedor/cotizar?id=${data.id}`)
      toast({ title: "Borrador guardado", description: fmt(data.total) })
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setGuardando(null)
    }
  }

  const alternarReceta = (id: string) =>
    setRecetas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const alternarServicio = (id: string) =>
    setServicios((prev) => {
      if (id in prev) {
        const { [id]: _fuera, ...resto } = prev
        return resto
      }
      return { ...prev, [id]: 1 }
    })

  if (cargandoCotizacion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando cotización...</p>
      </div>
    )
  }

  const total = calculo?.total ?? 0
  const comensales = adultos + ninos
  const porCategoria = (() => {
    const grupos = new Map<string, typeof serviciosDelSalon>()
    for (const s of serviciosDelSalon) grupos.set(s.info.categoria, [...(grupos.get(s.info.categoria) ?? []), s])
    return [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"))
  })()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 sm:px-6 sticky top-0 z-40">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          <Link href="/vendedor/paquetes" className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{cotizacionId ? "Cotización" : "Nueva cotización"}</h1>
            {clienteNombre && <p className="text-sm text-muted-foreground truncate">{clienteNombre}</p>}
          </div>
          {cotizacionId && (
            <Badge variant="outline" className={`text-xs shrink-0 ${ESTADO_COTIZACION_CLASE[estado]}`}>
              {ESTADO_COTIZACION_LABEL[estado]}
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4 pb-6 sm:px-6">
        {soloLectura && (
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Esta cotización ya no se puede editar desde acá — {ESTADO_COTIZACION_LABEL[estado].toLowerCase()}.
          </div>
        )}
        {comentarioAdmin && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Administración pidió un ajuste:</p>
            <p>{comentarioAdmin}</p>
          </div>
        )}
        {errorCatalogo && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-2">
            <p>{errorCatalogo}</p>
            <Button size="sm" variant="outline" onClick={cargarCatalogo}>
              Reintentar
            </Button>
          </div>
        )}

        <fieldset disabled={soloLectura} className="space-y-4">
          {/* 1. Cliente */}
          <Tarjeta icono={<User className="h-4 w-4" />} titulo="Cliente">
            <Input
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              placeholder="Nombre del cliente *"
              aria-label="Nombre del cliente"
              autoComplete="off"
              className="h-11 text-base"
            />
            <div className="flex flex-wrap gap-2">
              {TIPOS_EVENTO.map((t) => (
                <Chip key={t} activo={tipoEvento === t} onClick={() => setTipoEvento(tipoEvento === t ? "" : t)}>
                  {t}
                </Chip>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={clienteDni}
                onChange={(e) => setClienteDni(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="DNI"
                aria-label="DNI del cliente"
                inputMode="numeric"
                autoComplete="off"
                className="h-11 text-base"
              />
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                aria-label="Fecha del evento"
                className="h-11 text-base"
              />
            </div>
          </Tarjeta>

          {/* 2. Salón */}
          <Tarjeta icono={<Home className="h-4 w-4" />} titulo="Salón" resumen={salon ? salonLabel(salon) : "Elegí uno"}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SALONES.map((s) => {
                const activo = s === salon
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setSalon(s)}
                    className={`rounded-xl border-2 px-3 py-4 text-left text-sm font-semibold transition-colors ${
                      activo ? "text-white shadow-sm" : "bg-white hover:bg-muted"
                    }`}
                    style={
                      activo
                        ? { backgroundColor: salonColor(s), borderColor: salonColor(s) }
                        : { color: salonColor(s), borderColor: "var(--border, #e5e5e5)" }
                    }
                  >
                    {salonLabel(s)}
                  </button>
                )
              })}
            </div>
            {config?.capacidadMaxima ? (
              <p className="text-xs text-muted-foreground">Capacidad: hasta {config.capacidadMaxima} invitados.</p>
            ) : null}
          </Tarjeta>

          {/* 3. Comensales */}
          <Tarjeta icono={<Users className="h-4 w-4" />} titulo="Comensales">
            <div className="flex items-baseline justify-center gap-2 py-1">
              <span className="text-4xl font-bold tabular-nums">{comensales}</span>
              <span className="text-sm text-muted-foreground">invitados</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {ATAJOS_ADULTOS.map((n) => (
                <Chip key={n} activo={adultos === n} onClick={() => setAdultos(n)}>
                  {n}
                </Chip>
              ))}
            </div>
            <Contador etiqueta="Adultos" valor={adultos} onChange={setAdultos} />
            <Contador etiqueta="Niños" valor={ninos} onChange={setNinos} />
          </Tarjeta>

          {!salon ? (
            <p className="px-1 text-sm text-muted-foreground">Elegí el salón para ver el menú, las barras y los servicios.</p>
          ) : !config ? null : (
            <>
              {/* 4. Menú */}
              <Tarjeta
                icono={<ChefHat className="h-4 w-4" />}
                titulo="Menú"
                resumen={recetas.length ? `${recetas.length} ${recetas.length === 1 ? "plato" : "platos"}` : "Sin menú"}
              >
                {config.menu.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Este salón no tiene platos para cotizar.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {config.menu.map((m) => (
                      <Chip key={m.recetaId} activo={recetas.includes(m.recetaId)} onClick={() => alternarReceta(m.recetaId)}>
                        <span className="block font-medium">{m.nombre}</span>
                        <span className="block text-xs opacity-80 tabular-nums">{fmt(m.precioPorPorcion)} por persona</span>
                      </Chip>
                    ))}
                  </div>
                )}
                {recetas.length > 1 && (
                  <p className="text-xs text-muted-foreground">Con varios platos se cobra el promedio por persona.</p>
                )}
              </Tarjeta>

              {/* 5. Barra */}
              <Tarjeta icono={<Wine className="h-4 w-4" />} titulo="Barra" resumen={barraId ? "1 barra" : "Sin barra"}>
                {config.barras.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Este salón no tiene barras para cotizar.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {config.barras.map((b) => (
                      <Chip key={b.id} activo={barraId === b.id} onClick={() => setBarraId(barraId === b.id ? null : b.id)}>
                        <span className="block font-medium">{b.nombre}</span>
                        <span className="block text-xs opacity-80 tabular-nums">
                          {fmt(b.precioPorAdulto)} por adulto · {b.tragosPorAdulto} {b.tragosPorAdulto === 1 ? "trago" : "tragos"}
                        </span>
                      </Chip>
                    ))}
                  </div>
                )}
              </Tarjeta>

              {/* 6. Servicios */}
              <Tarjeta
                icono={<PackageCheck className="h-4 w-4" />}
                titulo="Servicios"
                resumen={`${Object.keys(servicios).length} adicionales`}
              >
                {porCategoria.length === 0 && <p className="text-sm text-muted-foreground">No hay servicios para este salón.</p>}
                {porCategoria.map(([categoria, lista]) => (
                  <div key={categoria} className="space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{categoria}</p>
                    <div className="flex flex-wrap gap-2">
                      {lista.map((s) => {
                        const elegido = s.incluido || s.servicioId in servicios
                        const conCantidad = UNIDADES_CON_CANTIDAD.includes(s.info.unidad) && !s.incluido
                        return (
                          <div key={s.servicioId} className="flex items-center gap-1">
                            <Chip
                              activo={elegido}
                              deshabilitado={s.incluido}
                              onClick={s.incluido ? undefined : () => alternarServicio(s.servicioId)}
                            >
                              <span className="flex items-center gap-1.5">
                                {s.incluido && <Check className="h-3.5 w-3.5" />}
                                <span className="font-medium">{s.info.nombre}</span>
                              </span>
                              <span className="block text-xs opacity-80 tabular-nums">
                                {s.incluido ? "Incluido en el salón" : `${fmt(s.precio)}${conCantidad ? ` ${s.info.unidad.toLowerCase()}` : ""}`}
                              </span>
                            </Chip>
                            {conCantidad && s.servicioId in servicios && (
                              <span className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setServicios((p) => ({ ...p, [s.servicioId]: Math.max(1, (p[s.servicioId] ?? 1) - 1) }))}
                                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border"
                                  aria-label={`Menos ${s.info.nombre}`}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-6 text-center text-sm font-semibold tabular-nums">{servicios[s.servicioId]}</span>
                                <button
                                  type="button"
                                  onClick={() => setServicios((p) => ({ ...p, [s.servicioId]: (p[s.servicioId] ?? 1) + 1 }))}
                                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border"
                                  aria-label={`Más ${s.info.nombre}`}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </Tarjeta>
            </>
          )}
        </fieldset>
      </main>

      {/* Barra de abajo: total + acciones, respetando la zona segura del celular.
          "sticky" y no "fixed": queda pegada abajo de la pantalla pero dentro
          de la columna de contenido, así en escritorio no tapa el menú
          lateral y nunca queda encima de la última tarjeta. */}
      <div className="sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="mx-auto max-w-2xl space-y-2 px-4 py-3 sm:px-6">
          {calculo && calculo.avisos.length > 0 && (
            <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto no-scrollbar">
              {calculo.avisos.map((a) => (
                <span
                  key={a.codigo}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                    a.nivel === "rojo" ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-800"
                  }`}
                >
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {a.textoVendedor}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setDesgloseAbierto((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={desgloseAbierto}
          >
            <span className="text-sm text-muted-foreground">Precio total</span>
            <span className="flex items-center gap-1.5">
              <span className="text-2xl font-bold tabular-nums">{fmt(total)}</span>
              {desgloseAbierto ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
            </span>
          </button>
          {desgloseAbierto && calculo && (
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {calculo.rubros.map((r) => (
                <li key={r.clave} className="flex items-center justify-between px-3 py-1.5">
                  <span>
                    {r.nombre}
                    {r.clave === "personal" && calculo.personal.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        ({calculo.personal.map((l) => `${l.cantidad} ${l.funcion}`).join(", ")})
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">{fmt(r.precio)}</span>
                </li>
              ))}
            </ul>
          )}
          {faltan.length > 0 && !soloLectura && <p className="text-xs text-muted-foreground">Falta {faltan.join(", ")}.</p>}
          {/* minmax(0,1fr) + min-w-0: en 390 px los dos botones entran sin salirse. */}
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <Button variant="outline" className="h-11 px-3" disabled={!puedeGuardar || !!guardando} onClick={() => guardar("guardar")}>
              {guardando === "guardar" ? (
                "Guardando..."
              ) : (
                <>
                  <span className="sm:hidden">Guardar</span>
                  <span className="hidden sm:inline">Guardar borrador</span>
                </>
              )}
            </Button>
            <Button className="h-11 min-w-0 px-3 text-base" disabled={!puedeEnviar || !!guardando} onClick={() => guardar("enviar")}>
              <Send className="h-4 w-4 mr-2 shrink-0" />
              <span className="truncate">{guardando === "enviar" ? "Enviando..." : "Enviar a Administración"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CotizarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CotizarPageContent />
    </Suspense>
  )
}

export default CotizarPage

"use client"

// Pantalla de cotización para el perfil Vendedor (Etapa 3). Arma una fila en
// la tabla "cotizaciones", siempre en estado "borrador" — NUNCA en "eventos".
// El precio final se calcula siempre del lado del servidor
// (/api/vendedor/cotizaciones) a partir del catálogo real de servicios —
// acá solo se muestra un preview con la misma fórmula, nunca el desglose de
// costos internos (eso vive en costos_internos, que este endpoint ni
// siquiera devuelve).
//
// Acá NUNCA se manda a revisión: "Generar paquete" guarda todo y lleva a
// /vendedor/paquetes ("Mis cotizaciones generadas"), donde un botón aparte
// en la tarjeta dispara el envío a revisión de Administración.
//
// Mismo lenguaje visual que app/evento/page.tsx (Planificador de Evento):
// secciones colapsables con ícono + título + subtítulo, botones de salón
// coloreados, caja de "Comensales" y tabla de servicios — sin tocar ese
// archivo, solo replicando su estilo acá.

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Baby,
  Briefcase,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  Heart,
  Package,
  User,
  UserCheck,
  Users,
  UtensilsCrossed,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SALONES, salonColor, salonLabel } from "@/lib/store"

const TIPOS_EVENTO = ["Casamiento", "Cumpleaños de 15", "Empresarial", "Cumpleaños", "Bautismo", "Otro"] as const

type Segmento = "adultos" | "adolescentes" | "ninos" | "dietasEspeciales"
const SEGMENTOS: { key: Segmento; label: string }[] = [
  { key: "adultos", label: "Adultos" },
  { key: "adolescentes", label: "Adolesc." },
  { key: "ninos", label: "Niños" },
  { key: "dietasEspeciales", label: "Dietas" },
]

interface ServicioCatalogo {
  id: string
  nombre: string
  categoria: string
  unidad: "Fijo" | "Por Persona" | "Por Hora" | "Por Cantidad"
  precioVenta: number
}

interface RecetaCatalogo {
  id: string
  nombre: string
  categoria: string
}

interface PaqueteVendedor {
  id: string
  salon: string
  nombre: string
  precioVenta: number
  servicios: Array<{ servicioId: string; nombre: string; cantidad: number; precioVenta: number }>
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

function agruparPorCategoria<T extends { categoria: string }>(items: T[]): Array<{ categoria: string; items: T[] }> {
  const grupos = new Map<string, T[]>()
  for (const item of items) {
    if (!grupos.has(item.categoria)) grupos.set(item.categoria, [])
    grupos.get(item.categoria)!.push(item)
  }
  return Array.from(grupos.entries()).map(([categoria, items]) => ({ categoria, items }))
}

// Misma cascara que SectionCard en app/evento/page.tsx: icono + titulo +
// subtitulo colapsables, sin las variantes de bloqueo (acá no aplican).
function Seccion({
  icon,
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-md">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none"
          >
            <div className="shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-card-foreground truncate">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-5 py-5 overflow-hidden">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export default function CotizarPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [cargandoCatalogo, setCargandoCatalogo] = useState(true)
  const [servicios, setServicios] = useState<ServicioCatalogo[]>([])
  const [recetas, setRecetas] = useState<RecetaCatalogo[]>([])
  const [preciosVenta, setPreciosVenta] = useState<Record<string, Record<string, number>>>({})
  const [paquetes, setPaquetes] = useState<PaqueteVendedor[]>([])
  const [paqueteAplicadoId, setPaqueteAplicadoId] = useState<string | null>(null)

  // Cliente
  const [clienteNombre, setClienteNombre] = useState("")
  const [clienteTelefono, setClienteTelefono] = useState("")

  // Evento — mismos campos que "Detalles del Evento" en app/evento/page.tsx.
  // Acá van sin obligar a completarlos (a diferencia del planificador real):
  // cuando Administración apruebe la cotización (Etapa 5) y la convierta en
  // evento real, ahí sí va a pedir los que falten antes de crear el evento.
  const [fechaEvento, setFechaEvento] = useState("")
  const [horario, setHorario] = useState("")
  const [horarioFin, setHorarioFin] = useState("")
  const [salon, setSalon] = useState<string>("")
  const [tipoEvento, setTipoEvento] = useState<string>("")
  const [nombreFestejados, setNombreFestejados] = useState("")

  // Invitados
  const [invitados, setInvitados] = useState({ adultos: 0, adolescentes: 0, ninos: 0, personasDietasEspeciales: 0 })
  const totalPersonas = invitados.adultos + invitados.adolescentes + invitados.ninos + invitados.personasDietasEspeciales

  // Menú por segmento: recetaId[] por segmento
  const [recetasElegidas, setRecetasElegidas] = useState<Record<Segmento, string[]>>({
    adultos: [],
    adolescentes: [],
    ninos: [],
    dietasEspeciales: [],
  })
  const totalPlatos = SEGMENTOS.reduce((sum, s) => sum + recetasElegidas[s.key].length, 0)

  // Servicios elegidos: servicioId -> cantidad (solo importa para "Por Hora"/"Por Cantidad")
  const [serviciosElegidos, setServiciosElegidos] = useState<Record<string, number>>({})

  const [cotizacionId, setCotizacionId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    fetch("/api/vendedor/catalogo")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok) {
          setServicios(data.servicios || [])
          setRecetas(data.recetas || [])
          setPreciosVenta(data.preciosVenta || {})
        }
      })
      .catch(() => {})
      .finally(() => setCargandoCatalogo(false))

    fetch("/api/vendedor/paquetes")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok) setPaquetes(data.paquetes || [])
      })
      .catch(() => {})
  }, [])

  const aplicarPaquete = (paquete: PaqueteVendedor) => {
    setSalon(paquete.salon)
    setServiciosElegidos(Object.fromEntries(paquete.servicios.map((s) => [s.servicioId, s.cantidad])))
    setPaqueteAplicadoId(paquete.id)
    toast({ title: `Paquete "${paquete.nombre}" aplicado`, description: "Podés seguir ajustando los servicios." })
  }

  const toggleReceta = (segmento: Segmento, recetaId: string) => {
    setRecetasElegidas((prev) => {
      const actual = prev[segmento]
      const yaEsta = actual.includes(recetaId)
      return { ...prev, [segmento]: yaEsta ? actual.filter((id) => id !== recetaId) : [...actual, recetaId] }
    })
  }

  const toggleServicio = (servicioId: string) => {
    setServiciosElegidos((prev) => {
      if (servicioId in prev) {
        const { [servicioId]: _quitado, ...resto } = prev
        return resto
      }
      return { ...prev, [servicioId]: 1 }
    })
  }

  const cambiarCantidadServicio = (servicioId: string, cantidad: number) => {
    setServiciosElegidos((prev) => ({ ...prev, [servicioId]: Math.max(1, cantidad || 1) }))
  }

  // Preview de precio: misma fórmula que usa el planificador real
  // (app/evento/page.tsx) y que vuelve a calcular el servidor al guardar.
  const { serviciosConPrecio, totalServicios, precioBaseSalon, precioVentaSugerido } = useMemo(() => {
    const conPrecio = servicios
      .filter((s) => s.id in serviciosElegidos)
      .map((s) => {
        const usaCantidad = s.unidad === "Por Hora" || s.unidad === "Por Cantidad"
        const cantidad = usaCantidad ? Math.max(1, serviciosElegidos[s.id] || 1) : 1
        return { ...s, cantidad, usaCantidad, precioTotal: s.precioVenta * cantidad }
      })
    const total = conPrecio.reduce((sum, s) => sum + s.precioTotal, 0)
    const base = salon && fechaEvento ? preciosVenta[salon]?.[fechaEvento] ?? 0 : 0
    return { serviciosConPrecio: conPrecio, totalServicios: total, precioBaseSalon: base, precioVentaSugerido: base + total }
  }, [servicios, serviciosElegidos, salon, fechaEvento, preciosVenta])

  const puedeGuardar = clienteNombre.trim().length > 0

  // Guarda siempre en estado "borrador" (mandar a revisión es una acción
  // aparte, disponible desde la tarjeta en /vendedor/paquetes). "Generar
  // paquete" hace este mismo guardado y además te lleva a verlo ahí.
  const guardar = async (destino: "quedarse" | "paquetes") => {
    if (!clienteNombre.trim()) {
      toast({ title: "Falta el nombre del cliente", variant: "destructive" })
      return
    }
    destino === "paquetes" ? setGenerando(true) : setGuardando(true)
    try {
      const res = await fetch("/api/vendedor/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cotizacionId,
          clienteNombre,
          clienteTelefono,
          fechaEvento,
          horario,
          horarioFin,
          salon,
          paqueteId: paqueteAplicadoId,
          tipoEvento,
          nombreFestejados,
          invitados,
          recetasElegidas,
          serviciosElegidos: Object.entries(serviciosElegidos).map(([servicioId, cantidad]) => ({ servicioId, cantidad })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo guardar", variant: "destructive" })
        return
      }
      setCotizacionId(data.id)
      if (destino === "paquetes") {
        router.push("/vendedor/paquetes")
      } else {
        toast({ title: "Borrador guardado" })
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setGuardando(false)
      setGenerando(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 sm:px-6 sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex items-center gap-3">
          <Link href="/vendedor" className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">Nueva cotización</h1>
            {clienteNombre && <p className="text-sm text-muted-foreground truncate">{clienteNombre}</p>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="space-y-4 mb-8">
          <Seccion
            icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10"><User className="h-5 w-5 text-blue-700" /></div>}
            title="Cliente"
            subtitle={clienteTelefono ? `${clienteNombre || "Sin nombre"} · ${clienteTelefono}` : clienteNombre || "Datos de contacto"}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clienteNombre" className="text-sm font-medium">Nombre *</Label>
                <Input
                  id="clienteNombre"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Nombre y apellido"
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clienteTelefono" className="text-sm font-medium">Teléfono</Label>
                <Input
                  id="clienteTelefono"
                  value={clienteTelefono}
                  onChange={(e) => setClienteTelefono(e.target.value)}
                  placeholder="Opcional"
                  className="h-11 text-base"
                />
              </div>
            </div>
          </Seccion>

          <Seccion
            icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10"><CalendarIcon className="h-5 w-5 text-emerald-700" /></div>}
            title="Detalles del Evento"
            subtitle={tipoEvento ? `${tipoEvento}${nombreFestejados ? ` - ${nombreFestejados}` : ""}` : "Configurá la fecha, salón y comensales"}
          >
            <div className="space-y-5">
              {/* Fila 1: Tipo de Evento + Nombre de los Festejados */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tipo de Evento</Label>
                  <Select value={tipoEvento} onValueChange={setTipoEvento}>
                    <SelectTrigger className="h-11 text-base">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_EVENTO.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nombreFestejados" className="text-sm font-medium">Nombre de los Festejados</Label>
                  <Input
                    id="nombreFestejados"
                    placeholder="Ej: Juan y María"
                    value={nombreFestejados}
                    onChange={(e) => setNombreFestejados(e.target.value)}
                      className="h-11 text-base"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Fila 2: Fecha + Hora inicio + Hora fin */}
              <div className="grid gap-4 grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="fechaEvento" className="flex items-center gap-1.5 text-sm font-medium">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    Fecha
                  </Label>
                  <Input
                    id="fechaEvento"
                    type="date"
                    value={fechaEvento}
                    onChange={(e) => setFechaEvento(e.target.value)}
                      className="h-11 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horario" className="flex items-center gap-1.5 text-sm font-medium">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Hora inicio
                  </Label>
                  <Input
                    id="horario"
                    type="time"
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                      className="h-11 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horarioFin" className="flex items-center gap-1.5 text-sm font-medium">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Hora fin
                  </Label>
                  <Input
                    id="horarioFin"
                    type="time"
                    value={horarioFin}
                    onChange={(e) => setHorarioFin(e.target.value)}
                      className="h-11 text-base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Salón
                </Label>
                <div className="flex gap-2">
                  {SALONES.map((s) => {
                    const active = salon === s
                    const color = salonColor(s)
                    return (
                      <button
                        key={s}
                        type="button"
                              onClick={() => setSalon(s)}
                        className="flex-1 rounded-lg border px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                        style={{
                          borderColor: color,
                          backgroundColor: active ? color : `color-mix(in srgb, ${color} 8%, white)`,
                          color: active ? "white" : color,
                        }}
                      >
                        {salonLabel(s)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {precioBaseSalon > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                  <UserCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-sm font-semibold text-emerald-800">
                    Precio base del salón: {fmt(precioBaseSalon)}
                  </p>
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-emerald-100 bg-white/70 p-4">
                <h4 className="font-semibold text-base text-foreground">Comensales</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      { key: "adultos", label: "Adultos", icon: Users },
                      { key: "adolescentes", label: "Adolescentes", icon: UserCheck },
                      { key: "ninos", label: "Niños", icon: Baby },
                      { key: "personasDietasEspeciales", label: "Dietas Esp.", icon: Heart },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={invitados[key]}
                        onChange={(e) => setInvitados((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value) || 0) }))}
                              className="h-11 text-center text-lg font-semibold"
                      />
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-secondary p-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-base">Total personas:</span>
                    <span className="text-2xl font-bold">{totalPersonas}</span>
                  </div>
                </div>
              </div>
            </div>
          </Seccion>

          <Seccion
            icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10"><UtensilsCrossed className="h-5 w-5 text-orange-600" /></div>}
            title="Menú del Evento"
            subtitle={`${totalPlatos} plato${totalPlatos !== 1 ? "s" : ""} seleccionado${totalPlatos !== 1 ? "s" : ""}`}
          >
            {cargandoCatalogo ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : recetas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg">
                <UtensilsCrossed className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No hay recetas en el catálogo</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="py-2.5 px-3 text-left font-medium text-muted-foreground">Plato</th>
                        {SEGMENTOS.map((s) => (
                          <th key={s.key} className="py-2.5 px-2 text-center font-medium text-muted-foreground">
                            {s.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {agruparPorCategoria(recetas).map((grupo) => (
                        <Fragment key={grupo.categoria}>
                          <tr>
                            <td colSpan={SEGMENTOS.length + 1} className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-white" style={{ backgroundColor: "#2d5a3d" }}>
                              {grupo.categoria}
                            </td>
                          </tr>
                          {grupo.items.map((receta, idx) => (
                            <tr key={receta.id} className={`border-b border-border/50 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                              <td className="py-2 px-3 font-medium">{receta.nombre}</td>
                              {SEGMENTOS.map((s) => {
                                const selected = recetasElegidas[s.key].includes(receta.id)
                                return (
                                  <td key={s.key} className="py-1.5 px-2 text-center">
                                    <button
                                      type="button"
                                                          onClick={() => toggleReceta(s.key, receta.id)}
                                      className={`w-8 h-8 mx-auto flex items-center justify-center rounded border transition-colors disabled:opacity-50 ${
                                        selected
                                          ? "bg-emerald-600 border-emerald-600"
                                          : "border-dashed border-border hover:border-[#2d5a3d] hover:bg-emerald-50"
                                      }`}
                                      aria-label={`${receta.nombre} para ${s.label}`}
                                    >
                                      {selected && <CheckCircle className="h-4 w-4 text-white" strokeWidth={3} />}
                                    </button>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">
                    Total: <strong>{invitados.adultos}</strong> adultos · <strong>{invitados.adolescentes}</strong> adolesc. ·{" "}
                    <strong>{invitados.ninos}</strong> niños · <strong>{invitados.personasDietasEspeciales}</strong> especiales
                  </span>
                  <span className="font-medium text-foreground">
                    {totalPlatos} plato{totalPlatos !== 1 ? "s" : ""} seleccionado{totalPlatos !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            )}
          </Seccion>

          <Seccion
            icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10"><Briefcase className="h-5 w-5 text-emerald-600" /></div>}
            title="Servicios del Evento"
            subtitle={
              Object.keys(serviciosElegidos).length > 0
                ? `${Object.keys(serviciosElegidos).length} servicio${Object.keys(serviciosElegidos).length > 1 ? "s" : ""} agregado${Object.keys(serviciosElegidos).length > 1 ? "s" : ""}`
                : "Agregá servicios al evento"
            }
          >
            {paquetes.length > 0 && (
              <div className="mb-4 space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Partir de un paquete guardado
                </Label>
                <Select
                  value={paqueteAplicadoId || ""}
                  onValueChange={(id) => {
                    const p = paquetes.find((x) => x.id === id)
                    if (p) aplicarPaquete(p)
                  }}
                >
                  <SelectTrigger className="h-11 text-base">
                    <SelectValue placeholder="Elegir paquete (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {paquetes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre} — {salonLabel(p.salon)} ({fmt(p.precioVenta)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Reemplaza el salón y los servicios elegidos por los del paquete — después podés seguir ajustando.
                </p>
              </div>
            )}
            {cargandoCatalogo ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : servicios.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg">
                <Briefcase className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No hay servicios en el catálogo</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/70 border-b border-border">
                      <th className="w-10 px-3 py-2" />
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Servicio</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Categoría</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-emerald-700 uppercase tracking-wide">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicios.map((s, idx) => {
                      const seleccionado = s.id in serviciosElegidos
                      const usaCantidad = s.unidad === "Por Hora" || s.unidad === "Por Cantidad"
                      const cantidad = usaCantidad ? Math.max(1, serviciosElegidos[s.id] || 1) : 1
                      const precioTotal = usaCantidad ? s.precioVenta * cantidad : s.precioVenta
                      return (
                        <tr
                          key={s.id}
                          onClick={() => toggleServicio(s.id)}
                          className={`border-b border-border/50 cursor-pointer transition-colors select-none ${
                            seleccionado ? "bg-emerald-50/70 hover:bg-emerald-50" : idx % 2 === 0 ? "hover:bg-muted/40" : "bg-muted/10 hover:bg-muted/40"
                          }`}
                        >
                          <td className="w-10 px-3 py-2.5">
                            <div
                              className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors ${
                                seleccionado ? "bg-emerald-600 border-emerald-600" : "border-muted-foreground/30 bg-background"
                              }`}
                            >
                              {seleccionado && <CheckCircle className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`font-medium ${seleccionado ? "text-emerald-900" : ""}`}>{s.nombre}</span>
                            {usaCantidad && seleccionado && (
                              <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
                                <label className="text-xs text-muted-foreground whitespace-nowrap">
                                  {s.unidad === "Por Hora" ? "Horas:" : "Cantidad:"}
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={cantidad}
                                                  onChange={(e) => cambiarCantidadServicio(s.id, Number(e.target.value))}
                                  className="w-16 h-6 px-1.5 text-xs rounded border border-emerald-300 bg-white text-emerald-900 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 tabular-nums"
                                />
                                {s.unidad === "Por Hora" && <span className="text-xs text-muted-foreground">h</span>}
                              </div>
                            )}
                            {usaCantidad && !seleccionado && (
                              <p className="text-[11px] text-muted-foreground/70 mt-0.5">{s.unidad === "Por Hora" ? "Por hora" : "Por cantidad"}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell">
                            <Badge variant="outline" className="text-[11px]">{s.categoria}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-700">
                            {fmt(precioTotal)}
                            {usaCantidad && seleccionado && cantidad > 1 && (
                              <span className="block text-[11px] font-normal text-muted-foreground">
                                {fmt(s.precioVenta)}
                                {s.unidad === "Por Hora" ? "/h" : "/u"} × {cantidad}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {serviciosConPrecio.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/60 border-t-2 border-border">
                        <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                          {serviciosConPrecio.length} servicio{serviciosConPrecio.length !== 1 ? "s" : ""} seleccionado{serviciosConPrecio.length !== 1 ? "s" : ""}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs font-bold text-emerald-700">{fmt(totalServicios)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </Seccion>
        </div>

        <div className="rounded-xl border-2 border-[#c9a227] bg-amber-50/40 overflow-hidden shadow-sm mb-6">
          <div className="px-5 py-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-base font-semibold text-[#7a5c0e]">Precio de venta sugerido</span>
              <span className="text-2xl font-bold text-[#1a3a2a]">{fmt(precioVentaSugerido)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 pb-8">
          <Button
            onClick={() => guardar("paquetes")}
            className="w-full h-16 text-lg bg-primary hover:bg-primary/90"
            disabled={!puedeGuardar || guardando || generando}
          >
            <Package className="h-6 w-6 mr-2" />
            {generando ? "Generando..." : "Generar paquete"}
          </Button>
          <Button
            variant="outline"
            className="w-full h-12"
            disabled={!puedeGuardar || guardando || generando}
            onClick={() => guardar("quedarse")}
          >
            {guardando ? "Guardando..." : "Guardar borrador"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            "Generar paquete" guarda todo y te lleva a verlo en Paquetes — desde ahí lo mandás a revisión.
          </p>
        </div>
      </main>
    </div>
  )
}

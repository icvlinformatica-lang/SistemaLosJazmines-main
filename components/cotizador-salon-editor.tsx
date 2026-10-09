"use client"

// Cotizaciones > Configuración: el cotizador POR SALÓN (modelo costo +
// ganancia, scripts/015). Cada salón funciona como una empresa aparte: todo
// lo de esta pantalla es del salón elegido arriba.
//
// Rubros: Salón (costo fijo + capacidad), Cocina, Barra, Servicios y
// Personal. Cada uno muestra el costo que calcula el sistema, el % de
// ganancia y el precio resultante. Las cuentas están en lib/cotizador-salon.ts.
//
// Más el "Recargo de sábado" del salón (scripts/018): monto fijo o % sobre el
// precio de los rubros tildados. Colores por rubro: components/cotizador-colores.tsx.
//
// Se guarda TODO el salón junto (PUT /api/administracion/cotizador-salon).
// Las barras en sí (crear / editar / borrar) son compartidas por todos los
// salones y se guardan al instante; qué barras aparecen es del salón.

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Copy,
  Home,
  PackageCheck,
  Plus,
  Save,
  Sun,
  Trash2,
  Users,
  Wine,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { SALONES, salonColor, salonLabel } from "@/lib/store"
import {
  APLICA_OPCIONES,
  cocinaPorPasos,
  montoRecargo,
  porcentajesPorRubro,
  precioBarraSalon,
  precioConGanancia,
  simularPersonal,
  tarifaDeRegla,
  tarifaMasAlta,
  type AplicaRegla,
  type ClaveRubro,
  type PersonaConTarifa,
  type ReglaPersonalSalon,
  type ReglaRecargo,
} from "@/lib/cotizador-salon"
import { COLOR_RUBRO } from "@/components/cotizador-colores"
import { EditorRecargo, textoRecargo } from "@/components/recargo-editor"
import { AvisoSinCosto, Bloque, InputGanancia, InputPrecio, fmt, type TonoBloque } from "@/components/config-bloque"
import {
  BloqueBarrasContenido,
  BloqueCocinaContenido,
  BloqueServiciosContenido,
  type EstadoServicioSalon,
  type PlatoConCosto,
  type ServicioConCosto,
} from "@/components/cotizador-config-bloques"
import type { BarraParaEditar, CoctelConCosto } from "@/components/editor-barra"

interface ConfigSalon {
  salon: string
  costoSalon: number
  capacidadMaxima: number | null
  gananciaSalon: number
  gananciaCocina: number
  gananciaBarra: number
  gananciaServicios: number
  recargoSabado: ReglaRecargo
  recetas: string[]
  barras: string[]
  servicios: EstadoServicioSalon[]
  reglasPersonal: ReglaPersonalSalon[]
}

interface Catalogos {
  platos: PlatoConCosto[]
  cocteles: CoctelConCosto[]
  barras: BarraParaEditar[]
  servicios: ServicioConCosto[]
  personal: PersonaConTarifa[]
}

/** Huella para saber si hay cambios sin guardar (orden de servicios estable). */
/** Ícono de un bloque con el color de su rubro. */
function IconoRubro({ rubro, children }: { rubro: ClaveRubro; children: React.ReactNode }) {
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${COLOR_RUBRO[rubro].icono}`}>{children}</span>
  )
}

/**
 * Cada tarjeta con el color de su rubro (el mismo de COLOR_RUBRO, que se usa
 * en todo el cotizador): borde, encabezado teñido y, al abrirla, un fondo
 * todavía más claro de la misma paleta.
 */
const TONO_BLOQUE: Record<"salon" | "cocina" | "barra" | "servicios" | "personal" | "recargo", TonoBloque> = {
  salon: { borde: "border-primary/40", encabezado: "bg-primary/10", abierto: "bg-primary/[0.04]" },
  cocina: { borde: "border-chart-2/40", encabezado: "bg-chart-2/10", abierto: "bg-chart-2/[0.04]" },
  barra: { borde: "border-rubro-barra/40", encabezado: "bg-rubro-barra/10", abierto: "bg-rubro-barra/[0.04]" },
  servicios: {
    borde: "border-rubro-servicios/40",
    encabezado: "bg-rubro-servicios/10",
    abierto: "bg-rubro-servicios/[0.04]",
  },
  personal: { borde: "border-chart-5/40", encabezado: "bg-chart-5/10", abierto: "bg-chart-5/[0.04]" },
  recargo: { borde: "border-accent/60", encabezado: "bg-accent/15", abierto: "bg-accent/[0.06]" },
}

function huellaDe(c: ConfigSalon | null): string {
  if (!c) return ""
  return JSON.stringify({
    ...c,
    servicios: [...c.servicios].sort((a, b) => a.servicioId.localeCompare(b.servicioId)),
    barras: [...c.barras].sort(),
  })
}

export function CotizadorSalonEditor() {
  const { toast } = useToast()
  const [salon, setSalon] = useState<string>(SALONES[0])
  const [config, setConfig] = useState<ConfigSalon | null>(null)
  const [guardado, setGuardado] = useState("")
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardadoRecien, setGuardadoRecien] = useState(false)
  /** Salón al que se quiere ir con cambios sin guardar (pide confirmación). */
  const [salonPendiente, setSalonPendiente] = useState<string | null>(null)
  const [copiaAbierta, setCopiaAbierta] = useState(false)
  const [copiarDesde, setCopiarDesde] = useState<string>("")
  const [copiando, setCopiando] = useState(false)

  const hayCambios = config != null && guardado !== "" && huellaDe(config) !== guardado
  const nombreSalon = salonLabel(salon)

  const cargar = useCallback(async (s: string) => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/administracion/cotizador-salon?salon=${encodeURIComponent(s)}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || "No se pudo cargar la configuración del salón.")
        setConfig(null)
        return
      }
      setCatalogos({
        platos: data.platos ?? [],
        cocteles: data.cocteles ?? [],
        barras: (data.barras ?? []).map((b: { id: string; nombre: string; coctelesIncluidos: string[] }) => ({
          ...b,
          enCotizador: false,
        })),
        servicios: data.servicios ?? [],
        personal: data.personal ?? [],
      })
      setConfig(data.config)
      setGuardado(huellaDe(data.config))
    } catch {
      setError("Error de conexión.")
      setConfig(null)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar(salon)
  }, [salon, cargar])

  const elegirSalon = (s: string) => {
    if (s === salon) return
    if (hayCambios) setSalonPendiente(s)
    else setSalon(s)
  }

  const cambiar = (cambios: Partial<ConfigSalon>) => setConfig((c) => (c ? { ...c, ...cambios } : c))

  const guardar = async () => {
    if (!config) return
    setGuardando(true)
    try {
      const res = await fetch("/api/administracion/cotizador-salon", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: data?.error || "No se pudo guardar", variant: "destructive" })
        return
      }
      setConfig(data.config)
      setGuardado(huellaDe(data.config))
      setGuardadoRecien(true)
      setTimeout(() => setGuardadoRecien(false), 4000)
      toast({ title: `${nombreSalon} guardado` })
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setGuardando(false)
    }
  }

  const copiar = async () => {
    if (!copiarDesde) return
    setCopiando(true)
    try {
      const res = await fetch("/api/administracion/cotizador-salon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "copiar", desde: copiarDesde, hacia: salon }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: data?.error || "No se pudo copiar", variant: "destructive" })
        return
      }
      setConfig(data.config)
      setGuardado(huellaDe(data.config))
      setCopiaAbierta(false)
      toast({ title: `Configuración de ${salonLabel(copiarDesde)} copiada a ${nombreSalon}` })
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setCopiando(false)
    }
  }

  // ── Resúmenes por rubro (para el encabezado de cada bloque) ──
  const platosSinCosto = useMemo(
    () =>
      (config?.recetas ?? []).filter((id) => {
        const p = catalogos?.platos.find((x) => x.id === id)
        return p && p.costoPorPorcion <= 0
      }).length,
    [config, catalogos],
  )
  const serviciosVisibles = useMemo(
    () => (catalogos?.servicios ?? []).filter((s) => !config?.servicios.find((e) => e.servicioId === s.id)?.oculto),
    [config, catalogos],
  )

  // El color del salón elegido (el del calendario) tiñe toda la tarjeta que
  // contiene los bloques, para que se note de un vistazo qué salón se edita.
  const colorSalon = salonColor(salon)

  const botonCopiar = (
    <Button
      variant="outline"
      size="sm"
      disabled={!config || cargando}
      onClick={() => {
        setCopiarDesde("")
        setCopiaAbierta(true)
      }}
    >
      <Copy className="h-3.5 w-3.5 mr-1.5" />
      Copiar configuración de otro salón
    </Button>
  )

  return (
    <div className="space-y-3">
      {/* Selector grande de salón */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="tablist" aria-label="Salón">
        {SALONES.map((s) => {
          const activo = s === salon
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => elegirSalon(s)}
              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold transition-colors ${
                activo ? "text-white shadow-sm" : "border-border bg-card hover:bg-muted"
              }`}
              style={activo ? { backgroundColor: salonColor(s), borderColor: salonColor(s) } : undefined}
            >
              {/* El color propio de cada salón (el del calendario) queda como punto. */}
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-card" style={{ backgroundColor: salonColor(s) }} />
              <span className="min-w-0 truncate">{salonLabel(s)}</span>
            </button>
          )
        })}
      </div>
      <div
        className="rounded-xl border-2 bg-card overflow-hidden transition-colors"
        style={{ borderColor: `${colorSalon}80`, backgroundImage: `linear-gradient(${colorSalon}1a, ${colorSalon}1a)` }}
      >
        <div className="px-4 py-3 border-b space-y-3" style={{ borderColor: `${colorSalon}40` }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm">Cotizador por salón</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cada salón es una empresa aparte: costo de cada rubro + su ganancia. Todo lo de abajo es del salón
                elegido.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden lg:inline-flex">{botonCopiar}</span>
              {hayCambios && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Sin guardar
                </span>
              )}
              {guardadoRecien && !hayCambios && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Guardado
                </span>
              )}
              <Button size="sm" onClick={guardar} disabled={guardando || !hayCambios || !config}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {guardando ? "Guardando..." : `Guardar ${nombreSalon}`}
              </Button>
            </div>
          </div>

          {/* En el celular va en su propia fila; en la compu, al lado de Guardar. */}
          <div className="flex justify-end lg:hidden">{botonCopiar}</div>
        </div>

        {cargando && <p className="px-4 py-4 text-sm text-muted-foreground">Cargando {nombreSalon}...</p>}
        {!cargando && error && (
          <div className="px-4 py-4 space-y-2">
            <p className="text-sm text-red-700">{error}</p>
            <Button size="sm" variant="outline" onClick={() => cargar(salon)}>
              Reintentar
            </Button>
          </div>
        )}

        {/* En la compu, los bloques van en dos columnas (cada una con su
            propio largo: abrir uno no corre los de la otra) para usar el
            ancho de la pantalla y no tener que bajar tanto. En el celular
            siguen uno abajo del otro, en el mismo orden. */}
        {!cargando && config && catalogos && (
          <div className="space-y-3 p-3 sm:p-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
            <div className="min-w-0 space-y-3">
              {/* 1. Salón */}
              <Bloque
                tono={TONO_BLOQUE.salon}
                icon={
                  <IconoRubro rubro="salon">
                    <Home className="h-5 w-5" />
                  </IconoRubro>
                }
                title="Salón"
                subtitle="Costo fijo del salón (no depende de invitados ni del día) y capacidad máxima."
                resumen={
                  <span className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                    costo {fmt(config.costoSalon)} →{" "}
                    <span className="font-semibold text-foreground">precio {fmt(precioConGanancia(config.costoSalon, config.gananciaSalon))}</span>
                    {config.costoSalon <= 0 && <AvisoSinCosto />}
                  </span>
                }
                defaultOpen
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">Costo del salón</span>
                    <InputPrecio
                      valor={config.costoSalon}
                      onChange={(n) => cambiar({ costoSalon: n ?? 0 })}
                      etiqueta={`Costo del salón ${nombreSalon}`}
                    />
                  </label>
                  <div className="space-y-1.5 text-sm">
                    <span className="font-medium">Ganancia del salón</span>
                    <div>
                      <InputGanancia
                        etiqueta="Ganancia del salón"
                        mostrarEtiqueta={false}
                        valor={config.gananciaSalon}
                        onChange={(n) => cambiar({ gananciaSalon: n })}
                      />
                    </div>
                  </div>
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">Capacidad máxima</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      aria-label={`Capacidad máxima de ${nombreSalon}`}
                      value={config.capacidadMaxima ?? ""}
                      placeholder="Sin cargar"
                      onChange={(e) => {
                        const n = Math.floor(Number(e.target.value))
                        cambiar({ capacidadMaxima: e.target.value === "" || !(n > 0) ? null : n })
                      }}
                      className="h-10 w-full rounded-lg border border-input bg-background px-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#2d5a3d]/40"
                    />
                    <span className="block text-xs text-muted-foreground">
                      invitados. Si una cotización la supera, no se va a poder enviar (Paso 2).
                    </span>
                  </label>
                </div>
                <p className="mt-3 text-sm tabular-nums">
                  costo {fmt(config.costoSalon)} →{" "}
                  <span className="font-semibold">precio {fmt(precioConGanancia(config.costoSalon, config.gananciaSalon))}</span>
                </p>
              </Bloque>

              {/* 2. Cocina */}
              <Bloque
                tono={TONO_BLOQUE.cocina}
                icon={
                  <IconoRubro rubro="cocina">
                    <ChefHat className="h-5 w-5" />
                  </IconoRubro>
                }
                title="Cocina"
                subtitle="Qué platos aparecen en este salón, su orden y la ganancia de cocina."
                resumen={
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {config.recetas.length} {config.recetas.length === 1 ? "plato" : "platos"} · ganancia {config.gananciaCocina} %
                    {platosSinCosto > 0 && (
                      <AvisoSinCosto texto={`${platosSinCosto} ${platosSinCosto === 1 ? "plato" : "platos"} sin costo: van a cotizar $0`} />
                    )}
                  </span>
                }
              >
                <BloqueCocinaContenido
                  platos={catalogos.platos}
                  recetas={config.recetas}
                  onRecetas={(recetas) => cambiar({ recetas })}
                  ganancia={config.gananciaCocina}
                  onGanancia={(gananciaCocina) => cambiar({ gananciaCocina })}
                />
              </Bloque>

              {/* 3. Barra */}
              <Bloque
                tono={TONO_BLOQUE.barra}
                icon={
                  <IconoRubro rubro="barra">
                    <Wine className="h-5 w-5" />
                  </IconoRubro>
                }
                title="Barra"
                subtitle="Barras armadas (paquetes de cócteles), cuáles aparecen en este salón y la ganancia de barra."
                resumen={
                  <span className="text-xs text-muted-foreground">
                    {config.barras.length} {config.barras.length === 1 ? "barra visible" : "barras visibles"} · ganancia{" "}
                    {config.gananciaBarra} %
                  </span>
                }
              >
                <BloqueBarrasContenido
                  barras={catalogos.barras}
                  onBarras={(barras) => setCatalogos((c) => (c ? { ...c, barras } : c))}
                  visibles={config.barras}
                  onVisibles={(barras) => cambiar({ barras })}
                  cocteles={catalogos.cocteles}
                  ganancia={config.gananciaBarra}
                  onGanancia={(gananciaBarra) => cambiar({ gananciaBarra })}
                  salonNombre={nombreSalon}
                />
              </Bloque>

            </div>
            <div className="min-w-0 space-y-3">
              {/* 4. Servicios */}
              <Bloque
                tono={TONO_BLOQUE.servicios}
                icon={
                  <IconoRubro rubro="servicios">
                    <PackageCheck className="h-5 w-5" />
                  </IconoRubro>
                }
                title="Servicios"
                subtitle="Qué servicios aparecen en este salón, cuáles vienen incluidos y la ganancia de servicios."
                resumen={
                  <span className="text-xs text-muted-foreground">
                    {serviciosVisibles.length} de {catalogos.servicios.length} aparecen · ganancia {config.gananciaServicios} %
                  </span>
                }
              >
                <BloqueServiciosContenido
                  servicios={catalogos.servicios}
                  estado={config.servicios}
                  onEstado={(servicios) => cambiar({ servicios })}
                  ganancia={config.gananciaServicios}
                  onGanancia={(gananciaServicios) => cambiar({ gananciaServicios })}
                />
              </Bloque>

              {/* 5. Personal */}
              <Bloque
                tono={TONO_BLOQUE.personal}
                icon={
                  <IconoRubro rubro="personal">
                    <Users className="h-5 w-5" />
                  </IconoRubro>
                }
                title="Personal"
                subtitle="Una regla por función: cuántos hacen falta según los invitados, su tarifa y su ganancia."
                resumen={
                  <span className="text-xs text-muted-foreground">
                    {config.reglasPersonal.length} {config.reglasPersonal.length === 1 ? "regla" : "reglas"}
                  </span>
                }
              >
                <BloquePersonal
                  reglas={config.reglasPersonal}
                  onReglas={(reglasPersonal) => cambiar({ reglasPersonal })}
                  personal={catalogos.personal}
                  capacidad={config.capacidadMaxima}
                />
              </Bloque>

              {/* 6. Recargo de sábado */}
              <Bloque
                tono={TONO_BLOQUE.recargo}
                icon={
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Sun className="h-5 w-5" />
                  </span>
                }
                title="Recargo de sábado"
                subtitle="Lo que se cobra de más un sábado (y en las fechas especiales marcadas «como sábado»). Es ganancia: no suma costo."
                resumen={
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {config.recargoSabado.valor > 0 ? (
                      <span className="font-semibold text-foreground">{textoRecargo(config.recargoSabado, fmt)} un sábado</span>
                    ) : (
                      "Sin recargo: el sábado se cotiza igual que el viernes"
                    )}
                  </span>
                }
              >
                <BloqueRecargoSabado config={config} catalogos={catalogos} onCambio={(recargoSabado) => cambiar({ recargoSabado })} />
              </Bloque>
            </div>
          </div>
        )}

        {/* Cambiar de salón con cambios sin guardar */}
        <Dialog open={!!salonPendiente} onOpenChange={(open) => !open && setSalonPendiente(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Hay cambios sin guardar</DialogTitle>
              <DialogDescription>
                Si cambiás a {salonPendiente ? salonLabel(salonPendiente) : ""}, se pierden los cambios de {nombreSalon}.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSalonPendiente(null)}>
                Quedarme en {nombreSalon}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const s = salonPendiente
                  setSalonPendiente(null)
                  if (s) setSalon(s)
                }}
              >
                Descartar cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Copiar configuración de otro salón */}
        <Dialog open={copiaAbierta} onOpenChange={(open) => !open && setCopiaAbierta(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Copiar configuración a {nombreSalon}</DialogTitle>
              <DialogDescription>
                Reemplaza TODA la configuración de {nombreSalon} (costo, capacidad, ganancias, platos, barras visibles,
                servicios, personal y recargo de sábado) por la del salón que elijas. No se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <Select value={copiarDesde} onValueChange={setCopiarDesde}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Copiar desde..." />
              </SelectTrigger>
              <SelectContent>
                {SALONES.filter((s) => s !== salon).map((s) => (
                  <SelectItem key={s} value={s}>
                    {salonLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hayCambios && (
              <p className="text-xs text-amber-700">Los cambios sin guardar de {nombreSalon} también se pierden.</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCopiaAbierta(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" disabled={!copiarDesde || copiando} onClick={copiar}>
                {copiando ? "Copiando..." : copiarDesde ? `Reemplazar con ${salonLabel(copiarDesde)}` : "Elegí un salón"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

// ─── Recargo de sábado ──────────────────────────────────────────────────

/**
 * Editor + vista previa: "Un sábado este salón cobra $X más (con [80]
 * invitados)". Para la vista previa, Cocina = un plato de cada paso del menú
 * al precio promedio de ese paso (la misma cuenta del cotizador,
 * cocinaPorPasos) y Barra = promedio de las barras visibles (todos adultos),
 * porque acá no hay una cotización real. Servicios depende de lo que se elija.
 */
function BloqueRecargoSabado({
  config,
  catalogos,
  onCambio,
}: {
  config: ConfigSalon
  catalogos: Catalogos
  onCambio: (r: ReglaRecargo) => void
}) {
  const [invitados, setInvitados] = useState(80)
  const r = config.recargoSabado

  const precios = useMemo(() => {
    const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
    const platos = config.recetas
      .map((id) => catalogos.platos.find((p) => p.id === id))
      .filter((p): p is PlatoConCosto => !!p)
      .map((p) => ({ categoria: p.categoria, precio: precioConGanancia(p.costoPorPorcion, config.gananciaCocina) }))
    const costos = Object.fromEntries(catalogos.cocteles.map((c) => [c.id, c.costoPorTrago]))
    const barras = catalogos.barras
      .filter((b) => config.barras.includes(b.id))
      .map((b) => precioBarraSalon(b.coctelesIncluidos, costos, config.gananciaBarra).precioPorAdulto)
    return {
      salon: precioConGanancia(config.costoSalon, config.gananciaSalon),
      cocina: Math.round(cocinaPorPasos(invitados, platos, (p) => p.precio)),
      barra: Math.round(invitados * promedio(barras)),
      servicios: 0,
    }
  }, [config, catalogos, invitados])
  const monto = montoRecargo(r, precios)
  const porcentajes = porcentajesPorRubro(r)

  return (
    <div className="space-y-4">
      <EditorRecargo valor={r} onChange={onCambio} etiqueta="Recargo de sábado" />
      <div className="rounded-lg border-l-4 border-accent bg-accent/10 px-3 py-2 text-sm">
        <label className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span>Un sábado este salón cobra</span>
          <span className="font-semibold tabular-nums">{fmt(monto)} más</span>
          {r.tipo === "porcentaje" && (
            <>
              <span>(con</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                aria-label="Invitados para la vista previa"
                value={invitados}
                onChange={(e) => setInvitados(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="h-8 w-20 rounded-lg border border-input bg-background px-2 text-right tabular-nums"
              />
              <span>invitados)</span>
            </>
          )}
        </label>
        {r.tipo === "porcentaje" && (porcentajes.cocina > 0 || porcentajes.barra > 0 || porcentajes.servicios > 0) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {[
              porcentajes.cocina > 0 && "Cocina: un plato de cada paso, al precio promedio de ese paso",
              porcentajes.barra > 0 && "Barra: promedio de las barras visibles, todos adultos",
              porcentajes.servicios > 0 &&
                `Servicios: además, ${porcentajes.servicios.toLocaleString("es-AR")} % de los que se elijan`,
            ]
              .filter(Boolean)
              .join(" · ")}
            .
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Personal ───────────────────────────────────────────────────────────

function BloquePersonal({
  reglas,
  onReglas,
  personal,
  capacidad,
}: {
  reglas: ReglaPersonalSalon[]
  onReglas: (r: ReglaPersonalSalon[]) => void
  personal: PersonaConTarifa[]
  capacidad: number | null
}) {
  const [invitados, setInvitados] = useState(80)
  const [conMenu, setConMenu] = useState(true)
  const [conBarra, setConBarra] = useState(true)

  /** Funciones del personal activo (texto exacto), sin repetir. */
  const funciones = useMemo(
    () => [...new Set(personal.map((p) => p.funcion))].sort((a, b) => a.localeCompare(b, "es")),
    [personal],
  )
  const libres = funciones.filter((f) => !reglas.some((r) => r.funcion === f))

  const cambiarRegla = (i: number, cambios: Partial<ReglaPersonalSalon>) =>
    onReglas(reglas.map((r, j) => (j === i ? { ...r, ...cambios } : r)))

  const simulacion = simularPersonal(reglas, personal, { invitados, conMenu, conBarra })
  const superaCapacidad = capacidad != null && invitados > capacidad

  const entero = (v: string) => Math.max(0, Math.floor(Number(v) || 0))

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        <strong>Invitados</strong>: va 1 persona cada esa cantidad de invitados (redondeando para arriba).{" "}
        <strong>Personal</strong>: la cantidad mínima de personas, aunque sean pocos invitados. Se usa lo que dé más.
        Con Invitados en 0 es personal fijo: siempre esa cantidad (Puerta, Maestranza, Coordinador...). La tarifa sale
        sola de Finanzas &gt; Personal (la más alta de esa función).
      </p>

      {reglas.length === 0 && <p className="text-sm text-muted-foreground">Este salón todavía no tiene reglas de personal.</p>}

      <div className="space-y-2">
        {reglas.map((r, i) => {
          const tarifa = tarifaDeRegla(r, personal)
          // La de Finanzas > Personal (la más alta de esa función), se use o no.
          const tarifaFinanzas = tarifaMasAlta(r.funcion, personal)
          const precioUnitario = precioConGanancia(tarifa.tarifa, r.ganancia)
          // En el desplegable: las funciones libres + la propia (aunque ya no
          // haya nadie activo con esa función).
          const opciones = [...new Set([r.funcion, ...libres].filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"))
          return (
            <div key={`${r.funcion}-${i}`} className="rounded-lg border border-border p-3 space-y-2">
              {/* Arriba: función + borrar. Abajo: los 5 números (de a 2 en el celular). */}
              <div className="flex items-end gap-2">
                <label className="min-w-0 flex-1 space-y-1 text-xs sm:max-w-xs">
                  <span className="text-muted-foreground">Función</span>
                  <Select value={r.funcion || undefined} onValueChange={(v) => cambiarRegla(i, { funcion: v })}>
                    <SelectTrigger className="h-9" aria-label="Función">
                      <SelectValue placeholder="Elegí una función" />
                    </SelectTrigger>
                    <SelectContent>
                      {opciones.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                          {!funciones.includes(f) ? " (sin personal activo)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <button
                  type="button"
                  onClick={() => onReglas(reglas.filter((_, j) => j !== i))}
                  className="ml-auto rounded p-2 text-red-600 hover:bg-red-50"
                  aria-label={`Borrar la regla de ${r.funcion || "personal"}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(2,minmax(0,1fr))_auto_minmax(0,1.3fr)] sm:items-end">
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Invitados</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label={`${r.funcion}: uno cada N invitados`}
                    value={r.cadaNInvitados}
                    onChange={(e) => cambiarRegla(i, { cadaNInvitados: entero(e.target.value) })}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-right text-sm tabular-nums"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Personal</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label={`${r.funcion}: mínimo`}
                    value={r.minimo}
                    onChange={(e) => cambiarRegla(i, { minimo: entero(e.target.value) })}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-right text-sm tabular-nums"
                  />
                </label>
                <div className="space-y-1 text-xs">
                  <span className="block text-muted-foreground">Ganancia</span>
                  <InputGanancia
                    etiqueta={`${r.funcion}: ganancia`}
                    mostrarEtiqueta={false}
                    valor={r.ganancia}
                    onChange={(n) => cambiarRegla(i, { ganancia: n })}
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Aplica</span>
                  <Select value={r.aplica} onValueChange={(v) => cambiarRegla(i, { aplica: v as AplicaRegla })}>
                    <SelectTrigger className="h-9" aria-label={`${r.funcion}: cuándo aplica`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APLICA_OPCIONES.map((o) => (
                        <SelectItem key={o.valor} value={o.valor}>
                          {o.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Tarifa en su propia línea: por defecto la de Finanzas > Personal
                  (no se escribe). Escribir otra es una acción aparte, para no
                  pisarla sin querer. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs tabular-nums">
                <span className="text-muted-foreground">Tarifa por persona:</span>
                {r.tarifa == null ? (
                  tarifaFinanzas ? (
                    <span>
                      <span className="font-semibold text-foreground">{fmt(tarifaFinanzas.tarifa)}</span>
                      <span className="text-muted-foreground"> · de Finanzas &gt; Personal (la más alta: {tarifaFinanzas.de})</span>
                    </span>
                  ) : (
                    <AvisoSinCosto texto={`Nadie con la función ${r.funcion} en Finanzas > Personal: va a cotizar $0`} />
                  )
                ) : (
                  <span className="flex items-center gap-2">
                    <InputPrecio
                      valor={r.tarifa}
                      onChange={(n) => cambiarRegla(i, { tarifa: n ?? 0 })}
                      etiqueta={`${r.funcion}: tarifa a mano`}
                      className="h-8 w-32"
                    />
                    <span className="text-muted-foreground">a mano · no sigue los cambios de Finanzas &gt; Personal</span>
                  </span>
                )}
                {tarifa.origen !== "sin_costo" && (
                  <span>
                    → con {r.ganancia} %: <span className="font-semibold text-foreground">precio {fmt(precioUnitario)}</span> por persona
                  </span>
                )}
                {r.tarifa != null && tarifa.origen === "sin_costo" && <AvisoSinCosto />}
                <button
                  type="button"
                  onClick={() => cambiarRegla(i, { tarifa: r.tarifa == null ? tarifaFinanzas?.tarifa ?? 0 : null })}
                  className="ml-auto text-[11px] font-medium text-[#2d5a3d] underline-offset-2 hover:underline"
                >
                  {r.tarifa == null
                    ? "Cambiar a mano"
                    : `Usar la de Finanzas${tarifaFinanzas ? ` (${fmt(tarifaFinanzas.tarifa)})` : ""}`}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <Button
        size="sm"
        variant="outline"
        disabled={libres.length === 0}
        onClick={() =>
          onReglas([
            ...reglas,
            { funcion: libres[0], cadaNInvitados: 0, minimo: 1, tarifa: null, ganancia: 0, aplica: "siempre" },
          ])
        }
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        {libres.length === 0 ? "Ya están todas las funciones" : "Agregar regla"}
      </Button>

      {/* Simulación en vivo */}
      <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <span>Con</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              aria-label="Invitados para simular"
              value={invitados}
              onChange={(e) => setInvitados(entero(e.target.value))}
              className="h-8 w-20 rounded-lg border border-input bg-background px-2 text-right tabular-nums"
            />
            <span>invitados</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={conMenu} onChange={(e) => setConMenu(e.target.checked)} className="h-4 w-4" />
            con menú
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={conBarra} onChange={(e) => setConBarra(e.target.checked)} className="h-4 w-4" />
            con barra
          </label>
        </div>
        {superaCapacidad && (
          <p className="text-xs font-medium text-red-700">Supera la capacidad del salón ({capacidad} invitados).</p>
        )}
        {simulacion.lineas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Con estas reglas no hace falta personal.</p>
        ) : (
          <p className="text-sm">
            {simulacion.lineas.map((l) => `${l.cantidad} ${l.funcion}`).join(", ")} →{" "}
            <span className="tabular-nums">
              costo {fmt(simulacion.costoTotal)} →{" "}
              <span className="font-semibold">precio {fmt(simulacion.precioTotal)}</span>
            </span>
          </p>
        )}
        {simulacion.lineas.some((l) => l.tarifa.origen === "sin_costo") && (
          <AvisoSinCosto texto="Alguna función no tiene costo cargado: cotiza $0" />
        )}
      </div>
    </div>
  )
}

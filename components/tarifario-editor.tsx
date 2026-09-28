"use client"

// Editor del tarifario del cotizador, embebido en Eventos > Cotizaciones,
// al lado del precio base por salón.
//
// Acá se cargan SOLO las dos cosas que no son servicios:
//   1. la grilla de precio del salón (rango de invitados × día × modalidad), y
//   2. la regla de personal por invitados.
// Más los vínculos de cada servicio de Menú/Barra con las recetas y el
// template de barra que premarcan en el cotizador.
//
// El precio de los menús, las barras y de cualquier otro servicio NO se
// carga acá: sale de la tabla "servicios" y se edita en Finanzas > Servicios.

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Save, Trash2, Table2, Users, UtensilsCrossed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SALONES, salonColor, salonLabel } from "@/lib/store"
import type { DiaTarifario, ModalidadSalon } from "@/lib/tarifario-cotizador"

interface FilaGrilla {
  salon: string
  invitadosMin: number
  invitadosMax: number
  dia: DiaTarifario
  modalidad: ModalidadSalon
  precio: number
}

interface ReglaPersonal {
  funcion: string
  cadaNInvitados: number
  minimo: number
  activo: boolean
}

interface ServicioSimple {
  id: string
  nombre: string
  categoria: string
}

interface RecetaSimple {
  id: string
  nombre: string
  categoria: string
}

interface BarraTemplateSimple {
  id: string
  nombre: string
}

const MODALIDAD_LABEL: Record<ModalidadSalon, string> = {
  solo_salon: "Solo salón",
  con_catering: "Salón con catering y bebidas",
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

function Bloque({
  icon,
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
          <div className="shrink-0">{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function TarifarioEditor() {
  const { toast } = useToast()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [grilla, setGrilla] = useState<FilaGrilla[]>([])
  const [reglas, setReglas] = useState<ReglaPersonal[]>([])
  const [recetasPorServicio, setRecetasPorServicio] = useState<Record<string, string[]>>({})
  const [barraPorServicio, setBarraPorServicio] = useState<Record<string, string>>({})

  const [servicios, setServicios] = useState<ServicioSimple[]>([])
  const [recetas, setRecetas] = useState<RecetaSimple[]>([])
  const [barraTemplates, setBarraTemplates] = useState<BarraTemplateSimple[]>([])
  const [funciones, setFunciones] = useState<string[]>([])

  const [salonVista, setSalonVista] = useState<string>(SALONES[0] ?? "")

  useEffect(() => {
    Promise.all([
      fetch("/api/administracion/tarifario").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/vendedor/catalogo").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([tarifario, catalogo]) => {
        if (tarifario?.ok) {
          setGrilla(tarifario.grilla || [])
          setReglas(tarifario.reglasPersonal || [])
          setRecetasPorServicio(tarifario.recetasPorServicio || {})
          setBarraPorServicio(tarifario.barraTemplatePorServicio || {})
        }
        if (catalogo?.ok) {
          setServicios(catalogo.servicios || [])
          setRecetas(catalogo.recetas || [])
          setFunciones([...new Set((catalogo.personal || []).map((p: { funcion: string }) => p.funcion))].sort() as string[])
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false))

    // Los templates de barra no están en el catálogo del vendedor (es un dato
    // de cocina, no de venta), así que se piden aparte.
    fetch("/api/barra-templates")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data)) {
          setBarraTemplates(data.map((t: { id: string; nombre: string }) => ({ id: t.id, nombre: t.nombre })))
        }
      })
      .catch(() => {})
  }, [])

  const serviciosMenu = useMemo(() => servicios.filter((s) => s.categoria === "Menú"), [servicios])
  const serviciosBarra = useMemo(() => servicios.filter((s) => s.categoria === "Barra"), [servicios])
  const filasDelSalon = useMemo(
    () => grilla.filter((f) => f.salon === salonVista),
    [grilla, salonVista],
  )

  const agregarFila = (modalidad: ModalidadSalon) => {
    setGrilla((prev) => [
      ...prev,
      { salon: salonVista, invitadosMin: 0, invitadosMax: 0, dia: "viernes", modalidad, precio: 0 },
      { salon: salonVista, invitadosMin: 0, invitadosMax: 0, dia: "sabado", modalidad, precio: 0 },
    ])
  }

  const actualizarFila = (fila: FilaGrilla, cambios: Partial<FilaGrilla>) => {
    setGrilla((prev) => prev.map((f) => (f === fila ? { ...f, ...cambios } : f)))
  }

  const borrarFila = (fila: FilaGrilla) => {
    setGrilla((prev) => prev.filter((f) => f !== fila))
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      const res = await fetch("/api/administracion/tarifario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grilla,
          reglasPersonal: reglas,
          recetasPorServicio,
          barraTemplatePorServicio: barraPorServicio,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo guardar el tarifario", variant: "destructive" })
        return
      }
      toast({ title: "Tarifario guardado" })
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Cargando tarifario...</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm">Tarifario del cotizador</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            La grilla del salón y la regla de personal. El precio de los menús, las barras y del resto de los
            servicios se edita en{" "}
            <Link href="/finanzas/servicios" className="underline">
              Finanzas &gt; Servicios
            </Link>
            .
          </p>
        </div>
        <Button size="sm" onClick={guardar} disabled={guardando} className="shrink-0">
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {guardando ? "Guardando..." : "Guardar tarifario"}
        </Button>
      </div>

      <Bloque
        icon={<Table2 className="h-5 w-5 text-muted-foreground" />}
        title="Grilla de precio del salón"
        subtitle="Por rango de invitados, día y modalidad. Domingo a jueves se cotizan como viernes."
        defaultOpen
      >
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {SALONES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSalonVista(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
                salonVista === s ? "text-white" : "bg-white hover:bg-muted"
              }`}
              style={salonVista === s ? { backgroundColor: salonColor(s), borderColor: salonColor(s) } : { color: salonColor(s) }}
            >
              {salonLabel(s)}
            </button>
          ))}
        </div>

        {(["solo_salon", "con_catering"] as ModalidadSalon[]).map((modalidad) => {
          const filas = filasDelSalon
            .filter((f) => f.modalidad === modalidad)
            .sort((a, b) => a.invitadosMin - b.invitadosMin || a.dia.localeCompare(b.dia))
          return (
            <div key={modalidad} className="mb-5 last:mb-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold">{MODALIDAD_LABEL[modalidad]}</p>
                <Button size="sm" variant="outline" onClick={() => agregarFila(modalidad)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Agregar rango
                </Button>
              </div>
              {modalidad === "con_catering" && (
                <p className="text-xs text-muted-foreground mb-2">
                  Incluye menú y barra (no suman aparte en la cotización). No incluye mesa dulce.
                </p>
              )}
              {filas.length === 0 ? (
                <p className="text-xs text-muted-foreground border border-dashed rounded-lg px-3 py-4 text-center">
                  Sin rangos cargados para {salonLabel(salonVista)}. Las cotizaciones de este salón van a salir
                  marcadas como fuera de tarifario.
                </p>
              ) : (
                <div className="space-y-2">
                  {filas.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <Input
                        type="number"
                        min={0}
                        value={f.invitadosMin || ""}
                        onChange={(e) => actualizarFila(f, { invitadosMin: Number(e.target.value) || 0 })}
                        placeholder="desde"
                        className="h-9 w-20"
                      />
                      <span className="text-xs text-muted-foreground">a</span>
                      <Input
                        type="number"
                        min={0}
                        value={f.invitadosMax || ""}
                        onChange={(e) => actualizarFila(f, { invitadosMax: Number(e.target.value) || 0 })}
                        placeholder="hasta"
                        className="h-9 w-20"
                      />
                      <span className="text-xs text-muted-foreground">invitados</span>
                      <Select value={f.dia} onValueChange={(v) => actualizarFila(f, { dia: v as DiaTarifario })}>
                        <SelectTrigger className="h-9 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viernes">Viernes</SelectItem>
                          <SelectItem value="sabado">Sábado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        value={f.precio || ""}
                        onChange={(e) => actualizarFila(f, { precio: Number(e.target.value) || 0 })}
                        placeholder="precio"
                        className="h-9 w-36"
                      />
                      <span className="text-xs text-muted-foreground w-28">{f.precio > 0 ? fmt(f.precio) : ""}</span>
                      <Button size="icon" variant="ghost" onClick={() => borrarFila(f)} title="Borrar rango">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </Bloque>

      <div className="border-t border-border" />

      <Bloque
        icon={<Users className="h-5 w-5 text-muted-foreground" />}
        title="Regla de personal por invitados"
        subtitle="Solo se aplica si el evento lleva menú. El vendedor puede ajustarlo después."
      >
        {funciones.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay personal activo cargado en Finanzas &gt; Personal.</p>
        ) : (
          <div className="space-y-2">
            {funciones.map((funcion) => {
              const regla = reglas.find((r) => r.funcion === funcion) || {
                funcion,
                cadaNInvitados: 0,
                minimo: 0,
                activo: false,
              }
              const setRegla = (cambios: Partial<ReglaPersonal>) => {
                setReglas((prev) => {
                  const existe = prev.some((r) => r.funcion === funcion)
                  if (!existe) return [...prev, { ...regla, ...cambios, activo: true }]
                  return prev.map((r) => (r.funcion === funcion ? { ...r, ...cambios } : r))
                })
              }
              return (
                <div key={funcion} className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm w-44 shrink-0 truncate" title={funcion}>
                    {funcion}
                  </span>
                  <span className="text-xs text-muted-foreground">1 cada</span>
                  <Input
                    type="number"
                    min={0}
                    value={regla.cadaNInvitados || ""}
                    onChange={(e) => setRegla({ cadaNInvitados: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="h-9 w-20"
                  />
                  <span className="text-xs text-muted-foreground">invitados · mínimo</span>
                  <Input
                    type="number"
                    min={0}
                    value={regla.minimo || ""}
                    onChange={(e) => setRegla({ minimo: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="h-9 w-20"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={regla.activo}
                      onChange={(e) => setRegla({ activo: e.target.checked })}
                      className="h-4 w-4"
                    />
                    activa
                  </label>
                </div>
              )
            })}
          </div>
        )}
      </Bloque>

      <div className="border-t border-border" />

      <Bloque
        icon={<UtensilsCrossed className="h-5 w-5 text-muted-foreground" />}
        title="Qué premarca cada menú y cada barra"
        subtitle="Al elegir el servicio en el cotizador se marcan solas estas recetas / esta barra."
      >
        {serviciosMenu.length === 0 && serviciosBarra.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hay servicios de categoría Menú ni Barra. Se crean en Finanzas &gt; Servicios.
          </p>
        ) : (
          <div className="space-y-5">
            {serviciosMenu.map((s) => {
              const marcadas = recetasPorServicio[s.id] || []
              return (
                <div key={s.id}>
                  <p className="text-sm font-semibold mb-2">{s.nombre}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recetas.map((r) => {
                      const activa = marcadas.includes(r.id)
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() =>
                            setRecetasPorServicio((prev) => ({
                              ...prev,
                              [s.id]: activa ? marcadas.filter((id) => id !== r.id) : [...marcadas, r.id],
                            }))
                          }
                          className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                            activa
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-muted-foreground hover:bg-muted"
                          }`}
                          title={r.categoria}
                        >
                          {r.nombre}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {serviciosBarra.map((s) => (
              <div key={s.id} className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold w-52 shrink-0 truncate">{s.nombre}</span>
                <Select
                  value={barraPorServicio[s.id] || "ninguna"}
                  onValueChange={(v) =>
                    setBarraPorServicio((prev) => {
                      if (v === "ninguna") {
                        const { [s.id]: _quitado, ...resto } = prev
                        return resto
                      }
                      return { ...prev, [s.id]: v }
                    })
                  }
                >
                  <SelectTrigger className="h-9 w-64">
                    <SelectValue placeholder="Sin barra asociada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguna">Sin barra asociada</SelectItem>
                    {barraTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </Bloque>
    </div>
  )
}

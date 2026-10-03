"use client"

// Cotizaciones > Configuración.
//
// Arriba: el cotizador POR SALÓN (modelo costo + ganancia, scripts/015),
// en components/cotizador-salon-editor.tsx.
//
// Abajo, plegada: la CONFIGURACIÓN ANTERIOR (TarifarioAnterior), que sigue
// usando el cotizador del vendedor hasta el Paso 2 — no se borra:
//   1. la grilla de precio del salón (rango de invitados × día × modalidad),
//   2. la regla de personal por invitados (tarifario_personal_regla),
//   3. servicios y personal "incluidos en el salón" (globales), y
//   4. qué recetas / barra premarca cada servicio de Menú / Barra.

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Save, Trash2, Table2, Users, UtensilsCrossed, PackageCheck, Pencil, CheckCircle2, AlertCircle, UserCheck, ChevronDown, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { SALONES, salonColor, salonLabel } from "@/lib/store"
import type { DiaTarifario, ModalidadSalon } from "@/lib/tarifario-cotizador"
import { BloqueIncluidosAnterior } from "@/components/cotizador-config-bloques"
import { Bloque, InputPrecio } from "@/components/config-bloque"
import { CotizadorSalonEditor } from "@/components/cotizador-salon-editor"

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

function TarifarioAnterior() {
  const { toast } = useToast()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [grilla, setGrilla] = useState<FilaGrilla[]>([])
  const [reglas, setReglas] = useState<ReglaPersonal[]>([])
  const [recetasPorServicio, setRecetasPorServicio] = useState<Record<string, string[]>>({})
  const [barraPorServicio, setBarraPorServicio] = useState<Record<string, string>>({})
  const [incluidosServicio, setIncluidosServicio] = useState<string[]>([])
  const [incluidosPersonal, setIncluidosPersonal] = useState<Array<{ personalId: string; dia: "viernes" | "sabado" }>>([])
  const [personalCatalogo, setPersonalCatalogo] = useState<Array<{ id: string; nombre: string; apellido: string; funcion: string }>>([])

  const [servicios, setServicios] = useState<ServicioSimple[]>([])
  const [recetas, setRecetas] = useState<RecetaSimple[]>([])
  const [barraTemplates, setBarraTemplates] = useState<BarraTemplateSimple[]>([])
  const [funciones, setFunciones] = useState<string[]>([])

  const [salonVista, setSalonVista] = useState<string>(SALONES[0] ?? "")

  // Cambios sin guardar: se compara contra lo que vino de la base al cargar.
  // Sin esto es fácil tocar precios, irse de la pantalla y perder el trabajo.
  const [guardado, setGuardado] = useState<string>("")
  const [guardadoRecien, setGuardadoRecien] = useState(false)

  // Alta/edición del rango de invitados. Va en un diálogo aparte para que en
  // la tabla el único campo editable sea el precio: el rango es contexto.
  const [dialogoRango, setDialogoRango] = useState<{
    modalidad: ModalidadSalon
    minOriginal?: number
    maxOriginal?: number
    min: string
    max: string
  } | null>(null)

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
          setIncluidosServicio(tarifario.serviciosIncluidosSalon || [])
          setIncluidosPersonal(tarifario.personalIncluidoSalon || [])
        }
        if (catalogo?.ok) {
          setServicios(catalogo.servicios || [])
          setRecetas(catalogo.recetas || [])
          setPersonalCatalogo(catalogo.personal || [])
          setFunciones([...new Set((catalogo.personal || []).map((p: { funcion: string }) => p.funcion))].sort() as string[])
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false))
      // La huella base se fija en un efecto aparte (abajo), cuando el estado
      // ya quedó asentado con lo que vino de la base.

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

  // Huella del estado editable: si cambia respecto de lo último guardado,
  // hay trabajo sin guardar.
  const huella = useMemo(() => {
    // Ordenar por una clave de texto armada a mano, y no por un campo suelto:
    // así el orden no depende de que cada fila tenga todos los campos. Una
    // regla a medio completar (sin función elegida todavía) rompía el
    // comparador y se llevaba puesta la pantalla entera.
    const porClave = <T,>(items: T[], clave: (x: T) => string) =>
      [...items].map((x) => ({ x, k: clave(x) })).sort((a, b) => a.k.localeCompare(b.k)).map((p) => p.x)

    return JSON.stringify({
      grilla: porClave(grilla, (f) => `${f?.salon}|${f?.modalidad}|${f?.dia}|${f?.invitadosMin}|${f?.invitadosMax}`),
      reglas: porClave(reglas, (r) => String(r?.funcion ?? "")),
      recetasPorServicio,
      barraPorServicio,
      incluidosServicio: [...incluidosServicio].sort(),
      incluidosPersonal: porClave(incluidosPersonal, (p) => `${p?.personalId ?? ""}|${p?.dia ?? ""}`),
    })
  }, [grilla, reglas, recetasPorServicio, barraPorServicio, incluidosServicio, incluidosPersonal])
  const hayCambiosSinGuardar = guardado !== "" && huella !== guardado

  // Apenas termina de cargar, lo que vino de la base pasa a ser la referencia
  // contra la que se comparan los cambios.
  useEffect(() => {
    if (!cargando && guardado === "") setGuardado(huella)
  }, [cargando, guardado, huella])

  const serviciosMenu = useMemo(() => servicios.filter((s) => s.categoria === "Menú"), [servicios])
  const serviciosBarra = useMemo(() => servicios.filter((s) => s.categoria === "Barra"), [servicios])
  const filasDelSalon = useMemo(
    () => grilla.filter((f) => f.salon === salonVista),
    [grilla, salonVista],
  )

  /**
   * La grilla se guarda con una fila por salón × rango × día × modalidad
   * (así lo espera la API y así lo lee el cálculo). Para mostrarla se agrupa
   * por RANGO, con el precio del viernes y el del sábado uno al lado del
   * otro: es la misma información, pero se lee de un vistazo en vez de tener
   * "70 a 80" repetido en dos filas sueltas.
   */
  const rangosPorModalidad = useMemo(() => {
    const armar = (modalidad: ModalidadSalon) => {
      const porRango = new Map<string, { min: number; max: number; viernes?: FilaGrilla; sabado?: FilaGrilla }>()
      for (const f of filasDelSalon.filter((x) => x.modalidad === modalidad)) {
        const clave = `${f.invitadosMin}-${f.invitadosMax}`
        const actual = porRango.get(clave) ?? { min: f.invitadosMin, max: f.invitadosMax }
        if (f.dia === "sabado") actual.sabado = f
        else actual.viernes = f
        porRango.set(clave, actual)
      }
      return [...porRango.values()].sort((a, b) => a.min - b.min)
    }
    return { solo_salon: armar("solo_salon"), con_catering: armar("con_catering") }
  }, [filasDelSalon])

  /** Cuántos rangos tiene cargados cada salón (para los chips de arriba). */
  const rangosPorSalon = useMemo(() => {
    const cuenta: Record<string, number> = {}
    for (const s of SALONES) {
      const claves = new Set(
        grilla.filter((f) => f.salon === s).map((f) => `${f.modalidad}|${f.invitadosMin}-${f.invitadosMax}`),
      )
      cuenta[s] = claves.size
    }
    return cuenta
  }, [grilla])

  /** Alta de un rango: crea las cuatro filas (viernes y sábado) en $0. */
  const crearRango = (modalidad: ModalidadSalon, min: number, max: number) => {
    setGrilla((prev) => [
      ...prev,
      { salon: salonVista, invitadosMin: min, invitadosMax: max, dia: "viernes", modalidad, precio: 0 },
      { salon: salonVista, invitadosMin: min, invitadosMax: max, dia: "sabado", modalidad, precio: 0 },
    ])
  }

  /** Cambiar el rango mueve las dos filas (viernes y sábado) a la vez. */
  const renombrarRango = (modalidad: ModalidadSalon, minViejo: number, maxViejo: number, min: number, max: number) => {
    setGrilla((prev) =>
      prev.map((f) =>
        f.salon === salonVista && f.modalidad === modalidad && f.invitadosMin === minViejo && f.invitadosMax === maxViejo
          ? { ...f, invitadosMin: min, invitadosMax: max }
          : f,
      ),
    )
  }

  const abrirDialogoRango = (modalidad: ModalidadSalon, min?: number, max?: number) => {
    setDialogoRango({
      modalidad,
      minOriginal: min,
      maxOriginal: max,
      min: min !== undefined ? String(min) : "",
      max: max !== undefined ? String(max) : "",
    })
  }

  const confirmarDialogoRango = () => {
    if (!dialogoRango) return
    const min = Number(dialogoRango.min)
    const max = Number(dialogoRango.max)
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
      toast({ title: "Revisá el rango", description: "El 'hasta' tiene que ser mayor o igual que el 'desde'.", variant: "destructive" })
      return
    }
    const esEdicion = dialogoRango.minOriginal !== undefined && dialogoRango.maxOriginal !== undefined
    // Rango repetido dentro de la misma modalidad: el servidor lo rechaza y
    // además haría que el precio dependa del orden de las filas.
    const yaExiste = grilla.some(
      (f) =>
        f.salon === salonVista &&
        f.modalidad === dialogoRango.modalidad &&
        f.invitadosMin === min &&
        f.invitadosMax === max &&
        !(esEdicion && f.invitadosMin === dialogoRango.minOriginal && f.invitadosMax === dialogoRango.maxOriginal),
    )
    if (yaExiste) {
      toast({ title: "Ese rango ya existe", description: `${salonLabel(salonVista)} ya tiene ${min} a ${max} invitados en esta modalidad.`, variant: "destructive" })
      return
    }
    if (esEdicion) {
      renombrarRango(dialogoRango.modalidad, dialogoRango.minOriginal!, dialogoRango.maxOriginal!, min, max)
    } else {
      crearRango(dialogoRango.modalidad, min, max)
    }
    setDialogoRango(null)
  }

  const borrarRango = (modalidad: ModalidadSalon, min: number, max: number) => {
    setGrilla((prev) =>
      prev.filter(
        (f) =>
          !(f.salon === salonVista && f.modalidad === modalidad && f.invitadosMin === min && f.invitadosMax === max),
      ),
    )
  }

  /** Precio de un día puntual dentro de un rango. */
  const ponerPrecio = (modalidad: ModalidadSalon, min: number, max: number, dia: DiaTarifario, precio: number) => {
    setGrilla((prev) => {
      const existe = prev.some(
        (f) =>
          f.salon === salonVista && f.modalidad === modalidad && f.invitadosMin === min && f.invitadosMax === max && f.dia === dia,
      )
      if (existe) {
        return prev.map((f) =>
          f.salon === salonVista && f.modalidad === modalidad && f.invitadosMin === min && f.invitadosMax === max && f.dia === dia
            ? { ...f, precio }
            : f,
        )
      }
      return [...prev, { salon: salonVista, invitadosMin: min, invitadosMax: max, dia, modalidad, precio }]
    })
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
          serviciosIncluidosSalon: incluidosServicio,
          personalIncluidoSalon: incluidosPersonal,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo guardar el tarifario", variant: "destructive" })
        return
      }
      setGuardado(huella)
      setGuardadoRecien(true)
      setTimeout(() => setGuardadoRecien(false), 4000)
      toast({ title: "Tarifario guardado", description: "Los cambios ya están activos en el cotizador." })
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
        <div className="flex items-center gap-2 shrink-0">
          {hayCambiosSinGuardar && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" />
              Sin guardar
            </span>
          )}
          {guardadoRecien && !hayCambiosSinGuardar && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Guardado
            </span>
          )}
          <Button size="sm" onClick={guardar} disabled={guardando || !hayCambiosSinGuardar}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {guardando ? "Guardando..." : "Guardar tarifario"}
          </Button>
        </div>
      </div>

      <Bloque
        icon={<Table2 className="h-5 w-5 text-muted-foreground" />}
        title="Precio del salón"
        subtitle="Cuánto sale cada salón según cuánta gente y qué día. Domingo a jueves se cobran como viernes."
        defaultOpen
      >
        {/* De un vistazo: qué salones tienen grilla cargada y cuáles no. */}
        <div className="flex flex-wrap gap-2 mb-4">
          {SALONES.map((s) => {
            const cargados = rangosPorSalon[s] ?? 0
            const activo = salonVista === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSalonVista(s)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  activo ? "text-white" : "bg-white hover:bg-muted"
                }`}
                style={activo ? { backgroundColor: salonColor(s), borderColor: salonColor(s) } : { color: salonColor(s) }}
              >
                <span className="block text-sm font-medium">{salonLabel(s)}</span>
                <span className={`block text-[11px] ${activo ? "text-white/80" : "text-muted-foreground"}`}>
                  {cargados > 0 ? `${cargados} ${cargados === 1 ? "rango" : "rangos"}` : "sin cargar"}
                </span>
              </button>
            )
          })}
        </div>

        {(["solo_salon", "con_catering"] as ModalidadSalon[]).map((modalidad) => {
          const rangos = rangosPorModalidad[modalidad]
          return (
            <div key={modalidad} className="mb-6 last:mb-0">
              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{MODALIDAD_LABEL[modalidad]}</p>
                  <p className="text-xs text-muted-foreground">
                    {modalidad === "con_catering"
                      ? "Incluye menú y barra (no se cobran aparte). No incluye mesa dulce."
                      : "Solo el alquiler del salón, sin comida ni bebida."}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => abrirDialogoRango(modalidad)} className="shrink-0">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Agregar rango
                </Button>
              </div>

              {rangos.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
                  <p className="text-sm font-medium text-foreground">Sin grilla cargada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {salonLabel(salonVista)} cotiza el salón en $0 con esta modalidad, y las cotizaciones salen
                    marcadas como fuera de tarifario.
                  </p>
                  <Button size="sm" className="mt-3" onClick={() => abrirDialogoRango(modalidad)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Cargar el primer rango
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  {/* El encabezado de columnas es solo para pantalla ancha; en
                      el celular cada rango se lee como tarjeta con sus propias
                      etiquetas al lado de cada precio. */}
                  <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_132px_132px_68px] gap-2 bg-muted/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Cuánta gente</span>
                    <span className="text-right">Viernes</span>
                    <span className="text-right">Sábado</span>
                    <span />
                  </div>
                  {rangos.map((r) => (
                    <div
                      key={`${r.min}-${r.max}`}
                      className="border-t border-border/60 px-3 py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_132px_132px_68px] sm:gap-2 sm:items-center"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2 sm:mb-0">
                        <span className="text-sm font-medium">
                          {r.min} a {r.max} invitados
                        </span>
                        <button
                          type="button"
                          onClick={() => abrirDialogoRango(modalidad, r.min, r.max)}
                          className="text-xs underline text-muted-foreground hover:text-foreground sm:hidden"
                        >
                          Cambiar rango
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-2 sm:mb-0 sm:block min-w-0">
                        <span className="w-16 shrink-0 text-xs text-muted-foreground sm:hidden">Viernes</span>
                        <InputPrecio
                          valor={r.viernes?.precio ?? 0}
                          onChange={(n) => ponerPrecio(modalidad, r.min, r.max, "viernes", n ?? 0)}
                          etiqueta={`Precio del viernes, ${r.min} a ${r.max} invitados`}
                        />
                      </div>

                      <div className="flex items-center gap-2 sm:block min-w-0">
                        <span className="w-16 shrink-0 text-xs text-muted-foreground sm:hidden">Sábado</span>
                        <InputPrecio
                          valor={r.sabado?.precio ?? 0}
                          onChange={(n) => ponerPrecio(modalidad, r.min, r.max, "sabado", n ?? 0)}
                          etiqueta={`Precio del sábado, ${r.min} a ${r.max} invitados`}
                        />
                      </div>

                      <div className="hidden sm:flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => abrirDialogoRango(modalidad, r.min, r.max)}
                          title="Cambiar el rango de invitados"
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => borrarRango(modalidad, r.min, r.max)}
                          title="Borrar este rango"
                          className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => borrarRango(modalidad, r.min, r.max)}
                        className="mt-2 text-xs text-destructive underline sm:hidden"
                      >
                        Borrar este rango
                      </button>
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
        icon={<PackageCheck className="h-5 w-5 text-muted-foreground" />}
        title="Servicios incluidos en el salón"
        subtitle="Cuáles ya vienen incluidos en el precio del salón (para todos los salones)."
      >
        <BloqueIncluidosAnterior
          servicios={servicios}
          incluidosServicio={incluidosServicio}
          onIncluidosServicio={setIncluidosServicio}
        />
      </Bloque>

      <div className="border-t border-border" />

      <Bloque
        icon={<UserCheck className="h-5 w-5 text-muted-foreground" />}
        title="Personal incluido del salón"
        subtitle="Qué personal se tilda solo los viernes y cuál los sábados."
      >
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Domingo a jueves usan el juego de viernes. El personal no suma al precio de venta: es costo, y se
            calcula en vivo como siempre.
          </p>
          <div className="space-y-1.5">
            {personalCatalogo.map((p) => {
              const actual = incluidosPersonal.find((i) => i.personalId === p.id)
              const setDia = (dia: "viernes" | "sabado" | "ninguno") => {
                setIncluidosPersonal((prev) => {
                  const sinEste = prev.filter((i) => i.personalId !== p.id)
                  return dia === "ninguno" ? sinEste : [...sinEste, { personalId: p.id, dia }]
                })
              }
              return (
                <div key={p.id} className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm w-56 shrink-0 truncate" title={`${p.nombre} ${p.apellido} — ${p.funcion}`}>
                    {p.nombre} {p.apellido}
                    <span className="text-muted-foreground"> · {p.funcion}</span>
                  </span>
                  <Select value={actual?.dia ?? "ninguno"} onValueChange={(v) => setDia(v as "viernes" | "sabado" | "ninguno")}>
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ninguno">No incluido</SelectItem>
                      <SelectItem value="viernes">Incluido viernes</SelectItem>
                      <SelectItem value="sabado">Incluido sábado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>
        </div>
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

      {/* Alta y edición del rango de invitados. Está aparte de la tabla para
          que ahí el único campo editable sea el precio. */}
      <Dialog open={!!dialogoRango} onOpenChange={(abierto) => !abierto && setDialogoRango(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialogoRango?.minOriginal !== undefined ? "Cambiar el rango" : "Nuevo rango de invitados"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {salonLabel(salonVista)} · {dialogoRango ? MODALIDAD_LABEL[dialogoRango.modalidad] : ""}
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="rango-desde">Desde</Label>
                <Input
                  id="rango-desde"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={dialogoRango?.min ?? ""}
                  onChange={(e) => setDialogoRango((d) => (d ? { ...d, min: e.target.value } : d))}
                  placeholder="50"
                />
              </div>
              <span className="pb-2.5 text-sm text-muted-foreground">a</span>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="rango-hasta">Hasta</Label>
                <Input
                  id="rango-hasta"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={dialogoRango?.max ?? ""}
                  onChange={(e) => setDialogoRango((d) => (d ? { ...d, max: e.target.value } : d))}
                  placeholder="60"
                />
              </div>
              <span className="pb-2.5 text-sm text-muted-foreground">invitados</span>
            </div>
            {dialogoRango?.minOriginal === undefined && (
              <p className="text-xs text-muted-foreground">
                Se crea con el precio del viernes y el del sábado en $0, para que los cargues en la tabla.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoRango(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarDialogoRango}>
              {dialogoRango?.minOriginal !== undefined ? "Guardar rango" : "Agregar rango"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Cotizaciones > Configuración: arriba el cotizador por salón; abajo, plegada,
 * la configuración anterior. La anterior se monta recién la primera vez que
 * se abre y después queda montada (escondida) para no perder lo que se esté
 * editando si se la pliega sin guardar.
 */
/**
 * La configuración anterior (grilla, regla de personal vieja, incluidos,
 * premarcas) ya no la usa nada desde el Paso 2 (PR #290). Escondida a pedido
 * del negocio (oct 2026), sin borrar ni el código ni las tablas: poner en
 * true para volver a mostrarla.
 */
const MOSTRAR_CONFIGURACION_ANTERIOR = false

export function TarifarioEditor() {
  const [anteriorAbierta, setAnteriorAbierta] = useState(false)
  const [anteriorMontada, setAnteriorMontada] = useState(false)

  return (
    <div className="space-y-4">
      <CotizadorSalonEditor />
      {MOSTRAR_CONFIGURACION_ANTERIOR && (
      <div className="rounded-xl border border-dashed border-border bg-muted/30">
        <button
          type="button"
          onClick={() => {
            setAnteriorAbierta((v) => !v)
            setAnteriorMontada(true)
          }}
          aria-expanded={anteriorAbierta}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
        >
          <History className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Configuración anterior — la usa el cotizador hasta el Paso 2</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Grilla de precios, regla de personal, incluidos y premarcas que usa hoy el cotizador del vendedor.
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${anteriorAbierta ? "rotate-180" : ""}`} />
        </button>
        {anteriorMontada && (
          <div className={anteriorAbierta ? "p-2 pt-0" : "hidden"}>
            <TarifarioAnterior />
          </div>
        )}
      </div>
      )}
    </div>
  )
}

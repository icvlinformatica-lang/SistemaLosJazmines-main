"use client"

// Stock por salón — pantalla de carga del conteo físico de insumos que
// quedaron en un salón al terminar un evento. La usan Cocina (solo insumos
// de cocina), Barra (solo insumos de barra), Mantenimiento (solo artículos de
// limpieza, desde el 21/10/2026; Cocina también su vajilla y utensilios, desde
// el 27/10/2026) y Administración/Soporte (todos), de
// madrugada y desde el celular. El servidor vuelve a controlar el
// perfil real al guardar.
//
// Flujo: elegir salón → menú (un botón por sector "Contar stock" y, debajo,
// el historial de cargas de ese salón) → carga. Se puede cargar en
// cualquier momento, sin PIN: cada carga es una sesión con fecha y hora y
// queda en el historial (pedido del dueño, 15/10/2026). La carga muestra
// TODOS los insumos del sector con su casillero: se escribe el número y
// listo (1 paso por insumo). Al enviar se mandan SOLO los que tienen un
// número escrito (ver itemsParaEnviar en lib/stock-carga.ts): vacío = no
// contado, nunca 0.
// El nombre de quien carga se pide en el diálogo de confirmación.
// La sesión se confirma TODA junta (ver /api/stock-salones/sesiones). Al
// guardar, el stock de Administración (stock_actual de /admin/almacen y
// /admin/barra) pasa a ser la suma de lo contado en cada salón.
// Mientras se escribe, lo tipeado queda como borrador en el celular (ver
// lib/stock-borrador.ts) para no perderlo si se cierra el navegador; al
// volver a la misma carga se ofrece seguir. El borrador nunca va al servidor.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useStore } from "@/lib/store-context"
import { useProfile, usuarioActivo } from "@/lib/profile-context"
import { salonLabel } from "@/lib/store"
import { sectoresPermitidos, type SectorStock } from "@/lib/stock-salones"
import { insumosVisibles, itemsParaEnviar, type InsumoCarga } from "@/lib/stock-carga"
import {
  armarBorradorStock,
  claveBorradorStock,
  clavesBorradorStockVencidas,
  leerBorradorStock,
  valoresDelCatalogo,
  type BorradorStock,
} from "@/lib/stock-borrador"
import { SalonSelectorOverlay } from "@/components/salon-selector-overlay"
import { SalonDot } from "@/components/salon-badge"
import { StockSesionDetalleDialog } from "@/components/stock-sesion-detalle-dialog"
import { ConfirmAction } from "@/components/confirm-action"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, ChefHat, ChevronDown, ChevronRight, ClipboardList, History, Loader2, Search, Send, SprayCan, UtensilsCrossed, Wine } from "lucide-react"

type Paso = "salon" | "menu" | "carga"

interface SaldoSalon {
  cantidad: number
  actualizadoPor: string | null
  actualizadoEn: string
}

interface EstadoSector {
  saldos: Record<string, SaldoSalon>
}

interface CargaHistorial {
  id: string
  sector: SectorStock
  cargadoPor: string
  fecha: string
  cantidadItems: number
}

const SECTOR_LABEL: Record<SectorStock, string> = {
  cocina: "cocina",
  barra: "barra",
  limpieza: "limpieza",
  vajilla: "vajilla y utensilios",
}
const SECTOR_ICON: Record<SectorStock, typeof ChefHat> = {
  cocina: ChefHat,
  barra: Wine,
  limpieza: SprayCan,
  vajilla: UtensilsCrossed,
}

/**
 * Artículos de limpieza o de vajilla: no están en el store (no los usa
 * ninguna otra pantalla), se traen de su ruta solo si el perfil cuenta ese
 * sector. `articulos` es null mientras carga; el error se muestra en la lista.
 */
function useArticulosAparte(activo: boolean, url: string, mensajeError: string) {
  const [articulos, setArticulos] = useState<InsumoCarga[] | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!activo) return
    let cancelado = false
    fetch(url)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelado) return
        if (!res.ok || !data?.ok) {
          setError(data?.error || mensajeError)
          setArticulos([])
          return
        }
        setError("")
        setArticulos(
          (data.articulos || []).map((a: { id: string; descripcion: string; unidad: string; categoria: string | null }) => ({
            id: a.id,
            descripcion: a.descripcion,
            unidad: a.unidad,
            categoria: a.categoria || undefined,
          })),
        )
      })
      .catch(() => {
        if (cancelado) return
        setError(mensajeError)
        setArticulos([])
      })
    return () => {
      cancelado = true
    }
  }, [activo, url, mensajeError])
  return { articulos, error }
}

function fmtCantidad(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n)
}

// Acceso al localStorage siempre con try/catch: en modo privado o con el
// almacenamiento bloqueado puede tirar error, y la carga tiene que seguir
// andando igual (solo que sin borrador).
function leerLocal(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave)
  } catch {
    return null
  }
}
function escribirLocal(clave: string, texto: string | null) {
  try {
    if (texto === null) window.localStorage.removeItem(clave)
    else window.localStorage.setItem(clave, texto)
  } catch {
    // Sin lugar o bloqueado: no hay borrador, la carga sigue igual.
  }
}

function fmtFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** "jueves 15/10" en hora argentina, para decir con qué fecha se envía. */
function fmtHoy(d: Date): string {
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(d)
  const parte = (t: string) => partes.find((x) => x.type === t)?.value ?? ""
  return `${parte("weekday")} ${parte("day")}/${parte("month")}`
}

export default function StockPorSalonPage() {
  const { state } = useStore()
  const { perfilActivo } = useProfile()
  const { toast } = useToast()
  const sectores = sectoresPermitidos(perfilActivo?.id)

  const [paso, setPaso] = useState<Paso>("salon")
  const [salon, setSalon] = useState("")
  const [sector, setSector] = useState<SectorStock | null>(null)
  const [estados, setEstados] = useState<Partial<Record<SectorStock, EstadoSector>>>({})
  const [cargandoEstado, setCargandoEstado] = useState(false)

  const [nombre, setNombre] = useState("")
  const [sesion, setSesion] = useState<{ id: string; iniciadaEn: string } | null>(null)
  // Lo escrito en cada casillero: insumoId → texto. Vacío = no contado.
  const [valores, setValores] = useState<Record<string, string>>({})
  const [busqueda, setBusqueda] = useState("")
  // Cocina: "Los que ya conté acá" (true) o "Todos" (false).
  const [soloContados, setSoloContados] = useState(false)
  const limpieza = useArticulosAparte(
    sectores.includes("limpieza"),
    "/api/insumos-limpieza",
    "No se pudieron traer los artículos de limpieza",
  )
  const vajilla = useArticulosAparte(
    sectores.includes("vajilla"),
    "/api/insumos-vajilla",
    "No se pudieron traer los artículos de vajilla y utensilios",
  )
  const aparte = sector === "limpieza" ? limpieza : sector === "vajilla" ? vajilla : null
  // Barra, limpieza y vajilla: categorías plegadas.
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set())
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // Historial de cargas del salón (de los sectores del perfil) y la que
  // está abierta en detalle.
  const [historial, setHistorial] = useState<CargaHistorial[]>([])
  const [cargaAbierta, setCargaAbierta] = useState<string | null>(null)
  const inputsRef = useRef<Map<string, HTMLInputElement>>(new Map())
  // Borrador en el celular de la carga en curso (clave por salón, sector y
  // tipo de carga). Mientras se ofrece uno viejo ("¿Seguir con ese
  // conteo?") no se guarda nada, para no pisarlo antes de que elijan.
  const [claveBorrador, setClaveBorrador] = useState<string | null>(null)
  const [borradorOfrecido, setBorradorOfrecido] = useState<BorradorStock | null>(null)
  // Copia solo para el texto del diálogo: así no queda vacío durante la
  // animación de cierre (borradorOfrecido ya pasó a null).
  const [borradorTexto, setBorradorTexto] = useState<BorradorStock | null>(null)

  const cargarEstados = useCallback(
    async (salonElegido: string) => {
      setCargandoEstado(true)
      try {
        const resultados = await Promise.all(
          sectores.map(async (s) => {
            const res = await fetch(`/api/stock-salones/estado?salon=${encodeURIComponent(salonElegido)}&sector=${s}`)
            const data = await res.json().catch(() => ({}))
            return [s, data?.ok ? { saldos: data.saldos || {} } : null] as const
          }),
        )
        const nuevo: Partial<Record<SectorStock, EstadoSector>> = {}
        for (const [s, e] of resultados) if (e) nuevo[s] = e
        setEstados(nuevo)
        // El historial es aparte: si falla, la carga sigue andando igual.
        const listas = await Promise.all(
          sectores.map(async (s) => {
            try {
              const res = await fetch(`/api/stock-salones/sesiones?salon=${encodeURIComponent(salonElegido)}&sector=${s}`)
              const data = await res.json().catch(() => ({}))
              const filas: Array<Omit<CargaHistorial, "sector">> = data?.ok ? data.sesiones || [] : []
              return filas.map((f) => ({ ...f, sector: s }))
            } catch {
              return []
            }
          }),
        )
        setHistorial(listas.flat().sort((a, b) => b.fecha.localeCompare(a.fecha)))
      } finally {
        setCargandoEstado(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sectores.join(",")],
  )

  const { items: itemsValidos, invalidos } = useMemo(() => itemsParaEnviar(valores), [valores])
  const hayAlgoEscrito = Object.values(valores).some((v) => v.trim())

  // Aviso al cerrar/recargar la pestaña con una carga sin confirmar.
  useEffect(() => {
    if (paso !== "carga" || !hayAlgoEscrito) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [paso, hayAlgoEscrito])

  // Al abrir la pantalla se borran los borradores vencidos (más de 3 días)
  // o rotos, también los de eventos a los que no se vuelve a entrar.
  useEffect(() => {
    try {
      const entradas: Array<[string, string | null]> = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k) entradas.push([k, window.localStorage.getItem(k)])
      }
      for (const k of clavesBorradorStockVencidas(entradas, new Date())) escribirLocal(k, null)
    } catch {
      // Sin acceso al almacenamiento: no hay nada que limpiar.
    }
  }, [])

  // Guarda lo escrito en el celular a medida que se tipea. Si se borra todo,
  // se borra el borrador. Nunca se manda nada al servidor desde acá.
  useEffect(() => {
    if (paso !== "carga" || !claveBorrador || borradorOfrecido) return
    escribirLocal(claveBorrador, armarBorradorStock(valores, new Date()))
  }, [paso, claveBorrador, borradorOfrecido, valores])

  const catalogo: InsumoCarga[] = useMemo(() => {
    if (sector === "cocina") return (state.insumos || []).map((i) => ({ id: i.id, descripcion: i.descripcion, unidad: i.unidad }))
    if (sector === "barra")
      return (state.insumosBarra || []).map((i) => ({ id: i.id, descripcion: i.descripcion, unidad: i.unidad, categoria: i.categoria }))
    if (sector === "limpieza") return limpieza.articulos || []
    if (sector === "vajilla") return vajilla.articulos || []
    return []
  }, [sector, state.insumos, state.insumosBarra, limpieza.articulos, vajilla.articulos])

  const saldos = (sector && estados[sector]?.saldos) || {}
  const contados = useMemo(() => new Set(Object.keys(saldos)), [saldos])

  const visibles = useMemo(
    () => insumosVisibles(catalogo, { busqueda, soloContados: sector === "cocina" && soloContados, contados, valores }),
    [catalogo, busqueda, soloContados, sector, contados, valores],
  )

  // Barra, limpieza y vajilla: secciones por categoría (Otros al final).
  const grupos = useMemo(() => {
    if (sector === "cocina" || !sector) return [{ clave: "", items: visibles }]
    const m = new Map<string, InsumoCarga[]>()
    for (const i of visibles) {
      const c = i.categoria || "Otros"
      if (!m.has(c)) m.set(c, [])
      m.get(c)!.push(i)
    }
    return [...m.entries()]
      .sort(([a], [b]) => (a === "Otros" ? 1 : b === "Otros" ? -1 : a.localeCompare(b, "es")))
      .map(([clave, items]) => ({ clave, items }))
  }, [sector, visibles])

  if (sectores.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Este perfil no carga stock por salón.</p>
      </div>
    )
  }

  // ── Paso 1: elegir salón ────────────────────────────────────────────────
  if (paso === "salon") {
    return (
      <SalonSelectorOverlay
        titulo="Stock por salón"
        sinTodos
        onSelect={(s) => {
          setSalon(s)
          setPaso("menu")
          cargarEstados(s)
        }}
      />
    )
  }

  const empezarCarga = (s: SectorStock) => {
    setSector(s)
    setNombre((prev) => prev || usuarioActivo())
    setSesion({ id: crypto.randomUUID(), iniciadaEn: new Date().toISOString() })
    setValores({})
    setBusqueda("")
    setPlegadas(new Set())
    // Cocina: si el salón ya tiene conteos, arranca mostrando solo esos; si
    // no, "Todos" (si no, la lista aparecería vacía).
    setSoloContados(Object.keys(estados[s]?.saldos || {}).length > 0)
    // Borrador: uno por salón y sector.
    const clave = claveBorradorStock(salon, s, null)
    const previo = leerBorradorStock(leerLocal(clave), new Date())
    if (!previo) escribirLocal(clave, null) // vencido o roto: se descarta solo
    setClaveBorrador(clave)
    setBorradorOfrecido(previo)
    if (previo) setBorradorTexto(previo)
    setPaso("carga")
  }

  /** "Seguir con ese conteo": vuelve a poner lo escrito en los casilleros. */
  const seguirConBorrador = () => {
    if (!borradorOfrecido) return
    // Sin catálogo cargado no se filtra (mejor no perder lo escrito).
    setValores(
      catalogo.length > 0
        ? valoresDelCatalogo(borradorOfrecido.valores, catalogo.map((i) => i.id))
        : borradorOfrecido.valores,
    )
    setBorradorOfrecido(null)
  }

  /** "Empezar de nuevo": se descarta el borrador y la lista arranca vacía. */
  const descartarBorrador = () => {
    if (claveBorrador) escribirLocal(claveBorrador, null)
    setValores({})
    setBorradorOfrecido(null)
  }

  const salirDeCarga = () => {
    // Salir descarta lo escrito (con confirmación si había algo) o la carga
    // se guardó bien: en los dos casos se borra el borrador. Si todavía se
    // estaba ofreciendo uno viejo y no se eligió nada, se deja como estaba.
    if (claveBorrador && !borradorOfrecido) escribirLocal(claveBorrador, null)
    setClaveBorrador(null)
    setBorradorOfrecido(null)
    setValores({})
    setSesion(null)
    setPaso("menu")
  }

  const confirmarSesion = async () => {
    if (!sesion || !sector || itemsValidos.length === 0 || invalidos.length > 0 || !nombre.trim() || guardando) return
    setGuardando(true)
    try {
      const res = await fetch("/api/stock-salones/sesiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sesionId: sesion.id,
          salon,
          sector,
          cargadoPor: nombre.trim(),
          iniciadaEn: sesion.iniciadaEn,
          // SOLO lo que tiene un número escrito (vacío = no contado).
          items: itemsValidos,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        // Lo escrito queda intacto y el mismo sesionId permite reintentar sin duplicar.
        toast({
          title: "No se envió el stock",
          description: data?.error || "Revisá la conexión y volvé a intentar. No se guardó nada.",
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Stock enviado",
        description: `${itemsValidos.length} ${itemsValidos.length === 1 ? "insumo" : "insumos"} de ${SECTOR_LABEL[sector]} en ${salonLabel(salon)}.`,
      })
      setConfirmando(false)
      salirDeCarga()
      cargarEstados(salon)
    } catch {
      toast({
        title: "No se envió el stock",
        description: "Se cortó la conexión. Lo que escribiste sigue acá: volvé a intentar.",
        variant: "destructive",
      })
    } finally {
      setGuardando(false)
    }
  }

  // Enter → siguiente casillero visible (carga rápida sin tocar la pantalla).
  const irAlSiguiente = (insumoId: string) => {
    const orden = grupos.filter((g) => !plegadas.has(g.clave)).flatMap((g) => g.items.map((i) => i.id))
    const idx = orden.indexOf(insumoId)
    const siguiente = idx >= 0 ? orden[idx + 1] : undefined
    if (siguiente) inputsRef.current.get(siguiente)?.focus()
    else inputsRef.current.get(insumoId)?.blur()
  }

  const encabezado = (
    <div className="flex items-center gap-3">
      {paso === "menu" ? (
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Volver a elegir salón" onClick={() => setPaso("salon")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      ) : hayAlgoEscrito ? (
        <ConfirmAction
          title="¿Salir sin guardar?"
          description="Se descarta lo que escribiste. No se guarda nada."
          confirmLabel="Sí, salir"
          destructive
          onConfirm={salirDeCarga}
        >
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Volver" disabled={guardando}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </ConfirmAction>
      ) : (
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Volver" onClick={salirDeCarga}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <SalonDot salon={salon} size={10} />
          {salonLabel(salon)}
        </h1>
        <p className="text-xs text-muted-foreground">
          {paso === "carga" && sector ? `Stock de ${SECTOR_LABEL[sector]} · ${fmtHoy(new Date())}` : "Stock por salón"}
        </p>
      </div>
    </div>
  )

  // ── Paso 2: menú del salón ──────────────────────────────────────────────
  // Un botón por sector para contar el stock (en cualquier momento) y,
  // debajo, el historial de cargas de este salón. Tocar una carga abre su
  // detalle (antes → ahora de cada insumo).
  if (paso === "menu") {
    return (
      <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
        {encabezado}

        <div className="space-y-3">
          {sectores.map((s) => {
            const Icon = SECTOR_ICON[s]
            const sufijo = sectores.length > 1 ? ` de ${SECTOR_LABEL[s]}` : ""
            return (
              <button
                key={s}
                type="button"
                onClick={() => empezarCarga(s)}
                disabled={cargandoEstado}
                className="block w-full text-left disabled:opacity-60"
              >
                <Card className="border-emerald-400 transition-colors hover:border-emerald-600 hover:bg-emerald-50/50">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Icon className="h-6 w-6 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">Contar stock{sufijo}</p>
                      <p className="text-xs text-muted-foreground">
                        Se envía con la fecha de hoy ({fmtHoy(new Date())}) y queda en el historial
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-emerald-600" />
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Historial de cargas en este salón
          </p>
          {cargandoEstado ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando cargas...
            </p>
          ) : historial.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay cargas en este salón.</p>
          ) : (
            <div className="divide-y rounded-lg border bg-card">
              {historial.map((h) => {
                const Icon = SECTOR_ICON[h.sector]
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setCargaAbierta(h.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
                  >
                    <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {fmtFechaHora(h.fecha)} · {h.cargadoPor}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        {sectores.length > 1 && <Icon className="h-3 w-3" />}
                        {h.cantidadItems} {h.cantidadItems === 1 ? "insumo" : "insumos"}
                        {sectores.length > 1 ? ` de ${SECTOR_LABEL[h.sector]}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            El stock de cada insumo en este salón es lo último que se contó.
          </p>
        </div>

        <StockSesionDetalleDialog sesionId={cargaAbierta} onClose={() => setCargaAbierta(null)} />
      </div>
    )
  }

  // ── Paso 3: carga (lista completa con casillero) ────────────────────────
  const hayConteosPrevios = contados.size > 0
  return (
    <div className="mx-auto max-w-2xl p-4 pb-0 sm:p-6 sm:pb-0">
      <div className="space-y-4 pb-4">
        {encabezado}

        <p className="text-xs text-muted-foreground">
          Escribí cuánto quedó de cada insumo que contaste. Lo que dejes vacío no se guarda (no es cero). Si contaste y no
          queda nada, escribí 0.
        </p>

        {/* Buscador: SOLO filtra la lista visible, no agrega nada. */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Filtrar insumos..."
            className="pl-9"
            aria-label="Filtrar insumos"
          />
        </div>

        {/* Cocina (sin categorías): "Los que ya conté acá" / "Todos". */}
        {sector === "cocina" && (
          <div className="inline-flex rounded-lg border p-1" role="group" aria-label="Qué insumos mostrar">
            {[
              { v: true, label: "Los que ya conté acá", disabled: !hayConteosPrevios },
              { v: false, label: "Todos", disabled: false },
            ].map((op) => (
              <button
                key={op.label}
                type="button"
                disabled={op.disabled}
                onClick={() => setSoloContados(op.v)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                  soloContados === op.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>
        )}

        {visibles.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {aparte?.error
              ? aparte.error
              : aparte && aparte.articulos === null
                ? "Cargando artículos..."
                : sector === "limpieza" && catalogo.length === 0
                  ? "Todavía no hay artículos de limpieza. Se agregan en Insumos Limpieza (Mantenimiento: Artículos de limpieza)."
                  : sector === "vajilla" && catalogo.length === 0
                    ? "Todavía no hay artículos de vajilla y utensilios. Se agregan en Vajilla y utensilios."
                    : "No hay insumos que coincidan."}
          </p>
        ) : (
          <div className="space-y-3">
            {grupos.map((g) => {
              const plegada = !!g.clave && plegadas.has(g.clave) && !busqueda.trim()
              const escritosEnGrupo = g.items.filter((i) => (valores[i.id] || "").trim()).length
              return (
                <div key={g.clave || "todos"}>
                  {g.clave ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPlegadas((prev) => {
                          const n = new Set(prev)
                          if (n.has(g.clave)) n.delete(g.clave)
                          else n.add(g.clave)
                          return n
                        })
                      }
                      className="mb-1.5 flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm font-semibold"
                      aria-expanded={!plegada}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${plegada ? "-rotate-90" : ""}`} />
                      {g.clave}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({g.items.length}
                        {escritosEnGrupo > 0 ? ` · ${escritosEnGrupo} cargados` : ""})
                      </span>
                    </button>
                  ) : null}
                  {!plegada && (
                    <div className="divide-y rounded-lg border bg-card">
                      {g.items.map((it) => {
                        const previo = saldos[it.id]
                        const texto = valores[it.id] || ""
                        const invalido = invalidos.includes(it.id)
                        return (
                          <div key={it.id} className="flex items-center gap-3 px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{it.descripcion}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {previo
                                  ? `antes: ${fmtCantidad(previo.cantidad)} (${previo.actualizadoPor || "sin nombre"}, ${fmtFechaHora(previo.actualizadoEn)})`
                                  : "—"}
                              </p>
                            </div>
                            <Input
                              ref={(el) => {
                                if (el) inputsRef.current.set(it.id, el)
                                else inputsRef.current.delete(it.id)
                              }}
                              inputMode="decimal"
                              enterKeyHint="next"
                              value={texto}
                              onChange={(e) => setValores((prev) => ({ ...prev, [it.id]: e.target.value }))}
                              onFocus={(e) => {
                                // Que el teclado del celular no tape el casillero en uso.
                                const el = e.currentTarget
                                setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  irAlSiguiente(it.id)
                                }
                              }}
                              className={`h-10 w-24 shrink-0 text-right ${invalido ? "border-red-500 focus-visible:ring-red-500" : texto.trim() ? "border-emerald-500" : ""}`}
                              aria-label={`Cantidad de ${it.descripcion} en ${it.unidad}`}
                              aria-invalid={invalido}
                            />
                            <span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">{it.unidad}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Barra de confirmación fija abajo, siempre visible. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            {invalidos.length > 0 ? (
              <span className="font-medium text-red-600">
                Revisá {invalidos.length} {invalidos.length === 1 ? "cantidad" : "cantidades"} (en rojo)
              </span>
            ) : (
              <>
                <span className="font-semibold">{itemsValidos.length}</span>{" "}
                {itemsValidos.length === 1 ? "insumo cargado" : "insumos cargados"}
              </>
            )}
          </p>
          <Button disabled={itemsValidos.length === 0 || invalidos.length > 0 || guardando} onClick={() => setConfirmando(true)}>
            <Send className="h-4 w-4" />
            Enviar stock contado
          </Button>
        </div>
      </div>

      {/* Conteo sin confirmar guardado en este celular para esta misma carga.
          Cerrar el diálogo sin elegir equivale a seguir (no se pierde nada). */}
      <Dialog open={borradorOfrecido !== null} onOpenChange={(o) => !o && seguirConBorrador()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-sky-600" />
              Conteo sin confirmar
            </DialogTitle>
            <DialogDescription>
              Tenés un conteo sin confirmar del {borradorTexto ? fmtFechaHora(borradorTexto.guardadoEn) : ""} (
              {borradorTexto ? Object.keys(borradorTexto.valores).length : 0}{" "}
              {borradorTexto && Object.keys(borradorTexto.valores).length === 1 ? "insumo escrito" : "insumos escritos"}
              ). Todavía no se guardó.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={descartarBorrador}>
              Empezar de nuevo
            </Button>
            <Button onClick={seguirConBorrador}>Seguir con ese conteo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo final: resumen + nombre de quien carga (obligatorio). */}
      <Dialog open={confirmando} onOpenChange={(o) => !guardando && setConfirmando(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Enviar el stock contado?</DialogTitle>
            <DialogDescription>
              Se envían con fecha de hoy ({fmtHoy(new Date())}) {itemsValidos.length} {itemsValidos.length === 1 ? "insumo" : "insumos"} de{" "}
              {sector ? SECTOR_LABEL[sector] : ""} en {salonLabel(salon)}. Lo que escribiste reemplaza lo que había contado
              en este salón y actualiza el stock de Administración.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nombre-carga">¿Quién hace la carga?</Label>
            <Input
              id="nombre-carga"
              value={nombre}
              maxLength={60}
              placeholder="Tu nombre"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmarSesion()
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmando(false)} disabled={guardando}>
              Seguir cargando
            </Button>
            <Button onClick={confirmarSesion} disabled={!nombre.trim() || guardando}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {guardando ? "Enviando..." : "Sí, enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

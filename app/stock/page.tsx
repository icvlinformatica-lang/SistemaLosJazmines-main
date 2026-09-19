"use client"

// Stock por salón — pantalla de carga del conteo físico de insumos que
// quedaron en un salón al terminar un evento. La usan Cocina (solo insumos
// de cocina), Barra (solo insumos de barra) y Administración/Soporte (los
// dos). El servidor vuelve a controlar el perfil real al guardar.
//
// Pasos: elegir salón → menú (Calendario actual / Carga de insumos, con el
// aviso de evento terminado) → nombre de quien carga → carga.
// La sesión se confirma TODA junta (ver /api/stock-salones/sesiones): nada
// se guarda insumo por insumo. Esto NO toca el stock global (stock_actual)
// de /admin/almacen ni /admin/barra.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import { useProfile, usuarioActivo } from "@/lib/profile-context"
import { salonLabel } from "@/lib/store"
import { sectoresPermitidos, type SectorStock } from "@/lib/stock-salones"
import { SalonSelectorOverlay } from "@/components/salon-selector-overlay"
import { SalonDot } from "@/components/salon-badge"
import { ConfirmAction } from "@/components/confirm-action"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Loader2,
  PartyPopper,
  Plus,
  Search,
  Trash2,
  Wine,
} from "lucide-react"

type Paso = "salon" | "menu" | "nombre" | "carga"

interface SaldoSalon {
  cantidad: number
  actualizadoPor: string | null
  actualizadoEn: string
}

interface EstadoSector {
  eventoPendiente: { id: string; nombre: string; fin: string } | null
  saldos: Record<string, SaldoSalon>
}

interface ItemCarga {
  insumoId: string
  descripcion: string
  unidad: string
  cantidad: string
}

const SECTOR_LABEL: Record<SectorStock, string> = { cocina: "cocina", barra: "barra" }
const SECTOR_ICON: Record<SectorStock, typeof ChefHat> = { cocina: ChefHat, barra: Wine }

function fmtCantidad(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n)
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

/** Acepta coma o punto decimal. NaN si no es un número válido >= 0. */
function parseCantidad(v: string): number {
  const t = v.trim().replace(",", ".")
  if (!t) return Number.NaN
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN
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
  const [items, setItems] = useState<ItemCarga[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [guardando, setGuardando] = useState(false)
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({})

  const cargarEstados = useCallback(
    async (salonElegido: string) => {
      setCargandoEstado(true)
      try {
        const resultados = await Promise.all(
          sectores.map(async (s) => {
            const res = await fetch(`/api/stock-salones/estado?salon=${encodeURIComponent(salonElegido)}&sector=${s}`)
            const data = await res.json().catch(() => ({}))
            return [s, data?.ok ? { eventoPendiente: data.eventoPendiente, saldos: data.saldos || {} } : null] as const
          }),
        )
        const nuevo: Partial<Record<SectorStock, EstadoSector>> = {}
        for (const [s, e] of resultados) if (e) nuevo[s] = e
        setEstados(nuevo)
      } finally {
        setCargandoEstado(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sectores.join(",")],
  )

  // Aviso al cerrar/recargar la pestaña con una carga sin confirmar.
  useEffect(() => {
    if (paso !== "carga" || items.length === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [paso, items.length])

  const catalogo = useMemo(() => {
    if (sector === "cocina") return (state.insumos || []).map((i) => ({ id: i.id, descripcion: i.descripcion, unidad: i.unidad }))
    if (sector === "barra") return (state.insumosBarra || []).map((i) => ({ id: i.id, descripcion: i.descripcion, unidad: i.unidad }))
    return []
  }, [sector, state.insumos, state.insumosBarra])

  const resultadosBusqueda = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return []
    const yaAgregados = new Set(items.map((i) => i.insumoId))
    return catalogo
      .filter((c) => !yaAgregados.has(c.id) && c.descripcion.toLowerCase().includes(q))
      .slice(0, 12)
  }, [busqueda, catalogo, items])

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

  const estadoSector = sector ? estados[sector] : undefined
  const saldos = estadoSector?.saldos || {}

  const empezarCarga = (s: SectorStock) => {
    setSector(s)
    setNombre((prev) => prev || usuarioActivo())
    setPaso("nombre")
  }

  const confirmarNombre = () => {
    if (!nombre.trim()) return
    setSesion({ id: crypto.randomUUID(), iniciadaEn: new Date().toISOString() })
    setItems([])
    setBusqueda("")
    setPaso("carga")
  }

  const agregarItem = (c: { id: string; descripcion: string; unidad: string }) => {
    setItems((prev) => [...prev, { insumoId: c.id, descripcion: c.descripcion, unidad: c.unidad, cantidad: "" }])
    setBusqueda("")
    // Llevar el foco directo al campo de cantidad del insumo recién agregado.
    setTimeout(() => inputsRef.current[c.id]?.focus(), 50)
  }

  const itemsInvalidos = items.filter((i) => Number.isNaN(parseCantidad(i.cantidad)))
  const puedeConfirmar = items.length > 0 && itemsInvalidos.length === 0 && !guardando

  const confirmarSesion = async () => {
    if (!sesion || !sector || !puedeConfirmar) return
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
          eventoId: estadoSector?.eventoPendiente?.id || null,
          iniciadaEn: sesion.iniciadaEn,
          items: items.map((i) => ({ insumoId: i.insumoId, cantidad: parseCantidad(i.cantidad) })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        // La lista queda intacta y el mismo sesionId permite reintentar sin duplicar.
        toast({
          title: "No se guardó la carga",
          description: data?.error || "Revisá la conexión y volvé a intentar. No se guardó nada.",
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Carga guardada",
        description: `${items.length} ${items.length === 1 ? "insumo" : "insumos"} de ${SECTOR_LABEL[sector]} en ${salonLabel(salon)}.`,
      })
      setItems([])
      setSesion(null)
      setPaso("menu")
      cargarEstados(salon)
    } catch {
      toast({
        title: "No se guardó la carga",
        description: "Se cortó la conexión. Tu lista sigue acá: volvé a intentar.",
        variant: "destructive",
      })
    } finally {
      setGuardando(false)
    }
  }

  const encabezado = (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label="Volver"
        onClick={() => {
          if (paso === "menu") setPaso("salon")
          else if (paso === "nombre") setPaso("menu")
        }}
        disabled={paso === "carga"}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <SalonDot salon={salon} size={10} />
          {salonLabel(salon)}
        </h1>
        <p className="text-xs text-muted-foreground">Stock por salón</p>
      </div>
    </div>
  )

  // ── Paso 2: menú del salón ──────────────────────────────────────────────
  if (paso === "menu") {
    return (
      <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
        {encabezado}

        {cargandoEstado ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando eventos terminados...
          </p>
        ) : (
          sectores.map((s) => {
            const pendiente = estados[s]?.eventoPendiente
            return pendiente ? (
              <div key={s} className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
                <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <p className="text-sm text-emerald-900">
                  El evento de <span className="font-semibold">{pendiente.nombre}</span> ya terminó — podés cargar el
                  stock de {SECTOR_LABEL[s]} de {salonLabel(salon)}.
                </p>
              </div>
            ) : null
          })
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href={`/eventos/produccion?salon=${encodeURIComponent(salon)}`} className="block">
            <Card className="h-full transition-colors hover:border-foreground/40">
              <CardContent className="flex items-center gap-3 p-4">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">Calendario actual</p>
                  <p className="text-xs text-muted-foreground">Próximos eventos de este salón</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {sectores.map((s) => {
            const Icon = SECTOR_ICON[s]
            const conAviso = !!estados[s]?.eventoPendiente
            return (
              <button key={s} type="button" onClick={() => empezarCarga(s)} className="block text-left">
                <Card className={`h-full transition-colors hover:border-foreground/40 ${conAviso ? "border-emerald-400" : ""}`}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Icon className={`h-5 w-5 ${conAviso ? "text-emerald-600" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-semibold">
                        Carga de insumos{sectores.length > 1 ? ` · ${SECTOR_LABEL[s]}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">Contar lo que quedó en {salonLabel(salon)}</p>
                    </div>
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Paso 3: nombre de quien carga ───────────────────────────────────────
  if (paso === "nombre") {
    return (
      <div className="mx-auto max-w-md space-y-5 p-4 sm:p-6">
        {encabezado}
        <Card>
          <CardContent className="space-y-3 p-4">
            <Label htmlFor="nombre-carga">¿Quién hace la carga?</Label>
            <Input
              id="nombre-carga"
              autoFocus
              value={nombre}
              maxLength={60}
              placeholder="Tu nombre"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmarNombre()
              }}
            />
            <Button className="w-full" disabled={!nombre.trim()} onClick={confirmarNombre}>
              Empezar carga de {sector ? SECTOR_LABEL[sector] : ""}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Paso 4: carga de insumos ────────────────────────────────────────────
  const Icono = sector ? SECTOR_ICON[sector] : ClipboardList
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      {encabezado}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5 font-semibold">
          <Icono className="h-4 w-4" /> Carga de {sector ? SECTOR_LABEL[sector] : ""}
        </span>
        <span className="text-muted-foreground">· carga {nombre.trim()}</span>
      </div>

      {/* Buscador sobre el catálogo del sector (nunca se mezclan cocina y barra) */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={`Buscar insumo de ${sector ? SECTOR_LABEL[sector] : ""}...`}
          className="pl-9"
          aria-label="Buscar insumo"
        />
        {resultadosBusqueda.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
            {resultadosBusqueda.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => agregarItem(c)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="truncate">{c.descripcion}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {c.unidad}
                  <Plus className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
        )}
        {busqueda.trim() && resultadosBusqueda.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">No hay insumos que coincidan (o ya están en la lista).</p>
        )}
      </div>

      {/* Lista de la sesión */}
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Buscá un insumo y agregalo para cargar cuánto quedó.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const previo = saldos[it.insumoId]
            const invalido = it.cantidad.trim() !== "" && Number.isNaN(parseCantidad(it.cantidad))
            return (
              <div key={it.insumoId} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.descripcion}</p>
                  <p className="text-xs text-muted-foreground">
                    {previo
                      ? `Antes: ${fmtCantidad(previo.cantidad)} ${it.unidad} (${previo.actualizadoPor || "sin nombre"}, ${fmtFechaHora(previo.actualizadoEn)})`
                      : "Primera vez que se cuenta en este salón"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Input
                    ref={(el) => {
                      inputsRef.current[it.insumoId] = el
                    }}
                    inputMode="decimal"
                    value={it.cantidad}
                    onChange={(e) =>
                      setItems((prev) => prev.map((p) => (p.insumoId === it.insumoId ? { ...p, cantidad: e.target.value } : p)))
                    }
                    placeholder="0"
                    className={`h-9 w-24 text-right ${invalido ? "border-red-500" : ""}`}
                    aria-label={`Cantidad de ${it.descripcion} en ${it.unidad}`}
                  />
                  <span className="w-8 text-xs font-medium text-muted-foreground">{it.unidad}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                    aria-label={`Sacar ${it.descripcion} de la lista`}
                    onClick={() => setItems((prev) => prev.filter((p) => p.insumoId !== it.insumoId))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
        {items.length > 0 ? (
          <ConfirmAction
            title="¿Salir sin guardar?"
            description="Se descarta la lista cargada. No se guarda nada."
            confirmLabel="Sí, salir"
            destructive
            onConfirm={() => {
              setItems([])
              setSesion(null)
              setPaso("menu")
            }}
          >
            <Button variant="outline" disabled={guardando}>Cancelar</Button>
          </ConfirmAction>
        ) : (
          <Button variant="outline" onClick={() => setPaso("menu")}>
            Cancelar
          </Button>
        )}

        <ConfirmAction
          title="¿Confirmar la carga?"
          description={`Se guardan ${items.length} ${items.length === 1 ? "insumo" : "insumos"} de ${sector ? SECTOR_LABEL[sector] : ""} en ${salonLabel(salon)}, a nombre de ${nombre.trim()}.`}
          confirmLabel="Sí, guardar"
          onConfirm={confirmarSesion}
        >
          <Button disabled={!puedeConfirmar}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {guardando
              ? "Guardando..."
              : itemsInvalidos.length > 0 && items.length > 0
                ? `Faltan cantidades (${itemsInvalidos.length})`
                : `Confirmar carga (${items.length})`}
          </Button>
        </ConfirmAction>
      </div>
    </div>
  )
}

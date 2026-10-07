"use client"

// Stock por salón — pantalla de carga del conteo físico de insumos que
// quedaron en un salón al terminar un evento. La usan Cocina (solo insumos
// de cocina), Barra (solo insumos de barra) y Administración/Soporte (los
// dos), de madrugada y desde el celular. El servidor vuelve a controlar el
// perfil real al guardar.
//
// Flujo: elegir salón → menú ("Cargar stock disponible luego del evento X"
// si hay uno terminado sin cargar, el botón "Carga extraordinaria" con PIN y
// los próximos 3 eventos del salón con candado) → carga. Sin
// acceso al calendario desde acá. La carga muestra TODOS los insumos del
// sector con su casillero: se escribe el número y listo (1 paso por
// insumo). Al confirmar se envían SOLO los que tienen un número escrito
// (ver itemsParaEnviar en lib/stock-carga.ts): vacío = no contado, nunca 0.
// El nombre de quien carga se pide en el diálogo de confirmación.
// La sesión se confirma TODA junta (ver /api/stock-salones/sesiones). Al
// guardar, el stock de Administración (stock_actual de /admin/almacen y
// /admin/barra) pasa a ser la suma de lo contado en cada salón.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useStore } from "@/lib/store-context"
import { useProfile, usuarioActivo } from "@/lib/profile-context"
import { salonLabel } from "@/lib/store"
import { proximosEventosDelSalon, sectoresPermitidos, type SectorStock } from "@/lib/stock-salones"
import { insumosVisibles, itemsParaEnviar, type InsumoCarga } from "@/lib/stock-carga"
import { SalonSelectorOverlay } from "@/components/salon-selector-overlay"
import { SalonDot } from "@/components/salon-badge"
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
import { ArrowLeft, ChefHat, ChevronDown, KeyRound, Loader2, Lock, PartyPopper, Search, Wine } from "lucide-react"

type Paso = "salon" | "menu" | "carga"

interface SaldoSalon {
  cantidad: number
  actualizadoPor: string | null
  actualizadoEn: string
}

interface EstadoSector {
  eventoPendiente: { id: string; nombre: string; fin: string } | null
  saldos: Record<string, SaldoSalon>
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

/** "sáb 03/10 · 21:00" a partir de la fecha (YYYY-MM-DD) y el horario del evento. */
function fmtFechaEvento(fecha: string | null, horario: string | null): string {
  if (!fecha) return ""
  const dia = new Date(`${fecha}T12:00:00-03:00`).toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })
  return horario ? `${dia} · ${horario}` : dia
}

export default function StockPorSalonPage() {
  const { state, eventos } = useStore()
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
  // Barra: categorías plegadas.
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set())
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // Carga extraordinaria: la de un salón sin evento terminado pendiente.
  // Pide PIN_STOCK_EXTRA antes de abrir la lista. El PIN queda en memoria
  // durante la carga porque el servidor lo vuelve a pedir al guardar (la
  // pantalla sola no habilita nada).
  const [pidiendoPin, setPidiendoPin] = useState<SectorStock | null>(null)
  const [pinTipeado, setPinTipeado] = useState("")
  const [pinError, setPinError] = useState("")
  const [verificandoPin, setVerificandoPin] = useState(false)
  const [pinExtra, setPinExtra] = useState("")
  const inputsRef = useRef<Map<string, HTMLInputElement>>(new Map())

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

  const catalogo: InsumoCarga[] = useMemo(() => {
    if (sector === "cocina") return (state.insumos || []).map((i) => ({ id: i.id, descripcion: i.descripcion, unidad: i.unidad }))
    if (sector === "barra")
      return (state.insumosBarra || []).map((i) => ({ id: i.id, descripcion: i.descripcion, unidad: i.unidad, categoria: i.categoria }))
    return []
  }, [sector, state.insumos, state.insumosBarra])

  const saldos = (sector && estados[sector]?.saldos) || {}
  const contados = useMemo(() => new Set(Object.keys(saldos)), [saldos])

  const visibles = useMemo(
    () => insumosVisibles(catalogo, { busqueda, soloContados: sector === "cocina" && soloContados, contados, valores }),
    [catalogo, busqueda, soloContados, sector, contados, valores],
  )

  // Barra: secciones por categoría (Otros al final).
  const grupos = useMemo(() => {
    if (sector !== "barra") return [{ clave: "", items: visibles }]
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

  const estadoSector = sector ? estados[sector] : undefined

  const empezarCarga = (s: SectorStock, pin = "") => {
    setPinExtra(pin)
    setSector(s)
    setNombre((prev) => prev || usuarioActivo())
    setSesion({ id: crypto.randomUUID(), iniciadaEn: new Date().toISOString() })
    setValores({})
    setBusqueda("")
    setPlegadas(new Set())
    // Cocina: si el salón ya tiene conteos, arranca mostrando solo esos; si
    // no, "Todos" (si no, la lista aparecería vacía).
    setSoloContados(Object.keys(estados[s]?.saldos || {}).length > 0)
    setPaso("carga")
  }

  const salirDeCarga = () => {
    setValores({})
    setSesion(null)
    setPinExtra("")
    setPaso("menu")
  }

  /**
   * Botón "Carga extraordinaria" (fuera de un evento terminado). Pide el
   * PIN antes de abrir la lista; si el perfil carga los dos sectores, se
   * elige cuál adentro del diálogo.
   */
  const pedirExtraordinaria = (s: SectorStock) => {
    setPinTipeado("")
    setPinError("")
    setPidiendoPin(s)
  }

  const confirmarPin = async () => {
    if (!pidiendoPin || verificandoPin || !pinTipeado.trim()) return
    setVerificandoPin(true)
    setPinError("")
    try {
      const res = await fetch("/api/stock-salones/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinTipeado.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setPinError(data?.error === "PIN incorrecto" ? "El PIN no es correcto." : data?.error || "No se pudo verificar el PIN.")
        return
      }
      const sectorElegido = pidiendoPin
      setPidiendoPin(null)
      empezarCarga(sectorElegido, pinTipeado.trim())
      setPinTipeado("")
    } catch {
      setPinError("Se cortó la conexión. Volvé a intentar.")
    } finally {
      setVerificandoPin(false)
    }
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
          // El servidor decide solo si la carga es por evento o
          // extraordinaria; el PIN solo hace falta en el segundo caso.
          pin: pinExtra || undefined,
          iniciadaEn: sesion.iniciadaEn,
          // SOLO lo que tiene un número escrito (vacío = no contado).
          items: itemsValidos,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        // Lo escrito queda intacto y el mismo sesionId permite reintentar sin duplicar.
        toast({
          title: "No se guardó la carga",
          description: data?.error || "Revisá la conexión y volvé a intentar. No se guardó nada.",
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Carga guardada",
        description: `${itemsValidos.length} ${itemsValidos.length === 1 ? "insumo" : "insumos"} de ${SECTOR_LABEL[sector]} en ${salonLabel(salon)}.`,
      })
      setConfirmando(false)
      salirDeCarga()
      cargarEstados(salon)
    } catch {
      toast({
        title: "No se guardó la carga",
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
          {paso === "carga" && sector ? `Carga de ${SECTOR_LABEL[sector]}` : "Stock por salón"}
        </p>
      </div>
    </div>
  )

  // ── Paso 2: menú del salón ──────────────────────────────────────────────
  // Una tarjeta por sector: si hay un evento terminado sin cargar, se entra
  // derecho a contar; si no, queda deshabilitada. Debajo, los próximos 3
  // eventos del salón con candado (se habilitan solos cuando terminan). La
  // carga extraordinaria (con PIN) se abre desde su botón, debajo de las tarjetas.
  if (paso === "menu") {
    const proximos = proximosEventosDelSalon(
      eventos.map((e) => ({
        id: e.id,
        nombre: e.nombre || e.nombrePareja || "Evento",
        fecha: e.fecha,
        horario: e.horario ?? null,
        horarioFin: e.horarioFin ?? null,
        salon: e.salon ?? null,
        estado: e.estado ?? null,
      })),
      salon,
    )
    return (
      <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
        {encabezado}

        {cargandoEstado ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando eventos terminados...
          </p>
        ) : (
          <div className="space-y-3">
            {sectores.map((s) => {
              const Icon = SECTOR_ICON[s]
              const pendiente = estados[s]?.eventoPendiente
              const sufijo = sectores.length > 1 ? ` · ${SECTOR_LABEL[s]}` : ""
              return pendiente ? (
                <button key={s} type="button" onClick={() => empezarCarga(s)} className="block w-full text-left">
                  <Card className="border-emerald-400 transition-colors hover:border-emerald-600 hover:bg-emerald-50/50">
                    <CardContent className="flex items-center gap-3 p-4">
                      <Icon className="h-6 w-6 shrink-0 text-emerald-600" />
                      <div className="min-w-0">
                        <p className="font-semibold">
                          Cargar stock disponible luego del evento {pendiente.nombre}
                          {sufijo}
                        </p>
                        <p className="text-xs text-muted-foreground">Contá lo que quedó en {salonLabel(salon)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ) : (
                <Card key={s} className="border-dashed bg-muted/30">
                  <CardContent className="flex items-center gap-3 p-4 text-muted-foreground">
                    <Icon className="h-6 w-6 shrink-0" />
                    <p className="text-sm">
                      No hay ningún evento terminado para cargar{sufijo}.
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Carga extraordinaria: contar el stock cuando no hay un evento
            terminado (o cuando se quiere corregir un conteo). Pide el PIN. */}
        <button
          type="button"
          onClick={() => pedirExtraordinaria(sectores[0])}
          disabled={cargandoEstado}
          className="block w-full text-left disabled:opacity-50"
        >
          <Card className="border-amber-400 transition-colors hover:border-amber-600 hover:bg-amber-50/50">
            <CardContent className="flex items-center gap-3 p-4">
              <KeyRound className="h-6 w-6 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="font-semibold">Carga extraordinaria</p>
                <p className="text-xs text-muted-foreground">
                  Para contar el stock de {salonLabel(salon)} en cualquier momento. Pide PIN.
                </p>
              </div>
            </CardContent>
          </Card>
        </button>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximos eventos en este salón</p>
          {proximos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay eventos próximos cargados.</p>
          ) : (
            proximos.map(({ evento }) => (
              <div
                key={evento.id}
                className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3 text-muted-foreground"
                aria-disabled="true"
              >
                <Lock className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground/70">{evento.nombre}</p>
                  <p className="text-xs">{fmtFechaEvento(evento.fecha, evento.horario)}</p>
                </div>
              </div>
            ))
          )}
          {proximos.length > 0 && (
            <p className="text-xs text-muted-foreground">Se habilitan para cargar cuando termina cada evento.</p>
          )}
        </div>

        {/* Puerta de la carga extraordinaria. El PIN acá solo abre la lista:
            el servidor lo vuelve a pedir al guardar. */}
        <Dialog
          open={pidiendoPin !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPidiendoPin(null)
              setPinTipeado("")
              setPinError("")
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-600" />
                Carga extraordinaria
              </DialogTitle>
              <DialogDescription>
                Contar el stock de {salonLabel(salon)} sin esperar a que termine un evento. Hace falta el PIN.
              </DialogDescription>
            </DialogHeader>
            {sectores.length > 1 && (
              <div className="flex gap-2">
                {sectores.map((s) => {
                  const Icon = SECTOR_ICON[s]
                  return (
                    <Button
                      key={s}
                      type="button"
                      variant={pidiendoPin === s ? "default" : "outline"}
                      className="flex-1 gap-2 capitalize"
                      onClick={() => setPidiendoPin(s)}
                    >
                      <Icon className="h-4 w-4" />
                      {SECTOR_LABEL[s]}
                    </Button>
                  )
                })}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="pin-stock">PIN de carga extraordinaria</Label>
              <Input
                id="pin-stock"
                type="password"
                inputMode="numeric"
                autoFocus
                value={pinTipeado}
                onChange={(e) => {
                  setPinTipeado(e.target.value)
                  setPinError("")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmarPin()
                }}
                placeholder="PIN"
              />
              {pinError && <p className="text-sm text-destructive">{pinError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPidiendoPin(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmarPin} disabled={verificandoPin || !pinTipeado.trim()}>
                {verificandoPin ? "Verificando..." : "Empezar la carga"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ── Paso 3: carga (lista completa con casillero) ────────────────────────
  const hayConteosPrevios = contados.size > 0
  return (
    <div className="mx-auto max-w-2xl p-4 pb-0 sm:p-6 sm:pb-0">
      <div className="space-y-4 pb-4">
        {encabezado}

        {estadoSector?.eventoPendiente ? (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <PartyPopper className="h-4 w-4 shrink-0 text-emerald-700" />
            Después del evento de {estadoSector.eventoPendiente.nombre}
          </p>
        ) : (
          <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            <KeyRound className="h-4 w-4 shrink-0 text-amber-700" />
            Carga extraordinaria — este salón no tiene ningún evento pendiente de carga.
          </p>
        )}

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
            No hay insumos que coincidan.
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
            Confirmar carga
          </Button>
        </div>
      </div>

      {/* Diálogo final: resumen + nombre de quien carga (obligatorio). */}
      <Dialog open={confirmando} onOpenChange={(o) => !guardando && setConfirmando(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Confirmar la carga?</DialogTitle>
            <DialogDescription>
              Se guardan {itemsValidos.length} {itemsValidos.length === 1 ? "insumo" : "insumos"} de{" "}
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
              {guardando ? "Guardando..." : "Sí, guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

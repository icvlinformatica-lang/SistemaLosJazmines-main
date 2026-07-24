"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import {
  type AppState,
  type Insumo,
  type InsumoBarra,
  type Receta,
  type Coctel,
  type BarraTemplate,
  type PaqueteSalon,
  type TemporadaPrecio,
  type PersonalEvento,
  type PagoPersonal,
  type Evento,
  type EventoGuardado,
  type EventoHistorial,
  type Servicio,
  type CostoOperativo,
  type PreciosVentaMap,
  type ConfiguracionCajas,
  type MovimientoCaja,
  type GastoArchivado,
  type Vendedor,
  type HistorialIPCEntry,
  loadState,
  saveState,
  generateId,
  generarPagosPendientesAutomaticos,
  actualizarEstadoPagos,
  sincronizarPagosConAsignaciones,
  migrarServiciosAPreciosDinamicos,
  obtenerPreciosServicio,
  actualizarCuotasIPC,
  revertirCuotasIPC,
  generateNextCodigo,
  RECETA_CODIGO_PREFIX,
} from "./store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useClock } from "@/lib/clock-context"
import { fetchWithRetry } from "@/lib/fetch-with-retry"

interface StoreContextType {
  state: AppState
  loading: boolean
  insumos: Insumo[]
  insumosBarra: InsumoBarra[]
  recetas: Receta[]
  cocteles: Coctel[]
  barrasTemplates: BarraTemplate[]
  eventos: EventoGuardado[]
  historial: EventoHistorial[]
  servicios: Servicio[]
  costosOperativos: CostoOperativo[]
  preciosVenta: PreciosVentaMap
  // Insumos
  addInsumo: (insumo: Omit<Insumo, "id">) => void
  updateInsumo: (id: string, insumo: Partial<Insumo>) => void
  deleteInsumo: (id: string) => void
  setInsumos: (insumos: Insumo[]) => void
  // Insumos Barra
  addInsumoBarra: (insumo: Omit<InsumoBarra, "id">) => void
  updateInsumoBarra: (id: string, insumo: Partial<InsumoBarra>) => void
  deleteInsumoBarra: (id: string) => void
  setInsumosBarra: (insumos: InsumoBarra[]) => void
  // Recetas
  addReceta: (receta: Omit<Receta, "id">) => void
  updateReceta: (id: string, receta: Partial<Receta>) => void
  deleteReceta: (id: string) => void
  setRecetas: (recetas: Receta[]) => void
  // Cocteles
  addCoctel: (coctel: Omit<Coctel, "id">) => Promise<Coctel | undefined>
  updateCoctel: (id: string, coctel: Partial<Coctel>) => void
  deleteCoctel: (id: string) => void
  setCocteles: (cocteles: Coctel[]) => void
  // Barras Templates
  addBarraTemplate: (template: Omit<BarraTemplate, "id">) => void
  updateBarraTemplate: (id: string, template: Partial<BarraTemplate>) => void
  deleteBarraTemplate: (id: string) => void
  // Evento
  setEventoActual: (evento: Evento | null) => void
  updateEventoActual: (updates: Partial<Evento>) => void
  // Eventos (calendario)
  addEvento: (evento: EventoGuardado) => void
  updateEvento: (id: string, updates: Partial<EventoGuardado>) => void
  deleteEvento: (id: string) => void
  setEventos: (eventos: EventoGuardado[]) => void
  // Servicios
  addServicio: (servicio: Omit<Servicio, "id">) => void
  updateServicio: (id: string, updates: Partial<Servicio>) => void
  deleteServicio: (id: string) => void
  setServicios: (servicios: Servicio[]) => void
  // Costos Operativos
  addCostoOperativo: (costo: Omit<CostoOperativo, "id">) => void
  updateCostoOperativo: (id: string, updates: Partial<CostoOperativo>) => void
  deleteCostoOperativo: (id: string) => void
  // Precios Venta
  setPrecioVenta: (salon: string, fecha: string, precio: number) => void
  deletePrecioVenta: (salon: string, fecha: string) => void
  setPreciosVenta: (preciosVenta: PreciosVentaMap) => void
  // Historial
  addEventoHistorial: (entry: EventoHistorial) => void
  deleteEventoHistorial: (id: string) => void
  clearHistorial: () => void
  // Paquetes de Salones
  paquetesSalones: PaqueteSalon[]
  addPaqueteSalon: (paquete: Omit<PaqueteSalon, "id">) => void
  updatePaqueteSalon: (id: string, updates: Partial<PaqueteSalon>) => void
  deletePaqueteSalon: (id: string) => void

  // Temporadas
  temporadas: TemporadaPrecio[]
  addTemporada: (temporada: Omit<TemporadaPrecio, "id">) => void
  updateTemporada: (id: string, updates: Partial<TemporadaPrecio>) => void
  deleteTemporada: (id: string) => void

  // Personal
  personal: PersonalEvento[]
  addPersonal: (personal: Omit<PersonalEvento, "id">) => void
  updatePersonal: (id: string, updates: Partial<PersonalEvento>) => void
  deletePersonal: (id: string) => void
  getPersonalByServicio: (servicioId: string) => PersonalEvento[]

  // Pagos Personal
  pagosPersonal: PagoPersonal[]
  addPagoPersonal: (pago: Omit<PagoPersonal, "id">) => void
  updatePagoPersonal: (id: string, updates: Partial<PagoPersonal>) => void
  deletePagoPersonal: (id: string) => void
  getPagosPorEvento: (eventoId: string) => PagoPersonal[]
  getPagosPendientes: () => PagoPersonal[]
  generarPagosPendientes: () => void
  sincronizarPagos: () => { pagosCreados: number; pagosObsoletos: number }

  // Cajas
  configuracionCajas: ConfiguracionCajas
  movimientosCaja: MovimientoCaja[]
  updateConfiguracionCajas: (config: ConfiguracionCajas) => void
  addMovimientoCaja: (movimiento: MovimientoCaja) => void
  addMovimientosCaja: (movimientos: MovimientoCaja[]) => void
  deleteMovimientoCaja: (id: string) => void

  // Archivo de gastos
  gastosArchivados: GastoArchivado[]
  archivarGasto: (gasto: Omit<GastoArchivado, "id">) => void
  desarchivarGasto: (id: string) => void

  // Vendedores (equipo comercial)
  vendedores: Vendedor[]
  updateVendedor: (id: string, updates: Partial<Vendedor>) => void

  // IPC
  historialIPC: HistorialIPCEntry[]
  ultimoMesIPC: { mes: number; anio: number } | null
  aplicarIPC: (porcentaje: number, mes: number, anio: number) => number
  eliminarIPC: (entry: HistorialIPCEntry) => number
  abrirDialogIPC: () => void
}

const StoreContext = createContext<StoreContextType | null>(null)

const MESES_IPC = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

/**
 * Calcula el próximo mes a cargar de IPC de forma secuencial: es el mes siguiente
 * al último aplicado (el más reciente por mes/año en el historial). Si el historial
 * está vacío, arranca en el mes/año actual.
 */
function calcularProximoMesIPC(
  historial: HistorialIPCEntry[],
  fallbackMes: number,
  fallbackAnio: number,
): { mes: number; anio: number } {
  if (!historial || historial.length === 0) {
    return { mes: fallbackMes, anio: fallbackAnio }
  }
  const ultimo = historial.reduce((max, h) => {
    const orden = h.anio * 12 + h.mes
    return orden > max ? orden : max
  }, -Infinity)
  const siguiente = ultimo + 1
  return { mes: ((siguiente % 12) + 12) % 12, anio: Math.floor(siguiente / 12) }
}

// Prefijos de métodos que mutan/persisten datos. En modo lectura se neutralizan.
const MUTATOR_RE = /^(add|update|delete|set|archivar|desarchivar|aplicar|generar|sincronizar|clear)/
// Excepciones: setters efímeros del flujo de planificación (no persisten hasta "addEvento").
const KEEP_ACTIVE = new Set(["setEventoActual", "updateEventoActual"])

/**
 * En modo solo-lectura (viaje en el tiempo) reemplaza todos los mutadores del
 * store por no-ops que avisan al usuario, dejando intactos getters y setters
 * efímeros. Así se puede navegar y recalcular sin riesgo de tocar datos reales.
 */
function aplicarSoloLectura<T extends Record<string, any>>(
  value: T,
  soloLectura: boolean,
  aviso: () => void,
): T {
  if (!soloLectura) return value
  const out: Record<string, any> = { ...value }
  for (const key of Object.keys(out)) {
    if (typeof out[key] === "function" && MUTATOR_RE.test(key) && !KEEP_ACTIVE.has(key)) {
      out[key] = () => aviso()
    }
  }
  return out as T
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState())
  const [isHydrated, setIsHydrated] = useState(false)
  const [showIPCDialog, setShowIPCDialog] = useState(false)
  const [porcentajeIPC, setPorcentajeIPC] = useState("")
  const [mesIPC, setMesIPC] = useState<number>(new Date().getMonth())
  const [anioIPC, setAnioIPC] = useState<number>(new Date().getFullYear())
  const { toast } = useToast()
  const { soloLectura } = useClock()

  useEffect(() => {
    const initializeData = async () => {
      const fetchSafe = async (url: string) => {
        try {
          const r = await fetchWithRetry(url)
          if (!r.ok) return null
          const data = await r.json()
          return Array.isArray(data) ? data : null
        } catch {
          return null
        }
      }

      // Fetch all DB modules in parallel — incluye eventos
      const [insumosRes, insumosBarraRes, recetasRes, coctelesRes, barraTemplatesRes, eventosRes] = await Promise.all([
        fetchSafe("/api/insumos"),
        fetchSafe("/api/insumos-barra"),
        fetchSafe("/api/recetas"),
        fetchSafe("/api/cocteles"),
        fetchSafe("/api/barra-templates"),
        fetchSafe("/api/eventos"),
      ])

      // Load localStorage for non-DB modules only (servicios, personal, etc.)
      const localState = loadState()

      // Fetch from Supabase for servicios, personal, eventos, pagos, costos
      let supabaseData: any = {}
      try {
        const db = await import("./supabase/data-service")
        // Eventos se excluyen de Supabase — usan su propia API de Postgres con soft delete / papelera
        const [serviciosDB, personalDB, pagosDB, costosDB, asignacionesDB, movimientosDB, configDB, preciosDB, archivadosDB, historialIPCDB, paquetesDB, temporadasDB, vendedoresDB] = await Promise.all([
          db.fetchServicios(),
          db.fetchPersonal(),
          db.fetchPagosPersonal(),
          db.fetchCostosOperativos(),
          db.fetchAsignaciones(),
          db.fetchMovimientosCaja(),
          db.fetchConfiguracionCajas(),
          db.fetchPreciosVenta(),
          db.fetchGastosArchivados(),
          db.fetchHistorialIPC(),
          db.fetchPaquetesSalones(),
          db.fetchTemporadas(),
          db.fetchVendedores(),
        ])

        // Migración one-time: si Supabase devuelve vacío pero localStorage tiene precios, upsertearlos ahora
        const preciosLocal = localState.preciosVenta || {}
        const hayPreciosLocales = Object.keys(preciosLocal).length > 0
        const hayPreciosDB = Object.keys(preciosDB).length > 0
        if (!hayPreciosDB && hayPreciosLocales) {
          for (const salon of Object.keys(preciosLocal)) {
            for (const fecha of Object.keys(preciosLocal[salon])) {
              await db.upsertPrecioVenta(salon, fecha, preciosLocal[salon][fecha])
            }
          }
        }

        // Migración one-time de paquetes de salones y temporadas:
        // si Supabase está vacío pero quedaron datos en localStorage, subirlos ahora.
        let paquetesMigrados = paquetesDB
        const paquetesLocales = (localState.paquetesSalones || []).filter((p) => p && p.id)
        if (paquetesDB.length === 0 && paquetesLocales.length > 0) {
          await Promise.all(paquetesLocales.map((p) => db.upsertPaqueteSalon(p)))
          paquetesMigrados = paquetesLocales
        }
        let temporadasMigradas = temporadasDB
        const temporadasLocales = (localState.temporadas || []).filter((t) => t && t.id)
        if (temporadasDB.length === 0 && temporadasLocales.length > 0) {
          await Promise.all(temporadasLocales.map((t) => db.upsertTemporada(t)))
          temporadasMigradas = temporadasLocales
        }

        // Migración one-time de costos operativos (gastos fijos y variables):
        // si Supabase está vacío pero quedaron costos en localStorage, subirlos a la base.
        // A partir de ahí Supabase es la única fuente de verdad (no más localStorage/seed).
        let costosMigrados = costosDB
        const costosLocales = (localState.costosOperativos || []).filter((c) => c && c.id)
        if (costosDB.length === 0 && costosLocales.length > 0) {
          const subidos = await Promise.all(costosLocales.map((c) => db.upsertCostoOperativo(c)))
          costosMigrados = subidos.filter((c): c is NonNullable<typeof c> => c != null)
        }

        // Migración one-time del resto de módulos financieros: si Supabase está
        // vacío pero localStorage tiene datos, subirlos AHORA para que la base
        // sea la única fuente de verdad (nunca más solo-localStorage).
        let movimientosMigrados = movimientosDB
        const movimientosLocales = (localState.movimientosCaja || []).filter((m) => m && m.id)
        if (movimientosDB.length === 0 && movimientosLocales.length > 0) {
          await Promise.all(movimientosLocales.map((m) => db.insertMovimientoCaja(m)))
          movimientosMigrados = movimientosLocales
        }
        let pagosMigrados = pagosDB
        const pagosLocales = (localState.pagosPersonal || []).filter((p) => p && p.id)
        if (pagosDB.length === 0 && pagosLocales.length > 0) {
          await Promise.all(pagosLocales.map((p) => db.upsertPagoPersonal(p)))
          pagosMigrados = pagosLocales
        }
        let serviciosMigrados = serviciosDB
        const serviciosLocales = (localState.servicios || []).filter((s) => s && s.id)
        if (serviciosDB.length === 0 && serviciosLocales.length > 0) {
          await Promise.all(serviciosLocales.map((s) => db.upsertServicio(s)))
          serviciosMigrados = serviciosLocales
        }
        let personalMigrado = personalDB
        const personalLocal = (localState.personal || []).filter((p) => p && p.id)
        if (personalDB.length === 0 && personalLocal.length > 0) {
          await Promise.all(personalLocal.map((p) => db.upsertPersonal(p)))
          personalMigrado = personalLocal
        }
        let archivadosMigrados = archivadosDB
        const archivadosLocales = (localState.gastosArchivados || []).filter((g) => g && g.id)
        if (archivadosDB.length === 0 && archivadosLocales.length > 0) {
          await Promise.all(archivadosLocales.map((g) => db.insertGastoArchivado(g)))
          archivadosMigrados = archivadosLocales
        }
        // Configuración de cajas: si la base no tiene config pero local sí, subirla
        let configMigrada = configDB
        if (Object.keys(configDB).length <= 1 && localState.configuracionCajas) {
          await db.upsertConfiguracionCajas(localState.configuracionCajas)
          configMigrada = localState.configuracionCajas
        }

        supabaseData = {
          servicios: serviciosMigrados,
          personal: personalMigrado,
          pagosPersonal: pagosMigrados,
          // Costos: SOLO Supabase (ya migrados arriba). Nunca caer al seed local.
          costosOperativos: costosMigrados,
          asignaciones: asignacionesDB.length > 0 ? asignacionesDB : localState.asignaciones,
          movimientosCaja: movimientosMigrados,
          configuracionCajas: configMigrada,
          preciosVenta: hayPreciosDB ? preciosDB : preciosLocal,
          gastosArchivados: archivadosMigrados,
          historialIPC: historialIPCDB,
          paquetesSalones: paquetesMigrados,
          temporadas: temporadasMigradas,
          vendedores: vendedoresDB,
        }
      } catch (error) {
        console.error("[v0] Error loading from Supabase, using localStorage:", error)
        toast({ title: "Error al cargar datos", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
        supabaseData = {
          servicios: localState.servicios,
          personal: localState.personal,
          pagosPersonal: localState.pagosPersonal,
          // Costos operativos viven solo en Supabase; sin conexión no mostramos datos stale.
          costosOperativos: [],
          asignaciones: localState.asignaciones,
          movimientosCaja: localState.movimientosCaja,
          configuracionCajas: localState.configuracionCajas,
          gastosArchivados: localState.gastosArchivados || [],
        }
      }

      // Merge: DB data takes absolute priority over localStorage for migrated modules
      const eventosVigentes = eventosRes ?? localState.eventos ?? []
      const idsEventosVigentes = new Set(eventosVigentes.map((e: EventoGuardado) => e.id))
      // Auto-sanear: descartar movimientos de caja cuyo evento asociado ya no existe
      // (evita ingresos/egresos fantasma de eventos eliminados que quedaron en localStorage)
      const movimientosSaneados = (supabaseData.movimientosCaja || []).filter(
        (m: MovimientoCaja) => !m.eventoId || idsEventosVigentes.has(m.eventoId)
      )

      // Historial IPC desde Supabase (undefined si falló la conexión, para caer a localStorage)
      const historialIPCDesdeDB: HistorialIPCEntry[] | undefined = Array.isArray(supabaseData.historialIPC)
        ? supabaseData.historialIPC
        : undefined
      const ultimoMesDesdeDB = (historialIPCDesdeDB && historialIPCDesdeDB.length > 0)
        ? [...historialIPCDesdeDB].sort((a, b) =>
            new Date(b.fechaAplicacion).getTime() - new Date(a.fechaAplicacion).getTime()
          )[0]
        : undefined
      const ultimoMesIPCVal = ultimoMesDesdeDB
        ? { mes: ultimoMesDesdeDB.mes, anio: ultimoMesDesdeDB.anio }
        : undefined

      setState({
        ...localState,
        insumos: insumosRes ?? localState.insumos,
        insumosBarra: insumosBarraRes ?? localState.insumosBarra,
        recetas: recetasRes ?? localState.recetas,
        cocteles: coctelesRes ?? localState.cocteles,
        barrasTemplates: barraTemplatesRes ?? localState.barrasTemplates,
        // Eventos — solo desde la API de Postgres (tiene soft delete y papelera)
        eventos: eventosRes ?? localState.eventos,
        // Supabase data (servicios, personal, pagos, costos)
        servicios: supabaseData.servicios,
        personal: supabaseData.personal,
        pagosPersonal: supabaseData.pagosPersonal,
        costosOperativos: supabaseData.costosOperativos,
        asignaciones: supabaseData.asignaciones,
        movimientosCaja: movimientosSaneados,
        configuracionCajas: supabaseData.configuracionCajas,
        preciosVenta: supabaseData.preciosVenta ?? localState.preciosVenta ?? {},
        gastosArchivados: supabaseData.gastosArchivados ?? localState.gastosArchivados ?? [],
        paquetesSalones: supabaseData.paquetesSalones ?? localState.paquetesSalones ?? [],
        temporadas: supabaseData.temporadas ?? localState.temporadas ?? [],
        // Vendedores: fuente de verdad = Supabase; si la tabla está vacía o falló, usar defaults
        vendedores: (Array.isArray(supabaseData.vendedores) && supabaseData.vendedores.length > 0)
          ? supabaseData.vendedores
          : (localState.vendedores ?? []),
        // Historial IPC: fuente de verdad = Supabase (compartido entre dispositivos).
        // ultimoMesIPC se deriva de la entrada más reciente para no re-aplicar el mismo mes.
        historialIPC: historialIPCDesdeDB ?? localState.historialIPC ?? [],
        ultimoMesIPC: ultimoMesIPCVal ?? localState.ultimoMesIPC,
      })

      setIsHydrated(true)
    }

    initializeData()
  }, [])

  useEffect(() => {
    if (isHydrated) {
      // Supabase es la ÚNICA fuente de verdad para todos los datos del negocio.
      // En localStorage solo queda estado efímero de UI (eventoActual, historial de
      // cálculos). Todos los módulos de datos se vacían para no dejar información
      // financiera ni de clientes en el navegador.
      saveState({
        ...state,
        insumos: [],
        insumosBarra: [],
        recetas: [],
        cocteles: [],
        barrasTemplates: [],
        eventos: [],
        costosOperativos: [],
        servicios: [],
        personal: [],
        pagosPersonal: [],
        asignaciones: [],
        movimientosCaja: [],
        gastosArchivados: [],
        historialIPC: [],
        preciosVenta: {},
        paquetesSalones: [],
        temporadas: [],
        // Config de cajas (saldos iniciales) también vive solo en Supabase;
        // al omitirla, loadState() usa el default hasta que la DB la hidrate.
        configuracionCajas: undefined as never,
      })
    }
  }, [state, isHydrated])

  // === Insumos (Cocina) - Synced with API ===
  const addInsumo = async (insumo: Omit<Insumo, "id">) => {
    try {
      // Código automático (INS001, INS002, ...) si no se proporcionó uno
      const codigo = insumo.codigo?.trim() || generateNextCodigo(state.insumos.map((i) => i.codigo), "INS")
      const res = await fetchWithRetry("/api/insumos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...insumo, codigo }),
      })
      if (res.ok) {
        const newInsumo = await res.json()
        setState((prev) => ({
          ...prev,
          insumos: [...prev.insumos, newInsumo],
        }))
      }
    } catch (error) {
      console.error("[v0] Error adding insumo:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const updateInsumo = async (id: string, updates: Partial<Insumo>) => {
    try {
      const res = await fetchWithRetry(`/api/insumos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const updated = await res.json()
        setState((prev) => ({
          ...prev,
          insumos: prev.insumos.map((i) => (i.id === id ? updated : i)),
        }))
      }
    } catch (error) {
      console.error("[v0] Error updating insumo:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const deleteInsumo = async (id: string) => {
    try {
      const res = await fetchWithRetry(`/api/insumos/${id}`, { method: "DELETE" })
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          insumos: prev.insumos.filter((i) => i.id !== id),
        }))
      }
    } catch (error) {
      console.error("[v0] Error deleting insumo:", error)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const setInsumos = (insumos: Insumo[]) => {
    setState((prev) => ({ ...prev, insumos }))
  }

  // === Insumos Barra - Synced with API ===
  const addInsumoBarra = async (insumo: Omit<InsumoBarra, "id">) => {
    try {
      // Código automático (BAR001, BAR002, ...) si no se proporcionó uno
      const codigo = insumo.codigo?.trim() || generateNextCodigo(state.insumosBarra.map((i) => i.codigo), "BAR")
      const res = await fetchWithRetry("/api/insumos-barra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...insumo, codigo }),
      })
      if (res.ok) {
        const newInsumo = await res.json()
        setState((prev) => ({
          ...prev,
          insumosBarra: [...prev.insumosBarra, newInsumo],
        }))
      }
    } catch (error) {
      console.error("[v0] Error adding insumo barra:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const updateInsumoBarra = async (id: string, updates: Partial<InsumoBarra>) => {
    try {
      const res = await fetchWithRetry(`/api/insumos-barra/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const updated = await res.json()
        setState((prev) => ({
          ...prev,
          insumosBarra: prev.insumosBarra.map((i) => (i.id === id ? updated : i)),
        }))
      }
    } catch (error) {
      console.error("[v0] Error updating insumo barra:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const deleteInsumoBarra = async (id: string) => {
    try {
      const res = await fetchWithRetry(`/api/insumos-barra/${id}`, { method: "DELETE" })
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          insumosBarra: prev.insumosBarra.filter((i) => i.id !== id),
        }))
      }
    } catch (error) {
      console.error("[v0] Error deleting insumo barra:", error)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const setInsumosBarra = (insumosBarra: InsumoBarra[]) => {
    setState((prev) => ({ ...prev, insumosBarra }))
  }

  // === Recetas - Synced with API ===
  const addReceta = async (receta: Omit<Receta, "id">) => {
    try {
      // Código automático por categoría (P001, E001, R001, ...) si no se proporcionó uno
      const prefix = RECETA_CODIGO_PREFIX[receta.categoria] || "REC"
      const codigo = receta.codigo?.trim() || generateNextCodigo(state.recetas.map((r) => r.codigo), prefix)
      const res = await fetchWithRetry("/api/recetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...receta, codigo }),
      })
      if (res.ok) {
        const newReceta = await res.json()
        setState((prev) => ({
          ...prev,
          recetas: [...prev.recetas, newReceta],
        }))
        return newReceta
      }
    } catch (error) {
      console.error("[v0] Error adding receta:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const updateReceta = async (id: string, updates: Partial<Receta>) => {
    try {
      const res = await fetchWithRetry(`/api/recetas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const updated = await res.json()
        setState((prev) => ({
          ...prev,
          recetas: prev.recetas.map((r) => (r.id === id ? updated : r)),
        }))
      }
    } catch (error) {
      console.error("[v0] Error updating receta:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const deleteReceta = async (id: string) => {
    try {
      const res = await fetchWithRetry(`/api/recetas/${id}`, { method: "DELETE" })
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          recetas: prev.recetas.filter((r) => r.id !== id),
        }))
      }
    } catch (error) {
      console.error("[v0] Error deleting receta:", error)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const setRecetas = (recetas: Receta[]) => {
    setState((prev) => ({ ...prev, recetas }))
  }

  // === Cocteles - Synced with API ===
  const addCoctel = async (coctel: Omit<Coctel, "id">) => {
    try {
      // Código automático (COC001, COC002, ...) si no se proporcionó uno
      const codigo = coctel.codigo?.trim() || generateNextCodigo(state.cocteles.map((c) => c.codigo), "COC")
      const res = await fetchWithRetry("/api/cocteles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...coctel, codigo }),
      })
      if (res.ok) {
        const newCoctel = await res.json()
        setState((prev) => ({
          ...prev,
          cocteles: [...prev.cocteles, newCoctel],
        }))
        return newCoctel
      }
    } catch (error) {
      console.error("[v0] Error adding coctel:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const updateCoctel = async (id: string, updates: Partial<Coctel>) => {
    try {
      const res = await fetchWithRetry(`/api/cocteles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const updated = await res.json()
        setState((prev) => ({
          ...prev,
          cocteles: prev.cocteles.map((c) => (c.id === id ? updated : c)),
        }))
      }
    } catch (error) {
      console.error("[v0] Error updating coctel:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const deleteCoctel = async (id: string) => {
    try {
      const res = await fetchWithRetry(`/api/cocteles/${id}`, { method: "DELETE" })
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          cocteles: prev.cocteles.filter((c) => c.id !== id),
        }))
      }
    } catch (error) {
      console.error("[v0] Error deleting coctel:", error)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const setCocteles = (cocteles: Coctel[]) => {
    setState((prev) => ({ ...prev, cocteles }))
  }

  // === Barras Templates - Synced with API ===
  const addBarraTemplate = async (template: Omit<BarraTemplate, "id">) => {
    try {
      const res = await fetchWithRetry("/api/barra-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      })
      if (res.ok) {
        const newTemplate = await res.json()
        setState((prev) => ({
          ...prev,
          barrasTemplates: [...(prev.barrasTemplates || []), newTemplate],
        }))
      }
    } catch (error) {
      console.error("[v0] Error adding barra template:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const updateBarraTemplate = async (id: string, updates: Partial<BarraTemplate>) => {
    try {
      const res = await fetchWithRetry(`/api/barra-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const updated = await res.json()
        setState((prev) => ({
          ...prev,
          barrasTemplates: (prev.barrasTemplates || []).map((t) => (t.id === id ? updated : t)),
        }))
      }
    } catch (error) {
      console.error("[v0] Error updating barra template:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const deleteBarraTemplate = async (id: string) => {
    try {
      const res = await fetchWithRetry(`/api/barra-templates/${id}`, { method: "DELETE" })
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          barrasTemplates: (prev.barrasTemplates || []).filter((t) => t.id !== id),
        }))
      }
    } catch (error) {
      console.error("[v0] Error deleting barra template:", error)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  // === Servicios - Synced with Supabase ===
  const addServicio = async (servicio: Omit<Servicio, "id">) => {
    const newServicio = { ...servicio, id: generateId() }
    setState((prev) => ({
      ...prev,
      servicios: [...(prev.servicios || []), newServicio],
    }))
    // Sync to Supabase
    try {
      const { upsertServicio } = await import("./supabase/data-service")
      await upsertServicio(newServicio)
    } catch (error) {
      console.error("[v0] Error syncing servicio to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const updateServicio = async (id: string, updates: Partial<Servicio>) => {
    // Capturar el servicio YA MERGEADO dentro del setState para no usar estado
    // viejo del closure: si el usuario hace dos ediciones seguidas (ej. costo y
    // después % de seña), la segunda persistía sobre una base desactualizada y
    // pisaba la primera en Supabase (el precio "volvía" al valor anterior).
    let merged: Servicio | undefined
    setState((prev) => {
      const servicios = (prev.servicios || []).map((s) => {
        if (s.id !== id) return s
        merged = { ...s, ...updates }
        return merged
      })
      return { ...prev, servicios }
    })
    // Sync to Supabase con el registro completo ya actualizado
    try {
      if (merged) {
        const { upsertServicio } = await import("./supabase/data-service")
        await upsertServicio(merged)
      }
    } catch (error) {
      console.error("[v0] Error syncing servicio update to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const deleteServicio = async (id: string) => {
    setState((prev) => ({
      ...prev,
      servicios: (prev.servicios || []).filter((s) => s.id !== id),
    }))
    // Sync to Supabase
    try {
      const { deleteServicio: deleteServ } = await import("./supabase/data-service")
      await deleteServ(id)
    } catch (error) {
      console.error("[v0] Error deleting servicio from Supabase:", error)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const setServicios = (servicios: Servicio[]) => {
    setState((prev) => ({ ...prev, servicios }))
  }

  // === Costos Operativos - Synced with Supabase ===
  const addCostoOperativo = async (costo: Omit<CostoOperativo, "id">) => {
    const newCosto = { ...costo, id: generateId() }
    setState((prev) => ({
      ...prev,
      costosOperativos: [...(prev.costosOperativos || []), newCosto],
    }))
    // Sync to Supabase
    try {
      const { upsertCostoOperativo } = await import("./supabase/data-service")
      await upsertCostoOperativo(newCosto)
    } catch (error) {
      console.error("[v0] Error syncing costo operativo to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const updateCostoOperativo = async (id: string, updates: Partial<CostoOperativo>) => {
    setState((prev) => ({
      ...prev,
      costosOperativos: (prev.costosOperativos || []).map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }))
    // Sync to Supabase
    try {
      const existing = state.costosOperativos?.find(c => c.id === id)
      if (existing) {
        const { upsertCostoOperativo } = await import("./supabase/data-service")
        await upsertCostoOperativo({ ...existing, ...updates })
      }
    } catch (error) {
      console.error("[v0] Error syncing costo operativo update to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const deleteCostoOperativo = async (id: string) => {
    setState((prev) => ({
      ...prev,
      costosOperativos: (prev.costosOperativos || []).filter((c) => c.id !== id),
    }))
    // Sync to Supabase
    try {
      const { deleteCostoOperativo: deleteCosto } = await import("./supabase/data-service")
      await deleteCosto(id)
    } catch (error) {
      console.error("[v0] Error deleting costo operativo from Supabase:", error)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  // === Paquetes de Salones ===
  const addPaqueteSalon = async (paquete: Omit<PaqueteSalon, "id">) => {
    const nuevo = { ...paquete, id: generateId() } as PaqueteSalon
    setState((prev) => ({
      ...prev,
      paquetesSalones: [...(prev.paquetesSalones || []), nuevo],
    }))
    try {
      const { upsertPaqueteSalon } = await import("./supabase/data-service")
      await upsertPaqueteSalon(nuevo)
    } catch (error) {
      console.error("[v0] Error syncing paquete salon to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. El paquete no se guardó en la base; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const updatePaqueteSalon = async (id: string, updates: Partial<PaqueteSalon>) => {
    const existing = state.paquetesSalones?.find((p) => p.id === id)
    setState((prev) => ({
      ...prev,
      paquetesSalones: (prev.paquetesSalones || []).map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }))
    try {
      if (existing) {
        const { upsertPaqueteSalon } = await import("./supabase/data-service")
        await upsertPaqueteSalon({ ...existing, ...updates })
      }
    } catch (error) {
      console.error("[v0] Error syncing paquete salon update to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. El cambio no se guardó en la base; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const deletePaqueteSalon = async (id: string) => {
    setState((prev) => ({
      ...prev,
      paquetesSalones: (prev.paquetesSalones || []).filter((p) => p.id !== id),
    }))
    try {
      const { deletePaqueteSalon: deletePaq } = await import("./supabase/data-service")
      await deletePaq(id)
    } catch (error) {
      console.error("[v0] Error deleting paquete salon from Supabase:", error)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. El cambio no se guardó en la base; volvé a intentarlo.", variant: "destructive" })
    }
  }

  // === Temporadas - Synced with Supabase ===
  const addTemporada = async (temporada: Omit<TemporadaPrecio, "id">) => {
    const nueva = { ...temporada, id: generateId() } as TemporadaPrecio
    setState((prev) => ({
      ...prev,
      temporadas: [...(prev.temporadas || []), nueva],
    }))
    try {
      const { upsertTemporada } = await import("./supabase/data-service")
      await upsertTemporada(nueva)
    } catch (error) {
      console.error("[v0] Error syncing temporada to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. La temporada no se guardó en la base; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const updateTemporada = async (id: string, updates: Partial<TemporadaPrecio>) => {
    const existing = state.temporadas?.find((t) => t.id === id)
    setState((prev) => ({
      ...prev,
      temporadas: (prev.temporadas || []).map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }))
    try {
      if (existing) {
        const { upsertTemporada } = await import("./supabase/data-service")
        await upsertTemporada({ ...existing, ...updates })
      }
    } catch (error) {
      console.error("[v0] Error syncing temporada update to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. El cambio no se guardó en la base; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const deleteTemporada = async (id: string) => {
    setState((prev) => ({
      ...prev,
      temporadas: (prev.temporadas || []).filter((t) => t.id !== id),
    }))
    try {
      const { deleteTemporada: deleteTemp } = await import("./supabase/data-service")
      await deleteTemp(id)
    } catch (error) {
      console.error("[v0] Error deleting temporada from Supabase:", error)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. El cambio no se guardó en la base; volvé a intentarlo.", variant: "destructive" })
    }
  }

  // === Personal - Synced with Supabase ===
  const addPersonal = async (personal: Omit<PersonalEvento, "id">) => {
    const newPersonal = { ...personal, id: generateId() }
    setState((prev) => ({
      ...prev,
      personal: [...(prev.personal || []), newPersonal],
    }))
    // Sync to Supabase
    try {
      const { upsertPersonal } = await import("./supabase/data-service")
      await upsertPersonal(newPersonal)
    } catch (error) {
      console.error("[v0] Error syncing personal to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const updatePersonal = async (id: string, updates: Partial<PersonalEvento>) => {
    setState((prev) => ({
      ...prev,
      personal: (prev.personal || []).map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }))
    // Sync to Supabase
    try {
      const existing = state.personal?.find(p => p.id === id)
      if (existing) {
        const { upsertPersonal } = await import("./supabase/data-service")
        await upsertPersonal({ ...existing, ...updates })
      }
    } catch (error) {
      console.error("[v0] Error syncing personal update to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const deletePersonal = async (id: string) => {
    setState((prev) => ({
      ...prev,
      personal: (prev.personal || []).filter((p) => p.id !== id),
    }))
    // Sync to Supabase
    try {
      const { deletePersonal: deletePers } = await import("./supabase/data-service")
      await deletePers(id)
    } catch (error) {
      console.error("[v0] Error deleting personal from Supabase:", error)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const getPersonalByServicio = (servicioId: string): PersonalEvento[] => {
    return (state.personal || []).filter((p) => p.servicioVinculadoId === servicioId && p.activo)
  }

  // === Pagos Personal - Synced with Supabase ===
  const addPagoPersonal = async (pago: Omit<PagoPersonal, "id">) => {
    const newPago = { ...pago, id: generateId() }
    setState((prev) => ({
      ...prev,
      pagosPersonal: [...(prev.pagosPersonal || []), newPago],
    }))
    // Sync to Supabase
    try {
      const { upsertPagoPersonal } = await import("./supabase/data-service")
      await upsertPagoPersonal(newPago)
    } catch (error) {
      console.error("[v0] Error syncing pago personal to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const updatePagoPersonal = async (id: string, updates: Partial<PagoPersonal>) => {
    setState((prev) => ({
      ...prev,
      pagosPersonal: (prev.pagosPersonal || []).map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }))
    // Sync to Supabase
    try {
      const existing = state.pagosPersonal?.find(p => p.id === id)
      if (existing) {
        const { upsertPagoPersonal } = await import("./supabase/data-service")
        await upsertPagoPersonal({ ...existing, ...updates })
      }
    } catch (error) {
      console.error("[v0] Error syncing pago personal update to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const deletePagoPersonal = async (id: string) => {
    setState((prev) => ({
      ...prev,
      pagosPersonal: (prev.pagosPersonal || []).filter((p) => p.id !== id),
    }))
    // Sync to Supabase
    try {
      const { deletePagoPersonal: deletePago } = await import("./supabase/data-service")
      await deletePago(id)
    } catch (error) {
      console.error("[v0] Error deleting pago personal from Supabase:", error)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const getPagosPorEvento = (eventoId: string): PagoPersonal[] => {
    return (state.pagosPersonal || []).filter((p) => p.eventoId === eventoId)
  }

  const getPagosPendientes = (): PagoPersonal[] => {
    return (state.pagosPersonal || []).filter((p) => p.estado === "pendiente" || p.estado === "vencido")
  }

  const generarPagosPendientes = () => {
    setState((prev) => {
      const newState = { ...prev }
      generarPagosPendientesAutomaticos(newState)
      actualizarEstadoPagos(newState)
      return newState
    })
  }

  const sincronizarPagos = () => {
    let resultado = { pagosCreados: 0, pagosObsoletos: 0 }
    setState((prev) => {
      const newState = { ...prev }
      resultado = sincronizarPagosConAsignaciones(newState)
      return newState
    })
    return resultado
  }

  // Migrar datos legacy y auto-generar pagos pendientes al cargar
  useEffect(() => {
  if (isHydrated) {
    // Migrar servicios con precios fijos a margenGanancia dinámico
    setState((prev) => {
      const newState = { ...prev }
      migrarServiciosAPreciosDinamicos(newState)
      return newState
    })
    generarPagosPendientes()
  }
  }, [isHydrated])

  // === Eventos (Calendario) — Synced with Postgres API (soft delete / papelera) ===
  const addEvento = async (evento: EventoGuardado) => {
    // Optimistic: add locally first so UI responds immediately
    setState((prev) => ({ ...prev, eventos: [...(prev.eventos || []), evento] }))
    try {
      const res = await fetchWithRetry("/api/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evento),
      })
      if (res.ok) {
        const created = await res.json()
        // Replace optimistic entry with the confirmed server record
        setState((prev) => ({
          ...prev,
          eventos: prev.eventos.map((e) => (e.id === evento.id ? { ...e, ...created } : e)),
        }))
      }
    } catch (err) {
      console.error("[v0] Error adding evento:", err)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const updateEvento = async (id: string, updates: Partial<EventoGuardado>) => {
    // Optimistic update first
    setState((prev) => ({
      ...prev,
      eventos: (prev.eventos || []).map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }))
    try {
      await fetchWithRetry(`/api/eventos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
    } catch (err) {
      console.error("[v0] Error updating evento:", err)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const deleteEvento = async (id: string) => {
    // Optimistic: remove evento AND its caja movements from local state immediately
    setState((prev) => ({
      ...prev,
      eventos: (prev.eventos || []).filter((e) => e.id !== id),
      movimientosCaja: (prev.movimientosCaja || []).filter((m) => m.eventoId !== id),
    }))
    // API soft-deletes evento and moves to papelera; also purge its caja movements
    try {
      await fetchWithRetry(`/api/eventos/${id}`, { method: "DELETE" })
      const { deleteMovimientosByEvento } = await import("./supabase/data-service")
      await deleteMovimientosByEvento(id)
    } catch (err) {
      console.error("[v0] Error deleting evento:", err)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const setEventos = (nuevosEventos: EventoGuardado[]) => {
    setState((prev) => ({ ...prev, eventos: nuevosEventos }))
  }

  // === Evento ===
  const setEventoActual = (evento: Evento | null) => {
    setState((prev) => ({ ...prev, eventoActual: evento }))
  }

  const updateEventoActual = (updates: Partial<Evento>) => {
    setState((prev) => ({
      ...prev,
      eventoActual: prev.eventoActual ? { ...prev.eventoActual, ...updates } : null,
    }))
  }

  // === Historial ===
  const addEventoHistorial = (entry: EventoHistorial) => {
    setState((prev) => ({
      ...prev,
      historial: [...(prev.historial || []), entry],
    }))
  }

  const deleteEventoHistorial = (id: string) => {
    setState((prev) => ({
      ...prev,
      historial: (prev.historial || []).filter((h) => h.id !== id),
    }))
  }

  const clearHistorial = () => {
    setState((prev) => ({ ...prev, historial: [] }))
  }

  // === Precios Venta ===
  const setPrecioVenta = async (salon: string, fecha: string, precio: number) => {
    setState((prev) => {
      const current = { ...(prev.preciosVenta || {}) }
      if (!current[salon]) current[salon] = {}
      current[salon] = { ...current[salon], [fecha]: precio }
      return { ...prev, preciosVenta: current }
    })
    try {
      const { upsertPrecioVenta } = await import("./supabase/data-service")
      await upsertPrecioVenta(salon, fecha, precio)
    } catch (error) {
      console.error("[v0] Error syncing precioVenta:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el precio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const deletePrecioVenta = async (salon: string, fecha: string) => {
    setState((prev) => {
      const current = { ...(prev.preciosVenta || {}) }
      if (current[salon]) {
        const salonCopy = { ...current[salon] }
        delete salonCopy[fecha]
        current[salon] = salonCopy
      }
      return { ...prev, preciosVenta: current }
    })
    try {
      const { deletePrecioVenta: deleteDB } = await import("./supabase/data-service")
      await deleteDB(salon, fecha)
    } catch (error) {
      console.error("[v0] Error deleting precioVenta:", error)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. Reintentamos varias veces y no se pudo eliminar; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const setPreciosVenta = async (preciosVenta: PreciosVentaMap) => {
    setState((prev) => ({ ...prev, preciosVenta }))
    try {
      const { upsertPrecioVenta } = await import("./supabase/data-service")
      const entries: Array<[string, string, number]> = []
      for (const salon of Object.keys(preciosVenta)) {
        for (const fecha of Object.keys(preciosVenta[salon])) {
          entries.push([salon, fecha, preciosVenta[salon][fecha]])
        }
      }
      await Promise.all(entries.map(([s, f, p]) => upsertPrecioVenta(s, f, p)))
    } catch (error) {
      console.error("[v0] Error syncing preciosVenta bulk:", error)
      toast({ title: "Error al importar precios", description: "Revisá tu conexión a internet. Reintentamos varias veces y no se pudieron importar los precios; volvé a intentarlo.", variant: "destructive" })
    }
  }

  // === Cajas ===
  const updateConfiguracionCajas = async (config: ConfiguracionCajas) => {
    setState((prev) => ({ ...prev, configuracionCajas: config }))
    // Sync to Supabase
    try {
      const { upsertConfiguracionCajas } = await import("./supabase/data-service")
      await upsertConfiguracionCajas(config)
    } catch (error) {
      console.error("[v0] Error syncing configuracion cajas to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const addMovimientoCaja = async (movimiento: MovimientoCaja) => {
    setState((prev) => ({
      ...prev,
      movimientosCaja: [...(prev.movimientosCaja || []), movimiento],
    }))
    // Sync to Supabase
    try {
      const { insertMovimientoCaja } = await import("./supabase/data-service")
      await insertMovimientoCaja(movimiento)
    } catch (error) {
      console.error("[v0] Error syncing movimiento caja to Supabase:", error)
      toast({ title: "Error al guardar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const addMovimientosCaja = async (movimientos: MovimientoCaja[]) => {
    setState((prev) => ({
      ...prev,
      movimientosCaja: [...(prev.movimientosCaja || []), ...movimientos],
    }))
    // Sync to Supabase
    const insertados: string[] = []
    try {
      const { insertMovimientoCaja, deleteMovimientoCaja: deleteMov } =
        await import("./supabase/data-service")
      for (const mov of movimientos) {
        await insertMovimientoCaja(mov)
        insertados.push(mov.id)
      }
    } catch (error) {
      console.error("[v0] Error syncing movimientos caja:", error)
      // Rollback: eliminar los que sí se insertaron para
      // evitar desbalance entre caja_eventos y caja_jazmines
      if (insertados.length > 0) {
        try {
          const { deleteMovimientoCaja: deleteMov } =
            await import("./supabase/data-service")
          await Promise.all(insertados.map((id) => deleteMov(id)))
        } catch (rollbackError) {
          console.error("[v0] Error en rollback:", rollbackError)
        }
        // Revertir también el estado local
        setState((prev) => ({
          ...prev,
          movimientosCaja: (prev.movimientosCaja || []).filter(
            (m) => !insertados.includes(m.id)
          ),
        }))
      }
      toast({
        title: "Error al guardar",
        description: "No se pudo registrar el movimiento. Reintentá.",
        variant: "destructive",
      })
    }
  }

  const deleteMovimientoCaja = async (id: string) => {
    setState((prev) => ({
      ...prev,
      movimientosCaja: (prev.movimientosCaja || []).filter((m) => m.id !== id),
    }))
    // Sync to Supabase
    try {
      const { deleteMovimientoCaja: deleteMov } = await import("./supabase/data-service")
      await deleteMov(id)
    } catch (error) {
      console.error("[v0] Error deleting movimiento caja from Supabase:", error)
      toast({ title: "Error al eliminar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  // === Vendedores (equipo comercial) — Synced with Supabase ===
  const updateVendedor = async (id: string, updates: Partial<Vendedor>) => {
    let actualizado: Vendedor | undefined
    setState((prev) => {
      const nuevos = (prev.vendedores || []).map((v) => {
        if (v.id !== id) return v
        actualizado = { ...v, ...updates }
        return actualizado
      })
      return { ...prev, vendedores: nuevos }
    })
    // Sync to Supabase
    try {
      const { upsertVendedor } = await import("./supabase/data-service")
      const base = (state.vendedores || []).find((v) => v.id === id)
      if (base) await upsertVendedor({ ...base, ...updates })
    } catch (error) {
      console.error("[v0] Error syncing vendedor to Supabase:", error)
    }
  }

  // === Archivo de gastos ===
  const archivarGasto = async (gasto: Omit<GastoArchivado, "id">) => {
    const nuevo: GastoArchivado = { ...gasto, id: generateId() }
    setState((prev) => ({
      ...prev,
      gastosArchivados: [nuevo, ...(prev.gastosArchivados || [])],
    }))
    try {
      const { insertGastoArchivado } = await import("./supabase/data-service")
      await insertGastoArchivado(nuevo)
    } catch (error) {
      console.error("[v0] Error archivando gasto en Supabase:", error)
      toast({ title: "Error al archivar", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  const desarchivarGasto = async (id: string) => {
    setState((prev) => ({
      ...prev,
      gastosArchivados: (prev.gastosArchivados || []).filter((g) => g.id !== id),
    }))
    try {
      const { deleteGastoArchivado } = await import("./supabase/data-service")
      await deleteGastoArchivado(id)
    } catch (error) {
      console.error("[v0] Error desarchivando gasto en Supabase:", error)
      toast({ title: "Error al quitar del archivo", description: "Revisá tu conexión a internet. Reintentamos varias veces y el cambio no se guardó; volvé a intentarlo.", variant: "destructive" })
    }
  }

  // === IPC ===
  /**
   * Aplica el IPC de un mes/año específico. Solo se permite UN IPC por mes.
   * El mes/año lo elige el usuario (puede cargar meses pasados); la fecha real
   * de carga (fechaAplicacion) es solo informativa y no afecta el orden.
   */
  const aplicarIPC = (porcentaje: number, mes: number, anio: number): number => {
    // Regla: un solo IPC por mes. Si ya existe ese mes/año, no se aplica.
    const yaExiste = (state.historialIPC || []).some((h) => h.mes === mes && h.anio === anio)
    if (yaExiste) {
      toast({
        title: "Ese mes ya tiene IPC",
        description: `El IPC de ${MESES_IPC[mes]} ${anio} ya fue cargado. Solo se permite uno por mes.`,
        variant: "destructive",
      })
      return 0
    }

    const eventosPrevios = state.eventos || []
    const { eventos: eventosActualizados, eventosActualizados: eventosConIPC } = actualizarCuotasIPC(
      eventosPrevios,
      porcentaje,
    )

    const nuevaEntrada: HistorialIPCEntry = {
      id: crypto.randomUUID(),
      mes,
      anio,
      porcentaje,
      fechaAplicacion: new Date().toISOString(),
      eventosActualizados: eventosConIPC,
    }

    // Optimistic local update
    setState((prev) => ({
      ...prev,
      eventos: eventosActualizados,
      historialIPC: [...(prev.historialIPC || []), nuevaEntrada],
      ultimoMesIPC: { mes, anio },
    }))

    // Persistir en Supabase solo los eventos cuyo planDeCuotas cambió
    const eventosParaPersistir = eventosActualizados.filter((e, i) => e !== eventosPrevios[i])
    void (async () => {
      for (const evento of eventosParaPersistir) {
        try {
          await fetchWithRetry(`/api/eventos/${evento.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planDeCuotas: evento.planDeCuotas }),
          })
        } catch (err) {
          console.error("[v0] Error persistiendo IPC en evento:", evento.id, err)
        }
      }

      // Persistir la entrada del historial IPC en Supabase (fuente de verdad compartida)
      try {
        const db = await import("./supabase/data-service")
        await db.insertHistorialIPC(nuevaEntrada)
      } catch (err) {
        console.error("[v0] Error persistiendo historial IPC en Supabase:", err)
      }

      toast({
        title: "IPC aplicado",
        description: eventosConIPC > 0
          ? `Se ajustaron las cuotas restantes de ${eventosConIPC} evento(s).`
          : "No había eventos con cuotas pendientes para ajustar, pero el IPC quedó registrado.",
      })
    })()

    return eventosConIPC
  }

  const abrirDialogIPC = () => {
    const hoy = new Date()
    const proximo = calcularProximoMesIPC(state.historialIPC || [], hoy.getMonth(), hoy.getFullYear())
    setMesIPC(proximo.mes)
    setAnioIPC(proximo.anio)
    setPorcentajeIPC("")
    setShowIPCDialog(true)
  }

  /**
   * Deshace un ajuste de IPC: revierte las cuotas restantes a su valor previo,
   * elimina la entrada del historial y recalcula el último mes aplicado.
   * Solo debe usarse sobre el ajuste más reciente (la reversión es compuesta).
   */
  const eliminarIPC = (entry: HistorialIPCEntry): number => {
    const eventosPrevios = state.eventos || []
    const { eventos: eventosRevertidos, eventosActualizados: eventosAfectados } = revertirCuotasIPC(
      eventosPrevios,
      entry.porcentaje,
    )

    const historialRestante = (state.historialIPC || []).filter((h) =>
      entry.id ? h.id !== entry.id : h.fechaAplicacion !== entry.fechaAplicacion,
    )

    // Recalcular el último mes aplicado a partir del historial restante
    const nuevoUltimo = [...historialRestante].sort(
      (a, b) => new Date(b.fechaAplicacion).getTime() - new Date(a.fechaAplicacion).getTime(),
    )[0]

    // Optimistic local update
    setState((prev) => ({
      ...prev,
      eventos: eventosRevertidos,
      historialIPC: historialRestante,
      ultimoMesIPC: nuevoUltimo ? { mes: nuevoUltimo.mes, anio: nuevoUltimo.anio } : null,
    }))

    // Persistir en Supabase: eventos revertidos + borrar la entrada del historial
    const eventosParaPersistir = eventosRevertidos.filter((e, i) => e !== eventosPrevios[i])
    void (async () => {
      for (const evento of eventosParaPersistir) {
        try {
          await fetchWithRetry(`/api/eventos/${evento.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planDeCuotas: evento.planDeCuotas }),
          })
        } catch (err) {
          console.error("[v0] Error revirtiendo IPC en evento:", evento.id, err)
        }
      }

      if (entry.id) {
        try {
          const db = await import("./supabase/data-service")
          await db.deleteHistorialIPC(entry.id)
        } catch (err) {
          console.error("[v0] Error eliminando historial IPC en Supabase:", err)
        }
      }

      toast({
        title: "IPC deshecho",
        description: `Se revirtieron las cuotas restantes de ${eventosAfectados} evento(s) a su valor anterior.`,
      })
    })()

    return eventosAfectados
  }

  const handleAplicarIPC = () => {
    const porcentaje = parseFloat(porcentajeIPC.replace(",", "."))
    if (isNaN(porcentaje)) return

    // Bloquear duplicados: un solo IPC por mes
    const yaExiste = (state.historialIPC || []).some((h) => h.mes === mesIPC && h.anio === anioIPC)
    if (yaExiste) return

    aplicarIPC(porcentaje, mesIPC, anioIPC)
    setShowIPCDialog(false)
    setPorcentajeIPC("")
  }

  if (!isHydrated) {
    return null
  }

  const rawValue: StoreContextType = {
        state,
        loading: !isHydrated,
        insumos: state.insumos,
        insumosBarra: state.insumosBarra,
        recetas: state.recetas,
        cocteles: state.cocteles,
        barrasTemplates: state.barrasTemplates || [],
        eventos: state.eventos || [],
        historial: state.historial || [],
        servicios: state.servicios || [],
        costosOperativos: state.costosOperativos || [],
        preciosVenta: state.preciosVenta || {},
        addInsumo,
        updateInsumo,
        deleteInsumo,
        setInsumos,
        addInsumoBarra,
        updateInsumoBarra,
        deleteInsumoBarra,
        setInsumosBarra,
        addReceta,
        updateReceta,
        deleteReceta,
        setRecetas,
        addCoctel,
        updateCoctel,
        deleteCoctel,
        setCocteles,
        addBarraTemplate,
        updateBarraTemplate,
        deleteBarraTemplate,
        setEventoActual,
        updateEventoActual,
        addEvento,
        updateEvento,
        deleteEvento,
        setEventos,
        addServicio,
        updateServicio,
        deleteServicio,
        setServicios,
        addCostoOperativo,
        updateCostoOperativo,
        deleteCostoOperativo,
        setPrecioVenta,
        deletePrecioVenta,
        setPreciosVenta,
        addEventoHistorial,
        deleteEventoHistorial,
        clearHistorial,
        paquetesSalones: state.paquetesSalones || [],
        addPaqueteSalon,
        updatePaqueteSalon,
        deletePaqueteSalon,
        temporadas: state.temporadas || [],
        addTemporada,
        updateTemporada,
        deleteTemporada,
        personal: state.personal || [],
        addPersonal,
        updatePersonal,
        deletePersonal,
        getPersonalByServicio,
        pagosPersonal: state.pagosPersonal || [],
        addPagoPersonal,
        updatePagoPersonal,
        deletePagoPersonal,
        getPagosPorEvento,
        getPagosPendientes,
        generarPagosPendientes,
        sincronizarPagos,
        configuracionCajas: state.configuracionCajas || {
          salones: {
            Quinta: { saldoInicial: 0, porcentajeAporteAdmin: 0 },
            Casona: { saldoInicial: 0, porcentajeAporteAdmin: 0 },
            Salon: { saldoInicial: 0, porcentajeAporteAdmin: 0 },
            "Salon 4": { saldoInicial: 0, porcentajeAporteAdmin: 0 },
            "Salon 5": { saldoInicial: 0, porcentajeAporteAdmin: 0 },
          },
          admin: { saldoInicial: 0 },
        },
        movimientosCaja: state.movimientosCaja || [],
        updateConfiguracionCajas,
        addMovimientoCaja,
        addMovimientosCaja,
        deleteMovimientoCaja,
        gastosArchivados: state.gastosArchivados || [],
        archivarGasto,
        desarchivarGasto,
        vendedores: state.vendedores || [],
        updateVendedor,
        historialIPC: state.historialIPC || [],
        ultimoMesIPC: state.ultimoMesIPC || null,
      aplicarIPC,
      eliminarIPC,
      abrirDialogIPC,
      }

  const contextValue = aplicarSoloLectura(rawValue, soloLectura, () =>
    toast({
      title: "Modo lectura activo",
      description: "Estás viendo el sistema en otra fecha. Volvé a hoy para hacer cambios.",
    }),
  )

  return (
    <StoreContext.Provider value={contextValue}>
      {children}

      {/* Dialog IPC */}
      <Dialog open={showIPCDialog} onOpenChange={setShowIPCDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cargar IPC de un mes</DialogTitle>
            <DialogDescription>
              Elegí el mes al que corresponde el IPC y su porcentaje. Se permite un solo IPC por mes y se aplica solo a las cuotas restantes (no pagadas) de los eventos ajustables, de forma compuesta.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const mesYaCargado = (state.historialIPC || []).some(
              (h) => h.mes === mesIPC && h.anio === anioIPC,
            )
            const hoy = new Date()
            const anios = Array.from(new Set([
              hoy.getFullYear() - 1,
              hoy.getFullYear(),
              hoy.getFullYear() + 1,
              anioIPC,
            ])).sort((a, b) => a - b)
            return (
              <>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Mes del IPC</Label>
                      <Select value={String(mesIPC)} onValueChange={(v) => setMesIPC(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MESES_IPC.map((nombre, idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              {nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Año</Label>
                      <Select value={String(anioIPC)} onValueChange={(v) => setAnioIPC(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {anios.map((a) => (
                            <SelectItem key={a} value={String(a)}>
                              {a}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {mesYaCargado ? (
                    <p className="text-xs font-medium text-destructive">
                      El IPC de {MESES_IPC[mesIPC]} {anioIPC} ya fue cargado. Elegí otro mes: solo se permite uno por mes.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Vas a cargar el IPC de <span className="font-medium text-foreground">{MESES_IPC[mesIPC]} {anioIPC}</span>.
                    </p>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="porcentaje-ipc">Porcentaje IPC de {MESES_IPC[mesIPC]}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="porcentaje-ipc"
                        type="text"
                        inputMode="decimal"
                        placeholder="Ej: 3.2"
                        value={porcentajeIPC}
                        onChange={(e) => setPorcentajeIPC(e.target.value)}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ingresa el porcentaje como numero decimal (ej: 3.2 para 3,2%)
                    </p>
                  </div>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  <Button variant="outline" onClick={() => setShowIPCDialog(false)}>
                    Recordar despues
                  </Button>
                  <Button
                    onClick={handleAplicarIPC}
                    disabled={
                      mesYaCargado ||
                      !porcentajeIPC ||
                      isNaN(parseFloat(porcentajeIPC.replace(",", ".")))
                    }
                  >
                    Aplicar ahora
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider")
  }
  return context
}

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
  addCoctel: (coctel: Omit<Coctel, "id">) => void
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

  // IPC
  historialIPC: HistorialIPCEntry[]
  ultimoMesIPC: { mes: number; anio: number } | null
  aplicarIPC: (porcentaje: number) => number
  abrirDialogIPC: () => void
}

const StoreContext = createContext<StoreContextType | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState())
  const [isHydrated, setIsHydrated] = useState(false)
  const [showIPCDialog, setShowIPCDialog] = useState(false)
  const [porcentajeIPC, setPorcentajeIPC] = useState("")

  useEffect(() => {
    const initializeData = async () => {
      const fetchSafe = async (url: string) => {
        try {
          const r = await fetch(url)
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
        const [serviciosDB, personalDB, pagosDB, costosDB, asignacionesDB, movimientosDB, configDB] = await Promise.all([
          db.fetchServicios(),
          db.fetchPersonal(),
          db.fetchPagosPersonal(),
          db.fetchCostosOperativos(),
          db.fetchAsignaciones(),
          db.fetchMovimientosCaja(),
          db.fetchConfiguracionCajas(),
        ])
        supabaseData = {
          servicios: serviciosDB.length > 0 ? serviciosDB : localState.servicios,
          personal: personalDB.length > 0 ? personalDB : localState.personal,
          pagosPersonal: pagosDB.length > 0 ? pagosDB : localState.pagosPersonal,
          costosOperativos: costosDB.length > 0 ? costosDB : localState.costosOperativos,
          asignaciones: asignacionesDB.length > 0 ? asignacionesDB : localState.asignaciones,
          movimientosCaja: movimientosDB.length > 0 ? movimientosDB : localState.movimientosCaja,
          configuracionCajas: Object.keys(configDB).length > 1 ? configDB : localState.configuracionCajas,
        }
      } catch (error) {
        console.error("[v0] Error loading from Supabase, using localStorage:", error)
        supabaseData = {
          servicios: localState.servicios,
          personal: localState.personal,
          pagosPersonal: localState.pagosPersonal,
          costosOperativos: localState.costosOperativos,
          asignaciones: localState.asignaciones,
          movimientosCaja: localState.movimientosCaja,
          configuracionCajas: localState.configuracionCajas,
        }
      }

      // Merge: DB data takes absolute priority over localStorage for migrated modules
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
        movimientosCaja: supabaseData.movimientosCaja,
        configuracionCajas: supabaseData.configuracionCajas,
      })

      setIsHydrated(true)
    }

    initializeData()
  }, [])

  useEffect(() => {
    if (isHydrated) {
      // Only save non-DB modules to localStorage to avoid stale data
      const { insumos, insumosBarra, recetas, cocteles, barrasTemplates, eventos, ...localOnly } = state
      saveState({ ...localOnly, insumos: [], insumosBarra: [], recetas: [], cocteles: [], barrasTemplates: [], eventos: [] })
    }
  }, [state, isHydrated])

  // === Insumos (Cocina) - Synced with API ===
  const addInsumo = async (insumo: Omit<Insumo, "id">) => {
    try {
      const res = await fetch("/api/insumos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(insumo),
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
    }
  }

  const updateInsumo = async (id: string, updates: Partial<Insumo>) => {
    try {
      const res = await fetch(`/api/insumos/${id}`, {
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
    }
  }

  const deleteInsumo = async (id: string) => {
    try {
      const res = await fetch(`/api/insumos/${id}`, { method: "DELETE" })
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          insumos: prev.insumos.filter((i) => i.id !== id),
        }))
      }
    } catch (error) {
      console.error("[v0] Error deleting insumo:", error)
    }
  }

  const setInsumos = (insumos: Insumo[]) => {
    setState((prev) => ({ ...prev, insumos }))
  }

  // === Insumos Barra - Synced with API ===
  const addInsumoBarra = async (insumo: Omit<InsumoBarra, "id">) => {
    try {
      const res = await fetch("/api/insumos-barra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(insumo),
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
    }
  }

  const updateInsumoBarra = async (id: string, updates: Partial<InsumoBarra>) => {
    try {
      const res = await fetch(`/api/insumos-barra/${id}`, {
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
    }
  }

  const deleteInsumoBarra = async (id: string) => {
    try {
      const res = await fetch(`/api/insumos-barra/${id}`, { method: "DELETE" })
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          insumosBarra: prev.insumosBarra.filter((i) => i.id !== id),
        }))
      }
    } catch (error) {
      console.error("[v0] Error deleting insumo barra:", error)
    }
  }

  const setInsumosBarra = (insumosBarra: InsumoBarra[]) => {
    setState((prev) => ({ ...prev, insumosBarra }))
  }

  // === Recetas - Synced with API ===
  const addReceta = async (receta: Omit<Receta, "id">) => {
    try {
      const res = await fetch("/api/recetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(receta),
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
    }
  }

  const updateReceta = async (id: string, updates: Partial<Receta>) => {
    try {
      const res = await fetch(`/api/recetas/${id}`, {
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
    }
  }

  const deleteReceta = async (id: string) => {
    try {
      const res = await fetch(`/api/recetas/${id}`, { method: "DELETE" })
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          recetas: prev.recetas.filter((r) => r.id !== id),
        }))
      }
    } catch (error) {
      console.error("[v0] Error deleting receta:", error)
    }
  }

  const setRecetas = (recetas: Receta[]) => {
    setState((prev) => ({ ...prev, recetas }))
  }

  // === Cocteles - Synced with API ===
  const addCoctel = async (coctel: Omit<Coctel, "id">) => {
    try {
      const res = await fetch("/api/cocteles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coctel),
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
    }
  }

  const updateCoctel = async (id: string, updates: Partial<Coctel>) => {
    try {
      const res = await fetch(`/api/cocteles/${id}`, {
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
    }
  }

  const deleteCoctel = async (id: string) => {
    try {
      const res = await fetch(`/api/cocteles/${id}`, { method: "DELETE" })
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          cocteles: prev.cocteles.filter((c) => c.id !== id),
        }))
      }
    } catch (error) {
      console.error("[v0] Error deleting coctel:", error)
    }
  }

  const setCocteles = (cocteles: Coctel[]) => {
    setState((prev) => ({ ...prev, cocteles }))
  }

  // === Barras Templates - Synced with API ===
  const addBarraTemplate = async (template: Omit<BarraTemplate, "id">) => {
    try {
      const res = await fetch("/api/barra-templates", {
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
    }
  }

  const updateBarraTemplate = async (id: string, updates: Partial<BarraTemplate>) => {
    try {
      const res = await fetch(`/api/barra-templates/${id}`, {
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
    }
  }

  const deleteBarraTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/barra-templates/${id}`, { method: "DELETE" })
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          barrasTemplates: (prev.barrasTemplates || []).filter((t) => t.id !== id),
        }))
      }
    } catch (error) {
      console.error("[v0] Error deleting barra template:", error)
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
    }
  }

  const updateServicio = async (id: string, updates: Partial<Servicio>) => {
    setState((prev) => ({
      ...prev,
      servicios: (prev.servicios || []).map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }))
    // Sync to Supabase
    try {
      const existing = state.servicios?.find(s => s.id === id)
      if (existing) {
        const { upsertServicio } = await import("./supabase/data-service")
        await upsertServicio({ ...existing, ...updates })
      }
    } catch (error) {
      console.error("[v0] Error syncing servicio update to Supabase:", error)
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
    }
  }

  // === Paquetes de Salones ===
  const addPaqueteSalon = (paquete: Omit<PaqueteSalon, "id">) => {
    setState((prev) => ({
      ...prev,
      paquetesSalones: [...(prev.paquetesSalones || []), { ...paquete, id: generateId() }],
    }))
  }

  const updatePaqueteSalon = (id: string, updates: Partial<PaqueteSalon>) => {
    setState((prev) => ({
      ...prev,
      paquetesSalones: (prev.paquetesSalones || []).map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }))
  }

  const deletePaqueteSalon = (id: string) => {
    setState((prev) => ({
      ...prev,
      paquetesSalones: (prev.paquetesSalones || []).filter((p) => p.id !== id),
    }))
  }

  // === Temporadas ===
  const addTemporada = (temporada: Omit<TemporadaPrecio, "id">) => {
    setState((prev) => ({
      ...prev,
      temporadas: [...(prev.temporadas || []), { ...temporada, id: generateId() }],
    }))
  }

  const updateTemporada = (id: string, updates: Partial<TemporadaPrecio>) => {
    setState((prev) => ({
      ...prev,
      temporadas: (prev.temporadas || []).map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }))
  }

  const deleteTemporada = (id: string) => {
    setState((prev) => ({
      ...prev,
      temporadas: (prev.temporadas || []).filter((t) => t.id !== id),
    }))
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
      const res = await fetch("/api/eventos", {
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
    }
  }

  const updateEvento = async (id: string, updates: Partial<EventoGuardado>) => {
    // Optimistic update first
    setState((prev) => ({
      ...prev,
      eventos: (prev.eventos || []).map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }))
    try {
      await fetch(`/api/eventos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
    } catch (err) {
      console.error("[v0] Error updating evento:", err)
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
      await fetch(`/api/eventos/${id}`, { method: "DELETE" })
      const { deleteMovimientosByEvento } = await import("./supabase/data-service")
      await deleteMovimientosByEvento(id)
    } catch (err) {
      console.error("[v0] Error deleting evento:", err)
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
  const setPrecioVenta = (salon: string, fecha: string, precio: number) => {
    setState((prev) => {
      const current = { ...(prev.preciosVenta || {}) }
      if (!current[salon]) current[salon] = {}
      current[salon] = { ...current[salon], [fecha]: precio }
      return { ...prev, preciosVenta: current }
    })
  }

  const deletePrecioVenta = (salon: string, fecha: string) => {
    setState((prev) => {
      const current = { ...(prev.preciosVenta || {}) }
      if (current[salon]) {
        const salonCopy = { ...current[salon] }
        delete salonCopy[fecha]
        current[salon] = salonCopy
      }
      return { ...prev, preciosVenta: current }
    })
  }

  const setPreciosVenta = (preciosVenta: PreciosVentaMap) => {
    setState((prev) => ({ ...prev, preciosVenta }))
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
    }
  }

  const addMovimientosCaja = async (movimientos: MovimientoCaja[]) => {
    setState((prev) => ({
      ...prev,
      movimientosCaja: [...(prev.movimientosCaja || []), ...movimientos],
    }))
    // Sync to Supabase
    try {
      const { insertMovimientoCaja } = await import("./supabase/data-service")
      for (const mov of movimientos) {
        await insertMovimientoCaja(mov)
      }
    } catch (error) {
      console.error("[v0] Error syncing movimientos caja to Supabase:", error)
    }
  }

  // === IPC ===
  const aplicarIPC = (porcentaje: number): number => {
    const eventosActualizados = actualizarCuotasIPC(state.eventos || [], porcentaje)
    const eventosConIPC = eventosActualizados.filter(
      (e, i) => e !== (state.eventos || [])[i]
    ).length

    const hoy = new Date()
    const nuevaEntrada: HistorialIPCEntry = {
      mes: hoy.getMonth(),
      anio: hoy.getFullYear(),
      porcentaje,
      fechaAplicacion: hoy.toISOString(),
      eventosActualizados: eventosConIPC,
    }

    setState((prev) => ({
      ...prev,
      eventos: eventosActualizados,
      historialIPC: [...(prev.historialIPC || []), nuevaEntrada],
      ultimoMesIPC: { mes: hoy.getMonth(), anio: hoy.getFullYear() },
    }))

    return eventosConIPC
  }

  const abrirDialogIPC = () => {
    setPorcentajeIPC("")
    setShowIPCDialog(true)
  }

  // Detectar cambio de mes para IPC
  useEffect(() => {
    if (!isHydrated) return

    const hoy = new Date()
    const mesActual = hoy.getMonth()
    const anioActual = hoy.getFullYear()
    const ultimo = state.ultimoMesIPC

    // Verificar si hay eventos con modalidad IPC
    const tieneEventosIPC = (state.eventos || []).some(
      (e) => e.planDeCuotas?.modalidadPago === "ipc"
    )

    if (!tieneEventosIPC) return

    // Si nunca se aplicó o si cambió el mes/año
    if (!ultimo || ultimo.mes !== mesActual || ultimo.anio !== anioActual) {
      setShowIPCDialog(true)
    }
  }, [isHydrated, state.ultimoMesIPC, state.eventos])

  const handleAplicarIPC = () => {
    const porcentaje = parseFloat(porcentajeIPC.replace(",", "."))
    if (isNaN(porcentaje)) return

    const cantidad = aplicarIPC(porcentaje)
    setShowIPCDialog(false)
    setPorcentajeIPC("")
    // El toast se puede agregar aquí si se quiere
  }

  if (!isHydrated) {
    return null
  }

  return (
    <StoreContext.Provider
      value={{
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
        historialIPC: state.historialIPC || [],
        ultimoMesIPC: state.ultimoMesIPC || null,
        aplicarIPC,
        abrirDialogIPC,
      }}
    >
      {children}

      {/* Dialog IPC */}
      <Dialog open={showIPCDialog} onOpenChange={setShowIPCDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambio de mes detectado</DialogTitle>
            <DialogDescription>
              Hay cuotas con modalidad IPC que necesitan actualizarse. Ingresa el porcentaje de inflacion del mes para aplicar el ajuste.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="porcentaje-ipc">Porcentaje IPC del mes</Label>
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
            <Button
              variant="outline"
              onClick={() => setShowIPCDialog(false)}
            >
              Recordar despues
            </Button>
            <Button
              onClick={handleAplicarIPC}
              disabled={!porcentajeIPC || isNaN(parseFloat(porcentajeIPC.replace(",", ".")))}
            >
              Aplicar ahora
            </Button>
          </DialogFooter>
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

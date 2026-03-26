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
  loadState,
  saveState,
  generateId,
  generarPagosPendientesAutomaticos,
  actualizarEstadoPagos,
  sincronizarPagosConAsignaciones,
  migrarServiciosAPreciosDinamicos,
  obtenerPreciosServicio,
} from "./store"

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
}

const StoreContext = createContext<StoreContextType | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState())
  const [isHydrated, setIsHydrated] = useState(false)

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

      // Merge: DB data takes absolute priority over localStorage for migrated modules
      setState({
        ...localState,
        insumos: insumosRes ?? localState.insumos,
        insumosBarra: insumosBarraRes ?? localState.insumosBarra,
        recetas: recetasRes ?? localState.recetas,
        cocteles: coctelesRes ?? localState.cocteles,
        barrasTemplates: barraTemplatesRes ?? localState.barrasTemplates,
        eventos: eventosRes ?? localState.eventos,
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

  // === Servicios ===
  const addServicio = (servicio: Omit<Servicio, "id">) => {
    setState((prev) => ({
      ...prev,
      servicios: [...(prev.servicios || []), { ...servicio, id: generateId() }],
    }))
  }

  const updateServicio = (id: string, updates: Partial<Servicio>) => {
    setState((prev) => ({
      ...prev,
      servicios: (prev.servicios || []).map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }))
  }

  const deleteServicio = (id: string) => {
    setState((prev) => ({
      ...prev,
      servicios: (prev.servicios || []).filter((s) => s.id !== id),
    }))
  }

  const setServicios = (servicios: Servicio[]) => {
    setState((prev) => ({ ...prev, servicios }))
  }

  // === Costos Operativos ===
  const addCostoOperativo = (costo: Omit<CostoOperativo, "id">) => {
    setState((prev) => ({
      ...prev,
      costosOperativos: [...(prev.costosOperativos || []), { ...costo, id: generateId() }],
    }))
  }

  const updateCostoOperativo = (id: string, updates: Partial<CostoOperativo>) => {
    setState((prev) => ({
      ...prev,
      costosOperativos: (prev.costosOperativos || []).map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }))
  }

  const deleteCostoOperativo = (id: string) => {
    setState((prev) => ({
      ...prev,
      costosOperativos: (prev.costosOperativos || []).filter((c) => c.id !== id),
    }))
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

  // === Personal ===
  const addPersonal = (personal: Omit<PersonalEvento, "id">) => {
    setState((prev) => ({
      ...prev,
      personal: [...(prev.personal || []), { ...personal, id: generateId() }],
    }))
  }

  const updatePersonal = (id: string, updates: Partial<PersonalEvento>) => {
    setState((prev) => ({
      ...prev,
      personal: (prev.personal || []).map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }))
  }

  const deletePersonal = (id: string) => {
    setState((prev) => ({
      ...prev,
      personal: (prev.personal || []).filter((p) => p.id !== id),
    }))
  }

  const getPersonalByServicio = (servicioId: string): PersonalEvento[] => {
    return (state.personal || []).filter((p) => p.servicioVinculadoId === servicioId && p.activo)
  }

  // === Pagos Personal ===
  const addPagoPersonal = (pago: Omit<PagoPersonal, "id">) => {
    setState((prev) => ({
      ...prev,
      pagosPersonal: [...(prev.pagosPersonal || []), { ...pago, id: generateId() }],
    }))
  }

  const updatePagoPersonal = (id: string, updates: Partial<PagoPersonal>) => {
    setState((prev) => ({
      ...prev,
      pagosPersonal: (prev.pagosPersonal || []).map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }))
  }

  const deletePagoPersonal = (id: string) => {
    setState((prev) => ({
      ...prev,
      pagosPersonal: (prev.pagosPersonal || []).filter((p) => p.id !== id),
    }))
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

  // === Eventos (Calendario) — Synced with API ===
  const addEvento = async (evento: EventoGuardado) => {
    try {
      const res = await fetch("/api/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evento),
      })
      if (res.ok) {
        const created = await res.json()
        setState((prev) => ({
          ...prev,
          eventos: [...(prev.eventos || []), created],
        }))
      }
    } catch (err) {
      console.error("[v0] Error adding evento:", err)
      setState((prev) => ({ ...prev, eventos: [...(prev.eventos || []), evento] }))
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
    setState((prev) => ({
      ...prev,
      eventos: (prev.eventos || []).filter((e) => e.id !== id),
    }))
    try {
      await fetch(`/api/eventos/${id}`, { method: "DELETE" })
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
      }}
    >
      {children}
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

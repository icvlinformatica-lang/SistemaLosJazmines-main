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
} from "./store"

interface StoreContextType {
  state: AppState
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
}

const StoreContext = createContext<StoreContextType | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState())
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setState(loadState())
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (isHydrated) {
      saveState(state)
    }
  }, [state, isHydrated])

  // === Insumos (Cocina) ===
  const addInsumo = (insumo: Omit<Insumo, "id">) => {
    setState((prev) => ({
      ...prev,
      insumos: [...prev.insumos, { ...insumo, id: generateId() }],
    }))
  }

  const updateInsumo = (id: string, updates: Partial<Insumo>) => {
    setState((prev) => ({
      ...prev,
      insumos: prev.insumos.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }))
  }

  const deleteInsumo = (id: string) => {
    setState((prev) => ({
      ...prev,
      insumos: prev.insumos.filter((i) => i.id !== id),
    }))
  }

  const setInsumos = (insumos: Insumo[]) => {
    setState((prev) => ({ ...prev, insumos }))
  }

  // === Insumos Barra ===
  const addInsumoBarra = (insumo: Omit<InsumoBarra, "id">) => {
    setState((prev) => ({
      ...prev,
      insumosBarra: [...prev.insumosBarra, { ...insumo, id: generateId() }],
    }))
  }

  const updateInsumoBarra = (id: string, updates: Partial<InsumoBarra>) => {
    setState((prev) => ({
      ...prev,
      insumosBarra: prev.insumosBarra.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }))
  }

  const deleteInsumoBarra = (id: string) => {
    setState((prev) => ({
      ...prev,
      insumosBarra: prev.insumosBarra.filter((i) => i.id !== id),
    }))
  }

  const setInsumosBarra = (insumosBarra: InsumoBarra[]) => {
    setState((prev) => ({ ...prev, insumosBarra }))
  }

  // === Recetas ===
  const addReceta = (receta: Omit<Receta, "id">) => {
    setState((prev) => ({
      ...prev,
      recetas: [...prev.recetas, { ...receta, id: generateId() }],
    }))
  }

  const updateReceta = (id: string, updates: Partial<Receta>) => {
    setState((prev) => ({
      ...prev,
      recetas: prev.recetas.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }))
  }

  const deleteReceta = (id: string) => {
    setState((prev) => ({
      ...prev,
      recetas: prev.recetas.filter((r) => r.id !== id),
    }))
  }

  const setRecetas = (recetas: Receta[]) => {
    setState((prev) => ({ ...prev, recetas }))
  }

  // === Cocteles ===
  const addCoctel = (coctel: Omit<Coctel, "id">) => {
    setState((prev) => ({
      ...prev,
      cocteles: [...prev.cocteles, { ...coctel, id: generateId() }],
    }))
  }

  const updateCoctel = (id: string, updates: Partial<Coctel>) => {
    setState((prev) => ({
      ...prev,
      cocteles: prev.cocteles.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }))
  }

  const deleteCoctel = (id: string) => {
    setState((prev) => ({
      ...prev,
      cocteles: prev.cocteles.filter((c) => c.id !== id),
    }))
  }

  const setCocteles = (cocteles: Coctel[]) => {
    setState((prev) => ({ ...prev, cocteles }))
  }

  // === Barras Templates ===
  const addBarraTemplate = (template: Omit<BarraTemplate, "id">) => {
    setState((prev) => ({
      ...prev,
      barrasTemplates: [...(prev.barrasTemplates || []), { ...template, id: generateId() }],
    }))
  }

  const updateBarraTemplate = (id: string, updates: Partial<BarraTemplate>) => {
    setState((prev) => ({
      ...prev,
      barrasTemplates: (prev.barrasTemplates || []).map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }))
  }

  const deleteBarraTemplate = (id: string) => {
    setState((prev) => ({
      ...prev,
      barrasTemplates: (prev.barrasTemplates || []).filter((t) => t.id !== id),
    }))
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

  // Auto-generar pagos pendientes al cargar
  useEffect(() => {
    if (isHydrated) {
      generarPagosPendientes()
    }
  }, [isHydrated])

  // === Eventos (Calendario) ===
  const addEvento = (evento: EventoGuardado) => {
    setState((prev) => ({
      ...prev,
      eventos: [...(prev.eventos || []), evento],
    }))
  }

  const updateEvento = (id: string, updates: Partial<EventoGuardado>) => {
    setState((prev) => ({
      ...prev,
      eventos: (prev.eventos || []).map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }))
  }

  const deleteEvento = (id: string) => {
    setState((prev) => ({
      ...prev,
      eventos: (prev.eventos || []).filter((e) => e.id !== id),
    }))
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

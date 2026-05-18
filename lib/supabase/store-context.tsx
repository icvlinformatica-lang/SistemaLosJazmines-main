"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import * as db from "./data-service"
import type {
  Evento,
  Servicio,
  PersonalEvento,
  PagoPersonal,
  AsignacionPersonal,
  CostoOperativo,
  MovimientoCaja,
  HistorialIPC,
} from "../store"

interface SupabaseStoreState {
  // Data
  eventos: Evento[]
  servicios: Servicio[]
  personal: PersonalEvento[]
  pagosPersonal: PagoPersonal[]
  asignaciones: AsignacionPersonal[]
  costosOperativos: CostoOperativo[]
  movimientosCaja: MovimientoCaja[]
  configuracionCajas: Record<string, any>
  historialIPC: HistorialIPC[]
  
  // Loading states
  loading: boolean
  
  // Actions - Eventos
  addEvento: (evento: Omit<Evento, "id">) => Promise<Evento | null>
  updateEvento: (id: string, updates: Partial<Evento>) => Promise<void>
  deleteEvento: (id: string) => Promise<void>
  
  // Actions - Servicios
  addServicio: (servicio: Omit<Servicio, "id">) => Promise<Servicio | null>
  updateServicio: (id: string, updates: Partial<Servicio>) => Promise<void>
  deleteServicio: (id: string) => Promise<void>
  
  // Actions - Personal
  addPersonal: (persona: Omit<PersonalEvento, "id">) => Promise<PersonalEvento | null>
  updatePersonal: (id: string, updates: Partial<PersonalEvento>) => Promise<void>
  deletePersonal: (id: string) => Promise<void>
  
  // Actions - Pagos Personal
  addPagoPersonal: (pago: Omit<PagoPersonal, "id">) => Promise<PagoPersonal | null>
  updatePagoPersonal: (id: string, updates: Partial<PagoPersonal>) => Promise<void>
  deletePagoPersonal: (id: string) => Promise<void>
  
  // Actions - Asignaciones
  addAsignacion: (asig: Omit<AsignacionPersonal, "id">) => Promise<AsignacionPersonal | null>
  updateAsignacion: (id: string, updates: Partial<AsignacionPersonal>) => Promise<void>
  deleteAsignacion: (id: string) => Promise<void>
  
  // Actions - Costos Operativos
  addCostoOperativo: (costo: Omit<CostoOperativo, "id">) => Promise<CostoOperativo | null>
  updateCostoOperativo: (id: string, updates: Partial<CostoOperativo>) => Promise<void>
  deleteCostoOperativo: (id: string) => Promise<void>
  
  // Actions - Movimientos Caja
  addMovimientoCaja: (mov: Omit<MovimientoCaja, "id">) => Promise<MovimientoCaja | null>
  
  // Actions - Configuracion Cajas
  updateConfiguracionCajas: (config: Record<string, any>) => Promise<void>
  
  // Actions - Historial IPC
  addHistorialIPC: (hist: Omit<HistorialIPC, "id">) => Promise<HistorialIPC | null>
  
  // Refresh data
  refreshAll: () => Promise<void>
}

const SupabaseStoreContext = createContext<SupabaseStoreState | null>(null)

export function SupabaseStoreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [personal, setPersonal] = useState<PersonalEvento[]>([])
  const [pagosPersonal, setPagosPersonal] = useState<PagoPersonal[]>([])
  const [asignaciones, setAsignaciones] = useState<AsignacionPersonal[]>([])
  const [costosOperativos, setCostosOperativos] = useState<CostoOperativo[]>([])
  const [movimientosCaja, setMovimientosCaja] = useState<MovimientoCaja[]>([])
  const [configuracionCajas, setConfiguracionCajas] = useState<Record<string, any>>({})
  const [historialIPC, setHistorialIPC] = useState<HistorialIPC[]>([])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    try {
      const [
        eventosData,
        serviciosData,
        personalData,
        pagosData,
        asignacionesData,
        costosData,
        movimientosData,
        configData,
        ipcData,
      ] = await Promise.all([
        db.fetchEventos(),
        db.fetchServicios(),
        db.fetchPersonal(),
        db.fetchPagosPersonal(),
        db.fetchAsignaciones(),
        db.fetchCostosOperativos(),
        db.fetchMovimientosCaja(),
        db.fetchConfiguracionCajas(),
        db.fetchHistorialIPC(),
      ])
      
      setEventos(eventosData)
      setServicios(serviciosData)
      setPersonal(personalData)
      setPagosPersonal(pagosData)
      setAsignaciones(asignacionesData)
      setCostosOperativos(costosData)
      setMovimientosCaja(movimientosData)
      setConfiguracionCajas(configData)
      setHistorialIPC(ipcData)
    } catch (error) {
      console.error("Error loading data from Supabase:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  // ============ EVENTOS ============
  const addEvento = useCallback(async (evento: Omit<Evento, "id">) => {
    const newEvento = { ...evento, id: crypto.randomUUID() } as Evento
    const result = await db.upsertEvento(newEvento)
    if (result) {
      setEventos(prev => [...prev, result])
    }
    return result
  }, [])

  const updateEvento = useCallback(async (id: string, updates: Partial<Evento>) => {
    const existing = eventos.find(e => e.id === id)
    if (!existing) return
    const updated = { ...existing, ...updates }
    const result = await db.upsertEvento(updated)
    if (result) {
      setEventos(prev => prev.map(e => e.id === id ? result : e))
    }
  }, [eventos])

  const deleteEvento = useCallback(async (id: string) => {
    const success = await db.deleteEvento(id)
    if (success) {
      setEventos(prev => prev.filter(e => e.id !== id))
    }
  }, [])

  // ============ SERVICIOS ============
  const addServicio = useCallback(async (servicio: Omit<Servicio, "id">) => {
    const newServicio = { ...servicio, id: crypto.randomUUID() } as Servicio
    const result = await db.upsertServicio(newServicio)
    if (result) {
      setServicios(prev => [...prev, result])
    }
    return result
  }, [])

  const updateServicio = useCallback(async (id: string, updates: Partial<Servicio>) => {
    const existing = servicios.find(s => s.id === id)
    if (!existing) return
    const updated = { ...existing, ...updates }
    const result = await db.upsertServicio(updated)
    if (result) {
      setServicios(prev => prev.map(s => s.id === id ? result : s))
    }
  }, [servicios])

  const deleteServicioAction = useCallback(async (id: string) => {
    const success = await db.deleteServicio(id)
    if (success) {
      setServicios(prev => prev.filter(s => s.id !== id))
    }
  }, [])

  // ============ PERSONAL ============
  const addPersonal = useCallback(async (persona: Omit<PersonalEvento, "id">) => {
    const newPersona = { ...persona, id: crypto.randomUUID() } as PersonalEvento
    const result = await db.upsertPersonal(newPersona)
    if (result) {
      setPersonal(prev => [...prev, result])
    }
    return result
  }, [])

  const updatePersonal = useCallback(async (id: string, updates: Partial<PersonalEvento>) => {
    const existing = personal.find(p => p.id === id)
    if (!existing) return
    const updated = { ...existing, ...updates }
    const result = await db.upsertPersonal(updated)
    if (result) {
      setPersonal(prev => prev.map(p => p.id === id ? result : p))
    }
  }, [personal])

  const deletePersonalAction = useCallback(async (id: string) => {
    const success = await db.deletePersonal(id)
    if (success) {
      setPersonal(prev => prev.filter(p => p.id !== id))
    }
  }, [])

  // ============ PAGOS PERSONAL ============
  const addPagoPersonal = useCallback(async (pago: Omit<PagoPersonal, "id">) => {
    const newPago = { ...pago, id: crypto.randomUUID() } as PagoPersonal
    const result = await db.upsertPagoPersonal(newPago)
    if (result) {
      setPagosPersonal(prev => [...prev, result])
    }
    return result
  }, [])

  const updatePagoPersonal = useCallback(async (id: string, updates: Partial<PagoPersonal>) => {
    const existing = pagosPersonal.find(p => p.id === id)
    if (!existing) return
    const updated = { ...existing, ...updates }
    const result = await db.upsertPagoPersonal(updated)
    if (result) {
      setPagosPersonal(prev => prev.map(p => p.id === id ? result : p))
    }
  }, [pagosPersonal])

  const deletePagoPersonalAction = useCallback(async (id: string) => {
    const success = await db.deletePagoPersonal(id)
    if (success) {
      setPagosPersonal(prev => prev.filter(p => p.id !== id))
    }
  }, [])

  // ============ ASIGNACIONES ============
  const addAsignacion = useCallback(async (asig: Omit<AsignacionPersonal, "id">) => {
    const newAsig = { ...asig, id: crypto.randomUUID() } as AsignacionPersonal
    const result = await db.upsertAsignacion(newAsig)
    if (result) {
      setAsignaciones(prev => [...prev, result])
    }
    return result
  }, [])

  const updateAsignacion = useCallback(async (id: string, updates: Partial<AsignacionPersonal>) => {
    const existing = asignaciones.find(a => a.id === id)
    if (!existing) return
    const updated = { ...existing, ...updates }
    const result = await db.upsertAsignacion(updated)
    if (result) {
      setAsignaciones(prev => prev.map(a => a.id === id ? result : a))
    }
  }, [asignaciones])

  const deleteAsignacionAction = useCallback(async (id: string) => {
    const success = await db.deleteAsignacion(id)
    if (success) {
      setAsignaciones(prev => prev.filter(a => a.id !== id))
    }
  }, [])

  // ============ COSTOS OPERATIVOS ============
  const addCostoOperativo = useCallback(async (costo: Omit<CostoOperativo, "id">) => {
    const newCosto = { ...costo, id: crypto.randomUUID() } as CostoOperativo
    const result = await db.upsertCostoOperativo(newCosto)
    if (result) {
      setCostosOperativos(prev => [...prev, result])
    }
    return result
  }, [])

  const updateCostoOperativo = useCallback(async (id: string, updates: Partial<CostoOperativo>) => {
    const existing = costosOperativos.find(c => c.id === id)
    if (!existing) return
    const updated = { ...existing, ...updates }
    const result = await db.upsertCostoOperativo(updated)
    if (result) {
      setCostosOperativos(prev => prev.map(c => c.id === id ? result : c))
    }
  }, [costosOperativos])

  const deleteCostoOperativoAction = useCallback(async (id: string) => {
    const success = await db.deleteCostoOperativo(id)
    if (success) {
      setCostosOperativos(prev => prev.filter(c => c.id !== id))
    }
  }, [])

  // ============ MOVIMIENTOS CAJA ============
  const addMovimientoCaja = useCallback(async (mov: Omit<MovimientoCaja, "id">) => {
    const newMov = { ...mov, id: crypto.randomUUID() } as MovimientoCaja
    const result = await db.insertMovimientoCaja(newMov)
    if (result) {
      setMovimientosCaja(prev => [result, ...prev])
    }
    return result
  }, [])

  // ============ CONFIGURACION CAJAS ============
  const updateConfiguracionCajas = useCallback(async (config: Record<string, any>) => {
    const success = await db.upsertConfiguracionCajas(config)
    if (success) {
      setConfiguracionCajas(config)
    }
  }, [])

  // ============ HISTORIAL IPC ============
  const addHistorialIPC = useCallback(async (hist: Omit<HistorialIPC, "id">) => {
    const newHist = { ...hist, id: crypto.randomUUID() } as HistorialIPC
    const result = await db.insertHistorialIPC(newHist)
    if (result) {
      setHistorialIPC(prev => [result, ...prev])
    }
    return result
  }, [])

  const value: SupabaseStoreState = {
    // Data
    eventos,
    servicios,
    personal,
    pagosPersonal,
    asignaciones,
    costosOperativos,
    movimientosCaja,
    configuracionCajas,
    historialIPC,
    loading,
    
    // Actions
    addEvento,
    updateEvento,
    deleteEvento,
    addServicio,
    updateServicio,
    deleteServicio: deleteServicioAction,
    addPersonal,
    updatePersonal,
    deletePersonal: deletePersonalAction,
    addPagoPersonal,
    updatePagoPersonal,
    deletePagoPersonal: deletePagoPersonalAction,
    addAsignacion,
    updateAsignacion,
    deleteAsignacion: deleteAsignacionAction,
    addCostoOperativo,
    updateCostoOperativo,
    deleteCostoOperativo: deleteCostoOperativoAction,
    addMovimientoCaja,
    updateConfiguracionCajas,
    addHistorialIPC,
    refreshAll,
  }

  return (
    <SupabaseStoreContext.Provider value={value}>
      {children}
    </SupabaseStoreContext.Provider>
  )
}

export function useSupabaseStore() {
  const context = useContext(SupabaseStoreContext)
  if (!context) {
    throw new Error("useSupabaseStore must be used within a SupabaseStoreProvider")
  }
  return context
}

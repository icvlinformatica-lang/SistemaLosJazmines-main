"use client"

import { createClient } from "./client"
import type { 
  Evento, 
  Servicio, 
  PersonalEvento, 
  PagoPersonal, 
  AsignacionPersonal,
  CostoOperativo,
  MovimientoCaja,
  HistorialIPC
} from "../store"

const supabase = createClient()

// ============ SERVICIOS ============
export async function fetchServicios(): Promise<Servicio[]> {
  const { data, error } = await supabase
    .from("servicios")
    .select("*")
    .order("nombre")
  
  if (error) {
    console.error("Error fetching servicios:", error)
    return []
  }
  
  return (data || []).map(s => ({
    id: s.id,
    nombre: s.nombre,
    descripcion: s.descripcion || "",
    categoria: s.categoria,
    unidad: s.unidad || "Fijo",
    requierePersonal: s.requiere_personal ?? true,
    activo: s.activo ?? true,
    // Campos legacy que el store espera
    precioBase: 0,
    precioOficial: 0,
    precioProveedor: 0,
    margenGanancia: 0,
  }))
}

export async function upsertServicio(servicio: Partial<Servicio>): Promise<Servicio | null> {
  const record = {
    id: servicio.id,
    nombre: servicio.nombre,
    descripcion: servicio.descripcion,
    categoria: servicio.categoria,
    unidad: servicio.unidad,
    requiere_personal: servicio.requierePersonal,
    activo: servicio.activo,
    updated_at: new Date().toISOString(),
  }
  
  const { data, error } = await supabase
    .from("servicios")
    .upsert(record)
    .select()
    .single()
  
  if (error) {
    console.error("Error upserting servicio:", error)
    return null
  }
  
  return data ? {
    id: data.id,
    nombre: data.nombre,
    descripcion: data.descripcion || "",
    categoria: data.categoria,
    unidad: data.unidad || "Fijo",
    requierePersonal: data.requiere_personal ?? true,
    activo: data.activo ?? true,
    precioBase: 0,
    precioOficial: 0,
    precioProveedor: 0,
    margenGanancia: 0,
  } : null
}

export async function deleteServicio(id: string): Promise<boolean> {
  const { error } = await supabase.from("servicios").delete().eq("id", id)
  if (error) {
    console.error("Error deleting servicio:", error)
    return false
  }
  return true
}

// ============ PERSONAL ============
export async function fetchPersonal(): Promise<PersonalEvento[]> {
  const { data, error } = await supabase
    .from("personal")
    .select("*")
    .order("apellido")
  
  if (error) {
    console.error("Error fetching personal:", error)
    return []
  }
  
  return (data || []).map(p => ({
    id: p.id,
    nombre: p.nombre,
    apellido: p.apellido,
    dni: p.dni || "",
    telefono: p.telefono || "",
    email: p.email,
    funcion: p.funcion,
    servicioVinculadoId: p.servicio_vinculado_id || "",
    tarifaBase: Number(p.tarifa_base) || 0,
    tarifas: p.tarifas || [],
    cuentaBancaria: p.cuenta_bancaria,
    activo: p.activo ?? true,
    notas: p.notas,
  }))
}

export async function upsertPersonal(persona: Partial<PersonalEvento>): Promise<PersonalEvento | null> {
  const record = {
    id: persona.id,
    nombre: persona.nombre,
    apellido: persona.apellido,
    dni: persona.dni,
    telefono: persona.telefono,
    email: persona.email,
    funcion: persona.funcion,
    servicio_vinculado_id: persona.servicioVinculadoId || null,
    tarifa_base: persona.tarifaBase,
    tarifas: persona.tarifas || [],
    cuenta_bancaria: persona.cuentaBancaria,
    activo: persona.activo,
    notas: persona.notas,
    updated_at: new Date().toISOString(),
  }
  
  const { data, error } = await supabase
    .from("personal")
    .upsert(record)
    .select()
    .single()
  
  if (error) {
    console.error("Error upserting personal:", error)
    return null
  }
  
  return data ? {
    id: data.id,
    nombre: data.nombre,
    apellido: data.apellido,
    dni: data.dni || "",
    telefono: data.telefono || "",
    email: data.email,
    funcion: data.funcion,
    servicioVinculadoId: data.servicio_vinculado_id || "",
    tarifaBase: Number(data.tarifa_base) || 0,
    tarifas: data.tarifas || [],
    cuentaBancaria: data.cuenta_bancaria,
    activo: data.activo ?? true,
    notas: data.notas,
  } : null
}

export async function deletePersonal(id: string): Promise<boolean> {
  const { error } = await supabase.from("personal").delete().eq("id", id)
  if (error) {
    console.error("Error deleting personal:", error)
    return false
  }
  return true
}

// ============ EVENTOS ============
export async function fetchEventos(): Promise<Evento[]> {
  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .order("fecha", { ascending: false })
  
  if (error) {
    console.error("Error fetching eventos:", error)
    return []
  }
  
  return (data || []).map(e => ({
    id: e.id,
    nombre: e.nombre,
    nombrePareja: e.nombre_pareja,
    fecha: e.fecha,
    horaInicio: e.hora_inicio,
    horaFin: e.hora_fin,
    tipoEvento: e.tipo_evento || "boda",
    salon: e.salon,
    cantidadPersonas: e.cantidad_personas || 0,
    // Invitados por segmento
    adultos: e.adultos || 0,
    adolescentes: e.adolescentes || 0,
    ninos: e.ninos || 0,
    personasDietasEspeciales: e.personas_dietas_especiales || 0,
    // Recetas por segmento
    recetasAdultos: e.recetas_adultos || [],
    recetasAdolescentes: e.recetas_adolescentes || [],
    recetasNinos: e.recetas_ninos || [],
    recetasDietas: e.recetas_dietas || [],
    // Multipliers
    multipliersAdultos: e.multipliers_adultos || {},
    multipliersAdolescentes: e.multipliers_adolescentes || {},
    multipliersNinos: e.multipliers_ninos || {},
    multipliersDietas: e.multipliers_dietas || {},
    // Barra
    barraCocteles: e.barra_cocteles,
    barraTemplateId: e.barra_template_id,
    menuNotas: e.menu_notas,
    // Resto
    precioFinal: Number(e.precio_final) || 0,
    precioVenta: Number(e.precio_venta) || 0,
    estado: e.estado || "borrador",
    stockDescontado: e.stock_descontado ?? false,
    servicios: e.servicios || [],
    planDeCuotas: e.plan_de_cuotas,
    pagos: e.pagos || [],
    notas: e.notas,
    contratoGenerado: e.contrato_generado ?? false,
  }))
}

export async function upsertEvento(evento: Partial<Evento>): Promise<Evento | null> {
  const record = {
    id: evento.id,
    nombre: evento.nombre,
    nombre_pareja: evento.nombrePareja,
    fecha: evento.fecha,
    hora_inicio: evento.horaInicio,
    hora_fin: evento.horaFin,
    tipo_evento: evento.tipoEvento,
    salon: evento.salon,
    cantidad_personas: evento.cantidadPersonas,
    // Invitados por segmento
    adultos: evento.adultos || 0,
    adolescentes: evento.adolescentes || 0,
    ninos: evento.ninos || 0,
    personas_dietas_especiales: evento.personasDietasEspeciales || 0,
    // Recetas por segmento
    recetas_adultos: evento.recetasAdultos || [],
    recetas_adolescentes: evento.recetasAdolescentes || [],
    recetas_ninos: evento.recetasNinos || [],
    recetas_dietas: evento.recetasDietas || [],
    // Multipliers
    multipliers_adultos: evento.multipliersAdultos || {},
    multipliers_adolescentes: evento.multipliersAdolescentes || {},
    multipliers_ninos: evento.multipliersNinos || {},
    multipliers_dietas: evento.multipliersDietas || {},
    // Barra
    barra_cocteles: evento.barraCocteles,
    barra_template_id: evento.barraTemplateId,
    menu_notas: evento.menuNotas,
    // Resto
    precio_final: evento.precioFinal,
    precio_venta: evento.precioVenta,
    estado: evento.estado,
    stock_descontado: evento.stockDescontado,
    servicios: evento.servicios || [],
    plan_de_cuotas: evento.planDeCuotas,
    pagos: evento.pagos || [],
    notas: evento.notas,
    contrato_generado: evento.contratoGenerado,
    updated_at: new Date().toISOString(),
  }
  
  const { data, error } = await supabase
    .from("eventos")
    .upsert(record)
    .select()
    .single()
  
  if (error) {
    console.error("Error upserting evento:", error)
    return null
  }
  
  return data ? {
    id: data.id,
    nombre: data.nombre,
    nombrePareja: data.nombre_pareja,
    fecha: data.fecha,
    horaInicio: data.hora_inicio,
    horaFin: data.hora_fin,
    tipoEvento: data.tipo_evento || "boda",
    salon: data.salon,
    cantidadPersonas: data.cantidad_personas || 0,
    adultos: data.adultos || 0,
    adolescentes: data.adolescentes || 0,
    ninos: data.ninos || 0,
    personasDietasEspeciales: data.personas_dietas_especiales || 0,
    recetasAdultos: data.recetas_adultos || [],
    recetasAdolescentes: data.recetas_adolescentes || [],
    recetasNinos: data.recetas_ninos || [],
    recetasDietas: data.recetas_dietas || [],
    multipliersAdultos: data.multipliers_adultos || {},
    multipliersAdolescentes: data.multipliers_adolescentes || {},
    multipliersNinos: data.multipliers_ninos || {},
    multipliersDietas: data.multipliers_dietas || {},
    barraCocteles: data.barra_cocteles,
    barraTemplateId: data.barra_template_id,
    menuNotas: data.menu_notas,
    precioFinal: Number(data.precio_final) || 0,
    precioVenta: Number(data.precio_venta) || 0,
    estado: data.estado || "borrador",
    stockDescontado: data.stock_descontado ?? false,
    servicios: data.servicios || [],
    planDeCuotas: data.plan_de_cuotas,
    pagos: data.pagos || [],
    notas: data.notas,
    contratoGenerado: data.contrato_generado ?? false,
  } : null
}

export async function deleteEvento(id: string): Promise<boolean> {
  const { error } = await supabase.from("eventos").delete().eq("id", id)
  if (error) {
    console.error("Error deleting evento:", error)
    return false
  }
  return true
}

// ============ PAGOS PERSONAL ============
export async function fetchPagosPersonal(): Promise<PagoPersonal[]> {
  const { data, error } = await supabase
    .from("pagos_personal")
    .select("*")
    .order("fecha_evento")
  
  if (error) {
    console.error("Error fetching pagos_personal:", error)
    return []
  }
  
  return (data || []).map(p => ({
    id: p.id,
    personalId: p.personal_id,
    eventoId: p.evento_id,
    nombrePersonal: p.nombre_personal,
    servicioNombre: p.servicio_nombre,
    montoTotal: Number(p.monto_total) || 0,
    montoSeña: p.monto_sena ? Number(p.monto_sena) : undefined,
    fechaSeña: p.fecha_sena,
    fechaEvento: p.fecha_evento,
    fechaLimitePago: p.fecha_limite_pago,
    estado: p.estado || "pendiente",
    tipoPago: p.tipo_pago,
    fechaPago: p.fecha_pago,
    tarifaId: p.tarifa_id,
    asignacionId: p.asignacion_id,
    notasPago: p.notas_pago,
  }))
}

export async function upsertPagoPersonal(pago: Partial<PagoPersonal>): Promise<PagoPersonal | null> {
  const record = {
    id: pago.id,
    personal_id: pago.personalId,
    evento_id: pago.eventoId,
    nombre_personal: pago.nombrePersonal,
    servicio_nombre: pago.servicioNombre,
    monto_total: pago.montoTotal,
    monto_sena: pago.montoSeña,
    fecha_sena: pago.fechaSeña,
    fecha_evento: pago.fechaEvento,
    fecha_limite_pago: pago.fechaLimitePago,
    estado: pago.estado,
    tipo_pago: pago.tipoPago,
    fecha_pago: pago.fechaPago,
    tarifa_id: pago.tarifaId,
    asignacion_id: pago.asignacionId,
    notas_pago: pago.notasPago,
    updated_at: new Date().toISOString(),
  }
  
  const { data, error } = await supabase
    .from("pagos_personal")
    .upsert(record)
    .select()
    .single()
  
  if (error) {
    console.error("Error upserting pago_personal:", error)
    return null
  }
  
  return data ? {
    id: data.id,
    personalId: data.personal_id,
    eventoId: data.evento_id,
    nombrePersonal: data.nombre_personal,
    servicioNombre: data.servicio_nombre,
    montoTotal: Number(data.monto_total) || 0,
    montoSeña: data.monto_sena ? Number(data.monto_sena) : undefined,
    fechaSeña: data.fecha_sena,
    fechaEvento: data.fecha_evento,
    fechaLimitePago: data.fecha_limite_pago,
    estado: data.estado || "pendiente",
    tipoPago: data.tipo_pago,
    fechaPago: data.fecha_pago,
    tarifaId: data.tarifa_id,
    asignacionId: data.asignacion_id,
    notasPago: data.notas_pago,
  } : null
}

export async function deletePagoPersonal(id: string): Promise<boolean> {
  const { error } = await supabase.from("pagos_personal").delete().eq("id", id)
  if (error) {
    console.error("Error deleting pago_personal:", error)
    return false
  }
  return true
}

// ============ ASIGNACIONES ============
export async function fetchAsignaciones(): Promise<AsignacionPersonal[]> {
  const { data, error } = await supabase
    .from("asignaciones")
    .select("*")
  
  if (error) {
    console.error("Error fetching asignaciones:", error)
    return []
  }
  
  return (data || []).map(a => ({
    id: a.id,
    eventoId: a.evento_id,
    servicioId: a.servicio_id,
    servicioNombre: a.servicio_nombre,
    rol: a.rol,
    personalAsignadoId: a.personal_asignado_id,
  }))
}

export async function upsertAsignacion(asig: Partial<AsignacionPersonal>): Promise<AsignacionPersonal | null> {
  const record = {
    id: asig.id,
    evento_id: asig.eventoId,
    servicio_id: asig.servicioId,
    servicio_nombre: asig.servicioNombre,
    rol: asig.rol,
    personal_asignado_id: asig.personalAsignadoId,
    updated_at: new Date().toISOString(),
  }
  
  const { data, error } = await supabase
    .from("asignaciones")
    .upsert(record)
    .select()
    .single()
  
  if (error) {
    console.error("Error upserting asignacion:", error)
    return null
  }
  
  return data ? {
    id: data.id,
    eventoId: data.evento_id,
    servicioId: data.servicio_id,
    servicioNombre: data.servicio_nombre,
    rol: data.rol,
    personalAsignadoId: data.personal_asignado_id,
  } : null
}

export async function deleteAsignacion(id: string): Promise<boolean> {
  const { error } = await supabase.from("asignaciones").delete().eq("id", id)
  if (error) {
    console.error("Error deleting asignacion:", error)
    return false
  }
  return true
}

// ============ COSTOS OPERATIVOS ============
export async function fetchCostosOperativos(): Promise<CostoOperativo[]> {
  const { data, error } = await supabase
    .from("costos_operativos")
    .select("*")
    .order("concepto")
  
  if (error) {
    console.error("Error fetching costos_operativos:", error)
    return []
  }
  
  return (data || []).map(c => ({
    id: c.id,
    concepto: c.concepto,
    monto: Number(c.monto) || 0,
    frecuencia: c.frecuencia || "mensual",
    diaVencimiento: c.dia_vencimiento,
    activo: c.activo ?? true,
    categoria: c.categoria,
    notas: c.notas,
  }))
}

export async function upsertCostoOperativo(costo: Partial<CostoOperativo>): Promise<CostoOperativo | null> {
  const record = {
    id: costo.id,
    concepto: costo.concepto,
    monto: costo.monto,
    frecuencia: costo.frecuencia,
    dia_vencimiento: costo.diaVencimiento,
    activo: costo.activo,
    categoria: costo.categoria,
    notas: costo.notas,
    updated_at: new Date().toISOString(),
  }
  
  const { data, error } = await supabase
    .from("costos_operativos")
    .upsert(record)
    .select()
    .single()
  
  if (error) {
    console.error("Error upserting costo_operativo:", error)
    return null
  }
  
  return data ? {
    id: data.id,
    concepto: data.concepto,
    monto: Number(data.monto) || 0,
    frecuencia: data.frecuencia || "mensual",
    diaVencimiento: data.dia_vencimiento,
    activo: data.activo ?? true,
    categoria: data.categoria,
    notas: data.notas,
  } : null
}

export async function deleteCostoOperativo(id: string): Promise<boolean> {
  const { error } = await supabase.from("costos_operativos").delete().eq("id", id)
  if (error) {
    console.error("Error deleting costo_operativo:", error)
    return false
  }
  return true
}

// ============ MOVIMIENTOS CAJA ============
export async function fetchMovimientosCaja(): Promise<MovimientoCaja[]> {
  const { data, error } = await supabase
    .from("movimientos_caja")
    .select("*")
    .order("created_at", { ascending: false })
  
  if (error) {
    console.error("Error fetching movimientos_caja:", error)
    return []
  }
  
  return (data || []).map(m => ({
    id: m.id,
    salon: m.salon,
    tipo: m.tipo,
    monto: Number(m.monto) || 0,
    concepto: m.concepto,
    fecha: m.fecha,
    saldoAnterior: m.saldo_anterior ? Number(m.saldo_anterior) : undefined,
    saldoPosterior: m.saldo_posterior ? Number(m.saldo_posterior) : undefined,
  }))
}

export async function insertMovimientoCaja(mov: Partial<MovimientoCaja>): Promise<MovimientoCaja | null> {
  const record = {
    id: mov.id || crypto.randomUUID(),
    salon: mov.salon,
    tipo: mov.tipo,
    monto: mov.monto,
    concepto: mov.concepto,
    fecha: mov.fecha,
    saldo_anterior: mov.saldoAnterior,
    saldo_posterior: mov.saldoPosterior,
  }
  
  const { data, error } = await supabase
    .from("movimientos_caja")
    .insert(record)
    .select()
    .single()
  
  if (error) {
    console.error("Error inserting movimiento_caja:", error)
    return null
  }
  
  return data ? {
    id: data.id,
    salon: data.salon,
    tipo: data.tipo,
    monto: Number(data.monto) || 0,
    concepto: data.concepto,
    fecha: data.fecha,
    saldoAnterior: data.saldo_anterior ? Number(data.saldo_anterior) : undefined,
    saldoPosterior: data.saldo_posterior ? Number(data.saldo_posterior) : undefined,
  } : null
}

// ============ CONFIGURACION CAJAS ============
export async function fetchConfiguracionCajas(): Promise<any> {
  const { data, error } = await supabase
    .from("configuracion_cajas")
    .select("*")
    .eq("id", "config")
    .single()
  
  if (error && error.code !== "PGRST116") {
    console.error("Error fetching configuracion_cajas:", error)
  }
  
  if (!data) {
    return { salones: {}, admin: { saldoInicial: 0 } }
  }
  
  return {
    ...data.salones,
    admin: data.admin || { saldoInicial: 0 },
  }
}

export async function upsertConfiguracionCajas(config: any): Promise<boolean> {
  const { admin, ...salones } = config
  
  const { error } = await supabase
    .from("configuracion_cajas")
    .upsert({
      id: "config",
      salones,
      admin: admin || { saldoInicial: 0 },
      updated_at: new Date().toISOString(),
    })
  
  if (error) {
    console.error("Error upserting configuracion_cajas:", error)
    return false
  }
  return true
}

// ============ HISTORIAL IPC ============
export async function fetchHistorialIPC(): Promise<HistorialIPC[]> {
  const { data, error } = await supabase
    .from("historial_ipc")
    .select("*")
    .order("fecha_aplicacion", { ascending: false })
  
  if (error) {
    console.error("Error fetching historial_ipc:", error)
    return []
  }
  
  return (data || []).map(h => ({
    id: h.id,
    mes: h.mes,
    anio: h.anio,
    porcentaje: Number(h.porcentaje) || 0,
    fechaAplicacion: h.fecha_aplicacion,
    eventosActualizados: h.eventos_actualizados || 0,
  }))
}

export async function insertHistorialIPC(hist: Partial<HistorialIPC>): Promise<HistorialIPC | null> {
  const record = {
    id: hist.id || crypto.randomUUID(),
    mes: hist.mes,
    anio: hist.anio,
    porcentaje: hist.porcentaje,
    fecha_aplicacion: hist.fechaAplicacion || new Date().toISOString(),
    eventos_actualizados: hist.eventosActualizados || 0,
  }
  
  const { data, error } = await supabase
    .from("historial_ipc")
    .insert(record)
    .select()
    .single()
  
  if (error) {
    console.error("Error inserting historial_ipc:", error)
    return null
  }
  
  return data ? {
    id: data.id,
    mes: data.mes,
    anio: data.anio,
    porcentaje: Number(data.porcentaje) || 0,
    fechaAplicacion: data.fecha_aplicacion,
    eventosActualizados: data.eventos_actualizados || 0,
  } : null
}

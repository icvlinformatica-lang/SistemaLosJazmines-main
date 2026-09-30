// Las 13 lecturas de Supabase que usa la carga inicial, con su consulta y su
// mapeo (snake_case → camelCase, Number(), paginación con fetchAllPages).
// Movidas tal cual desde lib/supabase/data-service.ts para que las usen:
//   - el navegador, vía data-service.ts (con el cliente del proxy /api/db);
//   - el servidor, vía app/api/carga-inicial (con lib/supabase/servidor.ts).
// Así el mapeo existe en un solo lugar.
//
// Sin "use client" a propósito: este archivo no tiene estado ni toca window.
//
// `lanzarErrores` (default false): con false cada función se comporta como
// siempre (varias, ante un error de Supabase, lo loguean y devuelven una lista
// vacía o un valor por defecto). La carga unificada del servidor lo pasa en
// true: un error nunca se disfraza de "tabla vacía" (eso podría disparar las
// migraciones one-time del navegador); en su lugar esa clave se marca como
// fallida y el navegador la vuelve a pedir por el camino de siempre.

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAllPages } from "../fetch-all-pages"
import type {
  Servicio,
  PersonalEvento,
  PagoPersonal,
  AsignacionPersonal,
  CostoOperativo,
  MovimientoCaja,
  GastoArchivado,
  HistorialIPCEntry as HistorialIPC,
  Vendedor,
  PreciosVentaMap,
  PaqueteSalon,
  TemporadaPrecio,
} from "../store"

export interface OpcionesLectura {
  lanzarErrores?: boolean
}

export async function fetchReportRows(supabase: SupabaseClient, table: "personal" | "costos_operativos" | "gastos_archivados" | "vendedores") {
  return fetchAllPages<Record<string, any> & { id: string }>((from, to) => supabase
    .from(table).select("*", { count: "exact" }).order("id").range(from, to)
    .abortSignal(AbortSignal.timeout(15000)))
}

// ============ SERVICIOS ============
export async function leerServicios(supabase: SupabaseClient): Promise<Servicio[]> {
  const data = await fetchAllPages<Record<string, any> & { id: string }>((from, to) => supabase
    .from("servicios")
    .select("*", { count: "exact" })
    .order("orden", { ascending: true, nullsFirst: false })
    .order("nombre")
    .order("id")
    .range(from, to)
    .abortSignal(AbortSignal.timeout(15000)))

  return (data || []).map(s => ({
    id: s.id,
    codigo: s.codigo || "",
    nombre: s.nombre,
    descripcion: s.descripcion || "",
    categoria: s.categoria,
    unidad: s.unidad || "Fijo",
    activo: s.activo ?? true,
    margenGanancia: Number(s.margen_ganancia) || 0,
    precioVenta: Number(s.precio_venta) || 0,
    costoParaCajaEventos: Number(s.costo_para_caja_eventos) || 0,
    porcentajeSeña: Number(s.porcentaje_sena) || 30,
    diasAnticipacionSeña: Number(s.dias_anticipacion_sena) || 30,
    diasAnticipacionSaldo: Number(s.dias_anticipacion_saldo) || 7,
    proveedor: s.proveedor || undefined,
    notas: s.notas || undefined,
    orden: s.orden ?? undefined,
    createdAt: s.created_at || undefined,
  }))
}

// ============ PERSONAL ============
export async function leerPersonal(supabase: SupabaseClient, strict = false, opciones: OpcionesLectura = {}): Promise<PersonalEvento[]> {
  const { data, error } = strict ? { data: await fetchReportRows(supabase, "personal"), error: null } : await supabase
    .from("personal")
    .select("*")
    .order("orden", { ascending: true, nullsFirst: false })
    .order("apellido")

  if (error) {
    if (opciones.lanzarErrores) throw error
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
    orden: p.orden ?? undefined,
  }))
}

// ============ PAGOS PERSONAL ============
export async function leerPagosPersonal(supabase: SupabaseClient): Promise<PagoPersonal[]> {
  const data = await fetchAllPages<Record<string, any> & { id: string }>((from, to) => supabase
    .from("pagos_personal")
    .select("*", { count: "exact" })
    .order("fecha_evento")
    .order("id")
    .range(from, to)
    .abortSignal(AbortSignal.timeout(15000)))

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

// ============ ASIGNACIONES ============
export async function leerAsignaciones(supabase: SupabaseClient, opciones: OpcionesLectura = {}): Promise<AsignacionPersonal[]> {
  const { data, error } = await supabase
    .from("asignaciones")
    .select("*")

  if (error) {
    if (opciones.lanzarErrores) throw error
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

// ============ COSTOS OPERATIVOS ============
export async function leerCostosOperativos(supabase: SupabaseClient, strict = false, opciones: OpcionesLectura = {}): Promise<CostoOperativo[]> {
  const { data, error } = strict ? { data: await fetchReportRows(supabase, "costos_operativos"), error: null } : await supabase
    .from("costos_operativos")
    .select("*")
    .order("concepto")

  if (error) {
    if (opciones.lanzarErrores) throw error
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
    salon: c.salon ?? null,
    fechaVencimiento: c.fecha_vencimiento ?? undefined,
    fechaGasto: c.fecha_gasto ?? undefined,
    esVariable: c.es_variable ?? false,
    esServicio: c.es_servicio ?? false,
    icono: c.icono ?? undefined,
    pagado: c.pagado ?? false,
    distribucion: Array.isArray(c.distribucion) ? c.distribucion : undefined,
    historialMontos: Array.isArray(c.historial_montos) ? c.historial_montos : undefined,
    createdAt: c.created_at ?? undefined,
    cargadoPor: c.cargado_por ?? undefined,
  }))
}

// ============ MOVIMIENTOS CAJA ============
export async function leerMovimientosCaja(supabase: SupabaseClient): Promise<MovimientoCaja[]> {
  const data = await fetchAllPages<Record<string, any> & { id: string }>((from, to) => supabase
    .from("movimientos_caja")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to)
    .abortSignal(AbortSignal.timeout(15000)))

  return (data || []).map(m => ({
    id: m.id,
    salon: m.salon,
    tipo: m.tipo,
    monto: Number(m.monto) || 0,
    concepto: m.concepto,
    fecha: m.fecha,
    eventoId: m.evento_id ?? undefined,
    saldoResultante: m.saldo_resultante ? Number(m.saldo_resultante) : 0,
    cajaDestino: m.caja_destino ?? undefined,
    saldoAnterior: m.saldo_anterior ? Number(m.saldo_anterior) : undefined,
    saldoPosterior: m.saldo_posterior ? Number(m.saldo_posterior) : undefined,
  }))
}

// ============ GASTOS ARCHIVADOS ============
export function mapGastoArchivado(g: Record<string, any>): GastoArchivado {
  return {
    id: g.id,
    fecha: g.fecha,
    concepto: g.concepto,
    monto: Number(g.monto) || 0,
    salon: g.salon ?? null,
    origen: g.origen,
    categoria: g.categoria ?? null,
    frecuencia: g.frecuencia ?? null,
    eventoId: g.evento_id ?? null,
    eventoNombre: g.evento_nombre ?? null,
    refId: g.ref_id ?? null,
    cargadoPor: g.cargado_por ?? null,
  }
}

export async function leerGastosArchivados(supabase: SupabaseClient, strict = false, opciones: OpcionesLectura = {}): Promise<GastoArchivado[]> {
  const { data, error } = strict ? { data: await fetchReportRows(supabase, "gastos_archivados"), error: null } : await supabase
    .from("gastos_archivados")
    .select("*")
    .order("fecha", { ascending: false })

  if (error) {
    if (opciones.lanzarErrores) throw error
    console.error("Error fetching gastos_archivados:", error)
    return []
  }
  return (data || []).map(mapGastoArchivado)
}

// ============ CONFIGURACION CAJAS ============
export async function leerConfiguracionCajas(supabase: SupabaseClient, opciones: OpcionesLectura = {}): Promise<any> {
  const { data, error } = await supabase
    .from("configuracion_cajas")
    .select("*")
    .eq("id", "config")
    .single()

  if (error && error.code !== "PGRST116") {
    if (opciones.lanzarErrores) throw error
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

// ============ HISTORIAL IPC ============
export async function leerHistorialIPC(supabase: SupabaseClient, opciones: OpcionesLectura = {}): Promise<HistorialIPC[]> {
  const { data, error } = await supabase
    .from("historial_ipc")
    .select("*")
    .order("fecha_aplicacion", { ascending: false })

  if (error) {
    if (opciones.lanzarErrores) throw error
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

// ============ VENDEDORES ============
export async function leerVendedores(supabase: SupabaseClient, strict = false, opciones: OpcionesLectura = {}): Promise<Vendedor[]> {
  const { data, error } = strict ? { data: await fetchReportRows(supabase, "vendedores"), error: null } : await supabase
    .from("vendedores")
    .select("*")
    .order("nombre", { ascending: true })

  if (error) {
    if (opciones.lanzarErrores) throw error
    console.error("Error fetching vendedores:", error)
    return []
  }

  return (data || []).map((v) => ({
    id: v.id,
    nombre: v.nombre,
    emoji: v.emoji || "",
    sueldo: Number(v.sueldo) || 0,
    comisionPct: Number(v.comision_pct) || 0,
    sueldoFechaPago: v.sueldo_fecha_pago || undefined,
    anotacion: v.anotacion || undefined,
  }))
}

// ============ PRECIOS VENTA ============
export async function leerPreciosVenta(supabase: SupabaseClient, opciones: OpcionesLectura = {}): Promise<PreciosVentaMap> {
  const { data, error } = await supabase
    .from("precios_venta")
    .select("salon, fecha, precio")
  if (error && opciones.lanzarErrores) throw error
  if (error || !data) return {}
  const map: PreciosVentaMap = {}
  for (const row of data) {
    if (!map[row.salon]) map[row.salon] = {}
    map[row.salon][row.fecha] = Number(row.precio)
  }
  return map
}

// ============ PAQUETES DE SALONES (JSONB) ============
export async function leerPaquetesSalones(supabase: SupabaseClient, opciones: OpcionesLectura = {}): Promise<PaqueteSalon[]> {
  const { data, error } = await supabase.from("paquetes_salones").select("id, data")
  if (error) {
    if (opciones.lanzarErrores) throw error
    console.error("Error fetching paquetes_salones:", error)
    return []
  }
  return (data || []).map((row) => ({ ...(row.data as PaqueteSalon), id: row.id }))
}

// ============ TEMPORADAS DE PRECIOS (JSONB) ============
export async function leerTemporadas(supabase: SupabaseClient, opciones: OpcionesLectura = {}): Promise<TemporadaPrecio[]> {
  const { data, error } = await supabase.from("temporadas").select("id, data")
  if (error) {
    if (opciones.lanzarErrores) throw error
    console.error("Error fetching temporadas:", error)
    return []
  }
  return (data || []).map((row) => ({ ...(row.data as TemporadaPrecio), id: row.id }))
}

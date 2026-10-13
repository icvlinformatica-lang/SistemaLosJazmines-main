// Datos que el chat de ayuda (solo perfil Soporte) puede consultar: eventos
// con su plata (total, cobrado, saldo y cuotas por cobrar) y accesos directos
// a las pantallas. SOLO LECTURA: nada de acá escribe en la base.
//
// Privacidad: lo que devuelven estas funciones se le manda al modelo de IA
// (AI Gateway de Vercel). Por eso NO incluye DNI, teléfonos ni el contrato:
// solo nombre del evento, fecha, salón, invitados y montos.
//
// Corre SOLO en el servidor (lo usa app/api/chat/route.ts).
import { cuotasPendientesEvento } from "@/lib/resumen-diario"
import type { HistorialIPCEntry } from "@/lib/store"

export interface AccionChat {
  etiqueta: string
  href: string
}

/** Fila de `eventos` con las columnas que lee el chat (ver SELECT en la ruta). */
export type FilaEventoChat = Record<string, unknown>

export interface CuotaPendienteChat {
  numero: number
  vencimiento: string
  monto: number
  atrasada: boolean
  recargoPorAtraso: number
  ipcPendiente?: string
}

export interface ResumenEventoChat {
  id: string
  nombre: string
  fecha: string
  horario: string
  salon: string
  tipoEvento: string
  estado: string
  invitados: number
  ajustaPorIPC: boolean
  /** Total del plan de pagos (o precio de venta si no hay plan). null = sin precio cargado. */
  montoTotal: number | null
  sena: number
  /** Seña + cuotas cobradas. */
  cobrado: number
  saldoPendiente: number | null
  cuotasDelPlan: number
  cuotasPendientes: CuotaPendienteChat[]
  montoAtrasado: number
}

export const SALONES_CHAT = ["Quinta", "Casona", "Salon", "Salon 4", "Salon 5"] as const

const SIN_LIMITE = "9999-12-31"

// Los JSON de eventos pueden venir como texto dentro de jsonb (ver CLAUDE.md).
function leerJson<T>(valor: unknown, porDefecto: T): T {
  if (valor === null || valor === undefined) return porDefecto
  if (typeof valor === "string") {
    try {
      return JSON.parse(valor) as T
    } catch {
      return porDefecto
    }
  }
  return valor as T
}

const redondear = (n: number) => Math.round(n * 100) / 100

/** Minúsculas y sin tildes: "Martínez" y "martinez" son lo mismo. */
export function normalizarTexto(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

function fechaDe(fila: FilaEventoChat): string {
  return String(fila.fecha ?? "").slice(0, 10)
}

function salonVisible(salon: unknown): string {
  const s = String(salon ?? "").trim()
  if (!s) return "Sin salón"
  return s === "Salon" ? "Salón" : s
}

/**
 * Plata de un evento con las mismas reglas que Cobrar cuota: el total es el
 * del plan de pagos (si no hay, el precio de venta), lo cobrado es la seña
 * más las cuotas pagadas, y las cuotas por cobrar salen de la cuenta de
 * "Vienen a pagar" (cuotasPendientesEvento), con IPC si ya está listo.
 */
export function resumenEventoChat(fila: FilaEventoChat, historialIPC: HistorialIPCEntry[], hoy: string): ResumenEventoChat {
  const plan = leerJson<Record<string, unknown> | null>(fila.plan_de_cuotas, null)
  const pagos = leerJson<Array<Record<string, unknown>>>(fila.pagos, [])
  const estado = String(fila.estado ?? "")

  const totalPlan = Number(plan?.montoTotal) || 0
  const precioVenta = Number(fila.precio_venta) || 0
  const montoTotal = totalPlan > 0 ? totalPlan : precioVenta > 0 ? precioVenta : null
  const sena = plan?.modalidadPago === "sena" ? Number(plan.montoSena) || 0 : 0
  const cobrado = redondear(pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0) + sena)

  const cuotasDelPlan = Number(plan?.numeroCuotas) || 0
  let cuotasPendientes: CuotaPendienteChat[] = []
  let montoAtrasado = 0
  if (plan && cuotasDelPlan > 0 && estado !== "completado" && estado !== "cancelado") {
    // Todas las cuotas sin pagar (sin límite de fecha); "atrasada" = venció antes de hoy.
    const r = cuotasPendientesEvento({ estado, pagos: fila.pagos, plan }, historialIPC, {
      hoy,
      inicioSemana: hoy,
      finSemana: SIN_LIMITE,
    })
    cuotasPendientes = r.cuotasPendientes.map((c) => ({
      numero: c.numero,
      vencimiento: c.fechaVencimiento,
      monto: redondear(c.monto),
      atrasada: c.atrasada,
      recargoPorAtraso: c.recargo,
      ...(c.ipcPendiente ? { ipcPendiente: c.ipcPendiente } : {}),
    }))
    montoAtrasado = redondear(r.montoAtrasado)
  }

  return {
    id: String(fila.id ?? ""),
    nombre: String(fila.nombre_pareja || fila.nombre || "Sin nombre"),
    fecha: fechaDe(fila),
    horario: String(fila.horario ?? ""),
    salon: salonVisible(fila.salon),
    tipoEvento: String(fila.tipo_evento ?? ""),
    estado,
    invitados: (Number(fila.adultos) || 0) + (Number(fila.adolescentes) || 0) + (Number(fila.ninos) || 0),
    ajustaPorIPC: plan?.ajustaPorIPC === true,
    montoTotal: montoTotal === null ? null : redondear(montoTotal),
    sena: redondear(sena),
    cobrado,
    saldoPendiente: montoTotal === null ? null : redondear(Math.max(0, montoTotal - cobrado)),
    cuotasDelPlan,
    cuotasPendientes,
    montoAtrasado,
  }
}

export interface FiltroEventosChat {
  texto?: string
  fecha?: string
  desde?: string
  hasta?: string
  salon?: string
}

/** Eventos que coinciden con el filtro, ordenados por fecha. Incluye los finalizados (se ve su estado). */
export function filtrarEventosChat(filas: FilaEventoChat[], filtro: FiltroEventosChat): FilaEventoChat[] {
  const texto = normalizarTexto(filtro.texto)
  return filas
    .filter((f) => {
      const fecha = fechaDe(f)
      if (filtro.fecha && fecha !== filtro.fecha) return false
      if (filtro.desde && fecha < filtro.desde) return false
      if (filtro.hasta && fecha > filtro.hasta) return false
      if (filtro.salon && String(f.salon ?? "") !== filtro.salon) return false
      if (texto) {
        const nombres = normalizarTexto(`${f.nombre ?? ""} ${f.nombre_pareja ?? ""}`)
        if (!nombres.includes(texto)) return false
      }
      return true
    })
    .sort((a, b) => fechaDe(a).localeCompare(fechaDe(b)))
}

/**
 * Los tres botones de un evento. Son las mismas direcciones que ya usan
 * otras pantallas: la Lista resalta el evento con ?evento=, Cobrar cuota lo
 * abre con ?evento= y Costos con ?id=. Los finalizados no están en la Lista
 * (van al Archivo), así que para ellos el primer botón lleva al Archivo.
 */
export function accesosEvento(id: string, nombre: string, estado: string): AccionChat[] {
  const idUrl = encodeURIComponent(id)
  const primero =
    estado === "completado"
      ? { etiqueta: `${nombre}: ver en el Archivo`, href: "/eventos/finalizados" }
      : { etiqueta: `${nombre}: ver en la Lista`, href: `/eventos/lista?evento=${idUrl}` }
  return [
    primero,
    { etiqueta: `${nombre}: cuotas por cobrar`, href: `/eventos/pagos?evento=${idUrl}` },
    { etiqueta: `${nombre}: costos`, href: `/eventos/costos?id=${idUrl}` },
  ]
}

/** Pantallas a las que el chat puede mandar un botón (solo estas, nunca una dirección inventada). */
export const PANTALLAS_CHAT = {
  inicio: { etiqueta: "Inicio", href: "/" },
  lista_eventos: { etiqueta: "Lista de eventos", href: "/eventos/lista" },
  calendario: { etiqueta: "Calendario", href: "/eventos/calendario" },
  cobrar_cuota: { etiqueta: "Cobrar cuota", href: "/eventos/pagos" },
  cotizaciones: { etiqueta: "Cotizaciones", href: "/eventos/cotizaciones" },
  archivo_eventos: { etiqueta: "Archivo de eventos", href: "/eventos/finalizados" },
  caja_eventos: { etiqueta: "Caja Eventos", href: "/finanzas/caja-eventos" },
  caja_jazmines: { etiqueta: "Caja Jazmines", href: "/finanzas/caja-jazmines" },
  servicios: { etiqueta: "Servicios", href: "/finanzas/servicios" },
  personal: { etiqueta: "Personal", href: "/finanzas/personal" },
  ipc: { etiqueta: "IPC", href: "/finanzas/ipc" },
  insumos_cocina: { etiqueta: "Insumos Cocina", href: "/admin/almacen" },
  insumos_bebidas: { etiqueta: "Insumos Bebidas", href: "/admin/barra" },
  recetas: { etiqueta: "Recetas", href: "/admin/recetario" },
  cocteles: { etiqueta: "Cócteles", href: "/admin/cocteles" },
  guias_produccion: { etiqueta: "Guías de producción", href: "/eventos/produccion" },
  stock: { etiqueta: "Stock por salón", href: "/stock" },
  configuracion: { etiqueta: "Configuración", href: "/configuracion" },
} as const

export type PantallaChat = keyof typeof PANTALLAS_CHAT

/** Máximo de botones por respuesta, para que el chat no se llene. */
export const MAX_ACCIONES_CHAT = 9

/** Agrega botones sin repetir direcciones y sin pasar el máximo. */
export function sumarAcciones(acciones: AccionChat[], nuevas: AccionChat[]): void {
  for (const a of nuevas) {
    if (acciones.length >= MAX_ACCIONES_CHAT) return
    if (!acciones.some((x) => x.href === a.href)) acciones.push(a)
  }
}

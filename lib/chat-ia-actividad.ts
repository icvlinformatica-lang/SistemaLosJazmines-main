// Resumen del Historial de Actividad (Configuración → Historial de Actividad,
// tabla activity_log) para el chat con IA: qué se hizo un día o una semana, y
// quién lo hizo.
//
// activity_log NO guarda el perfil. Quién lo hizo sale del texto del detalle:
// - "· Por Leila" (o Diego, Ricky, Soporte…): lo agregan las rutas cuando hay
//   un nombre de quien entró (cookie lj_usuario de Administración) o el chat.
// - Las cargas de stock (tipo stock_sesion) dicen el sector en el nombre
//   ("Casona — cocina") y el nombre que escribió quien cargó en el detalle.
// Lo demás (por ejemplo, Barra cambiando un insumo) queda "sin dato de quién".
// Solo lectura: nada de acá escribe.
import { fechaHoraCortaArgentina } from "@/lib/stock-salones"

export const MAX_DIAS_ACTIVIDAD_CHAT = 31
/** Renglones que se le pasan a la IA (los totales cuentan todos). */
export const MAX_REGISTROS_ACTIVIDAD_CHAT = 120

export const SIN_QUIEN = "Sin dato de quién"

const TIPOS: Record<string, string> = {
  insumo: "Insumo de cocina",
  insumo_barra: "Insumo de barra",
  insumo_limpieza: "Artículo de limpieza",
  receta: "Receta",
  coctel: "Cóctel",
  evento: "Evento",
  pago: "Pago de cuota",
  contrato: "Contrato",
  vencimiento: "Vencimiento",
  vendedor: "Vendedor",
  caja: "Caja",
  servicio: "Servicio",
  stock_sesion: "Stock por salón",
  ipc: "IPC",
}

export interface FilaActividad {
  id?: unknown
  tipo?: unknown
  accion?: unknown
  nombre?: unknown
  detalle?: unknown
  created_at?: unknown
}

export interface RegistroActividadChat {
  fecha: string
  quien: string
  /** Perfil o sector cuando se sabe (Cocina, Barra). */
  sector?: string
  tipo: string
  accion: string
  nombre: string
  detalle: string
}

const minusculas = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()

/**
 * Saca del texto lo que no tiene que ir a la IA: números que parecen DNI
 * (7 u 8 cifras, o 12.345.678 sin "$" adelante) y teléfonos.
 */
export function limpiarDetalle(texto: string): string {
  return texto
    .replace(/(\+?54[\s-]?)?(9[\s-]?)?\(?\d{2,4}\)?[\s-]\d{3,4}[\s-]\d{4}/g, "[teléfono]")
    .replace(/(^|[^\d.$,\s])(\s*)\d{2}\.\d{3}\.\d{3}(?![\d.,])/g, "$1$2[número]")
    .replace(/(^|[^\d$.,])\d{7,8}(?![\d.,])/g, "$1[número]")
}

/** Día de Argentina (AAAA-MM-DD) de un momento guardado. */
export function diaArgentina(valor: unknown): string {
  const d = valor instanceof Date ? valor : new Date(String(valor ?? ""))
  if (!Number.isFinite(d.getTime())) return ""
  // en-CA escribe las fechas como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
}

/** Quién hizo el registro (y el sector, para las cargas de stock). */
export function quienDeRegistro(f: FilaActividad): { quien: string; sector?: string } {
  const detalle = String(f.detalle ?? "")
  const nombre = String(f.nombre ?? "")
  // El último "Por X" es el que agrega el sistema (el detalle puede citar otro antes).
  const por = [...detalle.matchAll(/(?:^|[·|]\s*)Por\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+)/g)]
  const ultimo = por.length > 0 ? por[por.length - 1][1] : ""
  if (f.tipo === "stock_sesion") {
    const sector = /—\s*barra\s*$/i.test(nombre)
      ? "Barra"
      : /—\s*cocina\s*$/i.test(nombre)
        ? "Cocina"
        : /—\s*limpieza\s*$/i.test(nombre)
          ? "Limpieza"
          : undefined
    // "Carga de stock · 21/10 05:40 · Juan · 12 insumos actualizados"
    const partes = detalle.split("·").map((p) => p.trim())
    const cargo = partes.length >= 4 ? partes[2] : ""
    return { quien: ultimo || cargo || (sector ? `${sector} (sin nombre)` : SIN_QUIEN), sector }
  }
  return { quien: ultimo || SIN_QUIEN }
}

/** El detalle sin el "· Por X" final (ya va en quien) y sin datos personales. */
function detalleParaChat(detalle: string, quien: string): string {
  const sinPor = quien !== SIN_QUIEN ? detalle.replace(new RegExp(`\\s*·?\\s*Por ${quien.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "") : detalle
  return limpiarDetalle(sinPor).slice(0, 200)
}

/** ¿Este registro es de la persona o el sector pedido? ("leila", "cocina", "soporte", "sin dato"). */
export function registroEsDe(r: Pick<RegistroActividadChat, "quien" | "sector">, buscado: string): boolean {
  const b = minusculas(buscado)
  if (!b) return true
  if (b.startsWith("sin")) return r.quien === SIN_QUIEN
  return minusculas(r.quien).includes(b) || (r.sector ? minusculas(r.sector) === b : false)
}

export function registroDesdeFila(f: FilaActividad): RegistroActividadChat {
  const { quien, sector } = quienDeRegistro(f)
  const fecha = f.created_at instanceof Date ? f.created_at : new Date(String(f.created_at ?? ""))
  return {
    fecha: Number.isFinite(fecha.getTime()) ? fechaHoraCortaArgentina(fecha) : "",
    quien,
    ...(sector ? { sector } : {}),
    tipo: TIPOS[String(f.tipo ?? "")] ?? String(f.tipo ?? ""),
    accion: String(f.accion ?? ""),
    nombre: limpiarDetalle(String(f.nombre ?? "")).slice(0, 120),
    detalle: detalleParaChat(String(f.detalle ?? ""), quien),
  }
}

function contar<T>(lista: T[], clave: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const x of lista) out[clave(x)] = (out[clave(x)] ?? 0) + 1
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]))
}

/** Arma el resumen que recibe la IA, con las filas ya traídas de activity_log (más nuevas primero). */
export function resumirActividad(
  filas: FilaActividad[],
  { desde, hasta, quien }: { desde: string; hasta: string; quien?: string },
) {
  const todos = filas.map(registroDesdeFila)
  const elegidos = quien ? todos.filter((r) => registroEsDe(r, quien)) : todos
  return {
    desde,
    hasta,
    ...(quien ? { quienBuscado: quien } : {}),
    total: elegidos.length,
    porQuien: contar(elegidos, (r) => r.quien),
    porTipo: contar(elegidos, (r) => `${r.tipo} ${r.accion}`),
    sinDatoDeQuien: elegidos.filter((r) => r.quien === SIN_QUIEN).length,
    registros: elegidos.slice(0, MAX_REGISTROS_ACTIVIDAD_CHAT),
    ...(elegidos.length > MAX_REGISTROS_ACTIVIDAD_CHAT
      ? { aviso: `Hay ${elegidos.length} registros; se muestran los ${MAX_REGISTROS_ACTIVIDAD_CHAT} más nuevos. Los totales cuentan todos.` }
      : {}),
    // Personas y sectores que aparecen en el período (para preguntar si no se encontró a quien buscó).
    quienesHay: Object.keys(contar(todos, (r) => r.quien)),
  }
}

/** Valida el período pedido: fechas AAAA-MM-DD, en orden y de hasta 31 días. */
export function periodoActividadValido(desde: string, hasta: string): string | null {
  const ok = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && Number.isFinite(new Date(`${f}T12:00:00Z`).getTime())
  if (!ok(desde) || !ok(hasta)) return "Las fechas van como AAAA-MM-DD."
  if (hasta < desde) return "La fecha de fin es anterior a la de inicio."
  const dias = (new Date(`${hasta}T12:00:00Z`).getTime() - new Date(`${desde}T12:00:00Z`).getTime()) / 86_400_000 + 1
  if (dias > MAX_DIAS_ACTIVIDAD_CHAT) return `Como máximo ${MAX_DIAS_ACTIVIDAD_CHAT} días por consulta.`
  return null
}
